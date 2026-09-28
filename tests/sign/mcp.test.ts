import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashMcpKey } from '../../api/_lib/sign-security.js';
import { fakeReq, fakeRes, mockFetch } from './helpers';

const KEY = 'sk_' + 'a'.repeat(48);
const OWNER = '11111111-1111-1111-1111-111111111111';
const SB = 'https://sb.test';

let handler: (req: any, res: any) => Promise<unknown>;

beforeAll(async () => {
  vi.stubEnv('SUPABASE_URL', SB);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
  vi.stubEnv('SIGN_MCP_SECRET', 'ancienne-cle-globale');
  vi.stubEnv('SIGN_OWNER_EMAIL', 'owner@test.fr');
  handler = (await import('../../api/mcp.js')).default;
});
afterEach(() => { vi.unstubAllGlobals(); });

/** Routes PostgREST communes : la clé hashée résout OWNER, rien d'autre ne correspond. */
const ownerByHash = (url: URL) => {
  if (url.pathname.endsWith('/sign_users') && url.search.includes('mcp_key_hash=eq.')) {
    return url.search.includes(hashMcpKey(KEY)) ? [{ id: OWNER, email: 'owner@test.fr' }] : [];
  }
  // Comme la production avant migration : clé en clair et propriétaire de la clé globale trouvables.
  if (url.pathname.endsWith('/sign_users') && url.search.includes('mcp_key=eq.')) {
    return url.search.includes(KEY) ? [{ id: OWNER, email: 'owner@test.fr' }] : [];
  }
  if (url.pathname.endsWith('/sign_users') && url.search.includes('email=ilike.')) return [{ id: OWNER, email: 'owner@test.fr' }];
  return undefined;
};

// Clé passée dans l'URL (acceptée par l'ancien et le nouveau code) : les tests métier ne dépendent
// pas du mode d'authentification.
const call = (name: string, args: Record<string, unknown>) =>
  fakeReq({ query: { key: KEY }, body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } });

describe('api/mcp.js — authentification', () => {
  it("accepte la clé en en-tête Bearer (recherche par empreinte, jamais en clair)", async () => {
    const { calls } = mockFetch([ownerByHash]);
    const res = fakeRes();
    await handler(fakeReq({ headers: { authorization: `Bearer ${KEY}` }, body: { jsonrpc: '2.0', id: 1, method: 'ping' } }), res);
    expect(res.statusCode).toBe(200);
    expect(calls[0].url.search).toContain(hashMcpKey(KEY));
    expect(calls[0].url.search).not.toContain(KEY);
  });

  it("accepte encore la clé dans l'URL du connecteur", async () => {
    mockFetch([ownerByHash]);
    const res = fakeRes();
    await handler(fakeReq({ query: { key: KEY }, body: { jsonrpc: '2.0', id: 1, method: 'ping' } }), res);
    expect(res.statusCode).toBe(200);
  });

  it("refuse l'ancienne clé globale SIGN_MCP_SECRET", async () => {
    mockFetch([ownerByHash]);
    const res = fakeRes();
    await handler(fakeReq({ query: { key: 'ancienne-cle-globale' }, body: { jsonrpc: '2.0', id: 1, method: 'ping' } }), res);
    expect(res.statusCode).toBe(401);
  });

  it('refuse une clé inconnue', async () => {
    mockFetch([ownerByHash]);
    const res = fakeRes();
    await handler(fakeReq({ headers: { authorization: 'Bearer sk_inconnue_0000000000' }, body: { jsonrpc: '2.0', id: 1, method: 'ping' } }), res);
    expect(res.statusCode).toBe(401);
  });

  it("n'ouvre pas le CORS aux origines tierces", async () => {
    mockFetch([ownerByHash]);
    const evil = fakeRes();
    await handler(fakeReq({ headers: { authorization: `Bearer ${KEY}`, origin: 'https://evil.example' }, body: { jsonrpc: '2.0', id: 1, method: 'ping' } }), evil);
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    const sign = fakeRes();
    await handler(fakeReq({ headers: { authorization: `Bearer ${KEY}`, origin: 'https://sign.closeos.fr' }, body: { jsonrpc: '2.0', id: 1, method: 'ping' } }), sign);
    expect(sign.headers['access-control-allow-origin']).toBe('https://sign.closeos.fr');
  });
});

describe('api/mcp.js — cloisonnement et suppression', () => {
  const contract = (over: Record<string, unknown>) => (url: URL) =>
    url.pathname.endsWith('/sign_contracts') && url.search.includes('id=eq.c1')
      ? [{ id: 'c1', user_id: OWNER, title: 'Devis', status: 'draft', certificate_id: null, purge_hold: false, ...over }]
      : undefined;

  it("refuse un contrat sans propriétaire (user_id NULL)", async () => {
    mockFetch([ownerByHash, contract({ user_id: null })]);
    const res = fakeRes();
    await handler(call('sign_get_status', { contract_id: 'c1' }), res);
    expect(res.body.result.isError).toBe(true);
    expect(res.body.result.content[0].text).toMatch(/n'appartient pas/);
  });

  it("refuse le contrat d'un autre compte", async () => {
    mockFetch([ownerByHash, contract({ user_id: '99999999-9999-9999-9999-999999999999' })]);
    const res = fakeRes();
    await handler(call('sign_get_status', { contract_id: 'c1' }), res);
    expect(res.body.result.isError).toBe(true);
  });

  for (const [label, over] of [
    ['signé', { status: 'signed' }],
    ['payé', { status: 'paid' }],
    ['certifié', { certificate_id: 'cert-1' }],
    ['sous conservation', { purge_hold: true }],
  ] as const) {
    it(`refuse de supprimer un contrat ${label}, même avec confirm=true`, async () => {
      const { calls } = mockFetch([ownerByHash, contract(over)]);
      const res = fakeRes();
      await handler(call('sign_delete_contract', { contract_id: 'c1', confirm: true }), res);
      expect(res.body.result.isError).toBe(true);
      expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    });
  }

  it('supprime un brouillon', async () => {
    const { calls } = mockFetch([ownerByHash, contract({}), (url, init) => (init.method === 'DELETE' ? null : undefined)]);
    const res = fakeRes();
    await handler(call('sign_delete_contract', { contract_id: 'c1' }), res);
    expect(res.body.result.isError).toBeUndefined();
    expect(calls.some((c) => c.init.method === 'DELETE' && c.url.pathname.endsWith('/sign_contracts'))).toBe(true);
  });
});

describe('api/mcp.js — import de PDF', () => {
  it('refuse une pdf_url interne sans la télécharger', async () => {
    const { calls } = mockFetch([ownerByHash]);
    const res = fakeRes();
    await handler(call('sign_import_contract', { title: 'T', pdf_url: 'https://169.254.169.254/latest/meta-data/' }), res);
    expect(res.body.result.isError).toBe(true);
    expect(res.body.result.content[0].text).toMatch(/adresse réseau/);
    expect(calls.some((c) => c.url.hostname === '169.254.169.254')).toBe(false);
  });

  it("refuse un base64 qui n'est pas un PDF", async () => {
    mockFetch([ownerByHash]);
    const res = fakeRes();
    await handler(call('sign_import_contract', { title: 'T', pdf_base64: Buffer.from('<html>').toString('base64') }), res);
    expect(res.body.result.content[0].text).toMatch(/pas un PDF/);
  });
});

describe('api/mcp.js — débloquer / nouveau lien', () => {
  const contractOk = (url: URL) =>
    url.pathname.endsWith('/sign_contracts') && url.search.includes('id=eq.c1')
      ? [{ id: 'c1', user_id: OWNER, is_template: false }]
      : undefined;
  const signer = (url: URL) =>
    url.pathname.endsWith('/sign_contract_signers') && url.search.includes('signer_index=eq.2')
      ? [{ id: 'sig-2', signer_index: 2, status: 'opened' }]
      : undefined;

  it('liste les deux nouveaux outils', async () => {
    mockFetch([ownerByHash]);
    const res = fakeRes();
    await handler(fakeReq({ query: { key: KEY }, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } }), res);
    const names = res.body.result.tools.map((t: any) => t.name);
    expect(names).toEqual(expect.arrayContaining(['sign_unlock_signer', 'sign_renew_signer_link']));
    expect(names).toHaveLength(25);
  });

  it('débloque via la fonction serveur, avec le propriétaire comme auteur', async () => {
    const { calls } = mockFetch([ownerByHash, contractOk, signer, (url) => (url.pathname.endsWith('/rpc/sign_unlock_signer_internal') ? { signer_index: 2 } : undefined)]);
    const res = fakeRes();
    await handler(call('sign_unlock_signer', { contract_id: 'c1', signer_index: 2 }), res);
    expect(res.body.result.isError).toBeUndefined();
    const rpc = calls.find((c) => c.url.pathname.endsWith('/rpc/sign_unlock_signer_internal'))!;
    expect(JSON.parse(String(rpc.init.body))).toEqual({ p_signer_id: 'sig-2', p_actor: OWNER, p_via: 'mcp' });
  });

  it('renvoie le nouveau lien', async () => {
    mockFetch([ownerByHash, contractOk, signer, (url) => (url.pathname.endsWith('/rpc/sign_renew_signer_link_internal') ? { token: 'b'.repeat(64) } : undefined)]);
    const res = fakeRes();
    await handler(call('sign_renew_signer_link', { contract_id: 'c1', signer_index: 2 }), res);
    expect(JSON.parse(res.body.result.content[0].text).url).toBe(`https://sign.closeos.fr/sign/s/${'b'.repeat(64)}`);
  });

  it("refuse le contrat d'un autre compte sans appeler la fonction", async () => {
    const other = (url: URL) =>
      url.pathname.endsWith('/sign_contracts') ? [{ id: 'c1', user_id: '99999999-9999-9999-9999-999999999999', is_template: false }] : undefined;
    const { calls } = mockFetch([ownerByHash, other]);
    const res = fakeRes();
    await handler(call('sign_unlock_signer', { contract_id: 'c1', signer_index: 2 }), res);
    expect(res.body.result.isError).toBe(true);
    expect(calls.some((c) => c.url.pathname.includes('/rpc/'))).toBe(false);
  });

  it('traduit le refus « déjà signé » en message lisible', async () => {
    mockFetch([ownerByHash, contractOk, signer, (url) =>
      url.pathname.endsWith('/rpc/sign_renew_signer_link_internal') ? { __status: 400, __body: { message: 'signataire_deja_signe' } } : undefined]);
    const res = fakeRes();
    await handler(call('sign_renew_signer_link', { contract_id: 'c1', signer_index: 2 }), res);
    expect(res.body.result.content[0].text).toMatch(/déjà signé/);
  });
});
