import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  RefreshCw
} from 'lucide-react'
import { useMeetings } from '../contexts/MeetingsContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { format, isValid, parseISO, isAfter, startOfDay, compareAsc, compareDesc, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '../lib/utils'
import { isDailyCoLink } from '../services/dailyService'

// Types pour l'édition
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
  const { meetings, loading: meetingsLoading, refreshMeetings } = useMeetings()
  const { maskData } = usePrivacy()
  
  // --- ÉTATS CAL.COM API ---
  const [calApiKey, setCalApiKey] = useState('')
  const [calUsername, setCalUsername] = useState('')
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [keySaveSuccess, setKeySaveSuccess] = useState(false)
  
  // États Gestion Event Types
  const [eventTypes, setEventTypes] = useState<any[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [isDeletingEvent, setIsDeletingEvent] = useState<number | null>(null)
  
  // États Modales
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // États pour Création
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDuration, setNewEventDuration] = useState(30)
  const [newEventSlug, setNewEventSlug] = useState('')
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)

  // États pour Édition
  const [editingEvent, setEditingEvent] = useState<EventTypeData | null>(null)
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false)
  const [noticeUnit, setNoticeUnit] = useState<'minutes' | 'hours'>('minutes')

  // États Webhook & Sync
  const [webhookCopied, setWebhookCopied] = useState(false)
  const [linkCopiedId, setLinkCopiedId] = useState<number | null>(null)
  const [calBookings, setCalBookings] = useState<any[]>([])
  const [isSyncing, setIsSyncing] = useState(false) 

  // États pour la gestion des meetings (Tableaux)
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // URL de base
  const baseUrl = window.location.origin.includes('localhost') 
    ? 'http://localhost:5173' 
    : 'https://close-os.vercel.app'
  
  const webhookUrl = user?.id 
    ? `${baseUrl}/api/cal-webhook?user_id=${user.id}`
    : 'Chargement...'

  // 1. Chargement initial
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('cal_api_key').eq('id', user.id).single()
      if (data?.cal_api_key) {
        setCalApiKey(data.cal_api_key)
        fetchEventTypes(data.cal_api_key)
        fetchCalProfile(data.cal_api_key)
        fetchCalBookings(data.cal_api_key, false) // Chargement silencieux au démarrage
      }
    }
    fetchProfile()
  }, [user])

  // --- FONCTION DE SYNCHRONISATION PUISSANTE ---
  const runDeepSync = async (bookings: any[]) => {
    if (!meetings || meetings.length === 0 || !bookings || bookings.length === 0) return 0;

    // Normalisation agressive (minuscule, sans accents, sans caractères spéciaux)
    const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '') : '';
    let updatesCount = 0;

    console.log("🔄 Démarrage Deep Sync...");

    for (const m of meetings) {
        // Ignorer si déjà annulé
        if (['annule', 'cancelled', 'rejected', 'termine'].includes(normalize(m.status || ''))) continue;

        const dbDate = parseISO(m.date);
        const dbContact = normalize(m.contact || '');
        
        // Chercher le booking correspondant
        const calData = bookings.find((b: any) => {
            const apiDate = parseISO(b.startTime);
            const dayDiff = Math.abs(differenceInDays(dbDate, apiDate));
            
            // 1. Date doit être proche (+/- 1 jour)
            if (dayDiff > 1) return false;

            // 2. Matching de nom/email
            const attendees = b.attendees || [];
            const title = normalize(b.title || '');
            const description = normalize(b.description || '');

            const isAttendeeMatch = attendees.some((att: any) => {
                const apiName = normalize(att.name || '');
                const apiEmail = normalize(att.email || '');
                return (dbContact && (apiName.includes(dbContact) || dbContact.includes(apiName))) ||
                       (m.description && apiEmail && normalize(m.description).includes(apiEmail));
            });

            const isTitleMatch = dbContact && title.includes(dbContact);
            const isDescMatch = dbContact && description.includes(dbContact);

            return isAttendeeMatch || isTitleMatch || isDescMatch;
        });

        // Si match trouvé ET statut Annulé/Rejeté
        if (calData && ['CANCELLED', 'REJECTED'].includes(calData.status)) {
            console.log(`❌ Rendez-vous annulé détecté pour ${m.contact}. Mise à jour BDD...`);
            
            // Mise à jour BDD
            const { error } = await supabase.from('meetings').update({ status: 'Annulé' }).eq('id', m.id);
            
            if (!error) {
                updatesCount++;
            } else {
                console.error("Erreur update Supabase:", error);
            }
        }
    }

    if (updatesCount > 0) {
        if (refreshMeetings) await refreshMeetings();
        console.log(`✅ ${updatesCount} statuts mis à jour.`);
    } else {
        console.log("Aucune mise à jour nécessaire.");
    }
    
    return updatesCount;
  };

  // 2. Sauvegarder Clé API
  const handleSaveApiKey = async () => {
    if (!user) return
    setIsSavingKey(true)
    try {
      const { error } = await supabase.from('profiles').update({ cal_api_key: calApiKey }).eq('id', user.id)
      if (error) throw error
      setKeySaveSuccess(true)
      setTimeout(() => setKeySaveSuccess(false), 3000)
      fetchEventTypes(calApiKey)
      fetchCalProfile(calApiKey)
      fetchCalBookings(calApiKey, true)
    } catch (err) { alert("Impossible de sauvegarder la clé API") } finally { setIsSavingKey(false) }
  }

  // 3. Fetch Events
  const fetchEventTypes = async (apiKey: string) => {
    setIsLoadingEvents(true)
    try {
      const response = await fetch(`https://api.cal.com/v1/event-types?apiKey=${apiKey}`)
      const data = await response.json()
      if (data.event_types) setEventTypes(data.event_types)
    } catch (error) { console.error("Erreur fetch Cal.com:", error) } finally { setIsLoadingEvents(false) }
  }

  // 3b. Fetch Profile
  const fetchCalProfile = async (apiKey: string) => {
    try {
      const response = await fetch(`https://api.cal.com/v1/me?apiKey=${apiKey}`)
      const data = await response.json()
      if (data.user?.username) setCalUsername(data.user.username)
      else if (data.username) setCalUsername(data.username)
    } catch (error) { console.error(error) }
  }

  // 3c. Fetch Bookings & Trigger Sync
  const fetchCalBookings = async (apiKey: string, manualTrigger: boolean = false) => {
    if (!apiKey) return;
    if (manualTrigger) setIsSyncing(true);
    
    try {
        // 👇 MODIFICATION ICI : Utilisation du proxy local pour éviter CORS
        const response = await fetch(`/api/cal-bookings?apiKey=${apiKey}`)
        
        if (!response.ok) throw new Error("Erreur Proxy");

        const data = await response.json()
        if (data.bookings) {
            setCalBookings(data.bookings);
            // Lancer la synchro DB immédiatement après récupération
            const count = await runDeepSync(data.bookings);
            if (manualTrigger) {
                alert(`Synchronisation terminée : ${count} rendez-vous mis à jour.`);
            }
        }
    } catch (error) {
        console.error("Erreur fetch Bookings Cal.com:", error);
        if (manualTrigger) alert("Erreur lors de la synchronisation (Vérifiez la clé API ou l'accès internet).");
    } finally {
        if (manualTrigger) setIsSyncing(false);
    }
  }

  // 4. Suppression Event Type
  const handleDeleteEventType = async (id: number) => {
    if (!window.confirm("Voulez-vous supprimer ce lien définitivement (CloseOS + Cal.com) ?")) return
    setIsDeletingEvent(id)
    try {
        const response = await fetch(`https://api.cal.com/v1/event-types/${id}?apiKey=${calApiKey}`, { method: 'DELETE' })
        if (!response.ok) throw new Error("Erreur suppression")
        await fetchEventTypes(calApiKey)
    } catch (error) { alert("Erreur suppression Cal.com"); console.error(error) } finally { setIsDeletingEvent(null) }
  }

  // 5. Créer Event
  const handleCreateEventType = async () => {
    if (!newEventTitle || !newEventSlug) return
    setIsCreatingEvent(true)
    try {
      const payload = {
        title: newEventTitle,
        slug: newEventSlug,
        length: parseInt(String(newEventDuration)),
        isHidden: false
      }
      const response = await fetch(`https://api.cal.com/v1/event-types?apiKey=${calApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error('Erreur création')
      await fetchEventTypes(calApiKey)
      setIsCreateModalOpen(false)
      setNewEventTitle(''); setNewEventSlug(''); setNewEventDuration(30)
    } catch (error) { alert("Erreur lors de la création") } finally { setIsCreatingEvent(false) }
  }

  // 6. Ouvrir Modale Édition
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

  // 7. Sauvegarder Édition
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

        const response = await fetch(`https://api.cal.com/v1/event-types/${editingEvent.id}?apiKey=${calApiKey}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        if (!response.ok) throw new Error('Erreur mise à jour')
        await fetchEventTypes(calApiKey)
        setIsEditModalOpen(false)
    } catch (error) { alert("Erreur maj"); console.error(error) } finally { setIsUpdatingEvent(false) }
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

  // --- LOGIQUE TABLEAUX (Affichage) ---
  const { upcomingMeetings, pastMeetings } = useMemo(() => {
    const now = new Date(); 
    const today = startOfDay(now);
    
    // Normalisation agressive pour l'affichage temps réel
    const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '') : '';

    const allMeetings = (meetings || []).map(m => {
        // Overlay Statut API (si trouvé en RAM avant le refresh DB)
        const calData = calBookings.find((b: any) => {
             const dbDate = parseISO(m.date);
             const apiDate = parseISO(b.startTime);
             if (Math.abs(differenceInDays(dbDate, apiDate)) > 1) return false;

             const dbContact = normalize(m.contact || '');
             const attendees = b.attendees || [];
             const title = normalize(b.title || '');
             
             return attendees.some((att: any) => {
                 const apiName = normalize(att.name || '');
                 return (dbContact && (apiName.includes(dbContact) || dbContact.includes(apiName)));
             }) || (dbContact && title.includes(dbContact));
        });

        if (calData && ['CANCELLED', 'REJECTED'].includes(calData.status)) {
            return { ...m, status: 'Annulé' }; 
        }
        return m;
    });

    const upcoming = []; 
    const past = [];
    
    for (const m of allMeetings) {
      const meetingDate = parseISO(m.date);
      if (isAfter(meetingDate, today) || m.date === format(now, 'yyyy-MM-dd')) { 
          upcoming.push(m); 
      } else { 
          past.push(m); 
      }
    }
    
    upcoming.sort((a, b) => compareAsc(parseISO(a.date + 'T' + a.time.split(' - ')[0]), parseISO(b.date + 'T' + b.time.split(' - ')[0])))
    past.sort((a, b) => compareDesc(parseISO(a.date + 'T' + a.time.split(' - ')[0]), parseISO(b.date + 'T' + b.time.split(' - ')[0])))
    
    return { upcomingMeetings: upcoming, pastMeetings: past };
  }, [meetings, calBookings]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedMeeting) return; setIsUpdatingStatus(true);
    try { await supabase.from('meetings').update({ status: newStatus }).eq('id', selectedMeeting.id); setSelectedMeeting({ ...selectedMeeting, status: newStatus }); if (refreshMeetings) refreshMeetings(); } catch (err) { alert("Erreur maj statut"); } finally { setIsUpdatingStatus(false); }
  };

  const handleDeleteAllPast = async () => {
    if (!window.confirm("Tout supprimer ?")) return; setIsDeleting(true);
    try { await supabase.from('meetings').delete().eq('user_id', user?.id).lt('date', format(new Date(), 'yyyy-MM-dd')); if (refreshMeetings) refreshMeetings(); } catch (err) { console.error(err); } finally { setIsDeleting(false); }
  };

  const safeFormat = (dateStr: string, formatStr: string) => { try { const date = parseISO(dateStr); return isValid(date) ? format(date, formatStr, { locale: fr }) : 'N/A'; } catch { return 'N/A' } }
  
  const getStatusStyle = (s: string) => { 
      s = s?.toLowerCase() || ''; 
      if (['upcoming', 'confirmé', 'confirmed', 'scheduled', 'accepted'].includes(s)) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'; 
      if (['annulé', 'cancelled', 'rejected', 'canceled', 'annule'].includes(s)) return 'bg-red-500/20 text-red-400 border-red-500/30'; 
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30'; 
  }
  
  const getStatusLabel = (s: string) => {
      s = s?.toLowerCase() || '';
      if (['upcoming', 'confirmé', 'confirmed', 'scheduled', 'accepted'].includes(s)) return 'Confirmé';
      if (['annulé', 'cancelled', 'canceled', 'annule'].includes(s)) return 'Annulé';
      if (['rejected'].includes(s)) return 'Refusé';
      return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const getMeetingSource = (m: any) => { if (!m) return 'Réservation'; if (m.description?.match(/Type:\s*([^\n\r]+)/)) return m.description.match(/Type:\s*([^\n\r]+)/)[1].trim(); return 'Appel'; }

  // --- RENDU ---
  const MeetingTable = ({ data, title, icon: Icon, emptyText, showDeleteAction, onRefresh }: any) => (
    <div className="mb-12">
      <div className="mb-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-400">{data.length}</span>
            {/* BOUTON SYNC MANUEL */}
            {onRefresh && (
                <button 
                    onClick={onRefresh} 
                    className={`ml-2 p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors ${isSyncing ? 'animate-spin text-blue-500' : ''}`}
                    title="Forcer la synchronisation (MàJ Statuts)"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            )}
        </div>
        {showDeleteAction && data.length > 0 && (<button onClick={handleDeleteAllPast} disabled={isDeleting} className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">{isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Tout supprimer</button>)}
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
        <table className="w-full">
          <thead className="bg-slate-800/50"><tr className="border-b border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-500 text-left"><th className="px-6 py-4">Date & Heure</th><th className="px-6 py-4">Prospect</th><th className="px-6 py-4">Provenance</th><th className="px-6 py-4">Statut</th><th className="px-6 py-4 text-right">Détails</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {data.length === 0 ? (<tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium italic">{emptyText}</td></tr>) : (
              data.map((m: any) => (
                <tr key={m.id} onClick={() => setSelectedMeeting(m)} className="cursor-pointer hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4"><div className="flex items-center gap-3 text-white"><div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-slate-800 border border-slate-700 font-bold"><span className="text-[10px] text-blue-500 uppercase">{safeFormat(m.date, 'MMM')}</span><span className="text-sm">{safeFormat(m.date, 'dd')}</span></div><div><div className="font-bold">{safeFormat(m.date, 'eeee d MMMM')}</div><div className="text-xs text-slate-500">{m.time}</div></div></div></td>
                  <td className="px-6 py-4 font-bold text-slate-200"><MaskedText value={m.contact || 'Prospect'} type="name" /></td>
                  <td className="px-6 py-4 text-sm text-blue-400 font-medium">{getMeetingSource(m)}</td>
                  <td className="px-6 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(m.status)}`}>{getStatusLabel(m.status)}</span></td>
                  <td className="px-6 py-4 text-right"><ExternalLink className="h-4 w-4 text-slate-600 ml-auto" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  if (meetingsLoading) return <div className="flex h-screen items-center justify-center bg-slate-950"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div></div>

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-8 text-left">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Rendez-vous</h1>
            <p className="text-slate-400">Consultez vos rendez-vous et gérez votre agenda.</p>
          </div>
          {/* BOUTON D'OUVERTURE DE LA CONFIGURATION */}
          <button 
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 transition-all shadow-lg hover:shadow-slate-700/20"
          >
            <Settings className="h-4 w-4" /> Configurer les Booking
          </button>
        </div>

        {/* --- SECTION 2: TYPES D'EVENEMENTS --- */}
        {calApiKey && (
            <div className="mb-12">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 font-bold text-xl"><LinkIcon className="h-6 w-6" /></div>
                        <div><h2 className="text-xl font-bold text-white">Vos Liens de Réservation</h2><p className="text-sm text-slate-400 mt-1">Vos types d'événements actifs sur Cal.com.</p></div>
                    </div>
                    <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"><Plus className="h-4 w-4" /> Nouveau</button>
                </div>
                
                {isLoadingEvents ? (<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {eventTypes.map(evt => (
                        <div key={evt.id} className="group relative rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-all flex flex-col justify-between hover:shadow-lg hover:shadow-black/20">
                        <div>
                            <div className="flex justify-between items-start mb-3">
                            <span className="inline-block rounded bg-slate-800 px-2 py-1 text-xs font-bold text-slate-400">{evt.length} min</span>
                            <div className="flex gap-2">
                                {/* BOUTON SUPPRIMER LE LIEN (POUBELLE) */}
                                <button 
                                    onClick={() => handleDeleteEventType(evt.id)} 
                                    disabled={isDeletingEvent === evt.id}
                                    className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors"
                                    title="Supprimer ce lien"
                                >
                                    {isDeletingEvent === evt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4"/>}
                                </button>
                                {/* BOUTON OUVRIR */}
                                <a href={`https://cal.com/${calUsername || 'user'}/${evt.slug}`} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white" title="Ouvrir le lien"><ExternalLink className="h-4 w-4"/></a>
                            </div>
                            </div>
                            <h3 className="font-bold text-white text-lg mb-1">{evt.title}</h3>
                            <p className="text-xs text-slate-500 font-mono mb-4">/{evt.slug}</p>
                        </div>
                        
                        <div className="flex gap-2 mt-auto border-t border-slate-800 pt-3">
                            <button 
                                onClick={() => handleCopyLink(evt.slug, evt.id)} 
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                                {linkCopiedId === evt.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />} Copier
                            </button>
                            <button 
                                onClick={() => handleOpenEdit(evt)}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600/10 py-2 text-xs font-bold text-blue-400 hover:bg-blue-600/20 transition-colors"
                            >
                                <Edit2 className="h-3 w-3" /> Modifier
                            </button>
                            <a 
                                href={`https://app.cal.com/event-types/${evt.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-center rounded-lg bg-slate-800 px-3 text-slate-400 hover:text-white hover:bg-slate-700"
                                title="Paramètres avancés sur Cal.com"
                            >
                                <Settings className="h-4 w-4" />
                            </a>
                        </div>
                        </div>
                    ))}
                    {eventTypes.length === 0 && (<div className="col-span-full text-center py-12 text-slate-500 italic border border-dashed border-slate-800 rounded-xl bg-slate-900/50">Aucun événement trouvé. Créez-en un !</div>)}
                    </div>
                )}
            </div>
        )}

        {/* --- CONTENU PRINCIPAL : LES TABLEAUX --- */}
        <MeetingTable 
            data={upcomingMeetings} 
            title="Rendez-vous à venir" 
            icon={Calendar} 
            emptyText="Aucun rendez-vous synchronisé." 
            onRefresh={() => fetchCalBookings(calApiKey, true)} // 👈 MODE MANUEL
        />
        <MeetingTable data={pastMeetings} title="Historique" icon={History} emptyText="Aucun historique disponible." showDeleteAction={true} />
      </div>

      {/* --- GRANDE MODALE DE CONFIGURATION --- */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsConfigModalOpen(false)} />
            <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 overflow-hidden">
                
                {/* Header Modale */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            {/* LOGO PERSONNALISÉ AVEC FOND BLANC */}
                            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center p-1 overflow-hidden">
                                <img src="/Calcom.png" alt="Cal.com" className="w-full h-full object-contain" />
                            </div>
                            Configuration Cal.com
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Paramètres de connexion et synchronisation.</p>
                    </div>
                    <button onClick={() => setIsConfigModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Corps Modale */}
                <div className="p-8 space-y-8 bg-slate-950/50">
                    
                    {/* 1. Clé API */}
                    <section>
                         <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">1. Clé API</h3>
                         <div className="flex flex-col gap-2">
                             <input type="password" value={calApiKey} onChange={(e) => setCalApiKey(e.target.value)} placeholder="cal_..." className="block w-full rounded-lg border border-slate-700 bg-slate-900 py-3 px-4 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                             <button onClick={handleSaveApiKey} disabled={isSavingKey || !calApiKey} className="w-full flex justify-center items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-slate-200 disabled:opacity-50 transition-all">{isSavingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {keySaveSuccess ? 'Sauvegardé' : 'Enregistrer la clé'}</button>
                             <p className="text-xs text-slate-500 mt-1">Nécessaire pour lire et modifier vos liens de réservation.</p>
                         </div>
                    </section>

                    <hr className="border-slate-800" />

                    {/* 2. Webhook */}
                    {calApiKey && (
                        <section>
                             <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">2. Synchronisation (Webhook)</h3>
                             <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2 pl-4">
                                <code className="text-xs font-mono text-purple-300 truncate flex-1 select-all">{webhookUrl}</code>
                                <button onClick={handleCopyWebhook} className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Copier l'URL">{webhookCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</button>
                             </div>
                             <p className="text-xs text-slate-500 mt-2">Ajoutez cette URL dans vos Webhooks Cal.com pour recevoir les réservations.</p>
                        </section>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- MODALE CRÉATION (Z-50) --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-6">Nouveau Type d'Événement</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre</label><input type="text" value={newEventTitle} onChange={(e) => { setNewEventTitle(e.target.value); setNewEventSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')) }} className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 px-4 text-white focus:outline-none focus:border-blue-500" placeholder="Ex: Appel Découverte" /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL / Slug</label><div className="flex items-center"><span className="bg-slate-800 text-slate-500 px-3 py-2.5 rounded-l-lg border border-r-0 border-slate-700 text-sm">/</span><input type="text" value={newEventSlug} onChange={(e) => setNewEventSlug(e.target.value)} className="w-full rounded-r-lg border border-slate-700 bg-slate-950 py-2.5 px-4 text-white focus:outline-none focus:border-blue-500" /></div></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Durée (minutes)</label><div className="flex gap-2">{[15, 30, 45, 60].map(mins => (<button key={mins} onClick={() => setNewEventDuration(mins)} className={cn("flex-1 py-2 rounded-lg text-sm font-bold border transition-all", newEventDuration === mins ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white")}>{mins}</button>))}</div></div>
            </div>
            <div className="mt-8 flex gap-3"><button onClick={() => setIsCreateModalOpen(false)} className="flex-1 rounded-lg py-3 font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">Annuler</button><button onClick={handleCreateEventType} disabled={isCreatingEvent || !newEventTitle} className="flex-1 rounded-lg bg-blue-600 py-3 font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 disabled:opacity-50">{isCreatingEvent ? 'Création...' : 'Créer'}</button></div>
          </div>
        </div>
      )}

      {/* --- MODALE ÉDITION COMPLÈTE (Z-50) --- */}
      {isEditModalOpen && editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl animate-in fade-in zoom-in-95 custom-scrollbar">
            
            <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
               <div>
                 <h3 className="text-2xl font-bold text-white">Modifier l'événement</h3>
                 <p className="text-slate-400 text-sm">Configurez les détails et les disponibilités.</p>
               </div>
               <button onClick={() => setIsEditModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <div className="space-y-8">
               {/* 1. INFO DE BASE */}
               <section className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2"><Edit2 className="h-4 w-4"/> Informations Générales</h4>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Titre</label>
                        <input type="text" value={editingEvent.title} onChange={(e) => setEditingEvent({...editingEvent, title: e.target.value})} className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white focus:border-blue-500 outline-none" />
                     </div>
                     <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Durée (min)</label>
                        <input type="number" value={editingEvent.length} onChange={(e) => setEditingEvent({...editingEvent, length: parseInt(e.target.value)})} className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white focus:border-blue-500 outline-none" />
                     </div>
                     <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                        <textarea rows={3} value={editingEvent.description} onChange={(e) => setEditingEvent({...editingEvent, description: e.target.value})} className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white focus:border-blue-500 outline-none resize-none" />
                     </div>
                     
                     <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Lieu / Location</label>
                        <div className="space-y-3">
                           <div className="p-3 rounded-lg border border-slate-700 bg-slate-950 text-slate-400 text-xs flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <select 
                                className="bg-transparent outline-none w-full text-white cursor-pointer"
                                onChange={(e) => {
                                   const newType = e.target.value
                                   const currentLoc = editingEvent.locations[0] || {}
                                   setEditingEvent({
                                      ...editingEvent, 
                                      locations: [{ ...currentLoc, type: newType }]
                                   })
                                }}
                                value={editingEvent.locations[0]?.type || 'integrations:daily'}
                              >
                                 <optgroup label="Visio">
                                    <option value="integrations:daily">Cal Video (Par défaut)</option>
                                    <option value="integrations:google:meet">Google Meet</option>
                                    <option value="integrations:zoom:video">Zoom Video</option>
                                    <option value="integrations:discord">Discord</option>
                                 </optgroup>
                                 <optgroup label="Téléphone">
                                    <option value="attendee_phone">Numéro de téléphone du participant</option>
                                    <option value="phone">Appel téléphonique (Organisateur appelle)</option>
                                 </optgroup>
                                 <optgroup label="Physique">
                                    <option value="attendee_in_person">En personne (adresse du participant)</option>
                                    <option value="in_person">En personne (adresse de l'organisateur)</option>
                                 </optgroup>
                                 <optgroup label="Autre">
                                    <option value="link">Lien personnalisé / Autre</option>
                                 </optgroup>
                              </select>
                           </div>

                           {editingEvent.locations[0]?.type === 'in_person' && (
                              <div className="animate-in fade-in slide-in-from-top-2">
                                 <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Adresse exacte du RDV</label>
                                 <input 
                                    type="text" 
                                    placeholder="Ex: 12 Rue de la Paix, Paris"
                                    value={editingEvent.locations[0].address || ''} 
                                    onChange={(e) => {
                                       const newLocs = [...editingEvent.locations]
                                       newLocs[0] = { ...newLocs[0], address: e.target.value }
                                       setEditingEvent({...editingEvent, locations: newLocs})
                                    }}
                                    className="w-full rounded-lg bg-slate-950 border border-blue-500/50 py-2 px-4 text-white text-sm focus:border-blue-500 outline-none" 
                                 />
                              </div>
                           )}

                           {editingEvent.locations[0]?.type === 'link' && (
                              <div className="animate-in fade-in slide-in-from-top-2">
                                 <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">URL du lien</label>
                                 <input 
                                    type="text" 
                                    placeholder="https://..."
                                    value={editingEvent.locations[0].link || ''} 
                                    onChange={(e) => {
                                       const newLocs = [...editingEvent.locations]
                                       newLocs[0] = { ...newLocs[0], link: e.target.value }
                                       setEditingEvent({...editingEvent, locations: newLocs})
                                    }}
                                    className="w-full rounded-lg bg-slate-950 border border-blue-500/50 py-2 px-4 text-white text-sm focus:border-blue-500 outline-none" 
                                 />
                              </div>
                           )}
                           
                           {editingEvent.locations[0]?.type === 'phone' && (
                              <div className="animate-in fade-in slide-in-from-top-2">
                                 <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Numéro à appeler</label>
                                 <input 
                                    type="text" 
                                    placeholder="+33 6..."
                                    value={editingEvent.locations[0].phone || ''} 
                                    onChange={(e) => {
                                       const newLocs = [...editingEvent.locations]
                                       newLocs[0] = { ...newLocs[0], phone: e.target.value }
                                       setEditingEvent({...editingEvent, locations: newLocs})
                                    }}
                                    className="w-full rounded-lg bg-slate-950 border border-blue-500/50 py-2 px-4 text-white text-sm focus:border-blue-500 outline-none" 
                                 />
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               </section>

               <hr className="border-slate-800" />

               {/* 2. PARAMÈTRES AVANCÉS */}
               <section className="space-y-4">
                  <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2"><Clock className="h-4 w-4"/> Disponibilités & Limites</h4>
                  <div className="grid grid-cols-2 gap-6">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Marge avant l'événement (min)</label>
                        <select 
                           value={editingEvent.beforeEventBuffer} 
                           onChange={(e) => setEditingEvent({...editingEvent, beforeEventBuffer: parseInt(e.target.value)})} 
                           className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white outline-none cursor-pointer"
                        >
                           <option value={0}>Aucune</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1h</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Marge après l'événement (min)</label>
                        <select 
                           value={editingEvent.afterEventBuffer} 
                           onChange={(e) => setEditingEvent({...editingEvent, afterEventBuffer: parseInt(e.target.value)})} 
                           className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white outline-none cursor-pointer"
                        >
                           <option value={0}>Aucune</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1h</option>
                        </select>
                     </div>
                     
                     <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Préavis minimum</label>
                        <div className="flex">
                           <input 
                              type="number" 
                              value={editingEvent.minimumBookingNotice} 
                              onChange={(e) => setEditingEvent({...editingEvent, minimumBookingNotice: parseInt(e.target.value)})} 
                              className="w-20 rounded-l-lg bg-slate-950 border border-r-0 border-slate-700 py-2 px-4 text-white outline-none" 
                           />
                           <select 
                              value={noticeUnit}
                              onChange={(e) => setNoticeUnit(e.target.value as 'minutes' | 'hours')}
                              className="flex-1 rounded-r-lg bg-slate-950 border border-slate-700 py-2 px-2 text-white outline-none cursor-pointer"
                           >
                              <option value="minutes">Minutes</option>
                              <option value="hours">Heures</option>
                           </select>
                        </div>
                     </div>

                     <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Fréquence des créneaux</label>
                        <select 
                           value={editingEvent.slotInterval || 'default'} 
                           onChange={(e) => setEditingEvent({...editingEvent, slotInterval: e.target.value === 'default' ? null : parseInt(e.target.value)})} 
                           className="w-full rounded-lg bg-slate-950 border border-slate-700 py-2 px-4 text-white outline-none cursor-pointer"
                        >
                           <option value="default">Par défaut (Durée)</option>
                           <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                        </select>
                     </div>
                  </div>
               </section>

               <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                     <p className="text-sm text-slate-300 font-medium">Besoin de plus de réglages ?</p>
                     <p className="text-xs text-slate-500 mt-1">Pour les règles avancées (questions, paiements, workflows), utilisez l'interface native.</p>
                     <a href={`https://app.cal.com/event-types/${editingEvent.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 mt-2 hover:underline">
                        Ouvrir les paramètres avancés <ExternalLink className="h-3 w-3" />
                     </a>
                  </div>
               </div>

            </div>

            <div className="mt-8 flex gap-4 border-t border-slate-800 pt-6">
                <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Annuler</button>
                <button onClick={handleUpdateEvent} disabled={isUpdatingEvent} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
                    {isUpdatingEvent ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} Enregistrer
                </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Détails (Inchangé) */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Détails de l'appel</h2>
              <button onClick={() => setSelectedMeeting(null)} className="rounded-full p-2 hover:bg-slate-800 text-slate-400"><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-xl font-bold text-white">{selectedMeeting.contact?.charAt(0)}</div>
                    <div>
                      <p className="text-lg font-bold text-white">{maskData(selectedMeeting.contact, 'name')}</p>
                      <p className="text-sm text-slate-500">{getMeetingSource(selectedMeeting)}</p>
                    </div>
                 </div>
                 <div className="relative">
                    <select disabled={isUpdatingStatus} value={selectedMeeting.status} onChange={(e) => handleUpdateStatus(e.target.value)} className={cn("appearance-none pl-4 pr-10 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer transition-all", getStatusStyle(selectedMeeting.status))}>
                      <option value="Confirmé">Confirmé</option><option value="Terminé">Terminé</option><option value="Annulé">Annulé</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none opacity-50" />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Mail size={10} /> Email</p><p className="text-white font-bold truncate">{maskData(selectedMeeting.description?.match(/Email:\s*([^\n\r]*)/)?.[1] || 'Non renseigné', 'email')}</p></div>
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Phone size={10} /> Téléphone</p><p className="text-white font-bold">{maskData(selectedMeeting.description?.match(/Téléphone:\s*([^\n\r]*)/)?.[1] || 'Non renseigné', 'phone')}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Calendar size={10} /> Date</p><p className="text-white font-bold">{safeFormat(selectedMeeting.date, 'dd MMMM yyyy')}</p></div>
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Clock size={10} /> Heure</p><p className="text-white font-bold">{selectedMeeting.time}</p></div>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3">
               {selectedMeeting.location && (<button onClick={() => { const locationUrl = selectedMeeting.location; if (isDailyCoLink(locationUrl)) { const url = `/live-call?url=${encodeURIComponent(locationUrl)}&from=/rendez-vous`; navigate(url); } else { window.open(locationUrl, '_blank', 'noopener,noreferrer'); } }} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"><Video className="h-5 w-5" /> Rejoindre l'appel</button>)}
               <button onClick={() => setSelectedMeeting(null)} className="w-full rounded-2xl border border-slate-800 bg-slate-800/50 py-4 font-bold text-slate-300 hover:bg-slate-800">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}