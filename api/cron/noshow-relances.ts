import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * Relances email automatiques sur le stage "No Show".
 *
 * Échéances (règle produit) :
 *   • relance 1     → delay_days après l'entrée en "No Show"   (noshow_at)
 *   • relances 2..7 → delay_days après l'ENVOI de la relance 1 (noshow_first_relance_at)
 *
 * Les relances 2+ ne s'enchaînent donc pas les unes aux autres, elles se calent
 * toutes sur la première. Tant que la relance 1 n'est pas partie, aucune suivante
 * ne peut l'être.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY || ''
const APP_URL = process.env.VITE_APP_URL || 'https://closeos.fr'

const DAY_MS = 24 * 60 * 60 * 1000

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Le corps est saisi en texte brut : on échappe puis on restitue les sauts de ligne. */
function bodyToHtml(body: string): string {
  return escapeHtml(body).replace(/\r?\n/g, '<br>')
}

function replaceVars(text: string, vars: Record<string, string>): string {
  let out = text
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return out
}

function buildEmailHtml(bodyHtml: string, bookingUrl: string | null): string {
  const cta = bookingUrl
    ? `<div style="text-align:center;margin-top:40px;">
         <a href="${bookingUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;border-radius:48px;padding:16px 32px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;">
           Réserver un créneau
         </a>
       </div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:64px 20px;background-color:#fbf9f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
    <tr><td style="padding-bottom:40px;text-align:center;">
      <span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;color:#111111;">Close</span><span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;color:#a03cf8;">OS</span>
    </td></tr>
    <tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
      <div style="font-family:'Inter',Helvetica,sans-serif;font-size:16px;color:#1b1c1b;line-height:1.6;">${bodyHtml}</div>
      ${cta}
    </td></tr>
    <tr><td style="padding-top:32px;text-align:center;font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#1b1c1b;opacity:0.5;">
      © 2026 CloseOS · <a href="mailto:support@closeos.fr" style="color:inherit;">support@closeos.fr</a>
    </td></tr>
  </table>
</body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Protection du cron (même convention que les autres crons du projet)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = (req.headers['authorization'] || '') as string
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const now = Date.now()

  const summary = { owners: 0, candidates: 0, sent: 0, skipped: 0, failed: 0 }

  try {
    // 1) Toutes les configurations actives, groupées par propriétaire
    const { data: relances, error: relErr } = await supabase
      .from('business_noshow_relances')
      .select('id, business_owner_id, position, delay_days, subject, body, booking_link_id, is_active')
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (relErr) return res.status(500).json({ error: relErr.message })
    if (!relances || relances.length === 0) {
      return res.status(200).json({ ok: true, message: 'Aucune relance configurée', ...summary })
    }

    const byOwner = new Map<string, typeof relances>()
    for (const r of relances) {
      const list = byOwner.get(r.business_owner_id) || []
      list.push(r)
      byOwner.set(r.business_owner_id, list as any)
    }

    // 2) Résolution des liens de booking référencés
    const linkIds = Array.from(new Set(relances.map(r => r.booking_link_id).filter(Boolean)))
    const linkUrlById = new Map<string, string>()
    if (linkIds.length > 0) {
      const { data: links } = await supabase
        .from('business_booking_links')
        .select('id, slug, link')
        .in('id', linkIds as string[])
      for (const l of links || []) {
        linkUrlById.set(l.id, l.slug ? `${APP_URL}/book/${l.slug}` : (l.link || ''))
      }
    }

    for (const [ownerId, ownerRelances] of byOwner) {
      summary.owners++

      // 3) Prospects actuellement en "no show" avec un cycle armé
      const { data: prospects } = await supabase
        .from('business_prospects')
        .select('id, contact, firstName, email, noshow_at, noshow_first_relance_at, noshow_relance_step')
        .eq('user_id', ownerId)
        .eq('stage', 'noshow')
        .not('noshow_at', 'is', null)

      if (!prospects || prospects.length === 0) continue

      const prospectIds = prospects.map(p => p.id)
      const relanceIds = ownerRelances.map(r => r.id)

      // 4) Journal des envois déjà effectués (anti-doublon)
      const { data: logs } = await supabase
        .from('business_noshow_relance_logs')
        .select('relance_id, prospect_id, noshow_at')
        .in('relance_id', relanceIds)
        .in('prospect_id', prospectIds)

      const alreadySent = new Set(
        (logs || []).map(l => `${l.relance_id}|${l.prospect_id}|${new Date(l.noshow_at).getTime()}`),
      )

      for (const prospect of prospects) {
        if (!prospect.email) { summary.skipped++; continue }

        const noshowAt = new Date(prospect.noshow_at).getTime()
        if (!Number.isFinite(noshowAt)) { summary.skipped++; continue }

        const firstRelanceAt = prospect.noshow_first_relance_at
          ? new Date(prospect.noshow_first_relance_at).getTime()
          : null

        for (const relance of ownerRelances) {
          const key = `${relance.id}|${prospect.id}|${noshowAt}`
          if (alreadySent.has(key)) continue

          // Point de départ : le no-show pour la 1re, l'envoi de la 1re pour les suivantes
          let dueFrom: number | null
          if (relance.position === 1) {
            dueFrom = noshowAt
          } else {
            // Sans première relance envoyée, les suivantes restent en attente
            if (firstRelanceAt === null) continue
            dueFrom = firstRelanceAt
          }

          const dueAt = dueFrom + relance.delay_days * DAY_MS
          if (now < dueAt) continue

          summary.candidates++

          const displayName = prospect.firstName || prospect.contact || ''
          const bookingUrl = relance.booking_link_id ? linkUrlById.get(relance.booking_link_id) || null : null
          const vars = { lead_name: displayName, booking_link: bookingUrl || '' }

          const subject = replaceVars(relance.subject || 'On vous a manqué', vars)
          const bodyHtml = replaceVars(bodyToHtml(relance.body || ''), vars)

          try {
            if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY manquante')

            const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: {
                accept: 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email: prospect.email, name: displayName || undefined }],
                subject,
                htmlContent: buildEmailHtml(bodyHtml, bookingUrl),
              }),
            })

            if (!emailRes.ok) {
              const detail = await emailRes.text()
              throw new Error(`Brevo ${emailRes.status}: ${detail.slice(0, 200)}`)
            }

            // Journalise AVANT toute autre écriture : la contrainte d'unicité est
            // le garde-fou anti-doublon si le cron se relance.
            await supabase.from('business_noshow_relance_logs').insert({
              relance_id: relance.id,
              prospect_id: prospect.id,
              noshow_at: prospect.noshow_at,
            })

            const patch: Record<string, any> = {
              noshow_relance_step: Math.max(prospect.noshow_relance_step || 0, relance.position),
            }
            // La 1re relance fixe la référence de temps des suivantes
            if (relance.position === 1 && !prospect.noshow_first_relance_at) {
              const sentAt = new Date().toISOString()
              patch.noshow_first_relance_at = sentAt
              prospect.noshow_first_relance_at = sentAt
            }
            await supabase.from('business_prospects').update(patch).eq('id', prospect.id)

            alreadySent.add(key)
            summary.sent++
          } catch (err: any) {
            summary.failed++
            console.error(`[noshow-relances] prospect ${prospect.id} relance ${relance.position}:`, err?.message)
          }
        }
      }
    }

    return res.status(200).json({ ok: true, ...summary })
  } catch (err: any) {
    console.error('[noshow-relances] erreur:', err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}
