import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeReq, fakeRes, mockFetch } from './helpers';

// ─────────────── api/sign-owner.ts (REST Supabase via fetch) ───────────────

describe('api/sign-owner.ts — code de signature propriétaire', () => {
  let handler: (req: any, res: any) => Promise<unknown>;
  const session = (over: Record<string, unknown>) => ({
    token: 'sess', owner_email: 'owner@test.fr', contract_ids: [], status: 'pending', verified: false,
    code_hash: null, code_expires_at: null, code_attempts: 0, code_sends: 0, ...over,
  });

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'https://sb.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
    vi.stubEnv('BREVO_API_KEY', 'brevo');
    handler = (await import('../../api/sign-owner.ts')).default;
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const routes = (s: Record<string, unknown>) => [
    (url: URL, init: RequestInit) => (url.pathname.endsWith('/sign_owner_sign_sessions') && (init.method ?? 'GET') === 'GET' ? [s] : undefined),
    (url: URL, init: RequestInit) => (url.pathname.endsWith('/sign_owner_sign_sessions') && init.method === 'PATCH' ? null : undefined),
    (url: URL) => (url.hostname === 'api.brevo.com' ? { messageId: 'm' } : undefined),
  ];
  const req = (action: string, extra: Record<string, unknown> = {}) =>
    fakeReq({ headers: { origin: 'https://sign.closeos.fr' }, body: { action, token: 'sess', ...extra } });

  it('envoie un code sans remettre le compteur d\'essais à zéro', async () => {
    const { calls } = mockFetch(routes(session({ code_attempts: 2 })));
    const res = fakeRes();
    await handler(req('send-code'), res);
    expect(res.statusCode).toBe(200);
    const patch = JSON.parse(String(calls.find((c) => c.init.method === 'PATCH')!.init.body));
    expect(patch).not.toHaveProperty('code_attempts');
    expect(patch.code_sends).toBe(1);
  });

  it('refuse un 4e envoi dans la même session', async () => {
    const { calls } = mockFetch(routes(session({ code_sends: 3 })));
    const res = fakeRes();
    await handler(req('send-code'), res);
    expect(res.statusCode).toBe(429);
    expect(calls.some((c) => c.url.hostname === 'api.brevo.com')).toBe(false);
  });

  it('refuse un renvoi avant 60 s', async () => {
    const justSent = new Date(Date.now() + 10 * 60 * 1000 - 5000).toISOString(); // envoyé il y a 5 s
    mockFetch(routes(session({ code_sends: 1, code_expires_at: justSent })));
    const res = fakeRes();
    await handler(req('send-code'), res);
    expect(res.statusCode).toBe(429);
  });

  it('refuse tout renvoi une fois les 5 essais épuisés', async () => {
    mockFetch(routes(session({ code_sends: 1, code_attempts: 5 })));
    const res = fakeRes();
    await handler(req('send-code'), res);
    expect(res.body.error).toBe('too_many');
  });

  it("n'ouvre pas le CORS aux autres origines", async () => {
    mockFetch(routes(session({})));
    const res = fakeRes();
    await handler(fakeReq({ method: 'OPTIONS', headers: { origin: 'https://evil.example' }, body: {} }), res);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

// ─────────────── api/sign-auth.ts (supabase-js) ───────────────

const auth = {
  jwtUser: new Map<string, string>(),
  codes: [] as any[],
  updates: [] as any[],
};

function q(table: string) {
  const f: Record<string, unknown> = {};
  const o: any = {
    select: () => o, order: () => o, limit: () => o, gte: () => o,
    eq: (c: string, v: unknown) => { f[c] = v; return o; },
    maybeSingle: async () => {
      if (table === 'sign_users') return { data: { id: f.id, notif_prefs: {} } };
      if (table === 'sign_device_codes') {
        const rows = auth.codes.filter((r) => r.user_id === f.user_id && (f.used === undefined || r.used === f.used));
        return { data: rows[rows.length - 1] ?? null };
      }
      return { data: null };
    },
    // update(...).eq(...)[.eq(...)] : chaînable, résolu à l'await
    update: (patch: unknown) => {
      const filters: unknown[] = [];
      const u: any = {
        eq: (_c: string, v: unknown) => { filters.push(v); return u; },
        then: (resolve: (v: unknown) => void) => { auth.updates.push({ table, id: filters[0], patch }); resolve({ error: null }); },
      };
      return u;
    },
    insert: async (row: any) => { if (table === 'sign_device_codes') auth.codes.push({ ...row, used: false, attempts: 0, created_at: new Date().toISOString() }); return { error: null }; },
    delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
  };
  return o;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (jwt: string) => ({ data: { user: auth.jwtUser.has(jwt) ? { id: auth.jwtUser.get(jwt) } : null }, error: null }),
      admin: { getUserById: async () => ({ data: { user: { email: 'owner@test.fr' } } }) },
    },
    from: (t: string) => q(t),
  }),
}));

describe('api/sign-auth.ts — code d\'appareil (2FA)', () => {
  let handler: (req: any, res: any) => Promise<unknown>;
  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'https://sb.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
    handler = (await import('../../api/sign-auth.ts')).default;
  });
  beforeEach(() => {
    auth.jwtUser = new Map([['jwt-u1', 'u1'], ['jwt-u2', 'u2']]);
    auth.codes = [];
    auth.updates = [];
    mockFetch([(url) => (url.hostname === 'api.brevo.com' ? { messageId: 'm' } : undefined)]);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const call = (action: string, body: Record<string, unknown>, jwt?: string) =>
    fakeReq({ query: { action }, headers: jwt ? { authorization: `Bearer ${jwt}` } : {}, body });

  it('refuse d\'envoyer un code sans session', async () => {
    const res = fakeRes();
    await handler(call('send-verification-code', { user_id: 'u1' }), res);
    expect(res.statusCode).toBe(401);
    expect(auth.codes).toHaveLength(0);
  });

  it("refuse d'envoyer un code pour le compte d'un autre", async () => {
    const res = fakeRes();
    await handler(call('send-verification-code', { user_id: 'u1' }, 'jwt-u2'), res);
    expect(res.statusCode).toBe(401);
  });

  it('envoie un code à son propre compte, puis impose 60 s avant le suivant', async () => {
    const r1 = fakeRes();
    await handler(call('send-verification-code', { user_id: 'u1' }, 'jwt-u1'), r1);
    expect(r1.statusCode).toBe(200);
    const r2 = fakeRes();
    await handler(call('send-verification-code', { user_id: 'u1' }, 'jwt-u1'), r2);
    expect(r2.statusCode).toBe(429);
  });

  it('compte chaque mauvais code et bloque au 5e', async () => {
    auth.codes.push({ id: 'k1', user_id: 'u1', code: '123456', used: false, attempts: 4, created_at: new Date().toISOString() });
    const wrong = fakeRes();
    await handler(call('verify-code', { user_id: 'u1', code: '000000', device_fingerprint: 'fp' }, 'jwt-u1'), wrong);
    expect(wrong.statusCode).toBe(401);
    expect(auth.updates.at(-1)).toMatchObject({ table: 'sign_device_codes', patch: { attempts: 5 } });

    auth.codes[0].attempts = 5;
    const blocked = fakeRes();
    await handler(call('verify-code', { user_id: 'u1', code: '123456', device_fingerprint: 'fp' }, 'jwt-u1'), blocked);
    expect(blocked.statusCode).toBe(429);
  });

  it('accepte le bon code', async () => {
    auth.codes.push({ id: 'k1', user_id: 'u1', code: '123456', used: false, attempts: 0, created_at: new Date().toISOString() });
    const res = fakeRes();
    await handler(call('verify-code', { user_id: 'u1', code: '123 456', device_fingerprint: 'fp' }, 'jwt-u1'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{96}$/);
  });
});
