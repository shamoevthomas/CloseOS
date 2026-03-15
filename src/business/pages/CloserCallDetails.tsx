import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText,
  Calendar, Loader2, Save,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const outcomes = [
  { id: 'won', label: 'Vente', description: 'Deal gagné', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'followup', label: 'À recontacter', description: 'Follow-up nécessaire', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  { id: 'lost', label: 'Perdu', description: 'Deal perdu', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  { id: 'noshow', label: 'No Show', description: 'Pas de réponse', icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
]

export function CloserCallDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { teamMember } = useBusinessAuth()
  const { updateProspect } = useBusinessProspects()

  const [call, setCall] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Get live notes from state if coming from cockpit
  const liveNotes = (location.state as any)?.liveNotes || ''

  useEffect(() => {
    if (!id || !teamMember?.id) return
    setLoading(true)
    supabase
      .from('business_call_history')
      .select('*')
      .eq('id', id)
      .eq('team_member_id', teamMember.id)
      .single()
      .then(({ data }) => {
        setCall(data)
        setNotes(data?.notes || liveNotes || '')
        setLoading(false)
      })
  }, [id, teamMember?.id])

  const handleSave = async () => {
    if (!call) return
    setSaving(true)
    try {
      // Save notes & outcome to call history
      await supabase.from('business_call_history').update({
        notes,
      }).eq('id', call.id)

      // Update prospect stage if outcome selected and contact_id exists
      if (selectedOutcome && call.contact_id) {
        await updateProspect(call.contact_id, { stage: selectedOutcome })
      }

      toast.success('Sauvegardé')
      navigate('/business/appels')
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }

  if (!call) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Appel introuvable</p>
        <button onClick={() => navigate('/business/appels')} className="mt-4 text-amber-600 hover:underline">Retour aux appels</button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/business/appels')} className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{call.contact_name}</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {new Date(call.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {call.duration && call.duration !== 'En cours...' && <span className="ml-2">({call.duration})</span>}
          </p>
        </div>
      </div>

      {/* Outcome Selection */}
      <div className="rounded-xl border border-amber-200 bg-white p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Résultat de l'appel</h3>
        <div className="grid grid-cols-2 gap-3">
          {outcomes.map(outcome => (
            <button
              key={outcome.id}
              onClick={() => setSelectedOutcome(outcome.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4 transition-all text-left",
                selectedOutcome === outcome.id ? `${outcome.border} ${outcome.bg} ring-2 ring-amber-300` : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <outcome.icon className={cn("h-5 w-5", selectedOutcome === outcome.id ? outcome.color : "text-slate-400")} />
              <div>
                <p className={cn("text-sm font-semibold", selectedOutcome === outcome.id ? "text-slate-900" : "text-slate-700")}>{outcome.label}</p>
                <p className="text-xs text-slate-500">{outcome.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-amber-200 bg-white p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-600" /> Notes
        </h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={8}
          placeholder="Résumé de l'appel, objections, prochaines étapes..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 focus:border-amber-500 focus:outline-none resize-none"
        />
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/business/appels')} className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Annuler
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}
