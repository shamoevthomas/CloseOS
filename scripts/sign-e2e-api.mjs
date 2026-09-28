#!/usr/bin/env node
/**
 * Parcours de bout en bout de l'API Sign, comme le ferait le SaaS BTP, contre un déploiement réel.
 *
 *   SIGN_API_BASE=https://<preview>.vercel.app SIGN_API_KEY_FILE=./cle.txt SIGNER_EMAIL=moi@exemple.fr \
 *     node scripts/sign-e2e-api.mjs
 *
 * Crée un artisan de test, un devis PDF de 2 pages (portrait + paysage), un signataire avec
 * vérification email, envoie (un vrai email part à SIGNER_EMAIL), puis vérifie statut, journal,
 * documents, nouveau lien, déblocage, idempotence et cloisonnement. Affiche l'id du contrat et le
 * lien de signature pour finir le parcours à la main (signature, puis PDF signé et certificat).
 * Options : VERCEL_BYPASS (jeton de contournement de la protection des Previews).
 */
import { readFileSync } from 'node:fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'

const base = (process.env.SIGN_API_BASE || '').replace(/\/+$/, '') + '/api/sign/v1'
const key = readFileSync(process.env.SIGN_API_KEY_FILE || '', 'utf8').trim()
const signerEmail = process.env.SIGNER_EMAIL || ''
if (!process.env.SIGN_API_BASE || !key || !signerEmail) { console.error('SIGN_API_BASE, SIGN_API_KEY_FILE et SIGNER_EMAIL requis.'); process.exit(1) }

let failures = 0
const ok = (cond, label) => { console.log(`${cond ? '✅' : '❌'} ${label}`); if (!cond) failures++ }

async function call(method, path, { body, account, headers = {}, auth = key, redirect = 'follow' } = {}) {
  const h = { 'content-type': 'application/json', ...headers }
  if (auth) h.authorization = `Bearer ${auth}`
  if (account) h['x-sign-account'] = account
  if (process.env.VERCEL_BYPASS) h['x-vercel-protection-bypass'] = process.env.VERCEL_BYPASS
  const r = await fetch(`${base}/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined, redirect })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* pas du JSON */ }
  return { status: r.status, body: json, headers: r.headers, text }
}

async function devisPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1 = doc.addPage([595.28, 841.89])
  p1.drawText('DEVIS n° E2E — Rénovation salle de bain', { x: 50, y: 780, size: 16, font })
  p1.drawText('Plomberie Dupont — test API CloseOS Sign', { x: 50, y: 750, size: 11, font })
  p1.drawText('Bon pour accord, signature du client :', { x: 330, y: 170, size: 10, font })
  const p2 = doc.addPage([841.89, 595.28])
  p2.drawText('Annexe (page paysage) — date :', { x: 50, y: 300, size: 12, font })
  return Buffer.from(await doc.save()).toString('base64')
}

const run = Date.now().toString(36)
console.log(`API : ${base}\n`)

const spec = await call('GET', 'openapi.json', { auth: null })
ok(spec.status === 200 && spec.body?.openapi === '3.1.0', 'openapi.json public')
ok((await call('POST', 'accounts', { body: { external_ref: 'x' }, auth: 'sk_sign_' + '0'.repeat(64) })).status === 401, 'clé inconnue refusée (401)')

const acc = await call('POST', 'accounts', { body: { external_ref: `e2e-${run}`, name: 'Jean Dupont (test)', company: 'Plomberie Dupont (test)', email: signerEmail } })
ok(acc.status === 201, `artisan créé (${acc.body?.id})`)
const again = await call('POST', 'accounts', { body: { external_ref: `e2e-${run}` } })
ok(again.status === 200 && again.body?.id === acc.body?.id, 'création idempotente sur external_ref')
const account = acc.body.id

const idem = { 'idempotency-key': `e2e-${run}-contract` }
const created = await call('POST', 'contracts', {
  account, headers: idem,
  body: {
    title: `Devis E2E ${run}`, pdf_base64: await devisPdf(), verification_method: 'email',
    signers: [{ name: 'Client Test', email: signerEmail }],
    fields: [{ type: 'signature', page: 1, x_pct: 0.55, y_pct: 0.8 }, { type: 'date', page: 2, x_pct: 0.35, y_pct: 0.45 }],
  },
})
ok(created.status === 201, `contrat créé (${created.body?.id})`)
ok(created.body?.pages?.[1]?.height_px === 561, 'page paysage à sa hauteur réelle')
const replay = await call('POST', 'contracts', { account, headers: idem, body: { title: 'ignoré', pdf_base64: 'x' } })
ok(replay.headers.get('idempotent-replayed') === 'true' && replay.body?.id === created.body?.id, 'Idempotency-Key rejouée')
const cid = created.body.id

const other = await call('POST', 'accounts', { body: { external_ref: `e2e-${run}-autre` } })
ok((await call('GET', `contracts/${cid}`, { account: other.body.id })).status === 404, "contrat invisible pour un autre artisan")

const orig = await call('GET', `contracts/${cid}/document`, { account })
ok(orig.status === 200 && orig.body?.type === 'original', 'PDF original téléchargeable')
if (orig.status === 200) ok((await fetch(orig.body.url)).status === 200, 'URL signée du PDF original valide')
ok((await call('GET', `contracts/${cid}/certificate`, { account })).status === 409, 'certificat pas encore disponible (409)')

const sent = await call('POST', `contracts/${cid}/send`, { account, body: {} })
ok(sent.status === 200 && sent.body?.status === 'sent', 'contrat envoyé')
ok(sent.body?.notifications?.[0]?.notified === true, `invitation envoyée à ${signerEmail}`)
const signer = sent.body?.signers?.[0]
ok(!!signer?.link_expires_at, `lien valable jusqu'au ${signer?.link_expires_at}`)

const status = await call('GET', `contracts/${cid}`, { account })
ok(status.body?.signers?.[0]?.status === 'sent', 'statut signataire : sent')
const events = await call('GET', `contracts/${cid}/events`, { account })
ok(events.body?.data?.some((e) => e.type === 'sent'), 'journal : événement sent')
ok((await call('POST', `contracts/${cid}/signers/${signer.id}/unlock`, { account })).status === 200, 'déblocage accepté')
// Nouveau lien renvoyé par email : c'est le DERNIER email reçu qui fait foi pour signer.
const renewed = await call('POST', `contracts/${cid}/signers/${signer.id}/renew-link`, { account, body: {} })
ok(renewed.status === 200 && renewed.body?.url && renewed.body.url !== signer.sign_url, 'nouveau lien émis (ancien invalidé)')
ok(renewed.body?.notified === true, 'nouveau lien renvoyé par email')

console.log(`\nContrat : ${cid}\nCompte artisan : ${account}\nLien de signature : ${renewed.body?.url}`)
console.log('Suite à la main : signer via le DERNIER email reçu (code reçu par email), puis')
console.log(`  GET ${base}/contracts/${cid}            → status signed`)
console.log(`  GET ${base}/contracts/${cid}/document   → type signed`)
console.log(`  GET ${base}/contracts/${cid}/certificate`)
console.log(failures ? `\n${failures} échec(s).` : '\nTout est vert.')
process.exit(failures ? 1 : 0)
