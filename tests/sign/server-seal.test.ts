// Lot 3 : scellement et certification à la dernière signature (api/_lib/sign-finalize.ts,
// api/sign-internal.ts), purge Storage (api/_lib/sign-purge.js), appel depuis les Edge Functions.
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestServerSeal, serverCertified, SERVER_SEAL_URL } from '../../supabase/functions/_shared/sign-guards';
import { strokesToSvgDataUrl } from '../../src/lib/signSignatureSvg';
import { FakeSupabase } from './fake-supabase';
import { fakeReq, fakeRes } from './helpers';

const SECRET = 's'.repeat(40);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
let sealAndCertify: (id: string, ctx?: any) => Promise<any>;
let processPurgeQueue: () => Promise<any>;
let internal: (req: any, res: any) => Promise<unknown>;
let PDF: Buffer;
let fake: FakeSupabase;

beforeAll(async () => {
  vi.stubEnv('SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
  vi.stubEnv('BREVO_API_KEY', 'brevo');
  vi.stubEnv('INTERNAL_EMAIL_SECRET', SECRET);
  ({ sealAndCertify } = await import('../../api/_lib/sign-finalize'));
  ({ processPurgeQueue } = await import('../../api/_lib/sign-purge.js'));
  internal = (await import('../../api/sign-internal')).default;
  const d = await PDFDocument.create();
  d.addPage([595.28, 841.89]);
  d.addPage([841.89, 595.28]);
  PDF = Buffer.from(await d.save());
});
beforeEach(() => {
  fake = new FakeSupabase().install();
  fake.rpcs.sign_seal_lock = ({ p_contract_id }, f) => {
    const c = f.table('sign_contracts').find((x) => x.id === p_contract_id)!;
    if (c.certified_at || c.sealed_by === 'browser' || c.seal_started_at) return false;
    c.seal_started_at = new Date().toISOString();
    return true;
  };
});
afterEach(() => { vi.unstubAllGlobals(); });

function signedContract(over: Record<string, unknown> = {}) {
  const c = fake.seed('sign_contracts', { title: 'Devis <SdB>', status: 'signed', source_type: 'pdf', page_count: 2, verification_method: 'email', owner_email: 'artisan@x.fr', document_hash: sha(PDF), ...over });
  c.pdf_path = c.pdf_path === undefined ? `${c.id}/original.pdf` : c.pdf_path;
  if (c.pdf_path) fake.storage.set(`sign-documents/${c.pdf_path}`, PDF);
  fake.seed('sign_contract_signers', { contract_id: c.id, signer_index: 1, name: 'Marie', email: 'marie@x.fr', status: 'signed', signed_at: '2026-09-28T18:08:37Z' });
  fake.seed('sign_contract_fields', { contract_id: c.id, field_type: 'signature', page: 1, pos_x: 500, pos_y: 950, width: 200, height: 64, value: strokesToSvgDataUrl([[{ x: 0, y: 0 }, { x: 50, y: 30 }]]), sort_order: 0 });
  fake.seed('sign_contract_fields', { contract_id: c.id, field_type: 'date', page: 2, pos_x: 300, pos_y: 250, width: 150, height: 34, value: '2026-09-28', sort_order: 1 });
  for (const t of ['sent', 'opened', 'otp_verified', 'consent', 'signed', 'completed']) fake.seed('sign_signature_events', { contract_id: c.id, event_type: t, metadata: { signer_index: 1 }, created_at: `2026-09-28T18:0${t.length % 9}:00Z` });
  return c;
}

describe('sealAndCertify', () => {
  it('scelle le PDF d\'origine, certifie, journalise et envoie le PDF final à toutes les parties', async () => {
    const c = signedContract();
    const out = await sealAndCertify(c.id, { ip: '1.2.3.4', ua: 'Safari' });
    expect(out.status).toBe('certified');

    const sealed = fake.storage.get(`sign-documents/${c.id}/sealed.pdf`)!;
    const final = fake.storage.get(`sign-documents/${c.id}/certificat.pdf`)!;
    expect(sha(sealed)).toBe(c.sealed_hash);
    expect(sha(final)).toBe(c.certificate_hash);
    expect(c).toMatchObject({ sealed_by: 'server', certificate_path: `${c.id}/certificat.pdf`, seal_started_at: null, certificate_id: out.certificateId });
    expect(c.certified_at).toBeTruthy();

    const sealedDoc = await PDFDocument.load(sealed);
    expect(sealedDoc.getPages().map((p) => Math.round(p.getSize().width))).toEqual([595, 842]); // paysage conservé
    const finalDoc = await PDFDocument.load(final);
    expect(finalDoc.getPageCount()).toBeGreaterThan(2); // document + certificat

    const ev = fake.table('sign_signature_events').filter((e) => ['sealed', 'certified'].includes(e.event_type));
    expect(ev.map((e) => [e.event_type, e.metadata.by])).toEqual([['sealed', 'server'], ['certified', 'server']]);
    expect(ev[0].ip_address).toBe('1.2.3.4');

    expect(fake.emails.map((e) => e.to[0].email).sort()).toEqual(['artisan@x.fr', 'marie@x.fr']);
    expect(fake.emails[0].attachment[0].name).toBe('Devis-SdB-certificat.pdf');
    expect(Buffer.from(fake.emails[0].attachment[0].content, 'base64').equals(final)).toBe(true);
    expect(fake.emails[0].htmlContent).toContain('Devis &lt;SdB&gt;');
  });

  it('est idempotent : un second appel ne rescelle pas', async () => {
    const c = signedContract();
    await sealAndCertify(c.id);
    const hash = c.sealed_hash;
    expect((await sealAndCertify(c.id)).status).toBe('already');
    expect(c.sealed_hash).toBe(hash);
    expect(fake.table('sign_signature_events').filter((e) => e.event_type === 'sealed')).toHaveLength(1);
  });

  it("n'agit pas sur un contrat incomplet, texte, scellé par le navigateur ou déjà en cours", async () => {
    const a = signedContract();
    fake.seed('sign_contract_signers', { contract_id: a.id, signer_index: 2, status: 'sent' });
    expect((await sealAndCertify(a.id)).status).toBe('not_complete');
    expect(await sealAndCertify(signedContract({ source_type: 'text', pdf_path: null }).id)).toEqual({ status: 'skipped', reason: 'text_contract' });
    expect(await sealAndCertify(signedContract({ sealed_by: 'browser', sealed_hash: 'x' }).id)).toEqual({ status: 'skipped', reason: 'browser_sealed' });
    expect(await sealAndCertify(signedContract({ seal_started_at: new Date().toISOString() }).id)).toEqual({ status: 'skipped', reason: 'busy' });
    expect([...fake.storage.keys()].some((k) => /sealed|certificat/.test(k))).toBe(false); // rien n'a été scellé
  });

  it('libère le verrou en cas d\'échec (reprise possible)', async () => {
    const c = signedContract();
    fake.storage.delete(`sign-documents/${c.pdf_path}`);
    await expect(sealAndCertify(c.id)).rejects.toThrow(/introuvable/);
    expect(c.seal_started_at).toBeNull();
    expect(c.sealed_hash).toBeUndefined();
  });

  it("reprend une certification interrompue sans rescellement", async () => {
    const c = signedContract();
    await sealAndCertify(c.id);
    const sealed = fake.storage.get(`sign-documents/${c.id}/sealed.pdf`);
    Object.assign(c, { certified_at: null, certificate_path: null });
    expect((await sealAndCertify(c.id)).status).toBe('certified');
    expect(fake.storage.get(`sign-documents/${c.id}/sealed.pdf`)).toBe(sealed);
    expect(fake.table('sign_signature_events').filter((e) => e.event_type === 'sealed')).toHaveLength(1);
  });

  it('lit un PDF resté en base64 (contrats créés dans l\'éditeur ou par le MCP)', async () => {
    const c = signedContract({ pdf_path: null, pdf_data: `data:application/pdf;base64,${PDF.toString('base64')}` });
    expect((await sealAndCertify(c.id)).status).toBe('certified');
  });
});

describe('api/sign-internal.ts', () => {
  const call = (headers: Record<string, string>, body: any) => {
    const res = fakeRes();
    return internal(fakeReq({ method: 'POST', headers, query: { action: 'seal' }, body }), res).then(() => res);
  };
  it('refuse tout appel sans le secret interne', async () => {
    expect((await call({}, { contractId: 'x' })).statusCode).toBe(401);
    expect((await call({ 'x-closeos-internal': 'faux'.repeat(10) }, {})).statusCode).toBe(401);
    expect(fake.calls).toHaveLength(0);
  });
  it('scelle sur appel interne', async () => {
    const c = signedContract();
    expect((await call({ 'x-closeos-internal': SECRET }, { contractId: 'pas-un-uuid' })).statusCode).toBe(400);
    const res = await call({ 'x-closeos-internal': SECRET }, { contractId: c.id });
    expect(res.body).toMatchObject({ ok: true, status: 'certified' });
  });
});

describe('requestServerSeal (Edge Functions)', () => {
  it("n'appelle pas le serveur sans secret interne, et ne lève jamais", async () => {
    const f = vi.fn();
    expect(await requestServerSeal('c', {}, {}, { fetch: f as any })).toEqual({ status: 'failed' });
    expect(f).not.toHaveBeenCalled();
    const boom = vi.fn(async () => { throw new Error('réseau'); });
    expect(await requestServerSeal('c', { 'x-closeos-internal': SECRET }, {}, { fetch: boom as any })).toEqual({ status: 'failed' });
  });
  it('transmet le contrat et renvoie l\'issue', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, status: 'certified', certificateId: 'c-1' })));
    const out = await requestServerSeal('c', { 'x-closeos-internal': SECRET }, { ip: '1.2.3.4' }, { fetch: f as any });
    expect(out).toEqual({ status: 'certified', certificateId: 'c-1' });
    expect(f.mock.calls[0][0]).toBe(SERVER_SEAL_URL);
    expect(serverCertified('certified') && serverCertified('already') && !serverCertified('skipped')).toBe(true);
  });
});

describe('processPurgeQueue', () => {
  it('purge les dossiers des contrats supprimés et jamais ceux d\'un contrat encore présent', async () => {
    const gone = '11111111-1111-4111-8111-111111111111';
    fake.storage.set(`sign-documents/${gone}/original.pdf`, PDF);
    fake.storage.set(`sign-documents/${gone}/sealed.pdf`, PDF);
    const alive = fake.seed('sign_contracts', { title: 'Encore là' });
    fake.storage.set(`sign-documents/${alive.id}/original.pdf`, PDF);
    fake.seed('sign_storage_purge_queue', { contract_id: gone, attempts: 0, done_at: null, enqueued_at: '2026-09-28T00:00:00Z' });
    fake.seed('sign_storage_purge_queue', { contract_id: alive.id, attempts: 0, done_at: null, enqueued_at: '2026-09-28T00:00:01Z' });
    const out = await processPurgeQueue();
    expect(out).toEqual({ purged: 1, files: 2, kept: 1, errors: 0 });
    expect([...fake.storage.keys()]).toEqual([`sign-documents/${alive.id}/original.pdf`]);
    expect(fake.table('sign_storage_purge_queue').every((q) => q.done_at)).toBe(true);
  });
});
