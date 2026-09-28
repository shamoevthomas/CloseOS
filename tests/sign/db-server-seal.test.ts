import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { BASELINE, SECURITY, STUBS, applyFile, as, freshDb, pgAvailable, seedOwner } from './db';

const UNLOCK = 'supabase/migrations/20260928_sign_unlock.sql';
const PLATFORMS = 'supabase/migrations/20260929_sign_platforms.sql';
const SEAL = 'supabase/migrations/20260930_sign_server_seal.sql';
const available = await pgAvailable();

describe.skipIf(!available)('migration 20260930_sign_server_seal', () => {
  let db: pg.Client;
  let owner: string;
  const contract = async (extra = '') => (await db.query(`insert into sign_contracts (user_id, title, status${extra ? ', ' + extra.split('=')[0] : ''}) values ($1, 'Devis', 'signed'${extra ? ', ' + extra.split('=')[1] : ''}) returning id`, [owner])).rows[0].id as string;

  beforeAll(async () => {
    db = await freshDb([STUBS, BASELINE, SECURITY, UNLOCK]);
    owner = await seedOwner(db, 'owner@test.fr');
    // Un contrat déjà scellé par le navigateur avant la migration
    await db.query(`insert into sign_contracts (user_id, title, status, sealed_hash) values ($1, 'Ancien', 'signed', 'abc')`, [owner]);
    await applyFile(db, PLATFORMS);
    await applyFile(db, SEAL);
  });
  afterAll(async () => { await db?.end(); });

  it('marque les contrats déjà scellés comme scellés par le navigateur', async () => {
    const { rows } = await db.query(`select sealed_by from sign_contracts where title = 'Ancien'`);
    expect(rows[0].sealed_by).toBe('browser');
  });

  it("réserve sealed_by et le verrou au serveur", async () => {
    const id = await contract();
    await expect(as(db, 'authenticated', owner, (c) => c.query(`update sign_contracts set sealed_by = 'server' where id = $1`, [id])))
      .rejects.toThrow(/server-only/);
    await expect(as(db, 'authenticated', owner, (c) => c.query(`update sign_contracts set seal_started_at = now() where id = $1`, [id])))
      .rejects.toThrow(/server-only/);
    const r = await as(db, 'service_role', null, (c) => c.query(`update sign_contracts set sealed_by = 'server', seal_started_at = now() where id = $1`, [id]));
    expect(r.rowCount).toBe(1);
    await expect(db.query(`update sign_contracts set sealed_by = 'autre' where id = $1`, [id])).rejects.toThrow(/sealed_by_check/);
  });

  it('inscrit le dossier Storage dans la file à la suppression du contrat', async () => {
    const id = await contract();
    await db.query(`delete from sign_contracts where id = $1`, [id]);
    const { rows } = await db.query(`select contract_id, done_at from sign_storage_purge_queue where contract_id = $1`, [id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].done_at).toBeNull();
  });

  it("ne purge jamais un contrat sous conservation légale (suppression refusée, file vide)", async () => {
    const id = await contract('purge_hold=true');
    await expect(db.query(`delete from sign_contracts where id = $1`, [id])).rejects.toThrow(/conservation/);
    const { rows } = await db.query(`select 1 from sign_storage_purge_queue where contract_id = $1`, [id]);
    expect(rows).toHaveLength(0);
  });

  it('protège la file (serveur seulement)', async () => {
    const r = await as(db, 'authenticated', owner, (c) => c.query(`select * from sign_storage_purge_queue`));
    expect(r.rows).toHaveLength(0);
  });

  it('verrou de scellement : un seul preneur, jamais sur un contrat certifié ou scellé par le navigateur', async () => {
    const id = await contract();
    const lock = () => as(db, 'service_role', null, (c) => c.query(`select sign_seal_lock($1) as ok`, [id]), { commit: true });
    expect((await lock()).rows[0].ok).toBe(true);
    expect((await lock()).rows[0].ok).toBe(false);
    await db.query(`update sign_contracts set seal_started_at = now() - interval '6 minutes' where id = $1`, [id]);
    expect((await lock()).rows[0].ok).toBe(true); // verrou abandonné repris
    await db.query(`update sign_contracts set seal_started_at = null, certified_at = now() where id = $1`, [id]);
    expect((await lock()).rows[0].ok).toBe(false);
    const b = await contract();
    await db.query(`update sign_contracts set sealed_by = 'browser' where id = $1`, [b]);
    expect((await as(db, 'service_role', null, (c) => c.query(`select sign_seal_lock($1) as ok`, [b]))).rows[0].ok).toBe(false);
    await expect(as(db, 'authenticated', owner, (c) => c.query(`select sign_seal_lock($1)`, [id]))).rejects.toThrow(/permission denied/);
  });

  it('reste idempotente', async () => {
    await applyFile(db, SEAL);
  });
});
