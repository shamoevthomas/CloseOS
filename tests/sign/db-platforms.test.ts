import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { BASELINE, SECURITY, STUBS, applyFile, as, freshDb, pgAvailable, seedOwner } from './db';

const UNLOCK = 'supabase/migrations/20260928_sign_unlock.sql';
const PLATFORMS = 'supabase/migrations/20260929_sign_platforms.sql';
const available = await pgAvailable();

describe.skipIf(!available)('migration 20260929_sign_platforms', () => {
  let db: pg.Client;
  let owner: string;
  let platform: string;

  beforeAll(async () => {
    db = await freshDb([STUBS, BASELINE, SECURITY, UNLOCK, PLATFORMS]);
    owner = await seedOwner(db, 'owner@test.fr');
    const { rows } = await db.query(`insert into sign_platforms (name, api_key_hash, api_key_hint) values ('SaaS BTP', 'h1', 'sk_…') returning id`);
    platform = rows[0].id;
  });
  afterAll(async () => { await db?.end(); });

  it("n'expose pas les plateformes au navigateur (clé hashée, secret webhook)", async () => {
    const anon = await as(db, 'anon', null, (c) => c.query(`select * from sign_platforms`));
    const auth = await as(db, 'authenticated', owner, (c) => c.query(`select * from sign_platforms`));
    expect(anon.rows).toHaveLength(0);
    expect(auth.rows).toHaveLength(0);
    const srv = await as(db, 'service_role', null, (c) => c.query(`select id from sign_platforms`));
    expect(srv.rows).toHaveLength(1);
  });

  it('interdit à un propriétaire de se rattacher à une plateforme', async () => {
    await expect(as(db, 'authenticated', owner, (c) => c.query(`update sign_users set platform_id = $1 where id = $2`, [platform, owner])))
      .rejects.toThrow(/réservés au serveur/);
  });

  it('laisse le serveur créer un artisan rattaché, exempté d\'abonnement', async () => {
    const { rows } = await db.query(`insert into auth.users (email) values ('acct-1@platform.sign.closeos.fr') returning id`);
    const { rowCount } = await as(db, 'service_role', null, (c) =>
      c.query(`insert into sign_users (id, email, platform_id, external_ref, contact_email, subscription_exempt) values ($1, 'acct-1@platform.sign.closeos.fr', $2, 'artisan-42', 'jean@plomberie.fr', true)`, [rows[0].id, platform]), { commit: true });
    expect(rowCount).toBe(1);
  });

  it("refuse deux artisans avec la même référence externe sur une plateforme", async () => {
    const { rows } = await db.query(`insert into auth.users (email) values ('acct-2@platform.sign.closeos.fr') returning id`);
    await expect(db.query(`insert into sign_users (id, email, platform_id, external_ref) values ($1, 'acct-2@platform.sign.closeos.fr', $2, 'artisan-42')`, [rows[0].id, platform]))
      .rejects.toThrow(/sign_users_platform_ref_uniq/);
  });

  it('ajoute pdf_path et link_expires_at sans toucher aux données existantes', async () => {
    const cols = await db.query(`select table_name, column_name from information_schema.columns where (table_name, column_name) in (('sign_contracts','pdf_path'), ('sign_contract_signers','link_expires_at'))`);
    expect(cols.rows).toHaveLength(2);
  });

  it('protège la table d\'idempotence (serveur seulement)', async () => {
    const r = await as(db, 'authenticated', owner, (c) => c.query(`select * from sign_api_idempotency`));
    expect(r.rows).toHaveLength(0);
  });

  it('un nouveau lien repart pour 30 jours, un lien sans expiration le reste', async () => {
    const { rows: [c] } = await db.query(`insert into sign_contracts (user_id, title, status) values ($1, 'Devis', 'sent') returning id`, [owner]);
    const { rows: [s1] } = await db.query(`insert into sign_contract_signers (contract_id, signer_index, status, access_token, link_expires_at) values ($1, 1, 'sent', 'tok-1', now() - interval '1 day') returning id`, [c.id]);
    const { rows: [s2] } = await db.query(`insert into sign_contract_signers (contract_id, signer_index, status, access_token) values ($1, 2, 'sent', 'tok-2') returning id`, [c.id]);
    await as(db, 'service_role', null, (cl) => cl.query(`select sign_renew_signer_link_internal($1, $2, 'api')`, [s1.id, owner]), { commit: true });
    await as(db, 'service_role', null, (cl) => cl.query(`select sign_renew_signer_link_internal($1, $2, 'api')`, [s2.id, owner]), { commit: true });
    const { rows } = await db.query(`select signer_index, access_token, link_expires_at > now() + interval '29 days' as renewed, link_expires_at is null as none from sign_contract_signers where contract_id = $1 order by signer_index`, [c.id]);
    expect(rows[0].access_token).not.toBe('tok-1');
    expect(rows[0].renewed).toBe(true);
    expect(rows[1].none).toBe(true);
  });

  it('reste idempotente', async () => {
    await applyFile(db, PLATFORMS);
  });
});
