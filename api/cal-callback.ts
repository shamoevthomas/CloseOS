import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code || req.body?.code
  const state = req.query.state || req.body?.state

  if (!code || !state) {
    return res.status(400).json({ error: 'Paramètres manquants (code ou state)' })
  }

  if (!process.env.VITE_CAL_CLIENT_ID || !process.env.CAL_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Configuration serveur incomplète' })
  }

  try {
    console.log('🔄 Échange du code OAuth avec Cal.com...')
    
    // ✅ ANCIEN ENDPOINT QUI FONCTIONNE (v1)
    const tokenResponse = await fetch('https://app.cal.com/api/auth/oauth/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'  // ✅ JSON fonctionne avec v1
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.VITE_CAL_CLIENT_ID,
        client_secret: process.env.CAL_CLIENT_SECRET,
        redirect_uri: `${process.env.VITE_APP_URL}/rendez-vous`,
        code: code as string
      })
    })

    const data = await tokenResponse.json()
    
    console.log('📦 Response Cal.com:', tokenResponse.status, data)
    
    if (!tokenResponse.ok || data.error) {
      console.error('❌ Erreur Token Cal.com:', data)
      throw new Error(data.error_description || data.error || JSON.stringify(data))
    }

    // 2. Sauvegarde dans Supabase
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

    console.log('✅ OAuth Cal.com réussi pour user:', state)
    
    return res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('❌ Erreur API OAuth complète:', error)
    return res.status(500).json({ 
      error: error.message || 'Erreur inconnue',
      details: error.toString()
    })
  }
}
