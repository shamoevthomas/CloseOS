// Base Postgres jetable pour tester les migrations Sign (jamais la production).
// Démarrer un Postgres local puis : SIGN_TEST_PG=postgres://postgres@localhost:54329 npm test
// Sans base joignable, les tests SQL sont ignorés (describe.skipIf).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ADMIN_URL = process.env.SIGN_TEST_PG ?? 'postgres://postgres@localhost:54329/postgres';
const root = resolve(import.meta.dirname, '../..');
const sql = (path: string) => readFileSync(resolve(root, path), 'utf8');

export const STUBS = 'supabase/tests/supabase-stubs.sql';
export const BASELINE = 'supabase/migrations/20260927_sign_baseline.sql';
export const SECURITY = 'supabase/migrations/20260927_sign_security.sql';

export async function pgAvailable(): Promise<boolean> {
  const c = new pg.Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}

/** Crée une base vide, y applique les fichiers SQL donnés, et renvoie un client connecté. */
export async function freshDb(files: string[]): Promise<pg.Client> {
  const name = `sign_t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  for (const f of files) await client.query(sql(f));
  return client;
}

export async function applyFile(client: pg.Client, file: string) {
  await client.query(sql(file));
}

type Role = 'anon' | 'authenticated' | 'service_role';

/**
 * Exécute `fn` comme le ferait PostgREST : rôle Postgres + claims JWT posés dans une transaction,
 * annulée ensuite (sauf `commit: true`). Renvoie le résultat ou l'erreur levée.
 */
export async function as<T>(
  client: pg.Client,
  role: Role,
  sub: string | null,
  fn: (c: pg.Client) => Promise<T>,
  opts: { commit?: boolean } = {},
): Promise<T> {
  await client.query('begin');
  try {
    await client.query(`set local role ${role}`);
    const claims = JSON.stringify({ role, ...(sub ? { sub } : {}) });
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    const out = await fn(client);
    await client.query(opts.commit ? 'commit' : 'rollback');
    return out;
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
}

/** Crée un propriétaire Sign (auth.users + sign_users) en superutilisateur. */
export async function seedOwner(client: pg.Client, email: string, extra: Record<string, unknown> = {}) {
  const { rows } = await client.query(`insert into auth.users (email) values ($1) returning id`, [email]);
  const id = rows[0].id as string;
  const cols = ['id', 'email', ...Object.keys(extra)];
  const vals = [id, email, ...Object.values(extra)];
  await client.query(
    `insert into sign_users (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
    vals,
  );
  return id;
}

export async function seedTemplate(client: pg.Client, ownerId: string) {
  const { rows } = await client.query(
    `insert into sign_contracts (user_id, title, is_template, content_html, status) values ($1, 'Modèle', true, '<p>secret</p>', 'draft') returning id`,
    [ownerId],
  );
  return rows[0].id as string;
}
