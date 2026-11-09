// Synchronisation des prospects d'un compte Business vers sa liste Brevo (clé API du client).
// Utilisée par api/business-emailing.ts (bouton « Synchroniser ») et par api/cron/emailing-sync.ts (auto).

import type { SupabaseClient } from '@supabase/supabase-js'
import { prospectNames } from '../../src/lib/businessEmailTemplate.js'

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/

export async function brevoFetch(apiKey: string, path: string, init: { method?: string; body?: any } = {}) {
  const r = await fetch(`https://api.brevo.com/v3${path}`, {
    method: init.method || 'GET',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const text = await r.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  return { ok: r.ok, status: r.status, data }
}

export async function listBrevoLists(apiKey: string) {
  const out: { id: number; name: string; count: number }[] = []
  for (let offset = 0; offset < 1000; offset += 50) {
    const { ok, status, data } = await brevoFetch(apiKey, `/contacts/lists?limit=50&offset=${offset}`)
    if (!ok) throw new Error(status === 401 ? 'Clé API Brevo refusée' : `Brevo ${status} : ${data?.message || 'erreur'}`)
    const lists = data?.lists || []
    lists.forEach((l: any) => out.push({ id: l.id, name: l.name, count: l.uniqueSubscribers ?? l.totalSubscribers ?? 0 }))
    if (lists.length < 50) break
  }
  return out
}

/** Contacts du CRM (email valide, dédoublonnés, hors désinscrits). `since` = seulement les prospects créés depuis. */
export async function crmContacts(supabase: SupabaseClient, ownerId: string, since?: string | null) {
  const rows: any[] = []
  for (let from = 0; from < 50000; from += 1000) {
    let q = supabase
      .from('business_prospects')
      .select('id, email, contact, firstName, lastName, phone, stage, created_at')
      .eq('user_id', ownerId)
      .not('email', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (since) q = q.gte('created_at', since)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const { data: unsubs } = await supabase.from('business_email_unsubscribes').select('email').eq('owner_id', ownerId)
  const blocked = new Set((unsubs || []).map((u: any) => String(u.email).toLowerCase()))
  const seen = new Set<string>()
  const out: { email: string; prenom: string; nom: string; phone: string; stage: string; created_at: string }[] = []
  for (const p of rows) {
    const email = String(p.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email) || seen.has(email) || blocked.has(email)) continue
    seen.add(email)
    const { prenom, nom } = prospectNames(p)
    out.push({ email, prenom, nom, phone: p.phone || '', stage: p.stage, created_at: p.created_at })
  }
  return out
}

/** Envoie les contacts dans la liste Brevo. Met à jour l'état de l'intégration. */
export async function syncOwnerToBrevo(supabase: SupabaseClient, ownerId: string, opts: { full?: boolean } = {}) {
  const { data: integ } = await supabase.from('business_email_integrations').select('*').eq('owner_id', ownerId).maybeSingle()
  if (!integ?.api_key || !integ?.list_id) throw new Error('Brevo non configuré (clé API et liste requises)')
  const startedAt = new Date().toISOString()
  const since = opts.full ? null : integ.last_sync_at
  try {
    const contacts = await crmContacts(supabase, ownerId, since)
    for (let i = 0; i < contacts.length; i += 2000) {
      const chunk = contacts.slice(i, i + 2000)
      const { ok, status, data } = await brevoFetch(integ.api_key, '/contacts/import', {
        method: 'POST',
        body: {
          listIds: [Number(integ.list_id)],
          updateExistingContacts: true,
          emptyContactsAttributes: false,
          jsonBody: chunk.map((c) => ({ email: c.email, attributes: { FIRSTNAME: c.prenom, LASTNAME: c.nom } })),
        },
      })
      if (!ok) throw new Error(`Brevo ${status} : ${data?.message || 'import refusé'}`)
    }
    await supabase.from('business_email_integrations').update({
      last_sync_at: startedAt, last_sync_count: contacts.length, last_error: null, updated_at: new Date().toISOString(),
    }).eq('owner_id', ownerId)
    return { count: contacts.length }
  } catch (e: any) {
    await supabase.from('business_email_integrations').update({ last_error: String(e?.message || e).slice(0, 500), updated_at: new Date().toISOString() }).eq('owner_id', ownerId)
    throw e
  }
}
