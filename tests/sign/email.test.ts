import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeReq, fakeRes, mockFetch } from './helpers';

// ── Faux client Supabase : auth.getUser + requêtes chaînées minimales ──
const state = {
  users: new Map<string, string>(), // jwt → userId
  signerByToken: new Map<string, { contract_id: string; signer_index: number }>(),
  contracts: new Map<string, { id: string; title: string }>(),
  copiesLast24h: 0,
  inserted: [] as any[],
};

function query(table: string) {
  const filters: Record<string, unknown> = {};
  const q: any = {
    select: () => q,
    eq: (col: string, val: unknown) => { filters[col] = val; return q; },
    gte: () => q,
    maybeSingle: async () => {
      if (table === 'sign_contract_signers') return { data: state.signerByToken.get(String(filters.access_token)) ?? null };
      if (table === 'sign_contracts' && filters.access_token) return { data: null };
      if (table === 'sign_contracts') return { data: state.contracts.get(String(filters.id)) ?? null };
      return { data: null };
    },
    insert: async (row: unknown) => { state.inserted.push({ table, row }); return { error: null }; },
    // select(..., { head: true, count }) terminé par await : renvoie le compteur de copies
    then: (resolve: (v: unknown) => void) => resolve({ count: state.copiesLast24h, data: null }),
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async (jwt: string) => ({ data: { user: state.users.has(jwt) ? { id: state.users.get(jwt) } : null } }) },
    from: (table: string) => query(table),
  }),
}));
vi.mock('stripe', () => ({ default: class {} }));

const SECRET = 'x'.repeat(40);
let handler: (req: any, res: any) => Promise<unknown>;

beforeAll(async () => {
  vi.stubEnv('INTERNAL_EMAIL_SECRET', SECRET);
  vi.stubEnv('BREVO_API_KEY', 'brevo');
  handler = (await import('../../api/email.ts')).default;
});
beforeEach(() => {
  state.users = new Map([['jwt-ok', 'user-1']]);
  state.signerByToken = new Map([['tok-ok', { contract_id: 'c1', signer_index: 1 }]]);
  state.contracts = new Map([['c1', { id: 'c1', title: 'Devis <b>salle de bain</b>' }]]);
  state.copiesLast24h = 0;
  state.inserted = [];
});
afterEach(() => { vi.unstubAllGlobals(); });

const brevo = () => mockFetch([(url) => (url.hostname === 'api.brevo.com' ? { messageId: 'm1' } : undefined)]);
const payload = (over: Record<string, unknown> = {}) => ({
  sender: { email: 'support@closeos.fr', name: 'CloseOS Sign' }, to: [{ email: 'client@test.fr' }],
  subject: 'Sujet', htmlContent: '<p>ok</p>', ...over,
});
const send = (headers: Record<string, string>, body: unknown) =>
  fakeReq({ query: { action: 'send' }, headers, body });

describe('/api/send-email', () => {
  it('refuse un appel anonyme sans rien envoyer', async () => {
    const { calls } = brevo();
    const res = fakeRes();
    await handler(send({}, payload()), res);
    expect(res.statusCode).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('refuse un JWT invalide', async () => {
    brevo();
    const res = fakeRes();
    await handler(send({ authorization: 'Bearer faux' }, payload()), res);
    expect(res.statusCode).toBe(401);
  });

  it('envoie pour un utilisateur connecté', async () => {
    const { calls } = brevo();
    const res = fakeRes();
    await handler(send({ authorization: 'Bearer jwt-ok' }, payload()), res);
    expect(res.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it('refuse un expéditeur hors liste blanche, même connecté', async () => {
    const { calls } = brevo();
    const res = fakeRes();
    await handler(send({ authorization: 'Bearer jwt-ok' }, payload({ sender: { email: 'ceo@banque.fr', name: 'Banque' } })), res);
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('refuse plus de 10 destinataires', async () => {
    brevo();
    const res = fakeRes();
    const to = Array.from({ length: 11 }, (_, i) => ({ email: `p${i}@test.fr` }));
    await handler(send({ authorization: 'Bearer jwt-ok' }, payload({ to })), res);
    expect(res.statusCode).toBe(400);
  });

  it('accepte les Edge Functions avec le secret interne', async () => {
    brevo();
    const res = fakeRes();
    await handler(send({ 'x-closeos-internal': SECRET }, payload()), res);
    expect(res.statusCode).toBe(200);
  });

  it('refuse un secret interne erroné', async () => {
    brevo();
    const res = fakeRes();
    await handler(send({ 'x-closeos-internal': 'y'.repeat(40) }, payload()), res);
    expect(res.statusCode).toBe(401);
  });
});

describe('/api/sign-send-copy (signataire sans compte)', () => {
  const PDF = Buffer.from('%PDF-1.7\n%%EOF').toString('base64');
  const copy = (body: Record<string, unknown>) => fakeReq({ query: { action: 'sign-copy' }, body });

  it('envoie la copie avec un contenu fixé par le serveur (HTML échappé)', async () => {
    const { calls } = brevo();
    const res = fakeRes();
    await handler(copy({ token: 'tok-ok', to: 'client@test.fr', recipientName: '<script>x</script>', pdfB64: PDF }), res);
    expect(res.statusCode).toBe(200);
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.sender.email).toBe('support@closeos.fr');
    expect(sent.htmlContent).not.toContain('<script>');
    expect(sent.htmlContent).toContain('&lt;b&gt;salle de bain&lt;/b&gt;');
    expect(state.inserted[0].row.metadata.kind).toBe('email_copy');
  });

  it('refuse un token inconnu', async () => {
    const { calls } = brevo();
    const res = fakeRes();
    await handler(copy({ token: 'inconnu', to: 'client@test.fr', pdfB64: PDF }), res);
    expect(res.statusCode).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("refuse ce qui n'est pas un PDF", async () => {
    brevo();
    const res = fakeRes();
    await handler(copy({ token: 'tok-ok', to: 'client@test.fr', pdfB64: Buffer.from('<html>').toString('base64') }), res);
    expect(res.statusCode).toBe(400);
  });

  it('limite à 5 copies par contrat et par 24 h', async () => {
    const { calls } = brevo();
    state.copiesLast24h = 5;
    const res = fakeRes();
    await handler(copy({ token: 'tok-ok', to: 'client@test.fr', pdfB64: PDF }), res);
    expect(res.statusCode).toBe(429);
    expect(calls).toHaveLength(0);
  });
});
