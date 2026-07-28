import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useContactedReminders, computeRelanceBadge, relanceLabel } from '../hooks/useContactedReminders'
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
  Copy,
  RefreshCw,
  Loader2,
  Building2,
  Settings2,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { InstallmentScheduleEditor, type ScheduleEntry } from './InstallmentScheduleEditor'
import { CreateEventModal } from './CreateEventModal'
import PhoneInput from './PhoneInput'
import { MaskedText } from '../components/MaskedText'
import { type Prospect } from '../contexts/ProspectsContext'
import { useMeetings } from '../contexts/MeetingsContext'
import { useOffers, type Offer } from '../contexts/OffersContext'
import { useAuth } from '../contexts/AuthContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { useTags } from '../hooks/useTags'
import { useProspectTasks } from '../hooks/useProspectTasks'
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
  const { delays: relanceDelays } = useContactedReminders()
  const [discussionOui, setDiscussionOui] = useState(false)
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
  const [nextAppointment, setNextAppointment] = useState<{ id?: string; date: string; time: string } | null>(null)

  // Inline name edit (header)
  const [editingName, setEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  // RDV reschedule / cancel
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rdvBusy, setRdvBusy] = useState(false)
  const [nextApptRefresh, setNextApptRefresh] = useState(0)

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

  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'taches' | 'rappels' | 'historique'>('info')

  // Tâches / to-do du prospect
  const { tasks, loading: tasksLoading, addTask, toggleTask, deleteTask, openCount: openTasksCount } = useProspectTasks(prospect.id)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  const [editingOffer, setEditingOffer] = useState(false)
  const [editedOfferId, setEditedOfferId] = useState('')
  const [editedFormulaId, setEditedFormulaId] = useState(prospect.formula_id || '') // ✅ INIT AVEC LA FORMULE
  const [editedOfferName, setEditedOfferName] = useState(prospect.offer || '')
  const [editedValue, setEditedValue] = useState(prospect.value || 0)

  const [editingPayment, setEditingPayment] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'cash' | 'installments'>('cash')
  const [installments, setInstallments] = useState(1)
  const [commissionRate, setCommissionRate] = useState(10)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Custom commission + custom installment schedule (édition fiche)
  const [editCustomCommissionEnabled, setEditCustomCommissionEnabled] = useState(false)
  const [editCustomCommissionRate, setEditCustomCommissionRate] = useState<number>(0)
  const [editScheduleMode, setEditScheduleMode] = useState<'equal' | 'custom'>('equal')
  const [editCustomSchedule, setEditCustomSchedule] = useState<ScheduleEntry[]>([])

  // Acompte (deposit) — édition fiche
  const [editDepositAmount, setEditDepositAmount] = useState<number>(0)
  const [editDepositToRefund, setEditDepositToRefund] = useState<boolean>(false)
  const [editDepositDate, setEditDepositDate] = useState<string>('')

  // Popup RDV ouvert auto au passage en follow-up
  const [showFollowupRdv, setShowFollowupRdv] = useState(false)

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

    // Hydrate acompte
    const depAmount = (loadedProspect as any).deposit_amount
    const depRefund = (loadedProspect as any).deposit_to_refund
    const depDate = (loadedProspect as any).deposit_date
    setEditDepositAmount(depAmount != null ? Number(depAmount) : 0)
    setEditDepositToRefund(!!depRefund)
    setEditDepositDate(depDate ? String(depDate).slice(0, 10) : '')

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
  const [reminderPreciseTime, setReminderPreciseTime] = useState(false)
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
    if (!user || !reminderTitle.trim() || !reminderDate) return
    if (reminderPreciseTime && !reminderTime) return
    setReminderSubmitting(true)
    try {
      // Sans heure précise : on stocke à 09:00 (aucun email). Avec : datetime exact + email 5 min avant.
      const reminder_date = new Date(`${reminderDate}T${reminderPreciseTime ? reminderTime : '09:00'}`).toISOString()
      const { data, error } = await supabase
        .from('reminders')
        .insert([{
          user_id: user.id,
          title: reminderTitle.trim(),
          description: reminderDesc.trim() || null,
          reminder_date,
          prospect_id: prospect.id,
          is_done: false,
          has_time: reminderPreciseTime,
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
      setReminderPreciseTime(false)
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
      .select('id, date, time')
      .eq('user_id', user.id)
      .eq('prospectId', prospect.id)
      .in('status', ['upcoming', 'scheduled'])
      .gte('date', nowIso)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setNextAppointment({ id: data[0].id, date: data[0].date, time: data[0].time?.slice(0, 5) })
        } else {
          setNextAppointment(null)
        }
      })
  }, [user?.id, prospect.id, nextApptRefresh])

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

  // --- Inline name edit (header) ---
  const handleSaveName = () => {
    const name = editedName.trim()
    if (!name) { setEditingName(false); return }
    const parts = name.split(' ')
    handleOptimisticUpdate({ contact: name, firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' })
    setEditingName(false)
  }

  // --- Copy to clipboard ---
  const copyToClipboard = (value: string | undefined | null, label: string) => {
    if (!value) return
    navigator.clipboard?.writeText(value).then(
      () => toast.success(lang === 'fr' ? `${label} copié` : `${label} copied`),
      () => toast.error(lang === 'fr' ? 'Copie impossible' : 'Copy failed')
    )
  }

  // --- RDV reschedule / cancel (with auto email to prospect) ---
  const sendRdvEmail = async (kind: 'reschedule' | 'cancel', date: string, time: string) => {
    if (!localProspect.email) return
    const isFr = lang === 'fr'
    const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const subject = kind === 'reschedule'
      ? (isFr ? 'Votre rendez-vous a été reprogrammé' : 'Your appointment has been rescheduled')
      : (isFr ? 'Votre rendez-vous a été annulé' : 'Your appointment has been cancelled')
    const intro = kind === 'reschedule'
      ? (isFr ? `Votre rendez-vous a été déplacé au <strong>${dateLabel} à ${time}</strong>.` : `Your appointment has been moved to <strong>${dateLabel} at ${time}</strong>.`)
      : (isFr ? `Votre rendez-vous du <strong>${dateLabel} à ${time}</strong> a été annulé.` : `Your appointment on <strong>${dateLabel} at ${time}</strong> has been cancelled.`)
    const hello = isFr ? `Bonjour ${localProspect.contact || ''},` : `Hi ${localProspect.contact || ''},`
    const outro = kind === 'reschedule'
      ? (isFr ? 'Au plaisir de vous voir.' : 'Looking forward to seeing you.')
      : (isFr ? "N'hésitez pas à reprendre rendez-vous quand vous le souhaitez." : 'Feel free to book again whenever you like.')
    const htmlContent = `<div style="font-family:Arial,sans-serif;color:#1e293b;font-size:15px;line-height:1.6;max-width:520px"><p>${hello}</p><p>${intro}</p><p>${outro}</p><p style="color:#64748b;font-size:13px;margin-top:24px">CloseOS</p></div>`
    try {
      await fetch('/api/email?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: { email: 'support@closeos.fr', name: 'CloseOS' }, to: [{ email: localProspect.email }], subject, htmlContent }),
      })
    } catch { /* best-effort */ }
  }

  const handleRescheduleRdv = async () => {
    if (!nextAppointment?.id || !rescheduleDate || !rescheduleTime) return
    setRdvBusy(true)
    try {
      const { error } = await supabase.from('meetings').update({ date: rescheduleDate, time: rescheduleTime }).eq('id', nextAppointment.id)
      if (error) throw error
      await sendRdvEmail('reschedule', rescheduleDate, rescheduleTime)
      toast.success(lang === 'fr' ? 'RDV reprogrammé, email envoyé' : 'Appointment rescheduled, email sent')
      setShowReschedule(false)
      setNextApptRefresh(v => v + 1)
    } catch {
      toast.error(lang === 'fr' ? 'Échec de la reprogrammation' : 'Reschedule failed')
    } finally {
      setRdvBusy(false)
    }
  }

  const handleCancelRdv = async () => {
    if (!nextAppointment?.id) return
    if (!window.confirm(lang === 'fr' ? 'Annuler ce rendez-vous ? Un email sera envoyé au prospect.' : 'Cancel this appointment? An email will be sent to the prospect.')) return
    setRdvBusy(true)
    try {
      const { error } = await supabase.from('meetings').update({ status: 'cancelled' }).eq('id', nextAppointment.id)
      if (error) throw error
      await sendRdvEmail('cancel', nextAppointment.date, nextAppointment.time)
      toast.success(lang === 'fr' ? 'RDV annulé, email envoyé' : 'Appointment cancelled, email sent')
      setNextAppointment(null)
    } catch {
      toast.error(lang === 'fr' ? "Échec de l'annulation" : 'Cancel failed')
    } finally {
      setRdvBusy(false)
    }
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
    const hasDep = editDepositAmount > 0
    const depKept = hasDep && !editDepositToRefund
    const editCustomScheduleTotal = editCustomSchedule.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const editCustomEffective = editCustomScheduleTotal + (depKept ? editDepositAmount : 0)
    const effectiveValue = editScheduleMode === 'custom' ? editCustomEffective : editedValue

    // Validations bloquantes
    if (hasDep) {
      if (editDepositAmount < 0) {
        setErrorMessage(lang === 'fr' ? "L'acompte ne peut pas être négatif." : "Deposit cannot be negative.")
        return
      }
      if (editDepositAmount > effectiveValue) {
        setErrorMessage(lang === 'fr' ? "L'acompte ne peut pas dépasser le montant total." : "Deposit cannot exceed total amount.")
        return
      }
      if (!editDepositDate) {
        setErrorMessage(lang === 'fr' ? "La date de l'acompte est obligatoire." : "Deposit date is required.")
        return
      }
      if (depKept && paymentMode === 'installments' && installments < 2) {
        setErrorMessage(lang === 'fr' ? "Avec un acompte conservé, le nombre de mensualités doit être au moins 2." : "With a kept deposit, installments must be at least 2.")
        return
      }
    }
    setErrorMessage(null)

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
    // Acompte
    updates.deposit_amount = hasDep ? editDepositAmount : null
    updates.deposit_to_refund = hasDep ? editDepositToRefund : false
    updates.deposit_date = hasDep ? editDepositDate : null
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

  // Effective values with custom schedule + custom commission + acompte
  const hasEditDeposit = editDepositAmount > 0
  const editDepositKept = hasEditDeposit && !editDepositToRefund
  const editCustomScheduleTotal = editCustomSchedule.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const editCustomEffectiveTotal = editCustomScheduleTotal + (editDepositKept ? editDepositAmount : 0)
  const effectiveEditedValue = editScheduleMode === 'custom' ? editCustomEffectiveTotal : editedValue
  const standardCommissionRate = commissionRate
  const effectiveCommissionRate = editCustomCommissionEnabled ? editCustomCommissionRate : standardCommissionRate
  // Acompte conservé : N saisi = total versements (acompte inclus) → mensualités = (total - acompte) / (N - 1)
  const editRealInstallments = editDepositKept ? Math.max(1, installments - 1) : installments
  const editRemainingForInstallments = editDepositKept ? Math.max(0, effectiveEditedValue - editDepositAmount) : effectiveEditedValue
  const monthlyAmount = editRealInstallments > 0 ? editRemainingForInstallments / editRealInstallments : 0
  const commissionAmount = (effectiveEditedValue * effectiveCommissionRate) / 100

  const savedInstallments = localProspect.installments || 1
  const savedCommissionRate = (localProspect as any).custom_commission_rate != null
    ? Number((localProspect as any).custom_commission_rate)
    : commissionRate
  const savedCommission = (localProspect.value || 0) * (savedCommissionRate / 100)
  const savedSchedule = (localProspect as any).installments_schedule as ScheduleEntry[] | null | undefined
  const hasCustomSchedule = Array.isArray(savedSchedule) && savedSchedule.length > 0

  // Acompte saved values
  const savedDepositAmount = (localProspect as any).deposit_amount != null ? Number((localProspect as any).deposit_amount) : 0
  const savedDepositToRefund = !!(localProspect as any).deposit_to_refund
  const savedDepositDate = (localProspect as any).deposit_date as string | undefined
  const hasSavedDeposit = savedDepositAmount > 0
  const savedDepositKept = hasSavedDeposit && !savedDepositToRefund

  // Plan de paiement réel (mensualités hors acompte)
  // - Conservé : N saisi inclut l'acompte, donc plan = N-1 mensualités de (value - acompte)/(N-1)
  // - Remboursé ou pas d'acompte : N mensualités de value/N
  const planInstallmentsCount = savedDepositKept ? Math.max(1, savedInstallments - 1) : savedInstallments
  const planTotal = savedDepositKept ? Math.max(0, (localProspect.value || 0) - savedDepositAmount) : (localProspect.value || 0)
  const planCommission = savedDepositKept ? Math.max(0, savedCommission - (savedDepositAmount * savedCommissionRate) / 100) : savedCommission

  const scheduleBreakdown = hasCustomSchedule
    ? savedSchedule!.map((entry) => ({
        month: entry.month,
        clientAmount: Number(entry.amount) || 0,
        commission: ((Number(entry.amount) || 0) * savedCommissionRate) / 100,
      }))
    : Array.from({ length: planInstallmentsCount }, (_, i) => ({
        month: i + 1,
        clientAmount: planTotal / planInstallmentsCount,
        commission: planCommission / planInstallmentsCount,
      }))
  const savedMonthlyPayment = planTotal / planInstallmentsCount
  const savedMonthlyCommission = planCommission / planInstallmentsCount

  const isPayingInInstallments = localProspect.payment_type === 'installments' || (savedInstallments > 1);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] border-l border-slate-200 dark:border-white/10">

            {errorMessage && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </div>
            )}

            {/* Header Fixe */}
            <div className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-6 pt-6 pb-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative w-11 h-11 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center overflow-hidden text-lg font-extrabold text-slate-400 dark:text-neutral-500 group cursor-pointer shrink-0"
                    title={lang === 'fr' ? "Changer la photo" : "Change photo"}
                  >
                    {localProspect.avatar_url ? (
                      <img src={localProspect.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (localProspect.contact || '?')[0]?.toUpperCase()
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                      {avatarUploading ? (
                        <Loader2 className="h-4 w-4 text-slate-900 dark:text-white animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 text-slate-900 dark:text-white" />
                      )}
                    </div>
                    <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </button>
                  <div className="min-w-0">
                    {editingName ? (
                      <input
                        autoFocus
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                        className="w-full text-xl font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-white/5 border border-sky-500/40 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      />
                    ) : (
                      <h2
                        onClick={() => { setEditedName(localProspect.contact || ''); setEditingName(true) }}
                        title={lang === 'fr' ? 'Cliquer pour modifier' : 'Click to edit'}
                        className="group/name text-xl font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5 cursor-text"
                      >
                        <MaskedText value={localProspect.contact} type="name" />
                        <Pencil className="h-3.5 w-3.5 text-slate-300 dark:text-neutral-600 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
                      </h2>
                    )}
                    {localProspect.company && localProspect.company !== 'N/A' && (
                      <p className="mt-0.5 text-sm text-slate-400 dark:text-neutral-500 truncate">{localProspect.company}</p>
                    )}
                  </div>
                </div>
                <button onClick={onClose} className="rounded-lg p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 shrink-0">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tags */}
              <div className="relative flex flex-wrap items-center gap-1.5 mb-3">
                {getProspectTagObjects(localProspect.id).map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-slate-900 dark:text-white group/tag cursor-default"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                    <button
                      onClick={() => removeTagFromProspect(localProspect.id, tag.id)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-slate-100 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-200 dark:border-white/10 px-2 py-0.5 text-[11px] text-slate-400 dark:text-neutral-500 hover:border-slate-200 hover:text-slate-500 transition-colors"
                >
                  <Plus className="h-3 w-3" /> tag
                </button>
                {showTagPicker && (
                  <div className="absolute left-0 top-full mt-1.5 z-10 min-w-[200px] max-w-[300px] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)]">
                    <div className="max-h-48 overflow-y-auto p-1.5">
                      {tags.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Aucun tag. Créez-en dans Personnaliser.' : 'No tags. Create them in Customize.'}</p>
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
                                isAssigned ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100'
                              )}
                            >
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                              <span className="flex-1 text-left">{tag.name}</span>
                              {isAssigned && <Check className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />}
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
                <div className="mb-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">{lang === 'fr' ? 'Prochain rendez-vous' : 'Next appointment'}</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {new Date(nextAppointment.date + 'T00:00:00').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                          weekday: 'short', day: 'numeric', month: 'long'
                        })} {lang === 'fr' ? 'à' : 'at'} {nextAppointment.time}
                      </p>
                    </div>
                    {nextAppointment.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setRescheduleDate(nextAppointment.date); setRescheduleTime(nextAppointment.time); setShowReschedule(v => !v) }}
                          title={lang === 'fr' ? 'Reprogrammer' : 'Reschedule'}
                          className="p-1.5 rounded-lg text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelRdv}
                          disabled={rdvBusy}
                          title={lang === 'fr' ? 'Annuler (email au prospect)' : 'Cancel (emails the prospect)'}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {showReschedule && nextAppointment.id && (
                    <div className="mt-3 pt-3 border-t border-sky-500/10 flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[110px]">
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase mb-1">Date</label>
                        <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500" />
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase mb-1">{lang === 'fr' ? 'Heure' : 'Time'}</label>
                        <input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500" />
                      </div>
                      <button onClick={handleRescheduleRdv} disabled={rdvBusy || !rescheduleDate || !rescheduleTime} className="flex items-center justify-center rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50">
                        {rdvBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === 'fr' ? 'Valider' : 'Save')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <button onClick={handleOpenGmail} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm font-medium text-slate-500 dark:text-neutral-400 transition-all hover:bg-slate-100 hover:text-slate-900">
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button onClick={handleOpenWhatsApp} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-600 dark:text-sky-400 transition-all hover:bg-sky-500/20 hover:text-sky-700">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </button>
                <button onClick={() => { if (onCreateEvent) onCreateEvent() }} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white transition-all hover:bg-sky-600 shadow-lg shadow-sky-500/20">
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
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white transition-all hover:bg-slate-100"
                >
                  <PhoneCall className="h-4 w-4" /> Call
                </button>
              </div>

              {/* Relance + Réponse (stage Contacté) */}
              {localProspect.stage === 'contacted' && (() => {
                const fr = lang === 'fr'
                const lp = localProspect as any
                const responded = !!lp.responded_at
                const nextTs = lp.discussion_next_at ? new Date(lp.discussion_next_at).getTime() : 0
                const promptReady = responded && Date.now() >= nextTs
                const badge = responded ? null : computeRelanceBadge(localProspect.contacted_at, lp.last_relance_at, relanceDelays, localProspect.relance_step)
                const relanceDateLabel = badge ? new Date(badge.dueAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : ''
                const plusOneDay = () => new Date(Date.now() + 86400000).toISOString()
                const clearResponse = { responded_at: null, discussion_next_at: null, discussion_email_sent: false } as any
                const hoursLeft = Math.max(0, Math.ceil((nextTs - Date.now()) / 3600000))
                const upd = (u: any) => handleOptimisticUpdate(u)
                const btnBase = 'flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all active:scale-95'
                return (
                  <div className="mb-6 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
                    {!responded && (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <Bell className="h-4 w-4 text-slate-500 dark:text-neutral-400" />
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {badge
                              ? relanceLabel(badge.number, fr) + (badge.due ? (fr ? ' · à faire' : ' · due') : (fr ? ` · le ${relanceDateLabel}` : ` · ${relanceDateLabel}`))
                              : (fr ? 'Premier contact' : 'First contact')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {relanceDelays.length > 0 && (
                            <button onClick={() => upd({ relance_step: (localProspect.relance_step || 0) + 1, last_relance_at: new Date().toISOString() })} className={`${btnBase} bg-orange-500 text-white hover:bg-orange-600`}>
                              <Check className="h-4 w-4" strokeWidth={2.5} /> {fr ? 'Relance faite' : 'Follow-up done'}
                            </button>
                          )}
                          <button onClick={() => upd({ responded_at: new Date().toISOString(), discussion_next_at: plusOneDay(), discussion_email_sent: false })} className={`${btnBase} bg-sky-600 text-white hover:bg-sky-500`}>
                            <MessageCircle className="h-4 w-4" /> {fr ? 'Répondu' : 'Replied'}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-2.5">
                          {fr ? '« Répondu » compte dans le taux de réponse et met les relances en pause.' : '"Replied" counts toward the response rate and pauses follow-ups.'}
                        </p>
                      </>
                    )}

                    {responded && !promptReady && (
                      <div className="space-y-1.5">
                        <p className="text-sm font-bold text-sky-600 dark:text-sky-400">{fr ? 'En discussion — relances en pause' : 'In discussion — follow-ups paused'}</p>
                        <p className="text-xs text-slate-500 dark:text-neutral-400">{fr ? `Point de statut dans ${hoursLeft} h.` : `Status check in ${hoursLeft} h.`}</p>
                        <button onClick={() => { upd(clearResponse); setDiscussionOui(false) }} className="text-xs text-slate-400 dark:text-neutral-500 underline underline-offset-2 hover:text-slate-700">
                          {fr ? 'Reprendre les relances maintenant' : 'Resume follow-ups now'}
                        </button>
                      </div>
                    )}

                    {promptReady && !discussionOui && (
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{fr ? 'Toujours en discussion avec ce prospect ?' : 'Still in discussion with this prospect?'}</p>
                        <div className="flex gap-2">
                          <button onClick={() => { upd(clearResponse); setDiscussionOui(false) }} className={`${btnBase} bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-200 hover:bg-slate-100`}>
                            {fr ? 'Non, relancer' : 'No, follow up'}
                          </button>
                          <button onClick={() => setDiscussionOui(true)} className={`${btnBase} bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90`}>
                            {fr ? 'Oui' : 'Yes'}
                          </button>
                        </div>
                      </div>
                    )}

                    {promptReady && discussionOui && (
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{fr ? 'Résultat de la discussion' : 'Discussion outcome'}</p>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => { upd({ stage: 'qualified', ...clearResponse }); setDiscussionOui(false) }} className={`${btnBase} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20`}>
                            <Check className="h-4 w-4" strokeWidth={2} /> {fr ? 'Qualifié' : 'Qualified'}
                          </button>
                          <button onClick={() => { upd({ stage: 'unqualified', ...clearResponse }); setDiscussionOui(false) }} className={`${btnBase} bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20`}>
                            <X className="h-4 w-4" strokeWidth={2} /> {fr ? 'Disqualifié' : 'Disqualified'}
                          </button>
                          <button onClick={() => { upd({ discussion_next_at: plusOneDay(), discussion_email_sent: false }); setDiscussionOui(false) }} className={`${btnBase} bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 hover:bg-slate-100`}>
                            {fr ? 'Encore inconnu' : 'Still unknown'}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-neutral-500">{fr ? '« Encore inconnu » relance un point de statut dans 1 jour.' : '"Still unknown" schedules another status check in 1 day.'}</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* TABS */}
              <div className="flex border-b border-slate-200 dark:border-white/10">
                <button
                  onClick={() => setActiveTab('info')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative",
                    activeTab === 'info' ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-neutral-500 hover:text-slate-900"
                  )}
                >
                  {lang === 'fr' ? 'Informations' : 'Info'}
                  {activeTab === 'info' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative",
                    activeTab === 'notes' ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-neutral-500 hover:text-slate-900"
                  )}
                >
                  {lang === 'fr' ? "Notes d'Appel" : 'Call Notes'}
                  {activeTab === 'notes' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('taches')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative flex items-center justify-center gap-1.5",
                    activeTab === 'taches' ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-neutral-500 hover:text-slate-900"
                  )}
                >
                  {lang === 'fr' ? 'Tâches' : 'Tasks'}
                  {openTasksCount > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500/20 px-1.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                      {openTasksCount}
                    </span>
                  )}
                  {activeTab === 'taches' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('rappels')}
                  className={cn(
                    "flex-1 pb-3 text-sm font-medium transition-all relative flex items-center justify-center gap-1.5",
                    activeTab === 'rappels' ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-neutral-500 hover:text-slate-900"
                  )}
                >
                  {lang === 'fr' ? 'Rappels' : 'Reminders'}
                  {activeRemindersCount > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500/20 px-1.5 text-[10px] font-bold text-orange-600">
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
                    activeTab === 'historique' ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-neutral-500 hover:text-slate-900"
                  )}
                >
                  {lang === 'fr' ? 'Historique' : 'History'}
                  {activeTab === 'historique' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600" />
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
                    <label className="mb-2 block text-xs font-medium text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Étape actuelle' : 'Current stage'}</label>
                    <select
                      value={localProspect.stage}
                      onChange={(e) => {
                        const newStage = e.target.value
                        const wasFollowup = localProspect.stage === 'followup'
                        handleOptimisticUpdate({ stage: newStage })
                        if (newStage === 'followup' && !wasFollowup) {
                          setShowFollowupRdv(true)
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
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
                        <h3 className="flex items-center gap-2 text-sm font-bold text-sky-600 dark:text-sky-400">
                          <CreditCard className="h-4 w-4" /> {lang === 'fr' ? 'Détails du Paiement' : 'Payment Details'}
                        </h3>
                        <button onClick={() => setEditingPayment(!editingPayment)} className="rounded p-1 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {editingPayment ? (
                        <div className="space-y-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                          <div>
                            <label className="text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Montant final (€)' : 'Final amount (€)'}</label>
                            <input
                              type="number"
                              value={editScheduleMode === 'custom' ? effectiveEditedValue : editedValue}
                              onChange={(e) => setEditedValue(parseFloat(e.target.value) || 0)}
                              readOnly={editScheduleMode === 'custom'}
                              className={cn("mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none", editScheduleMode === 'custom' && 'opacity-60 cursor-not-allowed')}
                            />
                            {editScheduleMode === 'custom' && (
                              <p className="mt-1.5 text-[10px] text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Montant calculé depuis l\'échéancier' : 'Amount calculated from schedule'}</p>
                            )}
                          </div>
                          <div className="flex rounded-lg bg-slate-50 dark:bg-white/5 p-1">
                            <button type="button" onClick={() => { setPaymentMode('cash'); setInstallments(1); setEditScheduleMode('equal'); }} className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition-all", paymentMode === 'cash' ? "bg-sky-600 text-white shadow" : "text-slate-400 dark:text-neutral-500 hover:text-slate-900")}>{lang === 'fr' ? 'Comptant' : 'Cash'}</button>
                            <button type="button" onClick={() => {
                              setPaymentMode('installments')
                              const savedSchedule = (localProspect as any).installments_schedule
                              const savedCount = localProspect.installments || 0
                              if (Array.isArray(savedSchedule) && savedSchedule.length > 0) {
                                setEditScheduleMode('custom')
                                setEditCustomSchedule(savedSchedule)
                                setInstallments(savedSchedule.length)
                              } else if (savedCount > 1) {
                                setEditScheduleMode('equal')
                                setInstallments(savedCount)
                              } else if (installments < 2) {
                                setEditScheduleMode('equal')
                                setInstallments(2)
                              }
                            }} className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition-all", paymentMode === 'installments' ? "bg-sky-600 text-white shadow" : "text-slate-400 dark:text-neutral-500 hover:text-slate-900")}>{lang === 'fr' ? 'Plusieurs fois' : 'Installments'}</button>
                          </div>
                          {paymentMode === 'installments' && (
                            <div className="animate-in fade-in slide-in-from-top-1 space-y-3">
                              <label className="text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Nombre de mensualités' : 'Number of installments'}</label>
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
                                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                              >
                                <option value="custom">{lang === 'fr' ? 'Autre (montants personnalisés)' : 'Other (custom amounts)'}</option>
                                {[2, 3, 4, 5, 6, 10, 12].map(n => <option key={n} value={n}>{n} {lang === 'fr' ? 'fois' : 'times'} ({(editedValue / n).toFixed(2)}€/{lang === 'fr' ? 'mois' : 'mo'})</option>)}
                              </select>
                              {editScheduleMode === 'custom' && (
                                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
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

                          {/* Acompte */}
                          <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-900 dark:text-white flex items-center gap-1">
                                <Wallet className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                                {lang === 'fr' ? 'Acompte' : 'Deposit'}
                                <span className="ml-1 font-normal text-slate-400 dark:text-neutral-500">({lang === 'fr' ? 'optionnel' : 'optional'})</span>
                              </span>
                              {hasEditDeposit && (
                                <button
                                  type="button"
                                  onClick={() => { setEditDepositAmount(0); setEditDepositToRefund(false); setEditDepositDate('') }}
                                  className="text-[10px] text-slate-400 dark:text-neutral-500 hover:text-slate-600 underline underline-offset-2"
                                >
                                  {lang === 'fr' ? 'Retirer' : 'Remove'}
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Montant (€)' : 'Amount (€)'}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editDepositAmount || ''}
                                  onChange={(e) => setEditDepositAmount(parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-2 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 dark:text-neutral-500">
                                  {lang === 'fr' ? 'Date' : 'Date'}
                                  {hasEditDeposit && <span className="text-red-600 ml-0.5">*</span>}
                                </label>
                                <input
                                  type="date"
                                  value={editDepositDate}
                                  onChange={(e) => setEditDepositDate(e.target.value)}
                                  disabled={!hasEditDeposit}
                                  className={cn(
                                    "mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none",
                                    !hasEditDeposit && "opacity-40 cursor-not-allowed"
                                  )}
                                />
                              </div>
                            </div>
                            {hasEditDeposit && (
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editDepositToRefund}
                                  onChange={(e) => setEditDepositToRefund(e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 text-sky-600 dark:text-sky-400 focus:ring-sky-500 focus:ring-offset-0"
                                />
                                <span className="text-xs text-slate-900 dark:text-white">
                                  {lang === 'fr' ? 'Acompte à rembourser' : 'Deposit to refund'}
                                </span>
                              </label>
                            )}
                          </div>

                          <div className="rounded-lg bg-sky-500/10 p-3 border border-sky-500/20 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-sky-600 dark:text-sky-400 flex items-center gap-1"><Wallet className="h-3 w-3" /> {lang === 'fr' ? 'Ta Commission' : 'Your Commission'} ({effectiveCommissionRate}%)</span>
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
                                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-600'
                                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-neutral-400 hover:border-amber-500/40 hover:text-amber-600'
                                  )}
                                >
                                  <Settings2 className="h-2.5 w-2.5" />
                                  {editCustomCommissionEnabled
                                    ? (lang === 'fr' ? 'Revenir au standard' : 'Revert to standard')
                                    : (lang === 'fr' ? 'Commission inhabituelle' : 'Unusual commission')}
                                </button>
                                <span className="text-lg font-bold text-sky-600 dark:text-sky-400">{commissionAmount.toFixed(2)}€</span>
                              </div>
                            </div>
                            {editCustomCommissionEnabled && (
                              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
                                <label className="text-[10px] font-bold text-amber-600 mb-1 block">
                                  {lang === 'fr' ? 'Taux personnalisé' : 'Custom rate'} <span className="font-normal text-slate-400 dark:text-neutral-500">(standard : {standardCommissionRate}%)</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type="number" min="0" max="100" step="0.1"
                                    value={editCustomCommissionRate || ''}
                                    onChange={(e) => setEditCustomCommissionRate(parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-amber-500/40 bg-slate-100 dark:bg-white/10 px-3 py-2 pr-7 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 text-xs">%</span>
                                </div>
                              </div>
                            )}
                            {paymentMode === 'installments' && editScheduleMode === 'equal' && (
                              <p className="mt-1 text-[10px] text-sky-700/70">
                                {lang === 'fr' ? 'Tu recevras' : "You'll receive"} : {(commissionAmount / installments).toFixed(2)}€ / {lang === 'fr' ? 'mois' : 'mo'}
                              </p>
                            )}
                          </div>
                          <button onClick={handleSavePayment} className="w-full rounded-lg bg-sky-600 py-2 text-sm font-bold text-white hover:bg-sky-600">{lang === 'fr' ? 'Valider les détails' : 'Confirm details'}</button>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Montant Vente' : 'Sale Amount'}</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{(localProspect.value || 0).toLocaleString()}€</span>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Commission Totale' : 'Total Commission'} ({savedCommissionRate}%)</span>
                            <span className="text-sm font-bold text-sky-600 dark:text-sky-400">+{savedCommission.toFixed(2)}€</span>
                          </div>

                          {hasSavedDeposit && (
                            <div className="mt-2 pt-2 border-t border-sky-500/20 flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Wallet className="h-3 w-3 text-sky-600 dark:text-sky-400 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs text-slate-500 dark:text-neutral-400 truncate">
                                    {lang === 'fr' ? 'Acompte' : 'Deposit'}
                                    {savedDepositDate && (
                                      <span className="ml-1 text-slate-400 dark:text-neutral-500">
                                        ({new Date(savedDepositDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')})
                                      </span>
                                    )}
                                  </span>
                                  {savedDepositToRefund && (
                                    <span className="text-[10px] font-medium text-amber-600">
                                      {lang === 'fr' ? 'À rembourser' : 'To refund'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-sm font-bold text-slate-900 dark:text-white shrink-0">{savedDepositAmount.toFixed(2)}€</span>
                            </div>
                          )}

                          {isPayingInInstallments && (
                            <div className="mt-3 pt-3 border-t border-sky-500/20 space-y-2">
                              <button
                                type="button"
                                onClick={() => setShowScheduleModal(true)}
                                className="group flex w-full justify-between items-center rounded-md -mx-1 px-1 py-0.5 hover:bg-slate-50 transition-colors"
                              >
                                <span className="text-xs text-slate-500 dark:text-neutral-400">{lang === 'fr' ? `Client paie (x${savedInstallments})` : `Client pays (x${savedInstallments})`} :</span>
                                <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-white">
                                  {hasCustomSchedule ? (lang === 'fr' ? 'Voir détail' : 'View detail') : `${savedMonthlyPayment.toFixed(2)}€ / ${lang === 'fr' ? 'mois' : 'mo'}`}
                                  <ChevronRight className="h-3 w-3 text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 transition-colors" />
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowScheduleModal(true)}
                                className="group flex w-full justify-between items-center rounded-md -mx-1 px-1 py-0.5 hover:bg-sky-500/[0.06] transition-colors"
                              >
                                <span className="text-xs text-sky-600/80">{lang === 'fr' ? 'Tu reçois' : 'You receive'} :</span>
                                <span className="flex items-center gap-1 text-sm font-bold text-sky-600 dark:text-sky-400">
                                  {hasCustomSchedule ? (lang === 'fr' ? 'Voir détail' : 'View detail') : `${savedMonthlyCommission.toFixed(2)}€ / ${lang === 'fr' ? 'mois' : 'mo'}`}
                                  <ChevronRight className="h-3 w-3 text-sky-600/50 group-hover:text-sky-600/80 transition-colors" />
                                </span>
                              </button>
                            </div>
                          )}

                          <div className="pt-2 border-t border-sky-500/20 text-center mt-2">
                            <span className="text-[10px] font-medium text-sky-700/60 uppercase tracking-wider">
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
                      <h3 className="flex items-center gap-2 text-sm font-bold text-red-600 mb-3">
                        <X className="h-4 w-4" /> {lang === 'fr' ? 'Raison de la perte' : 'Loss reason'}
                      </h3>
                      <div className="space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                        <div>
                          <label className="text-xs font-medium text-slate-400 dark:text-neutral-500 mb-1.5 block">{lang === 'fr' ? 'Motif' : 'Reason'}</label>
                          <div className="relative">
                            <select
                              value={localProspect.loss_reason || ''}
                              onChange={(e) => {
                                handleOptimisticUpdate({ loss_reason: e.target.value } as any)
                              }}
                              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-red-500 focus:outline-none appearance-none"
                            >
                              <option value="">{lang === 'fr' ? 'Sélectionnez un motif' : 'Select a reason'}</option>
                              {LOSS_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-slate-400 dark:text-neutral-500" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-400 dark:text-neutral-500 mb-1.5 block">{lang === 'fr' ? 'Détails' : 'Details'}</label>
                          <input
                            type="text"
                            value={localProspect.loss_details || ''}
                            onChange={(e) => handleOptimisticUpdate({ loss_details: e.target.value } as any)}
                            placeholder={lang === 'fr' ? "Précisez les détails..." : "Specify details..."}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Infos Offre */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{lang === 'fr' ? 'Infos Offre' : 'Offer Info'}</h3>
                      <button onClick={() => setEditingOffer(!editingOffer)} className="rounded p-1 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingOffer ? (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-2 block text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Sélectionner une offre' : 'Select an offer'}</label>
                          <select
                            value={editedOfferId}
                            onChange={(e) => handleOfferChange(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
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
                            <label className="mb-2 flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400">
                              <Tag className="h-3 w-3" /> {lang === 'fr' ? 'Choix de la formule' : 'Formula selection'}
                            </label>
                            <select
                              value={editedFormulaId}
                              onChange={(e) => handleFormulaChange(e.target.value)}
                              className="w-full rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
                            >
                              <option value="">{lang === 'fr' ? '-- Sélectionner la formule --' : '-- Select formula --'}</option>
                              {selectedOfferObj?.formulas?.map((formula) => (
                                <option key={formula.id} value={formula.id}>{formula.name} - {formula.price}€</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {editedValue > 0 && <p className="text-xs font-medium text-sky-600 dark:text-sky-400 text-right">{lang === 'fr' ? 'Nouveau montant' : 'New amount'} : {editedValue.toLocaleString()}€</p>}
                        <div className="flex gap-2">
                          <button onClick={handleSaveOffer} className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-600">{lang === 'fr' ? 'Sauvegarder' : 'Save'}</button>
                          <button onClick={handleCancelOffer} className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm font-semibold text-slate-500 dark:text-neutral-400 hover:bg-slate-100">{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Offre concernée' : 'Related offer'}</p>
                            <p className="mt-1 font-medium text-slate-900 dark:text-white">{localProspect.offer || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Montant' : 'Amount'}</p>
                            <p className="mt-1 text-lg font-bold text-sky-600 dark:text-sky-400"><MaskedText value={`${(localProspect.value || 0).toLocaleString()}€`} type="number" /></p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fiche Client */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{lang === 'fr' ? 'Fiche Client' : 'Client Info'}</h3>
                      <button onClick={() => setEditingClient(!editingClient)} className="rounded p-1 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingClient ? (
                      <div className="space-y-3">
                        <input type="text" value={editedContact} onChange={(e) => setEditedContact(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none" placeholder={lang === 'fr' ? 'Nom' : 'Name'} />
                        <input type="text" value={editedCompany} onChange={(e) => setEditedCompany(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none" placeholder={lang === 'fr' ? 'Entreprise' : 'Company'} />
                        <input type="email" value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none" placeholder="Email" />
                        <PhoneInput variant="sales" value={editedPhone || ''} onChange={setEditedPhone} />
                        <div className="flex gap-2">
                          <button onClick={handleSaveClient} className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white">{lang === 'fr' ? 'Sauvegarder' : 'Save'}</button>
                          <button onClick={handleCancelClient} className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm font-semibold text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                          <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Email' : 'Email'}</p>
                            <button onClick={handleOpenGmail} className="truncate text-sm text-slate-500 dark:text-neutral-400 hover:text-slate-900 hover:underline text-left"><MaskedText value={localProspect.email} type="name" /></button>
                          </div>
                          {localProspect.email && (
                            <button onClick={() => copyToClipboard(localProspect.email, 'Email')} title={lang === 'fr' ? 'Copier' : 'Copy'} className="shrink-0 p-1.5 rounded-lg text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-sky-600 transition-colors">
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                          <Phone className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Téléphone' : 'Phone'}</p>
                            <button onClick={handleOpenWhatsApp} className="text-sm text-slate-500 dark:text-neutral-400 hover:text-slate-900 hover:underline text-left"><MaskedText value={localProspect.phone} type="name" /></button>
                          </div>
                          {localProspect.phone && (
                            <button onClick={() => copyToClipboard(localProspect.phone, lang === 'fr' ? 'Téléphone' : 'Phone')} title={lang === 'fr' ? 'Copier' : 'Copy'} className="shrink-0 p-1.5 rounded-lg text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-sky-600 transition-colors">
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {localProspect.company && localProspect.company !== 'N/A' && (
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                            <Building2 className="h-4 w-4 text-orange-600" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Entreprise' : 'Company'}</p>
                              <p className="text-sm text-slate-500 dark:text-neutral-400">{localProspect.company}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                          <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Date de création' : 'Created on'}</p>
                            <p className="text-sm text-slate-500 dark:text-neutral-400">
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
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{lang === 'fr' ? 'Notes Internes' : 'Internal Notes'}</h3>
                      <button onClick={() => setEditingNotes(!editingNotes)} className="rounded p-1 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingNotes ? (
                      <div>
                        <textarea value={tempNotes} onChange={(e) => setTempNotes(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none" rows={4} />
                        <div className="mt-2 flex gap-2">
                          <button onClick={handleSaveNotes} className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white">{lang === 'fr' ? 'Enregistrer' : 'Save'}</button>
                          <button onClick={() => setEditingNotes(false)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
                        <p className="whitespace-pre-wrap text-sm text-slate-500 dark:text-neutral-400">{localProspect.notes || (lang === 'fr' ? 'Aucune note' : 'No notes')}</p>
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
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 py-3 text-sm font-medium text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-200 transition-all"
                    >
                      <Plus className="h-4 w-4" /> {lang === 'fr' ? 'Ajouter une note manuelle' : 'Add a manual note'}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)] animate-in fade-in zoom-in-95">
                      <h4 className="text-xs font-semibold text-slate-400 dark:text-neutral-500 mb-2 uppercase tracking-wider">{lang === 'fr' ? 'Nouvelle Note' : 'New Note'}</h4>
                      <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder={lang === 'fr' ? "Écrivez votre note d'appel ici..." : "Write your call note here..."}
                        className="w-full rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 min-h-[100px] mb-3"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setIsAddingNote(false); setNewNoteContent(''); }}
                          className="px-4 py-2 text-sm font-medium text-slate-400 dark:text-neutral-500 hover:text-slate-900 transition-colors"
                        >
                          {lang === 'fr' ? 'Annuler' : 'Cancel'}
                        </button>
                        <button
                          onClick={handleAddManualNote}
                          disabled={!newNoteContent.trim()}
                          className="px-4 py-2 rounded-lg bg-sky-600 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50 transition-all shadow-lg shadow-sky-500/20"
                        >
                          {lang === 'fr' ? 'Enregistrer' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-slate-100 dark:bg-white/10 my-4" />

                  {/* LISTE DES NOTES */}
                  <div className="space-y-3">
                    {localProspect.callNotes && localProspect.callNotes.length > 0 ? (
                      localProspect.callNotes.map((note) => (
                        <details key={note.id} className="group rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 open:bg-slate-100 transition-all overflow-hidden">
                          <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-slate-50 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-neutral-500 group-open:bg-sky-500/20 group-open:text-sky-600 transition-colors">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {new Date(note.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
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
                                className="rounded p-1.5 text-slate-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                title={lang === 'fr' ? "Supprimer la note" : "Delete note"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <ChevronDown className="h-5 w-5 text-slate-400 dark:text-neutral-500 transition-transform duration-300 group-open:rotate-180" />
                            </div>
                          </summary>

                          <div className="border-t border-slate-200 dark:border-white/10 p-4 pt-2">
                            <div className="prose prose-invert prose-sm max-w-none">
                              <p className="text-slate-500 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed">
                                {note.content}
                              </p>
                            </div>
                          </div>
                        </details>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 mb-3">
                          <ClipboardList className="h-6 w-6 text-slate-400 dark:text-neutral-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-400 dark:text-neutral-500">{lang === 'fr' ? "Aucune note d'appel" : 'No call notes'}</p>
                        <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1 max-w-[200px]">
                          {lang === 'fr' ? "L'historique de vos appels et vos notes manuelles apparaîtront ici." : 'Your call history and manual notes will appear here.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- ONGLET TÂCHES --- */}
              {activeTab === 'taches' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Ajout d'une tâche */}
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 space-y-2.5">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTaskTitle.trim() && !addingTask) {
                          e.preventDefault()
                          setAddingTask(true)
                          addTask(newTaskTitle, newTaskDue || null).finally(() => { setNewTaskTitle(''); setNewTaskDue(''); setAddingTask(false) })
                        }
                      }}
                      placeholder={lang === 'fr' ? 'Nouvelle tâche (ex: rappeler, envoyer le devis…)' : 'New task (e.g. call back, send quote…)'}
                      className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 outline-none transition-all"
                    />
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Clock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-600/60 pointer-events-none" />
                        <input
                          type="date"
                          value={newTaskDue}
                          onChange={(e) => setNewTaskDue(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 pl-8 pr-2 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500 transition-all"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (!newTaskTitle.trim() || addingTask) return
                          setAddingTask(true)
                          addTask(newTaskTitle, newTaskDue || null).finally(() => { setNewTaskTitle(''); setNewTaskDue(''); setAddingTask(false) })
                        }}
                        disabled={!newTaskTitle.trim() || addingTask}
                        className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-40 transition-all shrink-0"
                      >
                        {addingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {lang === 'fr' ? 'Ajouter' : 'Add'}
                      </button>
                    </div>
                  </div>

                  {/* Liste des tâches */}
                  {tasksLoading ? (
                    <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-neutral-500" /></div>
                  ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 mb-3">
                        <ClipboardList className="h-6 w-6 text-slate-400 dark:text-neutral-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Aucune tâche' : 'No task'}</p>
                      <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1 max-w-[220px]">
                        {lang === 'fr' ? 'Ajoutez les actions à faire pour ce prospect (rappel, devis, relance…).' : 'Add the to-dos for this prospect (call, quote, follow-up…).'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => {
                        const today = new Date(); today.setHours(0, 0, 0, 0)
                        const isOverdue = !task.is_done && task.due_date && new Date(task.due_date + 'T00:00') < today
                        const isTodayDue = !task.is_done && task.due_date && new Date(task.due_date + 'T00:00').getTime() === today.getTime()
                        return (
                          <div key={task.id} className={cn(
                            "group flex items-start gap-3 rounded-xl border p-3 transition-all",
                            task.is_done ? "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 opacity-60" : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-sky-300"
                          )}>
                            <button
                              onClick={() => toggleTask(task)}
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                                task.is_done ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 dark:border-white/20 hover:border-sky-500"
                              )}
                              aria-label={task.is_done ? 'Terminée' : 'À faire'}
                            >
                              {task.is_done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={cn("text-sm font-medium break-words", task.is_done ? "text-slate-400 dark:text-neutral-500 line-through" : "text-slate-900 dark:text-white")}>
                                {task.title}
                              </p>
                              {task.due_date && (
                                <span className={cn(
                                  "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                                  isOverdue ? "bg-red-500/10 text-red-600 dark:text-red-400" : isTodayDue ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-neutral-400"
                                )}>
                                  <Clock className="h-3 w-3" />
                                  {isOverdue && (lang === 'fr' ? 'En retard · ' : 'Overdue · ')}
                                  {isTodayDue && (lang === 'fr' ? "Aujourd'hui · " : 'Today · ')}
                                  {new Date(task.due_date + 'T00:00').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="shrink-0 rounded-lg p-1.5 text-slate-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* --- ONGLET 3: RAPPELS --- */}
              {activeTab === 'rappels' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Bouton ajouter */}
                  <button
                    onClick={() => setShowReminderForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-orange-500/30 bg-orange-500/5 py-3 text-sm font-medium text-orange-600 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all"
                  >
                    <Plus className="h-4 w-4" /> {lang === 'fr' ? 'Ajouter un rappel' : 'Add a reminder'}
                  </button>

                  {remindersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                    </div>
                  ) : prospectReminders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 mb-3">
                        <Bell className="h-6 w-6 text-slate-400 dark:text-neutral-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Aucun rappel' : 'No reminders'}</p>
                      <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">
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
                                ? 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5'
                                : isOverdue
                                  ? 'border-red-500/30 bg-red-500/5'
                                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5',
                              isExpanded && 'ring-1 ring-orange-500/30'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  'text-sm font-semibold',
                                  isDone ? 'text-slate-400 dark:text-neutral-500 line-through' : 'text-slate-900 dark:text-white'
                                )}>
                                  {reminder.title}
                                </p>
                                
                                <div className={cn(
                                  "grid transition-all duration-300 ease-in-out",
                                  isExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
                                )}>
                                  <div className="overflow-hidden">
                                     {reminder.description && (
                                      <p className="text-xs text-slate-500 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed mb-2">
                                        {reminder.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 py-1 px-2 rounded bg-slate-50 dark:bg-white/5 w-fit">
                                      <Clock className="h-3 w-3 text-slate-400 dark:text-neutral-500" />
                                      <span className={cn(
                                        'text-xs',
                                        isOverdue ? 'text-red-600 font-medium' : 'text-slate-400 dark:text-neutral-500'
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
                                    <Clock className="h-3 w-3 text-slate-400 dark:text-neutral-500" />
                                    <span className="text-[10px] text-slate-400 dark:text-neutral-500">
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
                                    className="rounded-md p-1.5 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors disabled:opacity-50"
                                    title={lang === 'fr' ? "Marquer comme fait" : "Mark as done"}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteReminder(reminder.id)}
                                  disabled={isLoading}
                                  className="rounded-md p-1.5 text-slate-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                  title={lang === 'fr' ? "Supprimer" : "Delete"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <ChevronDown className={cn(
                                  "h-4 w-4 text-slate-400 dark:text-neutral-500 transition-transform duration-300",
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
                      <Loader2 className="h-6 w-6 animate-spin text-sky-600 dark:text-sky-400" />
                    </div>
                  ) : historyGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 mb-3">
                        <Clock className="h-6 w-6 text-slate-400 dark:text-neutral-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Aucun historique' : 'No history'}</p>
                      <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">{lang === 'fr' ? 'Les modifications apparaîtront ici.' : 'Changes will appear here.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {historyGroups.map((group, gIdx) => {
                        const isExpanded = expandedHistory.has(group.key)
                        const isLast = gIdx === historyGroups.length - 1
                        const date = new Date(group.created_at)
                        const timeStr = date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) + (lang === 'fr' ? ' à ' : ' at ') + date.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })

                        const CHANGE_STYLES: Record<string, { icon: typeof Plus; bg: string; text: string }> = {
                          created: { icon: Plus, bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400' },
                          stage_change: { icon: Tag, bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400' },
                          field_update: { icon: Pencil, bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400' },
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
                              className="w-full text-left rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 hover:bg-slate-100 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn('p-1.5 rounded-lg shrink-0', style.bg)}>
                                  <IconComponent className={cn('h-3.5 w-3.5', style.text)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</p>
                                  <p className="text-[10px] text-slate-400 dark:text-neutral-500">{timeStr}</p>
                                </div>
                                <ChevronDown className={cn('h-4 w-4 text-slate-400 dark:text-neutral-500 transition-transform shrink-0', isExpanded && 'rotate-180')} />
                              </div>

                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
                                  <div className="space-y-2">
                                    {group.entries.map((entry: any) => {
                                      const fieldLabel = FIELD_LABELS[entry.field_name] || entry.field_name
                                      const oldDisplay = formatHistoryValue(entry.field_name, entry.old_value)
                                      const newDisplay = formatHistoryValue(entry.field_name, entry.new_value)
                                      return (
                                        <div key={entry.id} className="flex items-start gap-2">
                                          <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 w-24 shrink-0 pt-0.5 truncate">{fieldLabel}</span>
                                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                            {entry.old_value && (
                                              <>
                                                <span className="text-xs text-slate-400 dark:text-neutral-500 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 line-through truncate max-w-[140px]">
                                                  {oldDisplay}
                                                </span>
                                                <span className="text-[10px] text-slate-400 dark:text-neutral-500">→</span>
                                              </>
                                            )}
                                            <span className="text-xs text-slate-900 dark:text-white bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20 font-medium truncate max-w-[140px]">
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
                                  <div className="w-px h-2 bg-slate-100 dark:bg-white/10" />
                                  <ChevronDown className="h-3 w-3 text-slate-300 dark:text-neutral-600 -my-0.5" />
                                  <div className="w-px h-2 bg-slate-100 dark:bg-white/10" />
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
                <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-16px_rgba(15,23,42,0.10)]">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 py-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Nouveau rappel' : 'New reminder'}</h3>
                    <button onClick={() => setShowReminderForm(false)} className="rounded-lg p-1 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Titre' : 'Title'} *</label>
                      <input
                        type="text"
                        value={reminderTitle}
                        onChange={(e) => setReminderTitle(e.target.value)}
                        placeholder={lang === 'fr' ? "Ex: Rappeler le prospect" : "E.g.: Call back the prospect"}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Description' : 'Description'}</label>
                      <textarea
                        value={reminderDesc}
                        onChange={(e) => setReminderDesc(e.target.value)}
                        placeholder={lang === 'fr' ? "Détails optionnels..." : "Optional details..."}
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div className={cn("grid gap-2", reminderPreciseTime ? "grid-cols-2" : "grid-cols-1")}>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Date' : 'Date'} *</label>
                        <input
                          type="date"
                          value={reminderDate}
                          onChange={(e) => setReminderDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                      {reminderPreciseTime && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Heure' : 'Time'} *</label>
                          <input
                            type="time"
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Case Heure précise → email 5 min avant */}
                    <button
                      type="button"
                      onClick={() => setReminderPreciseTime(v => !v)}
                      className="flex w-full items-start gap-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
                    >
                      <span className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                        reminderPreciseTime ? "border-orange-500 bg-orange-500 text-white" : "border-slate-300 dark:border-white/20"
                      )}>
                        {reminderPreciseTime && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{lang === 'fr' ? 'Heure précise' : 'Precise time'}</span>
                        <span className="block text-[11px] text-slate-400 dark:text-neutral-500">
                          {lang === 'fr' ? 'Recevez un email 5 min avant l’heure indiquée' : 'Get an email 5 min before the set time'}
                        </span>
                      </span>
                    </button>
                    <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2">
                      <p className="text-xs text-orange-600">
                        <Bell className="h-3 w-3 inline mr-1" />
                        {lang === 'fr' ? 'Lié à' : 'Linked to'} : <span className="font-semibold">{localProspect.contact || (lang === 'fr' ? 'Ce prospect' : 'This prospect')}</span>
                      </p>
                    </div>
                    <button
                      onClick={handleCreateReminder}
                      disabled={!reminderTitle.trim() || !reminderDate || (reminderPreciseTime && !reminderTime) || reminderSubmitting}
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
            <div className="border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-6 space-y-3">
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
                    ? "border border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
                    : "border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-neutral-400 hover:bg-slate-100"
                )}
              >
                {isDismissed ? (
                  <><Plus className="h-4 w-4" /> {lang === 'fr' ? 'Rajouter au pipeline' : 'Add back to pipeline'}</>
                ) : (
                  <><X className="h-4 w-4" /> {lang === 'fr' ? 'Retirer du pipeline' : 'Remove from pipeline'}</>
                )}
              </button>
              <button onClick={handleDeleteProspect} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" /> {lang === 'fr' ? 'Supprimer le prospect' : 'Delete prospect'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showScheduleModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowScheduleModal(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-[#0d1117] p-5 shadow-2xl animate-in zoom-in-95 fade-in duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  {lang === 'fr' ? `Échéancier (${savedInstallments} mois)` : `Schedule (${savedInstallments} months)`}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-neutral-500">
                  {lang === 'fr' ? `Commission ${savedCommissionRate}% par échéance` : `${savedCommissionRate}% commission per installment`}
                </p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="rounded-lg p-1.5 text-slate-500 dark:text-neutral-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">{lang === 'fr' ? 'Mois' : 'Month'}</span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider text-right">{lang === 'fr' ? 'Client paie' : 'Client pays'}</span>
                <span className="text-[10px] font-bold text-sky-600/70 uppercase tracking-wider text-right">{lang === 'fr' ? 'Tu reçois' : 'You receive'}</span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto">
                {hasSavedDeposit && (
                  <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-slate-900 dark:text-white flex items-center gap-1">
                        <Wallet className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                        {lang === 'fr' ? 'Acompte' : 'Deposit'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                        {savedDepositDate
                          ? new Date(savedDepositDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')
                          : '—'}
                        {savedDepositToRefund && (
                          <span className="ml-1 text-amber-600">
                            {lang === 'fr' ? '· à rembourser' : '· to refund'}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white text-right">{savedDepositAmount.toFixed(2)}€</span>
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400 text-right">
                      {savedDepositKept
                        ? `${((savedDepositAmount * savedCommissionRate) / 100).toFixed(2)}€`
                        : '0.00€'}
                    </span>
                  </div>
                )}
                {scheduleBreakdown.map((row) => (
                  <div key={row.month} className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 border-b border-slate-200 dark:border-white/10 last:border-b-0">
                    <span className="text-xs font-medium text-slate-600 dark:text-neutral-300">{lang === 'fr' ? `Mois ${row.month}` : `Month ${row.month}`}</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white text-right">{row.clientAmount.toFixed(2)}€</span>
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400 text-right">{row.commission.toFixed(2)}€</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2.5 border-t border-slate-200 dark:border-white/10 bg-sky-500/5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Total</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white text-right">
                  {(scheduleBreakdown.reduce((s, r) => s + r.clientAmount, 0) + (hasSavedDeposit ? savedDepositAmount : 0)).toFixed(2)}€
                </span>
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400 text-right">
                  {(scheduleBreakdown.reduce((s, r) => s + r.commission, 0) + (savedDepositKept ? (savedDepositAmount * savedCommissionRate) / 100 : 0)).toFixed(2)}€
                </span>
              </div>
              {hasSavedDeposit && savedDepositToRefund && (
                <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 border-t border-slate-200 dark:border-white/10 bg-amber-500/5">
                  <span className="text-[10px] font-medium text-amber-600 col-span-3">
                    {lang === 'fr'
                      ? `Acompte de ${savedDepositAmount.toFixed(2)}€ rendu au client après mise en place du plan.`
                      : `Deposit of ${savedDepositAmount.toFixed(2)}€ returned to client once the plan is in place.`}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowScheduleModal(false)}
              className="mt-4 w-full rounded-lg bg-sky-600 py-2 text-sm font-bold text-white hover:bg-sky-600 transition-colors"
            >
              {lang === 'fr' ? 'Fermer' : 'Close'}
            </button>
          </div>
        </div>
      )}

      <CreateEventModal
        isOpen={showFollowupRdv}
        onClose={() => setShowFollowupRdv(false)}
        prospectId={localProspect.id}
        prospectName={localProspect.contact}
      />
    </div>
  )
}