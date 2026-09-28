#!/usr/bin/env node
/**
 * Crée une plateforme partenaire de l'API CloseOS Sign (ou renouvelle sa clé) et délivre sa clé API.
 * La clé n'est stockée qu'en SHA-256 : elle est affichée UNE fois (ou écrite dans --out, droits 600).
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/sign-create-platform.mjs --name "SaaS BTP"
 *   … node scripts/sign-create-platform.mjs --rotate <platform_id> --out ./cle.txt
 *
 * Options : --name <nom> | --rotate <id> ; --scopes a,b,c ; --out <fichier>.
 */
import { createHash, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!url || !service) { console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.'); process.exit(1) }
const name = opt('name')
const rotate = opt('rotate')
if (!name === !rotate) { console.error('Donner --name <nom> (création) ou --rotate <platform_id>.'); process.exit(1) }

const key = `sk_sign_${randomBytes(32).toString('hex')}`
const row = {
  api_key_hash: createHash('sha256').update(key).digest('hex'),
  api_key_hint: `${key.slice(0, 12)}…${key.slice(-4)}`,
}
const scopes = opt('scopes')
if (scopes) row.scopes = scopes.split(',').map((s) => s.trim()).filter(Boolean)

const headers = { apikey: service, Authorization: `Bearer ${service}`, 'content-type': 'application/json', Prefer: 'return=representation' }
const r = rotate
  ? await fetch(`${url}/rest/v1/sign_platforms?id=eq.${encodeURIComponent(rotate)}`, { method: 'PATCH', headers, body: JSON.stringify(row) })
  : await fetch(`${url}/rest/v1/sign_platforms`, { method: 'POST', headers, body: JSON.stringify({ ...row, name, webhook_secret: `whsec_${randomBytes(32).toString('hex')}` }) })
if (!r.ok) { console.error(`Échec (${r.status}) : ${await r.text()}`); process.exit(1) }
const [p] = await r.json()
if (!p) { console.error('Plateforme introuvable.'); process.exit(1) }

console.log(`Plateforme ${p.name} (${p.id}) — scopes : ${p.scopes.join(', ')} — clé ${p.api_key_hint}`)
const out = opt('out')
if (out) {
  writeFileSync(out, `${key}\n`, { mode: 0o600 })
  console.log(`Clé écrite dans ${out} (droits 600).`)
} else {
  console.log(`\nClé API (affichée une seule fois, à conserver dans le coffre du SaaS) :\n${key}\n`)
}
if (rotate) console.log("L'ancienne clé ne fonctionne plus.")
