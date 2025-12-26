import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, Copy, Check, Calendar, Clock, User, ExternalLink, X, Video, Phone, Settings, Loader2, History, Trash2, ChevronDown } from 'lucide-react'
import { useMeetings } from '../contexts/MeetingsContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { format, isValid, parseISO, isAfter, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '../lib/utils'

export function RendezVous() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { meetings, loading: meetingsLoading, refreshMeetings } = useMeetings()
  const { isPrivacyEnabled, maskData } = usePrivacy()
  
  const [isCopied, setIsCopied] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null)
  const [dbSlug, setDbSlug] = useState<string | null>(null)
  const [slugLoading, setSlugLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Récupération du slug réel depuis la table booking_settings
  useEffect(() => {
    async function fetchBookingSlug() {
      if (!user?.id) return
      try {
        const { data } = await supabase
          .from('booking_settings')
          .select('slug')
          .eq('user_id', user.id)
          .single()
        
        if (data?.slug) {
          setDbSlug(data.slug)
        }
      } catch (err) {
        console.error("Erreur lors de la récupération du slug:", err)
      } finally {
        setSlugLoading(false)
      }
    }
    fetchBookingSlug()
  }, [user?.id])

  const bookingLink = useMemo(() => {
    const finalSlug = dbSlug || user?.user_metadata?.booking_slug || user?.id;
    return `${window.location.origin}/book/${finalSlug}`;
  }, [user, dbSlug]);

  // SÉPARATION DES RENDEZ-VOUS : À VENIR VS PASSÉS
  const { upcomingMeetings, pastMeetings } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    return meetings.reduce(
      (acc: any, m: any) => {
        const meetingDate = parseISO(m.date);
        // On considère à venir si c'est aujourd'hui ou dans le futur
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingLink)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
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
    if (s === 'upcoming' || s === 'confirmé' || s === 'confirmed') 
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (s === 'annulé' || s === 'cancelled')
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (s === 'terminé' || s === 'completed')
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
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
              <th className="px-6 py-4 text-center">Type</th>
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
                  <td className="px-6 py-4 text-center">
                    {m.type === 'video' ? <Video className="h-4 w-4 mx-auto text-blue-400" /> : <Phone className="h-4 w-4 mx-auto text-emerald-400" />}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(m.status)}`}>
                      {m.status === 'upcoming' ? 'Confirmé' : m.status}
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

  if (meetingsLoading || slugLoading) {
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
            <p className="text-slate-400">Gérez vos liens de réservation et vos appels</p>
          </div>
        </div>

        {/* Section Lien de réservation stable avec bouton Personnaliser */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-bold text-white">Mon lien de réservation</h2>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl border border-slate-800 bg-black/40 px-4 py-3 flex items-center overflow-hidden">
              <span className="text-blue-400 font-medium truncate">{bookingLink}</span>
            </div>
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 font-bold text-white transition-all ${
                isCopied ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {isCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {isCopied ? 'Copié !' : 'Copier'}
            </button>
            <button
              onClick={() => navigate('/settings/booking')}
              className="flex items-center gap-2 rounded-xl px-6 py-3 font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
            >
              <Settings className="h-5 w-5" />
              Personnaliser
            </button>
          </div>
        </div>

        {/* TABLEAUX SÉPARÉS */}
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

      {/* Modal Détails avec STATUT MODIFIABLE */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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
                      <p className="text-sm text-slate-500">Session de closing</p>
                    </div>
                 </div>
                 {/* SÉLECTEUR DE STATUT DYNAMIQUE */}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Date</p>
                  <p className="text-white font-bold">{safeFormat(selectedMeeting.date, 'dd MMMM yyyy')}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Heure</p>
                  <p className="text-white font-bold">{selectedMeeting.time}</p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3">
               {selectedMeeting.location && (
                 <a href={selectedMeeting.location} target="_blank" className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20">
                   <Video className="h-5 w-5" /> Rejoindre l'appel
                 </a>
               )}
               <button onClick={() => setSelectedMeeting(null)} className="w-full rounded-2xl border border-slate-800 bg-slate-800/50 py-4 font-bold text-slate-300 hover:bg-slate-800">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}