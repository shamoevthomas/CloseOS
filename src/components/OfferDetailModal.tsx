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

  // États Airtable
  const [airtableApiKey, setAirtableApiKey] = useState('')
  const [airtableSaving, setAirtableSaving] = useState(false)
  const [airtableShowKey, setAirtableShowKey] = useState(false)
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
      alert('Erreur connexion HubSpot: ' + params.get('hubspot_error'))
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
        alert('Erreur sync HubSpot: ' + (data.error || 'Erreur inconnue'))
      }
    } catch (e: any) {
      alert('Erreur sync HubSpot: ' + e.message)
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
        alert('Erreur sync Pipedrive: ' + (data.error || 'Erreur inconnue'))
      }
    } catch (e: any) {
      alert('Erreur sync Pipedrive: ' + e.message)
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
    if (!user || !window.confirm('Déconnecter Pipedrive ?')) return
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
    if (!user || !window.confirm('Déconnecter HubSpot ?')) return
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
      alert('Erreur connexion GoHighLevel: ' + params.get('ghl_error'))
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
    const clientId = import.meta.env.VITE_GHL_CLIENT_ID || ''
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
        alert('Erreur sync GoHighLevel: ' + (data.error || 'Erreur inconnue'))
      }
    } catch (e: any) {
      alert('Erreur sync GoHighLevel: ' + e.message)
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
    if (!user || !window.confirm('Déconnecter GoHighLevel ?')) return
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
    if (!zapierKeyId || !window.confirm('Supprimer cette clé API ? Les Zaps connectés ne fonctionneront plus.')) return
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

  // Load Airtable API key
  useEffect(() => {
    if (editedOffer.crmProvider !== 'airtable' || !user) return
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('airtable_api_key')
        .eq('id', user.id)
        .single()
      setAirtableApiKey(data?.airtable_api_key || '')
    }
    load()
  }, [editedOffer.crmProvider, user])

  // Load Airtable bases when key is set
  useEffect(() => {
    if (editedOffer.crmProvider !== 'airtable' || !airtableApiKey) return
    const load = async () => {
      setAirtableLoadingBases(true)
      try {
        const res = await fetch('/api/webhooks?action=airtable-bases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: airtableApiKey }),
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
  }, [editedOffer.crmProvider, airtableApiKey])

  // Load Airtable tables when base is selected
  useEffect(() => {
    const baseId = editedOffer.crmMapping?.airtableBaseId
    if (editedOffer.crmProvider !== 'airtable' || !airtableApiKey || !baseId) return
    const load = async () => {
      setAirtableLoadingTables(true)
      try {
        const res = await fetch('/api/webhooks?action=airtable-tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: airtableApiKey, base_id: baseId }),
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
  }, [editedOffer.crmProvider, airtableApiKey, editedOffer.crmMapping?.airtableBaseId])

  // Load Airtable fields when table is selected
  useEffect(() => {
    const baseId = editedOffer.crmMapping?.airtableBaseId
    const tableId = editedOffer.crmMapping?.airtableTableId
    if (editedOffer.crmProvider !== 'airtable' || !airtableApiKey || !baseId || !tableId) return
    const load = async () => {
      setAirtableLoadingFields(true)
      try {
        const res = await fetch('/api/webhooks?action=airtable-fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: airtableApiKey, base_id: baseId, table_id: tableId }),
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
  }, [editedOffer.crmProvider, airtableApiKey, editedOffer.crmMapping?.airtableBaseId, editedOffer.crmMapping?.airtableTableId])

  const handleSaveAirtableKey = async () => {
    if (!user) return
    setAirtableSaving(true)
    try {
      await supabase
        .from('profiles')
        .update({ airtable_api_key: airtableApiKey || null })
        .eq('id', user.id)
    } catch (err) {
      console.error('Error saving Airtable key:', err)
    } finally {
      setAirtableSaving(false)
    }
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
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'offre "${offer.name}" ?`)) {
      if (onDelete) {
        onDelete(offer.id)
      }
      onClose()
    }
  }

  const handleCreateAndAttachContact = async () => {
    if (!newContactData.name || !newContactData.email) {
      alert("Le nom et l'email sont requis.")
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
      alert("Impossible de créer le contact.")
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
      name: `Formule ${editedOffer.formulas?.length ? editedOffer.formulas.length + 1 : 1}`,
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
      alert("Il faut au moins une formule.")
      return
    }
    setEditedOffer({
      ...editedOffer,
      formulas: editedOffer.formulas?.filter(f => f.id !== id)
    })
  }

  const handleAddResource = () => {
    if (!tempResName.trim() || !tempResLink.trim()) {
      alert('Veuillez remplir le nom et le lien de la ressource')
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
        return <FileText className="h-4 w-4 text-blue-400" />
      case 'payment':
        return <Euro className="h-4 w-4 text-emerald-400" />
      case 'drive':
        return <ExternalLink className="h-4 w-4 text-purple-400" />
      default:
        return <ExternalLink className="h-4 w-4 text-slate-400" />
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('fr-FR', {
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-[#020617] shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 custom-scrollbar animate-in fade-in zoom-in duration-300">

        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-600/10 opacity-20 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/10 opacity-10 blur-[80px] rounded-full pointer-events-none" />
        {/* Header Section */}
        <div className="sticky top-0 z-10 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-8 py-8">
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
                    className="flex-1 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 text-xl font-black text-white focus:border-blue-500/50 focus:outline-none transition-all"
                  />
                ) : (
                  <h2 className="text-3xl font-black text-white tracking-tight">{offer.name}</h2>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-500/10 text-slate-400'
                    }`}
                >
                  {offer.status === 'active' ? 'Active' : 'Archivée'}
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedOffer.company}
                  onChange={(e) =>
                    setEditedOffer({ ...editedOffer, company: e.target.value })
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-1.5 text-sm text-slate-400 focus:border-blue-500/50 focus:outline-none transition-all"
                />
              ) : (
                <p className="mt-2 text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  {offer.company}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 active:scale-95"
                    title="Sauvegarder"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 active:scale-95"
                    title="Annuler"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
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
              <div className="h-6 w-px bg-white/10 mx-1" />
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
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
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Cible Marketing
            </p>
            {isEditing ? (
              <div className="flex gap-4">
                <button
                  onClick={() => setEditedOffer({ ...editedOffer, target: 'B2C' })}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${editedOffer.target === 'B2C'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                >
                  <User className="h-5 w-5" />
                  B2C (Particuliers)
                </button>
                <button
                  onClick={() => setEditedOffer({ ...editedOffer, target: 'B2B' })}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${editedOffer.target === 'B2B'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                >
                  <Building2 className="h-5 w-5" />
                  B2B (Entreprises)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-[20px] border border-white/5 bg-slate-900/30 px-6 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {offer.target === 'B2C' ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </div>
                <div>
                  <span className="text-base font-bold text-white">
                    {offer.target === 'B2C' ? 'B2C (Particuliers)' : 'B2B (Entreprises)'}
                  </span>
                  <p className="text-xs text-slate-500 font-medium tracking-wide">Configuration du pipeline adaptée</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-8 md:grid-cols-2 relative z-10">
            {/* Zone A - Formules (Multi-Tarification) */}
            <div className="rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  <Tag className="h-3.5 w-3.5" /> Formules & Tarifs
                </h3>
                {isEditing && (
                  <button
                    onClick={handleAddFormula}
                    className="flex items-center gap-1.5 rounded-full bg-blue-600/10 px-3 py-1.5 text-[10px] font-black text-blue-400 hover:bg-blue-600/20 border border-blue-500/20 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    <Plus className="h-3 w-3" /> Ajouter
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {(editedOffer.formulas || []).map((formula, index) => {
                  const comm = calculateCommission(formula.price, formula.commission)
                  return (
                    <div key={formula.id} className="relative rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:border-white/10 group/formula">
                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={formula.name}
                              onChange={(e) => handleUpdateFormula(formula.id, 'name', e.target.value)}
                              placeholder="Nom (ex: Pack Gold)"
                              className="flex-1 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2 text-sm font-bold text-white focus:border-blue-500/50 focus:outline-none"
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
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Prix (€)</p>
                              <input
                                type="number"
                                value={formula.price}
                                onChange={(e) => handleUpdateFormula(formula.id, 'price', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2 text-sm text-white font-black focus:border-emerald-500/50 focus:outline-none"
                              />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Com. (%)</p>
                              <input
                                type="number"
                                value={formula.commission}
                                onChange={(e) => handleUpdateFormula(formula.id, 'commission', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2 text-sm text-blue-400 font-black focus:border-blue-500/50 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gain estimé</span>
                            <span className="text-xs font-black text-emerald-400">{comm.toLocaleString()} €</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-black text-white text-sm tracking-tight">{formula.name}</h4>
                            <div className="flex items-center gap-3 mt-1.5 font-medium">
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Commission {formula.commission}%</span>
                              <div className="h-1 w-1 rounded-full bg-slate-700" />
                              <span className="text-xs text-blue-400 font-bold">{comm.toLocaleString()} € / vente</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="inline-flex flex-col items-end">
                              <span className="text-lg font-black text-white tracking-tight">{parseFloat(formula.price).toLocaleString()}€</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {(!editedOffer.formulas || editedOffer.formulas.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-600">
                    <Tag className="h-8 w-8 opacity-20" />
                    <p className="text-[11px] font-bold uppercase tracking-widest italic">Aucune formule définie</p>
                  </div>
                )}
              </div>
            </div>

            {/* Zone B - Context (Dates) */}
            <div className="rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md">
              <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                Validité Commerciale
              </h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Lancement de l'offre</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedOffer.startDate}
                      onChange={(e) =>
                        setEditedOffer({ ...editedOffer, startDate: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all"
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/5 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-white tracking-tight">{formatDate(offer.startDate)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Expiration prévue</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedOffer.endDate || ''}
                      onChange={(e) =>
                        setEditedOffer({ ...editedOffer, endDate: e.target.value || undefined })
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all"
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/5 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500/80">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-white tracking-tight">
                        {offer.endDate ? formatDate(offer.endDate) : 'Illimitée'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-8 rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md relative z-10">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
              Description de la mission
            </h3>
            {isEditing ? (
              <textarea
                value={editedOffer.description}
                onChange={(e) =>
                  setEditedOffer({ ...editedOffer, description: e.target.value })
                }
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white font-medium focus:border-blue-500/50 focus:outline-none resize-none transition-all"
                placeholder="Détails de l'offre, avatar client, etc."
              />
            ) : (
              <p className="text-sm leading-relaxed text-slate-300 font-medium px-1">{offer.description}</p>
            )}
          </div>

          {/* Zone C - Contacts Rattachés - MODIFIÉ AVEC CRÉATION */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <Users className="h-4 w-4" />
                Contacts Rattachés
              </h3>
              {/* BOUTON CRÉER CONTACT */}
              {isEditing && !isCreatingContact && (
                <button
                  onClick={() => setIsCreatingContact(true)}
                  className="flex items-center gap-1 rounded bg-purple-500/10 px-2 py-1 text-xs font-bold text-purple-400 hover:bg-purple-500/20"
                >
                  <UserPlus className="h-3 w-3" /> Nouveau Contact
                </button>
              )}
            </div>

            {/* FORMULAIRE CRÉATION RAPIDE */}
            {isEditing && isCreatingContact && (
              <div className="mb-4 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 animate-in fade-in slide-in-from-top-2">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase text-purple-300">Ajout Rapide</p>
                  <button onClick={() => setIsCreatingContact(false)} className="text-slate-400 hover:text-white"><X className="h-3 w-3" /></button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="text" placeholder="Nom complet *" value={newContactData.name} onChange={(e) => setNewContactData({ ...newContactData, name: e.target.value })} className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                  <input type="text" placeholder="Rôle (ex: Closer) *" value={newContactData.role} onChange={(e) => setNewContactData({ ...newContactData, role: e.target.value })} className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                  <input type="email" placeholder="Email *" value={newContactData.email} onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })} className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                  <input type="tel" placeholder="Téléphone" value={newContactData.phone} onChange={(e) => setNewContactData({ ...newContactData, phone: e.target.value })} className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                </div>
                <button onClick={handleCreateAndAttachContact} className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-purple-600 py-2 text-sm font-bold text-white hover:bg-purple-500">
                  <Check className="h-4 w-4" /> Créer et Attacher
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
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{contact.name}</p>
                        <p className="text-xs text-slate-500">{contact.role}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Aucun contact rattaché</p>
                )}
              </div>
            )}
          </div>

          {/* Configuration Facturation */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <Receipt className="h-4 w-4" /> Configuration Facturation
            </h3>

            {/* Toggle Commission + Fixe */}
            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Type de rémunération</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editedOffer.hasFixedFee ? 'Commission + Fixe' : 'Commission uniquement'}
                  </p>
                </div>
                {isEditing ? (
                  <button
                    onClick={() => setEditedOffer({ ...editedOffer, hasFixedFee: !editedOffer.hasFixedFee, fixedFeeAmount: editedOffer.hasFixedFee ? '' : (editedOffer.fixedFeeAmount || '') })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editedOffer.hasFixedFee ? 'bg-blue-500' : 'bg-slate-700'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${editedOffer.hasFixedFee ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                ) : (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.hasFixedFee
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-slate-500/10 text-slate-400'
                    }`}>
                    {offer.hasFixedFee ? 'Commission + Fixe' : 'Commission'}
                  </span>
                )}
              </div>

              {/* Champ Montant Fixe (visible uniquement si activé) */}
              {editedOffer.hasFixedFee && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Montant Fixe (€)</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editedOffer.fixedFeeAmount || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, fixedFeeAmount: e.target.value })}
                      placeholder="Ex: 500"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-emerald-400 font-bold placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm font-bold text-emerald-400">{parseFloat(offer.fixedFeeAmount || '0').toLocaleString()}€</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Raison Sociale */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Raison Sociale</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.billingName || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, billingName: e.target.value })}
                    placeholder="Ex: ACME SAS"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-300">{offer.billingName || 'Non définie'}</p>
                )}
              </div>

              {/* Adresse */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Adresse</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.billingAddress || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, billingAddress: e.target.value })}
                    placeholder="Ex: 123 Rue de la Paix"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-300">{offer.billingAddress || 'Non définie'}</p>
                )}
              </div>

              {/* Ville / CP / Pays */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Ville</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingCity || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingCity: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingCity || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Code Postal</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingZip || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingZip: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingZip || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Pays</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingCountry || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingCountry: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingCountry || '-'}</p>
                  )}
                </div>
              </div>

              {/* SIRET */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">SIRET / TVA</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedOffer.siret || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, siret: e.target.value })}
                    placeholder="123 456 789 00012"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm text-slate-300 font-mono">{offer.siret || 'Non défini'}</p>
                )}
              </div>

              {/* Email / Tel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Email Facturation</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editedOffer.billingEmail || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingEmail: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingEmail || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase">Téléphone</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOffer.billingPhone || ''}
                      onChange={(e) => setEditedOffer({ ...editedOffer, billingPhone: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">{offer.billingPhone || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* --- CONFIGURATION CRM (SIMPLIFIÉE AVEC FORMULE PAR DÉFAUT) --- */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-4 flex items-center flex-wrap gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-2">
                <Link className="h-4 w-4" /> Synchronisation CRM
              </span>
              <span className="ml-2 text-[10px] font-bold normal-case text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                Note : Les leads précédents ne seront pas importés. Seuls les nouveaux à partir d'aujourd'hui seront synchronisés.
              </span>
            </h3>

            {/* 1. CRM Settings */}
            <div className="mb-10 rounded-[20px] border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md">
              <label className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <Database className="h-3 w-3" /> Source de données (CRM)
              </label>
              {isEditing ? (
                <div className="relative">
                  <select
                    value={editedOffer.crmProvider || 'iclosed'}
                    onChange={(e) => setEditedOffer({ ...editedOffer, crmProvider: e.target.value as any })}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all"
                  >
                    <option value="iclosed">iClosed</option>
                    <option value="hubspot">HubSpot</option>
                    <option value="pipedrive">Pipedrive</option>
                    <option value="gohighlevel">GoHighLevel</option>
                    <option value="systemeio">Systeme.io</option>
                    <option value="airtable">Airtable</option>
                    <option value="zapier">Zapier</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${offer.crmProvider === 'iclosed' ? 'bg-purple-500' :
                    offer.crmProvider === 'hubspot' ? 'bg-orange-500' :
                      offer.crmProvider === 'pipedrive' ? 'bg-green-500' :
                        offer.crmProvider === 'gohighlevel' ? 'bg-teal-500' :
                          offer.crmProvider === 'systemeio' ? 'bg-blue-500' :
                            offer.crmProvider === 'airtable' ? 'bg-[#18BFFF]' :
                              offer.crmProvider === 'zapier' ? 'bg-[#FF4A00]' :
                                'bg-slate-500'
                    }`} />
                  <p className="text-sm font-medium text-white capitalize">
                    {offer.crmProvider === 'hubspot' ? 'HubSpot' :
                      offer.crmProvider === 'pipedrive' ? 'Pipedrive' :
                        offer.crmProvider === 'gohighlevel' ? 'GoHighLevel' :
                          offer.crmProvider === 'systemeio' ? 'Systeme.io' :
                            offer.crmProvider === 'airtable' ? 'Airtable' :
                              offer.crmProvider === 'zapier' ? 'Zapier' :
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
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-500 transition-all shadow-lg"
                  >
                    <Link className="h-4 w-4" /> Connecter Pipedrive
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-semibold text-green-400">Pipedrive Connecté</span>
                      </div>
                      <button onClick={handleDisconnectPipedrive} className="text-xs text-slate-500 hover:text-white underline">Déconnecter</button>
                    </div>

                    {/* Sync button */}
                    <button
                      onClick={handleSyncPipedrive}
                      disabled={isSyncingPipedrive}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 py-2.5 text-sm font-semibold text-green-300 hover:bg-green-500/20 transition-all disabled:opacity-50"
                    >
                      {isSyncingPipedrive ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Synchro en cours...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4" /> Synchroniser Pipedrive</>
                      )}
                    </button>

                    {/* Mapping UI */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                      <h5 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Mapping des étapes Pipedrive</h5>
                      <div className="space-y-4">
                        {[
                          { id: 'prospect', name: 'Prospect' },
                          { id: 'qualified', name: 'Qualifié' },
                          { id: 'won', name: 'Gagné' },
                          { id: 'followup', name: 'Follow Up' },
                          { id: 'noshow', name: 'No Show' },
                          { id: 'lost', name: 'Perdu' }
                        ].map(stage => (
                          <div key={stage.id}>
                            <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">{stage.name}</label>
                            <select
                              value={pipedriveMappings[stage.id] || ''}
                              onChange={(e) => handleUpdatePipedriveMapping(stage.id, Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
                            >
                              <option value="">Sélectionner une étape Pipedrive</option>
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
                      <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-300">
                        ✅ {pipedriveSyncResult.imported} deals importés, {pipedriveSyncResult.updated} mis à jour
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
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-500 transition-all shadow-lg"
                  >
                    <Link className="h-4 w-4" /> Connecter GoHighLevel
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-teal-500/20 bg-teal-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-teal-400" />
                        <span className="text-sm font-semibold text-teal-400">GoHighLevel Connecté</span>
                      </div>
                      <button onClick={handleDisconnectGhl} className="text-xs text-slate-500 hover:text-white underline">Déconnecter</button>
                    </div>

                    {/* Sync button */}
                    <button
                      onClick={handleSyncGhl}
                      disabled={isSyncingGhl}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 py-2.5 text-sm font-semibold text-teal-300 hover:bg-teal-500/20 transition-all disabled:opacity-50"
                    >
                      {isSyncingGhl ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Synchro en cours...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4" /> Synchroniser GoHighLevel</>
                      )}
                    </button>

                    {/* Pipeline selection */}
                    {isEditing && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                        <h5 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Pipeline GoHighLevel</h5>

                        {/* Select Pipeline */}
                        <div className="mb-4">
                          <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Pipeline</label>
                          <select
                            value={editedOffer.crmMapping?.ghlPipelineId || ''}
                            onChange={(e) => setEditedOffer({
                              ...editedOffer,
                              crmMapping: { ...editedOffer.crmMapping, ghlPipelineId: e.target.value }
                            })}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                          >
                            <option value="">Sélectionner un pipeline</option>
                            {ghlPipelines.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Stage Mapping */}
                        {editedOffer.crmMapping?.ghlPipelineId && (
                          <div className="space-y-4">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mapping des étapes</h5>
                            {[
                              { id: 'prospect', name: 'Prospect' },
                              { id: 'qualified', name: 'Qualifié' },
                              { id: 'won', name: 'Gagné' },
                              { id: 'followup', name: 'Follow Up' },
                              { id: 'noshow', name: 'No Show' },
                              { id: 'lost', name: 'Perdu' }
                            ].map(stage => (
                              <div key={stage.id}>
                                <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">{stage.name}</label>
                                <select
                                  value={editedOffer.crmMapping?.[stage.id] || ''}
                                  onChange={(e) => handleUpdateGhlMapping(stage.id, e.target.value)}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                                >
                                  <option value="">Sélectionner une étape GHL</option>
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
                      <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-300">
                        {ghlSyncResult.imported} contacts importés, {ghlSyncResult.updated} mis à jour
                      </div>
                    )}

                    <p className="text-[10px] text-teal-300/60">
                      La synchronisation importe tous les contacts et opportunités GoHighLevel dans le pipeline de cette offre.
                      Les changements de statut sont synchronisés dans les deux sens.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 2. SÉLECTION DE LA FORMULE PAR DÉFAUT (NOUVEAU) */}
            <div className="mb-10 rounded-[20px] border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md">
              <label className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <BoxSelect className="h-3 w-3" /> Formule par défaut (Prospects Entrants)
              </label>
              {isEditing ? (
                <div className="relative">
                  <select
                    value={editedOffer.defaultFormulaId || ''}
                    onChange={(e) => setEditedOffer({ ...editedOffer, defaultFormulaId: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all"
                  >
                    <option value="">-- Aucune formule (ou 1ère par défaut) --</option>
                    {(editedOffer.formulas || []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({parseFloat(f.price).toLocaleString()}€)
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 font-medium">
                  {editedOffer.defaultFormulaId
                    ? (editedOffer.formulas?.find(f => f.id === editedOffer.defaultFormulaId)?.name || 'Formule introuvable')
                    : <span className="text-slate-500 italic">Aucune sélectionnée (par défaut)</span>
                  }
                </div>
              )}
              <p className="mt-3 text-[10px] text-slate-500 font-medium leading-relaxed">
                Cette formule sera automatiquement assignée aux prospects arrivant via le Webhook ci-dessous.
              </p>
            </div>

            {/* 3. Webhook Info (Helper) - AVEC BOUTON COPIER */}
            {/* 3. CRM-specific Config */}
            {editedOffer.crmProvider === 'hubspot' && (
              /* --- HUBSPOT CONFIG --- */
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-orange-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-orange-100">Configuration HubSpot</h4>

                    {!hubspotConnected ? (
                      <div className="mt-3">
                        <p className="text-xs text-orange-300/80 leading-relaxed mb-3">
                          Connectez votre compte HubSpot pour synchroniser automatiquement vos contacts et deals.
                        </p>
                        <button
                          onClick={handleConnectHubspot}
                          className="w-full flex justify-center items-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-700 transition-all shadow-lg"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Connecter HubSpot
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {/* Connected status */}
                        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm font-semibold text-emerald-400">HubSpot Connecté</span>
                          </div>
                          <button onClick={handleDisconnectHubspot} className="text-xs text-slate-500 hover:text-white underline">Déconnecter</button>
                        </div>

                        {/* Sync button */}
                        <button
                          onClick={handleSyncHubspot}
                          disabled={isSyncingHubspot}
                          className="w-full flex items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 py-2.5 text-sm font-semibold text-orange-300 hover:bg-orange-500/20 transition-all disabled:opacity-50"
                        >
                          {isSyncingHubspot ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Synchronisation en cours...</>
                          ) : (
                            <><RefreshCw className="h-4 w-4" /> Synchroniser les contacts HubSpot</>
                          )}
                        </button>

                        {/* Sync result */}
                        {hubspotSyncResult && (
                          <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-300">
                            ✅ {hubspotSyncResult.imported} contacts importés, {hubspotSyncResult.updated} mis à jour
                          </div>
                        )}

                        <p className="text-[10px] text-orange-300/60">
                          La synchronisation importe tous les contacts HubSpot dans le pipeline de cette offre.
                          Les changements de statut sont synchronisés dans les deux sens.
                        </p>
                      </div>
                    )}

                    {/* --- MAPPING PERSONNALISÉ HUBSPOT --- */}
                    {isEditing && (
                      <div className="mt-6 border-t border-orange-500/20 pt-4">
                        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-orange-400">
                          Mapping Personnalisé (Statuts HubSpot)
                        </h5>
                        <p className="mb-4 text-[10px] text-orange-300/80 leading-relaxed">
                          Par défaut, CloseOS gère automatiquement les statuts classiques.
                          Pour les étapes <strong>Gagné</strong> et <strong>No Show</strong>, indiquez la valeur exacte
                          du <em>Statut du lead</em> (ou de l'<em>Étape du cycle de vie</em>) configurée dans votre HubSpot.
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-orange-300">
                              Statut pour "Gagné" (ex: Client, Gagné)
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
                            <label className="mb-1.5 block text-xs font-medium text-orange-300">
                              Statut pour "No Show" (ex: No Show, Autre)
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
              /* --- ICLOSED CONFIG (webhook) --- */
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-100">Configuration Webhook iClosed</h4>

                    <p className="mt-1 text-xs text-blue-300/80 leading-relaxed">
                      Allez dans <strong>iClosed &gt; Paramètres &gt; Développeur &gt; Webhooks</strong> et collez l'URL ci-dessous.
                    </p>

                    <div className="mt-2 flex items-start gap-2 rounded border border-orange-500/20 bg-orange-500/10 p-2 text-[11px] text-orange-300">
                      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>
                        <strong>Attention :</strong> Si le menu "Développeur" n'apparaît pas, c'est que vous n'avez pas les droits.
                        Seul le <strong>Propriétaire</strong> de l'organisation iClosed peut configurer les Webhooks.
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 rounded border border-blue-500/10 bg-slate-950 p-2 font-mono text-xs text-slate-400 overflow-x-auto whitespace-nowrap">
                        {webhookUrl}
                      </div>
                      <button
                        onClick={handleCopyWebhook}
                        className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        title="Copier l'URL"
                      >
                        {hasCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    {editedOffer.defaultFormulaId && (
                      <p className="mt-2 text-[10px] text-emerald-400/80 flex items-center gap-1">
                        <Check className="h-3 w-3" /> L'ID de la formule a été ajouté à l'URL.
                      </p>
                    )}

                    {isEditing && (editedOffer.crmProvider === 'iclosed' || !editedOffer.crmProvider) && (
                      <div className="mt-4 rounded-lg border border-blue-500/20 overflow-hidden bg-slate-900/50">
                        <div style={{ position: 'relative', boxSizing: 'content-box', width: '100%', aspectRatio: '1.86' }}>
                          <iframe
                            src="https://app.supademo.com/embed/cmla88ewa2sutvhwz09ss0nrs?embed_v=2&utm_source=embed&loop=1&autoplay=1"
                            loading="lazy"
                            title="Configurer le Webhook iClosed"
                            allow="clipboard-write"
                            frameBorder="0"
                            webkitAllowFullScreen
                            mozAllowFullScreen
                            allowFullScreen
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                          />
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}

            {/* --- SYSTEME.IO CONFIG --- */}
            {editedOffer.crmProvider === 'systemeio' && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-100">Configuration Systeme.io</h4>

                    {/* API Key */}
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Clé API Systeme.io
                        </label>
                        <p className="text-[11px] text-slate-400 mb-2">
                          Trouvez votre clé dans <strong className="text-slate-300">Systeme.io → Paramètres → Clés API publiques</strong>
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type={systemeioShowKey ? 'text' : 'password'}
                              value={systemeioApiKey}
                              onChange={(e) => setSystemeioApiKey(e.target.value)}
                              placeholder="Collez votre clé API ici"
                              className="w-full rounded border border-blue-500/10 bg-slate-950 p-2 pr-8 font-mono text-xs text-slate-400 placeholder:text-slate-600"
                            />
                            <button
                              onClick={() => setSystemeioShowKey(!systemeioShowKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {systemeioShowKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <button
                            onClick={handleSaveSystemeioKey}
                            disabled={systemeioSaving}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-all disabled:opacity-50"
                          >
                            {systemeioSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Webhook URL */}
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">URL du Webhook</label>
                        <p className="text-[11px] text-slate-400 mb-2">
                          Collez cette URL dans <strong className="text-slate-300">Systeme.io → Paramètres → Webhooks</strong>
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded border border-blue-500/10 bg-slate-950 p-2 font-mono text-xs text-slate-400 overflow-x-auto whitespace-nowrap">
                            {systemeioWebhookUrl}
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(systemeioWebhookUrl)
                              setSystemeioCopiedUrl(true)
                              setTimeout(() => setSystemeioCopiedUrl(false), 2000)
                            }}
                            className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                          >
                            {systemeioCopiedUrl ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                        {editedOffer.defaultFormulaId && (
                          <p className="mt-1 text-[10px] text-emerald-400/80 flex items-center gap-1">
                            <Check className="h-3 w-3" /> L'ID de la formule a été ajouté à l'URL.
                          </p>
                        )}
                      </div>

                      {/* Instructions */}
                      <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
                        <h5 className="mb-2 text-xs font-bold text-slate-300">Comment configurer :</h5>
                        <ol className="text-[11px] text-slate-500 space-y-1.5 list-decimal list-inside">
                          <li>Allez dans <strong className="text-slate-400">Systeme.io → Paramètres → Clés API publiques</strong> et copiez votre clé</li>
                          <li>Collez la clé API ci-dessus et cliquez sur Sauvegarder</li>
                          <li>Allez dans <strong className="text-slate-400">Systeme.io → Paramètres → Webhooks</strong></li>
                          <li>Ajoutez un webhook avec l'URL ci-dessus</li>
                          <li>Sélectionnez les événements : <strong className="text-slate-400">Opt-in</strong> et/ou <strong className="text-slate-400">Nouvelle vente</strong></li>
                        </ol>
                      </div>

                      {/* Sync info */}
                      <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-2">
                        <p className="text-[10px] text-blue-400/80">
                          <strong>Webhook :</strong> Chaque opt-in ou vente dans Systeme.io crée automatiquement un prospect.
                          <br />
                          <strong>Sync retour :</strong> Les changements de stage dans CloseOS mettent à jour les tags du contact dans Systeme.io (ex: CloseOS-Qualifié, CloseOS-Gagné...).
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
                    <h4 className="text-sm font-semibold text-cyan-100">Configuration Airtable</h4>

                    <div className="mt-3 space-y-3">
                      {/* API Key / Personal Access Token */}
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Personal Access Token
                        </label>
                        <p className="text-[11px] text-slate-400 mb-2">
                          Créez un token sur <strong className="text-slate-300">airtable.com/create/tokens</strong> avec les scopes <strong className="text-slate-300">data.records:read</strong>, <strong className="text-slate-300">data.records:write</strong> et <strong className="text-slate-300">schema.bases:read</strong>
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type={airtableShowKey ? 'text' : 'password'}
                              value={airtableApiKey}
                              onChange={(e) => setAirtableApiKey(e.target.value)}
                              placeholder="pat..."
                              className="w-full rounded border border-[#18BFFF]/10 bg-slate-950 p-2 pr-8 font-mono text-xs text-slate-400 placeholder:text-slate-600"
                            />
                            <button
                              onClick={() => setAirtableShowKey(!airtableShowKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {airtableShowKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <button
                            onClick={handleSaveAirtableKey}
                            disabled={airtableSaving}
                            className="rounded-lg bg-[#18BFFF] px-3 py-2 text-xs font-bold text-white hover:bg-[#10a8e6] transition-all disabled:opacity-50"
                          >
                            {airtableSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Base selector */}
                      {airtableApiKey && (
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Base Airtable
                          </label>
                          {airtableLoadingBases ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Chargement des bases...</div>
                          ) : (
                            <select
                              value={editedOffer.crmMapping?.airtableBaseId || ''}
                              onChange={(e) => setEditedOffer(prev => ({
                                ...prev,
                                crmMapping: { ...prev.crmMapping, airtableBaseId: e.target.value, airtableTableId: '', airtableFieldMapping: {} },
                              }))}
                              className="w-full appearance-none rounded border border-[#18BFFF]/10 bg-slate-950 p-2 text-xs text-white focus:border-[#18BFFF]/50 focus:outline-none"
                            >
                              <option value="">Sélectionner une base...</option>
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
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Table
                          </label>
                          {airtableLoadingTables ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Chargement des tables...</div>
                          ) : (
                            <select
                              value={editedOffer.crmMapping?.airtableTableId || ''}
                              onChange={(e) => setEditedOffer(prev => ({
                                ...prev,
                                crmMapping: { ...prev.crmMapping, airtableTableId: e.target.value, airtableFieldMapping: {} },
                              }))}
                              className="w-full appearance-none rounded border border-[#18BFFF]/10 bg-slate-950 p-2 text-xs text-white focus:border-[#18BFFF]/50 focus:outline-none"
                            >
                              <option value="">Sélectionner une table...</option>
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
                          <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Mapping des colonnes
                          </label>
                          <p className="text-[11px] text-slate-400 mb-2">
                            Associez vos colonnes Airtable aux champs CloseOS
                          </p>
                          <div className="space-y-2">
                            {[
                              { key: 'firstName', label: 'Prénom' },
                              { key: 'lastName', label: 'Nom' },
                              { key: 'email', label: 'Email' },
                              { key: 'phone', label: 'Téléphone' },
                              { key: 'company', label: 'Entreprise' },
                              { key: 'stage', label: 'Statut / Étape' },
                              { key: 'value', label: 'Valeur (€)' },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center gap-2">
                                <span className="w-24 text-[11px] text-slate-400 shrink-0">{label}</span>
                                <select
                                  value={(editedOffer.crmMapping?.airtableFieldMapping as any)?.[key] || ''}
                                  onChange={(e) => updateAirtableMapping(key, e.target.value)}
                                  className="flex-1 appearance-none rounded border border-[#18BFFF]/10 bg-slate-950 p-1.5 text-xs text-white focus:border-[#18BFFF]/50 focus:outline-none"
                                >
                                  <option value="">— Non mappé —</option>
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
                        <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Chargement des colonnes...</div>
                      )}

                      {/* Sync button */}
                      {editedOffer.crmMapping?.airtableTableId && (
                        <div className="pt-2 border-t border-white/5">
                          <button
                            onClick={handleSyncAirtable}
                            disabled={isSyncingAirtable}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#18BFFF] py-2.5 text-sm font-bold text-white hover:bg-[#10a8e6] transition-all disabled:opacity-50"
                          >
                            {isSyncingAirtable ? (
                              <><Loader2 className="h-4 w-4 animate-spin" /> Synchronisation...</>
                            ) : (
                              <><RefreshCw className="h-4 w-4" /> Synchroniser Airtable</>
                            )}
                          </button>
                          {airtableSyncResult && (
                            <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                              <p className="text-xs text-emerald-400">
                                <strong>{airtableSyncResult.imported}</strong> importé{airtableSyncResult.imported > 1 ? 's' : ''} · <strong>{airtableSyncResult.updated}</strong> mis à jour
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sync info */}
                      <div className="rounded-lg border border-[#18BFFF]/10 bg-[#18BFFF]/5 p-2">
                        <p className="text-[10px] text-cyan-400/80">
                          <strong>Import :</strong> Cliquez sur Synchroniser pour importer les records de votre table Airtable en tant que prospects.
                          <br />
                          <strong>Sync retour :</strong> Quand un prospect change de statut dans CloseOS, la colonne Statut est automatiquement mise à jour dans Airtable.
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
                    <h4 className="text-sm font-semibold text-orange-100">Configuration Zapier</h4>

                    {!zapierApiKey ? (
                      <div className="mt-3">
                        <p className="text-xs text-orange-300/80 leading-relaxed mb-3">
                          Générez une clé API pour connecter Zapier à cette offre. Les prospects seront importés directement dans votre pipeline.
                        </p>
                        <button
                          onClick={handleGenerateZapierKey}
                          disabled={zapierLoading}
                          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#FF4A00] py-2.5 text-sm font-bold text-white hover:bg-[#e04300] transition-all disabled:opacity-50"
                        >
                          {zapierLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Génération...</>
                          ) : (
                            <><Key className="h-4 w-4" /> Générer une clé API</>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {/* Connected status */}
                        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm font-semibold text-emerald-400">Clé API active</span>
                          </div>
                          <button
                            onClick={handleDeleteZapierKey}
                            disabled={zapierLoading}
                            className="text-xs text-slate-500 hover:text-red-400 underline flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" /> Supprimer
                          </button>
                        </div>

                        {/* Webhook URL */}
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">URL du Webhook</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded border border-[#FF4A00]/10 bg-slate-950 p-2 font-mono text-xs text-slate-400 overflow-x-auto whitespace-nowrap">
                              {zapierWebhookUrl}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(zapierWebhookUrl)
                                setZapierCopiedUrl(true)
                                setTimeout(() => setZapierCopiedUrl(false), 2000)
                              }}
                              className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                              {zapierCopiedUrl ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                          {editedOffer.defaultFormulaId && (
                            <p className="mt-1 text-[10px] text-emerald-400/80 flex items-center gap-1">
                              <Check className="h-3 w-3" /> L'ID de la formule a été ajouté à l'URL.
                            </p>
                          )}
                        </div>

                        {/* API Key */}
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Clé API (Bearer Token)</label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type={zapierShowKey ? 'text' : 'password'}
                                value={zapierApiKey}
                                readOnly
                                className="w-full rounded border border-[#FF4A00]/10 bg-slate-950 p-2 pr-8 font-mono text-xs text-slate-400"
                              />
                              <button
                                onClick={() => setZapierShowKey(!zapierShowKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
                              className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                              {zapierCopiedKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Instructions */}
                        <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
                          <h5 className="mb-2 text-xs font-bold text-slate-300">Configuration dans Zapier :</h5>
                          <ol className="text-[11px] text-slate-500 space-y-1.5 list-decimal list-inside">
                            <li>Créez un Zap avec votre source (Facebook Ads, Typeform...)</li>
                            <li>Action : <strong className="text-slate-400">Webhooks by Zapier</strong> → <strong className="text-slate-400">POST</strong></li>
                            <li>URL : collez l'URL ci-dessus</li>
                            <li>Headers : <code className="bg-slate-800 px-1 rounded text-[10px] text-slate-400">Authorization: Bearer votre_clé</code></li>
                            <li>Body (JSON) : <code className="bg-slate-800 px-1 rounded text-[10px] text-slate-400">firstName, lastName, email, phone, company, source</code></li>
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
          <div className="mt-8 rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md relative z-10">
            <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
              <ExternalLink className="h-3.5 w-3.5" /> Ressources Commerciales
            </h3>

            {isEditing ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  {editedOffer.resources.length > 0 ? (
                    editedOffer.resources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center gap-4 rounded-2xl border border-white/5 bg-slate-950/50 p-4 transition-all hover:bg-slate-950"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                          {getResourceIcon(resource.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-white tracking-tight">{resource.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium truncate max-w-[200px] mt-0.5">{resource.url}</p>
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
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-600">
                      <ExternalLink className="h-8 w-8 opacity-20" />
                      <p className="text-[11px] font-bold uppercase tracking-widest italic">Aucune ressource disponible</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                    Ajouter une ressource
                  </p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Nom (ex: Script de vente)"
                      value={tempResName}
                      onChange={(e) => setTempResName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none transition-all"
                    />
                    <input
                      type="url"
                      placeholder="URL (ex: https://...)"
                      value={tempResLink}
                      onChange={(e) => setTempResLink(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none transition-all"
                    />
                    <button
                      onClick={handleAddResource}
                      className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20 active:scale-95 uppercase tracking-widest"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter au catalogue
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
                      className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-slate-950/50 p-4 transition-all hover:border-blue-500/30 hover:bg-slate-900 hover:shadow-lg hover:shadow-blue-500/5"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20 transition-all">
                        {getResourceIcon(resource.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-white tracking-tight group-hover:text-blue-400 transition-colors">
                          {resource.name}
                        </p>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                          Ouvrir <ExternalLink className="h-2 w-2" />
                        </span>
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="col-span-2 flex flex-col items-center justify-center py-6 gap-2 text-slate-600">
                    <ExternalLink className="h-8 w-8 opacity-20" />
                    <p className="text-[11px] font-bold uppercase tracking-widest italic text-center">Aucune ressource disponible</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zone E - Notes */}
          <div className="mt-8 rounded-3xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-md relative z-10">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
              Notes de Closing
            </h3>
            {isEditing ? (
              <textarea
                value={editedOffer.notes || ''}
                onChange={(e) =>
                  setEditedOffer({ ...editedOffer, notes: e.target.value })
                }
                rows={4}
                placeholder="Instructions spécifiques pour closer cette offre..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white font-medium focus:border-blue-500/50 focus:outline-none resize-none transition-all"
              />
            ) : (
              <p className="text-sm leading-relaxed text-slate-300 font-medium px-1">
                {offer.notes || 'Aucune note'}
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