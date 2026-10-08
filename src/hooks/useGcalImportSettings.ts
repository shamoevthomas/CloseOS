import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DEFAULT_GCAL_IMPORT_SETTINGS, type GcalImportSettings } from '../lib/gcalProspectImport'

const CHANGED_EVENT = 'closeos:gcal-import-settings-changed'

export interface GcalSyncStatus {
  last_synced_at: string | null
  last_sync_error: string | null
  last_created_count: number
}

type EditableSettings = Pick<GcalImportSettings, 'rules' | 'use_invitees' | 'import_all_invitees' | 'ignored_emails'>

/** Réglages d'import Google Agenda → CRM (table sales_gcal_import_settings). */
export function useGcalImportSettings() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [settings, setSettings] = useState<GcalImportSettings>(DEFAULT_GCAL_IMPORT_SETTINGS)
  const [status, setStatus] = useState<GcalSyncStatus>({ last_synced_at: null, last_sync_error: null, last_created_count: 0 })
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!userId) { setSettings(DEFAULT_GCAL_IMPORT_SETTINGS); setLoaded(false); return }
    const { data, error } = await supabase
      .from('sales_gcal_import_settings')
      .select('rules, use_invitees, import_all_invitees, ignored_emails, processed_keys, last_synced_at, last_sync_error, last_created_count')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) console.error('[GcalImport] load:', error.message)
    if (data) {
      const { last_synced_at, last_sync_error, last_created_count, ...rest } = data as any
      setSettings({ ...DEFAULT_GCAL_IMPORT_SETTINGS, ...rest })
      setStatus({ last_synced_at, last_sync_error, last_created_count: last_created_count || 0 })
    } else {
      setSettings(DEFAULT_GCAL_IMPORT_SETTINGS)
    }
    setLoaded(true)
  }, [userId])

  useEffect(() => { load() }, [load])

  // Les autres instances du hook (importeur, modale) se rechargent après un enregistrement.
  useEffect(() => {
    const onChange = () => { load() }
    window.addEventListener(CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CHANGED_EVENT, onChange)
  }, [load])

  /** Enregistre les réglages modifiables ; processed_keys et l'état de synchro restent gérés par le serveur. */
  const save = useCallback(async (patch: EditableSettings) => {
    if (!userId) return
    const { error } = await supabase.from('sales_gcal_import_settings').upsert({
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    setSettings(prev => ({ ...prev, ...patch }))
    window.dispatchEvent(new Event(CHANGED_EVENT))
  }, [userId])

  const reload = useCallback(async () => {
    await load()
  }, [load])

  return { settings, status, loaded, save, reload }
}
