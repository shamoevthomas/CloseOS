import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query

  if (!code || !state) {
    return res.status(400).json({ error: 'Paramètres manquants (code ou state)' })
  }

  // Vérification de sécurité des variables
  if (!process.env.VITE_CAL_CLIENT_ID || !process.env.CAL_CLIENT_SECRET) {
    console.error('Erreur config: Variables Cal.com manquantes')
    return res.status(500).json({ error: 'Configuration serveur incomplète' })
  }

  try {
    // 1. Échange du code contre les tokens (API v2)
    const tokenResponse = await fetch('https://api.cal.com/v2/auth/oauth2/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.VITE_CAL_CLIENT_ID,
        client_secret: process.env.CAL_CLIENT_SECRET,
        redirect_uri: `${process.env.VITE_APP_URL}/api/cal-callback`,
        code
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const data = await tokenResponse.json()

    if (data.error) {
      console.error('Erreur Cal.com Token:', data)
      throw new Error(data.error.message || 'Erreur lors de l\'échange de token')
    }

    // 2. Initialisation Supabase Admin
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 3. Sauvegarde dans le profil
    // state = user_id (passé depuis le frontend)
    const { error } = await supabase.from('profiles').update({
      cal_access_token: data.access_token,
      cal_refresh_token: data.refresh_token,
      cal_token_expires_at: Date.now() + (data.expires_in * 1000)
    }).eq('id', state)

    if (error) throw error

    // 4. Succès -> Retour à la page Rendez-vous
    res.redirect(`${process.env.VITE_APP_URL}/rendez-vous?cal_connected=true`)

  } catch (error: any) {
    console.error('Erreur OAuth:', error)
    res.redirect(`${process.env.VITE_APP_URL}/rendez-vous?cal_error=${encodeURIComponent(error.message)}`)
  }
}