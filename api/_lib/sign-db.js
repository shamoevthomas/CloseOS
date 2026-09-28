// CloseOS Sign — accès Supabase côté serveur (REST, Storage, Auth admin) par fetch, sans dépendance
// npm : partagé par api/mcp.js (qui ne doit rien bundler) et api/sign-v1.js. Clé service_role :
// chaque appelant filtre lui-même par propriétaire (user_id).

const url = () => (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
const key = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

export class SignDbError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'SignDbError'
    this.status = status
    this.body = body
  }
}

function headers(extra) {
  const k = key()
  return { apikey: k, Authorization: `Bearer ${k}`, 'content-type': 'application/json', ...(extra || {}) }
}
function ensureConfig() {
  if (!url() || !key()) throw new SignDbError('Configuration serveur incomplète (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquant).', 500)
}
async function fail(label, r) {
  const text = await r.text()
  throw new SignDbError(`${label} (${r.status}) : ${text}`, r.status, text)
}

export async function select(pathAndQuery) {
  ensureConfig()
  const r = await fetch(`${url()}/rest/v1/${pathAndQuery}`, { headers: headers() })
  if (!r.ok) await fail('Supabase lecture', r)
  return await r.json()
}

export async function insert(table, rows, returnRep) {
  ensureConfig()
  const r = await fetch(`${url()}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: returnRep ? 'return=representation' : 'return=minimal' }),
    body: JSON.stringify(rows),
  })
  if (!r.ok) await fail('Supabase insert', r)
  return returnRep ? await r.json() : null
}

export async function update(table, query, patch, returnRep) {
  ensureConfig()
  const r = await fetch(`${url()}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: headers({ Prefer: returnRep ? 'return=representation' : 'return=minimal' }),
    body: JSON.stringify(patch),
  })
  if (!r.ok) await fail('Supabase update', r)
  return returnRep ? await r.json() : null
}

export async function remove(table, query) {
  ensureConfig()
  const r = await fetch(`${url()}/rest/v1/${table}?${query}`, { method: 'DELETE', headers: headers({ Prefer: 'return=minimal' }) })
  if (!r.ok) await fail('Supabase delete', r)
}

export async function rpc(fn, args) {
  ensureConfig()
  const r = await fetch(`${url()}/rest/v1/rpc/${fn}`, { method: 'POST', headers: headers(), body: JSON.stringify(args || {}) })
  if (!r.ok) await fail(`Supabase rpc ${fn}`, r)
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

// ───────── Storage (bucket privé sign-documents) ─────────

export async function storageUpload(bucket, path, bytes, contentType) {
  ensureConfig()
  const r = await fetch(`${url()}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { apikey: key(), Authorization: `Bearer ${key()}`, 'content-type': contentType, 'x-upsert': 'true' },
    body: bytes,
  })
  if (!r.ok) await fail('Storage upload', r)
}

/** URL signée temporaire (secondes), ou null si le fichier n'existe pas. */
export async function storageSignedUrl(bucket, path, expiresIn) {
  ensureConfig()
  const r = await fetch(`${url()}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ expiresIn }),
  })
  if (r.status === 400 || r.status === 404) return null
  if (!r.ok) await fail('Storage URL signée', r)
  const j = await r.json()
  const signed = j.signedURL || j.signedUrl
  if (!signed) return null
  return signed.startsWith('http') ? signed : `${url()}/storage/v1${signed}`
}

/** Octets d'un fichier, ou null s'il n'existe pas. */
export async function storageDownload(bucket, path) {
  ensureConfig()
  const r = await fetch(`${url()}/storage/v1/object/${bucket}/${path}`, { headers: { apikey: key(), Authorization: `Bearer ${key()}` } })
  if (r.status === 400 || r.status === 404) return null
  if (!r.ok) await fail('Storage téléchargement', r)
  return Buffer.from(await r.arrayBuffer())
}

/** Noms des fichiers d'un dossier (un niveau). */
export async function storageList(bucket, prefix) {
  ensureConfig()
  const r = await fetch(`${url()}/storage/v1/object/list/${bucket}`, { method: 'POST', headers: headers(), body: JSON.stringify({ prefix, limit: 1000, offset: 0 }) })
  if (!r.ok) await fail('Storage liste', r)
  return ((await r.json()) || []).map((o) => o.name).filter(Boolean)
}

export async function storageRemove(bucket, paths) {
  ensureConfig()
  const r = await fetch(`${url()}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: headers(), body: JSON.stringify({ prefixes: paths }) })
  if (!r.ok && r.status !== 404) await fail('Storage suppression', r)
}

// ───────── Auth admin (comptes techniques des artisans) ─────────

export async function adminCreateUser(payload) {
  ensureConfig()
  const r = await fetch(`${url()}/auth/v1/admin/users`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) })
  if (!r.ok) await fail('Auth admin création', r)
  return await r.json()
}

export async function adminDeleteUser(id) {
  ensureConfig()
  const r = await fetch(`${url()}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: headers() })
  if (!r.ok && r.status !== 404) await fail('Auth admin suppression', r)
}
