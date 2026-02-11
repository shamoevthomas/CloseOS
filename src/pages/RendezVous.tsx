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
  Link as LinkIcon 
} from 'lucide-react'
import { useMeetings } from '../contexts/MeetingsContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { format, isValid, parseISO, isAfter, startOfDay, compareAsc, compareDesc } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '../lib/utils'
import { isDailyCoLink } from '../services/dailyService'

export function RendezVous() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { meetings, loading: meetingsLoading, refreshMeetings } = useMeetings()
  const { maskData } = usePrivacy()
  
  // --- ÉTATS CAL.COM API ---
  const [calApiKey, setCalApiKey] = useState('')
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [keySaveSuccess, setKeySaveSuccess] = useState(false)
  
  // États Gestion Event Types
  const [eventTypes, setEventTypes] = useState<any[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  
  // États Création Event Type
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDuration, setNewEventDuration] = useState(30)
  const [newEventSlug, setNewEventSlug] = useState('')
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)

  // États Webhook
  const [webhookCopied, setWebhookCopied] = useState(false)

  // États pour la gestion des meetings (Tableaux existants)
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // URL de base
  const baseUrl = window.location.origin.includes('localhost') 
    ? 'http://localhost:5173' 
    : 'https://close-os.vercel.app'
  
  // URL du Webhook
  const webhookUrl = user?.id 
    ? `${baseUrl}/api/cal-webhook?user_id=${user.id}`
    : 'Chargement...'

  // 1. Charger la Clé API au démarrage
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('cal_api_key')
        .eq('id', user.id)
        .single()
      
      if (data?.cal_api_key) {
        setCalApiKey(data.cal_api_key)
        // Si on a la clé, on charge direct les events
        fetchEventTypes(data.cal_api_key)
      }
    }
    fetchProfile()
  }, [user])

  // 2. Sauvegarder la Clé API
  const handleSaveApiKey = async () => {
    if (!user) return
    setIsSavingKey(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cal_api_key: calApiKey })
        .eq('id', user.id)

      if (error) throw error
      
      setKeySaveSuccess(true)
      setTimeout(() => setKeySaveSuccess(false), 3000)
      
      // Recharger la liste après sauvegarde
      fetchEventTypes(calApiKey)
    } catch (err) {
      console.error("Erreur sauvegarde API Key:", err)
      alert("Impossible de sauvegarder la clé API")
    } finally {
      setIsSavingKey(false)
    }
  }

  // 3. Récupérer les Event Types depuis Cal.com
  const fetchEventTypes = async (apiKey: string) => {
    setIsLoadingEvents(true)
    try {
      const response = await fetch(`https://api.cal.com/v1/event-types?apiKey=${apiKey}`)
      const data = await response.json()
      if (data.event_types) {
        setEventTypes(data.event_types)
      }
    } catch (error) {
      console.error("Erreur fetch Cal.com:", error)
    } finally {
      setIsLoadingEvents(false)
    }
  }

  // 4. Créer un Event Type
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

      // Refresh la liste
      await fetchEventTypes(calApiKey)
      
      // Reset et fermeture
      setIsCreateModalOpen(false)
      setNewEventTitle('')
      setNewEventSlug('')
      setNewEventDuration(30)
      
    } catch (error) {
      alert("Erreur lors de la création sur Cal.com")
    } finally {
      setIsCreatingEvent(false)
    }
  }

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setWebhookCopied(true)
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  // --- LOGIQUE EXISTANTE POUR LES TABLEAUX ---
  const { upcomingMeetings, pastMeetings } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const allMeetings = meetings || [];
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
    upcoming.sort((a, b) => {
      const dateA = parseISO(a.date + 'T' + (a.time.split(' - ')[0] || '00:00'))
      const dateB = parseISO(b.date + 'T' + (b.time.split(' - ')[0] || '00:00'))
      return compareAsc(dateA, dateB)
    })
    past.sort((a, b) => {
      const dateA = parseISO(a.date + 'T' + (a.time.split(' - ')[0] || '00:00'))
      const dateB = parseISO(b.date + 'T' + (b.time.split(' - ')[0] || '00:00'))
      return compareDesc(dateA, dateB)
    })
    return { upcomingMeetings: upcoming, pastMeetings: past };
  }, [meetings]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedMeeting) return;
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase.from('meetings').update({ status: newStatus }).eq('id', selectedMeeting.id);
      if (error) throw error;
      setSelectedMeeting({ ...selectedMeeting, status: newStatus });
      if (refreshMeetings) refreshMeetings(); 
    } catch (err) { alert("Erreur lors de la mise à jour du statut"); } finally { setIsUpdatingStatus(false); }
  };

  const handleDeleteAllPast = async () => {
    if (!window.confirm("Voulez-vous vraiment supprimer tout l'historique ?")) return;
    setIsDeleting(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { error } = await supabase.from('meetings').delete().eq('user_id', user?.id).lt('date', today);
      if (error) throw error;
      if (refreshMeetings) refreshMeetings();
    } catch (err) { console.error("Erreur:", err); } finally { setIsDeleting(false); }
  };

  const safeFormat = (dateStr: string, formatStr: string) => {
    if (!dateStr) return 'N/A'
    try { const date = parseISO(dateStr); if (!isValid(date)) return 'N/A'; return format(date, formatStr, { locale: fr }); } catch { return 'N/A' }
  }

  const getStatusStyle = (status: string) => {
    const s = status?.toLowerCase()
    if (['upcoming', 'confirmé', 'confirmed', 'scheduled'].includes(s)) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (['annulé', 'cancelled'].includes(s)) return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (['terminé', 'completed'].includes(s)) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }

  const getMeetingSource = (meeting: any) => {
    if (!meeting) return 'Réservation';
    try {
      if (meeting.description) { const typeMatch = meeting.description.match(/Type:\s*([^\n\r]+)/); if (typeMatch && typeMatch[1]) return typeMatch[1].trim(); }
      if (meeting.title && meeting.title.includes(' - ')) { return meeting.title.split(' - ')[0]; }
    } catch (e) { return 'Appel'; }
    return 'Appel';
  }

  // --- COMPOSANT TABLEAU (Inchangé) ---
  const MeetingTable = ({ data, title, icon: Icon, emptyText, showDeleteAction }: any) => (
    <div className="mb-12">
      <div className="mb-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-400">{data.length}</span>
        </div>
        {showDeleteAction && data.length > 0 && (
          <button onClick={handleDeleteAllPast} disabled={isDeleting} className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">
            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Tout supprimer
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr className="border-b border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-500 text-left">
              <th className="px-6 py-4">Date & Heure</th><th className="px-6 py-4">Prospect</th><th className="px-6 py-4">Provenance</th><th className="px-6 py-4">Statut</th><th className="px-6 py-4 text-right">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium italic">{emptyText}</td></tr>
            ) : (
              data.map((m: any) => (
                <tr key={m.id} onClick={() => setSelectedMeeting(m)} className="cursor-pointer hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-slate-800 border border-slate-700 font-bold">
                         <span className="text-[10px] text-blue-500 uppercase">{safeFormat(m.date, 'MMM')}</span>
                         <span className="text-sm">{safeFormat(m.date, 'dd')}</span>
                      </div>
                      <div><div className="font-bold">{safeFormat(m.date, 'eeee d MMMM')}</div><div className="text-xs text-slate-500">{m.time}</div></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-200">{maskData(m.contact || 'Prospect', 'name')}</td>
                  <td className="px-6 py-4 text-sm text-blue-400 font-medium">{getMeetingSource(m)}</td>
                  <td className="px-6 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(m.status)}`}>{m.status === 'scheduled' || m.status === 'upcoming' ? 'Confirmé' : m.status}</span></td>
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Gestion des Rendez-vous</h1>
          <p className="text-slate-400">Gérez vos liens de réservation et synchronisez votre agenda Cal.com.</p>
        </div>

        {/* --- NOUVELLE SECTION : CONFIGURATION API CAL.COM --- */}
        <div className="mb-12 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg space-y-8">
          
          {/* Étape 1 : La Clé API */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-black font-bold text-xl">C</div>
              <div>
                <h2 className="text-xl font-bold text-white">1. Clé API Cal.com</h2>
                <p className="text-sm text-slate-400 mt-1 max-w-lg">Entrez votre Clé API (disponible dans Settings {'>'} API Keys) pour gérer vos liens.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <input 
                  type="password" 
                  value={calApiKey} 
                  onChange={(e) => setCalApiKey(e.target.value)} 
                  placeholder="cal_..." 
                  className="block w-full md:w-80 rounded-lg border border-slate-700 bg-slate-950 py-2.5 px-4 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                />
                <button onClick={handleSaveApiKey} disabled={isSavingKey || !calApiKey} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-slate-200 disabled:opacity-50 transition-all">
                  {isSavingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {keySaveSuccess ? 'Sauvegardé' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>

          {/* Étape 2 : Liste des Event Types (VISIBLE UNIQUEMENT SI API KEY PRÉSENTE) */}
          {calApiKey && (
            <div className="border-t border-slate-800 pt-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 font-bold text-xl">
                    <LinkIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">2. Vos Types d'Événements</h2>
                    <p className="text-sm text-slate-400 mt-1">Vos liens de réservation actifs sur Cal.com.</p>
                  </div>
                </div>
                <button 
                   onClick={() => setIsCreateModalOpen(true)}
                   className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                >
                  <Plus className="h-4 w-4" /> Nouveau
                </button>
              </div>

              {isLoadingEvents ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {eventTypes.map(evt => (
                    <div key={evt.id} className="group relative rounded-xl border border-slate-800 bg-slate-950 p-5 hover:border-slate-700 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="inline-block rounded bg-slate-800 px-2 py-1 text-xs font-bold text-slate-400">{evt.length} min</span>
                        <a href={`https://cal.com/${user?.user_metadata?.username || 'user'}/${evt.slug}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white"><ExternalLink className="h-4 w-4"/></a>
                      </div>
                      <h3 className="font-bold text-white text-lg mb-1">{evt.title}</h3>
                      <p className="text-xs text-slate-500 font-mono">/{evt.slug}</p>
                    </div>
                  ))}
                  {eventTypes.length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                      Aucun type d'événement trouvé. Créez-en un !
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Étape 3 : Le Webhook (VISIBLE UNIQUEMENT SI API KEY PRÉSENTE) */}
          {calApiKey && (
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-t border-slate-800 pt-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 font-bold text-xl"><Webhook className="h-6 w-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-white">3. Synchronisation (Webhook)</h2>
                  <p className="text-sm text-slate-400 mt-1 max-w-lg">
                    Requis pour recevoir les réservations dans le Cockpit. <br/>
                    URL à coller dans vos Webhooks Cal.com.
                  </p>
                </div>
              </div>
              <div className="w-full md:w-auto">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2 pl-4">
                  <code className="text-xs font-mono text-purple-300 truncate max-w-[250px] md:max-w-md select-all">{webhookUrl}</code>
                  <button 
                    onClick={handleCopyWebhook} 
                    className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Copier l'URL"
                  >
                    {webhookCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- TABLEAUX (Inchangés) --- */}
        <MeetingTable data={upcomingMeetings} title="Rendez-vous à venir" icon={Calendar} emptyText="Aucun rendez-vous synchronisé." />
        <MeetingTable data={pastMeetings} title="Historique" icon={History} emptyText="Aucun historique disponible." showDeleteAction={true} />
      </div>

      {/* --- MODALE CRÉATION EVENT TYPE --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-6">Nouveau Type d'Événement</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre</label>
                <input 
                  type="text" 
                  value={newEventTitle}
                  onChange={(e) => {
                     setNewEventTitle(e.target.value)
                     // Auto-slug simple
                     setNewEventSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
                  }}
                  placeholder="Ex: Appel Découverte"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 px-4 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL / Slug</label>
                <div className="flex items-center">
                   <span className="bg-slate-800 text-slate-500 px-3 py-2.5 rounded-l-lg border border-r-0 border-slate-700 text-sm">/</span>
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
                   {[15, 30, 45, 60].map(mins => (
                      <button 
                        key={mins}
                        onClick={() => setNewEventDuration(mins)}
                        className={cn("flex-1 py-2 rounded-lg text-sm font-bold border transition-all", newEventDuration === mins ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white")}
                      >
                        {mins}
                      </button>
                   ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 rounded-lg py-3 font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">Annuler</button>
              <button onClick={handleCreateEventType} disabled={isCreatingEvent || !newEventTitle} className="flex-1 rounded-lg bg-blue-600 py-3 font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 disabled:opacity-50">
                {isCreatingEvent ? 'Création...' : 'Créer'}
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