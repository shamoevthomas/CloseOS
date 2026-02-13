import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code || req.body?.code
  const state = req.query.state || req.body?.state

  console.log('🚀 Callback reçu - Code:', code ? 'PRÉSENT' : 'MANQUANT', '- State:', state)

  if (!code || !state) {
    console.error('❌ Paramètres manquants')
    return res.status(400).json({ error: 'Paramètres manquants (code ou state)' })
  }

  if (!process.env.VITE_CAL_CLIENT_ID || !process.env.CAL_CLIENT_SECRET) {
    console.error('❌ Variables env manquantes')
    return res.status(500).json({ error: 'Configuration serveur incomplète' })
  }

  try {
    console.log('🔄 Échange du code OAuth avec Cal.com...')
    
    // ✅ FORMAT x-www-form-urlencoded comme demandé par OAuth 2.0
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.VITE_CAL_CLIENT_ID,
      client_secret: process.env.CAL_CLIENT_SECRET,
      redirect_uri: 'https://close-os.vercel.app/rendez-vous',
      code: code as string
    })

    console.log('📤 URL:', 'https://app.cal.com/api/auth/oauth/token')
    console.log('📤 Redirect URI:', 'https://close-os.vercel.app/rendez-vous')

    const tokenResponse = await fetch('https://app.cal.com/api/auth/oauth/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    const data = await tokenResponse.json()
    
    console.log('📊 Status Response:', tokenResponse.status)
    console.log('📦 Data:', JSON.stringify(data))
    
    if (!tokenResponse.ok || data.error) {
      console.error('❌ Erreur Token Cal.com:', data)
      throw new Error(data.error_description || data.error || data.message || JSON.stringify(data))
    }

    console.log('✅ Token obtenu avec succès')

    // Sauvegarde dans Supabase
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

    console.log('✅ Sauvegarde OK pour user:', state)
    
    return res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('❌ ERREUR COMPLÈTE:', error.message, error.stack)
    return res.status(500).json({ 
      error: error.message || 'Erreur inconnue',
      details: error.toString()
    })
  }
}
