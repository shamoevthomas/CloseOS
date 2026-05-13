import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import {
  X,
  Phone,
  PhoneCall,
  Mail,
  Calendar,
  Camera,
  Pencil,
  Trash2,
  ExternalLink,
  MessageSquare,
  FileText,
  Save,
  Tag,
  MessageCircle,
  AlertCircle,
  CreditCard,
  Wallet,
  ClipboardList,
  Clock,
  Plus,
  ChevronDown,
  ChevronRight,
  User,
  Bell,
  Check,
  Loader2,
  Building2,
  Settings2,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { InstallmentScheduleEditor, type ScheduleEntry } from './InstallmentScheduleEditor'
import { MaskedText } from '../components/MaskedText'
import { type Prospect } from '../contexts/ProspectsContext'
import { useMeetings } from '../contexts/MeetingsContext'
import { useOffers, type Offer } from '../contexts/OffersContext'
import { useAuth } from '../contexts/AuthContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { useTags } from '../hooks/useTags'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// Helper to parse price
const parsePrice = (priceString: string): number => {
  if (!priceString) return 0
  const cleaned = priceString.toString().replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/,/g, '.')
  const withoutSpaces = normalized.replace(/\s/g, '')
  const parsed = parseFloat(withoutSpaces)
  return isNaN(parsed) ? 0 : parsed
}

// Extension du type pour l'affichage local
interface ExtendedProspect extends Prospect {
  callNotes?: {
    id: string
    date: string
    content: string
    author?: string
  }[]
  call_notes?: {
    id: string
    date: string
    content: string
    author?: string
  }[]
  payment_type?: 'cash' | 'installments' | 'comptant'
  installments?: number
  formula_id?: string
  loss_reason?: string
  loss_details?: string
  avatar_url?: string
}

const LOSS_REASONS_FR = ['Je dois y réfléchir', 'Argent/budget', 'Doit en parler', "C'est pas le moment", 'Peur', 'Ecran de fumée', 'Autre']
const LOSS_REASONS_EN = ['Need to think about it', 'Money/budget', 'Need to discuss', "Not the right time", 'Fear', 'Smokescreen', 'Other']


interface ProspectViewProps {
  prospect: Prospect
  onClose: () => void
  onUpdate?: (prospectId: number, updates: Partial<ExtendedProspect>) => void
  onDelete?: (prospectId: number) => void
  onCreateEvent?: () => void
  onStartCall?: (withAi: boolean) => void
  onPhoneCall?: () => void
  onDismissFromPipeline?: (prospectId: number, dismissed: boolean) => void
}

export function ProspectView({
  prospect,
  onClose,
  onUpdate,
  onDelete,
  onCreateEvent,
  onStartCall,
  onPhoneCall,
  onDismissFromPipeline,
}: ProspectViewProps) {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const { offers } = useOffers()
  const { allStages, getStageInfo } = useCustomStages()
  const LOSS_REASONS = lang === 'fr' ? LOSS_REASONS_FR : LOSS_REASONS_EN
  const { tags, addTagToProspect, removeTagFromProspect, getProspectTagObjects } = useTags()
  const [showTagPicker, setShowTagPicker] = useState(false)

  // Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // History
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())

  // Next appointment
  const [nextAppointment, setNextAppointment] = useState<{ date: string; time: string } | null>(null)

  const isExpired = (offer: Offer) => {
    if (!offer.endDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(offer.endDate)
    return end < today
  }

  const availableOffers = offers.filter((o) => o.status === 'active' && !isExpired(o))

  const [localProspect, setLocalProspect] = useState<ExtendedProspect>(prospect)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'rappels' | 'historique'>('info')

  const [editingOffer, setEditingOffer] = useState(false)
  const [editedOfferId, setEditedOfferId] = useState('')
  const [editedFormulaId, setEditedFormulaId] = useState(prospect.formula_id || '') // ✅ INIT AVEC LA FORMULE
  const [editedOfferName, setEditedOfferName] = useState(prospect.offer || '')
  const [editedValue, setEditedValue] = useState(prospect.value || 0)

  const [editingPayment, setEditingPayment] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'cash' | 'installments'>('cash')
  const [installments, setInstallments] = useState(1)
  const [commissionRate, setCommissionRate] = useState(10)

  // Custom commission + custom installment schedule (édition fiche)
  const [editCustomCommissionEnabled, setEditCustomCommissionEnabled] = useState(false)
  const [editCustomCommissionRate, setEditCustomCommissionRate] = useState<number>(0)
  const [editScheduleMode, setEditScheduleMode] = useState<'equal' | 'custom'>('equal')
  const [editCustomSchedule, setEditCustomSchedule] = useState<ScheduleEntry[]>([])

  // --- LOGIQUE INTELLIGENTE DE DÉTECTION DU PRIX ---
  useEffect(() => {
    const loadedProspect = { ...prospect } as ExtendedProspect

    // Normalisation notes
    if (loadedProspect.call_notes && (!loadedProspect.callNotes || loadedProspect.callNotes.length === 0)) {
      loadedProspect.callNotes = loadedProspect.call_notes
    }

    // ⚡ MAGIE ICI : Si valeur = 0 et qu'on a une formule, on répare tout seul !
    if ((!loadedProspect.value || loadedProspect.value === 0) && loadedProspect.formula_id) {
      const relatedOffer = offers.find(o => o.name === (loadedProspect.offer || '').split(' - ')[0])
      if (relatedOffer && relatedOffer.formulas) {
        const formula = relatedOffer.formulas.find(f => f.id === loadedProspect.formula_id)
        if (formula) {
          // On met à jour l'affichage local immédiatement
          loadedProspect.value = parsePrice(formula.price)
          loadedProspect.offer = `${relatedOffer.name} - ${formula.name}`

          // On prépare aussi les champs d'édition
          setEditedFormulaId(formula.id)
          setEditedValue(parsePrice(formula.price))
          setEditedOfferName(loadedProspect.offer)
        }
      }
    } else {
      setEditedValue(loadedProspect.value || 0)
    }

    setLocalProspect(loadedProspect)
    setTempNotes(prospect.notes || '')
    setEditedFormulaId(loadedProspect.formula_id || '')

    const isInstallments = loadedProspect.payment_type === 'installments' || (loadedProspect.installments && loadedProspect.installments > 1);

    if (isInstallments) {
      setPaymentMode('installments')
      setInstallments(loadedProspect.installments || 1)
    } else {
      setPaymentMode('cash')
      setInstallments(1)
    }

    // Hydrate custom commission + custom schedule
    const customRate = (loadedProspect as any).custom_commission_rate
    setEditCustomCommissionEnabled(customRate != null)
    setEditCustomCommissionRate(customRate != null ? Number(customRate) : 0)
    const schedule = (loadedProspect as any).installments_schedule
    if (Array.isArray(schedule) && schedule.length > 0) {
      setEditScheduleMode('custom')
      setEditCustomSchedule(schedule)
    } else {
      setEditScheduleMode('equal')
      setEditCustomSchedule([])
    }

  }, [prospect, offers])
  // --------------------------------------------------

  const [editingNotes, setEditingNotes] = useState(false)
  const [tempNotes, setTempNotes] = useState(prospect.notes || '')

  const [editingClient, setEditingClient] = useState(false)
  const [editedContact, setEditedContact] = useState(prospect.contact)
  const [editedCompany, setEditedCompany] = useState(prospect.company)
  const [editedEmail, setEditedEmail] = useState(prospect.email)
  const [editedPhone, setEditedPhone] = useState(prospect.phone)

  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')

  // --- Rappels state ---
  const { user } = useAuth()

  // Pipeline dismissal state
  const [isDismissed, setIsDismissed] = useState(false)
  useEffect(() => {
    if (!user?.id || !prospect.id) return
    let cancelled = false
    supabase.from('pipeline_dismissals').select('id').eq('user_id', user.id).eq('prospect_id', prospect.id).maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsDismissed(!!data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.id, prospect.id])

  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderDesc, setReminderDesc] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [reminderSubmitting, setReminderSubmitting] = useState(false)
  const [prospectReminders, setProspectReminders] = useState<any[]>([])
  const [remindersLoading, setRemindersLoading] = useState(false)
  const [reminderActionLoading, setReminderActionLoading] = useState<number | null>(null)
  const [expandedReminderId, setExpandedReminderId] = useState<number | null>(null)

  // Fetch reminders for this prospect
  useEffect(() => {
    if (!user || !prospect.id) return
    let mounted = true
    setRemindersLoading(true)
    supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .eq('prospect_id', prospect.id)
      .order('reminder_date', { ascending: true })
      .then(({ data }) => {
        if (mounted) {
          setProspectReminders(data || [])
          setRemindersLoading(false)
        }
      })
    return () => { mounted = false }
  }, [user, prospect.id])

  const handleCreateReminder = async () => {
    if (!user || !reminderTitle.trim() || !reminderDate || !reminderTime) return
    setReminderSubmitting(true)
    try {
      const reminder_date = new Date(`${reminderDate}T${reminderTime}`).toISOString()
      const { data, error } = await supabase
        .from('reminders')
        .insert([{
          user_id: user.id,
          title: reminderTitle.trim(),
          description: reminderDesc.trim() || null,
          reminder_date,
          prospect_id: prospect.id,
          is_done: false,
        }])
        .select()
        .single()

      if (error) throw error
      setProspectReminders(prev => [...prev, data])
      setShowReminderForm(false)
      setReminderTitle('')
      setReminderDesc('')
      setReminderDate('')
      setReminderTime('')
      toast.success(lang === 'fr' ? 'Rappel créé' : 'Reminder created')
    } catch (err) {
      console.error('Erreur création rappel:', err)
      toast.error(lang === 'fr' ? 'Impossible de créer le rappel' : 'Unable to create reminder')
    } finally {
      setReminderSubmitting(false)
    }
  }

  const handleMarkReminderDone = async (id: number) => {
    if (!user) return
    setReminderActionLoading(id)
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_done: true })
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
      setProspectReminders(prev => prev.map(r => r.id === id ? { ...r, is_done: true } : r))
    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setReminderActionLoading(null)
    }
  }

  const handleDeleteReminder = async (id: number) => {
    if (!user) return
    setReminderActionLoading(id)
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
      setProspectReminders(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setReminderActionLoading(null)
    }
  }

  const activeRemindersCount = prospectReminders.filter(r => !r.is_done).length

  // --- Avatar upload ---
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error(lang === 'fr' ? 'Fichier image requis' : 'Image file required'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error(lang === 'fr' ? 'Image trop lourde (max 5 Mo)' : 'Image too large (max 5 MB)'); return }
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `prospect-${prospect.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      await supabase.from('prospects').update({ avatar_url: data.publicUrl }).eq('id', prospect.id)
      setLocalProspect(prev => ({ ...prev, avatar_url: data.publicUrl }))
      if (onUpdate) onUpdate(prospect.id, { avatar_url: data.publicUrl } as any)
      toast.success(lang === 'fr' ? 'Photo mise à jour' : 'Photo updated')
    } catch (err) {
      console.error(err)
      toast.error(lang === 'fr' ? "Erreur lors de l'upload" : 'Upload error')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // --- Next appointment ---
  useEffect(() => {
    if (!user?.id || !prospect.id) return
    const nowIso = new Date().toISOString().split('T')[0]
    supabase
      .from('meetings')
      .select('date, time')
      .eq('user_id', user.id)
      .eq('prospectId', prospect.id)
      .in('status', ['upcoming', 'scheduled'])
      .gte('date', nowIso)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setNextAppointment({ date: data[0].date, time: data[0].time?.slice(0, 5) })
        } else {
          setNextAppointment(null)
        }
      })
  }, [user?.id, prospect.id])

  // --- History ---
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('prospect_history')
      .select('*')
      .eq('prospect_id', prospect.id)
      .order('created_at', { ascending: true })
      .limit(200)
    setHistory(data || [])
    setHistoryLoading(false)
  }, [prospect.id])

  useEffect(() => {
    if (activeTab === 'historique') fetchHistory()
  }, [activeTab, fetchHistory])

  const historyGroups = useMemo(() => {
    const groups: { key: string; created_at: string; type: string; entries: any[]; metadata?: any }[] = []
    for (const entry of history) {
      const key = `${entry.created_at}_${entry.change_type}`
      const existing = groups.find(g => g.key === key)
      if (existing) {
        existing.entries.push(entry)
      } else {
        groups.push({
          key,
          created_at: entry.created_at,
          type: entry.change_type,
          entries: [entry],
          metadata: entry.metadata,
        })
      }
    }
    return groups.reverse()
  }, [history])

  const FIELD_LABELS: Record<string, string> = lang === 'fr' ? {
    firstName: 'Prénom', lastName: 'Nom', contact: 'Contact',
    email: 'Email', phone: 'Téléphone', company: 'Entreprise',
    stage: 'Étape', value: 'Montant', offer: 'Offre',
    payment_type: 'Mode de paiement', installments: 'Mensualités',
    notes: 'Notes', loss_reason: 'Raison de perte', loss_details: 'Détails de perte',
    avatar_url: 'Photo de profil',
  } : {
    firstName: 'First name', lastName: 'Last name', contact: 'Contact',
    email: 'Email', phone: 'Phone', company: 'Company',
    stage: 'Stage', value: 'Amount', offer: 'Offer',
    payment_type: 'Payment mode', installments: 'Installments',
    notes: 'Notes', loss_reason: 'Loss reason', loss_details: 'Loss details',
    avatar_url: 'Profile photo',
  }

  const formatHistoryValue = useCallback((field: string, value: string | null | undefined): string => {
    if (value == null || value === '') return lang === 'fr' ? '(vide)' : '(empty)'
    if (field === 'stage') {
      const si = getStageInfo(value)
      return si?.name || value
    }
    if (field === 'value') return `${Number(value).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}€`
    if (field === 'payment_type') {
      const labels: Record<string, string> = lang === 'fr'
        ? { once: 'Comptant', installments: 'Mensualités', cash: 'Comptant', comptant: 'Comptant' }
        : { once: 'Cash', installments: 'Installments', cash: 'Cash', comptant: 'Cash' }
      return labels[value] || value
    }
    if (field === 'avatar_url') return lang === 'fr' ? 'Photo mise à jour' : 'Photo updated'
    return value
  }, [getStageInfo, lang])

  const selectedOfferObj = editedOfferId
    ? availableOffers.find(o => String(o.id) === editedOfferId)
    : availableOffers.find(o => o.name === (localProspect.offer?.split(' - ')[0] || localProspect.offer))

  const hasFormulas = selectedOfferObj?.formulas && selectedOfferObj.formulas.length > 0

  useEffect(() => {
    if (selectedOfferObj) {
      let rate = parsePrice(selectedOfferObj.commission)
      if (hasFormulas && editedFormulaId) {
        const formula = selectedOfferObj.formulas?.find(f => f.id === editedFormulaId)
        if (formula) rate = parsePrice(formula.commission)
      }
      setCommissionRate(rate > 0 ? rate : 10)
    }
  }, [selectedOfferObj, editedFormulaId, hasFormulas])

  const showError = (message: string) => {
    setErrorMessage(message)
    setTimeout(() => setErrorMessage(null), 3000)
  }

  const handleOptimisticUpdate = (updates: Partial<ExtendedProspect>) => {
    // History logging is centralized in ProspectsContext.updateProspect
    setLocalProspect(prev => ({ ...prev, ...updates }))
    const dbUpdates: any = { ...updates }
    if (updates.callNotes) {
      dbUpdates.call_notes = updates.callNotes
    }
    delete dbUpdates.callNotes
    if (onUpdate) {
      onUpdate(prospect.id, dbUpdates)
    }
  }

  const handleSaveNotes = () => {
    handleOptimisticUpdate({ notes: tempNotes })
    setEditingNotes(false)
  }

  const handleAddManualNote = () => {
    if (!newNoteContent.trim()) return
    const newNote = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      content: newNoteContent,
      author: lang === 'fr' ? 'Manuel' : 'Manual'
    }
    const updatedNotes = [newNote, ...(localProspect.callNotes || [])]
    handleOptimisticUpdate({
      callNotes: updatedNotes
    })
    setNewNoteContent('')
    setIsAddingNote(false)
  }

  const handleDeleteNote = (noteId: string) => {
    if (!confirm(lang === 'fr' ? "Voulez-vous vraiment supprimer cette note ?" : "Are you sure you want to delete this note?")) return
    const updatedNotes = (localProspect.callNotes || []).filter(n => n.id !== noteId)
    handleOptimisticUpdate({
      callNotes: updatedNotes
    })
  }

  const handleSaveClient = () => {
    const nameParts = editedContact.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    handleOptimisticUpdate({
      contact: editedContact,
      firstName,
      lastName,
      company: editedCompany,
      email: editedEmail,
      phone: editedPhone,
    })
    setEditingClient(false)
  }

  const handleCancelClient = () => {
    setEditedContact(localProspect.contact)
    setEditedCompany(localProspect.company)
    setEditedEmail(localProspect.email)
    setEditedPhone(localProspect.phone)
    setEditingClient(false)
  }

  const handleOfferChange = (offerId: string) => {
    setEditedOfferId(offerId)
    setEditedFormulaId('')
    if (offerId) {
      const selectedOffer = availableOffers.find((o) => String(o.id) === offerId)
      if (selectedOffer) {
        if (selectedOffer.formulas && selectedOffer.formulas.length > 0) {
          setEditedOfferName(selectedOffer.name)
          setEditedValue(0)
        } else {
          setEditedOfferName(selectedOffer.name)
          setEditedValue(parsePrice(selectedOffer.price))
        }
      }
    } else {
      setEditedValue(0)
    }
  }

  const handleFormulaChange = (formulaId: string) => {
    setEditedFormulaId(formulaId)
    if (selectedOfferObj && selectedOfferObj.formulas) {
      const formula = selectedOfferObj.formulas.find(f => f.id === formulaId)
      if (formula) {
        setEditedOfferName(`${selectedOfferObj.name} - ${formula.name}`)
        setEditedValue(parsePrice(formula.price))
      }
    }
  }

  const handleSaveOffer = () => {
    if (hasFormulas && !editedFormulaId) {
      alert(lang === 'fr' ? "Veuillez sélectionner une formule pour cette offre." : "Please select a formula for this offer.")
      return
    }
    // ✅ SAUVEGARDE DE LA FORMULE ET DU MONTANT
    handleOptimisticUpdate({
      offer: editedOfferName,
      value: editedValue,
      formula_id: editedFormulaId
    })
    setEditingOffer(false)
  }

  const handleCancelOffer = () => {
    setEditedOfferId('')
    setEditedFormulaId(localProspect.formula_id || '')
    setEditedOfferName(localProspect.offer || '')
    setEditedValue(localProspect.value || 0)
    setEditingOffer(false)
  }

  const handleSavePayment = () => {
    const editCustomScheduleTotal = editCustomSchedule.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const effectiveValue = editScheduleMode === 'custom' ? editCustomScheduleTotal : editedValue
    const updates: any = {
      value: effectiveValue,
      payment_type: paymentMode,
    }
    if (paymentMode === 'installments') {
      if (editScheduleMode === 'custom') {
        updates.installments = editCustomSchedule.length
        updates.installments_schedule = editCustomSchedule
      } else {
        updates.installments = installments
        updates.installments_schedule = null
      }
    } else {
      updates.installments = null
      updates.installments_schedule = null
    }
    updates.custom_commission_rate = editCustomCommissionEnabled ? editCustomCommissionRate : null
    handleOptimisticUpdate(updates)
    setEditingPayment(false)
  }

  const handleDeleteProspect = () => {
    if (confirm(lang === 'fr' ? `Êtes-vous sûr de vouloir supprimer ${localProspect.contact} ?` : `Are you sure you want to delete ${localProspect.contact}?`)) {
      if (onDelete) onDelete(localProspect.id)
      onClose()
    }
  }

  const handleOpenGmail = () => {
    if (localProspect.email) {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${localProspect.email}`, '_blank')
    } else {
      showError(lang === 'fr' ? "Email manquant !" : "Missing email!")
    }
  }

  const handleOpenWhatsApp = () => {
    if (localProspect.phone) {
      const cleanPhone = localProspect.phone.replace(/[^0-9+]/g, '')
      window.open(`https://wa.me/${cleanPhone}`, '_blank')
    } else {
      showError(lang === 'fr' ? "Numéro de téléphone manquant !" : "Missing phone number!")
    }
  }

  // Effective values with custom schedule + custom commission
  const editCustomScheduleTotal = editCustomSchedule.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const effectiveEditedValue = editScheduleMode === 'custom' ? editCustomScheduleTotal : editedValue
  const standardCommissionRate = commissionRate
  const effectiveCommissionRate = editCustomCommissionEnabled ? editCustomCommissionRate : standardCommissionRate
  const monthlyAmount = effectiveEditedValue / (installments || 1)
  const commissionAmount = (effectiveEditedValue * effectiveCommissionRate) / 100

  const savedInstallments = localProspect.installments || 1
  const savedCommissionRate = (localProspect as any).custom_commission_rate != null
    ? Number((localProspect as any).custom_commission_rate)
    : commissionRate
  const savedCommission = (localProspect.value || 0) * (savedCommissionRate / 100)
  const savedMonthlyPayment = (localProspect.value || 0) / savedInstallments
  const savedMonthlyCommission = savedCommission / savedInstallments

  const isPayingInInstallments = localProspect.payment_type === 'installments' || (savedInstallments > 1);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.2)] border-l border-white/[0.08]">

            {errorMessage && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </div>
            )}

            {/* Header Fixe */}
            <div className="border-b border-white/[0.08] bg-[#111111] px-6 pt-6 pb-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative w-11 h-11 rounded-full bg-white/5 flex items-center justify-center overflow-hidden text-lg font-extrabold text-white/40 group cursor-pointer shrink-0"
                    title={lang === 'fr' ? "Changer la photo" : "Change photo"}
                  >
                    {localProspect.avatar_url ? (
                      <img src={localProspect.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (localProspect.contact || '?')[0]?.toUpperCase()
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                      {avatarUploading ? (
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">
                      <MaskedText value={localProspect.contact} type="name" />
                    </h2>
                    {localProspect.company && localProspect.company !== 'N/A' && (
                      <p className="mt-0.5 text-sm text-white/40 truncate">{localProspect.company}</p>
                    )}
                  </div>
                </div>
                <button onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white shrink-0">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tags */}
              <div className="relative flex flex-wrap items-center gap-1.5 mb-3">
                {getProspectTagObjects(localProspect.id).map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white group/tag cursor-default"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                    <button
                      onClick={() => removeTagFromProspect(localProspect.id, tag.id)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-white/20 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/[0.08] px-2 py-0.5 text-[11px] text-white/40 hover:border-white/20 hover:text-white/60 transition-colors"
                >
                  <Plus className="h-3 w-3" /> tag
                </button>
                {showTagPicker && (
                  <div className="absolute left-0 top-full mt-1.5 z-10 min-w-[200px] max-w-[300px] rounded-lg border border-white/[0.08] bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                    <div className="max-h-48 overflow-y-auto p-1.5">
                      {tags.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-white/40">{lang === 'fr' ? 'Aucun tag. Créez-en dans Personnaliser.' : 'No tags. Create them in Customize.'}</p>
                      ) : (
                        tags.map(tag => {
                          const isAssigned = (getProspectTagObjects(localProspect.id)).some(t => t.id === tag.id)
                          return (
                            <button
                              key={tag.id}
                              onClick={() => {
                                if (isAssigned) removeTagFromProspect(localProspect.id, tag.id)
                                else addTagToProspect(localProspect.id, tag.id)
                              }}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors',
                                isAssigned ? 'bg-white/5 text-white' : 'text-white/60 hover:bg-white/5'
                              )}
                            >
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                              <span className="flex-1 text-left">{tag.name}</span>
                              {isAssigned && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Next appointment */}
              {nextAppointment && (
                <div className="flex items-center gap-3 mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{lang === 'fr' ? 'Prochain rendez-vous' : 'Next appointment'}</p>
                    <p className="text-sm font-semibold text-white">
                      {new Date(nextAppointment.date + 'T00:00:00').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                        weekday: 'short', day: 'numeric', month: 'long'
                      })} {lang === 'fr' ? 'à' : 'at'} {nextAppointment.time}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <button onClick={handleOpenGmail} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white">
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button onClick={handleOpenWhatsApp} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 hover:text-emerald-300">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </button>
                <button onClick={() => { if (onCreateEvent) onCreateEvent() }} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-black transition-all hover:bg-emerald-400 shadow-lg shadow-emerald-500/20">
                  <Calendar className="h-4 w-4" /> {lang === 'fr' ? 'RDV' : 'Appt'}
                </button>
              </div>
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setShowReminderForm(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 px-3 py-2.5 text-sm font-bold text-white transition-all hover:bg-orange-600 shadow-lg shadow-orange-500/20"
                >
                  <Bell className="h-4 w-4" /> {lang === 'fr' ? 'Rappel' : 'Reminder'}
                </button>
                <button
                  onClick={() => navigate(`/live-call?name=${encodeURIComponent(localProspect.contact)}&prospectId=${localProspect.id}&from=/pipeline`)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/[0.08] px-3 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10"
                >
                  <PhoneCall className="h-4 w-4" /> Call
                </button>
              </div>

              {/* TABS */}
              <div className="flex border-b border-white/[0.08]">
                <button
                  onClick={() => setActiveTab('info')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative",
                    activeTab === 'info' ? "text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  {lang === 'fr' ? 'Informations' : 'Info'}
                  {activeTab === 'info' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative",
                    activeTab === 'notes' ? "text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  {lang === 'fr' ? "Notes d'Appel" : 'Call Notes'}
                  {activeTab === 'notes' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('rappels')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative flex items-center justify-center gap-1.5",
                    activeTab === 'rappels' ? "text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  {lang === 'fr' ? 'Rappels' : 'Reminders'}
                  {activeRemindersCount > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500/20 px-1.5 text-[10px] font-bold text-orange-400">
                      {activeRemindersCount}
                    </span>
                  )}
                  {activeTab === 'rappels' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('historique')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative",
                    activeTab === 'historique' ? "text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  {lang === 'fr' ? 'Historique' : 'History'}
                  {activeTab === 'historique' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* --- ONGLET 1: INFORMATIONS --- */}
              {activeTab === 'info' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">

                  {/* Étape Pipeline */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-white/40">{lang === 'fr' ? 'Étape actuelle' : 'Current stage'}</label>
                    <select
                      value={localProspect.stage}
                      onChange={(e) => handleOptimisticUpdate({ stage: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    >
                      {allStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.isDefault ? stage.name : `● ${stage.name}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SECTION PAIEMENT */}
                  {localProspect.stage === 'won' && (
                    <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                          <CreditCard className="h-4 w-4" /> {lang === 'fr' ? 'Détails du Paiement' : 'Payment Details'}
                        </h3>
                        <button onClick={() => setEditingPayment(!editingPayment)} className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {editingPayment ? (
                        <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                          <div>
                            <label className="text-xs text-white/40">{lang === 'fr' ? 'Montant final (€)' : 'Final amount (€)'}</label>
                            <input
                              type="number"
                              value={editScheduleMode === 'custom' ? effectiveEditedValue : editedValue}
                              onChange={(e) => setEditedValue(parseFloat(e.target.value) || 0)}
                              readOnly={editScheduleMode === 'custom'}
                              className={cn("mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none", editScheduleMode === 'custom' && 'opacity-60 cursor-not-allowed')}
                            />
                            {editScheduleMode === 'custom' && (
                              <p className="mt-1.5 text-[10px] text-white/40">{lang === 'fr' ? 'Montant calculé depuis l\'échéancier' : 'Amount calculated from schedule'}</p>
                            )}
                          </div>
                          <div className="flex rounded-lg bg-white/[0.03] p-1">
                            <button type="button" onClick={() => { setPaymentMode('cash'); setInstallments(1); setEditScheduleMode('equal'); }} className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition-all", paymentMode === 'cash' ? "bg-emerald-600 text-white shadow" : "text-white/40 hover:text-white")}>{lang === 'fr' ? 'Comptant' : 'Cash'}</button>
                            <button type="button" onClick={() => setPaymentMode('installments')} className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition-all", paymentMode === 'installments' ? "bg-emerald-600 text-white shadow" : "text-white/40 hover:text-white")}>{lang === 'fr' ? 'Plusieurs fois' : 'Installments'}</button>
                          </div>
                          {paymentMode === 'installments' && (
                            <div className="animate-in fade-in slide-in-from-top-1 space-y-3">
                              <label className="text-xs text-white/40">{lang === 'fr' ? 'Nombre de mensualités' : 'Number of installments'}</label>
                              <select
                                value={editScheduleMode === 'custom' ? 'custom' : String(installments)}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === 'custom') {
                                    setEditScheduleMode('custom')
                                    if (editCustomSchedule.length === 0) {
                                      const base = editedValue > 0 ? editedValue / installments : 0
                                      setEditCustomSchedule(Array.from({ length: installments }, (_, i) => ({ month: i + 1, amount: Math.round(base * 100) / 100 })))
                                    }
                                  } else {
                                    setEditScheduleMode('equal')
                                    setInstallments(parseInt(v))
                                  }
                                }}
                                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                              >
                                <option value="custom">{lang === 'fr' ? 'Autre (montants personnalisés)' : 'Other (custom amounts)'}</option>
                                {[2, 3, 4, 5, 6, 10, 12].map(n => <option key={n} value={n}>{n} {lang === 'fr' ? 'fois' : 'times'} ({(editedValue / n).toFixed(2)}€/{lang === 'fr' ? 'mois' : 'mo'})</option>)}
                              </select>
                              {editScheduleMode === 'custom' && (
                                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                                  <InstallmentScheduleEditor
                                    value={editCustomSchedule}
                                    onChange={setEditCustomSchedule}
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
                          <div className="rounded-lg bg-emerald-500/10 p-3 border border-emerald-500/20 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1"><Wallet className="h-3 w-3" /> {lang === 'fr' ? 'Ta Commission' : 'Your Commission'} ({effectiveCommissionRate}%)</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editCustomCommissionEnabled) {
                                      setEditCustomCommissionEnabled(false)
                                      setEditCustomCommissionRate(0)
                                    } else {
                                      setEditCustomCommissionEnabled(true)
                                      setEditCustomCommissionRate(standardCommissionRate)
                                    }
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-all',
                                    editCustomCommissionEnabled
                                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                                      : 'border-white/15 bg-white/[0.03] text-white/50 hover:border-amber-500/40 hover:text-amber-300'
                                  )}
                                >
                                  <Settings2 className="h-2.5 w-2.5" />
                                  {editCustomCommissionEnabled
                                    ? (lang === 'fr' ? 'Revenir au standard' : 'Revert to standard')
                                    : (lang === 'fr' ? 'Commission inhabituelle' : 'Unusual commission')}
                                </button>
                                <span className="text-lg font-bold text-emerald-400">{commissionAmount.toFixed(2)}€</span>
                              </div>
                            </div>
                            {editCustomCommissionEnabled && (
                              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
                                <label className="text-[10px] font-bold text-amber-300 mb-1 block">
                                  {lang === 'fr' ? 'Taux personnalisé' : 'Custom rate'} <span className="font-normal text-white/40">(standard : {standardCommissionRate}%)</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type="number" min="0" max="100" step="0.1"
                                    value={editCustomCommissionRate || ''}
                                    onChange={(e) => setEditCustomCommissionRate(parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-amber-500/40 bg-white/5 px-3 py-2 pr-7 text-sm text-white focus:border-amber-500 focus:outline-none"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-300 text-xs">%</span>
                                </div>
                              </div>
                            )}
                            {paymentMode === 'installments' && editScheduleMode === 'equal' && (
                              <p className="mt-1 text-[10px] text-emerald-300/70">
                                {lang === 'fr' ? 'Tu recevras' : "You'll receive"} : {(commissionAmount / installments).toFixed(2)}€ / {lang === 'fr' ? 'mois' : 'mo'}
                              </p>
                            )}
                          </div>
                          <button onClick={handleSavePayment} className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-500">{lang === 'fr' ? 'Valider les détails' : 'Confirm details'}</button>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/40">{lang === 'fr' ? 'Montant Vente' : 'Sale Amount'}</span>
                            <span className="text-sm font-bold text-white">{(localProspect.value || 0).toLocaleString()}€</span>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/40">{lang === 'fr' ? 'Commission Totale' : 'Total Commission'} ({savedCommissionRate}%)</span>
                            <span className="text-sm font-bold text-emerald-400">+{savedCommission.toFixed(2)}€</span>
                          </div>

                          {isPayingInInstallments && (
                            <div className="mt-3 pt-3 border-t border-emerald-500/20 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-white/60">{lang === 'fr' ? `Client paie (x${savedInstallments})` : `Client pays (x${savedInstallments})`} :</span>
                                <span className="text-sm font-semibold text-white">{savedMonthlyPayment.toFixed(2)}€ / {lang === 'fr' ? 'mois' : 'mo'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-emerald-400/80">{lang === 'fr' ? 'Tu reçois' : 'You receive'} :</span>
                                <span className="text-sm font-bold text-emerald-400">{savedMonthlyCommission.toFixed(2)}€ / {lang === 'fr' ? 'mois' : 'mo'}</span>
                              </div>
                            </div>
                          )}

                          <div className="pt-2 border-t border-emerald-500/20 text-center mt-2">
                            <span className="text-[10px] font-medium text-emerald-300/60 uppercase tracking-wider">
                              {isPayingInInstallments ? (lang === 'fr' ? `Paiement en ${savedInstallments} fois` : `Payment in ${savedInstallments} installments`) : (lang === 'fr' ? 'Paiement Comptant' : 'Cash Payment')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Loss Reason */}
                  {localProspect.stage === 'lost' && (
                    <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-red-400 mb-3">
                        <X className="h-4 w-4" /> {lang === 'fr' ? 'Raison de la perte' : 'Loss reason'}
                      </h3>
                      <div className="space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                        <div>
                          <label className="text-xs font-medium text-white/40 mb-1.5 block">{lang === 'fr' ? 'Motif' : 'Reason'}</label>
                          <div className="relative">
                            <select
                              value={localProspect.loss_reason || ''}
                              onChange={(e) => {
                                handleOptimisticUpdate({ loss_reason: e.target.value } as any)
                              }}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none appearance-none"
                            >
                              <option value="">{lang === 'fr' ? 'Sélectionnez un motif' : 'Select a reason'}</option>
                              {LOSS_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-white/40" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-white/40 mb-1.5 block">{lang === 'fr' ? 'Détails' : 'Details'}</label>
                          <input
                            type="text"
                            value={localProspect.loss_details || ''}
                            onChange={(e) => handleOptimisticUpdate({ loss_details: e.target.value } as any)}
                            placeholder={lang === 'fr' ? "Précisez les détails..." : "Specify details..."}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-red-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Infos Offre */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{lang === 'fr' ? 'Infos Offre' : 'Offer Info'}</h3>
                      <button onClick={() => setEditingOffer(!editingOffer)} className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingOffer ? (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-2 block text-xs text-white/40">{lang === 'fr' ? 'Sélectionner une offre' : 'Select an offer'}</label>
                          <select
                            value={editedOfferId}
                            onChange={(e) => handleOfferChange(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="">{lang === 'fr' ? '-- Sélectionner --' : '-- Select --'}</option>
                            {availableOffers.map((offer) => (
                              <option key={offer.id} value={offer.id}>
                                {offer.name} {offer.formulas && offer.formulas.length > 0 ? (lang === 'fr' ? '(Multi-formules)' : '(Multi-formula)') : `(${offer.price})`}
                              </option>
                            ))}
                          </select>
                        </div>
                        {hasFormulas && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="mb-2 flex items-center gap-2 text-xs text-emerald-400">
                              <Tag className="h-3 w-3" /> {lang === 'fr' ? 'Choix de la formule' : 'Formula selection'}
                            </label>
                            <select
                              value={editedFormulaId}
                              onChange={(e) => handleFormulaChange(e.target.value)}
                              className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="">{lang === 'fr' ? '-- Sélectionner la formule --' : '-- Select formula --'}</option>
                              {selectedOfferObj?.formulas?.map((formula) => (
                                <option key={formula.id} value={formula.id}>{formula.name} - {formula.price}€</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {editedValue > 0 && <p className="text-xs font-medium text-emerald-400 text-right">{lang === 'fr' ? 'Nouveau montant' : 'New amount'} : {editedValue.toLocaleString()}€</p>}
                        <div className="flex gap-2">
                          <button onClick={handleSaveOffer} className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400">{lang === 'fr' ? 'Sauvegarder' : 'Save'}</button>
                          <button onClick={handleCancelOffer} className="rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-sm font-semibold text-white/60 hover:bg-white/10">{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-white/40">{lang === 'fr' ? 'Offre concernée' : 'Related offer'}</p>
                            <p className="mt-1 font-medium text-white">{localProspect.offer || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-white/40">{lang === 'fr' ? 'Montant' : 'Amount'}</p>
                            <p className="mt-1 text-lg font-bold text-emerald-400"><MaskedText value={`${(localProspect.value || 0).toLocaleString()}€`} type="number" /></p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fiche Client */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{lang === 'fr' ? 'Fiche Client' : 'Client Info'}</h3>
                      <button onClick={() => setEditingClient(!editingClient)} className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingClient ? (
                      <div className="space-y-3">
                        <input type="text" value={editedContact} onChange={(e) => setEditedContact(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" placeholder={lang === 'fr' ? 'Nom' : 'Name'} />
                        <input type="text" value={editedCompany} onChange={(e) => setEditedCompany(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" placeholder={lang === 'fr' ? 'Entreprise' : 'Company'} />
                        <input type="email" value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" placeholder="Email" />
                        <input type="tel" value={editedPhone} onChange={(e) => setEditedPhone(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" placeholder={lang === 'fr' ? 'Téléphone' : 'Phone'} />
                        <div className="flex gap-2">
                          <button onClick={handleSaveClient} className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black">{lang === 'fr' ? 'Sauvegarder' : 'Save'}</button>
                          <button onClick={handleCancelClient} className="rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-sm font-semibold text-white/60">{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                          <Mail className="h-4 w-4 text-emerald-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-white/40">{lang === 'fr' ? 'Email' : 'Email'}</p>
                            <button onClick={handleOpenGmail} className="truncate text-sm text-white/60 hover:text-white hover:underline text-left"><MaskedText value={localProspect.email} type="name" /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                          <Phone className="h-4 w-4 text-emerald-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-white/40">{lang === 'fr' ? 'Téléphone' : 'Phone'}</p>
                            <button onClick={handleOpenWhatsApp} className="text-sm text-white/60 hover:text-white hover:underline text-left"><MaskedText value={localProspect.phone} type="name" /></button>
                          </div>
                        </div>
                        {localProspect.company && localProspect.company !== 'N/A' && (
                          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                            <Building2 className="h-4 w-4 text-orange-400" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-white/40">{lang === 'fr' ? 'Entreprise' : 'Company'}</p>
                              <p className="text-sm text-white/60">{localProspect.company}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                          <Clock className="h-4 w-4 text-purple-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-white/40">{lang === 'fr' ? 'Date de création' : 'Created on'}</p>
                            <p className="text-sm text-white/60">
                              {new Date(localProspect.created_at || localProspect.dateAdded || '').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes Internes (Générales) */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{lang === 'fr' ? 'Notes Internes' : 'Internal Notes'}</h3>
                      <button onClick={() => setEditingNotes(!editingNotes)} className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingNotes ? (
                      <div>
                        <textarea value={tempNotes} onChange={(e) => setTempNotes(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none" rows={4} />
                        <div className="mt-2 flex gap-2">
                          <button onClick={handleSaveNotes} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black">{lang === 'fr' ? 'Enregistrer' : 'Save'}</button>
                          <button onClick={() => setEditingNotes(false)} className="rounded-lg border border-white/[0.08] bg-white/5 px-3 py-1.5 text-sm font-medium text-white/60">{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                        <p className="whitespace-pre-wrap text-sm text-white/60">{localProspect.notes || (lang === 'fr' ? 'Aucune note' : 'No notes')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- ONGLET 2: NOTES D'APPEL (Page Dédiée) --- */}
              {activeTab === 'notes' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">

                  {/* BOUTON AJOUTER NOTE */}
                  {!isAddingNote ? (
                    <button
                      onClick={() => setIsAddingNote(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.03] py-3 text-sm font-medium text-white/40 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all"
                    >
                      <Plus className="h-4 w-4" /> {lang === 'fr' ? 'Ajouter une note manuelle' : 'Add a manual note'}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in-95">
                      <h4 className="text-xs font-semibold text-white/40 mb-2 uppercase tracking-wider">{lang === 'fr' ? 'Nouvelle Note' : 'New Note'}</h4>
                      <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder={lang === 'fr' ? "Écrivez votre note d'appel ici..." : "Write your call note here..."}
                        className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500 min-h-[100px] mb-3"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setIsAddingNote(false); setNewNoteContent(''); }}
                          className="px-4 py-2 text-sm font-medium text-white/40 hover:text-white transition-colors"
                        >
                          {lang === 'fr' ? 'Annuler' : 'Cancel'}
                        </button>
                        <button
                          onClick={handleAddManualNote}
                          disabled={!newNoteContent.trim()}
                          className="px-4 py-2 rounded-lg bg-purple-600 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition-all shadow-lg shadow-purple-900/20"
                        >
                          {lang === 'fr' ? 'Enregistrer' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-white/[0.08] my-4" />

                  {/* LISTE DES NOTES */}
                  <div className="space-y-3">
                    {localProspect.callNotes && localProspect.callNotes.length > 0 ? (
                      localProspect.callNotes.map((note) => (
                        <details key={note.id} className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] open:bg-white/[0.05] transition-all overflow-hidden">
                          <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-white/[0.03] transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/40 group-open:bg-purple-500/20 group-open:text-purple-400 transition-colors">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-white">
                                  {new Date(note.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  <span>{new Date(note.date).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                  {note.author && (
                                    <>
                                      <span>•</span>
                                      <span className="uppercase tracking-wider">{note.author}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleDeleteNote(note.id)
                                }}
                                className="rounded p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                title={lang === 'fr' ? "Supprimer la note" : "Delete note"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <ChevronDown className="h-5 w-5 text-white/40 transition-transform duration-300 group-open:rotate-180" />
                            </div>
                          </summary>

                          <div className="border-t border-white/[0.08] p-4 pt-2">
                            <div className="prose prose-invert prose-sm max-w-none">
                              <p className="text-white/60 whitespace-pre-wrap leading-relaxed">
                                {note.content}
                              </p>
                            </div>
                          </div>
                        </details>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.03]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 mb-3">
                          <ClipboardList className="h-6 w-6 text-white/40" />
                        </div>
                        <p className="text-sm font-medium text-white/40">{lang === 'fr' ? "Aucune note d'appel" : 'No call notes'}</p>
                        <p className="text-xs text-white/40 mt-1 max-w-[200px]">
                          {lang === 'fr' ? "L'historique de vos appels et vos notes manuelles apparaîtront ici." : 'Your call history and manual notes will appear here.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- ONGLET 3: RAPPELS --- */}
              {activeTab === 'rappels' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Bouton ajouter */}
                  <button
                    onClick={() => setShowReminderForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-orange-500/30 bg-orange-500/5 py-3 text-sm font-medium text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all"
                  >
                    <Plus className="h-4 w-4" /> {lang === 'fr' ? 'Ajouter un rappel' : 'Add a reminder'}
                  </button>

                  {remindersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                    </div>
                  ) : prospectReminders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.03]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 mb-3">
                        <Bell className="h-6 w-6 text-white/40" />
                      </div>
                      <p className="text-sm font-medium text-white/40">{lang === 'fr' ? 'Aucun rappel' : 'No reminders'}</p>
                      <p className="text-xs text-white/40 mt-1">
                        {lang === 'fr' ? 'Créez un rappel pour ce prospect.' : 'Create a reminder for this prospect.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {prospectReminders.map((reminder) => {
                        const isDone = reminder.is_done
                        const isOverdue = !isDone && new Date(reminder.reminder_date) < new Date()
                        const isLoading = reminderActionLoading === reminder.id
                        const isExpanded = expandedReminderId === reminder.id

                        return (
                          <div
                            key={reminder.id}
                            onClick={() => setExpandedReminderId(isExpanded ? null : reminder.id)}
                            className={cn(
                              'rounded-lg border p-3 transition-all cursor-pointer',
                              isDone
                                ? 'border-white/[0.08] bg-white/[0.03]'
                                : isOverdue
                                  ? 'border-red-500/30 bg-red-500/5'
                                  : 'border-white/[0.08] bg-white/[0.03]',
                              isExpanded && 'ring-1 ring-orange-500/30'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  'text-sm font-semibold',
                                  isDone ? 'text-white/40 line-through' : 'text-white'
                                )}>
                                  {reminder.title}
                                </p>
                                
                                <div className={cn(
                                  "grid transition-all duration-300 ease-in-out",
                                  isExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
                                )}>
                                  <div className="overflow-hidden">
                                     {reminder.description && (
                                      <p className="text-xs text-white/60 whitespace-pre-wrap leading-relaxed mb-2">
                                        {reminder.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 py-1 px-2 rounded bg-white/[0.03] w-fit">
                                      <Clock className="h-3 w-3 text-white/40" />
                                      <span className={cn(
                                        'text-xs',
                                        isOverdue ? 'text-red-400 font-medium' : 'text-white/40'
                                      )}>
                                        {new Date(reminder.reminder_date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                                          weekday: 'long',
                                          day: 'numeric',
                                          month: 'long',
                                        })}{' '}
                                        {lang === 'fr' ? 'à' : 'at'}{' '}
                                        {new Date(reminder.reminder_date).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {!isExpanded && (
                                  <div className="flex items-center gap-2 mt-1.5 opacity-60">
                                    <Clock className="h-3 w-3 text-white/40" />
                                    <span className="text-[10px] text-white/40">
                                      {new Date(reminder.reminder_date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                                        day: 'numeric',
                                        month: 'short',
                                      })} {lang === 'fr' ? 'à' : 'at'} {new Date(reminder.reminder_date).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {!isDone && (
                                  <button
                                    onClick={() => handleMarkReminderDone(reminder.id)}
                                    disabled={isLoading}
                                    className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                                    title={lang === 'fr' ? "Marquer comme fait" : "Mark as done"}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteReminder(reminder.id)}
                                  disabled={isLoading}
                                  className="rounded-md p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                  title={lang === 'fr' ? "Supprimer" : "Delete"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <ChevronDown className={cn(
                                  "h-4 w-4 text-white/40 transition-transform duration-300",
                                  isExpanded && "rotate-180 text-orange-500"
                                )} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* --- ONGLET 4: HISTORIQUE --- */}
              {activeTab === 'historique' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-right-4 duration-300">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                    </div>
                  ) : historyGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.03]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 mb-3">
                        <Clock className="h-6 w-6 text-white/40" />
                      </div>
                      <p className="text-sm font-medium text-white/40">{lang === 'fr' ? 'Aucun historique' : 'No history'}</p>
                      <p className="text-xs text-white/40 mt-1">{lang === 'fr' ? 'Les modifications apparaîtront ici.' : 'Changes will appear here.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {historyGroups.map((group, gIdx) => {
                        const isExpanded = expandedHistory.has(group.key)
                        const isLast = gIdx === historyGroups.length - 1
                        const date = new Date(group.created_at)
                        const timeStr = date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) + (lang === 'fr' ? ' à ' : ' at ') + date.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })

                        const CHANGE_STYLES: Record<string, { icon: typeof Plus; bg: string; text: string }> = {
                          created: { icon: Plus, bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
                          stage_change: { icon: Tag, bg: 'bg-purple-500/10', text: 'text-purple-400' },
                          field_update: { icon: Pencil, bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
                        }
                        const style = CHANGE_STYLES[group.type] || CHANGE_STYLES.field_update
                        const IconComponent = style.icon

                        let title = ''
                        if (group.type === 'created') {
                          title = lang === 'fr' ? 'Création du prospect' : 'Prospect created'
                        } else if (group.type === 'stage_change') {
                          const stageEntry = group.entries.find((e: any) => e.change_type === 'stage_change')
                          title = stageEntry ? (lang === 'fr' ? `Étape → ${formatHistoryValue('stage', stageEntry.new_value)}` : `Stage → ${formatHistoryValue('stage', stageEntry.new_value)}`) : (lang === 'fr' ? "Changement d'étape" : 'Stage change')
                        } else {
                          const count = group.entries.length
                          title = count === 1
                            ? (lang === 'fr' ? `${FIELD_LABELS[group.entries[0].field_name] || group.entries[0].field_name} modifié` : `${FIELD_LABELS[group.entries[0].field_name] || group.entries[0].field_name} modified`)
                            : (lang === 'fr' ? `${count} champs modifiés` : `${count} fields modified`)
                        }

                        return (
                          <div key={group.key}>
                            <button
                              onClick={() => setExpandedHistory(prev => {
                                const next = new Set(prev)
                                next.has(group.key) ? next.delete(group.key) : next.add(group.key)
                                return next
                              })}
                              className="w-full text-left rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn('p-1.5 rounded-lg shrink-0', style.bg)}>
                                  <IconComponent className={cn('h-3.5 w-3.5', style.text)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{title}</p>
                                  <p className="text-[10px] text-white/40">{timeStr}</p>
                                </div>
                                <ChevronDown className={cn('h-4 w-4 text-white/40 transition-transform shrink-0', isExpanded && 'rotate-180')} />
                              </div>

                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-white/[0.08]">
                                  <div className="space-y-2">
                                    {group.entries.map((entry: any) => {
                                      const fieldLabel = FIELD_LABELS[entry.field_name] || entry.field_name
                                      const oldDisplay = formatHistoryValue(entry.field_name, entry.old_value)
                                      const newDisplay = formatHistoryValue(entry.field_name, entry.new_value)
                                      return (
                                        <div key={entry.id} className="flex items-start gap-2">
                                          <span className="text-[10px] font-bold text-white/40 w-24 shrink-0 pt-0.5 truncate">{fieldLabel}</span>
                                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                            {entry.old_value && (
                                              <>
                                                <span className="text-xs text-white/40 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 line-through truncate max-w-[140px]">
                                                  {oldDisplay}
                                                </span>
                                                <span className="text-[10px] text-white/40">→</span>
                                              </>
                                            )}
                                            <span className="text-xs text-white bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-medium truncate max-w-[140px]">
                                              {newDisplay}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </button>

                            {!isLast && (
                              <div className="flex justify-center py-1">
                                <div className="flex flex-col items-center">
                                  <div className="w-px h-2 bg-white/[0.08]" />
                                  <ChevronDown className="h-3 w-3 text-white/20 -my-0.5" />
                                  <div className="w-px h-2 bg-white/[0.08]" />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Reminder Creation Modal */}
            {showReminderForm && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReminderForm(false)} />
                <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3">
                    <h3 className="text-sm font-bold text-white">{lang === 'fr' ? 'Nouveau rappel' : 'New reminder'}</h3>
                    <button onClick={() => setShowReminderForm(false)} className="rounded-lg p-1 text-white/40 hover:bg-white/5 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/40">{lang === 'fr' ? 'Titre' : 'Title'} *</label>
                      <input
                        type="text"
                        value={reminderTitle}
                        onChange={(e) => setReminderTitle(e.target.value)}
                        placeholder={lang === 'fr' ? "Ex: Rappeler le prospect" : "E.g.: Call back the prospect"}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-orange-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/40">{lang === 'fr' ? 'Description' : 'Description'}</label>
                      <textarea
                        value={reminderDesc}
                        onChange={(e) => setReminderDesc(e.target.value)}
                        placeholder={lang === 'fr' ? "Détails optionnels..." : "Optional details..."}
                        rows={2}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-orange-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-white/40">{lang === 'fr' ? 'Date' : 'Date'} *</label>
                        <input
                          type="date"
                          value={reminderDate}
                          onChange={(e) => setReminderDate(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-white/40">{lang === 'fr' ? 'Heure' : 'Time'} *</label>
                        <input
                          type="time"
                          value={reminderTime}
                          onChange={(e) => setReminderTime(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2">
                      <p className="text-xs text-orange-400">
                        <Bell className="h-3 w-3 inline mr-1" />
                        {lang === 'fr' ? 'Lié à' : 'Linked to'} : <span className="font-semibold">{localProspect.contact || (lang === 'fr' ? 'Ce prospect' : 'This prospect')}</span>
                      </p>
                    </div>
                    <button
                      onClick={handleCreateReminder}
                      disabled={!reminderTitle.trim() || !reminderDate || !reminderTime || reminderSubmitting}
                      className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reminderSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : (
                        lang === 'fr' ? 'Créer le rappel' : 'Create reminder'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-white/[0.08] bg-[#111111] p-6 space-y-3">
              <button
                onClick={async () => {
                  if (!user) return
                  try {
                    if (isDismissed) {
                      await supabase.from('pipeline_dismissals').delete().eq('user_id', user.id).eq('prospect_id', prospect.id)
                      toast.success(lang === 'fr' ? 'Prospect rajouté au pipeline' : 'Prospect added back to pipeline')
                      setIsDismissed(false)
                      onDismissFromPipeline?.(prospect.id, false)
                    } else {
                      await supabase.from('pipeline_dismissals').upsert({ user_id: user.id, prospect_id: prospect.id }, { onConflict: 'user_id,prospect_id' })
                      toast.success(lang === 'fr' ? 'Prospect retiré du pipeline — il reste dans vos contacts' : 'Prospect removed from pipeline — it remains in your contacts')
                      setIsDismissed(true)
                      onDismissFromPipeline?.(prospect.id, true)
                      onClose()
                    }
                  } catch { toast.error(lang === 'fr' ? 'Erreur' : 'Error') }
                }}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all",
                  isDismissed
                    ? "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                {isDismissed ? (
                  <><Plus className="h-4 w-4" /> {lang === 'fr' ? 'Rajouter au pipeline' : 'Add back to pipeline'}</>
                ) : (
                  <><X className="h-4 w-4" /> {lang === 'fr' ? 'Retirer du pipeline' : 'Remove from pipeline'}</>
                )}
              </button>
              <button onClick={handleDeleteProspect} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" /> {lang === 'fr' ? 'Supprimer le prospect' : 'Delete prospect'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}