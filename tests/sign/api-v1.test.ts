import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabase } from './fake-supabase';
import { fakeReq, fakeRes } from './helpers';

const KEY = 'sk_sign_' + 'a'.repeat(64);
const OTHER_KEY = 'sk_sign_' + 'b'.repeat(64);
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

let handler: (req: any, res: any) => Promise<unknown>;
let PDF: Buffer; // page 1 A4 portrait, page 2 A4 paysage
let fake: FakeSupabase;
let platform: any;

beforeAll(async () => {
  vi.stubEnv('SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
  vi.stubEnv('BREVO_API_KEY', 'brevo');
  vi.stubEnv('SIGN_APP_URL', 'https://sign.closeos.fr');
  handler = (await import('../../api/sign-v1.js')).default;
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  doc.addPage([841.89, 595.28]);
  PDF = Buffer.from(await doc.save());
});
beforeEach(() => {
  fake = new FakeSupabase().install();
  platform = fake.seed('sign_platforms', { name: 'SaaS BTP', api_key_hash: sha(KEY), api_key_hint: 'sk_sign_aaa…aaaa' });
  fake.rpcs.sign_unlock_signer_internal = (a) => ({ signer_index: 1, ...a });
  fake.rpcs.sign_renew_signer_link_internal = (a, f) => {
    const s = f.table('sign_contract_signers').find((x) => x.id === a.p_signer_id)!;
    if (s.status === 'signed') throw new Error('signataire_deja_signe');
    s.access_token = 'n'.repeat(64);
    return { token: s.access_token, signer_index: s.signer_index };
  };
});
afterEach(() => { vi.unstubAllGlobals(); });

type Call = { method?: string; path: string; body?: any; key?: string | null; account?: string | null; headers?: Record<string, string>; query?: Record<string, string> };
async function api({ method = 'GET', path, body, key = KEY, account, headers = {}, query = {} }: Call) {
  const h: Record<string, string> = { ...headers };
  if (key) h.authorization = `Bearer ${key}`;
  if (account) h['x-sign-account'] = account;
  const res = fakeRes();
  await handler(fakeReq({ method, headers: h, query: { path, ...query }, body }), res);
  return res;
}

async function newAccount(ref = 'artisan-42', over: Record<string, unknown> = {}) {
  const res = await api({ method: 'POST', path: 'accounts', body: { external_ref: ref, name: 'Jean Dupont', company: 'Plomberie Dupont', email: 'jean@plomberie.fr', ...over } });
  return res.body.id as string;
}
async function newContract(account: string, over: Record<string, unknown> = {}) {
  const res = await api({ method: 'POST', path: 'contracts', account, body: { title: 'Devis salle de bain', pdf_base64: PDF.toString('base64'), ...over } });
  expect(res.statusCode).toBe(201);
  return res.body;
}
const SIG = { type: 'signature', page: 1, x_pct: 0.6, y_pct: 0.85 };

describe('sign-v1 — contrat OpenAPI et routage', () => {
  it("sert openapi.json sans clé, avec toutes les routes", async () => {
    const res = await api({ path: 'openapi.json', key: null });
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining([
      '/accounts', '/accounts/{id}', '/contracts', '/contracts/{id}', '/contracts/{id}/fields', '/contracts/{id}/signers',
      '/contracts/{id}/send', '/contracts/{id}/signers/{sid}/unlock', '/contracts/{id}/signers/{sid}/renew-link',
      '/contracts/{id}/document', '/contracts/{id}/certificate', '/contracts/{id}/events',
    ]));
    expect(res.body.servers[0].url).toBe('https://sign.closeos.fr/api/sign/v1');
  });

  it('404 sur une route inconnue, 405 sur une mauvaise méthode', async () => {
    expect((await api({ path: 'nope' })).body.error.code).toBe('route_not_found');
    const r = await api({ method: 'DELETE', path: 'accounts' });
    expect(r.statusCode).toBe(405);
  });

  it('refuse un identifiant qui n\'est pas un UUID sans interroger la base', async () => {
    const r = await api({ path: 'contracts/1;drop', account: '00000000-0000-0000-0000-000000000000' });
    expect(r.statusCode).toBe(404);
    expect(fake.calls.some((c) => c.url.pathname.endsWith('/sign_contracts'))).toBe(false);
  });
});

describe('sign-v1 — authentification et droits', () => {
  it('401 sans clé, avec une clé inconnue ou une plateforme désactivée', async () => {
    expect((await api({ method: 'POST', path: 'accounts', key: null, body: {} })).statusCode).toBe(401);
    expect((await api({ method: 'POST', path: 'accounts', key: OTHER_KEY, body: {} })).statusCode).toBe(401);
    platform.active = false;
    expect((await api({ method: 'POST', path: 'accounts', body: { external_ref: 'x' } })).statusCode).toBe(401);
  });

  it('cherche la clé par empreinte, jamais en clair', async () => {
    await api({ method: 'POST', path: 'accounts', body: { external_ref: 'x' } });
    const q = fake.calls.find((c) => c.url.pathname.endsWith('/sign_platforms'))!;
    expect(q.url.search).toContain(sha(KEY));
    expect(q.url.search).not.toContain(KEY);
  });

  it('403 si la clé n\'a pas le scope requis', async () => {
    platform.scopes = ['contracts:read'];
    const r = await api({ method: 'POST', path: 'accounts', body: { external_ref: 'x' } });
    expect(r.statusCode).toBe(403);
    expect(r.body.error.code).toBe('insufficient_scope');
  });

  it('exige X-Sign-Account et refuse un compte d\'une autre plateforme', async () => {
    const other = fake.seed('sign_platforms', { name: 'Autre', api_key_hash: sha(OTHER_KEY), api_key_hint: '…' });
    const foreign = fake.seed('sign_users', { email: 'x@y.fr', platform_id: other.id, external_ref: 'z' });
    expect((await api({ path: `contracts/${foreign.id}` })).body.error.code).toBe('account_required');
    const r = await api({ method: 'POST', path: 'contracts', account: foreign.id, body: { title: 'T', pdf_base64: PDF.toString('base64') } });
    expect(r.statusCode).toBe(404);
    expect(fake.table('sign_contracts')).toHaveLength(0);
  });

  it("refuse le contrat d'un autre artisan de la même plateforme", async () => {
    const a = await newAccount('a1');
    const b = await newAccount('b1');
    const c = await newContract(a);
    const r = await api({ path: `contracts/${c.id}`, account: b });
    expect(r.statusCode).toBe(404);
    expect(r.body.error.code).toBe('not_found');
  });
});

describe('sign-v1 — comptes artisans', () => {
  it('crée un compte technique rattaché, sans abonnement, email réel en contact', async () => {
    const r = await api({ method: 'POST', path: 'accounts', body: { external_ref: 'artisan-42', name: 'Jean Dupont', company: 'Plomberie Dupont', email: 'jean@plomberie.fr' } });
    expect(r.statusCode).toBe(201);
    expect(r.body).toMatchObject({ external_ref: 'artisan-42', email: 'jean@plomberie.fr', company: 'Plomberie Dupont' });
    const [u] = fake.users;
    expect(u.email).toMatch(/^acct-[0-9a-f-]+@platform\.sign\.closeos\.fr$/);
    expect(u.password).toBeUndefined();
    expect(u.user_metadata.module).toBe('sign');
    const row = fake.table('sign_users')[0];
    expect(row).toMatchObject({ id: u.id, platform_id: platform.id, contact_email: 'jean@plomberie.fr', subscription_exempt: true });
  });

  it('est idempotent sur external_ref', async () => {
    const first = await newAccount('artisan-42');
    const r = await api({ method: 'POST', path: 'accounts', body: { external_ref: 'artisan-42' } });
    expect(r.statusCode).toBe(200);
    expect(r.body.id).toBe(first);
    expect(fake.users).toHaveLength(1);
  });

  it("en cas de création concurrente, renvoie le compte gagnant et supprime l'utilisateur auth en trop", async () => {
    let winner: any;
    fake.onRequest = (method, url) => {
      if (method === 'POST' && url.pathname.endsWith('/sign_users') && !winner) {
        winner = fake.seed('sign_users', { email: 'w@x.fr', platform_id: platform.id, external_ref: 'race' });
      }
    };
    const r = await api({ method: 'POST', path: 'accounts', body: { external_ref: 'race' } });
    expect(r.statusCode).toBe(200);
    expect(r.body.id).toBe(winner.id);
    expect(fake.users).toHaveLength(0);
  });

  it('valide les entrées et lit un compte', async () => {
    expect((await api({ method: 'POST', path: 'accounts', body: {} })).statusCode).toBe(400);
    expect((await api({ method: 'POST', path: 'accounts', body: { external_ref: 'x', email: 'pas-un-email' } })).statusCode).toBe(400);
    const id = await newAccount();
    const r = await api({ path: `accounts/${id}` });
    expect(r.statusCode).toBe(200);
    expect(r.body.name).toBe('Jean Dupont');
  });
});

describe('sign-v1 — création de contrat', () => {
  it('range le PDF dans Storage avec ses tailles réelles et son empreinte', async () => {
    const acc = await newAccount();
    const c = await newContract(acc);
    expect(c.status).toBe('draft');
    expect(c.page_count).toBe(2);
    expect(c.pages[0]).toMatchObject({ width_px: 794, height_px: 1123 });
    expect(c.pages[1]).toMatchObject({ width_px: 794, height_px: 561 });
    const row = fake.table('sign_contracts')[0];
    expect(row.pdf_data).toBeNull();
    expect(row.pdf_path).toBe(`${c.id}/original.pdf`);
    expect(row.owner_email).toBe('jean@plomberie.fr'); // jamais l'adresse technique
    expect(row.document_hash).toBe(sha(PDF));
    expect(fake.storage.get(`sign-documents/${c.id}/original.pdf`)!.equals(PDF)).toBe(true);
    expect(c.documents).toEqual({ original: true, signed: false, certificate: false });
  });

  it('prépare tout en un appel (signataires, vérification email, champs)', async () => {
    const acc = await newAccount();
    const c = await newContract(acc, {
      signers: [{ name: 'Marie Martin', email: 'marie@exemple.fr' }],
      verification_method: 'email',
      fields: [SIG, { type: 'date', page: 2, x_pct: 0.5, y_pct: 0.5 }],
    });
    expect(c.signers).toHaveLength(1);
    expect(c.verification_method).toBe('email');
    expect(fake.table('sign_contract_signers')[0].verification_emails).toEqual(['marie@exemple.fr']);
    const date = c.fields.find((f: any) => f.type === 'date');
    expect(date).toMatchObject({ page: 2, x: 397, y: 281 }); // hauteur réelle de la page paysage (561)
  });

  it('refuse le HTML, un faux PDF, un titre manquant', async () => {
    const acc = await newAccount();
    expect((await api({ method: 'POST', path: 'contracts', account: acc, body: { title: 'T', html: '<p>x</p>' } })).statusCode).toBe(400);
    expect((await api({ method: 'POST', path: 'contracts', account: acc, body: { title: 'T', pdf_base64: Buffer.from('<html>').toString('base64') } })).body.error.code).toBe('invalid_pdf');
    expect((await api({ method: 'POST', path: 'contracts', account: acc, body: { pdf_base64: PDF.toString('base64') } })).statusCode).toBe(400);
    expect((await api({ method: 'POST', path: 'contracts', account: acc, body: { title: 'T', pdf_url: 'http://10.0.0.1/x.pdf' } })).body.error.code).toBe('invalid_pdf_url');
    expect(fake.table('sign_contracts')).toHaveLength(0);
  });

  it('rejoue une requête avec la même Idempotency-Key', async () => {
    const acc = await newAccount();
    const body = { title: 'Devis', pdf_base64: PDF.toString('base64') };
    const h = { 'idempotency-key': 'devis-981' };
    const r1 = await api({ method: 'POST', path: 'contracts', account: acc, body, headers: h });
    const r2 = await api({ method: 'POST', path: 'contracts', account: acc, body, headers: h });
    expect(r2.statusCode).toBe(201);
    expect(r2.headers['idempotent-replayed']).toBe('true');
    expect(r2.body.id).toBe(r1.body.id);
    expect(fake.table('sign_contracts')).toHaveLength(1);
    const r3 = await api({ method: 'POST', path: `contracts/${r1.body.id}/send`, account: acc, body: {}, headers: h });
    expect(r3.statusCode).toBe(422);
    expect(r3.body.error.code).toBe('idempotency_key_reused');
  });
});

describe('sign-v1 — champs et signataires', () => {
  it('pose des champs en fraction de page et refuse les valeurs hors bornes', async () => {
    const acc = await newAccount();
    const c = await newContract(acc);
    const r = await api({ method: 'POST', path: `contracts/${c.id}/fields`, account: acc, body: { fields: [SIG] } });
    expect(r.statusCode).toBe(200);
    expect(r.body.fields[0]).toMatchObject({ type: 'signature', page: 1, x: 476, y: 955, w: 200, h: 64 });
    expect((await api({ method: 'POST', path: `contracts/${c.id}/fields`, account: acc, body: { fields: [{ ...SIG, x_pct: 1.4 }] } })).statusCode).toBe(400);
    expect((await api({ method: 'POST', path: `contracts/${c.id}/fields`, account: acc, body: { fields: [{ ...SIG, page: 3 }] } })).statusCode).toBe(400);
    expect((await api({ method: 'POST', path: `contracts/${c.id}/fields`, account: acc, body: { fields: [{ ...SIG, type: 'iban' }] } })).statusCode).toBe(400);
  });

  it('mode replace remplace les champs existants', async () => {
    const acc = await newAccount();
    const c = await newContract(acc, { fields: [SIG, SIG] });
    const r = await api({ method: 'POST', path: `contracts/${c.id}/fields`, account: acc, body: { mode: 'replace', fields: [SIG] } });
    expect(r.body.fields).toHaveLength(1);
  });

  it('définit les signataires et exige leur email pour la vérification email', async () => {
    const acc = await newAccount();
    const c = await newContract(acc);
    const bad = await api({ method: 'POST', path: `contracts/${c.id}/signers`, account: acc, body: { verification_method: 'email', signers: [{ name: 'Sans email' }] } });
    expect(bad.statusCode).toBe(400);
    const r = await api({ method: 'POST', path: `contracts/${c.id}/signers`, account: acc, body: { verification_method: 'email', signing_order: 'sequential', signers: [{ name: 'A', email: 'a@x.fr' }, { name: 'B', email: 'b@x.fr' }] } });
    expect(r.statusCode).toBe(200);
    expect(r.body.signers.map((s: any) => s.email)).toEqual(['a@x.fr', 'b@x.fr']);
    expect(r.body.signing_order).toBe('sequential');
    // Réduire à un signataire supprime le second
    const r2 = await api({ method: 'POST', path: `contracts/${c.id}/signers`, account: acc, body: { signers: [{ name: 'A', email: 'a@x.fr' }] } });
    expect(r2.body.signers).toHaveLength(1);
  });
});

async function readyContract(acc: string, over: Record<string, unknown> = {}) {
  return newContract(acc, { signers: [{ name: 'Marie Martin', email: 'marie@exemple.fr' }], verification_method: 'email', fields: [SIG], ...over });
}

describe('sign-v1 — envoi', () => {
  it("s'aligne sur l'envoi de l'app : statuts, jetons, journal, empreinte, expiration à 30 jours, email", async () => {
    const acc = await newAccount();
    const c = await readyContract(acc);
    const before = Date.now();
    const r = await api({ method: 'POST', path: `contracts/${c.id}/send`, account: acc, body: {} });
    expect(r.statusCode).toBe(200);
    expect(r.body.status).toBe('sent');
    const [s] = r.body.signers;
    expect(s.status).toBe('sent');
    expect(s.sign_url).toMatch(/^https:\/\/sign\.closeos\.fr\/sign\/s\/[0-9a-f]{32}$/);
    const exp = Date.parse(s.link_expires_at) - before;
    expect(exp).toBeGreaterThan(29.9 * 86400000);
    expect(exp).toBeLessThan(30.1 * 86400000);
    expect(r.body.notifications).toEqual([{ signer_id: s.id, notified: true }]);
    const ev = fake.table('sign_signature_events');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ event_type: 'sent', email: 'marie@exemple.fr', metadata: { signer_index: 1, via: 'api' } });
    expect(ev[0].contact_id).toBe(fake.table('sign_contacts')[0].id);
    expect(fake.table('sign_contracts')[0].document_hash).toBe(sha(PDF)); // inchangée
    expect(fake.emails).toHaveLength(1);
    expect(fake.emails[0].to[0].email).toBe('marie@exemple.fr');
    expect(fake.emails[0].sender.name).toBe('Plomberie Dupont via CloseOS Sign');
    expect(fake.emails[0].htmlContent).toContain(s.sign_url);
  });

  it('en séquentiel, invite seulement le premier signataire', async () => {
    const acc = await newAccount();
    const c = await readyContract(acc, {
      signing_order: 'sequential',
      signers: [{ name: 'A', email: 'a@x.fr' }, { name: 'B', email: 'b@x.fr' }],
      fields: [SIG, { ...SIG, signer_index: 2, y_pct: 0.7 }],
    });
    const r = await api({ method: 'POST', path: `contracts/${c.id}/send`, account: acc, body: { expires_in_days: 7 } });
    expect(r.body.signers.map((s: any) => s.status)).toEqual(['sent', 'pending']);
    expect(r.body.signers[1].sign_url).toBeNull();
    expect(fake.emails.map((e) => e.to[0].email)).toEqual(['a@x.fr']);
    expect(fake.table('sign_signature_events')).toHaveLength(1);
  });

  it('refuse un signataire sans champ signature, puis un second envoi', async () => {
    const acc = await newAccount();
    const c = await readyContract(acc, { fields: [{ type: 'date', x_pct: 0.1, y_pct: 0.1 }] });
    const r = await api({ method: 'POST', path: `contracts/${c.id}/send`, account: acc, body: {} });
    expect(r.statusCode).toBe(422);
    expect(r.body.error.code).toBe('signature_field_missing');
    await api({ method: 'POST', path: `contracts/${c.id}/fields`, account: acc, body: { fields: [SIG] } });
    expect((await api({ method: 'POST', path: `contracts/${c.id}/send`, account: acc, body: {} })).statusCode).toBe(200);
    const again = await api({ method: 'POST', path: `contracts/${c.id}/send`, account: acc, body: {} });
    expect(again.statusCode).toBe(409);
    expect(again.body.error.code).toBe('contract_not_draft');
    // Plus modifiable une fois envoyé
    expect((await api({ method: 'POST', path: `contracts/${c.id}/fields`, account: acc, body: { fields: [SIG] } })).statusCode).toBe(409);
  });

  it("signale un email en échec sans bloquer l'envoi ; notify=false n'envoie rien ; sans expiration si null", async () => {
    const acc = await newAccount();
    const c1 = await readyContract(acc);
    fake.failEmail = true;
    const r = await api({ method: 'POST', path: `contracts/${c1.id}/send`, account: acc, body: {} });
    expect(r.statusCode).toBe(200);
    expect(r.body.status).toBe('sent');
    expect(r.body.notifications[0].notified).toBe(false);
    expect(r.body.notifications[0].error).toMatch(/Email non envoyé/);
    fake.failEmail = false;
    const c2 = await readyContract(acc);
    const r2 = await api({ method: 'POST', path: `contracts/${c2.id}/send`, account: acc, body: { notify: false, expires_in_days: null } });
    expect(r2.body.notifications[0].notified).toBe(false);
    expect(r2.body.signers[0].link_expires_at).toBeNull();
    expect(fake.emails).toHaveLength(0);
    expect((await api({ method: 'POST', path: `contracts/${c2.id}/send`, account: acc, body: { expires_in_days: 0 } })).statusCode).toBe(400);
  });
});

describe('sign-v1 — suivi, déblocage, nouveau lien', () => {
  async function sent(acc: string) {
    const c = await readyContract(acc);
    await api({ method: 'POST', path: `contracts/${c.id}/send`, account: acc, body: {} });
    return (await api({ path: `contracts/${c.id}`, account: acc })).body;
  }

  it("expose l'ouverture, le blocage et l'expiration par signataire", async () => {
    const acc = await newAccount();
    const c = await sent(acc);
    const s = fake.table('sign_contract_signers')[0];
    Object.assign(s, { status: 'opened', opened_at: '2026-09-28T10:00:00Z', verification_locked: true, verification_lock_reason: 'code', link_expires_at: '2020-01-01T00:00:00Z' });
    const r = await api({ path: `contracts/${c.id}`, account: acc });
    expect(r.body.viewed_at).toBe('2026-09-28T10:00:00Z');
    expect(r.body.signers[0]).toMatchObject({ status: 'opened', viewed_at: '2026-09-28T10:00:00Z', verification_locked: true, verification_lock_reason: 'code', link_expired: true });
  });

  it('débloque un signataire via la fonction serveur, au nom de l\'artisan', async () => {
    const acc = await newAccount();
    const c = await sent(acc);
    const sid = c.signers[0].id;
    let got: any;
    fake.rpcs.sign_unlock_signer_internal = (a) => { got = a; return {}; };
    const r = await api({ method: 'POST', path: `contracts/${c.id}/signers/${sid}/unlock`, account: acc });
    expect(r.statusCode).toBe(200);
    expect(got).toEqual({ p_signer_id: sid, p_actor: acc, p_via: 'api' });
  });

  it('renouvelle le lien, renvoie l\'email et fixe la durée demandée', async () => {
    const acc = await newAccount();
    const c = await sent(acc);
    const sid = c.signers[0].id;
    fake.emails = [];
    const r = await api({ method: 'POST', path: `contracts/${c.id}/signers/${sid}/renew-link`, account: acc, body: { expires_in_days: 10 } });
    expect(r.statusCode).toBe(200);
    expect(r.body.url).toBe(`https://sign.closeos.fr/sign/s/${'n'.repeat(64)}`);
    expect(r.body.notified).toBe(true);
    expect(fake.emails[0].htmlContent).toContain(r.body.url);
    expect(Date.parse(r.body.link_expires_at) - Date.now()).toBeGreaterThan(9.9 * 86400000);
  });

  it('traduit « déjà signé » et refuse un signataire inconnu', async () => {
    const acc = await newAccount();
    const c = await sent(acc);
    fake.table('sign_contract_signers')[0].status = 'signed';
    const r = await api({ method: 'POST', path: `contracts/${c.id}/signers/${c.signers[0].id}/renew-link`, account: acc, body: {} });
    expect(r.statusCode).toBe(409);
    expect(r.body.error.code).toBe('signer_already_signed');
    const r2 = await api({ method: 'POST', path: `contracts/${c.id}/signers/00000000-0000-4000-8000-000000000000/unlock`, account: acc });
    expect(r2.statusCode).toBe(404);
  });

  it('liste le journal de preuve', async () => {
    const acc = await newAccount();
    const c = await sent(acc);
    fake.seed('sign_signature_events', { contract_id: c.id, event_type: 'opened', created_at: '2099-01-01T00:00:00Z', metadata: { signer_index: 1 }, ip_address: '1.2.3.4' });
    const r = await api({ path: `contracts/${c.id}/events`, account: acc });
    expect(r.body.data.map((e: any) => e.type)).toEqual(['sent', 'opened']);
    expect(r.body.data[1]).toMatchObject({ signer_index: 1, ip: '1.2.3.4' });
  });
});

describe('sign-v1 — documents', () => {
  it("donne l'original tant que ce n'est pas signé, puis le PDF signé et le certificat", async () => {
    const acc = await newAccount();
    const c = await readyContract(acc);
    const orig = await api({ path: `contracts/${c.id}/document`, account: acc });
    expect(orig.statusCode).toBe(200);
    expect(orig.body).toMatchObject({ type: 'original', expires_in: 300, sha256: sha(PDF) });
    expect(orig.body.url).toBe(`https://sb.test/storage/v1/object/sign/sign-documents/${c.id}/original.pdf?token=signed`);
    expect((await api({ path: `contracts/${c.id}/document`, account: acc, query: { type: 'signed' } })).body.error.code).toBe('document_not_ready');
    expect((await api({ path: `contracts/${c.id}/certificate`, account: acc })).body.error.code).toBe('certificate_not_ready');

    // Fin de signature (produite aujourd'hui par la page signataire, demain par le serveur au lot 3)
    Object.assign(fake.table('sign_contracts')[0], { status: 'signed', sealed_hash: 'abc', certificate_path: `${c.id}/certificat.pdf`, certificate_id: 'cert-1' });
    fake.storage.set(`sign-documents/${c.id}/sealed.pdf`, Buffer.from('%PDF-signed'));
    fake.storage.set(`sign-documents/${c.id}/certificat.pdf`, Buffer.from('%PDF-cert'));
    const signed = await api({ path: `contracts/${c.id}/document`, account: acc });
    expect(signed.body).toMatchObject({ type: 'signed', sha256: 'abc' });
    const redirect = await api({ path: `contracts/${c.id}/document`, account: acc, query: { redirect: 'true' } });
    expect(redirect.statusCode).toBe(302);
    expect(redirect.headers.location).toContain('/sealed.pdf');
    const cert = await api({ path: `contracts/${c.id}/certificate`, account: acc });
    expect(cert.statusCode).toBe(200);
    expect(cert.body).toMatchObject({ certificate_id: 'cert-1' });
    expect((await api({ path: `contracts/${c.id}`, account: acc })).body.documents).toEqual({ original: true, signed: true, certificate: true });
  });
});
