import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Initialisation Supabase (Côté Serveur)
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl!, supabaseKey!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS Headers (Pour autoriser Cal.com à nous parler)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { user_id } = req.query
    const event = req.body

    console.log("🔔 Webhook Cal.com reçu:", event.triggerEvent)

    if (!user_id) {
      console.error("❌ ID Utilisateur manquant dans l'URL")
      return res.status(400).json({ error: 'User ID missing' })
    }

    // 2. Traitement selon le type d'événement
    const payload = event.payload
    const trigger = event.triggerEvent // BOOKING_CREATED, BOOKING_CANCELLED...

    if (trigger === 'BOOKING_CREATED' || trigger === 'BOOKING_RESCHEDULED') {
      
      // Extraction des données clés
      const startTime = new Date(payload.startTime)
      const dateStr = startTime.toISOString().split('T')[0] // YYYY-MM-DD
      const timeStr = startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) // HH:MM
      
      // Trouver le prospect (le premier attendee qui n'est pas l'organisateur)
      const attendee = payload.attendees[0] // Simplification (souvent le prospect est le premier)
      const prospectName = attendee.name || 'Prospect Inconnu'
      const prospectEmail = attendee.email
      
      // Titre et Description
      const title = payload.title || 'Rendez-vous Cal.com'
      const description = `Email: ${prospectEmail}\nType: ${payload.typeTitle}\nNotes: ${payload.description || ''}`

      // Insertion dans Supabase
      const { data, error } = await supabase
        .from('meetings')
        .upsert({
          user_id: user_id, // L'ID qu'on a passé dans l'URL
          title: title,
          date: dateStr,
          time: timeStr,
          duration: 30, // Valeur par défaut ou calculée via endTime - startTime
          contact: prospectName,
          status: 'scheduled',
          location: payload.location || 'Visio', // Lien Zoom/Meet/Daily
          description: description,
          source: 'Cal.com'
        }, { onConflict: 'calcom_uid' }) // Idéalement il faudrait une colonne ID unique Cal.com, sinon on fait des doublons

      if (error) throw error
      console.log("✅ Rendez-vous créé/mis à jour")

    } else if (trigger === 'BOOKING_CANCELLED') {
      // Gestion de l'annulation (Optionnel pour l'instant)
      // Il faudrait retrouver le meeting par date/heure ou ID externe et passer le status à 'cancelled'
      console.log("ℹ️ Annulation reçue (Non traitée pour l'instant)")
    }

    return res.status(200).json({ received: true })

  } catch (error: any) {
    console.error("❌ Erreur Webhook:", error)
    return res.status(500).json({ error: error.message })
  }
}