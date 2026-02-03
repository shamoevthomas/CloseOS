import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, Copy, Check, Calendar, Clock, ExternalLink, X, Video, Phone, Settings, Loader2, History, Trash2, ChevronDown, Mail, Plus, Edit2 } from 'lucide-react'
import { useMeetings } from '../contexts/MeetingsContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { format, isValid, parseISO, isAfter, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '../lib/utils'
import { isDailyCoLink } from '../services/dailyService'

export function RendezVous() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { meetings, loading: meetingsLoading, refreshMeetings } = useMeetings()
  const { isPrivacyEnabled, maskData } = usePrivacy()
  
  // États pour les liens multiples
  const [bookingTypes, setBookingTypes] = useState<any[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  // États pour la gestion des meetings
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // 1. Récupération des TYPES de rendez-vous (Multi-liens)
  useEffect(() => {
    async function fetchBookingTypes() {
      if (!user?.id) return
      try {
        const { data } = await supabase
          .from('booking_types')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
        
        if (data) {
          setBookingTypes(data)
        }
      } catch (err) {
        console.error("Erreur chargement types:", err)
      } finally {
        setTypesLoading(false)
      }
    }
    fetchBookingTypes()
  }, [user?.id])

  // 2. Séparation des rendez-vous (À venir vs Passés)
  const { upcomingMeetings, pastMeetings } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    return (meetings || []).reduce(
      (acc: any, m: any) => {
        const meetingDate = parseISO(m.date);
        if (isAfter(meetingDate, today) || m.date === format(now, 'yyyy-MM-dd')) {
          acc.upcomingMeetings.push(m);
        } else {
          acc.pastMeetings.push(m);
        }
        return acc;
      },
      { upcomingMeetings: [], pastMeetings: [] }
    );
  }, [meetings]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedMeeting) return;
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ status: newStatus })
        .eq('id', selectedMeeting.id);

      if (error) throw error;
      
      setSelectedMeeting({ ...selectedMeeting, status: newStatus });
      if (refreshMeetings) refreshMeetings(); 
    } catch (err) {
      alert("Erreur lors de la mise à jour du statut");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteAllPast = async () => {
    if (!window.confirm("Voulez-vous vraiment supprimer tout l'historique des rendez-vous passés ?")) return;
    
    setIsDeleting(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('user_id', user?.id)
        .lt('date', today);

      if (error) throw error;
      if (refreshMeetings) refreshMeetings();
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      alert("Une erreur est survenue lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    const link = `${window.location.origin}/book/${slug}`
    navigator.clipboard.writeText(link)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const safeFormat = (dateStr: string, formatStr: string) => {
    if (!dateStr) return 'N/A'
    try {
      const date = parseISO(dateStr)
      if (!isValid(date)) return 'N/A'
      return format(date, formatStr, { locale: fr })
    } catch {
      return 'N/A'
    }
  }

  const getStatusStyle = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'upcoming' || s === 'confirmé' || s === 'confirmed' || s === 'scheduled') 
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (s === 'annulé' || s === 'cancelled')
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (s === 'terminé' || s === 'completed')
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }

  // --- CORRECTION : FONCTION SÉCURISÉE ---
  const getMeetingSource = (meeting: any) => {
    if (!meeting) return 'Réservation';

    try {
      // 1. Essayer de trouver "Type: Titre" dans la description
      if (meeting.description) {
        const typeMatch = meeting.description.match(/Type:\s*([^\n\r]+)/);
        if (typeMatch && typeMatch[1]) return typeMatch[1].trim();
      }

      // 2. Fallback : Parser le titre si format "Titre - Client"
      if (meeting.title && meeting.title.includes(' - ')) {
        return meeting.title.split(' - ')[0];
      }
    } catch (e) {
      // En cas d'erreur de parsing, ne rien casser
      return 'Appel';
    }

    // 3. Fallback final
    return 'Appel';
  }

  const MeetingTable = ({ data, title, icon: Icon, emptyText, showDeleteAction }: { data: any[], title: string, icon: any, emptyText: string, showDeleteAction?: boolean }) => (
    <div className="mb-12">
      <div className="mb-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-400">
            {data.length}
          </span>
        </div>
        
        {showDeleteAction && data.length > 0 && (
          <button
            onClick={handleDeleteAllPast}
            disabled={isDeleting}
            className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Tout supprimer
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr className="border-b border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-500 text-left">
              <th className="px-6 py-4">Date & Heure</th>
              <th className="px-6 py-4">Prospect</th>
              <th className="px-6 py-4">Provenance</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4 text-right">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium italic">
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((m: any) => (
                <tr key={m.id} onClick={() => setSelectedMeeting(m)} className="cursor-pointer hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-slate-800 border border-slate-700 font-bold">
                         <span className="text-[10px] text-blue-500 uppercase">{safeFormat(m.date, 'MMM')}</span>
                         <span className="text-sm">{safeFormat(m.date, 'dd')}</span>
                      </div>
                      <div>
                        <div className="font-bold">{safeFormat(m.date, 'eeee d MMMM')}</div>
                        <div className="text-xs text-slate-500">{m.time}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-200">{maskData(m.contact || 'Prospect', 'name')}</td>
                  
                  {/* --- APPEL DE LA FONCTION SÉCURISÉE --- */}
                  <td className="px-6 py-4 text-sm text-blue-400 font-medium">
                    {getMeetingSource(m)}
                  </td>

                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(m.status)}`}>
                      {m.status === 'scheduled' || m.status === 'upcoming' ? 'Confirmé' : m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ExternalLink className="h-4 w-4 text-slate-600 ml-auto" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  if (meetingsLoading || typesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-8 text-left">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Gestion des Rendez-vous</h1>
            <p className="text-slate-400">Gérez vos liens de réservation et votre agenda</p>
          </div>
        </div>

        {/* --- SECTION MES LIENS (GRILLE) --- */}
        <div className="mb-12">
          <div className="mb-4 flex items-center justify-between px-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-500" />
              Mes liens de réservation
            </h2>
            <button 
              onClick={() => navigate('/settings/booking')}
              className="text-sm font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Settings className="h-4 w-4" /> Gérer
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* CARTE AJOUTER */}
            <button
              onClick={() => navigate('/settings/booking')}
              className="group flex h-32 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 hover:border-blue-500 hover:bg-slate-900 transition-all"
            >
              <div className="mb-2 rounded-full bg-blue-500/10 p-3 transition-transform group-hover:scale-110">
                <Plus className="h-6 w-6 text-blue-500" />
              </div>
              <span className="font-bold text-white text-sm">Nouveau lien</span>
            </button>

            {/* CARTES DES LIENS EXISTANTS */}
            {bookingTypes.map((type) => (
              <div key={type.id} className="relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-5 transition-all hover:border-slate-700 hover:shadow-lg">
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg text-white line-clamp-1">{type.title}</h3>
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2 py-1 rounded">
                      <Clock className="h-3 w-3" /> {type.duration} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 overflow-hidden">
                    <Link2 className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">.../book/{type.slug}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => handleCopyLink(type.slug)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all",
                      copiedSlug === type.slug 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-slate-800 text-white hover:bg-slate-700"
                    )}
                  >
                    {copiedSlug === type.slug ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedSlug === type.slug ? 'Copié !' : 'Copier'}
                  </button>
                  <button
                    onClick={() => navigate('/settings/booking')}
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                    title="Modifier"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- TABLEAUX DES RENDEZ-VOUS --- */}
        <MeetingTable 
          data={upcomingMeetings} 
          title="Rendez-vous à venir" 
          icon={Calendar} 
          emptyText="Aucun rendez-vous à venir."
        />

        <MeetingTable 
          data={pastMeetings} 
          title="Historique des rendez-vous" 
          icon={History} 
          emptyText="Aucun historique disponible."
          showDeleteAction={true}
        />
      </div>

      {/* Modal Détails avec INFOS PROSPECT */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Détails de l'appel</h2>
              <button onClick={() => setSelectedMeeting(null)} className="rounded-full p-2 hover:bg-slate-800 text-slate-400">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-xl font-bold text-white">{selectedMeeting.contact?.charAt(0)}</div>
                    <div>
                      <p className="text-lg font-bold text-white">{maskData(selectedMeeting.contact, 'name')}</p>
                      
                      {/* --- APPEL DE LA FONCTION SÉCURISÉE DANS LE MODAL --- */}
                      <p className="text-sm text-slate-500">{getMeetingSource(selectedMeeting)}</p>
                    </div>
                 </div>
                 <div className="relative">
                    <select 
                      disabled={isUpdatingStatus}
                      value={selectedMeeting.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      className={cn(
                        "appearance-none pl-4 pr-10 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer transition-all",
                        getStatusStyle(selectedMeeting.status)
                      )}
                    >
                      <option value="Confirmé">Confirmé</option>
                      <option value="Terminé">Terminé</option>
                      <option value="Annulé">Annulé</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none opacity-50" />
                 </div>
              </div>

              {/* SECTION : INFORMATIONS DU PROSPECT (EXTRACTION DE DESCRIPTION) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Mail size={10} /> Email</p>
                  <p className="text-white font-bold truncate">
                    {maskData(selectedMeeting.description?.match(/Email:\s*([^\n\r]*)/)?.[1] || 'Non renseigné', 'email')}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Phone size={10} /> Téléphone</p>
                  <p className="text-white font-bold">
                    {maskData(selectedMeeting.description?.match(/Téléphone:\s*([^\n\r]*)/)?.[1] || 'Non renseigné', 'phone')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Calendar size={10} /> Date</p>
                  <p className="text-white font-bold">{safeFormat(selectedMeeting.date, 'dd MMMM yyyy')}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2"><Clock size={10} /> Heure</p>
                  <p className="text-white font-bold">{selectedMeeting.time}</p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3">
               {selectedMeeting.location && isDailyCoLink(selectedMeeting.location) && (
                 <button 
                   onClick={() => {
                     const locationUrl = selectedMeeting.location;
                     const url = `/live-call?url=${encodeURIComponent(locationUrl)}&from=/rendez-vous`;
                     navigate(url);
                   }} 
                   className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                 >
                   <Video className="h-5 w-5" /> Rejoindre l'appel
                 </button>
               )}
               <button onClick={() => setSelectedMeeting(null)} className="w-full rounded-2xl border border-slate-800 bg-slate-800/50 py-4 font-bold text-slate-300 hover:bg-slate-800">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}