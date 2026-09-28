import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { BASELINE, SECURITY, STUBS, as, freshDb, pgAvailable, seedOwner, seedTemplate } from './db';

const UNLOCK = 'supabase/migrations/20260928_sign_unlock.sql';
const available = await pgAvailable();

describe.skipIf(!available)('migration 20260928_sign_unlock', () => {
  let db: pg.Client;
  let owner: string;
  let other: string;
  let contract: string;
  let signer: string;

  beforeAll(async () => {
    db = await freshDb([STUBS, BASELINE, SECURITY, UNLOCK]);
    owner = await seedOwner(db, 'owner@test.fr');
    other = await seedOwner(db, 'other@test.fr');
  });
  afterAll(async () => { await db?.end(); });

  // Contrat envoyé avec un signataire bloqué après 3 échecs, et 4 codes déjà envoyés.
  beforeEach(async () => {
    const c = await db.query(`insert into sign_contracts (user_id, status, verification_method) values ($1, 'sent', 'email') returning id`, [owner]);
    contract = c.rows[0].id;
    const s = await db.query(
      `insert into sign_contract_signers (contract_id, signer_index, email, access_token, status, verification_locked,
         verification_lock_reason, verification_lock_step, verification_code_attempts)
       values ($1, 1, 'client@test.fr', $2, 'opened', true, 'code', 2, 3) returning id`,
      [contract, `tok-${contract}`],
    );
    signer = s.rows[0].id;
    for (let i = 0; i < 4; i++) {
      await db.query(`insert into sign_verification_codes (contract_id, signer_index, email, code_hash, expires_at) values ($1, 1, 'client@test.fr', 'h', now())`, [contract]);
    }
  });

  const signerRow = async () => (await db.query(`select * from sign_contract_signers where id = $1`, [signer])).rows[0];
  const events = async () => (await db.query(`select event_type, metadata from sign_signature_events where contract_id = $1 order by created_at`, [contract])).rows;

  describe('Débloquer', () => {
    it('lève le verrou, remet les essais à zéro, efface les codes, garde le lien, journalise', async () => {
      await as(db, 'authenticated', owner, (c) => c.query(`select sign_owner_unlock_signer($1)`, [signer]), { commit: true });
      const s = await signerRow();
      expect(s).toMatchObject({ verification_locked: false, verification_lock_reason: null, verification_lock_step: null, verification_code_attempts: 0, access_token: `tok-${contract}` });
      const codes = await db.query(`select count(*)::int as n from sign_verification_codes where contract_id = $1`, [contract]);
      expect(codes.rows[0].n).toBe(0);
      const ev = await events();
      expect(ev.at(-1)).toMatchObject({ event_type: 'unlocked', metadata: { signer_index: 1, via: 'owner_app', actor: owner, was_locked: true } });
    });

    it("refuse le propriétaire d'un autre compte", async () => {
      await expect(as(db, 'authenticated', other, (c) => c.query(`select sign_owner_unlock_signer($1)`, [signer])))
        .rejects.toThrow(/non_autorise/);
      expect((await signerRow()).verification_locked).toBe(true);
    });

    it('refuse un visiteur anonyme', async () => {
      await expect(as(db, 'anon', null, (c) => c.query(`select sign_owner_unlock_signer($1)`, [signer])))
        .rejects.toThrow(/permission denied/);
      await expect(as(db, 'anon', null, (c) => c.query(`select sign_unlock_signer_internal($1, null, 'x')`, [signer])))
        .rejects.toThrow(/permission denied/);
    });

    it("n'est pas appelable directement par un propriétaire connecté (réservé au serveur)", async () => {
      await expect(as(db, 'authenticated', owner, (c) => c.query(`select sign_unlock_signer_internal($1, $2, 'x')`, [signer, owner])))
        .rejects.toThrow(/permission denied/);
    });

    it('est disponible pour le serveur (MCP, API REST) via service_role', async () => {
      await as(db, 'service_role', null, (c) => c.query(`select sign_unlock_signer_internal($1, $2, 'mcp')`, [signer, owner]), { commit: true });
      expect((await signerRow()).verification_locked).toBe(false);
      expect((await events()).at(-1).metadata.via).toBe('mcp');
    });
  });

  describe('Nouveau lien', () => {
    it("invalide l'ancien lien, en crée un nouveau non verrouillé, journalise", async () => {
      const { rows } = await as(db, 'authenticated', owner, (c) => c.query(`select sign_owner_renew_signer_link($1) as r`, [signer]), { commit: true });
      const token = rows[0].r.token as string;
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      const s = await signerRow();
      expect(s.access_token).toBe(token);
      expect(s.verification_locked).toBe(false);
      const old = await db.query(`select count(*)::int as n from sign_contract_signers where access_token = $1`, [`tok-${contract}`]);
      expect(old.rows[0].n).toBe(0);
      expect((await events()).at(-1)).toMatchObject({ event_type: 'link_renewed', metadata: { signer_index: 1, via: 'owner_app' } });
    });

    it("refuse le propriétaire d'un autre compte", async () => {
      await expect(as(db, 'authenticated', other, (c) => c.query(`select sign_owner_renew_signer_link($1)`, [signer])))
        .rejects.toThrow(/non_autorise/);
    });
  });

  describe('garde-fous communs', () => {
    it('refuse un signataire déjà signé, pour les deux actions', async () => {
      await db.query(`update sign_contract_signers set status = 'signed', signed_at = now() where id = $1`, [signer]);
      await expect(as(db, 'authenticated', owner, (c) => c.query(`select sign_owner_unlock_signer($1)`, [signer])))
        .rejects.toThrow(/signataire_deja_signe/);
      await expect(as(db, 'authenticated', owner, (c) => c.query(`select sign_owner_renew_signer_link($1)`, [signer])))
        .rejects.toThrow(/signataire_deja_signe/);
    });

    it("refuse un contrat encore en brouillon", async () => {
      await db.query(`update sign_contracts set status = 'draft' where id = $1`, [contract]);
      await expect(as(db, 'authenticated', owner, (c) => c.query(`select sign_owner_renew_signer_link($1)`, [signer])))
        .rejects.toThrow(/contrat_non_en_cours/);
    });

    it("interdit de lever le verrou par une écriture directe depuis le navigateur", async () => {
      await expect(as(db, 'authenticated', owner, (c) =>
        c.query(`update sign_contract_signers set verification_locked = false, verification_code_attempts = 0 where id = $1`, [signer])))
        .rejects.toThrow(/réservée au serveur/);
    });

    it("laisse le propriétaire modifier le reste du signataire (éditeur existant)", async () => {
      const { rowCount } = await as(db, 'authenticated', owner, (c) =>
        c.query(`update sign_contract_signers set name = 'Nouveau nom', verification_emails = '["a@b.fr"]' where id = $1`, [signer]));
      expect(rowCount).toBe(1);
    });

    it('laisse le serveur incrémenter les essais (sign-verify)', async () => {
      const { rowCount } = await as(db, 'service_role', null, (c) =>
        c.query(`update sign_contract_signers set verification_code_attempts = 4 where id = $1`, [signer]));
      expect(rowCount).toBe(1);
    });

    it('ne casse pas la régénération d\'instance existante (RPC propriétaire)', async () => {
      const tpl = await seedTemplate(db, owner);
      const { rows } = await as(db, 'service_role', null, (c) =>
        c.query(`select * from sign_clone_template_to_instance($1, null, 'X', 'x@x.fr', '', 7)`, [tpl]), { commit: true });
      const tok = await as(db, 'authenticated', owner, (c) => c.query(`select sign_owner_regenerate_instance($1) as t`, [rows[0].instance_id]));
      expect(tok.rows[0].t).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
