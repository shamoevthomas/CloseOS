import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  normalizeBlocks,
  normalizeSettings,
  computeVisibleBlockIds,
  validateAnswers,
  isInputBlock,
  blockLabel,
  answerToText,
  type FormBlock,
} from './_lib/formBlocks.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY || ''

/** Colonnes modifiables par forms-update — tout le reste du body est ignoré. */
const UPDATABLE_FIELDS = new Set([
  'name',
  'description',
  'blocks',
  'settings',
  'is_active',
  'crm_enabled',
  'crm_mapping',
  'crm_source',
  'crm_stage',
  'crm_campaign_id',
  'notify_enabled',
  'notify_email',
])

// ─── Email de notification (DA CloseOS light) ───

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildNotificationEmail(formName: string, rows: { label: string; value: string }[]): string {
  const answerRows = rows
    .map(
      r => `
        <tr>
          <td style="padding: 0 0 20px 0;">
            <p style="margin: 0 0 4px 0; font-family: 'Inter', Helvetica, sans-serif; font-size: 12px; font-weight: 500; color: #1b1c1b; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px;">${escapeHtml(r.label)}</p>
            <p style="margin: 0; font-family: 'Inter', Helvetica, sans-serif; font-size: 15px; color: #1b1c1b; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(r.value) || '<span style="opacity:0.4;">—</span>'}</p>
          </td>
        </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 64px 20px; background-color: #fbf9f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="padding-bottom: 40px; text-align: center;">
        <span style="font-family: 'Manrope', Arial, sans-serif; font-weight: 800; font-size: 28px; color: #111111;">Close</span><span style="font-family: 'Manrope', Arial, sans-serif; font-weight: 800; font-size: 28px; color: #a03cf8;">OS</span>
      </td>
    </tr>
    <tr>
      <td style="background-color: #ffffff; border-radius: 48px; padding: 64px 48px; box-shadow: 0 20px 40px rgba(27,28,27,0.04); border: 1px solid rgba(196,199,199,0.1);">
        <h1 style="margin: 0 0 12px 0; font-family: 'Manrope', Arial, sans-serif; font-weight: 800; font-size: 28px; color: #111111; letter-spacing: -0.04em; line-height: 1.1;">Nouvelle réponse</h1>
        <p style="margin: 0 0 40px 0; font-family: 'Inter', Helvetica, sans-serif; font-size: 15px; color: #1b1c1b; opacity: 0.6; line-height: 1.6;">Formulaire « ${escapeHtml(formName)} »</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f3f2; border-radius: 32px; padding: 32px;">
          <tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${answerRows}</table>
          </td></tr>
        </table>
        <div style="margin-top: 40px; text-align: center;">
          <a href="https://closeos.fr/business/formulaires" style="display: inline-block; background-color: #111111; color: #ffffff; text-decoration: none; border-radius: 48px; padding: 16px 32px; font-family: 'Manrope', Arial, sans-serif; font-weight: 800; font-size: 14px;">Voir toutes les réponses</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding-top: 32px; text-align: center; font-family: 'Inter', Helvetica, sans-serif; font-size: 12px; color: #1b1c1b; opacity: 0.5;">
        © 2026 CloseOS Business · <a href="mailto:support@closeos.fr" style="color: inherit;">support@closeos.fr</a>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendNotification(to: string, formName: string, rows: { label: string; value: string }[]) {
  if (!BREVO_API_KEY || !to) return
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'CloseOS', email: 'support@closeos.fr' },
      to: [{ email: to }],
      subject: `Nouvelle réponse — ${formName}`,
      htmlContent: buildNotificationEmail(formName, rows),
    }),
  })
}

// ─── Handler ───

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const action = req.query.action as string

  try {
    // ══════════════ Actions administrateur ══════════════

    if (action === 'forms-list' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const { data, error } = await supabase
        .from('business_forms')
        .select('*, business_form_responses(count)')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ forms: data })
    }

    if (action === 'forms-create' && req.method === 'POST') {
      const { user_id, name } = req.body
      if (!user_id || !name) return res.status(400).json({ error: 'user_id and name required' })

      // Garantit l'existence du profil business (même logique que campaigns-create)
      const { data: existingUser } = await supabase
        .from('business_users')
        .select('id')
        .eq('id', user_id)
        .maybeSingle()

      if (!existingUser) {
        const {
          data: { user: authUser },
        } = await supabase.auth.admin.getUserById(user_id)
        await supabase.from('business_users').insert({
          id: user_id,
          email: authUser?.email || '',
          full_name: authUser?.user_metadata?.full_name || '',
        })
      }

      const { data, error } = await supabase
        .from('business_forms')
        .insert({ user_id, name: String(name).trim() })
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ form: data })
    }

    if (action === 'forms-update' && req.method === 'PUT') {
      const { user_id, id } = req.body
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const updates: Record<string, any> = {}
      for (const [key, value] of Object.entries(req.body)) {
        if (UPDATABLE_FIELDS.has(key)) updates[key] = value
      }
      if (Array.isArray(updates.blocks)) updates.blocks = normalizeBlocks(updates.blocks)
      updates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('business_forms')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user_id)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ form: data })
    }

    if (action === 'forms-delete' && req.method === 'DELETE') {
      const id = req.query.id as string
      const user_id = req.query.user_id as string
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { error } = await supabase.from('business_forms').delete().eq('id', id).eq('user_id', user_id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    if (action === 'forms-duplicate' && req.method === 'POST') {
      const { user_id, id } = req.body
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { data: source, error: srcErr } = await supabase
        .from('business_forms')
        .select('*')
        .eq('id', id)
        .eq('user_id', user_id)
        .single()

      if (srcErr || !source) return res.status(404).json({ error: 'Form not found' })

      const { id: _id, slug: _slug, created_at: _c, updated_at: _u, ...rest } = source as any
      const { data, error } = await supabase
        .from('business_forms')
        .insert({ ...rest, name: `${source.name} (copie)`, is_active: false })
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ form: data })
    }

    if (action === 'forms-responses' && req.method === 'GET') {
      const form_id = req.query.form_id as string
      const user_id = req.query.user_id as string
      if (!form_id || !user_id) return res.status(400).json({ error: 'form_id and user_id required' })

      const { data, error } = await supabase
        .from('business_form_responses')
        .select('*')
        .eq('form_id', form_id)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ responses: data })
    }

    if (action === 'form-response-delete' && req.method === 'DELETE') {
      const id = req.query.id as string
      const user_id = req.query.user_id as string
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { error } = await supabase
        .from('business_form_responses')
        .delete()
        .eq('id', id)
        .eq('user_id', user_id)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // ══════════════ Actions publiques (page /f/:slug) ══════════════

    if (action === 'form-public' && req.method === 'GET') {
      const slug = req.query.slug as string
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: form, error } = await supabase
        .from('business_forms')
        .select('id, name, description, slug, blocks, settings, is_active')
        .eq('slug', slug)
        .maybeSingle()

      if (error) return res.status(500).json({ error: error.message })
      if (!form) return res.status(404).json({ error: 'Form not found' })
      if (!form.is_active) return res.status(403).json({ error: 'Form inactive' })

      // On n'expose jamais la config CRM / notification au visiteur
      return res.status(200).json({
        form: {
          id: form.id,
          name: form.name,
          description: form.description,
          slug: form.slug,
          blocks: normalizeBlocks(form.blocks),
          settings: normalizeSettings(form.settings),
        },
      })
    }

    if (action === 'form-submit' && req.method === 'POST') {
      const { slug, answers: rawAnswers, meta: rawMeta } = req.body
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: form, error: formErr } = await supabase
        .from('business_forms')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (formErr) return res.status(500).json({ error: formErr.message })
      if (!form) return res.status(404).json({ error: 'Form not found' })
      if (!form.is_active) return res.status(403).json({ error: 'Form inactive' })

      const blocks: FormBlock[] = normalizeBlocks(form.blocks)
      const submitted = (rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {}) as Record<string, unknown>

      // On ne conserve que les réponses aux blocs de saisie RÉELLEMENT visibles :
      // un client malveillant ne peut ni injecter de clés inconnues ni répondre
      // à des blocs masqués par la logique conditionnelle.
      const visible = computeVisibleBlockIds(blocks, submitted)
      const answers: Record<string, unknown> = {}
      for (const b of blocks) {
        if (!isInputBlock(b.type) || !visible.has(b.id)) continue
        if (submitted[b.id] !== undefined) answers[b.id] = submitted[b.id]
      }

      // Revalidation serveur (obligatoires, formats)
      const errors = validateAnswers(blocks, answers)
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({ error: 'validation_failed', errors })
      }

      // Lignes libellé/valeur, réutilisées pour le CRM et l'email
      const rows = blocks
        .filter(b => isInputBlock(b.type) && visible.has(b.id))
        .map((b, i) => ({ label: blockLabel(b, i), value: answerToText(b, answers[b.id]) }))

      // ─── Pont CRM (optionnel) ───
      let prospectId: number | null = null
      if (form.crm_enabled) {
        const mapping = (form.crm_mapping || {}) as { name?: string | null; email?: string | null; phone?: string | null }
        const byId: Record<string, FormBlock> = {}
        for (const b of blocks) byId[b.id] = b

        const readMapped = (blockId?: string | null): string => {
          if (!blockId || !byId[blockId]) return ''
          return answerToText(byId[blockId], answers[blockId]).trim()
        }

        const contact = readMapped(mapping.name)
        const email = readMapped(mapping.email)
        const phone = readMapped(mapping.phone)
        const leadAnswers = rows.map(r => ({ question: r.label, answer: r.value }))

        // Un prospect n'a de sens que s'il est identifiable
        if (contact || email || phone) {
          const nameParts = contact.split(' ').filter(Boolean)
          const firstName = nameParts[0] || ''
          const lastName = nameParts.slice(1).join(' ') || ''

          // Déduplication sur l'email, dans le périmètre du propriétaire
          let existing: any = null
          if (email) {
            const { data } = await supabase
              .from('business_prospects')
              .select('id, contact, phone, lead_answers')
              .eq('user_id', form.user_id)
              .eq('email', email)
              .limit(1)
              .maybeSingle()
            existing = data
          }

          if (existing) {
            // On complète les trous sans jamais écraser une donnée saisie par l'équipe
            const previous = Array.isArray(existing.lead_answers) ? existing.lead_answers : []
            await supabase
              .from('business_prospects')
              .update({
                contact: existing.contact || contact || null,
                phone: existing.phone || phone || null,
                lead_answers: [...previous, ...leadAnswers],
              })
              .eq('id', existing.id)
            prospectId = existing.id
          } else {
            const { data: inserted, error: prospErr } = await supabase
              .from('business_prospects')
              .insert({
                user_id: form.user_id,
                contact: contact || email || phone,
                firstName,
                lastName,
                email: email || null,
                phone: phone || '',
                stage: form.crm_stage || 'prospect',
                source: form.crm_source || form.name,
                campaign_id: form.crm_campaign_id || null,
                lead_answers: leadAnswers,
                metadata: { form_name: form.name, form_slug: form.slug },
              })
              .select('id')
              .single()

            if (prospErr) {
              // La réponse ne doit jamais être perdue à cause du pont CRM
              console.error('[form-submit] prospect insert failed:', prospErr.message)
            } else {
              prospectId = inserted.id
            }
          }
        }
      }

      // ─── Enregistrement de la réponse ───
      const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : {}
      const { data: response, error: respErr } = await supabase
        .from('business_form_responses')
        .insert({
          form_id: form.id,
          user_id: form.user_id,
          answers,
          meta,
          prospect_id: prospectId,
        })
        .select('id')
        .single()

      if (respErr) return res.status(500).json({ error: respErr.message })

      // ─── Notification email (best effort) ───
      if (form.notify_enabled) {
        try {
          let to = form.notify_email
          if (!to) {
            const { data: owner } = await supabase
              .from('business_users')
              .select('email')
              .eq('id', form.user_id)
              .maybeSingle()
            to = owner?.email || ''
          }
          if (to) await sendNotification(to, form.name, rows)
        } catch (err: any) {
          console.error('[form-submit] notification failed:', err?.message)
        }
      }

      // ─── Webhooks sortants (fire-and-forget) ───
      try {
        const { emitWebhookEvent, detectProductForUser } = await import('./_lib/emit-webhook.js')
        const product = await detectProductForUser(form.user_id)
        if (product) {
          emitWebhookEvent({
            product,
            userId: form.user_id,
            event: 'form.submitted',
            payload: {
              form_id: form.id,
              form_name: form.name,
              form_slug: form.slug,
              response_id: response.id,
              prospect_id: prospectId,
              answers: rows,
            },
          }).catch(() => {})
        }
      } catch (err: any) {
        console.error('[form-submit] emit failed:', err?.message)
      }

      return res.status(200).json({ success: true, response_id: response.id })
    }

    return res.status(400).json({ error: 'Invalid action' })
  } catch (error: any) {
    console.error('[business-forms] error:', error)
    return res.status(500).json({ error: error.message || 'Internal error' })
  }
}
