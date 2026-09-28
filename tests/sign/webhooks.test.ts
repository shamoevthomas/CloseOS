// Lot 4 : envoi des webhooks (api/_lib/sign-webhooks.js), routes /api/sign/v1/webhooks, déclenchement.
import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabase } from './fake-supabase';
import { fakeReq, fakeRes } from './helpers';

const KEY = 'sk_sign_' + 'a'.repeat(64);
const SECRET = 'whsec_' + 'b'.repeat(64);
const HOOK = 'https://93.184.216.34/hooks/sign'; // IP publique littérale : aucune résolution DNS en test
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

let hooks: typeof import('../../api/_lib/sign-webhooks.js');
let api: (req: any, res: any) => Promise<unknown>;
let internal: (req: any, res: any) => Promise<unknown>;
let fake: FakeSupabase;
let platform: any;

beforeAll(async () => {
  vi.stubEnv('SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
  vi.stubEnv('CRON_SECRET', 'cron-secret');
  vi.stubEnv('INTERNAL_EMAIL_SECRET', 'i'.repeat(40));
  hooks = await import('../../api/_lib/sign-webhooks.js');
  api = (await import('../../api/sign-v1.js')).default;
  internal = (await import('../../api/sign-internal')).default;
});
beforeEach(() => {
  fake = new FakeSupabase().install();
  platform = fake.seed('sign_platforms', { name: 'SaaS BTP', api_key_hash: sha(KEY), api_key_hint: 'x', webhook_secret: SECRET, scopes: ['accounts:write', 'contracts:write', 'contracts:read', 'webhooks:write'] });
  fake.rpcs.sign_webhook_claim = ({ p_limit }, f) => {
    const now = Date.now();
    const due = f.table('sign_webhook_deliveries').filter((d) => d.status === 'pending' && Date.parse(d.next_attempt_at) <= now).slice(0, p_limit);
    for (const d of due) d.next_attempt_at = new Date(now + 120_000).toISOString();
    return JSON.parse(JSON.stringify(due));
  };
  fake.rpcs.sign_log_expired_links = () => 0;
});
afterEach(() => { vi.unstubAllGlobals(); });

const endpoint = (over: Record<string, unknown> = {}) => fake.seed('sign_webhook_endpoints', { platform_id: platform.id, url: HOOK, events: hooks.WEBHOOK_EVENTS, active: true, ...over });
const delivery = (ep: any, over: Record<string, unknown> = {}) => fake.seed('sign_webhook_deliveries', {
  endpoint_id: ep.id, platform_id: platform.id, event: 'signer.signed', status: 'pending', attempts: 0, next_attempt_at: new Date(Date.now() - 1000).toISOString(),
  payload: { event: 'signer.signed', product: 'sign', account_id: 'a1', contract_id: 'c1', timestamp: '2026-09-28T19:00:00.000Z', data: { signer: { index: 1 } } }, ...over,
});

/** Vérifie une signature comme devra le faire la plateforme. */
function verify(header: string, body: string, secret: string) {
  const parts = header.split(',');
  const t = parts.find((p) => p.startsWith('t='))!.slice(2);
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return parts.filter((p) => p.startsWith('v1=')).some((p) => p.slice(3) === expected) && Math.abs(Date.now() / 1000 - Number(t)) < 300;
}

describe('signature et nouvelles tentatives', () => {
  it('signe t.corps en HMAC-SHA256, avec l\'ancien secret pendant 24 h après rotation', () => {
    const body = '{"a":1}';
    expect(verify(hooks.signatureHeader(body, [SECRET]), body, SECRET)).toBe(true);
    expect(verify(hooks.signatureHeader(body, [SECRET]), body + ' ', SECRET)).toBe(false);
    const pf = { webhook_secret: 'new', webhook_secret_previous: 'old', webhook_secret_previous_until: new Date(Date.now() + 1000).toISOString() };
    expect(hooks.activeSecrets(pf)).toEqual(['new', 'old']);
    expect(hooks.activeSecrets({ ...pf, webhook_secret_previous_until: new Date(Date.now() - 1000).toISOString() })).toEqual(['new']);
    const h = hooks.signatureHeader(body, ['new', 'old']);
    expect(verify(h, body, 'new') && verify(h, body, 'old')).toBe(true);
  });

  it('5 tentatives : immédiate puis +1 min, +5 min, +30 min, +2 h, puis échec', () => {
    const now = Date.parse('2026-09-28T12:00:00Z');
    const delays: number[] = [];
    let d: any = { attempts: 0 };
    for (let i = 0; i < 5; i++) {
      d = { ...d, ...hooks.nextState(d, { ok: false, status: 500, error: 'HTTP 500' }, now) };
      if (d.status === 'pending') delays.push((Date.parse(d.next_attempt_at) - now) / 1000);
    }
    expect(delays).toEqual([60, 300, 1800, 7200]);
    expect(d).toMatchObject({ status: 'failed', attempts: 5, last_status_code: 500 });
    expect(hooks.nextState({ attempts: 2 }, { ok: true, status: 204 }, now)).toMatchObject({ status: 'succeeded', attempts: 3, last_error: null });
  });
});

describe('dispatchDue', () => {
  it('envoie le corps signé avec les en-têtes, et marque la livraison réussie', async () => {
    const d = delivery(endpoint());
    expect(await hooks.dispatchDue()).toEqual({ sent: 1, retried: 0, failed: 0 });
    const [req] = fake.outbound;
    expect(req.url).toBe(HOOK);
    expect(JSON.parse(req.body)).toEqual(d.payload);
    expect(req.headers['x-closeos-event']).toBe('signer.signed');
    expect(req.headers['x-closeos-delivery']).toBe(d.id);
    expect(verify(req.headers['x-closeos-signature'], req.body, SECRET)).toBe(true);
    expect(d).toMatchObject({ status: 'succeeded', attempts: 1, last_status_code: 200 });
    expect(await hooks.dispatchDue()).toEqual({ sent: 0, retried: 0, failed: 0 }); // rien de dû
  });

  it('reprogramme après une erreur, abandonne après la 5e', async () => {
    fake.outboundStatus = () => 503;
    const d = delivery(endpoint());
    expect(await hooks.dispatchDue()).toEqual({ sent: 0, retried: 1, failed: 0 });
    expect(d).toMatchObject({ status: 'pending', attempts: 1, last_status_code: 503, last_error: 'HTTP 503' });
    Object.assign(d, { attempts: 4, next_attempt_at: new Date(Date.now() - 1).toISOString() });
    expect(await hooks.dispatchDue()).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(d.status).toBe('failed');
  });

  it("n'envoie jamais vers le réseau interne, ni vers une adresse désactivée", async () => {
    const priv = delivery(endpoint({ url: 'https://10.0.0.5/hook' }));
    const off = delivery(endpoint({ active: false }));
    await hooks.dispatchDue();
    expect(fake.outbound).toHaveLength(0);
    expect(priv.last_error).toMatch(/adresse réseau non autorisée/);
    expect(off).toMatchObject({ status: 'failed', last_error: 'adresse désactivée' });
  });
});

type Call = { method?: string; path: string; body?: any; key?: string };
async function call({ method = 'GET', path, body, key = KEY }: Call) {
  const res = fakeRes();
  await api(fakeReq({ method, headers: { authorization: `Bearer ${key}` }, query: { path }, body }), res);
  return res;
}

describe('routes /webhooks', () => {
  it('enregistre, liste et supprime une adresse', async () => {
    const r = await call({ method: 'POST', path: 'webhooks', body: { url: HOOK, events: ['signer.signed', 'contract.certified'], description: 'SaaS prod' } });
    expect(r.statusCode).toBe(201);
    expect(r.body).toMatchObject({ url: HOOK, events: ['signer.signed', 'contract.certified'], active: true });
    const all = await call({ method: 'POST', path: 'webhooks', body: { url: HOOK } });
    expect(all.body.events).toEqual(hooks.WEBHOOK_EVENTS);
    const list = await call({ path: 'webhooks' });
    expect(list.body.data).toHaveLength(2);
    expect(list.body.events_available).toContain('contract.expired');
    const del = await call({ method: 'DELETE', path: `webhooks/${r.body.id}` });
    expect(del.body).toEqual({ id: r.body.id, deleted: true });
    expect((await call({ method: 'DELETE', path: `webhooks/${r.body.id}` })).statusCode).toBe(404);
  });

  it('refuse une adresse non https, privée, un événement inconnu, plus de 10 adresses', async () => {
    expect((await call({ method: 'POST', path: 'webhooks', body: { url: 'http://93.184.216.34/x' } })).body.error.code).toBe('invalid_url');
    expect((await call({ method: 'POST', path: 'webhooks', body: { url: 'https://127.0.0.1/x' } })).body.error.code).toBe('invalid_url');
    const bad = await call({ method: 'POST', path: 'webhooks', body: { url: HOOK, events: ['contract.signed'] } });
    expect(bad.statusCode).toBe(400);
    expect(bad.body.error.details.available).toContain('signer.signed');
    for (let i = 0; i < 10; i++) endpoint();
    expect((await call({ method: 'POST', path: 'webhooks', body: { url: HOOK } })).body.error.code).toBe('too_many_endpoints');
  });

  it('envoie un événement de test signé et le journalise', async () => {
    const ep = endpoint();
    const r = await call({ method: 'POST', path: `webhooks/${ep.id}/test` });
    expect(r.body).toMatchObject({ delivered: true, status_code: 200 });
    const [req] = fake.outbound;
    expect(JSON.parse(req.body).event).toBe('webhook.test');
    expect(verify(req.headers['x-closeos-signature'], req.body, SECRET)).toBe(true);
    fake.outboundStatus = () => 500;
    const ko = await call({ method: 'POST', path: `webhooks/${ep.id}/test` });
    expect(ko.body).toMatchObject({ delivered: false, status_code: 500, error: 'HTTP 500' });
    const log = await call({ path: `webhooks/${ep.id}/deliveries` });
    expect(log.body.data.map((d: any) => d.status).sort()).toEqual(['failed', 'succeeded']);
    expect((await call({ path: `webhooks/${ep.id}/deliveries`, method: 'GET' })).statusCode).toBe(200);
  });

  it('fait tourner le secret : renvoyé une fois, ancien valable 24 h', async () => {
    const r = await call({ method: 'POST', path: 'webhooks/secret/rotate' });
    expect(r.statusCode).toBe(200);
    expect(r.body.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(Date.parse(r.body.previous_secret_valid_until) - Date.now()).toBeGreaterThan(23.9 * 3600_000);
    expect(platform).toMatchObject({ webhook_secret: r.body.secret, webhook_secret_previous: SECRET });
  });

  it("cloisonne par plateforme et exige le scope webhooks:write", async () => {
    const other = fake.seed('sign_platforms', { name: 'Autre', api_key_hash: sha('x'), api_key_hint: 'x' });
    const foreign = endpoint({ platform_id: other.id });
    expect((await call({ method: 'POST', path: `webhooks/${foreign.id}/test` })).statusCode).toBe(404);
    expect((await call({ path: `webhooks/${foreign.id}/deliveries` })).statusCode).toBe(404);
    expect(fake.outbound).toHaveLength(0);
    platform.scopes = ['contracts:read'];
    expect((await call({ path: 'webhooks' })).statusCode).toBe(403);
  });
});

describe('api/sign-internal.ts ?action=webhooks', () => {
  const run = async (method: string, headers: Record<string, string>) => {
    const res = fakeRes();
    await internal(fakeReq({ method, headers, query: { action: 'webhooks' } }), res);
    return res;
  };
  it('refuse sans secret, accepte la tâche planifiée et le réveil interne', async () => {
    expect((await run('GET', {})).statusCode).toBe(401);
    expect((await run('GET', { authorization: 'Bearer faux' })).statusCode).toBe(401);
    delivery(endpoint());
    const cron = await run('GET', { authorization: 'Bearer cron-secret' });
    expect(cron.body).toMatchObject({ ok: true, expired: 0, sent: 1 });
    const kick = await run('POST', { 'x-closeos-internal': 'i'.repeat(40) });
    expect(kick.body).toMatchObject({ ok: true, sent: 0 });
    expect(fake.calls.some((c) => c.url.pathname.endsWith('/rpc/sign_log_expired_links'))).toBe(true);
  });
});
