import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// --- UTILISATION DE LA CLÉ SERVICE ROLE (CONSEIL PRO) ---
// On utilise SUPABASE_SERVICE_ROLE_KEY pour contourner les politiques RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-version')

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

    const payload = event.payload
    const trigger = event.triggerEvent

    if (trigger === 'BOOKING_CREATED' || trigger === 'BOOKING_RESCHEDULED') {
      
      const startTime = new Date(payload.startTime)
      const dateStr = startTime.toISOString().split('T')[0]
      const timeStr = startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      
      const attendee = payload.attendees[0]
      const prospectName = attendee?.name || 'Prospect Inconnu'
      const prospectEmail = attendee?.email
      
      const title = payload.title || 'Rendez-vous Cal.com'
      const description = `Email: ${prospectEmail}\nType: ${payload.typeTitle}\nNotes: ${payload.description || ''}`

      // Calcul de la durée (en minutes)
      const start = new Date(payload.startTime).getTime()
      const end = new Date(payload.endTime).getTime()
      const duration = Math.round((end - start) / (1000 * 60))

      // Insertion/Mise à jour avec la clé Service Role (Plus de blocage RLS)
      const { error } = await supabase
        .from('meetings')
        .upsert({
          user_id: user_id,
          title: title,
          date: dateStr,
          time: `${timeStr} - ${new Date(payload.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
          duration: duration || 30,
          contact: prospectName,
          status: 'scheduled',
          location: payload.location || 'Visio',
          description: description,
          source: 'Cal.com',
          calcom_uid: payload.uid // Unique ID pour éviter les doublons
        }, { onConflict: 'calcom_uid' })

      if (error) {
        console.error("❌ Erreur Supabase:", error)
        throw error
      }
      
      console.log("✅ Rendez-vous enregistré avec succès")

    } else if (trigger === 'BOOKING_CANCELLED') {
      // Marquer le rendez-vous comme annulé
      await supabase
        .from('meetings')
        .update({ status: 'cancelled' })
        .eq('calcom_uid', payload.uid)
    }

    return res.status(200).json({ received: true })

  } catch (error: any) {
    console.error("❌ Erreur Webhook détaillée:", error)
    return res.status(500).json({ error: error.message })
  }
}