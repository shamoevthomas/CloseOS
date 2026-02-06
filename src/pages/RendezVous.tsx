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
  Link as LinkIcon // On renomme pour éviter les confusions
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
  
  // États pour Cal.com
  const [calUsername, setCalUsername] = useState('')
  const [isSavingCal, setIsSavingCal] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)
  const [publicLinkCopied, setPublicLinkCopied] = useState(false)

  // États pour la gestion des meetings
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Construction de l'URL de base
  const baseUrl = window.location.origin.includes('localhost') 
    ? 'http://localhost:5173' 
    : 'https://close-os.vercel.app'
  
  // URL du Webhook (Pour Cal.com)
  const webhookUrl = user?.id 
    ? `${baseUrl}/api/cal-webhook?user_id=${user.id}`
    : 'Chargement...'

  // URL Publique (À envoyer aux clients)
  const publicBookingUrl = calUsername 
    ? `${baseUrl}/book/${calUsername}`
    : ''

  // 1. Charger le pseudo Cal.com au démarrage
  useEffect(() => {
    if (user?.user_metadata?.calcom_username) {
      setCalUsername(user.user_metadata.calcom_username)
    }
  }, [user])

  // 2. Sauvegarder le pseudo Cal.com
  const handleSaveCalcom = async () => {
    if (!user) return
    setIsSavingCal(true)
    setSaveSuccess(false)

    try {
      let cleanUsername = calUsername.trim()
      cleanUsername = cleanUsername.replace('https://', '').replace('http://', '').replace('cal.com/', '')
      // Enlever les slashes éventuels à la fin
      cleanUsername = cleanUsername.replace(/\/$/, "")
      
      const { error } = await supabase.auth.updateUser({
        data: { calcom_username: cleanUsername }
      })

      if (error) throw error
      
      setCalUsername(cleanUsername)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error("Erreur sauvegarde Cal.com:", err)
      alert("Impossible de sauvegarder le lien Cal.com")
    } finally {
      setIsSavingCal(false)
    }
  }

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setWebhookCopied(true)
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  const handleCopyPublicLink = () => {
    navigator.clipboard.writeText(publicBookingUrl)
    setPublicLinkCopied(true)
    setTimeout(() => setPublicLinkCopied(false), 2000)
  }

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
          <p className="text-slate-400">Connectez votre agenda pour permettre aux prospects de réserver des créneaux.</p>
        </div>

        {/* --- SECTION CONFIGURATION CAL.COM --- */}
        <div className="mb-12 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg space-y-8">
          
          {/* Étape 1 : Le Pseudo */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-black font-bold text-xl">C</div>
              <div>
                <h2 className="text-xl font-bold text-white">1. Connexion Cal.com</h2>
                <p className="text-sm text-slate-400 mt-1 max-w-lg">Renseignez votre pseudo Cal.com pour activer l'intégration.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-slate-500 text-sm">cal.com/</span></div>
                  <input type="text" value={calUsername} onChange={(e) => setCalUsername(e.target.value)} placeholder="votre-pseudo" className="block w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-16 pr-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <button onClick={handleSaveCalcom} disabled={isSavingCal || !calUsername} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-slate-200 disabled:opacity-50 transition-all">
                  {isSavingCal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saveSuccess ? 'Sauvegardé' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>

          {/* Étape 2 : Le Lien Public (VISIBLE UNIQUEMENT SI CONNECTÉ) */}
          {calUsername && (
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-t border-slate-800 pt-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 font-bold text-xl">
                  <LinkIcon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">2. Votre lien de réservation</h2>
                  <p className="text-sm text-slate-400 mt-1 max-w-lg">
                    Envoyez ce lien à vos prospects. Ils verront votre agenda intégré dans CloseOS.
                  </p>
                </div>
              </div>
              <div className="w-full md:w-auto">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2 pl-4">
                  <code className="text-sm font-mono text-blue-300 truncate max-w-[250px] md:max-w-md select-all">
                    {publicBookingUrl}
                  </code>
                  <button 
                    onClick={handleCopyPublicLink} 
                    className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Copier le lien"
                  >
                    {publicLinkCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <a 
                  href={publicBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-400 transition-colors uppercase tracking-wider font-bold"
                >
                  <ExternalLink className="h-3 w-3" /> Tester le lien
                </a>
              </div>
            </div>
          )}

          {/* Étape 3 : Le Webhook (VISIBLE UNIQUEMENT SI CONNECTÉ) */}
          {calUsername && (
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-t border-slate-800 pt-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 font-bold text-xl"><Webhook className="h-6 w-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-white">3. Synchronisation (Webhook)</h2>
                  <p className="text-sm text-slate-400 mt-1 max-w-lg">
                    Indispensable pour voir vos rendez-vous dans le Cockpit. <br/>
                    Allez dans <strong>Cal.com {'>'} Settings {'>'} Developer {'>'} Webhooks</strong> et collez cette URL.
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
                <div className="mt-2 text-[10px] text-slate-500">
                  Déclencheurs à cocher : <strong>Booking Created</strong> et <strong>Booking Rescheduled</strong>.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- TABLEAUX (Inchangés) --- */}
        <MeetingTable data={upcomingMeetings} title="Rendez-vous à venir" icon={Calendar} emptyText="Aucun rendez-vous synchronisé." />
        <MeetingTable data={pastMeetings} title="Historique" icon={History} emptyText="Aucun historique disponible." showDeleteAction={true} />
      </div>

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