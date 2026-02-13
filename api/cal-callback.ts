import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Supporte GET (via url) ou POST (via fetch)
  const code = req.query.code || req.body?.code
  const state = req.query.state || req.body?.state 

  if (!code || !state) {
    return res.status(400).json({ error: 'Paramètres manquants (code ou state)' })
  }

  // --- CONFIGURATION EN DUR (POUR QUE ÇA MARCHE DIRECT) ---
  const CLIENT_ID = "452e83a06c630a84cba92ab72cd43735c78ee8b5b691f488de432201b2d951ba"
  const CLIENT_SECRET = "44133f701370e512c37bcefd37317b7e9d150632c7e3ec85f34b2a86bb9614be"
  // IMPORTANT : Doit correspondre EXACTEMENT à ton screen Cal.com
  const REDIRECT_URI = "https://close-os.vercel.app/rendez-vous" 

  try {
    console.log('🔄 Échange code OAuth avec Cal.com...')
    
    const tokenResponse = await fetch('https://app.cal.com/api/auth/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const data = await tokenResponse.json()
    
    if (data.error || !tokenResponse.ok) {
      console.error('❌ Erreur Token Cal.com:', data)
      throw new Error(data.error?.message || data.error || 'Erreur échange token')
    }

    console.log('✅ Token obtenu, sauvegarde Supabase...')

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase.from('profiles').update({
      cal_access_token: data.access_token,
      cal_refresh_token: data.refresh_token,
      cal_token_expires_at: Date.now() + ((data.expires_in || 1800) * 1000)
    }).eq('id', state)

    if (error) {
      console.error('❌ Erreur Supabase:', error)
      throw error
    }

    return res.status(200).json({ success: true })

  } catch (error: any) {
    console.error('❌ ERREUR API:', error.message)
    return res.status(500).json({ 
      error: error.message || 'Erreur inconnue'
    })
  }
}