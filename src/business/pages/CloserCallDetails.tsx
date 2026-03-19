import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, DollarSign,
  Calendar, Award, LayoutList, PenTool, Bell, Loader2, Save,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const objectionReasons = [
  'Je dois y réfléchir',
  'Manque de budget',
  'Doit en parler',
  "C'est pas le moment",
  'Autre'
]

const outcomes = [
  { id: 'won', label: 'Vente', description: 'Deal gagné', icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600' },
  { id: 'followup', label: 'À recontacter', description: 'Follow-up nécessaire', icon: Clock, color: 'orange', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' },
  { id: 'lost', label: 'Perdu', description: 'Deal perdu', icon: XCircle, color: 'red', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' },
  { id: 'noshow', label: 'No Show', description: 'Pas de réponse', icon: XCircle, color: 'slate', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
]

interface Formula {
  id: string
  name: string
  price: number
  commission?: string
}

export function CloserCallDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { teamMember, ownerUserId } = useBusinessAuth()
  const { prospects, updateProspect } = useBusinessProspects()

  const [call, setCall] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'qualification' | 'notes' | 'reminder'>('qualification')

  // Form state
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Payment terms
  const [paymentType, setPaymentType] = useState<'comptant' | 'installments'>('comptant')
  const [installmentsCount, setInstallmentsCount] = useState(3)

  // Follow up fields
  const [followupDate, setFollowupDate] = useState('')
  const [followupReason, setFollowupReason] = useState('')
  const [followupReasonOther, setFollowupReasonOther] = useState('')

  // Lost fields
  const [lostReason, setLostReason] = useState('')
  const [lostReasonOther, setLostReasonOther] = useState('')

  // Reminder fields
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderDescription, setReminderDescription] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [isSavingReminder, setIsSavingReminder] = useState(false)

  // Formulas for commission calc
  const [formulas, setFormulas] = useState<Formula[]>([])

  // Get live notes from state if coming from cockpit
  const liveNotes = (location.state as any)?.liveNotes || ''

  useEffect(() => {
    if (!id) return
    setLoading(true)
    const query = supabase
      .from('business_call_history')
      .select('*')
      .eq('id', id)

    query.single().then(({ data }) => {
      setCall(data)
      setNotes(data?.notes || liveNotes || '')
      if (liveNotes) setActiveTab('notes')
      setLoading(false)
    })
  }, [id])

  // Fetch formulas for commission
  useEffect(() => {
    if (!ownerUserId) return
    fetch(`/api/business?action=formulas-list&user_id=${ownerUserId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setFormulas(data)
        else if (data?.formulas) setFormulas(data.formulas)
      })
      .catch(() => {})
  }, [ownerUserId])

  // Find linked prospect
  const prospect = call?.contact_id
    ? prospects.find(p => p.id === call.contact_id)
    : call?.contact_name
      ? prospects.find(p => {
          const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim()
          return p.contact === call.contact_name ||
            fullName === call.contact_name ||
            p.email === call.contact_name
        })
      : null

  // Find linked formula/offer
  const prospectFormula = prospect?.offer_id || prospect?.formula_id
    ? formulas.find(f => String(f.id) === String(prospect.offer_id) || String(f.id) === String(prospect.formula_id))
    : null

  // Auto-fill amount from formula when Won
  useEffect(() => {
    if (selectedOutcome === 'won' && prospectFormula && amount === 0) {
      const price = prospectFormula.price
      if (price > 0) setAmount(price)
    }
  }, [selectedOutcome, prospectFormula, amount])

  // Commission calc
  const commissionRate = 10 // default 10%
  const totalCommission = amount > 0 ? (amount * commissionRate) / 100 : 0
  const monthlyCommission = paymentType === 'installments' && installmentsCount > 0
    ? totalCommission / installmentsCount : 0

  const isFormValid = () => {
    if (!selectedOutcome) return false
    if (selectedOutcome === 'won' && (!amount || amount <= 0)) return false
    if (selectedOutcome === 'followup') {
      if (!followupDate || !followupReason) return false
      if (followupReason === 'Autre' && !followupReasonOther.trim()) return false
    }
    if (selectedOutcome === 'lost') {
      if (!lostReason) return false
      if (lostReason === 'Autre' && !lostReasonOther.trim()) return false
    }
    return true
  }

  const handleSave = async () => {
    if (!call || !isFormValid()) return
    setSaving(true)
    try {
      const stageMap: Record<string, string> = {
        won: 'won', lost: 'lost', followup: 'qualified', noshow: 'noshow'
      }

      // Build technical summary
      let technicalSummary = `[${new Date().toLocaleDateString('fr-FR')}] Appel: ${selectedOutcome}`
      if (selectedOutcome === 'won') {
        technicalSummary += `\n- Montant: ${amount}€ (${paymentType === 'comptant' ? 'Comptant' : `${installmentsCount}x`})`
        technicalSummary += `\n- Commission: ${totalCommission.toFixed(2)}€${paymentType === 'installments' ? ` (${monthlyCommission.toFixed(2)}€/mois)` : ''}`
      }
      if (selectedOutcome === 'followup') {
        const reason = followupReason === 'Autre' ? followupReasonOther : followupReason
        technicalSummary += `\n- Motif: ${reason}\n- Rappel: ${new Date(followupDate).toLocaleDateString('fr-FR')}`
      }
      if (selectedOutcome === 'lost') {
        const reason = lostReason === 'Autre' ? lostReasonOther : lostReason
        technicalSummary += `\n- Motif: ${reason}`
      }

      // Save notes to call history
      const finalNotes = notes ? `${notes}\n\n${technicalSummary}` : technicalSummary
      await supabase.from('business_call_history').update({ notes: finalNotes }).eq('id', call.id)

      // Update prospect if found
      if (prospect && selectedOutcome) {
        const updates: any = {
          stage: stageMap[selectedOutcome],
          lastContact: new Date()
        }
        if (selectedOutcome === 'won' && amount > 0) {
          updates.value = amount
          updates.payment_type = paymentType
          updates.installments = paymentType === 'installments' ? installmentsCount : null
        }

        // Save call notes as JSONB
        const currentCallNotes = Array.isArray((prospect as any).call_notes) ? (prospect as any).call_notes : []
        updates.call_notes = [...currentCallNotes, {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          content: finalNotes,
          type: 'call',
          call_id: id,
          author: teamMember?.first_name || 'Closer'
        }]

        await updateProspect(prospect.id, updates)
      }

      // Create follow-up appointment if needed
      if (selectedOutcome === 'followup' && followupDate && ownerUserId) {
        const followupDateTime = new Date(followupDate)
        await supabase.from('business_appointments').insert([{
          user_id: ownerUserId,
          team_member_id: teamMember?.id,
          title: `Follow up — ${call.contact_name}`,
          date: followupDateTime.toISOString().split('T')[0],
          time: followupDateTime.toTimeString().slice(0, 5),
          type: 'call',
          contact: call.contact_name,
          status: 'upcoming',
          description: `Follow up — Motif: ${followupReason === 'Autre' ? followupReasonOther : followupReason}`,
        }])
      }

      toast.success('Sauvegardé')
      navigate('/business/appels')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveReminder = async () => {
    if (!reminderTitle || !reminderDate || !reminderTime || !ownerUserId) return
    setIsSavingReminder(true)
    try {
      const reminderDateTime = `${reminderDate}T${reminderTime}:00`
      await supabase.from('business_reminders').insert([{
        user_id: ownerUserId,
        team_member_id: teamMember?.id,
        call_id: call ? call.id : null,
        title: reminderTitle,
        description: reminderDescription || null,
        reminder_date: reminderDateTime,
        is_done: false,
      }])
      setReminderTitle('')
      setReminderDescription('')
      setReminderDate('')
      setReminderTime('')
      toast.success('Rappel programmé')
    } catch {
      toast.error('Erreur lors de la création du rappel')
    }
    setIsSavingReminder(false)
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
      <div className="mb-8">
        <button onClick={() => navigate('/business/appels')} className="mb-4 flex items-center gap-2 text-slate-400 hover:text-amber-700 transition-colors">
          <ArrowLeft className="h-5 w-5" /> Retour
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Résumé de Vente</h1>
          <p className="mt-1 text-slate-500">
            Qualifiez votre appel avec <span className="font-semibold text-slate-900">{call.contact_name}</span>
          </p>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
            <Clock className="h-3 w-3" />
            {new Date(call.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {call.duration && call.duration !== 'En cours...' && <span className="ml-2">({call.duration})</span>}
          </p>
          {prospect && prospectFormula && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2">
              <Award className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-xs text-slate-500">Offre liée</p>
                <p className="text-sm font-semibold text-amber-700">{prospectFormula.name} - {prospectFormula.price}€</p>
              </div>
            </div>
          )}
          {prospect && !prospectFormula && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2">
              <p className="text-sm text-yellow-700">Aucune offre liée à ce prospect</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('qualification')}
          className={cn("pb-3 px-2 text-sm font-medium flex items-center gap-2 transition-all relative",
            activeTab === 'qualification' ? "text-amber-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <LayoutList className="h-4 w-4" /> Qualification
          {activeTab === 'qualification' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={cn("pb-3 px-2 text-sm font-medium flex items-center gap-2 transition-all relative",
            activeTab === 'notes' ? "text-amber-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <PenTool className="h-4 w-4" /> Notes d'appel
          {activeTab === 'notes' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('reminder')}
          className={cn("pb-3 px-2 text-sm font-medium flex items-center gap-2 transition-all relative",
            activeTab === 'reminder' ? "text-amber-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Bell className="h-4 w-4" /> Programmer un rappel
          {activeTab === 'reminder' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 rounded-t-full" />}
        </button>
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {/* QUALIFICATION TAB */}
        {activeTab === 'qualification' && (
          <div className="space-y-6">
            {/* Outcome Selection */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <label className="mb-4 block text-sm font-bold text-slate-900">
                Résultat de l'appel <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {outcomes.map(outcome => {
                  const Icon = outcome.icon
                  const isSelected = selectedOutcome === outcome.id
                  return (
                    <button
                      key={outcome.id}
                      onClick={() => setSelectedOutcome(outcome.id)}
                      className={cn(
                        'group relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all',
                        isSelected
                          ? `${outcome.bg} ${outcome.border} ring-2 ring-amber-300`
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                        isSelected ? outcome.bg : 'bg-slate-100 group-hover:bg-slate-200'
                      )}>
                        <Icon className={cn('h-6 w-6 transition-colors', isSelected ? outcome.text : 'text-slate-400 group-hover:text-slate-500')} />
                      </div>
                      <div className="text-center">
                        <p className={cn('text-sm font-semibold', isSelected ? 'text-slate-900' : 'text-slate-600')}>{outcome.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{outcome.description}</p>
                      </div>
                      {isSelected && (
                        <div className="absolute -top-2 -right-2">
                          <div className={cn('rounded-full p-1 border-2', outcome.bg, outcome.border)}>
                            <CheckCircle2 className={cn('h-4 w-4', outcome.text)} />
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Won: Payment Terms & Commission */}
            {selectedOutcome === 'won' && (
              <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
                <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Détails de la vente
                </h3>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">Montant de la vente <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.01"
                      value={amount || ''}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Ex: 5000"
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pr-12 text-lg text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">€</div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">Mode de paiement</label>
                  <div className="flex gap-2">
                    <button onClick={() => setPaymentType('comptant')}
                      className={cn('flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-all',
                        paymentType === 'comptant' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
                      Comptant
                    </button>
                    <button onClick={() => setPaymentType('installments')}
                      className={cn('flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-all',
                        paymentType === 'installments' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
                      Plusieurs fois
                    </button>
                  </div>
                </div>

                {paymentType === 'installments' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-900">Nombre de mensualités</label>
                    <select value={installmentsCount} onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none">
                      {Array.from({ length: 23 }, (_, i) => i + 2).map(num => (
                        <option key={num} value={num}>{num} mois</option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm text-slate-500">
                      Montant par mois: <span className="text-emerald-600 font-semibold">{(amount / installmentsCount).toFixed(2)}€</span>
                    </p>
                  </div>
                )}

                {amount > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-emerald-600" />
                      <h4 className="text-sm font-bold text-emerald-700">Ta Commission</h4>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">{totalCommission.toFixed(2)} €</p>
                    {paymentType === 'installments' && (
                      <p className="mt-1 text-sm text-slate-600">
                        Tu recevras: <span className="font-semibold text-emerald-600">{monthlyCommission.toFixed(2)}€/mois</span>
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">Taux de commission: {commissionRate}%</p>
                  </div>
                )}
              </div>
            )}

            {/* Follow up */}
            {selectedOutcome === 'followup' && (
              <div className="space-y-4 rounded-xl border border-orange-200 bg-orange-50/50 p-6">
                <h3 className="text-sm font-bold text-orange-700 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Informations de suivi
                </h3>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Calendar className="h-4 w-4" /> Date de reprogrammation <span className="text-red-500">*</span>
                  </label>
                  <input type="datetime-local" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">Motif du report <span className="text-red-500">*</span></label>
                  <select value={followupReason} onChange={(e) => { setFollowupReason(e.target.value); if (e.target.value !== 'Autre') setFollowupReasonOther('') }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                    <option value="">Sélectionnez un motif</option>
                    {objectionReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {followupReason === 'Autre' && (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-medium text-slate-900">Précisez le motif <span className="text-red-500">*</span></label>
                      <input type="text" value={followupReasonOther} onChange={(e) => setFollowupReasonOther(e.target.value)}
                        placeholder="Ex: Indisponibilité exceptionnelle..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lost */}
            {selectedOutcome === 'lost' && (
              <div className="space-y-4 rounded-xl border border-red-200 bg-red-50/50 p-6">
                <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                  <XCircle className="h-4 w-4" /> Raison de la perte
                </h3>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">Motif <span className="text-red-500">*</span></label>
                  <select value={lostReason} onChange={(e) => { setLostReason(e.target.value); if (e.target.value !== 'Autre') setLostReasonOther('') }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20">
                    <option value="">Sélectionnez un motif</option>
                    {objectionReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {lostReason === 'Autre' && (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-medium text-slate-900">Précisez le motif <span className="text-red-500">*</span></label>
                      <input type="text" value={lostReasonOther} onChange={(e) => setLostReasonOther(e.target.value)}
                        placeholder="Ex: Prix trop élevé..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 h-[500px] flex flex-col">
            <label className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <FileText className="h-4 w-4 text-amber-600" /> Historique et Notes de l'appel
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Prenez vos notes ici. Elles seront enregistrées dans l'historique des appels..."
              className="flex-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none leading-relaxed"
            />
            <p className="mt-3 text-xs text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Ces notes s'ajouteront à l'historique des appels du prospect.
            </p>
          </div>
        )}

        {/* REMINDER TAB */}
        {activeTab === 'reminder' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-5 w-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Programmer un rappel</h3>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Titre <span className="text-red-500">*</span></label>
              <input type="text" value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="Ex: Rappeler Jean pour le contrat"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Description <span className="text-slate-400">(optionnel)</span></label>
              <textarea value={reminderDescription} onChange={(e) => setReminderDescription(e.target.value)}
                placeholder="Détails supplémentaires..." rows={3}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Calendar className="h-4 w-4" /> Date <span className="text-red-500">*</span>
                </label>
                <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Clock className="h-4 w-4" /> Heure <span className="text-red-500">*</span>
                </label>
                <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none" />
              </div>
            </div>

            <button onClick={handleSaveReminder}
              disabled={!reminderTitle || !reminderDate || !reminderTime || isSavingReminder}
              className={cn('w-full rounded-lg px-6 py-3 text-sm font-bold text-white transition-all mt-2',
                reminderTitle && reminderDate && reminderTime && !isSavingReminder
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-sm'
                  : 'bg-slate-300 cursor-not-allowed'
              )}>
              {isSavingReminder ? (
                <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</span>
              ) : 'Enregistrer le rappel'}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200 mt-6">
          <button onClick={() => navigate('/business/appels')}
            className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={handleSave} disabled={!isFormValid() || saving}
            className={cn('flex items-center gap-2 rounded-xl px-8 py-2.5 text-sm font-bold text-white transition-all',
              isFormValid() && !saving
                ? 'bg-amber-600 hover:bg-amber-500 shadow-sm'
                : 'bg-slate-300 cursor-not-allowed'
            )}>
            <Save className="h-4 w-4" /> {saving ? 'Enregistrement...' : 'Tout Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
