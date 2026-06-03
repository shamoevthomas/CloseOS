import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom' // Ajout useLocation
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText, DollarSign, Calendar, Award, UserPlus, X, Tag, LayoutList, PenTool, Bell, Loader2, Settings2, Wallet } from 'lucide-react'
import { cn } from '../lib/utils'
import { InstallmentScheduleEditor, type ScheduleEntry } from '../components/InstallmentScheduleEditor'
import { useLanguage } from '../contexts/LanguageContext'
import { useCalls } from '../contexts/CallsContext'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { useMeetings } from '../contexts/MeetingsContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { useTags } from '../hooks/useTags'
import { supabase } from '../lib/supabase'

// Helper to parse price from offer string (e.g., "4 997€" -> 4997)
const parseOfferPrice = (priceString: string): number => {
  const cleaned = priceString.replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/\s/g, '')
  const parsed = parseFloat(normalized.replace(',', '.'))
  return isNaN(parsed) ? 0 : parsed
}

const objectionReasons_FR = [
  'Je dois y réfléchir',
  'Manque de budget',
  'Doit en parler',
  'C\'est pas le moment',
  'Autre'
]

const objectionReasons_EN = [
  'I need to think about it',
  'Lack of budget',
  'Needs to discuss',
  'Not the right time',
  'Other'
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

const outcomes_FR = [
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

const outcomes_EN = [
  {
    id: 'won' as const,
    label: 'Sale',
    description: 'Deal won',
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
    description: 'To call back',
    icon: Clock,
    color: 'orange',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    hoverBg: 'hover:bg-orange-500/20'
  },
  {
    id: 'lost' as const,
    label: 'Lost',
    description: 'Deal lost',
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
  const location = useLocation() // Init location
  const { lang } = useLanguage()
  const { callHistory } = useCalls()
  // AJOUT: récupération de addProspect pour mettre à jour la liste globale
  const { prospects, updateProspect, addProspect } = useProspects()
  const { offers } = useOffers()
  const { getStageInfo } = useCustomStages()
  const { getProspectTagObjects } = useTags()

  const { addMeeting } = useMeetings()
  const { isConnected: isGoogleConnected, createEvent: createGoogleEvent } = useGoogleCalendar()

  const objectionReasons = lang === 'fr' ? objectionReasons_FR : objectionReasons_EN
  const outcomes = lang === 'fr' ? outcomes_FR : outcomes_EN

  // --- NOUVEAU STATE POUR LES ONGLETS ---
  const [activeTab, setActiveTab] = useState<'qualification' | 'notes' | 'reminder'>('qualification')

  // Form state
  const [selectedOutcome, setSelectedOutcome] = useState<'won' | 'lost' | 'followup' | 'noshow' | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Payment terms (for Won)
  const [paymentType, setPaymentType] = useState<'comptant' | 'installments'>('comptant')
  const [installmentsCount, setInstallmentsCount] = useState(3)

  // Custom commission + custom installment schedule
  const [customCommissionEnabled, setCustomCommissionEnabled] = useState(false)
  const [customCommissionRate, setCustomCommissionRate] = useState<number>(0)
  const [scheduleMode, setScheduleMode] = useState<'equal' | 'custom'>('equal')
  const [customSchedule, setCustomSchedule] = useState<ScheduleEntry[]>([])

  // Acompte (deposit)
  const [depositAmount, setDepositAmount] = useState<number>(0)
  const [depositToRefund, setDepositToRefund] = useState<boolean>(false)
  const [depositDate, setDepositDate] = useState<string>('')

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
  const [reminderToast, setReminderToast] = useState(false)

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

  // --- MODIF: RECUPERATION DES NOTES DU LIVE ---
  useEffect(() => {
    // Si on vient de CallRoom avec des notes en direct
    if (location.state && location.state.liveNotes) {
        setNotes(location.state.liveNotes);
        setActiveTab('notes'); // On affiche directement l'onglet notes
    }
  }, [location.state]);

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

  // --- NOUVELLE FONCTION DE CREATION DE PROSPECT ---
  const handleCreateProspect = async () => {
    if (!newProspectForm.name) return
    setIsCreating(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(lang === 'fr' ? "Non connecté" : "Not connected")

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
      alert(lang === 'fr' ? "Erreur lors de la création" : "Error during creation")
    } finally {
      setIsCreating(false)
    }
  }

  if (!call) {
    return (
      <div className="min-h-screen bg-[#111111] p-8">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => navigate('/')}
            className="mb-6 flex items-center gap-2 text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            {lang === 'fr' ? 'Retour' : 'Back'}
          </button>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)] p-12 text-center">
            <p className="text-white/40">{lang === 'fr' ? 'Appel non trouvé' : 'Call not found'}</p>
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

  const standardRate = prospectOffer ? parseCommissionRate(prospectOffer.commission) : 10
  const commissionRate = customCommissionEnabled ? customCommissionRate : standardRate

  // Acompte (deposit) — règles métier :
  // - Conservé (deposit_to_refund=false) : compte comme 1 des N versements, déduit du plan
  // - Remboursé (deposit_to_refund=true) : versé en plus puis rendu, n'impacte pas le plan
  const hasDeposit = depositAmount > 0
  const depositKept = hasDeposit && !depositToRefund

  // Effective amount: when schedule is custom, the sale total equals the sum of installments (+ acompte si conservé)
  const customScheduleTotal = customSchedule.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const customEffectiveTotal = customScheduleTotal + (depositKept ? depositAmount : 0)
  const effectiveAmount = scheduleMode === 'custom' ? customEffectiveTotal : amount

  // Sync displayed amount when in custom mode
  useEffect(() => {
    if (scheduleMode === 'custom' && customEffectiveTotal !== amount) {
      setAmount(customEffectiveTotal)
    }
  }, [scheduleMode, customEffectiveTotal])

  // Plan de paiement (mode équitable)
  // - Conservé : N saisis = total versements (acompte inclus) → mensualités = (total - acompte) / (N-1)
  // - Remboursé : N saisis = nb de mensualités (acompte exclu) → mensualités = total / N
  const realInstallmentsCount = depositKept ? Math.max(1, installmentsCount - 1) : installmentsCount
  const remainingForInstallments = depositKept ? Math.max(0, amount - depositAmount) : amount
  const monthlyAmount = realInstallmentsCount > 0 ? remainingForInstallments / realInstallmentsCount : 0

  // Commission calculations — base = total (acompte n'impacte JAMAIS la base de commission)
  const totalCommission = effectiveAmount > 0 ? (effectiveAmount * commissionRate) / 100 : 0
  const monthlyCommission = paymentType === 'installments' && installmentsCount > 0
    ? totalCommission / installmentsCount
    : 0

  // Validation
  const isFormValid = () => {
    const otherLabel = lang === 'fr' ? 'Autre' : 'Other'
    if (!selectedOutcome) return false
    if (selectedOutcome === 'won' && (!amount || amount <= 0)) return false
    if (selectedOutcome === 'won' && hasDeposit) {
      if (depositAmount < 0) return false
      if (depositAmount > amount) return false
      if (!depositDate) return false
      // Conservé en plusieurs fois : l'acompte = 1 versement parmi N, donc N >= 2
      if (depositKept && paymentType === 'installments' && installmentsCount < 2) return false
    }
    if (selectedOutcome === 'followup') {
      if (!followupDate || !followupReason) return false
      if (followupReason === otherLabel && !followupReasonOther.trim()) return false
    }
    if (selectedOutcome === 'lost') {
      if (!lostReason) return false
      if (lostReason === otherLabel && !lostReasonOther.trim()) return false
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

      // Build technical summary
      const dateFmt = lang === 'fr' ? 'fr-FR' : 'en-US'
      let technicalSummary = `[${new Date().toLocaleDateString(dateFmt)}] ${lang === 'fr' ? 'Appel' : 'Call'}: ${selectedOutcome}`

      if (selectedOutcome === 'won') {
        technicalSummary += `\n- ${lang === 'fr' ? 'Montant' : 'Amount'}: ${amount}€ (${paymentType === 'comptant' ? (lang === 'fr' ? 'Comptant' : 'Cash') : `${installmentsCount}x`})`
        technicalSummary += `\n- Commission: ${totalCommission.toFixed(2)}€${paymentType === 'installments' ? ` (${monthlyCommission.toFixed(2)}€/${lang === 'fr' ? 'mois' : 'mo'})` : ''}`
        if (hasDeposit) {
          const depositLabel = depositToRefund
            ? (lang === 'fr' ? 'à rembourser' : 'to refund')
            : (lang === 'fr' ? 'conservé' : 'kept')
          technicalSummary += `\n- ${lang === 'fr' ? 'Acompte' : 'Deposit'}: ${depositAmount}€ (${depositLabel}, ${depositDate})`
        }
      }

      if (selectedOutcome === 'followup') {
        const otherLabel = lang === 'fr' ? 'Autre' : 'Other'
        const reason = followupReason === otherLabel ? followupReasonOther : followupReason
        technicalSummary += `\n- ${lang === 'fr' ? 'Motif' : 'Reason'}: ${reason}`
        technicalSummary += `\n- ${lang === 'fr' ? 'Rappel' : 'Reminder'}: ${new Date(followupDate).toLocaleDateString(dateFmt)}`
      }

      if (selectedOutcome === 'lost') {
        const otherLabel = lang === 'fr' ? 'Autre' : 'Other'
        const reason = lostReason === otherLabel ? lostReasonOther : lostReason
        technicalSummary += `\n- ${lang === 'fr' ? 'Motif' : 'Reason'}: ${reason}`
      }

      // --- CORRECTION SAUVEGARDE : JSONB call_notes ---
      
      // On combine les notes de l'utilisateur avec le résumé technique
      const finalNoteContent = notes ? `${notes}\n\n${technicalSummary}` : technicalSummary

      // Création de l'objet Note
      const newCallNoteEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        content: finalNoteContent,
        type: 'call',
        call_id: id,
        author: 'Closer'
      }

      // Récupération des notes existantes (si call_notes existe déjà)
      const currentCallNotes = Array.isArray((prospect as any).call_notes) ? (prospect as any).call_notes : []
      const updatedCallNotes = [...currentCallNotes, newCallNoteEntry]

      const updates: any = {
        stage: stageMap[selectedOutcome!],
        call_notes: updatedCallNotes, // C'EST ICI QU'ON SAUVEGARDE DANS call_notes (JSONB)
        lastContact: new Date()
      }

      // Update amount and payment details if won
      if (selectedOutcome === 'won' && effectiveAmount > 0) {
        updates.value = effectiveAmount
        updates.payment_type = paymentType
        if (paymentType === 'installments') {
            if (scheduleMode === 'custom') {
              updates.installments = customSchedule.length
              updates.installments_schedule = customSchedule
            } else {
              updates.installments = installmentsCount
              updates.installments_schedule = null
            }
        } else {
            updates.installments = null
            updates.installments_schedule = null
        }
        // Commission inhabituelle (Sales = pas de validation, on enregistre directement)
        updates.custom_commission_rate = customCommissionEnabled ? customCommissionRate : null
        // Acompte
        updates.deposit_amount = hasDeposit ? depositAmount : null
        updates.deposit_to_refund = hasDeposit ? depositToRefund : false
        updates.deposit_date = hasDeposit ? depositDate : null
      }

      // Update follow up date if applicable
      // NOTE: On ne touche PAS à la colonne "notes" (interne) ici.

      // 🔄 C'EST ICI QUE LA MAGIE OPÈRE : ON POUSSE DANS SUPABASE
      if (updateProspect) {
        await updateProspect(prospect.id, updates)
      }

      // 📅 SYNC FOLLOW-UP → AGENDA + GOOGLE CALENDAR
      if (selectedOutcome === 'followup' && followupDate) {
        try {
          const followupDateTime = new Date(followupDate)
          const dateStr = followupDateTime.toISOString().split('T')[0]
          const startTimeStr = followupDateTime.toTimeString().slice(0, 5)
          const endHour = new Date(followupDateTime.getTime() + 60 * 60 * 1000)
          const endTimeStr = endHour.toTimeString().slice(0, 5)
          const eventTitle = `Follow up — ${prospect.contact}`

          // 1. Créer dans la table meetings (Agenda CloserOS)
          await addMeeting({
            title: eventTitle,
            date: dateStr,
            time: `${startTimeStr} - ${endTimeStr}`,
            type: 'call',
            contact: prospect.contact,
            prospectId: prospect.id,
            status: 'upcoming',
            description: `Follow up automatique — Motif: ${followupReason === 'Autre' ? followupReasonOther : followupReason}`,
          })

          // 2. Sync avec Google Calendar si connecté
          if (isGoogleConnected) {
            await createGoogleEvent({
              title: eventTitle,
              date: dateStr,
              startTime: startTimeStr,
              endTime: endTimeStr,
              description: `Follow up — Motif: ${followupReason === 'Autre' ? followupReasonOther : followupReason}`,
            })
          }

          console.log('📅 Follow-up synced to Agenda + Google Calendar')
        } catch (syncError) {
          console.error('Erreur sync follow-up:', syncError)
        }
      }

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
      alert(lang === 'fr' ? 'Erreur lors de la sauvegarde' : 'Error while saving')
    } finally {
      setIsSaving(false)
    }
  }

  // --- HANDLER SAUVEGARDE RAPPEL ---
  const [reminderError, setReminderError] = useState('')

  const handleSaveReminder = async () => {
    if (!reminderTitle || !reminderDate || !reminderTime) return
    setIsSavingReminder(true)
    setReminderError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(lang === 'fr' ? 'Non connecté' : 'Not connected')

      const reminderDateTime = `${reminderDate}T${reminderTime}:00`

      const { error } = await supabase.from('reminders').insert([{
        user_id: user.id,
        call_id: call ? Number(call.id) : null,
        title: reminderTitle,
        description: reminderDescription || null,
        reminder_date: reminderDateTime,
        is_done: false,
      }])

      if (error) throw error

      // Reset form
      setReminderTitle('')
      setReminderDescription('')
      setReminderDate('')
      setReminderTime('')

      // Show toast
      setReminderToast(true)
      setTimeout(() => setReminderToast(false), 3000)
    } catch (error: any) {
      console.error('Erreur création rappel:', error)
      setReminderError(error?.message || (lang === 'fr' ? 'Erreur lors de la création du rappel. Vérifiez votre connexion et désactivez votre bloqueur de pub.' : 'Error creating reminder. Check your connection and disable your ad blocker.'))
    }
    setIsSavingReminder(false)
  }

  return (
    <div className="min-h-screen bg-[#111111] p-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => navigate('/')}
            className="mb-6 flex items-center gap-2 text-white/40 hover:text-white transition-all duration-300"
          >
            <ArrowLeft className="h-5 w-5" />
            {lang === 'fr' ? 'Retour' : 'Back'}
          </button>
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-white">{lang === 'fr' ? 'Resume de Vente' : 'Sales Summary'}</h1>
            <p className="mt-2 text-white/40">
              {lang === 'fr' ? 'Qualifiez votre appel avec' : 'Qualify your call with'} <span className="font-semibold text-white">{createdProspect ? createdProspect.contact : call.contactName}</span>
              {prospect && (() => {
                const si = getStageInfo(prospect.stage)
                return si ? (
                  <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/[0.08] px-2.5 py-0.5 text-xs font-medium text-white/60">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", si.isDefault ? si.color : '')}
                      style={!si.isDefault ? { backgroundColor: si.color } : undefined}
                    />
                    {si.name}
                  </span>
                ) : null
              })()}
              {/* Tag pills */}
              {prospect && getProspectTagObjects(prospect.id).map(tag => (
                <span
                  key={tag.id}
                  className="ml-1 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </p>
            {prospect && prospectOffer && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-5 py-3">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-xs text-white/40">{lang === 'fr' ? 'Offre liee' : 'Linked offer'}</p>
                    <p className="text-sm font-semibold text-emerald-400">
                      {prospectOffer.name} - {prospectOffer.price}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {prospect && !prospectOffer && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 px-5 py-3">
                <p className="text-sm text-yellow-400">
                  {lang === 'fr' ? '⚠️ Aucune offre liée à ce prospect' : '⚠️ No offer linked to this prospect'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* DEBUG PANEL - Shows data linking status */}
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 mb-12">
          <h3 className="text-sm font-semibold text-purple-400 mb-3">Debug: Data Linking</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-white/40 mb-1">{lang === 'fr' ? 'Prospect trouvé' : 'Prospect found'}</p>
              <p className={prospect ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                {prospect ? `✓ ${prospect.contact}` : (lang === 'fr' ? '✗ Non trouvé' : '✗ Not found')}
              </p>
              {prospect && (
                <p className="text-white/40 mt-1">ID: {prospect.id} | offerId: {prospect.offerId || 'N/A'}</p>
              )}
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-white/40 mb-1">{lang === 'fr' ? 'Offre liée' : 'Linked offer'}</p>
              <p className={prospectOffer ? 'text-green-400 font-semibold' : 'text-yellow-400 font-semibold'}>
                {prospectOffer ? `✓ ${prospectOffer.name}` : (lang === 'fr' ? '✗ Non trouvée' : '✗ Not found')}
              </p>
              {prospectOffer && (
                <p className="text-white/40 mt-1">Prix: {prospectOffer.price} | Commission: {prospectOffer.commission}</p>
              )}
            </div>
          </div>
          {!prospect && (
            <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/30 p-3">
              <p className="text-sm text-red-400">
                {lang === 'fr' ? 'Prospect non trouve avec le nom:' : 'Prospect not found with name:'} <span className="font-semibold">{call.contactName}</span>
              </p>
              <p className="text-xs text-white/40 mt-1">
                {lang === 'fr' ? 'Verifiez que le prospect existe dans ProspectsContext' : 'Verify the prospect exists in ProspectsContext'}
              </p>
            </div>
          )}
          {prospect && !prospectOffer && (
            <div className="mt-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3">
              <p className="text-sm text-yellow-400">
                {lang === 'fr' ? 'Prospect trouve mais aucune offre liee' : 'Prospect found but no linked offer'}
              </p>
              <p className="text-xs text-white/40 mt-1">
                offerId: {prospect.offerId || 'null'} | offer: {prospect.offer || 'null'}
              </p>
            </div>
          )}
        </div>

        {/* --- TABS (Glass Pill) --- */}
        <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-full w-fit mb-8">
            <button
                onClick={() => setActiveTab('qualification')}
                className={cn(
                    "px-6 py-2 rounded-full text-sm flex items-center gap-2 transition-all duration-300",
                    activeTab === 'qualification' ? "bg-emerald-500 text-black font-bold" : "text-white/40 hover:text-white font-medium"
                )}
            >
                <LayoutList className="h-4 w-4" />
                {lang === 'fr' ? 'Qualification' : 'Qualification'}
            </button>
            <button
                onClick={() => setActiveTab('notes')}
                className={cn(
                    "px-6 py-2 rounded-full text-sm flex items-center gap-2 transition-all duration-300",
                    activeTab === 'notes' ? "bg-emerald-500 text-black font-bold" : "text-white/40 hover:text-white font-medium"
                )}
            >
                <PenTool className="h-4 w-4" />
                {lang === 'fr' ? "Notes d'appel" : 'Call Notes'}
            </button>
            <button
                onClick={() => setActiveTab('reminder')}
                className={cn(
                    "px-6 py-2 rounded-full text-sm flex items-center gap-2 transition-all duration-300",
                    activeTab === 'reminder' ? "bg-emerald-500 text-black font-bold" : "text-white/40 hover:text-white font-medium"
                )}
            >
                <Bell className="h-4 w-4" />
                {lang === 'fr' ? 'Programmer un rappel' : 'Schedule a reminder'}
            </button>
        </div>

        {/* Main Form */}
        <div className="space-y-6">
          
          {/* --- NOUVEAU BANDEAU DE CREATION --- */}
          {!prospect && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-emerald-500/20">
                    <UserPlus className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                    <h3 className="font-bold text-white">{lang === 'fr' ? 'Prospect inconnu' : 'Unknown prospect'}</h3>
                    <p className="text-sm text-emerald-200">{lang === 'fr' ? "Pour qualifier l'appel, vous devez lier ou creer un prospect." : 'To qualify the call, you must link or create a prospect.'}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2 px-4 rounded-full shadow-lg transition-all"
              >
                {lang === 'fr' ? 'Créer un prospect ?' : 'Create a prospect?'}
              </button>
            </div>
          )}

          {/* Form Content - Apply blur if no prospect */}
          <div className={cn("transition-all duration-500", !prospect ? "opacity-50 pointer-events-none blur-[2px]" : "opacity-100")}>
            
            {activeTab === 'qualification' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Outcome Selection */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)] p-8">
                <label className="mb-6 block text-xs font-bold uppercase tracking-widest text-white/40">
                {lang === 'fr' ? "Resultat de l'appel" : 'Call outcome'} <span className="text-red-400">*</span>
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
                        'group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all duration-300',
                        isSelected
                            ? `${outcome.bgColor} ${outcome.borderColor} shadow-lg`
                            : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.04]'
                        )}
                    >
                        <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                        isSelected
                            ? outcome.bgColor
                            : 'bg-white/5 group-hover:bg-white/10'
                        )}>
                        <Icon className={cn(
                            'h-6 w-6 transition-colors',
                            isSelected
                            ? outcome.textColor
                            : 'text-white/40 group-hover:text-white/60'
                        )} />
                        </div>
                        <div className="text-center">
                        <p className={cn(
                            'text-sm font-semibold transition-colors',
                            isSelected ? outcome.textColor : 'text-white/60 group-hover:text-white'
                        )}>
                            {outcome.label}
                        </p>
                        <p className="mt-1 text-xs text-white/40">
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
                <div className="space-y-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 animate-in slide-in-from-top-2">
                <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {lang === 'fr' ? 'Details de la vente' : 'Sale details'}
                </h3>

                {/* Amount Input */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-white">
                    {lang === 'fr' ? 'Montant de la vente' : 'Sale amount'} <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount || ''}
                        onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: 5000"
                        readOnly={scheduleMode === 'custom'}
                        className={cn("w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 pr-12 text-lg text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none transition-all", scheduleMode === 'custom' && 'opacity-60 cursor-not-allowed')}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-medium">
                        €
                    </div>
                    </div>
                    {scheduleMode === 'custom' && (
                      <p className="mt-2 text-xs text-white/50">
                        {lang === 'fr' ? 'Montant calculé depuis l\'échéancier ci-dessous' : 'Amount calculated from the schedule below'}
                      </p>
                    )}
                </div>

                {/* Payment Type Toggle */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-white">
                    {lang === 'fr' ? 'Mode de paiement' : 'Payment method'}
                    </label>
                    <div className="flex gap-2">
                    <button
                        onClick={() => setPaymentType('comptant')}
                        className={cn(
                        'flex-1 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-all duration-300',
                        paymentType === 'comptant'
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                            : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:border-white/[0.12] hover:bg-white/[0.04]'
                        )}
                    >
                        {lang === 'fr' ? 'Comptant' : 'Cash'}
                    </button>
                    <button
                        onClick={() => setPaymentType('installments')}
                        className={cn(
                        'flex-1 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-all duration-300',
                        paymentType === 'installments'
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                            : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:border-white/[0.12] hover:bg-white/[0.04]'
                        )}
                    >
                        {lang === 'fr' ? 'Plusieurs fois' : 'Installments'}
                    </button>
                    </div>
                </div>

                {/* Installments Count */}
                {paymentType === 'installments' && (
                    <div>
                    <label className="mb-2 block text-sm font-medium text-white">
                        {lang === 'fr' ? 'Nombre de mensualités' : 'Number of installments'}
                    </label>
                    <select
                        value={scheduleMode === 'custom' ? 'custom' : String(installmentsCount)}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'custom') {
                            setScheduleMode('custom')
                            if (customSchedule.length === 0) {
                              const count = realInstallmentsCount
                              const base = count > 0 && remainingForInstallments > 0 ? remainingForInstallments / count : 0
                              setCustomSchedule(Array.from({ length: count }, (_, i) => ({ month: i + 1, amount: Math.round(base * 100) / 100 })))
                            }
                          } else {
                            setScheduleMode('equal')
                            setInstallmentsCount(parseInt(v))
                          }
                        }}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none transition-all"
                    >
                        <option value="custom">{lang === 'fr' ? 'Autre (montants personnalisés)' : 'Other (custom amounts)'}</option>
                        {Array.from({ length: 23 }, (_, i) => i + 2).map(num => (
                        <option key={num} value={num}>{num} {lang === 'fr' ? 'mois' : 'months'}</option>
                        ))}
                    </select>
                    {scheduleMode === 'equal' ? (
                      <p className="mt-2 text-sm text-white/40">
                          {lang === 'fr' ? 'Montant par mois:' : 'Monthly amount:'} <span className="text-emerald-400 font-semibold">{monthlyAmount.toFixed(2)}€</span>
                          {depositKept && (
                            <span className="ml-2 text-xs text-white/40">
                              ({lang === 'fr' ? `acompte ${depositAmount}€ + ${realInstallmentsCount} × ${monthlyAmount.toFixed(2)}€` : `deposit ${depositAmount}€ + ${realInstallmentsCount} × ${monthlyAmount.toFixed(2)}€`})
                            </span>
                          )}
                      </p>
                    ) : (
                      <div className="mt-3">
                        <InstallmentScheduleEditor
                          value={customSchedule}
                          onChange={setCustomSchedule}
                          dark
                          labels={{
                            monthsCount: lang === 'fr' ? 'Nombre de mois' : 'Number of months',
                            month: lang === 'fr' ? 'Mois' : 'Month',
                            amount: lang === 'fr' ? 'Montant' : 'Amount',
                            total: lang === 'fr' ? 'Total :' : 'Total:',
                            addRow: lang === 'fr' ? 'Ajouter une échéance' : 'Add installment',
                          }}
                        />
                      </div>
                    )}
                    </div>
                )}

                {/* Acompte (optionnel) */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-emerald-400" />
                      <h4 className="text-sm font-semibold text-white">
                        {lang === 'fr' ? 'Acompte' : 'Deposit'}
                        <span className="ml-2 text-xs font-normal text-white/40">
                          {lang === 'fr' ? '(optionnel)' : '(optional)'}
                        </span>
                      </h4>
                    </div>
                    {hasDeposit && (
                      <button
                        type="button"
                        onClick={() => { setDepositAmount(0); setDepositToRefund(false); setDepositDate('') }}
                        className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2"
                      >
                        {lang === 'fr' ? 'Retirer' : 'Remove'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/60">
                        {lang === 'fr' ? 'Montant' : 'Amount'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={depositAmount || ''}
                          onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-8 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">€</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/60">
                        {lang === 'fr' ? 'Date de versement' : 'Payment date'}
                        {hasDeposit && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      <input
                        type="date"
                        value={depositDate}
                        onChange={(e) => setDepositDate(e.target.value)}
                        disabled={!hasDeposit}
                        className={cn(
                          "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none",
                          !hasDeposit && "opacity-40 cursor-not-allowed"
                        )}
                      />
                    </div>
                  </div>

                  {hasDeposit && (
                    <div className="mt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={depositToRefund}
                          onChange={(e) => setDepositToRefund(e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                        />
                        <span className="text-sm text-white">
                          {lang === 'fr' ? 'Acompte à rembourser' : 'Deposit to refund'}
                        </span>
                      </label>
                      <p className="mt-2 text-xs text-white/40">
                        {depositToRefund
                          ? (lang === 'fr'
                              ? `Cet acompte sera rendu au client. Plan de paiement : ${amount}€ (acompte en plus).`
                              : `This deposit will be returned to the client. Payment plan: ${amount}€ (deposit on top).`)
                          : (lang === 'fr'
                              ? `Acompte conservé. Plan de paiement : ${(amount - depositAmount).toFixed(2)}€ restants${paymentType === 'installments' && installmentsCount >= 2 ? ` sur ${realInstallmentsCount} mensualités` : ''}.`
                              : `Deposit kept. Payment plan: ${(amount - depositAmount).toFixed(2)}€ remaining${paymentType === 'installments' && installmentsCount >= 2 ? ` over ${realInstallmentsCount} installments` : ''}.`)}
                      </p>
                      {depositKept && paymentType === 'installments' && installmentsCount < 2 && (
                        <p className="mt-2 text-xs text-red-400">
                          {lang === 'fr'
                            ? 'Avec un acompte conservé, le nombre de mensualités doit être au moins 2.'
                            : 'With a kept deposit, the number of installments must be at least 2.'}
                        </p>
                      )}
                      {depositAmount > amount && (
                        <p className="mt-2 text-xs text-red-400">
                          {lang === 'fr'
                            ? "L'acompte ne peut pas dépasser le montant total de la vente."
                            : 'The deposit cannot exceed the total sale amount.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Commission Display */}
                {effectiveAmount > 0 && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-emerald-400" />
                        <h4 className="text-sm font-semibold text-emerald-400">{lang === 'fr' ? 'Ta Commission' : 'Your Commission'}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (customCommissionEnabled) {
                            setCustomCommissionEnabled(false)
                            setCustomCommissionRate(0)
                          } else {
                            setCustomCommissionEnabled(true)
                            setCustomCommissionRate(standardRate)
                          }
                        }}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                          customCommissionEnabled
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                            : 'border-white/10 bg-white/5 text-white/60 hover:border-amber-500/40 hover:text-amber-300'
                        )}
                      >
                        <Settings2 className="h-3 w-3" />
                        {customCommissionEnabled
                          ? (lang === 'fr' ? 'Revenir au taux standard' : 'Revert to standard rate')
                          : (lang === 'fr' ? 'Commission inhabituelle' : 'Unusual commission')}
                      </button>
                    </div>

                    {customCommissionEnabled && (
                      <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                        <label className="mb-1.5 block text-xs font-medium text-amber-300">
                          {lang === 'fr' ? 'Taux personnalisé' : 'Custom rate'}
                          <span className="ml-2 text-white/40">
                            ({lang === 'fr' ? 'standard' : 'standard'}: {standardRate}%)
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={customCommissionRate || ''}
                            onChange={(e) => setCustomCommissionRate(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-amber-500/30 bg-white/5 px-3 py-2 pr-8 text-sm text-white focus:border-amber-500 focus:outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-300 text-sm">%</span>
                        </div>
                      </div>
                    )}

                    <p className="text-2xl font-bold text-emerald-400">
                        {totalCommission.toFixed(2)} €
                    </p>
                    {paymentType === 'installments' && scheduleMode === 'equal' && (
                        <p className="mt-1 text-sm text-white/60">
                        {lang === 'fr' ? 'Tu recevras:' : "You'll receive:"} <span className="font-semibold text-emerald-400">{monthlyCommission.toFixed(2)}€/{lang === 'fr' ? 'mois' : 'mo'}</span>
                        </p>
                    )}
                    <p className="mt-2 text-xs text-white/40">
                        {lang === 'fr' ? 'Taux de commission:' : 'Commission rate:'} {commissionRate}%
                        {customCommissionEnabled && (
                          <span className="ml-2 text-amber-300">
                            ({lang === 'fr' ? 'inhabituel' : 'unusual'})
                          </span>
                        )}
                    </p>
                    </div>
                )}
                </div>
            )}

            {/* Follow up: Reschedule & Objection Tracking */}
            {selectedOutcome === 'followup' && (
                <div className="space-y-6 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-8 animate-in slide-in-from-top-2">
                <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {lang === 'fr' ? 'Informations de suivi' : 'Follow-up information'}
                </h3>

                {/* Reschedule Date */}
                <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                    <Calendar className="h-4 w-4" />
                    {lang === 'fr' ? 'Date de reprogrammation' : 'Reschedule date'} <span className="text-red-400">*</span>
                    </label>
                    <input
                    type="datetime-local"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-all"
                    />
                </div>

                {/* Reason Selector */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-white">
                    {lang === 'fr' ? 'Motif du report' : 'Postponement reason'} <span className="text-red-400">*</span>
                    </label>
                    <select
                    value={followupReason}
                    onChange={(e) => {
                        setFollowupReason(e.target.value)
                        const otherLabel = lang === 'fr' ? 'Autre' : 'Other'
                        if (e.target.value !== otherLabel) {
                        setFollowupReasonOther('')
                        }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-all"
                    >
                    <option value="">{lang === 'fr' ? 'Sélectionnez un motif' : 'Select a reason'}</option>
                    {objectionReasons.map((reason) => (
                        <option key={reason} value={reason}>
                        {reason}
                        </option>
                    ))}
                    </select>

                    {/* Conditional "Autre" textarea */}
                    {followupReason === (lang === 'fr' ? 'Autre' : 'Other') && (
                    <div className="mt-3">
                        <label className="mb-2 block text-sm font-medium text-white">
                        {lang === 'fr' ? 'Précisez le motif' : 'Specify the reason'} <span className="text-red-400">*</span>
                        </label>
                        <input
                        type="text"
                        value={followupReasonOther}
                        onChange={(e) => setFollowupReasonOther(e.target.value)}
                        placeholder={lang === 'fr' ? "Ex: Indisponibilité exceptionnelle..." : "E.g.: Exceptional unavailability..."}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-orange-500 focus:outline-none transition-all"
                        />
                    </div>
                    )}
                </div>
                </div>
            )}

            {/* Lost: Objection Tracking */}
            {selectedOutcome === 'lost' && (
                <div className="space-y-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 animate-in slide-in-from-top-2">
                <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    {lang === 'fr' ? 'Raison de la perte' : 'Reason for loss'}
                </h3>

                {/* Reason Selector */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-white">
                    {lang === 'fr' ? 'Motif' : 'Reason'} <span className="text-red-400">*</span>
                    </label>
                    <select
                    value={lostReason}
                    onChange={(e) => {
                        setLostReason(e.target.value)
                        const otherLabel = lang === 'fr' ? 'Autre' : 'Other'
                        if (e.target.value !== otherLabel) {
                        setLostReasonOther('')
                        }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none transition-all"
                    >
                    <option value="">{lang === 'fr' ? 'Sélectionnez un motif' : 'Select a reason'}</option>
                    {objectionReasons.map((reason) => (
                        <option key={reason} value={reason}>
                        {reason}
                        </option>
                    ))}
                    </select>

                    {/* Conditional "Autre" textarea */}
                    {lostReason === (lang === 'fr' ? 'Autre' : 'Other') && (
                    <div className="mt-3">
                        <label className="mb-2 block text-sm font-medium text-white">
                        {lang === 'fr' ? 'Précisez le motif' : 'Specify the reason'} <span className="text-red-400">*</span>
                        </label>
                        <input
                        type="text"
                        value={lostReasonOther}
                        onChange={(e) => setLostReasonOther(e.target.value)}
                        placeholder={lang === 'fr' ? "Ex: Prix trop élevé..." : "E.g.: Price too high..."}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-red-500 focus:outline-none transition-all"
                        />
                    </div>
                    )}
                </div>
                </div>
            )}
            </div>
            )}

            {/* ONGLET 2: NOTES D'APPEL */}
            {activeTab === 'notes' && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)] p-8 h-[500px] flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                    <label className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                        <FileText className="h-4 w-4" />
                        {lang === 'fr' ? "Historique et Notes de l'appel" : 'Call History and Notes'}
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={lang === 'fr' ? "Prenez vos notes ici. Elles seront enregistrees dans l'historique des appels..." : "Take your notes here. They will be saved in the call history..."}
                        className="flex-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none transition-all resize-none leading-relaxed"
                    />
                    <p className="mt-3 text-xs text-white/40 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {lang === 'fr' ? "Ces notes s'ajouteront à l'historique des appels du prospect." : "These notes will be added to the prospect's call history."}
                    </p>
                </div>
            )}

            {/* ONGLET 3: PROGRAMMER UN RAPPEL */}
            {activeTab === 'reminder' && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)] p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                        <Bell className="h-5 w-5 text-orange-400" />
                        <h3 className="text-sm font-semibold text-white">{lang === 'fr' ? 'Programmer un rappel' : 'Schedule a reminder'}</h3>
                    </div>

                    {/* Titre */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            {lang === 'fr' ? 'Titre' : 'Title'} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={reminderTitle}
                            onChange={(e) => setReminderTitle(e.target.value)}
                            placeholder={lang === 'fr' ? "Ex: Rappeler Jean pour le contrat" : "E.g.: Call Jean about the contract"}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-orange-500 focus:outline-none transition-all"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            Description <span className="text-white/40">({lang === 'fr' ? 'optionnel' : 'optional'})</span>
                        </label>
                        <textarea
                            value={reminderDescription}
                            onChange={(e) => setReminderDescription(e.target.value)}
                            placeholder={lang === 'fr' ? "Détails supplémentaires..." : "Additional details..."}
                            rows={3}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-orange-500 focus:outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Date & Heure */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                                <Calendar className="h-4 w-4" />
                                {lang === 'fr' ? 'Date' : 'Date'} <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                value={reminderDate}
                                onChange={(e) => setReminderDate(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                                <Clock className="h-4 w-4" />
                                {lang === 'fr' ? 'Heure' : 'Time'} <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="time"
                                value={reminderTime}
                                onChange={(e) => setReminderTime(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Message d'erreur */}
                    {reminderError && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                            <p className="text-sm text-red-400">{reminderError}</p>
                        </div>
                    )}

                    {/* Bouton Enregistrer */}
                    <button
                        onClick={handleSaveReminder}
                        disabled={!reminderTitle || !reminderDate || !reminderTime || isSavingReminder}
                        className={cn(
                            'w-full rounded-full px-6 py-3 text-sm font-bold text-white transition-all duration-300 mt-2',
                            reminderTitle && reminderDate && reminderTime && !isSavingReminder
                                ? 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20'
                                : 'bg-white/5 cursor-not-allowed opacity-50'
                        )}
                    >
                        {isSavingReminder ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {lang === 'fr' ? 'Enregistrement...' : 'Saving...'}
                            </span>
                        ) : (
                            lang === 'fr' ? 'Enregistrer le rappel' : 'Save reminder'
                        )}
                    </button>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4 pt-6 mt-8">
                <button
                onClick={() => navigate('/')}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-8 py-3 text-sm font-semibold text-white/80 transition-all duration-300 hover:bg-white/[0.04]"
                >
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                onClick={handleSave}
                disabled={!isFormValid() || !prospect || isSaving}
                className={cn(
                    'rounded-full px-10 py-3 text-sm font-bold transition-all duration-300',
                    isFormValid() && prospect && !isSaving
                    ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-white/5 text-white/40 cursor-not-allowed opacity-50'
                )}
                >
                {isSaving ? (lang === 'fr' ? 'Enregistrement...' : 'Saving...') : (lang === 'fr' ? 'Tout Enregistrer' : 'Save All')}
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODALE DE CRÉATION DE PROSPECT --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white/[0.03] backdrop-blur-[16px] border border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.2)] p-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-white">{lang === 'fr' ? 'Nouveau Prospect' : 'New Prospect'}</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-white/40 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">{lang === 'fr' ? 'Nom & Prenom' : 'Full Name'} *</label>
                <input type="text" value={newProspectForm.name} onChange={e => setNewProspectForm({...newProspectForm, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none" placeholder={lang === 'fr' ? "Ex: Jean Dupont" : "E.g.: John Doe"} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">{lang === 'fr' ? 'Email' : 'Email'}</label>
                <input type="email" value={newProspectForm.email} onChange={e => setNewProspectForm({...newProspectForm, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none" placeholder="jean@entreprise.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">{lang === 'fr' ? 'Téléphone' : 'Phone'}</label>
                <input type="text" value={newProspectForm.phone} onChange={e => setNewProspectForm({...newProspectForm, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none" placeholder="+33 6 ..." />
              </div>

              {/* Offre */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">{lang === 'fr' ? 'Offre' : 'Offer'}</label>
                <select value={newProspectForm.offerId} onChange={e => setNewProspectForm({...newProspectForm, offerId: e.target.value, formulaId: ''})} className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none">
                  <option value="">{lang === 'fr' ? 'Sélectionner une offre...' : 'Select an offer...'}</option>
                  {offers.filter(o => o.status === 'active').map(offer => (
                    <option key={offer.id} value={offer.id}>{offer.name}</option>
                  ))}
                </select>
              </div>

              {/* Formules */}
              {newProspectForm.offerId && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-emerald-400 mb-1.5"><Tag className="h-3 w-3"/> {lang === 'fr' ? 'Choix de la formule' : 'Choose formula'} *</label>
                  <select value={newProspectForm.formulaId} onChange={e => setNewProspectForm({...newProspectForm, formulaId: e.target.value})} className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none">
                    <option value="">{lang === 'fr' ? '-- Sélectionner --' : '-- Select --'}</option>
                    {offers.find(o => String(o.id) === newProspectForm.offerId)?.formulas?.map(f => (
                      <option key={f.id} value={f.id}>{f.name} - {f.price}€</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">{lang === 'fr' ? 'Source' : 'Source'}</label>
                <select value={newProspectForm.source} onChange={e => setNewProspectForm({...newProspectForm, source: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:border-emerald-500 focus:outline-none">
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 bg-white/[0.03] border border-white/[0.08] hover:bg-white/10 text-white/80 font-medium py-2.5 rounded-full transition-colors">{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                <button onClick={handleCreateProspect} disabled={!newProspectForm.name || isCreating} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2.5 rounded-full transition-colors disabled:opacity-50">
                  {isCreating ? (lang === 'fr' ? 'Création...' : 'Creating...') : (lang === 'fr' ? 'Créer le prospect' : 'Create prospect')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST RAPPEL */}
      {reminderToast && (
        <div className="fixed bottom-6 right-6 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 shadow-2xl backdrop-blur-md">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">{lang === 'fr' ? 'Rappel programmé' : 'Reminder scheduled'}</span>
          </div>
        </div>
      )}
    </div>
  )
}