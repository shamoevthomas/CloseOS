// api/webhook.ts
export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Credentials', true)
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  try {
    const { offer_id } = request.query
    
    // --- LE MOUCHARD EST ICI ---
    console.log("🟢 1. Webhook reçu pour Offre ID:", offer_id)
    console.log("📦 2. Contenu BRUT reçu d'iClosed:", JSON.stringify(request.body))
    // ---------------------------

    if (!offer_id) throw new Error("ID de l'offre manquant")

    let rawBody = request.body
    if (Array.isArray(rawBody) && rawBody.length > 0) {
      rawBody = rawBody[0]
    }

    // Traduction des champs
    const cleanBody = {
      ...rawBody,
      first_name: rawBody.firstName || rawBody.first_name,
      last_name: rawBody.lastName || rawBody.last_name,
      phone: rawBody.phoneNumber || rawBody.phone,
      email: rawBody.email,
      offer_id: Number(offer_id)
    }

    console.log("✨ 3. Données nettoyées envoyées à Supabase:", JSON.stringify(cleanBody))

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante")
    }

    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/receive_native_webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(cleanBody)
    })

    const data = await result.json()
    console.log("✅ 4. Réponse Supabase:", JSON.stringify(data)) // On verra si Supabase accepte ou refuse

    return response.status(200).json(data)

  } catch (error: any) {
    console.error("❌ Erreur Webhook:", error)
    return response.status(500).json({ error: error.message })
  }
}