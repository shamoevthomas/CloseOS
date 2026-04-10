import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Building2, 
  Mail 
} from 'lucide-react'
import { useCalls } from '../contexts/CallsContext'
import { useProspects } from '../contexts/ProspectsContext'
import { MaskedText } from '../components/MaskedText'
import { cn } from '../lib/utils'

export function CallDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { callHistory } = useCalls()
  const { prospects } = useProspects()

  const [call, setCall] = useState<typeof callHistory[0] | null>(null)
  const [relatedProspect, setRelatedProspect] = useState<typeof prospects[0] | null>(null)

  useEffect(() => {
    if (id) {
      const foundCall = callHistory.find(c => c.id === parseInt(id) || c.id === Number(id))
      setCall(foundCall || null)
    }
  }, [id, callHistory])

  useEffect(() => {
    if (call && call.contactType === 'prospect') {
      const prospect = prospects.find(p => p.id === call.contactId)
      setRelatedProspect(prospect || null)
    }
  }, [call, prospects])

  if (!call) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a1a1a] text-white/40">
        <p>Chargement de l'appel...</p>
      </div>
    )
  }

  // On cherche la note correspondante (à +/- 60 min près)
  const matchedNote = relatedProspect?.call_notes?.find(note => {
    const callTime = new Date(call.date).getTime()
    const noteTime = new Date(note.date).getTime()
    const diffMinutes = Math.abs(noteTime - callTime) / (1000 * 60)
    return diffMinutes < 60 
  })

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-8 text-white/80">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* BOUTON RETOUR (Redirige vers /calls et non /appels) */}
        <button 
          onClick={() => navigate('/calls')}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Retour aux appels
        </button>

        {/* EN-TÊTE */}
        <div className="flex items-start justify-between rounded-2xl bg-[#1a1a1a] border border-white/[0.08] p-8 shadow-xl">
          <div className="flex items-center gap-6">
            <div className={cn(
              "flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold shadow-lg",
              call.isAi ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50" : "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/50"
            )}>
              {call.contactName.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <MaskedText value={call.contactName} type="name" />
                {call.contactType === 'prospect' && (
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/40 border border-white/[0.08]">
                    Prospect
                  </span>
                )}
              </h1>
              <div className="mt-2 flex items-center gap-4 text-sm text-white/40">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(call.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {new Date(call.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right space-y-2">
            <div className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold",
              call.answered ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
            )}>
              {call.answered ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {call.answered ? "Appel Abouti" : "Sans réponse"}
            </div>
            {call.isAi && (
              <div className="flex items-center justify-end gap-2 text-purple-400 text-sm font-medium">
                <Sparkles className="h-3.5 w-3.5" /> Assisté par IA
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLONNE GAUCHE */}
          <div className="space-y-6">
            <div className="rounded-xl bg-[#1a1a1a] border border-white/[0.08] p-6 shadow-lg">
              <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Détails techniques</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-white/[0.08]">
                  <span className="flex items-center gap-2 text-white/40"><Clock className="h-4 w-4" /> Durée</span>
                  <span className="font-mono font-bold text-white text-lg">{call.duration}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="flex items-center gap-2 text-white/40"><User className="h-4 w-4" /> ID Contact</span>
                  <span className="font-mono text-white/40">#{call.contactId}</span>
                </div>
              </div>
            </div>

            {relatedProspect && (
              <div className="rounded-xl bg-[#1a1a1a] border border-white/[0.08] p-6 shadow-lg">
                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Fiche Prospect</h3>
                <div className="space-y-3">
                  {relatedProspect.company && (
                    <div className="flex items-center gap-3 text-white/60">
                      <div className="p-2 rounded bg-white/5"><Building2 className="h-4 w-4" /></div>
                      <span>{relatedProspect.company}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-white/60">
                    <div className="p-2 rounded bg-white/5"><Mail className="h-4 w-4" /></div>
                    <MaskedText value={relatedProspect.email} type="email" className="truncate" />
                  </div>
                  <div className="flex items-center gap-3 text-white/60">
                    <div className="p-2 rounded bg-white/5"><Phone className="h-4 w-4" /></div>
                    <MaskedText value={relatedProspect.phone} type="phone" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COLONNE DROITE : NOTES */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl bg-[#1a1a1a] border border-white/[0.08] p-8 shadow-lg min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-400" /> Notes de l'appel
                </h2>
                {matchedNote && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Synchronisé
                  </span>
                )}
              </div>

              {matchedNote ? (
                <div className="prose prose-invert max-w-none">
                  <div className="bg-[#1a1a1a] rounded-lg p-6 border border-white/[0.08] leading-relaxed text-white/60 whitespace-pre-wrap">
                    {matchedNote.content}
                  </div>
                  <p className="mt-4 text-xs text-white/40 text-right">
                    Sauvegardé par {matchedNote.author || 'Système'} le {new Date(matchedNote.date).toLocaleString()}
                  </p>
                </div>
              ) : relatedProspect ? (
                <div className="text-center py-12 bg-[#1a1a1a]/50 rounded-xl border border-dashed border-white/[0.08]">
                  <FileText className="h-10 w-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/40 font-medium">Aucune note liée trouvée pour cet horaire.</p>
                  <p className="text-sm text-white/10 mt-1">Consultez la fiche prospect complète pour voir tout l'historique.</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-white/40">Pas de notes disponibles pour cet appel.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}