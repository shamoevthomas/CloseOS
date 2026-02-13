import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Supporte GET (via url) ou POST (via fetch)
  const code = req.query.code || req.body?.code
  const state = req.query.state || req.body?.state 

  if (!code || !state) {
    return res.status(400).json({ error: 'Paramètres manquants (code ou state)' })
  }

  // Vérification des variables d'environnement
  if (!process.env.VITE_CAL_CLIENT_ID || !process.env.CAL_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Configuration serveur incomplète (ID/Secret manquant)' })
  }

  try {
    // 1. Échange du code contre les tokens
    // SÉCURITÉ : On met l'URL en dur pour éviter les erreurs de variables.
    // Elle doit correspondre EXACTEMENT à celle du dashboard Cal.com
    const redirectUri = 'https://close-os.vercel.app/rendez-vous'

    const tokenResponse = await fetch('https://app.cal.com/api/auth/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.VITE_CAL_CLIENT_ID,
        client_secret: process.env.CAL_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const data = await tokenResponse.json()

    if (data.error) {
      console.error('Erreur Token Cal.com:', data)
      // On renvoie l'erreur détaillée pour comprendre ce qui cloche
      throw new Error(data.error.message || JSON.stringify(data))
    }

    // 2. Sauvegarde dans Supabase
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase.from('profiles').update({
      cal_access_token: data.access_token,
      cal_refresh_token: data.refresh_token,
      cal_token_expires_at: Date.now() + (data.expires_in * 1000)
    }).eq('id', state)

    if (error) throw error

    // 3. Réponse JSON succès
    return res.status(200).json({ success: true })

  } catch (error: any) {
    console.error('Erreur API OAuth:', error)
    return res.status(500).json({ error: error.message })
  }
}