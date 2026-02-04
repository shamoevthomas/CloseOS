// api/webhook.ts
// Ce fichier est une "Serverless Function" hébergée par Vercel
// Elle remplace l'Edge Function de Supabase sans prise de tête

export default async function handler(request: any, response: any) {
  // 1. Gérer la sécurité (CORS) pour qu'iClosed puisse nous parler
  response.setHeader('Access-Control-Allow-Credentials', true)
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  // Si c'est juste un test de connexion (OPTIONS), on dit "OK"
  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  try {
    // 2. Récupérer l'ID de l'offre dans l'URL (ex: ...?offer_id=4)
    const { offer_id } = request.query
    
    if (!offer_id) {
      throw new Error("ID de l'offre manquant dans l'URL (?offer_id=...)")
    }

    // 3. Récupérer les données envoyées par iClosed (le corps du message)
    const body = request.body

    // 4. Envoyer tout ça à ta base de données Supabase
    // On utilise tes variables d'environnement Vercel existantes
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante sur Vercel")
    }

    // On appelle ta fonction SQL "receive_native_webhook"
    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/receive_native_webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      // On fusionne les données d'iClosed avec l'ID de l'offre forcé
      body: JSON.stringify({
        ...body,
        offer_id: Number(offer_id)
      })
    })

    const data = await result.json()

    // 5. Répondre succès à iClosed
    return response.status(200).json(data)

  } catch (error: any) {
    console.error("Erreur Webhook:", error)
    return response.status(500).json({ error: error.message })
  }
}