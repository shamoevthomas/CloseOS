import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * Relances email automatiques sur les leads « Incomplet » (stage 'partial').
 *
 * Un lead « Incomplet » a laissé ses coordonnées via capture-partial sans terminer
 * le formulaire de campagne. Dès qu'il complète, son stage passe à 'prospect' :
 * le trigger vide partial_at et la séquence s'arrête d'elle-même.
 *
 * Échéances (même règle que les relances No Show) :
 *   • relance 1     → delay_days après l'entrée en « Incomplet »   (partial_at)
 *   • relances 2..7 → delay_days après l'ENVOI de la relance 1     (partial_first_relance_at)
 *
 * Différence avec le No Show : le bouton pointe vers une CAMPAGNE (/capture/:slug),
 * soit une campagne fixe choisie par le propriétaire, soit celle que le lead a
 * lui-même abandonnée (use_origin_campaign).
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

function buildEmailHtml(bodyHtml: string, campaignUrl: string | null): string {
  const cta = campaignUrl
    ? `<div style="text-align:center;margin-top:40px;">
         <a href="${campaignUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;border-radius:48px;padding:16px 32px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;">
           Terminer mon inscription
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
      .from('business_partial_relances')
      .select('id, business_owner_id, position, delay_days, subject, body, campaign_id, use_origin_campaign, is_active')
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

    // 2) Résolution des campagnes fixes référencées
    const campaignIds = Array.from(new Set(relances.map(r => r.campaign_id).filter(Boolean)))
    const slugByCampaign = new Map<string, string>()
    if (campaignIds.length > 0) {
      const { data: camps } = await supabase
        .from('business_campaigns')
        .select('id, slug')
        .in('id', campaignIds as string[])
      for (const c of camps || []) {
        if (c.slug) slugByCampaign.set(c.id, c.slug)
      }
    }

    for (const [ownerId, ownerRelances] of byOwner) {
      summary.owners++

      // 3) Leads actuellement « Incomplet » avec un cycle armé
      const { data: prospects } = await supabase
        .from('business_prospects')
        .select('id, contact, firstName, email, campaign_id, partial_at, partial_first_relance_at, partial_relance_step')
        .eq('user_id', ownerId)
        .eq('stage', 'partial')
        .not('partial_at', 'is', null)

      if (!prospects || prospects.length === 0) continue

      // 3b) Campagnes d'origine des leads (pour use_origin_campaign)
      const originIds = Array.from(new Set(prospects.map(p => p.campaign_id).filter(Boolean)))
      const missingOrigin = originIds.filter(id => !slugByCampaign.has(id as string))
      if (missingOrigin.length > 0) {
        const { data: camps } = await supabase
          .from('business_campaigns')
          .select('id, slug')
          .in('id', missingOrigin as string[])
        for (const c of camps || []) {
          if (c.slug) slugByCampaign.set(c.id, c.slug)
        }
      }

      const prospectIds = prospects.map(p => p.id)
      const relanceIds = ownerRelances.map(r => r.id)

      // 4) Journal des envois déjà effectués (anti-doublon)
      const { data: logs } = await supabase
        .from('business_partial_relance_logs')
        .select('relance_id, prospect_id, partial_at')
        .in('relance_id', relanceIds)
        .in('prospect_id', prospectIds)

      const alreadySent = new Set(
        (logs || []).map(l => `${l.relance_id}|${l.prospect_id}|${new Date(l.partial_at).getTime()}`),
      )

      for (const prospect of prospects) {
        if (!prospect.email) { summary.skipped++; continue }

        const partialAt = new Date(prospect.partial_at).getTime()
        if (!Number.isFinite(partialAt)) { summary.skipped++; continue }

        const firstRelanceAt = prospect.partial_first_relance_at
          ? new Date(prospect.partial_first_relance_at).getTime()
          : null

        for (const relance of ownerRelances) {
          const key = `${relance.id}|${prospect.id}|${partialAt}`
          if (alreadySent.has(key)) continue

          // Point de départ : l'entrée en « Incomplet » pour la 1re, l'envoi de la 1re pour les suivantes
          let dueFrom: number | null
          if (relance.position === 1) {
            dueFrom = partialAt
          } else {
            // Sans première relance envoyée, les suivantes restent en attente
            if (firstRelanceAt === null) continue
            dueFrom = firstRelanceAt
          }

          const dueAt = dueFrom + relance.delay_days * DAY_MS
          if (now < dueAt) continue

          summary.candidates++

          const displayName = prospect.firstName || prospect.contact || ''
          // Campagne d'origine du lead, sinon la campagne fixe choisie par le propriétaire
          const targetCampaignId = relance.use_origin_campaign ? prospect.campaign_id : relance.campaign_id
          const slug = targetCampaignId ? slugByCampaign.get(targetCampaignId) : null
          const campaignUrl = slug ? `${APP_URL}/capture/${slug}` : null
          const vars = { lead_name: displayName, campaign_link: campaignUrl || '' }

          const subject = replaceVars(relance.subject || "Vous n'avez pas terminé", vars)
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
                htmlContent: buildEmailHtml(bodyHtml, campaignUrl),
              }),
            })

            if (!emailRes.ok) {
              const detail = await emailRes.text()
              throw new Error(`Brevo ${emailRes.status}: ${detail.slice(0, 200)}`)
            }

            // Journalise AVANT toute autre écriture : la contrainte d'unicité est
            // le garde-fou anti-doublon si le cron se relance.
            await supabase.from('business_partial_relance_logs').insert({
              relance_id: relance.id,
              prospect_id: prospect.id,
              partial_at: prospect.partial_at,
            })

            const patch: Record<string, any> = {
              partial_relance_step: Math.max(prospect.partial_relance_step || 0, relance.position),
            }
            // La 1re relance fixe la référence de temps des suivantes
            if (relance.position === 1 && !prospect.partial_first_relance_at) {
              const sentAt = new Date().toISOString()
              patch.partial_first_relance_at = sentAt
              prospect.partial_first_relance_at = sentAt
            }
            await supabase.from('business_prospects').update(patch).eq('id', prospect.id)

            alreadySent.add(key)
            summary.sent++
          } catch (err: any) {
            summary.failed++
            console.error(`[partial-relances] prospect ${prospect.id} relance ${relance.position}:`, err?.message)
          }
        }
      }
    }

    return res.status(200).json({ ok: true, ...summary })
  } catch (err: any) {
    console.error('[partial-relances] erreur:', err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}
