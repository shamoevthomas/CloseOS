// api/webhooks.ts
// Consolidated API handler merging webhook.ts and sync-brevo.ts
// Routes based on req.query.action

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// ACTION: crm-webhook (from webhook.ts)
// Receives prospect/lead data and sends to Supabase
// ============================================================
async function handleCrmWebhook(request: any, response: any) {
  try {
    // MODIFICATION ICI : On récupère aussi formula_id de l'URL
    const { offer_id, formula_id } = request.query

    // On garde le log pour le debug au cas où
    console.log("📦 BRUT:", JSON.stringify(request.body))

    if (!offer_id) throw new Error("ID Offre manquant")

    // 1. Nettoyage Tableau (Si c'est une liste, on prend le premier)
    let rawBody = request.body
    if (Array.isArray(rawBody) && rawBody.length > 0) {
      rawBody = rawBody[0]
    }

    // 2. EXTRACTION INTELLIGENTE DU STATUT
    let realStatus = rawBody.status; // Valeur par défaut (ex: STRATEGY_CALL_BOOKED)

    // PRIORITY 1 : On regarde dans "contactFields" (C'est là que se cache "Customer")
    if (rawBody.contactFields && rawBody.contactFields.contact_stage) {
        realStatus = rawBody.contactFields.contact_stage;
    }
    // PRIORITY 2 : On regarde les anciens emplacements (au cas où ça change)
    else if (rawBody.contactStage) {
       if (typeof rawBody.contactStage === 'string') {
         realStatus = rawBody.contactStage;
       } else if (rawBody.contactStage.name) {
         realStatus = rawBody.contactStage.name;
       }
    }
    else if (rawBody.stage) {
       realStatus = rawBody.stage;
    }

    // 3. Construction de l'objet final propre
    const cleanBody = {
      first_name: rawBody.firstName || rawBody.first_name || "Inconnu",
      last_name: rawBody.lastName || rawBody.last_name || "",
      email: rawBody.email || "pas-d-email@erreur.com",
      phone: rawBody.phoneNumber || rawBody.phone || "",
      status: realStatus, // On utilise le VRAI statut (ex: Customer)
      offer_id: Number(offer_id),
      formula_id: formula_id ? String(formula_id) : null,
      notes: rawBody.notes || rawBody.description || rawBody.comment || null // ✅ SEULE MODIF : On attrape les notes
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

// ============================================================
// ACTION: sync-brevo (from sync-brevo.ts)
// Syncs user to Brevo on user creation
// ============================================================
async function handleSyncBrevo(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { record, secret } = req.body;

  // Basic security check (if secret is passed in query or body)
  const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;
  if (SUPABASE_WEBHOOK_SECRET && secret !== SUPABASE_WEBHOOK_SECRET) {
    // If webhook setup uses header, check req.headers['x-supabase-signature'] etc.
    // For simplicity, we can pass secret in query param within the webhook URL configuration in Supabase
    // URL: https://.../api/webhooks?action=sync-brevo&secret=...
  }

  // Payload from Supabase Auth Hook (if used) or Database Webhook
  // Database Webhook structure: { type: 'INSERT', table: 'users', record: { ... }, schema: 'public' }
  // Auth Hook structure: varies

  // Let's assume Database Webhook on `public.users` table
  const email = record?.email;
  const firstName = record?.first_name;
  const lastName = record?.last_name;

  if (!email) {
    return res.status(400).json({ error: 'No email provided in record' });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'BREVO_API_KEY missing' });
  }

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          PRENOM: firstName,
          NOM: lastName
        },
        updateEnabled: true, // Update if exists
        // listIds: [2] // Optional: Add to a specific list ID if you know it.
      })
    });

    const data = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error('Brevo Error:', data);
      // Return 200 to prevent webhook retries loop if it's a validation error
      return res.status(200).json({ error: 'Brevo API Error', details: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Sync Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================================
// MAIN HANDLER - Routes based on req.query.action
// ============================================================
export default async function handler(req: any, res: any) {
  // CORS headers (from webhook.ts)
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { action } = req.query;

  switch (action) {
    case 'crm-webhook':
      return handleCrmWebhook(req, res);

    case 'sync-brevo':
      return handleSyncBrevo(req, res);

    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter',
        valid_actions: ['crm-webhook', 'sync-brevo']
      });
  }
}
