import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Calendar, 
  Clock, 
  ExternalLink, 
  X, 
  Video, 
  Phone, 
  Loader2, 
  History, 
  Trash2, 
  ChevronDown, 
  Mail, 
  Save,
  CheckCircle2,
  Globe,
  Webhook,
  Copy,
  Check,
  Plus,
  Settings,
  Link as LinkIcon,
  Edit2,
  MapPin,
  AlertCircle,
  RefreshCw,
  LogOut
} from 'lucide-react'
import { useMeetings } from '../contexts/MeetingsContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { format, isValid, parseISO, isAfter, startOfDay, compareAsc, compareDesc, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '../lib/utils'
import { isDailyCoLink } from '../services/dailyService'

interface EventTypeData {
  id: number
  title: string
  slug: string
  length: number
  description: string
  locations: Array<{ type: string; address?: string; link?: string; phone?: string }>
  beforeEventBuffer: number
  afterEventBuffer: number
  minimumBookingNotice: number
  slotInterval: number | null
}

export function RendezVous() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { meetings, loading: meetingsLoading, refreshMeetings } = useMeetings()
  const { maskData } = usePrivacy()
  
  const [calAccessToken, setCalAccessToken] = useState('')
  const [calUsername, setCalUsername] = useState('')
  const [calProfile, setCalProfile] = useState<any>(null)
  const [isHandlingOAuth, setIsHandlingOAuth] = useState(false)
  
  const [eventTypes, setEventTypes] = useState<any[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [isDeletingEvent, setIsDeletingEvent] = useState<number | null>(null)
  
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDuration, setNewEventDuration] = useState('30')
  const [newEventSlug, setNewEventSlug] = useState('')
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  
  const [editingEvent, setEditingEvent] = useState<EventTypeData | null>(null)
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false)
  const [noticeUnit, setNoticeUnit] = useState<'minutes' | 'hours'>('minutes')
  
  const [webhookCopied, setWebhookCopied] = useState(false)
  const [linkCopiedId, setLinkCopiedId] = useState<number | null>(null)
  const [calBookings, setCalBookings] = useState<any[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  
  const baseUrl = window.location.origin.includes('localhost') 
    ? 'http://localhost:5173' 
    : 'https://close-os.vercel.app'
  
  const webhookUrl = user?.id ? `${baseUrl}/api/cal-webhook?userid=${user.id}` : 'Chargement...'
  
  // 🔥 URL OAuth CORRIGÉE
  const calOAuthUrl = useMemo(() => {
    if (!user?.id) return ''
    
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_CAL_CLIENT_ID,
      redirect_uri: 'https://close-os.vercel.app/rendez-vous',
      response_type: 'code',
      state: user.id
    })
    
    return `https://app.cal.com/auth/oauth2/authorize?${params.toString()}`
  }, [user?.id])

  // 1. Chargement initial avec LOGS
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        console.log('❌ Pas d\'user')
        return
      }
      
      console.log('🔍 Récupération du profil pour user:', user.id)
      
      const { data, error } = await supabase
        .from('profiles')
        .select('cal_access_token')
        .eq('id', user.id)
        .single()
      
      if (error) {
        console.error('❌ Erreur Supabase:', error)
        return
      }
      
      console.log('📦 Profil récupéré, Token présent?', data?.cal_access_token ? 'OUI' : 'NON')
      
      if (data?.cal_access_token) {
        setCalAccessToken(data.cal_access_token)
        console.log('✅ Token défini, lancement des fetch...')
        
        fetchEventTypes(data.cal_access_token)
        fetchCalProfile(data.cal_access_token)
        fetchCalBookings(data.cal_access_token, false)
      } else {
        console.log('⚠️ Pas de token dans Supabase')
      }
    }
    
    fetchProfile()
  }, [user])

  // --- GESTION DU RETOUR OAUTH ---
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    if (code && state && !isHandlingOAuth) {
      const handleOAuthCallback = async () => {
        setIsHandlingOAuth(true)
        try {
          console.log('🔄 Callback OAuth, envoi au serveur...')
          
          const response = await fetch('/api/cal-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state })
          })
          
          const result = await response.json()
          console.log('📥 Réponse serveur:', result)
          
          if (!response.ok) {
            throw new Error(result.error || 'Erreur connexion')
          }
          
          setSearchParams({})
          alert('Connexion réussie ! La page va se recharger.')
          window.location.reload()
        } catch (error: any) {
          console.error('❌ Erreur OAuth:', error)
          alert(`Erreur: ${error.message}`)
          setSearchParams({})
        } finally {
          setIsHandlingOAuth(false)
        }
      }
      
      handleOAuthCallback()
    }
  }, [searchParams])

  // --- Helpers API ---
  const getAuthHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  })

  // --- FONCTIONS AVEC LOGS ---
  const fetchEventTypes = async (token: string) => {
    if (!token) {
      console.log('⚠️ fetchEventTypes: Pas de token')
      return
    }
    
    console.log('📡 Fetch Event Types...')
    setIsLoadingEvents(true)
    
    try {
      const url = 'https://api.cal.com/v1/event-types'
      console.log('📤 GET', url)
      console.log('🔑 Token:', token.substring(0, 20) + '...')
      
      const response = await fetch(url, {
        headers: getAuthHeaders(token)
      })
      
      console.log('📊 Status Event Types:', response.status)
      
      const data = await response.json()
      console.log('📦 Response Event Types:', data)
      
      if (data.event_types) {
        console.log('✅ Event Types trouvés:', data.event_types.length)
        setEventTypes(data.event_types)
      } else {
        console.log('⚠️ Pas d\'event_types dans la réponse')
        console.log('Structure complète:', JSON.stringify(data))
      }
    } catch (error) {
      console.error('❌ Erreur fetch Event Types:', error)
    } finally {
      setIsLoadingEvents(false)
    }
  }

  const fetchCalProfile = async (token: string) => {
    if (!token) return
    
    console.log('📡 Fetch Cal Profile...')
    
    try {
      const response = await fetch('https://api.cal.com/v1/me', {
        headers: getAuthHeaders(token)
      })
      
      console.log('📊 Status Profile:', response.status)
      
      const data = await response.json()
      console.log('📦 Response Profile:', data)
      
      const userData = data.user || data
      if (userData) {
        console.log('✅ Profil Cal.com:', userData.username)
        setCalProfile(userData)
        if (userData.username) setCalUsername(userData.username)
      }
    } catch (error) {
      console.error('❌ Erreur fetch Profile:', error)
    }
  }

  const fetchCalBookings = async (token: string, manualTrigger: boolean = false) => {
    if (!token) return
    if (manualTrigger) setIsSyncing(true)
    
    try {
      const response = await fetch(
        'https://api.cal.com/v1/bookings?take=100&status=CANCELLED,ACCEPTED,REJECTED',
        { headers: getAuthHeaders(token) }
      )
      const data = await response.json()
      
      if (data.bookings) {
        setCalBookings(data.bookings)
        if (manualTrigger) alert(`Synchronisation terminée`)
      }
    } catch (error) {
      console.error('❌ Erreur fetch Bookings:', error)
    } finally {
      if (manualTrigger) setIsSyncing(false)
    }
  }

  const handleDeleteEventType = async (id: number) => {
    if (!window.confirm('Voulez-vous supprimer ce lien définitivement ?')) return
    setIsDeletingEvent(id)
    try {
      const response = await fetch(`https://api.cal.com/v1/event-types/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(calAccessToken)
      })
      if (!response.ok) throw new Error('Erreur suppression')
      await fetchEventTypes(calAccessToken)
    } catch (error) {
      alert('Erreur suppression')
    } finally {
      setIsDeletingEvent(null)
    }
  }

  const handleCreateEventType = async () => {
    if (!newEventTitle || !newEventSlug) {
      alert('Titre et slug requis')
      return
    }
    
    console.log('🆕 Création event type:', newEventTitle)
    setIsCreatingEvent(true)
    
    try {
      const payload = {
        title: newEventTitle,
        slug: newEventSlug,
        length: parseInt(String(newEventDuration)),
        isHidden: false
      }
      
      console.log('📤 POST payload:', payload)
      
      const response = await fetch('https://api.cal.com/v1/event-types', {
        method: 'POST',
        headers: getAuthHeaders(calAccessToken),
        body: JSON.stringify(payload)
      })
      
      console.log('📊 Status création:', response.status)
      
      const data = await response.json()
      console.log('📦 Response création:', data)
      
      if (!response.ok) {
        throw new Error(data.message || 'Erreur création')
      }
      
      console.log('✅ Event type créé')
      await fetchEventTypes(calAccessToken)
      setIsCreateModalOpen(false)
      setNewEventTitle('')
      setNewEventSlug('')
      setNewEventDuration('30')
    } catch (error: any) {
      console.error('❌ Erreur création:', error)
      alert(`Erreur: ${error.message}`)
    } finally {
      setIsCreatingEvent(false)
    }
  }

  const handleOpenEdit = (evt: any) => {
    const notice = evt.minimumBookingNotice || 0
    let unit: 'minutes' | 'hours' = 'minutes'
    let value = notice
    
    if (notice >= 60 && notice % 60 === 0) {
      unit = 'hours'
      value = notice / 60
    }
    
    setEditingEvent({
      id: evt.id,
      title: evt.title,
      slug: evt.slug,
      length: evt.length,
      description: evt.description || '',
      locations: evt.locations || [{ type: 'integrations:daily' }],
      beforeEventBuffer: evt.beforeEventBuffer || 0,
      afterEventBuffer: evt.afterEventBuffer || 0,
      minimumBookingNotice: value,
      slotInterval: evt.slotInterval || null
    })
    setNoticeUnit(unit)
    setIsEditModalOpen(true)
  }

  const handleUpdateEvent = async () => {
    if (!editingEvent) return
    setIsUpdatingEvent(true)
    try {
      const noticeInMinutes = noticeUnit === 'hours' 
        ? editingEvent.minimumBookingNotice * 60 
        : editingEvent.minimumBookingNotice
      
      const payload = {
        title: editingEvent.title,
        slug: editingEvent.slug,
        length: Number(editingEvent.length),
        description: editingEvent.description,
        locations: editingEvent.locations,
        beforeEventBuffer: Number(editingEvent.beforeEventBuffer),
        afterEventBuffer: Number(editingEvent.afterEventBuffer),
        minimumBookingNotice: Number(noticeInMinutes),
        slotInterval: editingEvent.slotInterval ? Number(editingEvent.slotInterval) : null
      }
      
      const response = await fetch(`https://api.cal.com/v1/event-types/${editingEvent.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(calAccessToken),
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) throw new Error('Erreur mise à jour')
      
      await fetchEventTypes(calAccessToken)
      setIsEditModalOpen(false)
    } catch (error) {
      alert('Erreur maj')
      console.error(error)
    } finally {
      setIsUpdatingEvent(false)
    }
  }

  const handleCopyLink = (slug: string, id: number) => {
    const url = `https://cal.com/${calUsername}/${slug}`
    navigator.clipboard.writeText(url)
    setLinkCopiedId(id)
    setTimeout(() => setLinkCopiedId(null), 2000)
  }

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setWebhookCopied(true)
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  // Fonctions helpers
  const safeFormat = (dateStr: string, formatStr: string) => {
    try {
      const date = parseISO(dateStr)
      return isValid(date) ? format(date, formatStr, { locale: fr }) : 'N/A'
    } catch {
      return 'N/A'
    }
  }

  const getStatusStyle = (s: string) => {
    s = s?.toLowerCase()
    if (['upcoming', 'confirm', 'confirmed', 'scheduled', 'accepted'].includes(s)) {
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    }
    if (['annulé', 'cancelled', 'rejected', 'canceled'].includes(s)) {
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    }
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }

  const getStatusLabel = (s: string) => {
    s = s?.toLowerCase()
    if (['upcoming', 'confirm', 'confirmed', 'scheduled', 'accepted'].includes(s)) return 'Confirmé'
    if (['annulé', 'cancelled', 'canceled'].includes(s)) return 'Annulé'
    if (['rejected'].includes(s)) return 'Refusé'
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  const getMeetingSource = (m: any) => {
    if (!m) return 'Réservation'
    if (m.description?.match(/Type:/)) {
      return m.description.match(/Type:\s*([^\n\r]*)/)?.[1]?.trim()
    }
    return 'Appel'
  }

  if (meetingsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-8 text-left">
      {isHandlingOAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Connexion Cal.com...</h2>
            <p className="text-slate-400 mt-2">Veuillez patienter</p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Rendez-vous</h1>
            <p className="text-slate-400">Consultez vos rendez-vous et gérez votre agenda.</p>
          </div>
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 transition-all shadow-lg"
          >
            <Settings className="h-4 w-4" />
            Configurer
          </button>
        </div>

        {calAccessToken && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
                  <LinkIcon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Vos Liens de Réservation</h2>
                  <p className="text-sm text-slate-400 mt-1">Vos types d'événements actifs sur Cal.com</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"
              >
                <Plus className="h-4 w-4" />
                Nouveau
              </button>
            </div>

            {isLoadingEvents ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {eventTypes.map((evt) => (
                  <div
                    key={evt.id}
                    className="group relative rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-all flex flex-col justify-between hover:shadow-lg hover:shadow-black/20"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="inline-block rounded bg-slate-800 px-2 py-1 text-xs font-bold text-slate-400">
                          {evt.length} min
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteEventType(evt.id)}
                            disabled={isDeletingEvent === evt.id}
                            className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors"
                          >
                            {isDeletingEvent === evt.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                          <a
                            href={`https://cal.com/${calUsername}/${evt.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                      <h3 className="font-bold text-white text-lg mb-1">{evt.title}</h3>
                      <p className="text-xs text-slate-500 font-mono mb-4">{evt.slug}</p>
                    </div>
                    <div className="flex gap-2 mt-auto border-t border-slate-800 pt-3">
                      <button
                        onClick={() => handleCopyLink(evt.slug, evt.id)}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        {linkCopiedId === evt.id ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        Copier
                      </button>
                      <button
                        onClick={() => handleOpenEdit(evt)}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600/10 py-2 text-xs font-bold text-blue-400 hover:bg-blue-600/20 transition-colors"
                      >
                        <Edit2 className="h-3 w-3" />
                        Modifier
                      </button>
                      <a
                        href={`https://app.cal.com/event-types/${evt.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center rounded-lg bg-slate-800 px-3 text-slate-400 hover:text-white hover:bg-slate-700"
                      >
                        <Settings className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
                {eventTypes.length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-500 italic border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                    Aucun événement trouvé. Créez-en un !
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL CONFIG */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsConfigModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">Configuration Cal.com</h2>
                <p className="text-slate-400 text-sm mt-1">Paramètres de connexion</p>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-8 space-y-8 bg-slate-950/50">
              <section>
                <h3 className="text-sm font-bold text-white mb-2 uppercase">Connexion</h3>
                {calAccessToken ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-white">Compte connecté</h4>
                        <p className="text-xs text-emerald-400">Synchronisation active</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!window.confirm('Se déconnecter ?')) return
                          await supabase
                            .from('profiles')
                            .update({ cal_access_token: null, cal_refresh_token: null })
                            .eq('id', user?.id)
                          window.location.reload()
                        }}
                        className="px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg"
                      >
                        Déconnecter
                      </button>
                    </div>

                    {calProfile && (
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold text-white">
                          {calProfile.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">{calProfile.name || 'Utilisateur'}</p>
                          <p className="text-xs text-slate-400">@{calProfile.username}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <a
                      href={calOAuthUrl}
                      className="w-full flex justify-center items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-slate-200"
                    >
                      Se connecter avec Cal.com
                    </a>
                  </div>
                )}
              </section>

              {calAccessToken && (
                <section>
                  <h3 className="text-sm font-bold text-white mb-2 uppercase">Webhook</h3>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2 pl-4">
                    <code className="text-xs font-mono text-purple-300 truncate flex-1">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={handleCopyWebhook}
                      className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      {webhookCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREATE */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">Nouveau Type d'événement</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => {
                    setNewEventTitle(e.target.value)
                    setNewEventSlug(e.target.value.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''))
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 px-4 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Appel Découverte"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL Slug</label>
                <div className="flex items-center">
                  <span className="bg-slate-800 text-slate-500 px-3 py-2.5 rounded-l-lg border border-r-0 border-slate-700 text-sm">
                    /
                  </span>
                  <input
                    type="text"
                    value={newEventSlug}
                    onChange={(e) => setNewEventSlug(e.target.value)}
                    className="w-full rounded-r-lg border border-slate-700 bg-slate-950 py-2.5 px-4 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Durée (minutes)</label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setNewEventDuration(String(mins))}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-bold border transition-all',
                        newEventDuration === String(mins)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                      )}
                    >
                      {mins}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 rounded-lg py-3 font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateEventType}
                disabled={isCreatingEvent || !newEventTitle}
                className="flex-1 rounded-lg bg-blue-600 py-3 font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {isCreatingEvent ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT - Simplifié */}
      {isEditModalOpen && editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">Modifier l'événement</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre</label>
                <input
                  type="text"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 px-4 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Durée (min)</label>
                <input
                  type="number"
                  value={editingEvent.length}
                  onChange={(e) => setEditingEvent({ ...editingEvent, length: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 px-4 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdateEvent}
                disabled={isUpdatingEvent}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg disabled:opacity-50"
              >
                {isUpdatingEvent ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
