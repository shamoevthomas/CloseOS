import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText, DollarSign, Calendar, Award } from 'lucide-react'
import { cn } from '../lib/utils'
import { useCalls } from '../contexts/CallsContext'
import { useProspects } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'

// Helper to parse price from offer string (e.g., "4 997€" -> 4997)
const parseOfferPrice = (priceString: string): number => {
  const cleaned = priceString.replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/\s/g, '')
  const parsed = parseFloat(normalized.replace(',', '.'))
  return isNaN(parsed) ? 0 : parsed
}

const objectionReasons = [
  'Je dois y réfléchir',
  'Manque de budget',
  'Doit en parler',
  'C\'est pas le moment',
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

  // Payment terms (for Won)
  const [paymentType, setPaymentType] = useState<'comptant' | 'installments'>('comptant')
  const [installmentsCount, setInstallmentsCount] = useState(3)

  // Follow up fields
  const [followupDate, setFollowupDate] = useState('')
  const [followupReason, setFollowupReason] = useState('')
  const [followupReasonOther, setFollowupReasonOther] = useState('')

  // Lost fields
  const [lostReason, setLostReason] = useState('')
  const [lostReasonOther, setLostReasonOther] = useState('')

  const call = callHistory.find(c => c.id === Number(id))

  // Enhanced prospect lookup with multiple matching strategies
  const prospect = call && call.contactType === 'prospect'
    ? prospects.find(p => {
        // Try exact contact name match
        if (p.contact === call.contactName) return true
        // Try email match
        if (p.email === call.contactName) return true
        // Try case-insensitive contact match
        if (p.contact?.toLowerCase() === call.contactName?.toLowerCase()) return true
        // Try matching by company
        if (p.company === call.contactName) return true
        // Try matching firstName + lastName
        const fullName = `${p.firstName} ${p.lastName}`.trim()
        if (fullName === call.contactName) return true
        return false
      })
    : null

  // Enhanced offer lookup with multiple fallback strategies
  const prospectOffer = prospect
    ? (() => {
        // Strategy 1: Find by offerId
        if (prospect.offerId) {
          const offerById = offers.find(o =>
            o.id === prospect.offerId ||
            o.id === Number(prospect.offerId) ||
            String(o.id) === String(prospect.offerId)
          )
          if (offerById) return offerById
        }

        // Strategy 2: Find by offer name (fallback)
        if (prospect.offer) {
          const offerByName = offers.find(o =>
            o.name.toLowerCase() === prospect.offer?.toLowerCase() ||
            o.name.toLowerCase().includes(prospect.offer?.toLowerCase() || '') ||
            prospect.offer?.toLowerCase().includes(o.name.toLowerCase())
          )
          if (offerByName) return offerByName
        }

        return null
      })()
    : null

  // Comprehensive debugging logs
  useEffect(() => {
    console.log('🔍 Call Details Debug:', {
      callId: call?.id,
      contactName: call?.contactName,
      contactType: call?.contactType,
      prospectFound: !!prospect,
      prospectId: prospect?.id,
      prospectOfferId: prospect?.offerId,
      prospectOfferName: prospect?.offer,
      offerFound: !!prospectOffer,
      offerDetails: prospectOffer ? {
        id: prospectOffer.id,
        name: prospectOffer.name,
        price: prospectOffer.price,
        commission: prospectOffer.commission
      } : null,
      totalProspects: prospects.length,
      totalOffers: offers.length
    })
  }, [call, prospect, prospectOffer, prospects.length, offers.length])

  // Auto-fill amount from offer when "Won" is selected
  useEffect(() => {
    if (selectedOutcome === 'won' && prospectOffer && amount === 0) {
      const offerPrice = parseOfferPrice(prospectOffer.price)
      if (offerPrice > 0) {
        setAmount(offerPrice)
        console.log('💰 Auto-filled amount from offer:', offerPrice, '€')
      }
    }
  }, [selectedOutcome, prospectOffer, amount])

  if (!call) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => navigate('/')}
            className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Retour
          </button>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
            <p className="text-gray-400">Appel non trouvé</p>
          </div>
        </div>
      </div>
    )
  }

  // Parse commission rate from offer (e.g., "10%" -> 10)
  const parseCommissionRate = (commissionStr: string): number => {
    const match = commissionStr.match(/(\d+(?:\.\d+)?)/)
    return match ? parseFloat(match[1]) : 10 // Default to 10% if not found
  }

  const commissionRate = prospectOffer ? parseCommissionRate(prospectOffer.commission) : 10

  // Commission calculations
  const totalCommission = amount > 0 ? (amount * commissionRate) / 100 : 0
  const monthlyCommission = paymentType === 'installments' && installmentsCount > 0
    ? totalCommission / installmentsCount
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

  // Handle save and redirect
  const handleSave = async () => {
    if (!isFormValid() || !prospect) return

    setIsSaving(true)

    try {
      // Map outcome to stage
      const stageMap = {
        won: 'won',
        lost: 'lost',
        followup: 'qualified',
        noshow: 'noshow'
      }

      // Build notes with call summary
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

      // Update amount and payment details if won
      if (selectedOutcome === 'won' && amount > 0) {
        updates.value = amount
        // Store payment terms and commission in notes for now
        // In a real system, you'd have dedicated fields for this
      }

      // Update follow up date if applicable
      if (selectedOutcome === 'followup' && followupDate) {
        // Store next action date (would need to add this field to Prospect interface)
        updates.notes = updates.notes + `\n[RAPPEL: ${followupDate}]`
      }

      // Update prospect in Pipeline (ProspectsContext)
      updateProspect(prospect.id, updates)

      // Log to console for KPI tracking
      console.log('📊 KPI Data:', {
        outcome: selectedOutcome,
        amount: selectedOutcome === 'won' ? amount : 0,
        commission: selectedOutcome === 'won' ? totalCommission : 0,
        paymentType: selectedOutcome === 'won' ? paymentType : null,
        installments: selectedOutcome === 'won' && paymentType === 'installments' ? installmentsCount : null,
        objection: selectedOutcome === 'followup' || selectedOutcome === 'lost'
          ? (selectedOutcome === 'followup' ? followupReason : lostReason)
          : null
      })

      // Wait a bit to ensure save completes
      await new Promise(resolve => setTimeout(resolve, 500))

      // Redirect to Dashboard (Cockpit)
      navigate('/')
    } catch (error) {
      console.error('Error saving call summary:', error)
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
              Qualifiez votre appel avec <span className="font-semibold text-white">{call.contactName}</span>
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
            {prospect && !prospectOffer && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-2">
                <p className="text-sm text-yellow-400">
                  ⚠️ Aucune offre liée à ce prospect
                </p>
              </div>
            )}
          </div>
        </div>

        {/* DEBUG PANEL - Shows data linking status */}
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
          <h3 className="text-sm font-semibold text-purple-400 mb-3">🔍 Debug: Data Linking</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-gray-800 p-3">
              <p className="text-gray-500 mb-1">Prospect trouvé</p>
              <p className={prospect ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                {prospect ? `✓ ${prospect.contact}` : '✗ Non trouvé'}
              </p>
              {prospect && (
                <p className="text-gray-400 mt-1">ID: {prospect.id} | offerId: {prospect.offerId || 'N/A'}</p>
              )}
            </div>
            <div className="rounded-lg bg-gray-800 p-3">
              <p className="text-gray-500 mb-1">Offre liée</p>
              <p className={prospectOffer ? 'text-green-400 font-semibold' : 'text-yellow-400 font-semibold'}>
                {prospectOffer ? `✓ ${prospectOffer.name}` : '✗ Non trouvée'}
              </p>
              {prospectOffer && (
                <p className="text-gray-400 mt-1">Prix: {prospectOffer.price} | Commission: {prospectOffer.commission}</p>
              )}
            </div>
          </div>
          {!prospect && (
            <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
              <p className="text-sm text-red-400">
                ⚠️ Prospect non trouvé avec le nom: <span className="font-semibold">{call.contactName}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Vérifiez que le prospect existe dans ProspectsContext
              </p>
            </div>
          )}
          {prospect && !prospectOffer && (
            <div className="mt-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
              <p className="text-sm text-yellow-400">
                ⚠️ Prospect trouvé mais aucune offre liée
              </p>
              <p className="text-xs text-gray-400 mt-1">
                offerId: {prospect.offerId || 'null'} | offer: {prospect.offer || 'null'}
              </p>
            </div>
          )}
        </div>

        {/* Main Form */}
        <div className="space-y-6">
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
                      <p className="mt-1 text-xs text-gray-500">
                        {outcome.description}
                      </p>
                    </div>

                    {/* Selected indicator */}
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
            <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Détails de la vente
              </h3>

              {/* Amount Input */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Montant de la vente <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount || ''}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 5000"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 pr-12 text-lg text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                    €
                  </div>
                </div>
                {prospectOffer && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <span className="text-gray-400">Prix catalogue: </span>
                      <span className="text-emerald-400 font-semibold">{prospectOffer.price}</span>
                      <span className="ml-2 text-xs text-gray-500">(Auto-rempli)</span>
                    </div>
                  </div>
                )}
                {!prospectOffer && (
                  <p className="mt-2 text-xs text-yellow-400">
                    ⚠️ Aucune offre liée - Saisissez le montant manuellement
                  </p>
                )}
              </div>

              {/* Payment Type Toggle */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Mode de paiement
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentType('comptant')}
                    className={cn(
                      'flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-all',
                      paymentType === 'comptant'
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    Comptant
                  </button>
                  <button
                    onClick={() => setPaymentType('installments')}
                    className={cn(
                      'flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-all',
                      paymentType === 'installments'
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    Plusieurs fois
                  </button>
                </div>
              </div>

              {/* Installments Count */}
              {paymentType === 'installments' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    Nombre de mensualités
                  </label>
                  <select
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  >
                    {Array.from({ length: 23 }, (_, i) => i + 2).map(num => (
                      <option key={num} value={num}>{num} mois</option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-400">
                    Montant par mois: <span className="text-emerald-400 font-semibold">{(amount / installmentsCount).toFixed(2)}€</span>
                  </p>
                </div>
              )}

              {/* Commission Display */}
              {amount > 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="h-4 w-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-emerald-400">Ta Commission</h4>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">
                    {totalCommission.toFixed(2)} €
                  </p>
                  {paymentType === 'installments' && (
                    <p className="mt-1 text-sm text-gray-300">
                      Tu recevras: <span className="font-semibold text-emerald-400">{monthlyCommission.toFixed(2)}€/mois</span>
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Taux de commission: {commissionRate}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Follow up: Reschedule & Objection Tracking */}
          {selectedOutcome === 'followup' && (
            <div className="space-y-4 rounded-xl border border-orange-500/30 bg-orange-500/5 p-6">
              <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Informations de suivi
              </h3>

              {/* Reschedule Date */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                  <Calendar className="h-4 w-4" />
                  Date de reprogrammation <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>

              {/* Reason Selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Motif du report <span className="text-red-400">*</span>
                </label>
                <select
                  value={followupReason}
                  onChange={(e) => {
                    setFollowupReason(e.target.value)
                    if (e.target.value !== 'Autre') {
                      setFollowupReasonOther('')
                    }
                  }}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                >
                  <option value="">Sélectionnez un motif</option>
                  {objectionReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>

                {/* Conditional "Autre" textarea */}
                {followupReason === 'Autre' && (
                  <div className="mt-3">
                    <label className="mb-2 block text-sm font-medium text-white">
                      Précisez le motif <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={followupReasonOther}
                      onChange={(e) => setFollowupReasonOther(e.target.value)}
                      placeholder="Ex: Indisponibilité exceptionnelle..."
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lost: Objection Tracking */}
          {selectedOutcome === 'lost' && (
            <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/5 p-6">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Raison de la perte
              </h3>

              {/* Reason Selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Motif <span className="text-red-400">*</span>
                </label>
                <select
                  value={lostReason}
                  onChange={(e) => {
                    setLostReason(e.target.value)
                    if (e.target.value !== 'Autre') {
                      setLostReasonOther('')
                    }
                  }}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                >
                  <option value="">Sélectionnez un motif</option>
                  {objectionReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>

                {/* Conditional "Autre" textarea */}
                {lostReason === 'Autre' && (
                  <div className="mt-3">
                    <label className="mb-2 block text-sm font-medium text-white">
                      Précisez le motif <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={lostReasonOther}
                      onChange={(e) => setLostReasonOther(e.target.value)}
                      placeholder="Ex: Prix trop élevé..."
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <FileText className="h-4 w-4" />
              Notes de l'appel
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Résumez les points clés de votre conversation, les objections, les prochaines étapes..."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
              rows={6}
            />
            <p className="mt-2 text-xs text-gray-500">
              Ces notes seront ajoutées à la fiche prospect dans le Pipeline
            </p>
          </div>

          {/* Warning if no prospect found */}
          {!prospect && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-sm text-yellow-400">
                ⚠️ Aucun prospect trouvé pour cet appel. Les données ne pourront pas être sauvegardées dans le Pipeline.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg border border-gray-700 bg-gray-800 px-6 py-3 text-sm font-semibold text-gray-300 transition-all hover:bg-gray-700"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!isFormValid() || !prospect || isSaving}
              className={cn(
                'rounded-lg px-8 py-3 text-sm font-semibold text-white transition-all',
                isFormValid() && prospect && !isSaving
                  ? 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
                  : 'bg-gray-700 cursor-not-allowed opacity-50'
              )}
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer et retourner au Cockpit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
