// api/webhook.ts
export default async function handler(request: any, response: any) {
  // Gestion CORS
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
    console.log("🟢 Webhook reçu pour Offre:", offer_id)

    if (!offer_id) throw new Error("ID Offre manquant")

    // 1. Récupération et nettoyage de la structure (Tableau vs Objet)
    let rawBody = request.body
    if (Array.isArray(rawBody) && rawBody.length > 0) {
      rawBody = rawBody[0]
    }

    // 2. FILTRAGE STRICT (C'est ici qu'on résout l'erreur PGRST202)
    // On ne garde QUE les champs que Supabase connait. On jette le reste.
    const cleanBody = {
      first_name: rawBody.firstName || rawBody.first_name || "Inconnu",
      last_name: rawBody.lastName || rawBody.last_name || "",
      email: rawBody.email || "pas-d-email@erreur.com",
      phone: rawBody.phoneNumber || rawBody.phone || "",
      status: rawBody.status || "new_lead",
      offer_id: Number(offer_id)
    }

    console.log("✨ Données nettoyées :", JSON.stringify(cleanBody))

    // 3. Envoi à Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/receive_native_webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(cleanBody) // On envoie uniquement l'objet propre
    })

    const data = await result.json()
    console.log("✅ Réponse Supabase:", JSON.stringify(data))

    return response.status(200).json(data)

  } catch (error: any) {
    console.error("❌ Erreur:", error)
    return response.status(500).json({ error: error.message })
  }
}