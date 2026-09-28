// Faux Supabase en mémoire pour tester l'API REST et la couche de service de bout en bout :
// PostgREST (filtres eq/neq/gt/lt/is/ilike/in, select, order, limit), RPC, Storage, Auth admin,
// et Brevo (emails capturés). Remplace fetch global ; rien ne sort sur le réseau.
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';

type Row = Record<string, any>;
export type RpcHandler = (args: any, fake: FakeSupabase) => any;

const DEFAULTS: Record<string, () => Row> = {
  sign_contracts: () => ({ status: 'draft', locked: false, is_template: false, signer_count: 1, signing_order: 'parallel', verification_method: 'none', purge_hold: false, page_count: 1 }),
  sign_contract_signers: () => ({ status: 'pending', verification_locked: false, payment_required: false, payment_status: 'none', inline_values: {} }),
  sign_contract_fields: () => ({ placement: 'free', required: true }),
  sign_users: () => ({ subscription_exempt: false, has_onboarded: false }),
  sign_webhook_endpoints: () => ({ active: true }),
  sign_platforms: () => ({ active: true, scopes: ['accounts:write', 'contracts:write', 'contracts:read'] }),
};
// Contraintes d'unicité reproduites : [table, colonnes, nom de l'index].
const UNIQUE: [string, string[], string][] = [
  ['sign_users', ['platform_id', 'external_ref'], 'sign_users_platform_ref_uniq'],
  ['sign_api_idempotency', ['platform_id', 'key'], 'sign_api_idempotency_pkey'],
  ['sign_contract_signers', ['contract_id', 'signer_index'], 'sign_contract_signers_contract_id_signer_index_key'],
];

function parseValue(v: string): any {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function matches(row: Row, col: string, expr: string): boolean {
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const raw = decodeURIComponent(expr.slice(dot + 1));
  const val = row[col];
  switch (op) {
    case 'eq': return String(val) === raw;
    case 'neq': return String(val) !== raw;
    case 'gt': return Number(val) > Number(raw);
    case 'lt': return Number(val) < Number(raw);
    case 'is': return raw === 'null' ? val == null : val === parseValue(raw);
    case 'ilike': return String(val ?? '').toLowerCase() === raw.toLowerCase();
    case 'in': return raw.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(val));
    default: throw new Error(`opérateur non géré : ${op}`);
  }
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  storage = new Map<string, Buffer>();
  emails: any[] = [];
  users: Row[] = [];
  rpcs: Record<string, RpcHandler> = {};
  calls: { method: string; url: URL; body?: any }[] = [];
  failEmail = false;
  /** Requêtes vers des hôtes tiers (webhooks) et réponse à leur faire. */
  outbound: { url: string; headers: Record<string, string>; body: string }[] = [];
  outboundStatus: (url: string) => number = () => 200;
  /** Appelé avant chaque requête : permet de simuler une écriture concurrente. */
  onRequest?: (method: string, url: URL) => void;

  table(name: string) { return (this.tables[name] ??= []); }

  seed(name: string, row: Row) {
    const full = { id: randomUUID(), created_at: new Date().toISOString(), ...(DEFAULTS[name]?.() ?? {}), ...row };
    this.table(name).push(full);
    return full;
  }

  private filterRows(name: string, params: URLSearchParams) {
    let rows = this.table(name);
    for (const [k, v] of params) {
      if (['select', 'order', 'limit'].includes(k)) continue;
      rows = rows.filter((r) => matches(r, k, v));
    }
    return rows;
  }

  private rest(method: string, url: URL, body: any, prefer: string) {
    const name = url.pathname.replace('/rest/v1/', '');
    if (name.startsWith('rpc/')) {
      const fn = this.rpcs[name.slice(4)];
      if (!fn) return { status: 404, body: { message: `rpc ${name} inconnue` } };
      try { return { status: 200, body: fn(body, this) }; } catch (e: any) { return { status: 400, body: { message: e.message } }; }
    }
    const p = url.searchParams;
    if (method === 'GET') {
      let rows = [...this.filterRows(name, p)];
      const order = p.get('order');
      if (order) {
        const [col, dir] = order.split('.');
        rows.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
      }
      if (p.get('limit')) rows = rows.slice(0, Number(p.get('limit')));
      const sel = p.get('select');
      const out = sel && sel !== '*' ? rows.map((r) => Object.fromEntries(sel.split(',').map((c) => [c, r[c] ?? null]))) : rows;
      return { status: 200, body: JSON.parse(JSON.stringify(out)) };
    }
    if (method === 'POST') {
      const list = Array.isArray(body) ? body : [body];
      const created: Row[] = [];
      for (const r of list) {
        const full = { id: randomUUID(), created_at: new Date().toISOString(), ...(DEFAULTS[name]?.() ?? {}), ...r };
        for (const [t, cols, idx] of UNIQUE) {
          if (t !== name || cols.some((c) => full[c] == null)) continue;
          if (this.table(name).some((x) => cols.every((c) => x[c] === full[c]))) {
            return { status: 409, body: { code: '23505', message: `duplicate key value violates unique constraint "${idx}"` } };
          }
        }
        created.push(full);
      }
      this.table(name).push(...created);
      return { status: 201, body: prefer.includes('representation') ? JSON.parse(JSON.stringify(created)) : null };
    }
    if (method === 'PATCH') {
      const rows = this.filterRows(name, p);
      for (const r of rows) Object.assign(r, body);
      return { status: 200, body: prefer.includes('representation') ? rows : null };
    }
    if (method === 'DELETE') {
      const gone = new Set(this.filterRows(name, p));
      this.tables[name] = this.table(name).filter((r) => !gone.has(r));
      return { status: 204, body: null };
    }
    throw new Error(`méthode ${method}`);
  }

  private storageApi(method: string, url: URL, body: any): { status: number; body: any; raw?: boolean } {
    const path = url.pathname.replace('/storage/v1/object/', '');
    if (path.startsWith('sign/')) {
      const key = path.slice(5);
      if (!this.storage.has(key)) return { status: 400, body: { error: 'not_found' } };
      return { status: 200, body: { signedURL: `/object/sign/${key}?token=signed` } };
    }
    if (path.startsWith('list/')) {
      const bucket = path.slice(5);
      const prefix = `${bucket}/${body.prefix}`;
      const names = [...this.storage.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ name: k.slice(prefix.length) }));
      return { status: 200, body: names };
    }
    if (method === 'GET') {
      const buf = this.storage.get(path);
      return buf ? { status: 200, body: buf, raw: true } : { status: 400, body: { error: 'not_found' } };
    }
    if (method === 'POST') { this.storage.set(path, Buffer.from(body)); return { status: 200, body: { Key: path } }; }
    if (method === 'DELETE') { for (const pfx of body.prefixes) this.storage.delete(`${path}/${pfx}`); return { status: 200, body: [] }; }
    throw new Error(`storage ${method}`);
  }

  install() {
    const fn = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const method = (init.method ?? 'GET').toUpperCase();
      const isJson = typeof init.body === 'string';
      const body = isJson ? JSON.parse(init.body as string) : init.body;
      this.calls.push({ method, url, body });
      this.onRequest?.(method, url);
      const headers = new Headers(init.headers as HeadersInit);
      let out: { status: number; body: any; raw?: boolean };
      if (url.hostname === 'api.brevo.com') {
        if (this.failEmail) out = { status: 500, body: { message: 'brevo down' } };
        else { this.emails.push(body); out = { status: 201, body: { messageId: 'm' } }; }
      } else if (url.pathname.startsWith('/rest/v1/')) {
        out = this.rest(method, url, body, headers.get('prefer') ?? '');
      } else if (url.pathname.startsWith('/storage/v1/object/')) {
        out = this.storageApi(method, url, body);
      } else if (url.pathname === '/auth/v1/admin/users' && method === 'POST') {
        const u = { id: randomUUID(), ...body };
        this.users.push(u);
        out = { status: 200, body: u };
      } else if (url.pathname.startsWith('/auth/v1/admin/users/') && method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        this.users = this.users.filter((u) => u.id !== id);
        out = { status: 200, body: {} };
      } else if (url.hostname !== 'sb.test') {
        const h: Record<string, string> = {};
        headers.forEach((v, k) => { h[k] = v; });
        this.outbound.push({ url: url.toString(), headers: h, body: String(init.body ?? '') });
        return new Response('ok', { status: this.outboundStatus(url.toString()) });
      } else {
        throw new Error(`fetch inattendu : ${method} ${url}`);
      }
      if (out.raw) return new Response(out.body, { status: out.status, headers: { 'content-type': 'application/pdf' } });
      return new Response(out.body == null ? null : JSON.stringify(out.body), { status: out.status, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fn);
    return this;
  }
}
