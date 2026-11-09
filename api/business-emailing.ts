// Page Emailing de CloseOS Business.
//
//   POST ?action=send              { owner_id?, subject, mode, content, prospect_ids[] }  → envoi via le Brevo de CloseOS
//   POST ?action=test              { owner_id?, subject, mode, content }                  → envoi d'essai à soi-même
//   GET  ?action=integration       (owner_id?)                                            → état de la synchro Brevo
//   POST ?action=integration-save  { owner_id?, api_key?, list_id?, list_name?, auto_sync? }
//   POST ?action=integration-delete
//   POST ?action=brevo-lists       { owner_id?, api_key? }                                → listes du compte Brevo du client
//   POST ?action=sync              { owner_id?, full? }                                   → pousse les contacts du CRM
//   GET  ?action=contacts&key=cos_…[&format=csv][&since=ISO]                              → API contacts (clé API Business)
//   GET  ?action=unsubscribe&o=…&e=…&s=…                                                  → lien de désinscription
//
// Accès (sauf contacts / unsubscribe) : JWT Supabase du propriétaire, ou d'un Head of Sales / Admin de son équipe.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { renderEmail, prospectNames, escapeHtml, EMAILING_MAX_RECIPIENTS, EMAILING_DAILY_LIMIT, parisDayStartISO, type EmailMode } from '../src/lib/businessEmailTemplate.js'
import { brevoFetch, listBrevoLists, crmContacts, syncOwnerToBrevo } from './_lib/emailing-sync.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY || ''
const UNSUB_SECRET = process.env.EMAILING_UNSUB_SECRET || supabaseServiceKey
const SENDER_EMAIL = 'support@closeos.fr'
const MAX_CONTENT = 200_000
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/

function baseUrl(req: VercelRequest) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'www.closeos.fr').split(',')[0].trim()
  const proto = /^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https'
  return `${proto}://${host}`
}

function unsubSig(ownerId: string, email: string) {
  return createHmac('sha256', UNSUB_SECRET).update(`${ownerId}|${email.toLowerCase()}`).digest('hex').slice(0, 32)
}

function unsubUrl(req: VercelRequest, ownerId: string, email: string) {
  const e = email.toLowerCase()
  return `${baseUrl(req)}/api/business-emailing?action=unsubscribe&o=${encodeURIComponent(ownerId)}&e=${encodeURIComponent(e)}&s=${unsubSig(ownerId, e)}`
}

/** Utilisateur appelant (JWT) → id du compte propriétaire qu'il a le droit de gérer. */
async function resolveOwner(supabase: SupabaseClient, req: VercelRequest): Promise<{ uid: string; ownerId: string; email: string | null } | { error: string; status: number }> {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { error: 'Non connecté', status: 401 }
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { error: 'Session invalide', status: 401 }
  const uid = data.user.id
  const requested = String((req.query.owner_id as string) || (req.body?.owner_id as string) || '').trim()
  if (!requested || requested === uid) {
    const { data: owner } = await supabase.from('business_users').select('id').eq('id', uid).maybeSingle()
    if (owner) return { uid, ownerId: uid, email: data.user.email || null }
  }
  let q = supabase.from('business_team_members').select('business_owner_id, role').eq('user_id', uid).in('role', ['Head of Sales', 'Admin'])
  if (requested) q = q.eq('business_owner_id', requested)
  const { data: tm } = await q.limit(1).maybeSingle()
  if (tm?.business_owner_id) return { uid, ownerId: tm.business_owner_id, email: data.user.email || null }
  return { error: 'Accès réservé au propriétaire du compte (ou Head of Sales / Admin)', status: 403 }
}

async function senderFor(supabase: SupabaseClient, ownerId: string) {
  const [{ data: settings }, { data: owner }] = await Promise.all([
    supabase.from('business_settings').select('company_name').eq('user_id', ownerId).maybeSingle(),
    supabase.from('business_users').select('full_name, email').eq('id', ownerId).maybeSingle(),
  ])
  const name = String(settings?.company_name || owner?.full_name || 'CloseOS Business').slice(0, 70)
  return { name, replyTo: owner?.email && EMAIL_RE.test(owner.email) ? owner.email : null }
}

async function sendOne(opts: { to: string; toName: string; subject: string; html: string; senderName: string; replyTo: string | null; unsubscribe?: string }) {
  const body: any = {
    sender: { name: opts.senderName, email: SENDER_EMAIL },
    to: [{ email: opts.to, ...(opts.toName ? { name: opts.toName } : {}) }],
    subject: opts.subject,
    htmlContent: opts.html,
    tags: ['business-emailing'],
  }
  if (opts.replyTo) body.replyTo = { email: opts.replyTo, name: opts.senderName }
  if (opts.unsubscribe) body.headers = { 'List-Unsubscribe': `<${opts.unsubscribe}>` }
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': BREVO_API_KEY },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

function validateMessage(b: any): { subject: string; mode: EmailMode; content: string } | { error: string } {
  const subject = String(b?.subject || '').trim()
  const mode: EmailMode = b?.mode === 'html' ? 'html' : 'text'
  const content = String(b?.content || '')
  if (!subject) return { error: "L'objet est obligatoire" }
  if (subject.length > 200) return { error: 'Objet trop long (200 caractères max)' }
  if (!content.trim()) return { error: 'Le contenu est vide' }
  if (content.length > MAX_CONTENT) return { error: 'Contenu trop long' }
  return { subject, mode, content }
}

/** Emails réellement envoyés aujourd'hui (heure de Paris) par ce compte. */
async function sentToday(supabase: SupabaseClient, ownerId: string): Promise<number> {
  const { data } = await supabase.from('business_email_campaigns').select('sent_count').eq('owner_id', ownerId).gte('created_at', parisDayStartISO())
  return (data || []).reduce((n: number, r: any) => n + (Number(r.sent_count) || 0), 0)
}

function maskKey(k?: string | null) {
  if (!k) return null
  return `${k.slice(0, 8)}…${k.slice(-4)}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // ─── Lien de désinscription (public, signé) ───
    if (action === 'unsubscribe') {
      const o = String(req.query.o || ''), e = String(req.query.e || '').toLowerCase(), s = String(req.query.s || '')
      const expected = unsubSig(o, e)
      const valid = o && e && s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected))
      if (valid) await supabase.from('business_email_unsubscribes').upsert({ owner_id: o, email: e }, { onConflict: 'owner_id,email' })
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.status(valid ? 200 : 400).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Désinscription</title></head>
<body style="margin:0;background:#fbf9f8;font-family:Inter,Helvetica,Arial,sans-serif;color:#1b1c1b;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box">
<div style="background:#fff;border-radius:28px;padding:40px 32px;max-width:420px;text-align:center;box-shadow:0 20px 40px rgba(27,28,27,.05)">
<h1 style="font-family:Manrope,Arial,sans-serif;font-weight:800;font-size:22px;margin:0 0 12px">${valid ? 'Désinscription confirmée' : 'Lien invalide'}</h1>
<p style="margin:0;line-height:1.6;opacity:.75">${valid ? `L'adresse ${escapeHtml(e)} ne recevra plus d'emails de cet expéditeur.` : "Ce lien de désinscription n'est pas valide."}</p></div></body></html>`)
    }

    // ─── API contacts (clé API Business cos_…) : pour brancher Mailchimp, Zapier, Make… ───
    if (action === 'contacts' && req.method === 'GET') {
      const key = String(req.query.key || req.headers['x-api-key'] || '').trim()
      if (!key) return res.status(401).json({ error: 'Clé API manquante (?key=cos_…)' })
      const { data: k } = await supabase.from('business_webhook_keys').select('user_id, is_active').eq('api_key', key).maybeSingle()
      if (!k) return res.status(401).json({ error: 'Clé API inconnue' })
      if (!k.is_active) return res.status(403).json({ error: 'Clé API désactivée' })
      const since = req.query.since ? new Date(String(req.query.since)).toISOString() : null
      const contacts = await crmContacts(supabase, k.user_id, since)
      if (req.query.format === 'csv') {
        const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
        const csv = ['email,prenom,nom,telephone,etape,cree_le', ...contacts.map((c) => [c.email, c.prenom, c.nom, c.phone, c.stage, c.created_at].map(esc).join(','))].join('\n')
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="contacts-closeos.csv"')
        return res.status(200).send('﻿' + csv)
      }
      return res.status(200).json({ count: contacts.length, contacts: contacts.map((c) => ({ email: c.email, first_name: c.prenom, last_name: c.nom, phone: c.phone, stage: c.stage, created_at: c.created_at })) })
    }

    const who = await resolveOwner(supabase, req)
    if ('error' in who) return res.status(who.status).json({ error: who.error })
    const { ownerId, uid } = who

    // ─── Quota du jour ───
    if (action === 'quota' && req.method === 'GET') {
      const sent = await sentToday(supabase, ownerId)
      return res.status(200).json({ limit: EMAILING_DAILY_LIMIT, per_send: EMAILING_MAX_RECIPIENTS, sent, remaining: Math.max(0, EMAILING_DAILY_LIMIT - sent) })
    }

    // ─── Envoi d'essai à soi-même ───
    if (action === 'test' && req.method === 'POST') {
      if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY manquante côté serveur' })
      const m = validateMessage(req.body)
      if ('error' in m) return res.status(400).json(m)
      if (!who.email) return res.status(400).json({ error: 'Adresse du compte introuvable' })
      const sender = await senderFor(supabase, ownerId)
      const { subject, html } = renderEmail({ ...m, senderName: sender.name, vars: { prenom: 'Prénom', nom: 'Nom', email: who.email } })
      await sendOne({ to: who.email, toName: '', subject: `[Test] ${subject}`, html, senderName: sender.name, replyTo: sender.replyTo })
      return res.status(200).json({ ok: true, to: who.email })
    }

    // ─── Envoi réel ───
    if (action === 'send' && req.method === 'POST') {
      if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY manquante côté serveur' })
      const m = validateMessage(req.body)
      if ('error' in m) return res.status(400).json(m)
      const ids: number[] = Array.isArray(req.body?.prospect_ids) ? [...new Set<number>(req.body.prospect_ids.map(Number).filter((n: number) => Number.isFinite(n)))] : []
      if (ids.length === 0) return res.status(400).json({ error: 'Aucun destinataire sélectionné' })
      if (ids.length > EMAILING_MAX_RECIPIENTS) return res.status(400).json({ error: `Maximum ${EMAILING_MAX_RECIPIENTS} destinataires par envoi` })

      // Seulement les prospects de CE compte (jamais d'ids d'un autre compte)
      const { data: rows, error } = await supabase
        .from('business_prospects')
        .select('id, email, contact, firstName, lastName')
        .eq('user_id', ownerId)
        .in('id', ids)
      if (error) return res.status(500).json({ error: error.message })
      const { data: unsubs } = await supabase.from('business_email_unsubscribes').select('email').eq('owner_id', ownerId)
      const blocked = new Set((unsubs || []).map((u: any) => String(u.email).toLowerCase()))
      const seen = new Set<string>()
      const recipients: { email: string; prenom: string; nom: string }[] = []
      let skippedUnsub = 0
      for (const p of rows || []) {
        const email = String(p.email || '').trim().toLowerCase()
        if (!EMAIL_RE.test(email) || seen.has(email)) continue
        seen.add(email)
        if (blocked.has(email)) { skippedUnsub++; continue }
        recipients.push({ email, ...prospectNames(p) })
      }
      if (recipients.length === 0) return res.status(400).json({ error: 'Aucune adresse email valide parmi les destinataires' })

      // Quota : 50 emails par jour et par compte (heure de Paris)
      const already = await sentToday(supabase, ownerId)
      const remaining = Math.max(0, EMAILING_DAILY_LIMIT - already)
      if (remaining === 0) return res.status(429).json({ error: `Limite de ${EMAILING_DAILY_LIMIT} emails par jour atteinte. Réessayez demain.`, remaining })
      if (recipients.length > remaining) return res.status(400).json({ error: `Il vous reste ${remaining} email(s) aujourd'hui (limite ${EMAILING_DAILY_LIMIT} par jour) : réduisez la sélection.`, remaining })

      const sender = await senderFor(supabase, ownerId)
      let sent = 0
      const failures: { email: string; error: string }[] = []
      const queue = [...recipients]
      await Promise.all(Array.from({ length: 6 }, async () => {
        while (queue.length) {
          const r = queue.shift()!
          const unsubscribe = unsubUrl(req, ownerId, r.email)
          const { subject, html } = renderEmail({ ...m, senderName: sender.name, vars: { prenom: r.prenom, nom: r.nom, email: r.email }, unsubscribeUrl: unsubscribe })
          try {
            await sendOne({ to: r.email, toName: [r.prenom, r.nom].filter(Boolean).join(' '), subject, html, senderName: sender.name, replyTo: sender.replyTo, unsubscribe })
            sent++
          } catch (e: any) {
            failures.push({ email: r.email, error: String(e?.message || e).slice(0, 200) })
          }
        }
      }))

      await supabase.from('business_email_campaigns').insert({
        owner_id: ownerId, sent_by: uid, subject: m.subject, mode: m.mode,
        recipients_count: recipients.length, sent_count: sent, failed_count: failures.length, skipped_unsubscribed: skippedUnsub,
      })
      return res.status(200).json({ ok: true, sent, failed: failures.length, failures: failures.slice(0, 10), skipped_unsubscribed: skippedUnsub })
    }

    // ─── Synchronisation Brevo (compte Brevo du client) ───
    if (action === 'integration' && req.method === 'GET') {
      const { data } = await supabase.from('business_email_integrations').select('*').eq('owner_id', ownerId).maybeSingle()
      if (!data) return res.status(200).json({ connected: false })
      return res.status(200).json({
        connected: !!data.api_key, provider: data.provider, key_hint: maskKey(data.api_key), list_id: data.list_id, list_name: data.list_name,
        auto_sync: data.auto_sync, last_sync_at: data.last_sync_at, last_sync_count: data.last_sync_count, last_error: data.last_error,
      })
    }

    if (action === 'brevo-lists' && req.method === 'POST') {
      let apiKey = String(req.body?.api_key || '').trim()
      if (!apiKey) {
        const { data } = await supabase.from('business_email_integrations').select('api_key').eq('owner_id', ownerId).maybeSingle()
        apiKey = data?.api_key || ''
      }
      if (!apiKey) return res.status(400).json({ error: 'Clé API Brevo manquante' })
      const lists = await listBrevoLists(apiKey)
      return res.status(200).json({ lists })
    }

    if (action === 'integration-save' && req.method === 'POST') {
      const b = req.body || {}
      const patch: Record<string, any> = { owner_id: ownerId, provider: 'brevo', updated_at: new Date().toISOString() }
      if (typeof b.api_key === 'string' && b.api_key.trim()) {
        const key = b.api_key.trim()
        const check = await brevoFetch(key, '/account')
        if (!check.ok) return res.status(400).json({ error: check.status === 401 ? 'Clé API Brevo refusée' : `Brevo ${check.status}` })
        patch.api_key = key
        patch.last_error = null
      }
      if (b.list_id !== undefined) patch.list_id = b.list_id ? Number(b.list_id) : null
      if (b.list_name !== undefined) patch.list_name = b.list_name ? String(b.list_name).slice(0, 200) : null
      if (b.auto_sync !== undefined) patch.auto_sync = !!b.auto_sync
      const { error } = await supabase.from('business_email_integrations').upsert(patch, { onConflict: 'owner_id' })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'integration-delete' && req.method === 'POST') {
      await supabase.from('business_email_integrations').delete().eq('owner_id', ownerId)
      return res.status(200).json({ ok: true })
    }

    if (action === 'sync' && req.method === 'POST') {
      const r = await syncOwnerToBrevo(supabase, ownerId, { full: req.body?.full !== false })
      return res.status(200).json({ ok: true, ...r })
    }

    return res.status(404).json({ error: 'Action inconnue' })
  } catch (e: any) {
    console.error('[business-emailing]', action, e)
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
