import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, 
  DollarSign, Calendar, Award, UserPlus, X, Tag 
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useCalls } from '../contexts/CallsContext'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { supabase } from '../lib/supabase'

// Helper to parse price from offer string
const parseOfferPrice = (priceString: string): number => {
  if (!priceString) return 0
  const cleaned = priceString.replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/\s/g, '')
  const parsed = parseFloat(normalized.replace(',', '.'))
  return isNaN(parsed) ? 0 : parsed
}

const objectionReasons = [
  'Je dois y réfléchir',
  'Manque de budget',
  'Doit en parler',
  "C'est pas le moment",
  'Autre'
]

const SOURCES = [
  'LinkedIn Ads',
  'Facebook Ads',
  'Prospection',
  'Recommandation',
  'Organique',
  'Autre'
]

const outcomes = [
  {
    id: 'won' as const,
    label: 'Vente',
    description: 'Deal gagné',
    icon: CheckCircle2,
    color: 'emerald',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    hoverBg: 'hover:bg-emerald-500/20'
  },
  {
    id: 'followup' as const,
    label: 'Follow up',
    description: 'À rappeler',
    icon: Clock,
    color: 'orange',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    hoverBg: 'hover:bg-orange-500/20'
  },
  {
    id: 'lost' as const,
    label: 'Perdu',
    description: 'Deal perdu',
    icon: XCircle,
    color: 'red',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    hoverBg: 'hover:bg-red-500/20'
  },
  {
    id: 'noshow' as const,
    label: 'No Show',
    description: 'Absent',
    icon: XCircle,
    color: 'gray',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    textColor: 'text-gray-400',
    hoverBg: 'hover:bg-gray-500/20'
  }
]

export function CallDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { callHistory } = useCalls()
  const { prospects, updateProspect } = useProspects()
  const { offers } = useOffers()

  // Form state
  const [selectedOutcome, setSelectedOutcome] = useState<'won' | 'lost' | 'followup' | 'noshow' | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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

  // --- GESTION MODALE CRÉATION ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newProspectForm, setNewProspectForm] = useState({
    name: '',
    email: '',
    phone: '',
    offerId: '',
    formulaId: '',
    source: 'LinkedIn Ads'
  })
  const [isCreating, setIsCreating] = useState(false)
  const [createdProspect, setCreatedProspect] = useState<Prospect | null>(null)

  const call = callHistory.find(c => c.id === Number(id))

  // Recherche du prospect (Local ou via création)
  const prospect = createdProspect || (call && call.contactType === 'prospect'
    ? prospects.find(p => {
        if (p.id === call.contactId) return true
        if (p.contact === call.contactName) return true
        if (p.email === call.contactName) return true
        return false
      })
    : null)

  // Recherche de l'offre liée
  const prospectOffer = prospect
    ? (() => {
        if (prospect.offerId) {
          const offerById = offers.find(o => String(o.id) === String(prospect.offerId))
          if (offerById) return offerById
        }
        if (prospect.offer) {
          return offers.find(o => o.name.toLowerCase().includes(prospect.offer?.toLowerCase() || ''))
        }
        return null
      })()
    : null

  // Auto-fill amount
  useEffect(() => {
    if (selectedOutcome === 'won' && prospectOffer && amount === 0) {
      const offerPrice = parseOfferPrice(prospectOffer.price)
      if (offerPrice > 0) {
        setAmount(offerPrice)
      }
    }
  }, [selectedOutcome, prospectOffer, amount])

  // --- LOGIQUE CRÉATION PROSPECT ---
  const handleCreateProspect = async () => {
    if (!newProspectForm.name) return
    setIsCreating(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non connecté")

      const selectedOffer = offers.find(o => String(o.id) === newProspectForm.offerId)
      let offerName = selectedOffer ? selectedOffer.name : ''
      let finalValue = selectedOffer ? parseOfferPrice(selectedOffer.price) : 0
      
      if (selectedOffer?.formulas && newProspectForm.formulaId) {
          const formula = selectedOffer.formulas.find(f => f.id === newProspectForm.formulaId)
          if (formula) {
              offerName = `${selectedOffer.name} - ${formula.name}`
              finalValue = parseOfferPrice(formula.price)
          }
      }

      const newProspectData = {
        user_id: user.id,
        contact: newProspectForm.name,
        email: newProspectForm.email,
        phone: newProspectForm.phone,
        offer: offerName, 
        value: finalValue,
        source: newProspectForm.source,
        stage: 'prospect',
        created_at: new Date().toISOString()
      }

      const { data: insertedProspect, error } = await supabase
        .from('prospects')
        .insert([newProspectData])
        .select()
        .single()

      if (error) throw error

      if (call) {
        await supabase
          .from('calls')
          .update({
            contact_id: insertedProspect.id,
            contact_name: newProspectForm.name,
            contact_type: 'prospect'
          })
          .eq('id', call.id)
      }

      setCreatedProspect(insertedProspect as Prospect)
      setIsCreateModalOpen(false)

    } catch (error) {
      console.error("Erreur création", error)
      alert("Erreur lors de la création du prospect.")
    } finally {
      setIsCreating(false)
    }
  }

  if (!call) {
    return (
      <div className="min-h-screen bg-gray-950 p-8 flex items-center justify-center">
        <p className="text-gray-400">Appel introuvable</p>
      </div>
    )
  }

  // CALCULS FINANCIERS
  const parseCommissionRate = (commissionStr: string): number => {
    const match = commissionStr.match(/(\d+(?:\.\d+)?)/)
    return match ? parseFloat(match[1]) : 10
  }

  const commissionRate = prospectOffer ? parseCommissionRate(prospectOffer.commission) : 10
  
  // Calculs détaillés
  const totalCommission = amount > 0 ? (amount * commissionRate) / 100 : 0
  const monthlyCommission = paymentType === 'installments' && installmentsCount > 0
    ? totalCommission / installmentsCount
    : 0
  const clientMonthlyPayment = paymentType === 'installments' && installmentsCount > 0
    ? amount / installmentsCount
    : 0

  // Validation
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

  // Handle save
  const handleSave = async () => {
    if (!isFormValid() || !prospect) return

    setIsSaving(true)

    try {
      const stageMap = {
        won: 'won',
        lost: 'lost',
        followup: 'qualified',
        noshow: 'noshow'
      }

      let callNotes = `[${new Date().toLocaleDateString('fr-FR')}] Appel: ${selectedOutcome}`

      if (selectedOutcome === 'won') {
        callNotes += `\n- Montant: ${amount}€ (${paymentType === 'comptant' ? 'Comptant' : `${installmentsCount}x`})`
        callNotes += `\n- Commission: ${totalCommission.toFixed(2)}€${paymentType === 'installments' ? ` (${monthlyCommission.toFixed(2)}€/mois)` : ''}`
      }

      if (selectedOutcome === 'followup') {
        const reason = followupReason === 'Autre' ? followupReasonOther : followupReason
        callNotes += `\n- Motif: ${reason}`
        callNotes += `\n- Rappel: ${new Date(followupDate).toLocaleDateString('fr-FR')}`
      }

      if (selectedOutcome === 'lost') {
        const reason = lostReason === 'Autre' ? lostReasonOther : lostReason
        callNotes += `\n- Motif: ${reason}`
      }

      if (notes) {
        callNotes += `\n- Notes: ${notes}`
      }

      const updates: any = {
        stage: stageMap[selectedOutcome!],
        notes: prospect.notes ? `${prospect.notes}\n\n${callNotes}` : callNotes,
        lastContact: new Date()
      }

      if (selectedOutcome === 'won' && amount > 0) {
        updates.value = amount
      }

      if (selectedOutcome === 'followup' && followupDate) {
        updates.notes = updates.notes + `\n[RAPPEL: ${followupDate}]`
      }

      if (updateProspect) {
        await updateProspect(prospect.id, updates)
      }

      await new Promise(resolve => setTimeout(resolve, 500))
      navigate('/')
    } catch (error) {
      console.error('Error saving:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Retour au Cockpit
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Résumé de Vente</h1>
            <p className="mt-2 text-gray-400">
              Qualifiez votre appel avec <span className="font-semibold text-white">{createdProspect ? createdProspect.contact : call.contactName}</span>
            </p>
            {prospect && prospectOffer && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 px-4 py-2">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-blue-400" />
                  <div>
                    <p className="text-xs text-gray-400">Offre liée</p>
                    <p className="text-sm font-semibold text-blue-400">
                      {prospectOffer.name} - {prospectOffer.price}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          
          {/* BANDEAU SI PAS DE PROSPECT */}
          {!prospect && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-6 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/20">
                    <UserPlus className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                    <h3 className="font-bold text-white">Prospect inconnu</h3>
                    <p className="text-sm text-blue-200">Pour qualifier l'appel, vous devez lier ou créer un prospect.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all"
              >
                Créer un prospect ?
              </button>
            </div>
          )}

          {/* Formulaire Principal */}
          <div className={cn("space-y-6 transition-all duration-500", !prospect ? "opacity-50 pointer-events-none blur-[2px]" : "opacity-100")}>
            
            {/* Outcome Selection */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <label className="mb-4 block text-sm font-semibold text-white">
                Résultat de l'appel <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {outcomes.map((outcome) => {
                  const Icon = outcome.icon
                  const isSelected = selectedOutcome === outcome.id

                  return (
                    <button
                      key={outcome.id}
                      onClick={() => setSelectedOutcome(outcome.id)}
                      className={cn(
                        'group relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all',
                        isSelected
                          ? `${outcome.bgColor} ${outcome.borderColor} shadow-lg`
                          : 'border-gray-800 bg-gray-800/30 hover:border-gray-700 hover:bg-gray-800/50'
                      )}
                    >
                      <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                        isSelected
                          ? outcome.bgColor
                          : 'bg-gray-700/50 group-hover:bg-gray-700'
                      )}>
                        <Icon className={cn(
                          'h-6 w-6 transition-colors',
                          isSelected
                            ? outcome.textColor
                            : 'text-gray-400 group-hover:text-gray-300'
                        )} />
                      </div>
                      <div className="text-center">
                        <p className={cn(
                          'text-sm font-semibold transition-colors',
                          isSelected ? outcome.textColor : 'text-gray-300 group-hover:text-white'
                        )}>
                          {outcome.label}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="absolute -top-2 -right-2">
                          <div className={cn('rounded-full p-1', outcome.bgColor, outcome.borderColor, 'border-2')}>
                            <CheckCircle2 className={cn('h-4 w-4', outcome.textColor)} />
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
              <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 animate-in slide-in-from-top-2">
                <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Détails de la vente
                </h3>
                {/* Amount Input */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">Montant de la vente</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount || ''}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 pr-12 text-lg text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</div>
                  </div>
                </div>
                {/* Payment Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">Mode de paiement</label>
                  <div className="flex gap-2">
                    <button onClick={() => setPaymentType('comptant')} className={cn('flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold', paymentType === 'comptant' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-gray-700 bg-gray-800 text-gray-400')}>Comptant</button>
                    <button onClick={() => setPaymentType('installments')} className={cn('flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold', paymentType === 'installments' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-gray-700 bg-gray-800 text-gray-400')}>Plusieurs fois</button>
                  </div>
                </div>
                {/* Installments */}
                {paymentType === 'installments' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white">Nombre de mensualités</label>
                    <select value={installmentsCount} onChange={(e) => setInstallmentsCount(parseInt(e.target.value))} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
                      {Array.from({ length: 23 }, (_, i) => i + 2).map(num => (<option key={num} value={num}>{num} mois</option>))}
                    </select>
                  </div>
                )}
                
                {/* Commission & Client Payment Summary */}
                {amount > 0 && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                         <Award className="h-4 w-4 text-emerald-400" />
                         <h4 className="text-sm font-semibold text-emerald-400">Récapitulatif</h4>
                       </div>
                       <span className="text-xs text-emerald-500/80 bg-emerald-500/10 px-2 py-1 rounded">Taux: {commissionRate}%</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-3">
                        {/* Total Commission */}
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Commission Totale</p>
                            <p className="text-2xl font-bold text-emerald-400">{totalCommission.toFixed(2)} €</p>
                        </div>

                        {/* If Installments */}
                        {paymentType === 'installments' && (
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Ta commission / mois</p>
                                <p className="text-xl font-bold text-emerald-400">{monthlyCommission.toFixed(2)} €</p>
                                <p className="text-[10px] text-gray-500 mt-1">pendant {installmentsCount} mois</p>
                            </div>
                        )}
                    </div>

                    {/* Client Payment Info */}
                    {paymentType === 'installments' && (
                        <div className="mt-3 pt-3 border-t border-emerald-500/20">
                            <p className="text-sm text-gray-300 flex justify-between items-center">
                                <span>Le client paiera :</span>
                                <span className="font-bold text-white text-lg">{clientMonthlyPayment.toFixed(2)} € / mois</span>
                            </p>
                        </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Follow Up Section */}
            {selectedOutcome === 'followup' && (
              <div className="space-y-4 rounded-xl border border-orange-500/30 bg-orange-500/5 p-6 animate-in slide-in-from-top-2">
                <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2"><Clock className="h-4 w-4" /> Suivi</h3>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">Date de reprogrammation</label>
                  <input type="datetime-local" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">Motif</label>
                  <select value={followupReason} onChange={(e) => setFollowupReason(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none">
                    <option value="">Sélectionner...</option>
                    {objectionReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Lost Section */}
            {selectedOutcome === 'lost' && (
                <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/5 p-6 animate-in slide-in-from-top-2">
                    <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2"><XCircle className="h-4 w-4" /> Perdu</h3>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">Raison</label>
                        <select value={lostReason} onChange={(e) => setLostReason(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white focus:border-red-500 focus:outline-none">
                            <option value="">Sélectionner...</option>
                            {objectionReasons.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>
            )}

            {/* Notes Section */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <FileText className="h-4 w-4" /> Notes de l'appel
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Résumez les points clés..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none h-32 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <button onClick={() => navigate('/')} className="rounded-lg border border-gray-700 bg-gray-800 px-6 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-700">Annuler</button>
              <button onClick={handleSave} disabled={!isFormValid() || !prospect || isSaving} className={cn('rounded-lg px-8 py-3 text-sm font-semibold text-white transition-all', isFormValid() && prospect && !isSaving ? 'bg-blue-500 hover:bg-blue-600 shadow-lg' : 'bg-gray-700 cursor-not-allowed opacity-50')}>
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODALE DE CRÉATION DE PROSPECT --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Nouveau Prospect</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom & Prénom *</label>
                <input type="text" value={newProspectForm.name} onChange={e => setNewProspectForm({...newProspectForm, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none" placeholder="Ex: Jean Dupont" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" value={newProspectForm.email} onChange={e => setNewProspectForm({...newProspectForm, email: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none" placeholder="jean@entreprise.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Téléphone</label>
                <input type="text" value={newProspectForm.phone} onChange={e => setNewProspectForm({...newProspectForm, phone: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none" placeholder="+33 6 ..." />
              </div>

              {/* Offre */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Offre</label>
                <select value={newProspectForm.offerId} onChange={e => setNewProspectForm({...newProspectForm, offerId: e.target.value, formulaId: ''})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none">
                  <option value="">Sélectionner une offre...</option>
                  {offers.filter(o => o.status === 'active').map(offer => (
                    <option key={offer.id} value={offer.id}>{offer.name}</option>
                  ))}
                </select>
              </div>

              {/* Formules */}
              {newProspectForm.offerId && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-blue-400 mb-1.5"><Tag className="h-3 w-3"/> Choix de la formule *</label>
                  <select value={newProspectForm.formulaId} onChange={e => setNewProspectForm({...newProspectForm, formulaId: e.target.value})} className="w-full bg-blue-900/20 border border-blue-500/30 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none">
                    <option value="">-- Sélectionner --</option>
                    {offers.find(o => String(o.id) === newProspectForm.offerId)?.formulas?.map(f => (
                      <option key={f.id} value={f.id}>{f.name} - {f.price}€</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Source</label>
                <select value={newProspectForm.source} onChange={e => setNewProspectForm({...newProspectForm, source: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none">
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg transition-colors">Annuler</button>
                <button onClick={handleCreateProspect} disabled={!newProspectForm.name || isCreating} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {isCreating ? 'Création...' : 'Créer le prospect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}