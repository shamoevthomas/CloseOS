import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { BASELINE, SECURITY, STUBS, applyFile, as, freshDb, pgAvailable, seedOwner, seedTemplate } from './db';

const available = await pgAvailable();

describe.skipIf(!available)('migration 20260927_sign_security', () => {
  let db: pg.Client;
  let owner: string;
  let other: string;
  let template: string;
  let legacyOwner: string;

  beforeAll(async () => {
    db = await freshDb([STUBS, BASELINE]);
    owner = await seedOwner(db, 'owner@test.fr');
    other = await seedOwner(db, 'other@test.fr');
    // Clé MCP en clair, telle qu'en production avant la migration.
    legacyOwner = await seedOwner(db, 'legacy@test.fr', { mcp_key: 'sk_legacykey000000000000000000000000000000000000abcd' });
    template = await seedTemplate(db, owner);
    await applyFile(db, SECURITY);
  });
  afterAll(async () => { await db?.end(); });

  describe('fonctions internes (clonage / réinitialisation)', () => {
    it('refuse sign_clone_template_to_instance à un visiteur anonyme', async () => {
      await expect(
        as(db, 'anon', null, (c) => c.query(`select * from sign_clone_template_to_instance($1, null, 'X', 'x@x.fr', '', 7)`, [template])),
      ).rejects.toThrow(/permission denied/);
    });

    it('refuse sign_clone_template_to_instance à un autre propriétaire connecté', async () => {
      await expect(
        as(db, 'authenticated', other, (c) => c.query(`select * from sign_clone_template_to_instance($1, null, 'X', 'x@x.fr', '', 7)`, [template])),
      ).rejects.toThrow(/permission denied/);
    });

    it('refuse sign_regenerate_instance_internal à anon', async () => {
      await expect(
        as(db, 'anon', null, (c) => c.query(`select sign_regenerate_instance_internal(gen_random_uuid())`)),
      ).rejects.toThrow(/permission denied/);
    });

    it('laisse sign-rep (service_role) cloner un modèle', async () => {
      const { rows } = await as(db, 'service_role', null, (c) =>
        c.query(`select * from sign_clone_template_to_instance($1, null, 'X', 'x@x.fr', '', 7)`, [template]));
      expect(rows[0].signer_token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('laisse le propriétaire générer un lien via sign_owner_generate_link (RPC existante)', async () => {
      const { rows } = await as(db, 'authenticated', owner, (c) =>
        c.query(`select * from sign_owner_generate_link($1, 'Client', 'c@c.fr', '')`, [template]));
      expect(rows[0].instance_id).toBeTruthy();
    });

    it('refuse sign_owner_generate_link sur le modèle d\'un autre', async () => {
      await expect(
        as(db, 'authenticated', other, (c) => c.query(`select * from sign_owner_generate_link($1, 'X', 'x@x.fr', '')`, [template])),
      ).rejects.toThrow(/non_autorise/);
    });
  });

  describe('sign_users : colonnes réservées', () => {
    for (const [col, val] of [
      ['subscription_exempt', 'true'],
      ['subscription_status', `'active'`],
      ['stripe_account_id', `'acct_pirate'`],
      ['mcp_key_hash', `'abc'`],
      ['current_period_end', `now() + interval '10 years'`],
    ] as const) {
      it(`refuse au propriétaire de modifier ${col}`, async () => {
        await expect(
          as(db, 'authenticated', owner, (c) => c.query(`update sign_users set ${col} = ${val} where id = $1`, [owner])),
        ).rejects.toThrow(/réservés au serveur/);
      });
    }

    it('laisse le propriétaire modifier son profil (UI existante)', async () => {
      const { rowCount } = await as(db, 'authenticated', owner, (c) =>
        c.query(`update sign_users set full_name = 'Nouveau', notif_prefs = '{"new_device":false}', has_seen_v5_popup = true, avatar_url = 'https://x/a.png' where id = $1`, [owner]));
      expect(rowCount).toBe(1);
    });

    it('refuse de créer sa ligne sign_users avec un abonnement offert', async () => {
      const { rows } = await db.query(`insert into auth.users (email) values ('pirate@test.fr') returning id`);
      await expect(
        as(db, 'authenticated', rows[0].id, (c) =>
          c.query(`insert into sign_users (id, email, subscription_exempt) values ($1, 'pirate@test.fr', true)`, [rows[0].id])),
      ).rejects.toThrow(/réservés au serveur/);
    });

    it('laisse le serveur (service_role) mettre à jour Stripe et l\'abonnement', async () => {
      const { rowCount } = await as(db, 'service_role', null, (c) =>
        c.query(`update sign_users set stripe_connected = true, subscription_status = 'active' where id = $1`, [owner]));
      expect(rowCount).toBe(1);
    });

    it('laisse une fonction SECURITY DEFINER (provisionnement Business) créer un compte exempté', async () => {
      await db.query(`
        create or replace function public.test_provision(p_id uuid, p_email text) returns void
        language plpgsql security definer set search_path to 'public' as $$
        begin insert into sign_users (id, email, subscription_exempt) values (p_id, p_email, true); end; $$`);
      const { rows } = await db.query(`insert into auth.users (email) values ('biz@test.fr') returning id`);
      await as(db, 'authenticated', rows[0].id, (c) => c.query(`select test_provision($1, 'biz@test.fr')`, [rows[0].id]));
    });
  });

  describe('clé MCP hashée', () => {
    it('efface les clés en clair existantes en gardant leur empreinte', async () => {
      const { rows } = await db.query(`select mcp_key, mcp_key_hash, mcp_key_hint from sign_users where id = $1`, [legacyOwner]);
      const key = 'sk_legacykey000000000000000000000000000000000000abcd';
      expect(rows[0].mcp_key).toBeNull();
      expect(rows[0].mcp_key_hash).toBe(createHash('sha256').update(key).digest('hex'));
      expect(rows[0].mcp_key_hint).toBe('sk_lega…abcd');
    });

    it('génère une clé montrée une seule fois, stockée seulement en empreinte', async () => {
      const key = await as(db, 'authenticated', owner, async (c) => {
        const { rows } = await c.query(`select sign_generate_mcp_key() as k`);
        return rows[0].k as string;
      }, { commit: true });
      expect(key).toMatch(/^sk_[0-9a-f]{48}$/);
      const { rows } = await db.query(`select mcp_key, mcp_key_hash from sign_users where id = $1`, [owner]);
      expect(rows[0].mcp_key).toBeNull();
      expect(rows[0].mcp_key_hash).toBe(createHash('sha256').update(key).digest('hex'));

      const hint = await as(db, 'authenticated', owner, async (c) => (await c.query(`select sign_get_mcp_key() as h`)).rows[0].h);
      expect(hint).toBe(`${key.slice(0, 7)}…${key.slice(-4)}`);
    });

    it('révoque la clé', async () => {
      await as(db, 'authenticated', owner, (c) => c.query(`select sign_revoke_mcp_key()`), { commit: true });
      const hint = await as(db, 'authenticated', owner, async (c) => (await c.query(`select sign_get_mcp_key() as h`)).rows[0].h);
      expect(hint).toBeNull();
    });
  });

  describe('purge_hold', () => {
    it('interdit de supprimer un contrat sous conservation, même en service_role', async () => {
      const { rows } = await db.query(`insert into sign_contracts (user_id, purge_hold) values ($1, true) returning id`, [owner]);
      await expect(
        as(db, 'service_role', null, (c) => c.query(`delete from sign_contracts where id = $1`, [rows[0].id])),
      ).rejects.toThrow(/purge_hold/);
    });

    it('laisse supprimer un contrat ordinaire', async () => {
      const { rows } = await db.query(`insert into sign_contracts (user_id) values ($1) returning id`, [owner]);
      const { rowCount } = await as(db, 'authenticated', owner, (c) => c.query(`delete from sign_contracts where id = $1`, [rows[0].id]));
      expect(rowCount).toBe(1);
    });
  });

  it('reste idempotente (réappliquée sans erreur)', async () => {
    await applyFile(db, SECURITY);
  });
});
