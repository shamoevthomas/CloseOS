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
    
    // On garde le log BRUT pour vérifier si on a gagné
    console.log("📦 BRUT:", JSON.stringify(request.body))

    if (!offer_id) throw new Error("ID Offre manquant")

    // 1. Nettoyage Tableau
    let rawBody = request.body
    if (Array.isArray(rawBody) && rawBody.length > 0) {
      rawBody = rawBody[0]
    }

    // 2. LA MAGIE : On chasse la vraie étape (Contact Stage)
    // iClosed la cache parfois dans un sous-objet ou sous un autre nom
    let realStatus = rawBody.status; // Valeur par défaut (ex: STRATEGY_CALL_BOOKED)

    // Cas 1 : Champ "contactStage" (souvent un objet { id, name: "Customer" })
    if (rawBody.contactStage) {
       if (typeof rawBody.contactStage === 'string') {
         realStatus = rawBody.contactStage;
       } else if (rawBody.contactStage.name) {
         realStatus = rawBody.contactStage.name;
       }
    } 
    // Cas 2 : Champ "stage" direct
    else if (rawBody.stage) {
       realStatus = rawBody.stage;
    }

    // 3. Construction de l'objet final
    const cleanBody = {
      first_name: rawBody.firstName || rawBody.first_name || "Inconnu",
      last_name: rawBody.lastName || rawBody.last_name || "",
      email: rawBody.email || "pas-d-email@erreur.com",
      phone: rawBody.phoneNumber || rawBody.phone || "",
      status: realStatus, // On utilise notre statut intelligent
      offer_id: Number(offer_id)
    }

    console.log("✨ STATUS RETENU:", cleanBody.status)

    // 4. Envoi à Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

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
    return response.status(200).json(data)

  } catch (error: any) {
    console.error("❌ Erreur:", error)
    return response.status(500).json({ error: error.message })
  }
}