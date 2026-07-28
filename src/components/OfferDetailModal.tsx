import React, { useState, useEffect, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  Receipt,
  Link,
  Info,
  Copy,
  BoxSelect,
  Loader2,
  RefreshCw,
  Plus,
  Users,
  Save,
  X,
  Pencil,
  Trash2,
  User,
  FileText,
  Euro,
  ExternalLink,
  Tag,
  UserPlus,
  Database,
  ChevronDown,
  Key,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ContactSelector } from './ContactSelector'
import { useInternalContacts } from '../contexts/InternalContactsContext'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useCustomStages } from '../hooks/useCustomStages'
export { type Offer, type OfferContact, type OfferResource, type OfferFormula } from '../contexts/OffersContext'
import { type Offer, type OfferContact, type OfferResource, type OfferFormula } from '../contexts/OffersContext'

// Types are now imported from OffersContext

interface OfferDetailModalProps {
  offer: Offer
  onClose: () => void
  onUpdate: (updatedOffer: Offer) => void
  onDelete?: (id: number) => void
}

// Helper function to extract numbers from strings
const parseNumber = (value: string): number => {
  const cleaned = value.replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/,/g, '.')
  const withoutSpaces = normalized.replace(/\s/g, '')
  const parsed = parseFloat(withoutSpaces)
  return isNaN(parsed) ? 0 : parsed
}

// Helper function to calculate commission amount
const calculateCommission = (price: string, commission: string): number => {
  const priceNum = parseNumber(price)
  const commissionNum = parseNumber(commission)
  return (priceNum * commissionNum) / 100
}

export function OfferDetailModal({ offer, onClose, onUpdate, onDelete }: OfferDetailModalProps) {
  const { contacts: globalContacts, addContact } = useInternalContacts()
  const { user } = useAuth()
  const { lang } = useLanguage()
  const { allStages } = useCustomStages()

  const [isEditing, setIsEditing] = useState(false)

  const [isCreatingContact, setIsCreatingContact] = useState(false)
  const [newContactData, setNewContactData] = useState({ name: '', role: '', email: '', phone: '' })

  // État pour le feedback de copie
  const [hasCopied, setHasCopied] = useState(false)

  // États HubSpot
  const [hubspotConnected, setHubspotConnected] = useState(false)
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false)
  const [hubspotSyncResult, setHubspotSyncResult] = useState<{ imported: number; updated: number } | null>(null)

  // États GoHighLevel
  const [ghlConnected, setGhlConnected] = useState(false)
  const [isSyncingGhl, setIsSyncingGhl] = useState(false)
  const [ghlSyncResult, setGhlSyncResult] = useState<{ imported: number; updated: number } | null>(null)
  const [ghlPipelines, setGhlPipelines] = useState<any[]>([])
  const [ghlStages, setGhlStages] = useState<any[]>([])

  // États Pipedrive
  const [pipedriveConnected, setPipedriveConnected] = useState(false)
  const [isSyncingPipedrive, setIsSyncingPipedrive] = useState(false)
  const [pipedriveSyncResult, setPipedriveSyncResult] = useState<{ imported: number; updated: number } | null>(null)
  const [pipedrivePipelines, setPipedrivePipelines] = useState<any[]>([])
  const [pipedriveStages, setPipedriveStages] = useState<any[]>([])
  const [pipedriveMappings, setPipedriveMappings] = useState<{ [key: string]: number }>({})

  // États Systeme.io
  const [systemeioApiKey, setSystemeioApiKey] = useState('')
  const [systemeioSaving, setSystemeioSaving] = useState(false)
  const [systemeioCopiedUrl, setSystemeioCopiedUrl] = useState(false)
  const [systemeioShowKey, setSystemeioShowKey] = useState(false)

  // États Airtable (OAuth)
  const [airtableConnected, setAirtableConnected] = useState(false)
  const [airtableBases, setAirtableBases] = useState<any[]>([])
  const [airtableTables, setAirtableTables] = useState<any[]>([])
  const [airtableFields, setAirtableFields] = useState<any[]>([])
  const [airtableLoadingBases, setAirtableLoadingBases] = useState(false)
  const [airtableLoadingTables, setAirtableLoadingTables] = useState(false)
  const [airtableLoadingFields, setAirtableLoadingFields] = useState(false)
  const [isSyncingAirtable, setIsSyncingAirtable] = useState(false)
  const [airtableSyncResult, setAirtableSyncResult] = useState<{ imported: number; updated: number } | null>(null)

  // États Zapier
  const [zapierApiKey, setZapierApiKey] = useState<string | null>(null)
  const [zapierKeyId, setZapierKeyId] = useState<string | null>(null)
  const [zapierLoading, setZapierLoading] = useState(false)
  const [zapierCopiedUrl, setZapierCopiedUrl] = useState(false)
  const [zapierCopiedKey, setZapierCopiedKey] = useState(false)
  const [zapierShowKey, setZapierShowKey] = useState(false)

  // États Make
  const [makeApiKey, setMakeApiKey] = useState<string | null>(null)
  const [makeKeyId, setMakeKeyId] = useState<string | null>(null)
  const [makeLoading, setMakeLoading] = useState(false)
  const [makeCopiedUrl, setMakeCopiedUrl] = useState(false)
  const [makeCopiedKey, setMakeCopiedKey] = useState(false)
  const [makeShowKey, setMakeShowKey] = useState(false)

  // n8n
  const [n8nApiKey, setN8nApiKey] = useState<string | null>(null)
  const [n8nKeyId, setN8nKeyId] = useState<string | null>(null)
  const [n8nLoading, setN8nLoading] = useState(false)
  const [n8nCopiedUrl, setN8nCopiedUrl] = useState(false)
  const [n8nCopiedKey, setN8nCopiedKey] = useState(false)
  const [n8nShowKey, setN8nShowKey] = useState(false)

  // États iClosed
  const [iclosedTesting, setIclosedTesting] = useState(false)
  const [iclosedRegenerating, setIclosedRegenerating] = useState(false)
  const [iclosedShowPushKey, setIclosedShowPushKey] = useState(false)
  const [iclosedCopiedUrl, setIclosedCopiedUrl] = useState(false)
  const [iclosedCopiedKey, setIclosedCopiedKey] = useState(false)
  const [iclosedMappingRows, setIclosedMappingRows] = useState<Array<{ name: string; stage: string }>>([])
  const [iclosedSyncing, setIclosedSyncing] = useState(false)
  const [iclosedSyncResult, setIclosedSyncResult] = useState<{ imported: number; updated: number } | null>(null)

  const [editedOffer, setEditedOffer] = useState<Offer>(() => {
    if (!offer.formulas || offer.formulas.length === 0) {
      return {
        ...offer,
        formulas: [{
          id: Date.now().toString(),
          name: 'Standard',
          price: offer.price,
          commission: offer.commission
        }]
      }
    }
    return offer
  })

  // --- CALCUL DE L'URL WEBHOOK INTELLIGENTE ---
  const baseUrl = window.location.origin.includes('localhost')
    ? 'https://closeos.fr'
    : window.location.origin

  // On ajoute &formula_id=XYZ si une formule par défaut est sélectionnée
  const webhookUrl = `${baseUrl}/api/webhook?offer_id=${offer.id}${editedOffer.defaultFormulaId ? `&formula_id=${editedOffer.defaultFormulaId}` : ''}`

  const [tempResName, setTempResName] = useState('')
  const [tempResLink, setTempResLink] = useState('')

  useEffect(() => {
    setEditedOffer(offer)
  }, [offer])

  // Check if HubSpot is connected for this user
  useEffect(() => {
    const checkHubspot = async () => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('hubspot_access_token').eq('id', user.id).single()
      setHubspotConnected(!!data?.hubspot_access_token)
    }
    checkHubspot()

    // Check URL params for hubspot_connected
    const params = new URLSearchParams(window.location.search)
    if (params.get('hubspot_connected') === 'true') {
      setHubspotConnected(true)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('hubspot_error')) {
      alert((lang === 'fr' ? 'Erreur connexion HubSpot: ' : 'HubSpot connection error: ') + params.get('hubspot_error'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user])

  // HubSpot OAuth
  const handleConnectHubspot = () => {
    const clientId = '4ffa6fe0-353d-4275-9998-2bada782b56c'
    const redirectUri = 'https://www.closeos.fr/api/hubspot/callback'
    const scopes = 'crm.objects.contacts.write oauth crm.objects.deals.read crm.objects.deals.write crm.objects.contacts.read'
    const state = user?.id
    window.location.href = `https://app-eu1.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`
  }

  // HubSpot Sync
  const handleSyncHubspot = async () => {
    if (!user) return
    setIsSyncingHubspot(true)
    setHubspotSyncResult(null)
    try {
      const res = await fetch('/api/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, offer_id: offer.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setHubspotSyncResult({ imported: data.imported, updated: data.updated })
      } else {
        alert((lang === 'fr' ? 'Erreur sync HubSpot: ' : 'HubSpot sync error: ') + (data.error || (lang === 'fr' ? 'Erreur inconnue' : 'Unknown error')))
      }
    } catch (e: any) {
      alert((lang === 'fr' ? 'Erreur sync HubSpot: ' : 'HubSpot sync error: ') + e.message)
    } finally {
      setIsSyncingHubspot(false)
    }
  }

  // Check if Pipedrive is connected
  useEffect(() => {
    const checkPipedrive = async () => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('pipedrive_access_token').eq('id', user.id).single()
      setPipedriveConnected(!!data?.pipedrive_access_token)
    }
    checkPipedrive()

    const params = new URLSearchParams(window.location.search)
    if (params.get('pipedrive_connected') === 'true') {
      setPipedriveConnected(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user])

  // Load Pipedrive mapping and metadata
  useEffect(() => {
    const loadMapping = async () => {
      if (!user || editedOffer.crmProvider !== 'pipedrive') return
      const { data } = await supabase.from('pipedrive_stage_mapping').select('*').eq('offer_id', offer.id)
      if (data) {
        const m: any = {}
        data.forEach((row: any) => m[row.closeos_stage] = row.pipedrive_stage_id)
        setPipedriveMappings(m)
      }
    }
    loadMapping()
  }, [user, editedOffer.crmProvider, offer.id])

  useEffect(() => {
    const fetchPipedriveMeta = async () => {
      if (!user || !pipedriveConnected || editedOffer.crmProvider !== 'pipedrive') return
      try {
        const res = await fetch(`/api/pipedrive?action=pipelines&user_id=${user.id}`)
        const data = await res.json()
        if (data.pipelines) setPipedrivePipelines(data.pipelines)
        if (data.stages) setPipedriveStages(data.stages)
      } catch (err) {
        console.error('Error fetching Pipedrive meta:', err)
      }
    }
    fetchPipedriveMeta()
  }, [user, pipedriveConnected, editedOffer.crmProvider])

  const handleConnectPipedrive = () => {
    const clientId = 'd8a07042c2506596'
    const redirectUri = 'https://www.closeos.fr/api/pipedrive/callback'
    const state = user?.id
    window.location.href = `https://oauth.pipedrive.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
  }

  const handleSyncPipedrive = async () => {
    if (!user) return
    setIsSyncingPipedrive(true)
    setPipedriveSyncResult(null)
    try {
      const res = await fetch('/api/pipedrive?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, offer_id: offer.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setPipedriveSyncResult({ imported: data.imported, updated: data.updated })
      } else {
        alert((lang === 'fr' ? 'Erreur sync Pipedrive: ' : 'Pipedrive sync error: ') + (data.error || (lang === 'fr' ? 'Erreur inconnue' : 'Unknown error')))
      }
    } catch (e: any) {
      alert((lang === 'fr' ? 'Erreur sync Pipedrive: ' : 'Pipedrive sync error: ') + e.message)
    } finally {
      setIsSyncingPipedrive(false)
    }
  }

  const handleUpdatePipedriveMapping = async (coStage: string, pStageId: number) => {
    const newMappings = { ...pipedriveMappings, [coStage]: pStageId }
    setPipedriveMappings(newMappings)

    // Auto-save mapping
    try {
      await fetch('/api/pipedrive?action=saveMapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, offer_id: offer.id, mappings: newMappings })
      })
    } catch (err) {
      console.error('Error saving Pipedrive mapping:', err)
    }
  }

  const handleDisconnectPipedrive = async () => {
    if (!user || !window.confirm(lang === 'fr' ? 'Déconnecter Pipedrive ?' : 'Disconnect Pipedrive?')) return
    await supabase.from('profiles').update({
      pipedrive_access_token: null,
      pipedrive_refresh_token: null,
      pipedrive_token_expires_at: null,
      pipedrive_api_domain: null,
    }).eq('id', user.id)
    setPipedriveConnected(false)
  }

  // HubSpot Disconnect
  const handleDisconnectHubspot = async () => {
    if (!user || !window.confirm(lang === 'fr' ? 'Déconnecter HubSpot ?' : 'Disconnect HubSpot?')) return
    await supabase.from('profiles').update({
      hubspot_access_token: null,
      hubspot_refresh_token: null,
      hubspot_token_expires_at: null,
      hubspot_portal_id: null,
    }).eq('id', user.id)
    setHubspotConnected(false)
  }

  // Check if GoHighLevel is connected
  useEffect(() => {
    const checkGhl = async () => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('ghl_access_token').eq('id', user.id).single()
      setGhlConnected(!!data?.ghl_access_token)
    }
    checkGhl()

    const params = new URLSearchParams(window.location.search)
    if (params.get('ghl_connected') === 'true') {
      setGhlConnected(true)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('ghl_error')) {
      alert((lang === 'fr' ? 'Erreur connexion GoHighLevel: ' : 'GoHighLevel connection error: ') + params.get('ghl_error'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user])

  // Load GHL pipelines & stages
  useEffect(() => {
    const fetchGhlMeta = async () => {
      if (!user || !ghlConnected || editedOffer.crmProvider !== 'gohighlevel') return
      try {
        const res = await fetch(`/api/ghll?action=pipelines&user_id=${user.id}`)
        const data = await res.json()
        if (data.pipelines) setGhlPipelines(data.pipelines)
        if (data.stages) setGhlStages(data.stages)
      } catch (err) {
        console.error('Error fetching GHL pipelines:', err)
      }
    }
    fetchGhlMeta()
  }, [user, ghlConnected, editedOffer.crmProvider])

  const handleConnectGhl = () => {
    const clientId = '69beebc7d57c763956c7f6f9-mn0pott1'
    const redirectUri = 'https://www.closeos.fr/api/ghll/callback'
    const scopes = 'contacts.readonly contacts.write opportunities.readonly opportunities.write locations.readonly'
    const state = user?.id
    window.location.href = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${state}`
  }

  const handleSyncGhl = async () => {
    if (!user) return
    setIsSyncingGhl(true)
    setGhlSyncResult(null)
    try {
      const res = await fetch('/api/ghll?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, offer_id: offer.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setGhlSyncResult({ imported: data.imported, updated: data.updated })
      } else {
        alert((lang === 'fr' ? 'Erreur sync GoHighLevel: ' : 'GoHighLevel sync error: ') + (data.error || (lang === 'fr' ? 'Erreur inconnue' : 'Unknown error')))
      }
    } catch (e: any) {
      alert((lang === 'fr' ? 'Erreur sync GoHighLevel: ' : 'GoHighLevel sync error: ') + e.message)
    } finally {
      setIsSyncingGhl(false)
    }
  }

  const handleUpdateGhlMapping = (coStage: string, ghlStageId: string) => {
    setEditedOffer({
      ...editedOffer,
      crmMapping: { ...editedOffer.crmMapping, [coStage]: ghlStageId }
    })
  }

  const handleDisconnectGhl = async () => {
    if (!user || !window.confirm(lang === 'fr' ? 'Déconnecter GoHighLevel ?' : 'Disconnect GoHighLevel?')) return
    await supabase.from('profiles').update({
      ghl_access_token: null,
      ghl_refresh_token: null,
      ghl_token_expires_at: null,
      ghl_location_id: null,
    }).eq('id', user.id)
    setGhlConnected(false)
  }

  // Load existing Zapier API key
  useEffect(() => {
    if (editedOffer.crmProvider !== 'zapier' || !user) return
    const load = async () => {
      const { data } = await supabase
        .from('webhook_keys')
        .select('id, api_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single()
      if (data) {
        setZapierApiKey(data.api_key)
        setZapierKeyId(data.id)
      } else {
        setZapierApiKey(null)
        setZapierKeyId(null)
      }
    }
    load()
  }, [editedOffer.crmProvider, user])

  // Load Systeme.io API key
  useEffect(() => {
    if (editedOffer.crmProvider !== 'systemeio' || !user) return
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('systemeio_api_key')
        .eq('id', user.id)
        .single()
      setSystemeioApiKey(data?.systemeio_api_key || '')
    }
    load()
  }, [editedOffer.crmProvider, user])

  // ── iClosed: load mapping rows from editedOffer when modal opens / provider changes ──
  useEffect(() => {
    if (editedOffer.crmProvider !== 'iclosed') return
    const raw = editedOffer.iclosedStageMapping
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      setIclosedMappingRows(Object.entries(raw).map(([name, stage]) => ({ name, stage: String(stage) })))
    } else {
      setIclosedMappingRows([])
    }
  }, [editedOffer.crmProvider, editedOffer.id, editedOffer.iclosedStageMapping])

  const iclosedInboundUrl = editedOffer.crmApiKey
    ? `${baseUrl}/api/webhooks?action=iclosed-sales-webhook&offer_id=${editedOffer.id}&api_key=${editedOffer.crmApiKey}`
    : ''

  const handleRegenerateIclosedInboundKey = async () => {
    setIclosedRegenerating(true)
    try {
      const arr = new Uint8Array(32)
      crypto.getRandomValues(arr)
      const newKey = 'ic_' + Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
      setEditedOffer({ ...editedOffer, crmApiKey: newKey })
      await supabase.from('offers').update({ crm_api_key: newKey }).eq('id', editedOffer.id)
    } finally {
      setIclosedRegenerating(false)
    }
  }

  const handleTestIclosedPushKey = async () => {
    setIclosedTesting(true)
    try {
      const candidate = (editedOffer.iclosedPushKey || '').trim()
      if (candidate && !candidate.startsWith('iclosed_')) {
        alert(lang === 'fr' ? 'La clé doit commencer par "iclosed_"' : 'Key must start with "iclosed_"')
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken) {
        alert(lang === 'fr' ? 'Session expirée — reconnectez-vous' : 'Session expired — sign in again')
        return
      }
      const res = await fetch('/api/webhooks?action=iclosed-sales-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ offer_id: editedOffer.id, api_key: candidate || undefined }),
      })
      const json = await res.json()
      if (json?.ok) {
        alert(lang === 'fr' ? 'Connexion iClosed OK' : 'iClosed connection OK')
      } else {
        const code = json?.code || 'unknown'
        const msg =
          code === 'auth' ? (lang === 'fr' ? 'Clé iClosed invalide ou expirée' : 'Invalid or expired iClosed key') :
          code === 'config' ? (lang === 'fr' ? 'Aucune clé iClosed configurée' : 'No iClosed key configured') :
          code === 'rate_limit' ? (lang === 'fr' ? 'Limite iClosed atteinte, réessayez' : 'iClosed rate-limited, retry') :
          (json?.message || (lang === 'fr' ? 'Échec de la connexion' : 'Connection failed'))
        alert(msg)
      }
    } finally {
      setIclosedTesting(false)
    }
  }

  const handleAddIclosedMappingRow = () => {
    setIclosedMappingRows(prev => [...prev, { name: '', stage: 'prospect' }])
  }
  const handleRemoveIclosedMappingRow = (index: number) => {
    setIclosedMappingRows(prev => prev.filter((_, i) => i !== index))
  }
  const handleUpdateIclosedMappingRow = (index: number, field: 'name' | 'stage', value: string) => {
    setIclosedMappingRows(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }
  const handleSaveIclosedMapping = () => {
    const obj: Record<string, string> = {}
    for (const m of iclosedMappingRows) {
      const k = (m.name || '').trim()
      if (!k) continue
      obj[k] = m.stage
    }
    setEditedOffer({ ...editedOffer, iclosedStageMapping: obj })
  }

  const handleSyncIclosedNow = async () => {
    setIclosedSyncing(true)
    setIclosedSyncResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken) {
        alert(lang === 'fr' ? 'Session expirée — reconnectez-vous' : 'Session expired — sign in again')
        return
      }
      let totalImported = 0
      let totalUpdated = 0
      let nextPage: number | null = 0
      for (let safety = 0; safety < 20; safety++) {
        const res = await fetch('/api/webhooks?action=iclosed-sync-sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ offer_id: editedOffer.id, startPage: nextPage }),
        })
        const json: any = await res.json()
        if (!json?.ok) {
          alert(json?.message || (lang === 'fr' ? 'Erreur synchronisation iClosed' : 'iClosed sync error'))
          return
        }
        totalImported += Number(json.imported || 0)
        totalUpdated += Number(json.updated || 0)
        if (!json.partial) break
        nextPage = Number(json.nextPage || 0)
        if (!nextPage) break
      }
      setIclosedSyncResult({ imported: totalImported, updated: totalUpdated })
    } finally {
      setIclosedSyncing(false)
    }
  }

  const handleSaveSystemeioKey = async () => {
    if (!user) return
    setSystemeioSaving(true)
    try {
      await supabase
        .from('profiles')
        .update({ systemeio_api_key: systemeioApiKey || null })
        .eq('id', user.id)
    } catch (err) {
      console.error('Error saving Systeme.io key:', err)
    } finally {
      setSystemeioSaving(false)
    }
  }

  const handleGenerateZapierKey = async () => {
    if (!user) return
    setZapierLoading(true)
    try {
      const array = new Uint8Array(32)
      crypto.getRandomValues(array)
      const newKey = 'zk_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('')

      const { data, error } = await supabase
        .from('webhook_keys')
        .insert({ user_id: user.id, api_key: newKey, name: 'Zapier' })
        .select()
        .single()

      if (error) throw error
      setZapierApiKey(newKey)
      setZapierKeyId(data.id)
      setZapierShowKey(true)
    } catch (err) {
      console.error('Error generating Zapier key:', err)
    } finally {
      setZapierLoading(false)
    }
  }

  const handleDeleteZapierKey = async () => {
    if (!zapierKeyId || !window.confirm(lang === 'fr' ? 'Supprimer cette clé API ? Les Zaps connectés ne fonctionneront plus.' : 'Delete this API key? Connected Zaps will stop working.')) return
    setZapierLoading(true)
    try {
      await supabase.from('webhook_keys').delete().eq('id', zapierKeyId)
      setZapierApiKey(null)
      setZapierKeyId(null)
      setZapierShowKey(false)
    } catch (err) {
      console.error('Error deleting Zapier key:', err)
    } finally {
      setZapierLoading(false)
    }
  }

  // Load existing Make API key
  useEffect(() => {
    if (editedOffer.crmProvider !== 'make' || !user) return
    const load = async () => {
      const { data } = await supabase
        .from('webhook_keys')
        .select('id, api_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('name', 'Make')
        .limit(1)
        .maybeSingle()
      if (data) {
        setMakeApiKey(data.api_key)
        setMakeKeyId(data.id)
      } else {
        setMakeApiKey(null)
        setMakeKeyId(null)
      }
    }
    load()
  }, [editedOffer.crmProvider, user])

  const handleGenerateMakeKey = async () => {
    if (!user) return
    setMakeLoading(true)
    try {
      const array = new Uint8Array(32)
      crypto.getRandomValues(array)
      const newKey = 'mk_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
      const { data, error } = await supabase
        .from('webhook_keys')
        .insert({ user_id: user.id, api_key: newKey, name: 'Make' })
        .select()
        .single()
      if (error) throw error
      setMakeApiKey(newKey)
      setMakeKeyId(data.id)
      setMakeShowKey(true)
    } catch (err) {
      console.error('Error generating Make key:', err)
    } finally {
      setMakeLoading(false)
    }
  }

  const handleDeleteMakeKey = async () => {
    if (!makeKeyId || !window.confirm(lang === 'fr' ? 'Supprimer cette clé API ? Les scénarios Make connectés ne fonctionneront plus.' : 'Delete this API key? Connected Make scenarios will stop working.')) return
    setMakeLoading(true)
    try {
      await supabase.from('webhook_keys').delete().eq('id', makeKeyId)
      setMakeApiKey(null)
      setMakeKeyId(null)
      setMakeShowKey(false)
    } catch (err) {
      console.error('Error deleting Make key:', err)
    } finally {
      setMakeLoading(false)
    }
  }

  // Load existing n8n API key
  useEffect(() => {
    if (editedOffer.crmProvider !== 'n8n' || !user) return
    const load = async () => {
      const { data } = await supabase
        .from('webhook_keys')
        .select('id, api_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('name', 'n8n')
        .limit(1)
        .maybeSingle()
      if (data) {
        setN8nApiKey(data.api_key)
        setN8nKeyId(data.id)
      } else {
        setN8nApiKey(null)
        setN8nKeyId(null)
      }
    }
    load()
  }, [editedOffer.crmProvider, user])

  const handleGenerateN8nKey = async () => {
    if (!user) return
    setN8nLoading(true)
    try {
      const array = new Uint8Array(32)
      crypto.getRandomValues(array)
      const newKey = 'n8_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
      const { data, error } = await supabase
        .from('webhook_keys')
        .insert({ user_id: user.id, api_key: newKey, name: 'n8n' })
        .select()
        .single()
      if (error) throw error
      setN8nApiKey(newKey)
      setN8nKeyId(data.id)
      setN8nShowKey(true)
    } catch (err) {
      console.error('Error generating n8n key:', err)
    } finally {
      setN8nLoading(false)
    }
  }

  const handleDeleteN8nKey = async () => {
    if (!n8nKeyId || !window.confirm(lang === 'fr' ? 'Supprimer cette clé API ? Les workflows n8n connectés ne fonctionneront plus.' : 'Delete this API key? Connected n8n workflows will stop working.')) return
    setN8nLoading(true)
    try {
      await supabase.from('webhook_keys').delete().eq('id', n8nKeyId)
      setN8nApiKey(null)
      setN8nKeyId(null)
      setN8nShowKey(false)
    } catch (err) {
      console.error('Error deleting n8n key:', err)
    } finally {
      setN8nLoading(false)
    }
  }

  // Check Airtable connection + listen for OAuth callback
  useEffect(() => {
    if (!user) return
    const checkAirtable = async () => {
      const { data } = await supabase.from('profiles').select('airtable_access_token').eq('id', user.id).single()
      setAirtableConnected(!!data?.airtable_access_token)
    }
    checkAirtable()

    const params = new URLSearchParams(window.location.search)
    if (params.get('airtable_connected') === 'true') {
      setAirtableConnected(true)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('airtable_error')) {
      alert((lang === 'fr' ? 'Erreur connexion Airtable: ' : 'Airtable connection error: ') + params.get('airtable_error'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user])

  // Load Airtable bases when connected
  useEffect(() => {
    if (editedOffer.crmProvider !== 'airtable' || !airtableConnected || !user) return
    const load = async () => {
      setAirtableLoadingBases(true)
      try {
        const res = await fetch('/api/webhooks?action=airtable-bases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        })
        if (res.ok) {
          const data = await res.json()
          setAirtableBases(data.bases || [])
        }
      } catch (err) {
        console.error('Error loading Airtable bases:', err)
      } finally {
        setAirtableLoadingBases(false)
      }
    }
    load()
  }, [editedOffer.crmProvider, airtableConnected, user])

  // Load Airtable tables when base is selected
  useEffect(() => {
    const baseId = editedOffer.crmMapping?.airtableBaseId
    if (editedOffer.crmProvider !== 'airtable' || !airtableConnected || !user || !baseId) return
    const load = async () => {
      setAirtableLoadingTables(true)
      try {
        const res = await fetch('/api/webhooks?action=airtable-tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, base_id: baseId }),
        })
        if (res.ok) {
          const data = await res.json()
          setAirtableTables(data.tables || [])
        }
      } catch (err) {
        console.error('Error loading Airtable tables:', err)
      } finally {
        setAirtableLoadingTables(false)
      }
    }
    load()
  }, [editedOffer.crmProvider, airtableConnected, user, editedOffer.crmMapping?.airtableBaseId])

  // Load Airtable fields when table is selected
  useEffect(() => {
    const baseId = editedOffer.crmMapping?.airtableBaseId
    const tableId = editedOffer.crmMapping?.airtableTableId
    if (editedOffer.crmProvider !== 'airtable' || !airtableConnected || !user || !baseId || !tableId) return
    const load = async () => {
      setAirtableLoadingFields(true)
      try {
        const res = await fetch('/api/webhooks?action=airtable-fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, base_id: baseId, table_id: tableId }),
        })
        if (res.ok) {
          const data = await res.json()
          setAirtableFields(data.fields || [])
        }
      } catch (err) {
        console.error('Error loading Airtable fields:', err)
      } finally {
        setAirtableLoadingFields(false)
      }
    }
    load()
  }, [editedOffer.crmProvider, airtableConnected, user, editedOffer.crmMapping?.airtableBaseId, editedOffer.crmMapping?.airtableTableId])

  const handleConnectAirtable = () => {
    if (!user) return
    window.location.href = `/api/webhooks?action=airtable-authorize&user_id=${user.id}`
  }

  const handleSyncAirtable = async () => {
    if (!user) return
    setIsSyncingAirtable(true)
    setAirtableSyncResult(null)
    try {
      const res = await fetch('/api/webhooks?action=airtable-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, offer_id: offer.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setAirtableSyncResult({ imported: data.imported, updated: data.updated })
      }
    } catch (err) {
      console.error('Error syncing Airtable:', err)
    } finally {
      setIsSyncingAirtable(false)
    }
  }

  const updateAirtableMapping = (key: string, value: string) => {
    setEditedOffer(prev => ({
      ...prev,
      crmMapping: {
        ...prev.crmMapping,
        airtableFieldMapping: {
          ...(prev.crmMapping?.airtableFieldMapping as any || {}),
          [key]: value,
        },
      },
    }))
  }

  const systemeioWebhookUrl = `${baseUrl}/api/systemeio?action=webhook&user_id=${user?.id}&offer_id=${offer.id}${editedOffer.defaultFormulaId ? `&formula_id=${editedOffer.defaultFormulaId}` : ''}`
  const zapierWebhookUrl = `${baseUrl}/api/zapier-webhook?type=sales&offer_id=${offer.id}${editedOffer.defaultFormulaId ? `&formula_id=${editedOffer.defaultFormulaId}` : ''}`
  const makeWebhookUrl = zapierWebhookUrl // Same endpoint, different key
  const n8nWebhookUrl = zapierWebhookUrl // Same endpoint, different key

  const handleSave = () => {
    const mainFormula = editedOffer.formulas && editedOffer.formulas.length > 0
      ? editedOffer.formulas[0]
      : { price: '0', commission: '0' }

    const finalOffer = {
      ...editedOffer,
      price: mainFormula.price,
      commission: mainFormula.commission
    }

    onUpdate(finalOffer)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedOffer(offer)
    setIsEditing(false)
    setIsCreatingContact(false)
  }

  const handleDelete = () => {
    if (confirm(lang === 'fr' ? `Êtes-vous sûr de vouloir supprimer l'offre "${offer.name}" ?` : `Are you sure you want to delete the offer "${offer.name}"?`)) {
      if (onDelete) {
        onDelete(offer.id)
      }
      onClose()
    }
  }

  const handleCreateAndAttachContact = async () => {
    if (!newContactData.name || !newContactData.email) {
      alert(lang === 'fr' ? "Le nom et l'email sont requis." : "Name and email are required.")
      return
    }

    try {
      const result = await addContact(newContactData)
      const createdId = result?.data?.[0]?.id || Date.now()

      const contactToAdd: OfferContact = {
        id: createdId,
        name: newContactData.name,
        role: newContactData.role
      }

      setEditedOffer(prev => ({
        ...prev,
        contacts: [...prev.contacts, contactToAdd]
      }))

      setNewContactData({ name: '', role: '', email: '', phone: '' })
      setIsCreatingContact(false)

    } catch (error) {
      console.error("Erreur création contact", error)
      alert(lang === 'fr' ? "Impossible de créer le contact." : "Unable to create the contact.")
    }
  }

  // --- GESTION DU COPIER WEBHOOK ---
  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }

  // --- GESTION DES FORMULES ---
  const handleAddFormula = () => {
    const newFormula: OfferFormula = {
      id: Date.now().toString(),
      name: `${lang === 'fr' ? 'Formule' : 'Formula'} ${editedOffer.formulas?.length ? editedOffer.formulas.length + 1 : 1}`,
      price: '0',
      commission: '10'
    }
    setEditedOffer({
      ...editedOffer,
      formulas: [...(editedOffer.formulas || []), newFormula]
    })
  }

  const handleUpdateFormula = (id: string, field: keyof OfferFormula, value: string) => {
    setEditedOffer({
      ...editedOffer,
      formulas: editedOffer.formulas?.map(f =>
        f.id === id ? { ...f, [field]: value } : f
      )
    })
  }

  const handleRemoveFormula = (id: string) => {
    if ((editedOffer.formulas?.length || 0) <= 1) {
      alert(lang === 'fr' ? "Il faut au moins une formule." : "At least one formula is required.")
      return
    }
    setEditedOffer({
      ...editedOffer,
      formulas: editedOffer.formulas?.filter(f => f.id !== id)
    })
  }

  const handleAddResource = () => {
    if (!tempResName.trim() || !tempResLink.trim()) {
      alert(lang === 'fr' ? 'Veuillez remplir le nom et le lien de la ressource' : 'Please fill in the resource name and link')
      return
    }

    const newResource: OfferResource = {
      id: Date.now(),
      name: tempResName.trim(),
      url: tempResLink.trim(),
      type: 'other'
    }

    setEditedOffer({
      ...editedOffer,
      resources: [...editedOffer.resources, newResource]
    })

    setTempResName('')
    setTempResLink('')
  }

  const handleRemoveResource = (resourceId: number) => {
    setEditedOffer({
      ...editedOffer,
      resources: editedOffer.resources.filter(r => r.id !== resourceId)
    })
  }

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'script':
        return <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
      case 'payment':
        return <Euro className="h-4 w-4 text-sky-600 dark:text-sky-400" />
      case 'drive':
        return <ExternalLink className="h-4 w-4 text-sky-600 dark:text-sky-400" />
      default:
        return <ExternalLink className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] ring-1 ring-slate-200 custom-scrollbar animate-in fade-in zoom-in duration-300">

        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-sky-500/10 opacity-20 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-sky-500/10 opacity-10 blur-[80px] rounded-full pointer-events-none" />
        {/* Header Section */}
        <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-white/10 bg-white/80 backdrop-blur-md px-8 py-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.name}
                    onChange={(e) =>
                      setEditedOffer({ ...editedOffer, name: e.target.value })
                    }
                    className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-2 text-xl font-black text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none transition-all"
                  />
                ) : (
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{offer.name}</h2>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.status === 'active'
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-neutral-500'
                    }`}
                >
                  {offer.status === 'active' ? (lang === 'fr' ? 'Active' : 'Active') : (lang === 'fr' ? 'Archivée' : 'Archived')}
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedOffer.company}
                  onChange={(e) =>
                    setEditedOffer({ ...editedOffer, company: e.target.value })
                  }
                  className="mt-3 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-4 py-1.5 text-sm text-slate-400 dark:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                />
              ) : (
                <p className="mt-2 text-sm font-medium text-slate-400 dark:text-neutral-500 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                  {offer.company}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-lg shadow-sky-500/20 transition-all hover:bg-sky-600 active:scale-95"
                    title={lang === 'fr' ? 'Sauvegarder' : 'Save'}
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-neutral-400 transition-all hover:bg-slate-100 active:scale-95"
                    title={lang === 'fr' ? 'Annuler' : 'Cancel'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-neutral-500 transition-all hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 transition-all hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
              <div className="h-6 w-px bg-slate-100 dark:bg-white/10 mx-1" />
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-neutral-500 transition-all hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Target Type Toggle */}
          <div className="mb-10 relative z-10">
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
              {lang === 'fr' ? 'Cible Marketing' : 'Marketing Target'}
            </p>
            {isEditing ? (
              <div className="flex gap-4">
                <button
                  onClick={() => setEditedOffer({ ...editedOffer, target: 'B2C' })}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${editedOffer.target === 'B2C'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-neutral-500 hover:bg-slate-100'
                    }`}
                >
                  <User className="h-5 w-5" />
                  {lang === 'fr' ? 'B2C (Particuliers)' : 'B2C (Individuals)'}
                </button>
                <button
                  onClick={() => setEditedOffer({ ...editedOffer, target: 'B2B' })}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${editedOffer.target === 'B2B'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-neutral-500 hover:bg-slate-100'
                    }`}
                >
                  <Building2 className="h-5 w-5" />
                  {lang === 'fr' ? 'B2B (Entreprises)' : 'B2B (Businesses)'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 dark:border-white/10 bg-slate-50/30 px-6 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {offer.target === 'B2C' ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </div>
                <div>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {offer.target === 'B2C' ? (lang === 'fr' ? 'B2C (Particuliers)' : 'B2C (Individuals)') : (lang === 'fr' ? 'B2B (Entreprises)' : 'B2B (Businesses)')}
                  </span>
                  <p className="text-xs text-slate-400 dark:text-neutral-500 font-medium tracking-wide">{lang === 'fr' ? 'Configuration du pipeline adaptée' : 'Adapted pipeline configuration'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-8 md:grid-cols-2 relative z-10">
            {/* Zone A - Formules (Multi-Tarification) */}
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/30 p-6 backdrop-blur-md">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                  <Tag className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Formules & Tarifs' : 'Formulas & Pricing'}
                </h3>
                {isEditing && (
                  <button
                    onClick={handleAddFormula}
                    className="flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1.5 text-[10px] font-black text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    <Plus className="h-3 w-3" /> {lang === 'fr' ? 'Ajouter' : 'Add'}
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {(editedOffer.formulas || []).map((formula, index) => {
                  const comm = calculateCommission(formula.price, formula.commission)
                  return (
                    <div key={formula.id} className="relative rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-4 transition-all hover:border-slate-200 group/formula">
                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={formula.name}
                              onChange={(e) => handleUpdateFormula(formula.id, 'name', e.target.value)}
                              placeholder={lang === 'fr' ? 'Nom (ex: Pack Gold)' : 'Name (e.g.: Pack Gold)'}
                              className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-2 text-sm font-bold text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                            />
                            <button
                              onClick={() => handleRemoveFormula(formula.id)}
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">{lang === 'fr' ? 'Prix (€)' : 'Price (€)'}</p>
                              <input
                                type="number"
                                value={formula.price}
                                onChange={(e) => handleUpdateFormula(formula.id, 'price', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-2 text-sm text-slate-900 dark:text-white font-black focus:border-sky-500/50 focus:outline-none"
                              />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">{lang === 'fr' ? 'Com. (%)' : 'Com. (%)'}</p>
                              <input
                                type="number"
                                value={formula.commission}
                                onChange={(e) => handleUpdateFormula(formula.id, 'commission', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-2 text-sm text-sky-600 dark:text-sky-400 font-black focus:border-sky-500 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">{lang === 'fr' ? 'Gain estimé' : 'Estimated earnings'}</span>
                            <span className="text-xs font-black text-sky-600 dark:text-sky-400">{comm.toLocaleString()} €</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-black text-slate-900 dark:text-white text-sm tracking-tight">{formula.name}</h4>
                            <div className="flex items-center gap-3 mt-1.5 font-medium">
                              <span className="text-[10px] text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Commission {formula.commission}%</span>
                              <div className="h-1 w-1 rounded-full bg-slate-100 dark:bg-white/10" />
                              <span className="text-xs text-sky-600 dark:text-sky-400 font-bold">{comm.toLocaleString()} € / {lang === 'fr' ? 'vente' : 'sale'}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="inline-flex flex-col items-end">
                              <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{parseFloat(formula.price).toLocaleString()}€</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {(!editedOffer.formulas || editedOffer.formulas.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400 dark:text-neutral-500">
                    <Tag className="h-8 w-8 opacity-20" />
                    <p className="text-[11px] font-bold uppercase tracking-widest italic">{lang === 'fr' ? 'Aucune formule définie' : 'No formula defined'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Zone B - Context (Dates) */}
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/30 p-6 backdrop-blur-md">
              <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                <Calendar className="h-3.5 w-3.5" />
                {lang === 'fr' ? 'Validité Commerciale' : 'Commercial Validity'}
              </h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest mb-2 ml-1">{lang === 'fr' ? "Lancement de l'offre" : 'Offer launch'}</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedOffer.startDate}
                      onChange={(e) =>
                        setEditedOffer({ ...editedOffer, startDate: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none transition-all"
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{formatDate(offer.startDate)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest mb-2 ml-1">{lang === 'fr' ? 'Expiration prévue' : 'Expected expiration'}</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedOffer.endDate || ''}
                      onChange={(e) =>
                        setEditedOffer({ ...editedOffer, endDate: e.target.value || undefined })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none transition-all"
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500/80">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        {offer.endDate ? formatDate(offer.endDate) : (lang === 'fr' ? 'Illimitée' : 'Unlimited')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-8 rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/30 p-6 backdrop-blur-md relative z-10">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500 ml-1">
              {lang === 'fr' ? 'Description de la mission' : 'Mission description'}
            </h3>
            {isEditing ? (
              <textarea
                value={editedOffer.description}
                onChange={(e) =>
                  setEditedOffer({ ...editedOffer, description: e.target.value })
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-3 text-sm text-slate-900 dark:text-white font-medium focus:border-sky-500 focus:outline-none resize-none transition-all"
                placeholder={lang === 'fr' ? "Détails de l'offre, avatar client, etc." : "Offer details, client avatar, etc."}
              />
            ) : (
              <p className="text-sm leading-relaxed text-slate-500 dark:text-neutral-400 font-medium px-1">{offer.description}</p>
            )}
          </div>

          {/* Zone C - Contacts Rattachés - MODIFIÉ AVEC CRÉATION */}
          <div className="mt-6 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                <Users className="h-4 w-4" />
                {lang === 'fr' ? 'Contacts Rattachés' : 'Linked Contacts'}
              </h3>
              {/* BOUTON CRÉER CONTACT */}
              {isEditing && !isCreatingContact && (
                <button
                  onClick={() => setIsCreatingContact(true)}
                  className="flex items-center gap-1 rounded bg-sky-500/10 px-2 py-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
                >
                  <UserPlus className="h-3 w-3" /> {lang === 'fr' ? 'Nouveau Contact' : 'New Contact'}
                </button>
              )}
            </div>

            {/* FORMULAIRE CRÉATION RAPIDE */}
            {isEditing && isCreatingContact && (
              <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/5 p-4 animate-in fade-in slide-in-from-top-2">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase text-sky-600 dark:text-sky-400">{lang === 'fr' ? 'Ajout Rapide' : 'Quick Add'}</p>
                  <button onClick={() => setIsCreatingContact(false)} className="text-slate-400 dark:text-neutral-500 hover:text-slate-900"><X className="h-3 w-3" /></button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="text" placeholder={lang === 'fr' ? 'Nom complet *' : 'Full name *'} value={newContactData.name} onChange={(e) => setNewContactData({ ...newContactData, name: e.target.value })} className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none" />
                  <input type="text" placeholder={lang === 'fr' ? 'Rôle (ex: Closer) *' : 'Role (e.g.: Closer) *'} value={newContactData.role} onChange={(e) => setNewContactData({ ...newContactData, role: e.target.value })} className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none" />
                  <input type="email" placeholder="Email *" value={newContactData.email} onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })} className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none" />
                  <input type="tel" placeholder={lang === 'fr' ? 'Téléphone' : 'Phone'} value={newContactData.phone} onChange={(e) => setNewContactData({ ...newContactData, phone: e.target.value })} className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none" />
                </div>
                <button onClick={handleCreateAndAttachContact} className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-sky-600 py-2 text-sm font-bold text-white hover:bg-sky-600">
                  <Check className="h-4 w-4" /> {lang === 'fr' ? 'Créer et Attacher' : 'Create & Attach'}
                </button>
              </div>
            )}

            {isEditing ? (
              <ContactSelector
                selectedContactIds={editedOffer.contacts.map((c) => Number(c.id))}
                onAdd={(contactId: number) => {
                  const globalContact = globalContacts.find((c) => Number(c.id) === contactId)
                  if (globalContact) {
                    setEditedOffer({
                      ...editedOffer,
                      contacts: [
                        ...editedOffer.contacts,
                        { id: globalContact.id, name: globalContact.name, role: globalContact.role },
                      ],
                    })
                  }
                }}
                onRemove={(contactId: number) => {
                  setEditedOffer({
                    ...editedOffer,
                    contacts: editedOffer.contacts.filter((c) => Number(c.id) !== contactId),
                  })
                }}
              />
            ) : (
              <div className="space-y-2">
                {offer.contacts.length > 0 ? (
                  offer.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{contact.name}</p>
                        <p className="text-xs text-slate-400 dark:text-neutral-500">{contact.role}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Aucun contact rattaché' : 'No linked contacts'}</p>
                )}
              </div>
            )}
          </div>

          {/* Configuration Facturation */}
          <div className="mt-6 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
              <Receipt className="h-4 w-4" /> {lang === 'fr' ? 'Configuration Facturation' : 'Billing Configuration'}
            </h3>

            {/* Toggle Commission + Fixe */}
            <div className="mb-4 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{lang === 'fr' ? 'Type de rémunération' : 'Compensation type'}</p>
                  <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
                    {editedOffer.hasFixedFee ? (lang === 'fr' ? 'Commission + Fixe' : 'Commission + Fixed') : (lang === 'fr' ? 'Commission uniquement' : 'Commission only')}
                  </p>
                </div>
                {isEditing ? (
                  <button
                    onClick={() => setEditedOffer({ ...editedOffer, hasFixedFee: !editedOffer.hasFixedFee, fixedFeeAmount: editedOffer.hasFixedFee ? '' : (editedOffer.fixedFeeAmount || '') })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editedOffer.hasFixedFee ? 'bg-sky-600' : 'bg-slate-100 dark:bg-white/10'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white dark:bg-[#1a1a1a] transition-transform ${editedOffer.hasFixedFee ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                ) : (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.hasFixedFee
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-neutral-500'
                    }`}>
                    {offer.hasFixedFee ? (lang === 'fr' ? 'Commission + Fixe' : 'Commission + Fixed') : 'Commission'}
                  </span>
                )}
              </div>

              {/* Champ Montant Fixe (visible uniquement si activé) */}
              {editedOffer.hasFixedFee && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase">{lang === 'fr' ? 'Montant Fixe (€)' : 'Fixed Amount (€)'}</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editedOffer.fixedFeeAmount || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, fixedFeeAmount: e.target.value })}
                      placeholder="Ex: 500"
                      className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-sky-600 dark:text-sky-400 font-bold placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm font-bold text-sky-600 dark:text-sky-400">{parseFloat(offer.fixedFeeAmount || '0').toLocaleString()}€</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Raison Sociale */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase">{lang === 'fr' ? 'Raison Sociale' : 'Company Name'}</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.billingName || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, billingName: e.target.value })}
                    placeholder="Ex: ACME SAS"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-500 dark:text-neutral-400">{offer.billingName || (lang === 'fr' ? 'Non définie' : 'Not defined')}</p>
                )}
              </div>

              {/* Adresse */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase">{lang === 'fr' ? 'Adresse' : 'Address'}</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.billingAddress || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, billingAddress: e.target.value })}
                    placeholder="Ex: 123 Rue de la Paix"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-500 dark:text-neutral-400">{offer.billingAddress || (lang === 'fr' ? 'Non définie' : 'Not defined')}</p>
                )}
              </div>

              {/* Ville / CP / Pays */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase">{lang === 'fr' ? 'Ville' : 'City'}</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingCity || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingCity: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-neutral-400">{offer.billingCity || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase">{lang === 'fr' ? 'Code Postal' : 'Zip Code'}</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingZip || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingZip: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-neutral-400">{offer.billingZip || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase">{lang === 'fr' ? 'Pays' : 'Country'}</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingCountry || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingCountry: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-neutral-400">{offer.billingCountry || '-'}</p>
                  )}
                </div>
              </div>

              {/* SIRET */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase">{lang === 'fr' ? 'SIRET / TVA' : 'SIRET / VAT'}</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.siret || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, siret: e.target.value })}
                    placeholder="123 456 789 00012"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-500 dark:text-neutral-400 font-mono">{offer.siret || (lang === 'fr' ? 'Non défini' : 'Not defined')}</p>
                )}
              </div>

              {/* Email / Tel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase">{lang === 'fr' ? 'Email Facturation' : 'Billing Email'}</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editedOffer.billingEmail || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingEmail: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-neutral-400">{offer.billingEmail || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase">{lang === 'fr' ? 'Téléphone' : 'Phone'}</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingPhone || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingPhone: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-neutral-400">{offer.billingPhone || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* --- CONFIGURATION CRM (SIMPLIFIÉE AVEC FORMULE PAR DÉFAUT) --- */}
          <div className="mt-6 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-4">
            <h3 className="mb-4 flex items-center flex-wrap gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
              <span className="flex items-center gap-2">
                <Link className="h-4 w-4" /> {lang === 'fr' ? 'Synchronisation CRM' : 'CRM Synchronization'}
              </span>
              <span className="ml-2 text-[10px] font-bold normal-case text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                {lang === 'fr' ? "Note : Les leads précédents ne seront pas importés. Seuls les nouveaux à partir d'aujourd'hui seront synchronisés." : "Note: Previous leads will not be imported. Only new ones from today onward will be synced."}
              </span>
            </h3>

            {/* 1. CRM Settings */}
            <div className="mb-10 rounded-[20px] border border-slate-200 dark:border-white/10 bg-slate-50/30 p-6 backdrop-blur-md">
              <label className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                <Database className="h-3 w-3" /> {lang === 'fr' ? 'Source de données (CRM)' : 'Data Source (CRM)'}
              </label>
              {isEditing ? (
                <div className="relative">
                  <select
                    value={editedOffer.crmProvider || 'iclosed'}
                    onChange={(e) => setEditedOffer({ ...editedOffer, crmProvider: e.target.value as any })}
                    className="w-full appearance-none rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none transition-all"
                  >
                    <option value="iclosed">iClosed</option>
                    <option value="hubspot">HubSpot</option>
                    <option value="pipedrive">Pipedrive</option>
                    <option value="gohighlevel">GoHighLevel</option>
                    <option value="systemeio">Systeme.io</option>
                    <option value="airtable">Airtable</option>
                    <option value="zapier">Zapier</option>
                    <option value="make">Make</option>
                    <option value="n8n">n8n</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 dark:text-neutral-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${offer.crmProvider === 'iclosed' ? 'bg-sky-600' :
                    offer.crmProvider === 'hubspot' ? 'bg-orange-500' :
                      offer.crmProvider === 'pipedrive' ? 'bg-sky-600' :
                        offer.crmProvider === 'gohighlevel' ? 'bg-sky-600' :
                          offer.crmProvider === 'systemeio' ? 'bg-sky-600' :
                            offer.crmProvider === 'airtable' ? 'bg-[#18BFFF]' :
                              offer.crmProvider === 'zapier' ? 'bg-[#FF4A00]' :
                                offer.crmProvider === 'make' ? 'bg-[#6D00CC]' :
                                  offer.crmProvider === 'n8n' ? 'bg-[#EA4B71]' :
                                'bg-white/40'
                    }`} />
                  <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                    {offer.crmProvider === 'hubspot' ? 'HubSpot' :
                      offer.crmProvider === 'pipedrive' ? 'Pipedrive' :
                        offer.crmProvider === 'gohighlevel' ? 'GoHighLevel' :
                          offer.crmProvider === 'systemeio' ? 'Systeme.io' :
                            offer.crmProvider === 'airtable' ? 'Airtable' :
                              offer.crmProvider === 'zapier' ? 'Zapier' :
                                offer.crmProvider === 'make' ? 'Make' :
                                  offer.crmProvider === 'n8n' ? 'n8n' :
                                offer.crmProvider || 'iClosed'}
                  </p>
                </div>
              )}
            </div>

            {/* --- PIPEDRIVE CONFIG --- */}
            {editedOffer.crmProvider === 'pipedrive' && (
              <div className="mb-6 space-y-4">
                {!pipedriveConnected ? (
                  <button
                    onClick={handleConnectPipedrive}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white hover:bg-sky-600 transition-all shadow-lg"
                  >
                    <Link className="h-4 w-4" /> {lang === 'fr' ? 'Connecter Pipedrive' : 'Connect Pipedrive'}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">{lang === 'fr' ? 'Pipedrive Connecté' : 'Pipedrive Connected'}</span>
                      </div>
                      <button onClick={handleDisconnectPipedrive} className="text-xs text-slate-400 dark:text-neutral-500 hover:text-slate-900 underline">{lang === 'fr' ? 'Déconnecter' : 'Disconnect'}</button>
                    </div>

                    {/* Sync button */}
                    <button
                      onClick={handleSyncPipedrive}
                      disabled={isSyncingPipedrive}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all disabled:opacity-50"
                    >
                      {isSyncingPipedrive ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Synchro en cours...' : 'Syncing...'}</>
                      ) : (
                        <><RefreshCw className="h-4 w-4" /> {lang === 'fr' ? 'Synchroniser Pipedrive' : 'Sync Pipedrive'}</>
                      )}
                    </button>

                    {/* Mapping UI */}
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-4">
                      <h5 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Mapping des étapes Pipedrive' : 'Pipedrive Stage Mapping'}</h5>
                      <div className="space-y-4">
                        {allStages.map(stage => (
                          <div key={stage.id}>
                            <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500">{stage.name}</label>
                            <select
                              value={pipedriveMappings[stage.id] || ''}
                              onChange={(e) => handleUpdatePipedriveMapping(stage.id, Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                            >
                              <option value="">{lang === 'fr' ? 'Sélectionner une étape Pipedrive' : 'Select a Pipedrive stage'}</option>
                              {pipedrivePipelines.map(pipe => (
                                <optgroup key={pipe.id} label={pipe.name}>
                                  {pipedriveStages.filter(s => s.pipeline_id === pipe.id).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sync result */}
                    {pipedriveSyncResult && (
                      <div className="rounded border border-sky-500/20 bg-sky-500/10 p-2 text-xs text-sky-700 dark:text-sky-400">
                        {lang === 'fr' ? `✅ ${pipedriveSyncResult.imported} deals importés, ${pipedriveSyncResult.updated} mis à jour` : `✅ ${pipedriveSyncResult.imported} deals imported, ${pipedriveSyncResult.updated} updated`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* --- GOHIGHLEVEL CONFIG --- */}
            {editedOffer.crmProvider === 'gohighlevel' && (
              <div className="mb-6 space-y-4">
                {!ghlConnected ? (
                  <button
                    onClick={handleConnectGhl}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white hover:bg-sky-600 transition-all shadow-lg"
                  >
                    <Link className="h-4 w-4" /> {lang === 'fr' ? 'Connecter GoHighLevel' : 'Connect GoHighLevel'}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">{lang === 'fr' ? 'GoHighLevel Connecté' : 'GoHighLevel Connected'}</span>
                      </div>
                      <button onClick={handleDisconnectGhl} className="text-xs text-slate-400 dark:text-neutral-500 hover:text-slate-900 underline">{lang === 'fr' ? 'Déconnecter' : 'Disconnect'}</button>
                    </div>

                    {/* Sync button */}
                    <button
                      onClick={handleSyncGhl}
                      disabled={isSyncingGhl}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all disabled:opacity-50"
                    >
                      {isSyncingGhl ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Synchro en cours...' : 'Syncing...'}</>
                      ) : (
                        <><RefreshCw className="h-4 w-4" /> {lang === 'fr' ? 'Synchroniser GoHighLevel' : 'Sync GoHighLevel'}</>
                      )}
                    </button>

                    {/* Pipeline selection */}
                    {isEditing && (
                      <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-4">
                        <h5 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Pipeline GoHighLevel' : 'GoHighLevel Pipeline'}</h5>

                        {/* Select Pipeline */}
                        <div className="mb-4">
                          <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500">Pipeline</label>
                          <select
                            value={editedOffer.crmMapping?.ghlPipelineId || ''}
                            onChange={(e) => setEditedOffer({
                              ...editedOffer,
                              crmMapping: { ...editedOffer.crmMapping, ghlPipelineId: e.target.value }
                            })}
                            className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                          >
                            <option value="">{lang === 'fr' ? 'Sélectionner un pipeline' : 'Select a pipeline'}</option>
                            {ghlPipelines.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Stage Mapping */}
                        {editedOffer.crmMapping?.ghlPipelineId && (
                          <div className="space-y-4">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Mapping des étapes' : 'Stage Mapping'}</h5>
                            {allStages.map(stage => (
                              <div key={stage.id}>
                                <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500">{stage.name}</label>
                                <select
                                  value={editedOffer.crmMapping?.[stage.id] || ''}
                                  onChange={(e) => handleUpdateGhlMapping(stage.id, e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                                >
                                  <option value="">{lang === 'fr' ? 'Sélectionner une étape GHL' : 'Select a GHL stage'}</option>
                                  {ghlStages
                                    .filter(s => s.pipeline_id === editedOffer.crmMapping?.ghlPipelineId)
                                    .map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))
                                  }
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sync result */}
                    {ghlSyncResult && (
                      <div className="rounded border border-sky-500/20 bg-sky-500/10 p-2 text-xs text-sky-700 dark:text-sky-400">
                        {lang === 'fr' ? `${ghlSyncResult.imported} contacts importés, ${ghlSyncResult.updated} mis à jour` : `${ghlSyncResult.imported} contacts imported, ${ghlSyncResult.updated} updated`}
                      </div>
                    )}

                    <p className="text-[10px] text-sky-600/60">
                      {lang === 'fr'
                        ? "La synchronisation importe tous les contacts et opportunités GoHighLevel dans le pipeline de cette offre. Les changements de statut sont synchronisés dans les deux sens."
                        : "Synchronization imports all GoHighLevel contacts and opportunities into this offer's pipeline. Status changes are synced both ways."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 2. SÉLECTION DE LA FORMULE PAR DÉFAUT (NOUVEAU) */}
            <div className="mb-10 rounded-[20px] border border-slate-200 dark:border-white/10 bg-slate-50/30 p-6 backdrop-blur-md">
              <label className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                <BoxSelect className="h-3 w-3" /> {lang === 'fr' ? 'Formule par défaut (Prospects Entrants)' : 'Default Formula (Incoming Prospects)'}
              </label>
              {isEditing ? (
                <div className="relative">
                  <select
                    value={editedOffer.defaultFormulaId || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, defaultFormulaId: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none transition-all"
                  >
                    <option value="">{lang === 'fr' ? '-- Aucune formule (ou 1ère par défaut) --' : '-- No formula (or 1st by default) --'}</option>
                    {(editedOffer.formulas || []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({parseFloat(f.price).toLocaleString()}€)
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 dark:text-neutral-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-3 text-sm text-slate-500 dark:text-neutral-400 font-medium">
                  {editedOffer.defaultFormulaId
                    ? (editedOffer.formulas?.find(f => f.id === editedOffer.defaultFormulaId)?.name || (lang === 'fr' ? 'Formule introuvable' : 'Formula not found'))
                    : <span className="text-slate-400 dark:text-neutral-500 italic">{lang === 'fr' ? 'Aucune sélectionnée (par défaut)' : 'None selected (default)'}</span>
                  }
                </div>
              )}
              <p className="mt-3 text-[10px] text-slate-400 dark:text-neutral-500 font-medium leading-relaxed">
                {lang === 'fr' ? 'Cette formule sera automatiquement assignée aux prospects arrivant via le Webhook ci-dessous.' : 'This formula will be automatically assigned to prospects arriving via the Webhook below.'}
              </p>
            </div>

            {/* 3. Webhook Info (Helper) - AVEC BOUTON COPIER */}
            {/* 3. CRM-specific Config */}
            {editedOffer.crmProvider === 'hubspot' && (
              /* --- HUBSPOT CONFIG --- */
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-orange-100">{lang === 'fr' ? 'Configuration HubSpot' : 'HubSpot Configuration'}</h4>

                    {!hubspotConnected ? (
                      <div className="mt-3">
                        <p className="text-xs text-orange-600/80 leading-relaxed mb-3">
                          {lang === 'fr' ? 'Connectez votre compte HubSpot pour synchroniser automatiquement vos contacts et deals.' : 'Connect your HubSpot account to automatically sync your contacts and deals.'}
                        </p>
                        <button
                          onClick={handleConnectHubspot}
                          className="w-full flex justify-center items-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-slate-900 dark:text-white hover:bg-orange-700 transition-all shadow-lg"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {lang === 'fr' ? 'Connecter HubSpot' : 'Connect HubSpot'}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {/* Connected status */}
                        <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/10 p-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">{lang === 'fr' ? 'HubSpot Connecté' : 'HubSpot Connected'}</span>
                          </div>
                          <button onClick={handleDisconnectHubspot} className="text-xs text-slate-400 dark:text-neutral-500 hover:text-slate-900 underline">{lang === 'fr' ? 'Déconnecter' : 'Disconnect'}</button>
                        </div>

                        {/* Sync button */}
                        <button
                          onClick={handleSyncHubspot}
                          disabled={isSyncingHubspot}
                          className="w-full flex items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-500/20 transition-all disabled:opacity-50"
                        >
                          {isSyncingHubspot ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Synchronisation en cours...' : 'Syncing...'}</>
                          ) : (
                            <><RefreshCw className="h-4 w-4" /> {lang === 'fr' ? 'Synchroniser les contacts HubSpot' : 'Sync HubSpot contacts'}</>
                          )}
                        </button>

                        {/* Sync result */}
                        {hubspotSyncResult && (
                          <div className="rounded border border-sky-500/20 bg-sky-500/10 p-2 text-xs text-sky-700 dark:text-sky-400">
                            {lang === 'fr' ? `✅ ${hubspotSyncResult.imported} contacts importés, ${hubspotSyncResult.updated} mis à jour` : `✅ ${hubspotSyncResult.imported} contacts imported, ${hubspotSyncResult.updated} updated`}
                          </div>
                        )}

                        <p className="text-[10px] text-orange-600/60">
                          {lang === 'fr'
                            ? "La synchronisation importe tous les contacts HubSpot dans le pipeline de cette offre. Les changements de statut sont synchronisés dans les deux sens."
                            : "Synchronization imports all HubSpot contacts into this offer's pipeline. Status changes are synced both ways."}
                        </p>
                      </div>
                    )}

                    {/* --- MAPPING PERSONNALISÉ HUBSPOT --- */}
                    {isEditing && (
                      <div className="mt-6 border-t border-orange-500/20 pt-4">
                        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-orange-600">
                          {lang === 'fr' ? 'Mapping Personnalisé (Statuts HubSpot)' : 'Custom Mapping (HubSpot Statuses)'}
                        </h5>
                        <p className="mb-4 text-[10px] text-orange-600/80 leading-relaxed">
                          {lang === 'fr'
                            ? <>Par défaut, CloseOS gère automatiquement les statuts classiques. Pour les étapes <strong>Gagné</strong> et <strong>No Show</strong>, indiquez la valeur exacte du <em>Statut du lead</em> (ou de l&apos;<em>Étape du cycle de vie</em>) configurée dans votre HubSpot.</>
                            : <>By default, CloseOS automatically handles standard statuses. For <strong>Won</strong> and <strong>No Show</strong> stages, enter the exact value of the <em>Lead Status</em> (or <em>Lifecycle Stage</em>) configured in your HubSpot.</>}
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-orange-600">
                              {lang === 'fr' ? 'Statut pour "Gagné" (ex: Client, Gagné)' : 'Status for "Won" (e.g.: Client, Won)'}
                            </label>
                            <input
                              type="text"
                              placeholder="ex: Client"
                              value={editedOffer.crmMapping?.hubspotWonStatus || ''}
                              onChange={(e) => setEditedOffer({
                                ...editedOffer,
                                crmMapping: { ...editedOffer.crmMapping, hubspotWonStatus: e.target.value }
                              })}
                              className="w-full rounded-lg border border-orange-500/30 bg-orange-950/30 px-3 py-2 text-sm text-orange-100 placeholder-orange-500/50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-orange-600">
                              {lang === 'fr' ? 'Statut pour "No Show" (ex: No Show, Autre)' : 'Status for "No Show" (e.g.: No Show, Other)'}
                            </label>
                            <input
                              type="text"
                              placeholder="ex: No Show"
                              value={editedOffer.crmMapping?.hubspotNoShowStatus || ''}
                              onChange={(e) => setEditedOffer({
                                ...editedOffer,
                                crmMapping: { ...editedOffer.crmMapping, hubspotNoShowStatus: e.target.value }
                              })}
                              className="w-full rounded-lg border border-orange-500/30 bg-orange-950/30 px-3 py-2 text-sm text-orange-100 placeholder-orange-500/50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(editedOffer.crmProvider === 'iclosed' || !editedOffer.crmProvider) && (
              <div className="space-y-4">
                {/* ─── 1. Inbound (iClosed → CloseOS) ─── */}
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                  <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-2">
                    <Database className="h-4 w-4" /> {lang === 'fr' ? 'Inbound (iClosed → CloseOS)' : 'Inbound (iClosed → CloseOS)'}
                  </h4>
                  <p className="mt-1 text-xs text-sky-700/80 leading-relaxed">
                    {lang === 'fr'
                      ? <>Dans <strong>iClosed &gt; Settings &gt; Developer &gt; Webhooks</strong>, cliquez sur <em>Add Webhook</em> et collez cette URL. iClosed enverra les nouveaux contacts et les changements de stage à CloseOS.</>
                      : <>In <strong>iClosed &gt; Settings &gt; Developer &gt; Webhooks</strong>, click <em>Add Webhook</em> and paste this URL. iClosed will send new contacts and stage changes to CloseOS.</>}
                  </p>

                  <div className="mt-2 flex items-start gap-2 rounded border border-orange-500/20 bg-orange-500/10 p-2 text-[11px] text-orange-600">
                    <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span>
                      {lang === 'fr'
                        ? <><strong>Attention :</strong> Seul le <strong>Propriétaire</strong> de l&apos;organisation iClosed voit le menu &quot;Developer&quot;.</>
                        : <><strong>Warning:</strong> Only the iClosed organization <strong>Owner</strong> sees the &quot;Developer&quot; menu.</>}
                    </span>
                  </div>

                  <div className="mt-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1">
                      {lang === 'fr' ? 'URL du webhook' : 'Webhook URL'}
                    </label>
                    {iclosedInboundUrl ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded border border-sky-500/10 bg-white dark:bg-[#1a1a1a] p-2 font-mono text-xs text-slate-400 dark:text-neutral-500 overflow-x-auto whitespace-nowrap">
                          {iclosedInboundUrl}
                        </div>
                        <button
                          onClick={() => { navigator.clipboard.writeText(iclosedInboundUrl); setIclosedCopiedUrl(true); setTimeout(() => setIclosedCopiedUrl(false), 1500); }}
                          className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          title={lang === 'fr' ? "Copier l'URL" : 'Copy URL'}
                        >
                          {iclosedCopiedUrl ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                        {lang === 'fr' ? 'Générez une clé inbound pour activer le webhook.' : 'Generate an inbound key to activate the webhook.'}
                      </p>
                    )}
                    <button
                      onClick={handleRegenerateIclosedInboundKey}
                      disabled={iclosedRegenerating}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-neutral-400 hover:text-slate-900"
                    >
                      {iclosedRegenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      {editedOffer.crmApiKey
                        ? (lang === 'fr' ? 'Régénérer la clé inbound' : 'Regenerate inbound key')
                        : (lang === 'fr' ? 'Générer la clé inbound' : 'Generate inbound key')}
                    </button>
                  </div>
                </div>

                {/* ─── 2. Outbound (CloseOS → iClosed) ─── */}
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                  <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-2">
                    <Zap className="h-4 w-4" /> {lang === 'fr' ? 'Outbound (CloseOS → iClosed)' : 'Outbound (CloseOS → iClosed)'}
                  </h4>
                  <p className="mt-1 text-xs text-sky-600/80 leading-relaxed">
                    {lang === 'fr'
                      ? <>Collez votre <strong>clé API iClosed personnelle</strong> (commence par <code>iclosed_</code>) pour pousser les changements de stage CloseOS vers iClosed.</>
                      : <>Paste your <strong>personal iClosed API key</strong> (starts with <code>iclosed_</code>) so CloseOS stage changes flow back to iClosed.</>}
                  </p>

                  <div className="mt-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1">
                      {lang === 'fr' ? 'Clé API iClosed' : 'iClosed API key'}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={iclosedShowPushKey ? 'text' : 'password'}
                          value={editedOffer.iclosedPushKey || ''}
                          onChange={(e) => setEditedOffer({ ...editedOffer, iclosedPushKey: e.target.value })}
                          placeholder="iclosed_..."
                          disabled={!isEditing}
                          className="w-full rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 pr-9 font-mono text-xs text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setIclosedShowPushKey(!iclosedShowPushKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 hover:text-slate-900"
                        >
                          {iclosedShowPushKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                      {editedOffer.iclosedPushKey && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(editedOffer.iclosedPushKey || ''); setIclosedCopiedKey(true); setTimeout(() => setIclosedCopiedKey(false), 1500); }}
                          className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900"
                          title={lang === 'fr' ? 'Copier' : 'Copy'}
                        >
                          {iclosedCopiedKey ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleTestIclosedPushKey}
                    disabled={iclosedTesting}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 disabled:opacity-50"
                  >
                    {iclosedTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                    {lang === 'fr' ? 'Tester la connexion' : 'Test connection'}
                  </button>

                  <p className="mt-3 text-[10px] text-slate-400 dark:text-neutral-500">
                    {lang === 'fr'
                      ? <>Trouvez cette clé dans <strong>iClosed → Settings → Developer → API Keys → Create API Key</strong>. Plan Business ou Enterprise iClosed requis.</>
                      : <>Find this key in <strong>iClosed → Settings → Developer → API Keys → Create API Key</strong>. Requires an iClosed Business or Enterprise plan.</>}
                  </p>
                </div>

                {/* ─── 3. Stage mapping ─── */}
                <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Tag className="h-4 w-4" /> {lang === 'fr' ? 'Mapping des stages personnalisés' : 'Custom stage mapping'}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                    {lang === 'fr'
                      ? <>Les stages standards (Customer, No Show, Qualified...) sont reconnus automatiquement. Si vous avez des stages <strong>personnalisés</strong> dans iClosed, mappez-les ici.</>
                      : <>Standard iClosed stages (Customer, No Show, Qualified...) are auto-recognised. Map any <strong>custom</strong> iClosed stage to a CloseOS stage here.</>}
                  </p>

                  <div className="mt-3 space-y-2">
                    {iclosedMappingRows.length === 0 && (
                      <p className="text-[11px] italic text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Aucun mapping personnalisé.' : 'No custom mapping.'}</p>
                    )}
                    {iclosedMappingRows.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) => handleUpdateIclosedMappingRow(i, 'name', e.target.value)}
                          placeholder={lang === 'fr' ? 'Nom du stage iClosed' : 'iClosed stage name'}
                          disabled={!isEditing}
                          className="flex-1 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none disabled:opacity-60"
                        />
                        <span className="text-slate-400 dark:text-neutral-500">→</span>
                        <select
                          value={m.stage}
                          onChange={(e) => handleUpdateIclosedMappingRow(i, 'stage', e.target.value)}
                          disabled={!isEditing}
                          className="rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none disabled:opacity-60"
                        >
                          <option value="prospect">Prospect</option>
                          <option value="qualified">Qualified</option>
                          <option value="won">Won</option>
                          <option value="followup">Follow Up</option>
                          <option value="noshow">No Show</option>
                          <option value="lost">Lost</option>
                        </select>
                        {isEditing && (
                          <button
                            onClick={() => handleRemoveIclosedMappingRow(i)}
                            className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:text-red-600"
                            title={lang === 'fr' ? 'Supprimer' : 'Remove'}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isEditing && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleAddIclosedMappingRow}
                        className="rounded-full border border-slate-200 dark:border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-900 dark:text-white hover:bg-slate-100"
                      >
                        + {lang === 'fr' ? 'Ajouter un mapping' : 'Add mapping'}
                      </button>
                      <button
                        onClick={handleSaveIclosedMapping}
                        className="rounded-full bg-slate-100 dark:bg-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-900 dark:text-white hover:bg-slate-100"
                      >
                        {lang === 'fr' ? 'Appliquer le mapping' : 'Apply mapping'}
                      </button>
                    </div>
                  )}
                </div>

                {/* ─── 4. Sync now ─── */}
                <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" /> {lang === 'fr' ? 'Synchronisation initiale' : 'Initial sync'}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                    {lang === 'fr'
                      ? 'Importer les contacts et RDV iClosed existants dans cette offre. Idempotent : les exécutions suivantes ne réimportent que les nouveautés.'
                      : 'Import existing iClosed contacts and event calls into this offer. Idempotent: subsequent runs only pull new items.'}
                  </p>
                  <button
                    onClick={handleSyncIclosedNow}
                    disabled={iclosedSyncing || !editedOffer.iclosedPushKey || !(editedOffer.iclosedPushKey || '').startsWith('iclosed_')}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600 disabled:opacity-50"
                  >
                    {iclosedSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {lang === 'fr' ? 'Synchroniser maintenant' : 'Sync now'}
                  </button>
                  {iclosedSyncResult && (
                    <p className="mt-2 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                      ✓ {iclosedSyncResult.imported} {lang === 'fr' ? 'importés' : 'imported'}, {iclosedSyncResult.updated} {lang === 'fr' ? 'mis à jour' : 'updated'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* --- SYSTEME.IO CONFIG --- */}
            {editedOffer.crmProvider === 'systemeio' && (
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-sky-600 dark:text-sky-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-400">{lang === 'fr' ? 'Configuration Systeme.io' : 'Systeme.io Configuration'}</h4>

                    {/* API Key */}
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          {lang === 'fr' ? 'Clé API Systeme.io' : 'Systeme.io API Key'}
                        </label>
                        <p className="text-[11px] text-slate-400 dark:text-neutral-500 mb-2">
                          {lang === 'fr'
                            ? <>Trouvez votre clé dans <strong className="text-slate-500 dark:text-neutral-400">Systeme.io &rarr; Paramètres &rarr; Clés API publiques</strong></>
                            : <>Find your key in <strong className="text-slate-500 dark:text-neutral-400">Systeme.io &rarr; Settings &rarr; Public API Keys</strong></>}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type={systemeioShowKey ? 'text' : 'password'}
                              value={systemeioApiKey}
                              onChange={(e) => setSystemeioApiKey(e.target.value)}
                              placeholder={lang === 'fr' ? 'Collez votre clé API ici' : 'Paste your API key here'}
                              className="w-full rounded border border-sky-500/10 bg-white dark:bg-[#1a1a1a] p-2 pr-8 font-mono text-xs text-slate-400 dark:text-neutral-500 placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                            />
                            <button
                              onClick={() => setSystemeioShowKey(!systemeioShowKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 hover:text-slate-500"
                            >
                              {systemeioShowKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <button
                            onClick={handleSaveSystemeioKey}
                            disabled={systemeioSaving}
                            className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600 transition-all disabled:opacity-50"
                          >
                            {systemeioSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Webhook URL */}
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'URL du Webhook' : 'Webhook URL'}</label>
                        <p className="text-[11px] text-slate-400 dark:text-neutral-500 mb-2">
                          {lang === 'fr'
                            ? <>Collez cette URL dans <strong className="text-slate-500 dark:text-neutral-400">Systeme.io &rarr; Paramètres &rarr; Webhooks</strong></>
                            : <>Paste this URL in <strong className="text-slate-500 dark:text-neutral-400">Systeme.io &rarr; Settings &rarr; Webhooks</strong></>}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded border border-sky-500/10 bg-white dark:bg-[#1a1a1a] p-2 font-mono text-xs text-slate-400 dark:text-neutral-500 overflow-x-auto whitespace-nowrap">
                            {systemeioWebhookUrl}
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(systemeioWebhookUrl)
                              setSystemeioCopiedUrl(true)
                              setTimeout(() => setSystemeioCopiedUrl(false), 2000)
                            }}
                            className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          >
                            {systemeioCopiedUrl ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                        {editedOffer.defaultFormulaId && (
                          <p className="mt-1 text-[10px] text-sky-600/80 flex items-center gap-1">
                            <Check className="h-3 w-3" /> {lang === 'fr' ? "L'ID de la formule a été ajouté à l'URL." : 'The formula ID has been added to the URL.'}
                          </p>
                        )}
                      </div>

                      {/* Instructions */}
                      <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-1000 p-3">
                        <h5 className="mb-2 text-xs font-bold text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Comment configurer :' : 'How to configure:'}</h5>
                        <ol className="text-[11px] text-slate-400 dark:text-neutral-500 space-y-1.5 list-decimal list-inside">
                          {lang === 'fr' ? (
                            <>
                              <li>Allez dans <strong className="text-slate-400 dark:text-neutral-500">Systeme.io &rarr; Paramètres &rarr; Clés API publiques</strong> et copiez votre clé</li>
                              <li>Collez la clé API ci-dessus et cliquez sur Sauvegarder</li>
                              <li>Allez dans <strong className="text-slate-400 dark:text-neutral-500">Systeme.io &rarr; Paramètres &rarr; Webhooks</strong></li>
                              <li>Ajoutez un webhook avec l&apos;URL ci-dessus</li>
                              <li>Sélectionnez les événements : <strong className="text-slate-400 dark:text-neutral-500">Opt-in</strong> et/ou <strong className="text-slate-400 dark:text-neutral-500">Nouvelle vente</strong></li>
                            </>
                          ) : (
                            <>
                              <li>Go to <strong className="text-slate-400 dark:text-neutral-500">Systeme.io &rarr; Settings &rarr; Public API Keys</strong> and copy your key</li>
                              <li>Paste the API key above and click Save</li>
                              <li>Go to <strong className="text-slate-400 dark:text-neutral-500">Systeme.io &rarr; Settings &rarr; Webhooks</strong></li>
                              <li>Add a webhook with the URL above</li>
                              <li>Select events: <strong className="text-slate-400 dark:text-neutral-500">Opt-in</strong> and/or <strong className="text-slate-400 dark:text-neutral-500">New sale</strong></li>
                            </>
                          )}
                        </ol>
                      </div>

                      {/* Sync info */}
                      <div className="rounded-lg border border-sky-500/10 bg-sky-500/5 p-2">
                        <p className="text-[10px] text-sky-600/80">
                          {lang === 'fr' ? (
                            <><strong>Webhook :</strong> Chaque opt-in ou vente dans Systeme.io crée automatiquement un prospect.<br /><strong>Sync retour :</strong> Les changements de stage dans CloseOS mettent à jour les tags du contact dans Systeme.io (ex: CloseOS-Qualifié, CloseOS-Gagné...).</>
                          ) : (
                            <><strong>Webhook:</strong> Each opt-in or sale in Systeme.io automatically creates a prospect.<br /><strong>Return sync:</strong> Stage changes in CloseOS update contact tags in Systeme.io (e.g.: CloseOS-Qualified, CloseOS-Won...).</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- AIRTABLE CONFIG --- */}
            {editedOffer.crmProvider === 'airtable' && (
              <div className="rounded-lg border border-[#18BFFF]/20 bg-[#18BFFF]/5 p-3">
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-[#18BFFF] mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-400">{lang === 'fr' ? 'Configuration Airtable' : 'Airtable Configuration'}</h4>

                    <div className="mt-3 space-y-3">
                      {/* OAuth Connect Button */}
                      {!airtableConnected ? (
                        <button
                          onClick={handleConnectAirtable}
                          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#18BFFF] py-2.5 text-sm font-bold text-slate-900 dark:text-white hover:bg-[#10a8e6] transition-all shadow-lg"
                        >
                          <ExternalLink className="h-4 w-4" /> {lang === 'fr' ? 'Connecter Airtable' : 'Connect Airtable'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg bg-sky-500/10 border border-sky-500/20 p-2">
                          <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">{lang === 'fr' ? 'Airtable connecté' : 'Airtable connected'}</span>
                        </div>
                      )}

                      {/* Base selector */}
                      {airtableConnected && (
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                            {lang === 'fr' ? 'Base Airtable' : 'Airtable Base'}
                          </label>
                          {airtableLoadingBases ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-neutral-500"><Loader2 className="h-3 w-3 animate-spin" /> {lang === 'fr' ? 'Chargement des bases...' : 'Loading bases...'}</div>
                          ) : (
                            <select
                              value={editedOffer.crmMapping?.airtableBaseId || ''}
                              onChange={(e) => setEditedOffer(prev => ({
                                ...prev,
                                crmMapping: { ...prev.crmMapping, airtableBaseId: e.target.value, airtableTableId: '', airtableFieldMapping: {} },
                              }))}
                              className="w-full appearance-none rounded border border-[#18BFFF]/10 bg-white dark:bg-[#1a1a1a] p-2 text-xs text-slate-900 dark:text-white focus:border-[#18BFFF]/50 focus:outline-none"
                            >
                              <option value="">{lang === 'fr' ? 'Sélectionner une base...' : 'Select a base...'}</option>
                              {airtableBases.map((base: any) => (
                                <option key={base.id} value={base.id}>{base.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {/* Table selector */}
                      {editedOffer.crmMapping?.airtableBaseId && (
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                            Table
                          </label>
                          {airtableLoadingTables ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-neutral-500"><Loader2 className="h-3 w-3 animate-spin" /> {lang === 'fr' ? 'Chargement des tables...' : 'Loading tables...'}</div>
                          ) : (
                            <select
                              value={editedOffer.crmMapping?.airtableTableId || ''}
                              onChange={(e) => setEditedOffer(prev => ({
                                ...prev,
                                crmMapping: { ...prev.crmMapping, airtableTableId: e.target.value, airtableFieldMapping: {} },
                              }))}
                              className="w-full appearance-none rounded border border-[#18BFFF]/10 bg-white dark:bg-[#1a1a1a] p-2 text-xs text-slate-900 dark:text-white focus:border-[#18BFFF]/50 focus:outline-none"
                            >
                              <option value="">{lang === 'fr' ? 'Sélectionner une table...' : 'Select a table...'}</option>
                              {airtableTables.map((table: any) => (
                                <option key={table.id} value={table.id}>{table.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {/* Field mapping */}
                      {editedOffer.crmMapping?.airtableTableId && airtableFields.length > 0 && (
                        <div>
                          <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                            {lang === 'fr' ? 'Mapping des colonnes' : 'Column Mapping'}
                          </label>
                          <p className="text-[11px] text-slate-400 dark:text-neutral-500 mb-2">
                            {lang === 'fr' ? 'Associez vos colonnes Airtable aux champs CloseOS' : 'Map your Airtable columns to CloseOS fields'}
                          </p>
                          <div className="space-y-2">
                            {[
                              { key: 'firstName', label: lang === 'fr' ? 'Prénom' : 'First Name' },
                              { key: 'lastName', label: lang === 'fr' ? 'Nom' : 'Last Name' },
                              { key: 'email', label: 'Email' },
                              { key: 'phone', label: lang === 'fr' ? 'Téléphone' : 'Phone' },
                              { key: 'company', label: lang === 'fr' ? 'Entreprise' : 'Company' },
                              { key: 'stage', label: lang === 'fr' ? 'Statut / Étape' : 'Status / Stage' },
                              { key: 'value', label: lang === 'fr' ? 'Valeur (€)' : 'Value (€)' },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center gap-2">
                                <span className="w-24 text-[11px] text-slate-400 dark:text-neutral-500 shrink-0">{label}</span>
                                <select
                                  value={(editedOffer.crmMapping?.airtableFieldMapping as any)?.[key] || ''}
                                  onChange={(e) => updateAirtableMapping(key, e.target.value)}
                                  className="flex-1 appearance-none rounded border border-[#18BFFF]/10 bg-white dark:bg-[#1a1a1a] p-1.5 text-xs text-slate-900 dark:text-white focus:border-[#18BFFF]/50 focus:outline-none"
                                >
                                  <option value="">{lang === 'fr' ? '— Non mappé —' : '— Not mapped —'}</option>
                                  {airtableFields.map((field: any) => (
                                    <option key={field.id} value={field.name}>{field.name}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {airtableLoadingFields && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-neutral-500"><Loader2 className="h-3 w-3 animate-spin" /> {lang === 'fr' ? 'Chargement des colonnes...' : 'Loading columns...'}</div>
                      )}

                      {/* Sync button */}
                      {editedOffer.crmMapping?.airtableTableId && (
                        <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                          <button
                            onClick={handleSyncAirtable}
                            disabled={isSyncingAirtable}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#18BFFF] py-2.5 text-sm font-bold text-slate-900 dark:text-white hover:bg-[#10a8e6] transition-all disabled:opacity-50"
                          >
                            {isSyncingAirtable ? (
                              <><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Synchronisation...' : 'Syncing...'}</>
                            ) : (
                              <><RefreshCw className="h-4 w-4" /> {lang === 'fr' ? 'Synchroniser Airtable' : 'Sync Airtable'}</>
                            )}
                          </button>
                          {airtableSyncResult && (
                            <div className="mt-2 rounded-lg bg-sky-500/10 border border-sky-500/20 p-2 text-center">
                              <p className="text-xs text-sky-600 dark:text-sky-400">
                                {lang === 'fr'
                                  ? <><strong>{airtableSyncResult.imported}</strong> importé{airtableSyncResult.imported > 1 ? 's' : ''} · <strong>{airtableSyncResult.updated}</strong> mis à jour</>
                                  : <><strong>{airtableSyncResult.imported}</strong> imported · <strong>{airtableSyncResult.updated}</strong> updated</>}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sync info */}
                      <div className="rounded-lg border border-[#18BFFF]/10 bg-[#18BFFF]/5 p-2">
                        <p className="text-[10px] text-sky-600/80">
                          {lang === 'fr' ? (
                            <><strong>Import :</strong> Cliquez sur Synchroniser pour importer les records de votre table Airtable en tant que prospects.<br /><strong>Sync retour :</strong> Quand un prospect change de statut dans CloseOS, la colonne Statut est automatiquement mise à jour dans Airtable.</>
                          ) : (
                            <><strong>Import:</strong> Click Sync to import records from your Airtable table as prospects.<br /><strong>Return sync:</strong> When a prospect changes status in CloseOS, the Status column is automatically updated in Airtable.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- ZAPIER CONFIG --- */}
            {editedOffer.crmProvider === 'zapier' && (
              <div className="rounded-lg border border-[#FF4A00]/20 bg-[#FF4A00]/5 p-3">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-[#FF4A00] mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-orange-100">{lang === 'fr' ? 'Configuration Zapier' : 'Zapier Configuration'}</h4>

                    {!zapierApiKey ? (
                      <div className="mt-3">
                        <p className="text-xs text-orange-600/80 leading-relaxed mb-3">
                          {lang === 'fr' ? 'Générez une clé API pour connecter Zapier à cette offre. Les prospects seront importés directement dans votre pipeline.' : 'Generate an API key to connect Zapier to this offer. Prospects will be imported directly into your pipeline.'}
                        </p>
                        <button
                          onClick={handleGenerateZapierKey}
                          disabled={zapierLoading}
                          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#FF4A00] py-2.5 text-sm font-bold text-slate-900 dark:text-white hover:bg-[#e04300] transition-all disabled:opacity-50"
                        >
                          {zapierLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Génération...' : 'Generating...'}</>
                          ) : (
                            <><Key className="h-4 w-4" /> {lang === 'fr' ? 'Générer une clé API' : 'Generate API Key'}</>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {/* Connected status */}
                        <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 p-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">{lang === 'fr' ? 'Clé API active' : 'API Key active'}</span>
                          </div>
                          <button
                            onClick={handleDeleteZapierKey}
                            disabled={zapierLoading}
                            className="text-xs text-slate-400 dark:text-neutral-500 hover:text-red-600 underline flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" /> {lang === 'fr' ? 'Supprimer' : 'Delete'}
                          </button>
                        </div>

                        {/* Webhook URL */}
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'URL du Webhook' : 'Webhook URL'}</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded border border-[#FF4A00]/10 bg-white dark:bg-[#1a1a1a] p-2 font-mono text-xs text-slate-400 dark:text-neutral-500 overflow-x-auto whitespace-nowrap">
                              {zapierWebhookUrl}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(zapierWebhookUrl)
                                setZapierCopiedUrl(true)
                                setTimeout(() => setZapierCopiedUrl(false), 2000)
                              }}
                              className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              {zapierCopiedUrl ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                          {editedOffer.defaultFormulaId && (
                            <p className="mt-1 text-[10px] text-sky-600/80 flex items-center gap-1">
                              <Check className="h-3 w-3" /> {lang === 'fr' ? "L'ID de la formule a été ajouté à l'URL." : 'The formula ID has been added to the URL.'}
                            </p>
                          )}
                        </div>

                        {/* API Key */}
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Clé API (Bearer Token)' : 'API Key (Bearer Token)'}</label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type={zapierShowKey ? 'text' : 'password'}
                                value={zapierApiKey}
                                readOnly
                                className="w-full rounded border border-[#FF4A00]/10 bg-white dark:bg-[#1a1a1a] p-2 pr-8 font-mono text-xs text-slate-400 dark:text-neutral-500"
                              />
                              <button
                                onClick={() => setZapierShowKey(!zapierShowKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 hover:text-slate-500"
                              >
                                {zapierShowKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(zapierApiKey!)
                                setZapierCopiedKey(true)
                                setTimeout(() => setZapierCopiedKey(false), 2000)
                              }}
                              className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              {zapierCopiedKey ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Instructions */}
                        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-1000 p-3">
                          <h5 className="mb-2 text-xs font-bold text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Configuration dans Zapier :' : 'Zapier Configuration:'}</h5>
                          <ol className="text-[11px] text-slate-400 dark:text-neutral-500 space-y-1.5 list-decimal list-inside">
                            <li>{lang === 'fr' ? 'Créez un Zap avec votre source (Facebook Ads, Typeform...)' : 'Create a Zap with your source (Facebook Ads, Typeform...)'}</li>
                            <li>{lang === 'fr' ? <>Action : <strong className="text-slate-400 dark:text-neutral-500">Webhooks by Zapier</strong> &rarr; <strong className="text-slate-400 dark:text-neutral-500">POST</strong></> : <>Action: <strong className="text-slate-400 dark:text-neutral-500">Webhooks by Zapier</strong> &rarr; <strong className="text-slate-400 dark:text-neutral-500">POST</strong></>}</li>
                            <li>{lang === 'fr' ? "URL : collez l'URL ci-dessus" : 'URL: paste the URL above'}</li>
                            <li>Headers : <code className="bg-slate-100 dark:bg-white/10 px-1 rounded text-[10px] text-slate-400 dark:text-neutral-500">Authorization: Bearer votre_clé</code></li>
                            <li>Body (JSON) : <code className="bg-slate-100 dark:bg-white/10 px-1 rounded text-[10px] text-slate-400 dark:text-neutral-500">firstName, lastName, email, phone, company, source</code></li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- MAKE CONFIG --- */}
            {editedOffer.crmProvider === 'make' && (
              <div className="rounded-lg border border-[#6D00CC]/20 bg-[#6D00CC]/5 p-3">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-[#6D00CC] mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-400">{lang === 'fr' ? 'Configuration Make' : 'Make Configuration'}</h4>

                    {!makeApiKey ? (
                      <div className="mt-3">
                        <p className="text-xs text-sky-600/80 leading-relaxed mb-3">
                          {lang === 'fr' ? 'Générez une clé API pour connecter Make à cette offre. Les prospects seront importés directement dans votre pipeline.' : 'Generate an API key to connect Make to this offer. Prospects will be imported directly into your pipeline.'}
                        </p>
                        <button
                          onClick={handleGenerateMakeKey}
                          disabled={makeLoading}
                          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#6D00CC] py-2.5 text-sm font-bold text-slate-900 dark:text-white hover:bg-[#5a00aa] transition-all disabled:opacity-50"
                        >
                          {makeLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Génération...' : 'Generating...'}</>
                          ) : (
                            <><Key className="h-4 w-4" /> {lang === 'fr' ? 'Générer une clé API' : 'Generate API Key'}</>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 p-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">{lang === 'fr' ? 'Clé API active' : 'API Key active'}</span>
                          </div>
                          <button
                            onClick={handleDeleteMakeKey}
                            disabled={makeLoading}
                            className="text-xs text-slate-400 dark:text-neutral-500 hover:text-red-600 underline flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" /> {lang === 'fr' ? 'Supprimer' : 'Delete'}
                          </button>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'URL du Webhook' : 'Webhook URL'}</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded border border-[#6D00CC]/10 bg-white dark:bg-[#1a1a1a] p-2 font-mono text-xs text-slate-400 dark:text-neutral-500 overflow-x-auto whitespace-nowrap">
                              {makeWebhookUrl}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(makeWebhookUrl)
                                setMakeCopiedUrl(true)
                                setTimeout(() => setMakeCopiedUrl(false), 2000)
                              }}
                              className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              {makeCopiedUrl ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Clé API (Bearer Token)' : 'API Key (Bearer Token)'}</label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type={makeShowKey ? 'text' : 'password'}
                                value={makeApiKey}
                                readOnly
                                className="w-full rounded border border-[#6D00CC]/10 bg-white dark:bg-[#1a1a1a] p-2 pr-8 font-mono text-xs text-slate-400 dark:text-neutral-500"
                              />
                              <button
                                onClick={() => setMakeShowKey(!makeShowKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 hover:text-slate-500"
                              >
                                {makeShowKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(makeApiKey!)
                                setMakeCopiedKey(true)
                                setTimeout(() => setMakeCopiedKey(false), 2000)
                              }}
                              className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              {makeCopiedKey ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-1000 p-3">
                          <h5 className="mb-2 text-xs font-bold text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Configuration dans Make :' : 'Make Configuration:'}</h5>
                          <ol className="text-[11px] text-slate-400 dark:text-neutral-500 space-y-1.5 list-decimal list-inside">
                            <li>{lang === 'fr' ? 'Créez un scénario avec votre source (Facebook Ads, Typeform...)' : 'Create a scenario with your source (Facebook Ads, Typeform...)'}</li>
                            <li>{lang === 'fr' ? <>Ajoutez un module <strong className="text-slate-400 dark:text-neutral-500">HTTP</strong> &rarr; <strong className="text-slate-400 dark:text-neutral-500">Make a request</strong></> : <>Add an <strong className="text-slate-400 dark:text-neutral-500">HTTP</strong> module &rarr; <strong className="text-slate-400 dark:text-neutral-500">Make a request</strong></>}</li>
                            <li>{lang === 'fr' ? <>Méthode : <strong className="text-slate-400 dark:text-neutral-500">POST</strong>, URL : collez l&apos;URL ci-dessus</> : <>Method: <strong className="text-slate-400 dark:text-neutral-500">POST</strong>, URL: paste the URL above</>}</li>
                            <li>Headers : <code className="bg-slate-100 dark:bg-white/10 px-1 rounded text-[10px] text-slate-400 dark:text-neutral-500">Authorization: Bearer votre_clé</code></li>
                            <li>Body (JSON) : <code className="bg-slate-100 dark:bg-white/10 px-1 rounded text-[10px] text-slate-400 dark:text-neutral-500">firstName, lastName, email, phone, company, source</code></li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- N8N CONFIG --- */}
            {editedOffer.crmProvider === 'n8n' && (
              <div className="rounded-lg border border-[#EA4B71]/20 bg-[#EA4B71]/5 p-3">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-[#EA4B71] mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-pink-100">{lang === 'fr' ? 'Configuration n8n' : 'n8n Configuration'}</h4>

                    {!n8nApiKey ? (
                      <div className="mt-3">
                        <p className="text-xs text-pink-300/80 leading-relaxed mb-3">
                          {lang === 'fr' ? 'Générez une clé API pour connecter n8n à cette offre. Les prospects seront importés directement dans votre pipeline.' : 'Generate an API key to connect n8n to this offer. Prospects will be imported directly into your pipeline.'}
                        </p>
                        <button
                          onClick={handleGenerateN8nKey}
                          disabled={n8nLoading}
                          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#EA4B71] py-2.5 text-sm font-bold text-slate-900 dark:text-white hover:bg-[#d4405f] transition-all disabled:opacity-50"
                        >
                          {n8nLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> {lang === 'fr' ? 'Génération...' : 'Generating...'}</>
                          ) : (
                            <><Key className="h-4 w-4" /> {lang === 'fr' ? 'Générer une clé API' : 'Generate API Key'}</>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 p-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">{lang === 'fr' ? 'Clé API active' : 'API Key active'}</span>
                          </div>
                          <button
                            onClick={handleDeleteN8nKey}
                            disabled={n8nLoading}
                            className="text-xs text-slate-400 dark:text-neutral-500 hover:text-red-600 underline flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" /> {lang === 'fr' ? 'Supprimer' : 'Delete'}
                          </button>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'URL du Webhook' : 'Webhook URL'}</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded border border-[#EA4B71]/10 bg-white dark:bg-[#1a1a1a] p-2 font-mono text-xs text-slate-400 dark:text-neutral-500 overflow-x-auto whitespace-nowrap">
                              {n8nWebhookUrl}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(n8nWebhookUrl)
                                setN8nCopiedUrl(true)
                                setTimeout(() => setN8nCopiedUrl(false), 2000)
                              }}
                              className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              {n8nCopiedUrl ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Clé API (Bearer Token)' : 'API Key (Bearer Token)'}</label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type={n8nShowKey ? 'text' : 'password'}
                                value={n8nApiKey}
                                readOnly
                                className="w-full rounded border border-[#EA4B71]/10 bg-white dark:bg-[#1a1a1a] p-2 pr-8 font-mono text-xs text-slate-400 dark:text-neutral-500"
                              />
                              <button
                                onClick={() => setN8nShowKey(!n8nShowKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 hover:text-slate-500"
                              >
                                {n8nShowKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(n8nApiKey!)
                                setN8nCopiedKey(true)
                                setTimeout(() => setN8nCopiedKey(false), 2000)
                              }}
                              className="rounded p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              {n8nCopiedKey ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-1000 p-3">
                          <h5 className="mb-2 text-xs font-bold text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Configuration dans n8n :' : 'n8n Configuration:'}</h5>
                          <ol className="text-[11px] text-slate-400 dark:text-neutral-500 space-y-1.5 list-decimal list-inside">
                            <li>{lang === 'fr' ? <>Créez un workflow avec un nœud <strong className="text-slate-400 dark:text-neutral-500">HTTP Request</strong></> : <>Create a workflow with an <strong className="text-slate-400 dark:text-neutral-500">HTTP Request</strong> node</>}</li>
                            <li>{lang === 'fr' ? <>Méthode : <strong className="text-slate-400 dark:text-neutral-500">POST</strong>, URL : collez l&apos;URL ci-dessus</> : <>Method: <strong className="text-slate-400 dark:text-neutral-500">POST</strong>, URL: paste the URL above</>}</li>
                            <li>Authentication : <strong className="text-slate-400 dark:text-neutral-500">Header Auth</strong> → Name: Authorization, Value: Bearer votre_clé</li>
                            <li>Body (JSON) : <code className="bg-slate-100 dark:bg-white/10 px-1 rounded text-[10px] text-slate-400 dark:text-neutral-500">firstName, lastName, email, phone, company, source</code></li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Zone D - Resources */}
          <div className="mt-8 rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/30 p-6 backdrop-blur-md relative z-10">
            <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500 ml-1">
              <ExternalLink className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Ressources Commerciales' : 'Sales Resources'}
            </h3>

            {isEditing ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  {editedOffer.resources.length > 0 ? (
                    editedOffer.resources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-1000 p-4 transition-all hover:bg-white"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          {getResourceIcon(resource.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{resource.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium truncate max-w-[200px] mt-0.5">{resource.url}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveResource(resource.id)}
                          className="h-9 w-9 flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400 dark:text-neutral-500">
                      <ExternalLink className="h-8 w-8 opacity-20" />
                      <p className="text-[11px] font-bold uppercase tracking-widest italic">{lang === 'fr' ? 'Aucune ressource disponible' : 'No resources available'}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500 text-center">
                    {lang === 'fr' ? 'Ajouter une ressource' : 'Add a resource'}
                  </p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder={lang === 'fr' ? 'Nom (ex: Script de vente)' : 'Name (e.g.: Sales script)'}
                      value={tempResName}
                      onChange={(e) => setTempResName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                    />
                    <input
                      type="url"
                      placeholder="URL (ex: https://...)"
                      value={tempResLink}
                      onChange={(e) => setTempResLink(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
                    />
                    <button
                      onClick={handleAddResource}
                      className="flex w-full items-center justify-center gap-3 rounded-xl bg-sky-600 px-4 py-3 text-xs font-black text-white transition-all hover:bg-sky-600 shadow-lg shadow-sky-500/20 active:scale-95 uppercase tracking-widest"
                    >
                      <Plus className="h-4 w-4" />
                      {lang === 'fr' ? 'Ajouter au catalogue' : 'Add to catalog'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {offer.resources.length > 0 ? (
                  offer.resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-1000 p-4 transition-all hover:border-sky-500/30 hover:bg-slate-50 hover:shadow-lg hover:shadow-sky-500/5"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:bg-sky-500/20 transition-all">
                        {getResourceIcon(resource.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight group-hover:text-sky-600 transition-colors">
                          {resource.name}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                          {lang === 'fr' ? 'Ouvrir' : 'Open'} <ExternalLink className="h-2 w-2" />
                        </span>
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="col-span-2 flex flex-col items-center justify-center py-6 gap-2 text-slate-400 dark:text-neutral-500">
                    <ExternalLink className="h-8 w-8 opacity-20" />
                    <p className="text-[11px] font-bold uppercase tracking-widest italic text-center">{lang === 'fr' ? 'Aucune ressource disponible' : 'No resources available'}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zone E - Notes */}
          <div className="mt-8 rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/30 p-6 backdrop-blur-md relative z-10">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500 ml-1">
              {lang === 'fr' ? 'Notes de Closing' : 'Closing Notes'}
            </h3>
            {isEditing ? (
              <textarea
                value={editedOffer.notes || ''}
                onChange={(e) =>
                  setEditedOffer({ ...editedOffer, notes: e.target.value })
                }
                rows={4}
                placeholder={lang === 'fr' ? 'Instructions spécifiques pour closer cette offre...' : 'Specific instructions for closing this offer...'}
                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-1000 px-4 py-3 text-sm text-slate-900 dark:text-white font-medium focus:border-sky-500 focus:outline-none resize-none transition-all"
              />
            ) : (
              <p className="text-sm leading-relaxed text-slate-500 dark:text-neutral-400 font-medium px-1">
                {offer.notes || (lang === 'fr' ? 'Aucune note' : 'No notes')}
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}