// Doublures communes aux tests des handlers Vercel : requête/réponse et faux PostgREST.
import { vi } from 'vitest';

export interface FakeRes {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  status(code: number): FakeRes;
  json(b: any): FakeRes;
  send(b: any): FakeRes;
  end(): FakeRes;
  setHeader(k: string, v: string): void;
}

export function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) { res.statusCode = code; return res; },
    json(b) { res.body = b; return res; },
    send(b) { res.body = b; return res; },
    end() { return res; },
    setHeader(k, v) { res.headers[k.toLowerCase()] = v; },
  };
  return res;
}

export function fakeReq(init: { method?: string; headers?: Record<string, string>; query?: Record<string, string>; body?: any }) {
  return { method: init.method ?? 'POST', headers: init.headers ?? {}, query: init.query ?? {}, body: init.body };
}

type Route = (url: URL, init: RequestInit) => unknown | undefined;

/**
 * Remplace fetch global : chaque route reçoit l'URL et renvoie un corps JSON (réponse 200),
 * `{ __status, __body }` pour un autre statut, ou undefined pour passer à la suivante.
 * Toutes les requêtes sont gardées dans `calls` pour vérifier ce qui a été (ou non) appelé.
 */
export function mockFetch(routes: Route[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fn = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    for (const r of routes) {
      const out = r(url, init);
      if (out === undefined) continue;
      const o = out as any;
      const status = o && typeof o === 'object' && '__status' in o ? o.__status : 200;
      const body = o && typeof o === 'object' && '__status' in o ? o.__body : out;
      return new Response(JSON.stringify(body ?? null), { status, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`fetch inattendu : ${init.method ?? 'GET'} ${url}`);
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}
