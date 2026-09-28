import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { BASELINE, SECURITY, STUBS, as, applyFile, freshDb, pgAvailable, seedOwner } from './db';

const MIGRATIONS = ['supabase/migrations/20260928_sign_unlock.sql', 'supabase/migrations/20260929_sign_platforms.sql', 'supabase/migrations/20260930_sign_server_seal.sql', 'supabase/migrations/20261001_sign_webhooks.sql'];
const ALL = ['contract.sent', 'signer.opened', 'signer.otp_locked', 'signer.signed', 'signer.declined', 'contract.completed', 'contract.paid', 'contract.certified', 'contract.expired'];
const available = await pgAvailable();

describe.skipIf(!available)('migration 20261001_sign_webhooks', () => {
  let db: pg.Client;
  let platform: string;
  let artisan: string;
  let owner: string;
  let endpoint: string;
  let contract: string;

  const ev = (type: string, metadata: Record<string, unknown> = {}, c = contract) =>
    db.query(`insert into sign_signature_events (contract_id, event_type, metadata) values ($1, $2, $3)`, [c, type, metadata]);
  const deliveries = async () => (await db.query(`select event, payload from sign_webhook_deliveries where contract_id = $1 order by created_at, event`, [contract])).rows;

  beforeAll(async () => {
    db = await freshDb([STUBS, BASELINE, SECURITY]);
    for (const m of MIGRATIONS) await applyFile(db, m);
    platform = (await db.query(`insert into sign_platforms (name, api_key_hash, api_key_hint, webhook_secret) values ('SaaS BTP', 'h', 'x', 'whsec_x') returning id`)).rows[0].id;
    artisan = await seedOwner(db, 'acct-1@platform.sign.closeos.fr', { platform_id: platform, external_ref: 'a1' });
    owner = await seedOwner(db, 'owner@test.fr');
    endpoint = (await db.query(`insert into sign_webhook_endpoints (platform_id, url, events) values ($1, 'https://saas.test/hook', $2) returning id`, [platform, ALL])).rows[0].id;
  });
  beforeEach(async () => {
    contract = (await db.query(`insert into sign_contracts (user_id, title, status) values ($1, 'Devis', 'sent') returning id`, [artisan])).rows[0].id;
    await db.query(`insert into sign_contract_signers (contract_id, signer_index, name, email, status, link_expires_at) values ($1, 1, 'Marie', 'm@x.fr', 'sent', now() - interval '1 minute'), ($1, 2, 'Paul', 'p@x.fr', 'sent', null)`, [contract]);
  });
  afterAll(async () => { await db?.end(); });

  it('ajoute le scope webhooks aux plateformes existantes', async () => {
    const { rows } = await db.query(`select scopes from sign_platforms where id = $1`, [platform]);
    expect(rows[0].scopes).toContain('webhooks:write');
  });

  it("n'émet rien pour un contrat hors plateforme", async () => {
    const c = (await db.query(`insert into sign_contracts (user_id, title, status) values ($1, 'X', 'sent') returning id`, [owner])).rows[0].id;
    await ev('sent', { signer_index: 1 }, c);
    expect((await db.query(`select count(*)::int n from sign_webhook_deliveries where contract_id = $1`, [c])).rows[0].n).toBe(0);
  });

  it('contract.sent une seule fois, signer.opened à la première ouverture de chaque signataire', async () => {
    await ev('sent', { signer_index: 1 });
    await ev('sent', { signer_index: 2 });
    await ev('opened', { signer_index: 1 });
    await ev('opened', { signer_index: 1 });
    await ev('opened', { signer_index: 2 });
    const d = await deliveries();
    expect(d.map((x) => x.event).sort()).toEqual(['contract.sent', 'signer.opened', 'signer.opened']);
    const opened = d.filter((x) => x.event === 'signer.opened').map((x) => x.payload.data.signer.email).sort();
    expect(opened).toEqual(['m@x.fr', 'p@x.fr']);
  });

  it('payload : event, product, account_id, contract_id, timestamp, data', async () => {
    await ev('signed', { signer_index: 1 });
    const [d] = await deliveries();
    expect(d.event).toBe('signer.signed');
    expect(d.payload).toMatchObject({ event: 'signer.signed', product: 'sign', account_id: artisan, contract_id: contract, data: { signer: { index: 1, name: 'Marie', email: 'm@x.fr' }, contract: { title: 'Devis' } } });
    expect(d.payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('signer.otp_locked (blocage seulement), signer.declined, contract.completed, contract.certified', async () => {
    await ev('security', { kind: 'verification_failed', signer_index: 1 });
    await ev('security', { kind: 'verification_locked', reason: 'code', signer_index: 1 });
    await ev('declined', { signer_index: 2 });
    await db.query(`update sign_contracts set status = 'signed', signed_at = now(), certificate_id = gen_random_uuid(), certified_at = now() where id = $1`, [contract]);
    await ev('completed');
    await ev('certified');
    const d = await deliveries();
    expect(d.map((x) => x.event)).toEqual(['signer.otp_locked', 'signer.declined', 'contract.completed', 'contract.certified']);
    expect(d[0].payload.data.reason).toBe('code');
    expect(d[3].payload.data.certificate_id).toBeTruthy();
    // Événements sans équivalent public : rien
    await ev('otp_sent', { signer_index: 1 });
    await ev('reminder');
    expect(await deliveries()).toHaveLength(4);
  });

  it('contract.paid quand le paiement du contrat passe à payé', async () => {
    await db.query(`update sign_contracts set payment_status = 'paid', paid_at = now() where id = $1`, [contract]);
    await db.query(`update sign_contracts set title = 'Devis modifié' where id = $1`, [contract]);
    expect((await deliveries()).map((x) => x.event)).toEqual(['contract.paid']);
  });

  it('contract.expired une fois par lien échu non signé ; un nouveau lien peut expirer à nouveau', async () => {
    await as(db, 'service_role', null, (c) => c.query(`select sign_log_expired_links()`), { commit: true });
    await as(db, 'service_role', null, (c) => c.query(`select sign_log_expired_links()`), { commit: true });
    let d = (await deliveries()).filter((x) => x.event === 'contract.expired');
    expect(d).toHaveLength(1);
    expect(d[0].payload.data).toMatchObject({ signer: { index: 1 } });
    expect(d[0].payload.data.link_expires_at).toBeTruthy();
    const sid = (await db.query(`select id from sign_contract_signers where contract_id = $1 and signer_index = 1`, [contract])).rows[0].id;
    await as(db, 'service_role', null, (c) => c.query(`select sign_renew_signer_link_internal($1, $2, 'api')`, [sid, artisan]), { commit: true });
    await db.query(`update sign_contract_signers set link_expires_at = now() - interval '1 second' where id = $1`, [sid]);
    await as(db, 'service_role', null, (c) => c.query(`select sign_log_expired_links()`), { commit: true });
    d = (await deliveries()).filter((x) => x.event === 'contract.expired');
    expect(d).toHaveLength(2);
  });

  it("n'envoie qu'aux adresses actives abonnées à l'événement", async () => {
    await db.query(`insert into sign_webhook_endpoints (platform_id, url, events) values ($1, 'https://saas.test/signed-only', '{signer.signed}'), ($1, 'https://saas.test/off', $2)`, [platform, ALL]);
    await db.query(`update sign_webhook_endpoints set active = false where url = 'https://saas.test/off'`);
    await ev('sent', { signer_index: 1 });
    await ev('signed', { signer_index: 1 });
    const { rows } = await db.query(`select e.url, d.event from sign_webhook_deliveries d join sign_webhook_endpoints e on e.id = d.endpoint_id where d.contract_id = $1 order by d.event, e.url`, [contract]);
    expect(rows).toEqual([
      { url: 'https://saas.test/hook', event: 'contract.sent' },
      { url: 'https://saas.test/hook', event: 'signer.signed' },
      { url: 'https://saas.test/signed-only', event: 'signer.signed' },
    ]);
    await db.query(`delete from sign_webhook_endpoints where url <> 'https://saas.test/hook'`);
  });

  it('ne bloque jamais la signature si les webhooks échouent', async () => {
    await db.query('begin');
    try {
      await db.query(`alter table sign_webhook_deliveries rename to sign_webhook_deliveries_x`);
      await ev('signed', { signer_index: 1 });
      const { rows } = await db.query(`select count(*)::int n from sign_signature_events where contract_id = $1 and event_type = 'signed'`, [contract]);
      expect(rows[0].n).toBe(1);
    } finally {
      await db.query('rollback');
    }
  });

  it('prise en charge : les livraisons dues une seule fois (bail), réservée au serveur', async () => {
    await ev('signed', { signer_index: 1 });
    const first = await as(db, 'service_role', null, (c) => c.query(`select id from sign_webhook_claim(100)`), { commit: true });
    const again = await as(db, 'service_role', null, (c) => c.query(`select id from sign_webhook_claim(100)`), { commit: true });
    expect(first.rows.length).toBeGreaterThan(0);
    expect(again.rows).toHaveLength(0);
    await expect(as(db, 'authenticated', owner, (c) => c.query(`select * from sign_webhook_claim(1)`))).rejects.toThrow(/permission denied/);
    const r = await as(db, 'authenticated', owner, (c) => c.query(`select * from sign_webhook_endpoints`));
    expect(r.rows).toHaveLength(0);
  });

  it('refuse une adresse non https', async () => {
    await expect(db.query(`insert into sign_webhook_endpoints (platform_id, url, events) values ($1, 'http://saas.test', '{}')`, [platform])).rejects.toThrow(/https/);
  });

  it('reste idempotente', async () => {
    await applyFile(db, MIGRATIONS[3]);
  });
});
