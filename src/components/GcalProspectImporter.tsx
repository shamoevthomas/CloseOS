import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { useProspects } from '../contexts/ProspectsContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useGcalImportSettings } from '../hooks/useGcalImportSettings'

// L'import tourne côté serveur (cron toutes les 15 min). Quand l'app est ouverte,
// on déclenche en plus une synchro immédiate, au plus toutes les 2 minutes.
const MIN_INTERVAL_MS = 2 * 60 * 1000
let lastSyncAt = 0

export async function triggerGcalImportSync(): Promise<{ status: string; created: string[] } | null> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) return null
  lastSyncAt = Date.now()
  try {
    const res = await fetch('/api/sales-gcal?action=sync', { method: 'POST', headers: { Authorization: `Bearer ${jwt}` } })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

/** Déclenche la synchro Google Agenda → CRM quand l'app est ouverte. Sans rendu. */
export function GcalProspectImporter() {
  const { user, isBusinessUser } = useAuth()
  const { googleEvents, serverConnected } = useGoogleCalendar()
  const { refreshProspects } = useProspects()
  const { lang } = useLanguage()
  const { settings, loaded, reload } = useGcalImportSettings()
  const running = useRef(false)

  const active = !!user && !isBusinessUser && serverConnected && loaded &&
    (settings.rules.length > 0 || settings.import_all_invitees)

  useEffect(() => {
    if (!active || running.current || Date.now() - lastSyncAt < MIN_INTERVAL_MS) return
    running.current = true
    triggerGcalImportSync()
      .then(result => {
        if (result?.created?.length) {
          const names = result.created.slice(0, 3).join(', ') + (result.created.length > 3 ? '…' : '')
          toast.success(lang === 'en'
            ? `${result.created.length} prospect(s) created from Google Calendar: ${names}`
            : `${result.created.length} prospect(s) créé(s) depuis Google Agenda : ${names}`)
          refreshProspects()
        }
        if (result) reload()
      })
      .finally(() => { running.current = false })
  // Relancé à chaque rechargement de l'agenda (googleEvents) et quand les réglages changent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, googleEvents, settings.rules])

  return null
}
