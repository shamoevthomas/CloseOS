import { useState, useMemo } from 'react'
import { Link2, Copy, Check, Calendar, Clock, User, ExternalLink, X, Video, Phone, Settings } from 'lucide-react'
import { useMeetings } from '../contexts/MeetingsContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { useAuth } from '../contexts/AuthContext'
import { format, isValid, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export function RendezVous() {
  const { user } = useAuth()
  const { meetings, loading } = useMeetings()
  const { isPrivacyEnabled, maskData } = usePrivacy()
  
  const [isCopied, setIsCopied] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null)
  const [isLinkCopied, setIsLinkCopied] = useState(false)

  // ÉTAPE 1 : Lien dynamique corrigé pour le développement local
  const bookingLink = useMemo(() => {
    const slug = user?.user_metadata?.booking_slug || 
                 user?.user_metadata?.full_name?.toLowerCase().trim().replace(/\s+/g, '-') || 
                 user?.id?.substring(0, 8);
    
    // On utilise window.location.origin pour que le lien fonctionne sur ton localhost
    return `${window.location.origin}/book/${slug}`;
  }, [user]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingLink)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleCopyMeetingLink = (link: string) => {
    navigator.clipboard.writeText(link)
    setIsLinkCopied(true)
    setTimeout(() => setIsLinkCopied(false), 2000)
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
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }

  if (loading) {
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

        {/* Section Lien de réservation corrigée */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-bold text-white">Mon lien de réservation</h2>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl border border-slate-800 bg-black/40 px-4 py-3 flex items-center">
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
          </div>
        </div>

        {/* Liste des rendez-vous */}
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
              {meetings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                    Aucun rendez-vous trouvé.
                  </td>
                </tr>
              ) : (
                meetings.map((m: any) => (
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

      {/* Modal Détails */}
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
              <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50 flex items-center gap-4">
                 <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-xl font-bold text-white">{selectedMeeting.contact?.charAt(0)}</div>
                 <div>
                   <p className="text-lg font-bold text-white">{maskData(selectedMeeting.contact, 'name')}</p>
                   <p className="text-sm text-slate-500">Session de closing</p>
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