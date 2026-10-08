import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { exchangeGoogleCode, getSalesGoogleAccessToken, runSalesGcalImport } from './_lib/sales-gcal-import.js'

// CloseOS Sales — connexion Google Agenda côté serveur (refresh token) + import CRM.
// Toutes les actions exigent la session Supabase de l'utilisateur (Bearer JWT).
//   POST ?action=connect     { code }  → échange le code auth-code, stocke le refresh token
//   GET  ?action=token                 → jeton d'accès frais pour l'affichage de l'agenda
//   POST ?action=disconnect            → supprime les jetons
//   POST ?action=sync                  → lance l'import maintenant

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
  const userId = userData.user.id
  const action = String(req.query.action || '')

  try {
    if (action === 'connect' && req.method === 'POST') {
      const code = req.body?.code
      if (!code) return res.status(400).json({ error: 'code required' })
      const tokens = await exchangeGoogleCode(code)
      if (!tokens) return res.status(400).json({ error: 'Failed to exchange code' })

      // Google ne renvoie un refresh token qu'au premier consentement : on garde l'ancien sinon.
      let refreshToken = tokens.refresh_token
      if (!refreshToken) {
        const { data: existing } = await supabase.from('sales_google_calendar_tokens').select('refresh_token').eq('user_id', userId).maybeSingle()
        refreshToken = existing?.refresh_token
      }
      if (!refreshToken) return res.status(400).json({ error: 'no_refresh_token' })

      let googleEmail: string | null = null
      try {
        const info = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
        if (info.ok) googleEmail = (await info.json()).id || null
      } catch { /* facultatif */ }

      const { error } = await supabase.from('sales_google_calendar_tokens').upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope || '',
        google_email: googleEmail,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (error) return res.status(500).json({ error: error.message })

      // Une reconnexion lève l'erreur « accès révoqué » éventuelle.
      await supabase.from('sales_gcal_import_settings').update({ last_sync_error: null }).eq('user_id', userId).eq('last_sync_error', 'reconnect_required')
      return res.status(200).json({ access_token: tokens.access_token })
    }

    if (action === 'token' && req.method === 'GET') {
      const { token: accessToken, revoked } = await getSalesGoogleAccessToken(supabase, userId)
      return res.status(200).json({ access_token: accessToken, revoked: !!revoked })
    }

    if (action === 'disconnect' && req.method === 'POST') {
      await supabase.from('sales_google_calendar_tokens').delete().eq('user_id', userId)
      return res.status(200).json({ success: true })
    }

    if (action === 'sync' && req.method === 'POST') {
      const result = await runSalesGcalImport(supabase, userId)
      return res.status(200).json(result)
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (e: any) {
    console.error('[sales-gcal]', action, e?.message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
