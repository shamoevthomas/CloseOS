import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, 
  DollarSign, Calendar, Award, UserPlus, X, Tag,
  LayoutList, PenTool 
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useCalls } from '../contexts/CallsContext'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { supabase } from '../lib/supabase'

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

// Ajout des sources pour le formulaire de création
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
  // AJOUT: récupération de addProspect pour mettre à jour la liste globale
  const { prospects, updateProspect, addProspect } = useProspects()
  const { offers } = useOffers()

  // --- NOUVEAU STATE POUR LES ONGLETS ---
  const [activeTab, setActiveTab] = useState<'qualification' | 'notes'>('qualification')

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

  // --- NOUVEAUX ETATS POUR LA CREATION DE PROSPECT ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createdProspect, setCreatedProspect] = useState<Prospect | null>(null)
  const [newProspectForm, setNewProspectForm] = useState({
    name: '',
    email: '',
    phone: '',
    offerId: '',
    formulaId: '',
    source: 'LinkedIn Ads'
  })

  const call = callHistory.find(c => c.id === Number(id))

  // Enhanced prospect lookup with multiple matching strategies
  // MODIFICATION: On regarde d'abord si un prospect vient d'être créé
  const prospect = createdProspect || (call && call.contactType === 'prospect'
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
    : null)

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

  // Auto-fill amount from offer when "Won" is selected
  useEffect(() => {
    if (selectedOutcome === 'won' && prospectOffer && amount === 0) {
      const offerPrice = parseOfferPrice(prospectOffer.price)
      if (offerPrice > 0) {
        setAmount(offerPrice)
      }
    }
  }, [selectedOutcome, prospectOffer, amount])

  // --- NOUVELLE FONCTION DE CREATION DE PROSPECT ---
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

      // AJOUT CRITIQUE: Mise à jour du contexte pour l'affichage immédiat
      if (addProspect) {
        addProspect(insertedProspect as Prospect)
      }

      setCreatedProspect(insertedProspect as Prospect)
      setIsCreateModalOpen(false)

    } catch (error) {
      console.error("Erreur création", error)
      alert("Erreur lors de la création")
    } finally {
      setIsCreating(false)
    }
  }

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

      // --- CORRECTION MAJEURE ICI ---
      // On prépare la note qui sera ajoutée dans le tableau call_notes (JSONB)
      const noteContent = notes 
        ? `${notes}\n\n--- Résumé Technique ---\n${callNotes}` 
        : callNotes

      const newCallNote = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        content: noteContent,
        type: 'call',
        call_id: id,
        author: 'Closer' // Ou récupérer le nom de l'user si dispo
      }

      // On récupère les notes existantes (sécurité si undefined)
      // Note: On caste en any[] car TS ne connait pas forcément la structure call_notes sur Prospect
      const currentCallNotes = Array.isArray((prospect as any).call_notes) ? (prospect as any).call_notes : []
      const updatedCallNotes = [...currentCallNotes, newCallNote]

      const updates: any = {
        stage: stageMap[selectedOutcome!],
        // ON NE TOUCHE PLUS A "notes" (Interne), ON UPDATE "call_notes"
        call_notes: updatedCallNotes, 
        lastContact: new Date()
      }

      // Update amount and payment details if won
      if (selectedOutcome === 'won' && amount > 0) {
        updates.value = amount
      }

      // Update follow up date if applicable
      if (selectedOutcome === 'followup' && followupDate) {
        // Optionnel : on peut aussi mettre un rappel dans les notes internes pour pas le rater
        // updates.notes = (prospect.notes || '') + `\n[RAPPEL: ${followupDate}]` 
      }

      // 🔄 C'EST ICI QUE LA MAGIE OPÈRE : ON POUSSE DANS SUPABASE
      if (updateProspect) {
        await updateProspect(prospect.id, updates)
      }

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
            Retour
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
            {prospect && !prospectOffer && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-2">
                <p className="text-sm text-yellow-400">
                  ⚠️ Aucune offre liée à ce prospect
                </p>
              </div>
            )}
          </div>
        </div>

        {/* --- TABS --- */}
        <div className="flex gap-4 mb-6 border-b border-gray-800">
            <button 
                onClick={() => setActiveTab('qualification')}
                className={cn(
                    "pb-3 px-2 text-sm font-medium flex items-center gap-2 transition-all relative",
                    activeTab === 'qualification' ? "text-blue-400" : "text-gray-400 hover:text-gray-200"
                )}
            >
                <LayoutList className="h-4 w-4" />
                Qualification
                {activeTab === 'qualification' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-t-full" />}
            </button>
            <button 
                onClick={() => setActiveTab('notes')}
                className={cn(
                    "pb-3 px-2 text-sm font-medium flex items-center gap-2 transition-all relative",
                    activeTab === 'notes' ? "text-blue-400" : "text-gray-400 hover:text-gray-200"
                )}
            >
                <PenTool className="h-4 w-4" />
                Notes d'appel
                {activeTab === 'notes' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-t-full" />}
            </button>
        </div>

        {/* Main Form */}
        <div className="space-y-6">
          
          {/* --- NOUVEAU BANDEAU DE CREATION --- */}
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

          {/* Form Content - Apply blur if no prospect */}
          <div className={cn("transition-all duration-500", !prospect ? "opacity-50 pointer-events-none blur-[2px]" : "opacity-100")}>
            
            {/* ONGLET 1: QUALIFICATION */}
            {activeTab === 'qualification' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
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
                        <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 animate-in slide-in-from-top-2">
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
                        <div className="space-y-4 rounded-xl border border-orange-500/30 bg-orange-500/5 p-6 animate-in slide-in-from-top-2">
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
                        <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/5 p-6 animate-in slide-in-from-top-2">
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
                </div>
            )}

            {/* ONGLET 2: NOTES */}
            {activeTab === 'notes' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 h-[500px] flex flex-col">
                        <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                            <FileText className="h-4 w-4 text-blue-400" />
                            Historique et Notes de l'appel
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Prenez vos notes ici. Elles seront enregistrées dans l'historique des appels..."
                            className="flex-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-4 text-base text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none leading-relaxed"
                        />
                        <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Ces notes s'ajouteront à l'historique des appels du prospect.
                        </p>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-800 mt-6">
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
                {isSaving ? 'Enregistrement...' : 'Tout Enregistrer'}
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