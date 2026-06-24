import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { PhoneInput } from './PhoneInput'
import { useNavigate } from 'react-router-dom'
import {
  X, Phone, Mail, Calendar, Pencil, Trash2,
  MessageCircle, Save, Clock, Plus, ChevronDown,
  Bell, Check, Loader2, FileText, ClipboardList,
  Package, ExternalLink, PhoneCall, Tag, Camera,
  CreditCard, Wallet, Link2, Search, Zap, CheckCircle2,
  Award, AlertCircle, XCircle, Settings2, CalendarPlus, Copy, Globe,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { TimezonePicker } from './TimezonePicker'
import { getTimezoneLabel, getCurrentLocalTime, getTimezoneOffsetHours, fromUTC, toUTC } from '../../lib/timezone'
import { CommissionApprovalModal } from './CommissionApprovalModal'
import { InstallmentScheduleEditor } from '../../components/InstallmentScheduleEditor'
import { type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { DMRBadge } from './DMRBadge'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const GLASS_PANEL = 'bg-white/70 dark:bg-white/5 backdrop-blur-xl'
const LABEL_STYLE = 'text-[11px] font-business-display font-extrabold uppercase tracking-widest text-stone-500 dark:text-neutral-400'
const SELECT_CLS = 'w-full bg-[#f5f3f2] dark:bg-neutral-800 border-0 rounded-xl py-3.5 px-4 font-business-display font-bold text-stone-900 dark:text-white appearance-none focus:ring-2 focus:ring-stone-900 transition-all'
const INPUT_CLS = 'w-full bg-[#f5f3f2] dark:bg-neutral-800 border-0 rounded-xl px-4 py-3 text-sm text-stone-900 dark:text-white font-medium focus:ring-2 focus:ring-stone-900 transition-all placeholder:text-stone-400 dark:placeholder:text-neutral-500'

const ALL_STAGE_DEFS = [
  { id: 'prospect', color: 'bg-blue-500' },
  { id: 'qualified', color: 'bg-purple-500' },
  { id: 'unqualified', color: 'bg-yellow-500' },
  { id: 'won', color: 'bg-emerald-500' },
  { id: 'followup', color: 'bg-orange-500' },
  { id: 'noanswer', color: 'bg-cyan-500' },
  { id: 'noshow', color: 'bg-slate-600' },
  { id: 'lost', color: 'bg-red-500' },
] as const

interface CallNote {
  id: string
  date: string
  content: string
  author?: string
}

interface Formula {
  id: string
  name: string
  price: number
  description: string | null
  resources: { name: string; url: string; type: string }[]
  billing_type?: 'one_time' | 'subscription' | 'quote'
}

interface Campaign {
  id: string
  name: string
}

// Les leads issus d'un formulaire de capture stockent leurs réponses (custom_data)
// dans la colonne `notes` sous forme de JSON. Pour éviter d'écraser ces réponses
// quand le proprio saisit des notes internes, on range les notes internes sous une
// clé réservée DANS ce JSON. `notes` en texte libre reste géré tel quel.
const INTERNAL_NOTES_KEY = '__internal_notes'

function parseNotesField(notes: string | null | undefined): {
  capture: Record<string, string> | null
  internal: string
} {
  if (!notes) return { capture: null, internal: '' }
  try {
    const parsed = JSON.parse(notes)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const { [INTERNAL_NOTES_KEY]: internal, ...rest } = parsed
      const capture = Object.keys(rest).length > 0 ? rest : null
      return { capture, internal: typeof internal === 'string' ? internal : '' }
    }
  } catch { /* notes en texte libre */ }
  return { capture: null, internal: notes }
}

interface BusinessProspectViewProps {
  prospect: BusinessProspect
  onClose: () => void
  onUpdate: (id: number, updates: Partial<BusinessProspect>) => void
  onDelete: (id: number) => void
  inline?: boolean
  onDismissFromPipeline?: (prospectId: number, dismissed: boolean) => void
  onTagsChange?: (prospectId: number, tagIds: string[]) => void
}

const API_URL = '/api/business'

export function BusinessProspectView({
  prospect,
  onClose,
  onUpdate,
  onDelete,
  inline = false,
  onDismissFromPipeline,
  onTagsChange,
}: BusinessProspectViewProps) {
  const navigate = useNavigate()
  const { user, isTeamMember, teamMember, ownerUserId, userTimezone } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const { customStages } = useCustomStages()
  const STAGE_NAME_MAP: Record<string, string> = {
    prospect: t.stage_prospect, qualified: t.stage_qualified, unqualified: t.stage_unqualified,
    won: t.stage_won, followup: t.stage_followup, noanswer: t.stage_noanswer,
    noshow: t.stage_noshow, lost: t.stage_lost,
  }
  const ALL_STAGES = ALL_STAGE_DEFS.map(s => ({ ...s, name: STAGE_NAME_MAP[s.id] || s.id }))
  const [teamMembers, setTeamMembers] = useState<{ id: string; first_name: string; last_name: string; role: string; setter_scope?: string }[]>([])

  // Pipeline dismissal state
  const [isDismissed, setIsDismissed] = useState(false)
  useEffect(() => {
    if (!user?.id || !prospect.id) return
    let cancelled = false
    supabase.from('business_pipeline_dismissals').select('id').eq('user_id', user.id).eq('prospect_id', prospect.id).maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsDismissed(!!data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.id, prospect.id])

  // Qualification data (questionnaire answers)
  const [qualificationData, setQualificationData] = useState<{
    answers: { question_text: string; question_type: string; answer_value: any; expected_answer: any; score: number | null; is_eliminatory: boolean; sort_order: number }[]
    questionnaire: { max_eliminatory: number; qualifying?: boolean } | null
  } | null>(null)

  useEffect(() => {
    if (!prospect.campaign_id) return
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId) return
    fetch(`${API_URL}?action=prospect-qualification&prospect_id=${prospect.id}&user_id=${ownerId}`)
      .then(r => r.json())
      .then(data => {
        if (data.answers && data.answers.length > 0) setQualificationData(data)
        else setQualificationData(null)
      })
      .catch(() => setQualificationData(null))
  }, [prospect.id, prospect.campaign_id, isTeamMember, ownerUserId, user?.id])

  // Who can assign: Owner, Head of Sales, Admin, and Setters only if they are the assigned setter on this prospect
  const isSetter = isTeamMember && (teamMember?.role === 'Setter' || teamMember?.role === 'Setter-Closer')
  const isSetterCloserSelf = isTeamMember && teamMember?.role === 'Setter-Closer' && teamMember?.setter_scope === 'self'
  const isHosOrAdmin = isTeamMember && (teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin')
  const isAssignedSetterOnProspect = isSetter && teamMember?.id === (prospect as any).assigned_setter
  const canAssign = !isTeamMember || isHosOrAdmin || (isAssignedSetterOnProspect && !isSetterCloserSelf)

  // Fetch team members + owner for assignment
  useEffect(() => {
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role, setter_scope, owner_assignable, owner_assignable_roles').eq('business_owner_id', ownerId),
      supabase.from('business_users').select('id, full_name, email, owner_assignable, owner_assignable_roles').eq('id', ownerId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const list = tmRes.data || []
      // Le proprio peut toujours s'auto-assigner depuis sa propre fiche prospect,
      // même sans avoir activé « Apparaître dans les assignations ». Pour un membre
      // d'équipe qui consulte, on garde le verrou owner_assignable (le proprio peut
      // se retirer des listes des autres).
      if (ownerRes.data && (!isTeamMember || ownerRes.data.owner_assignable)) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner', owner_assignable_roles: ownerRes.data.owner_assignable_roles || [] })
      }
      setTeamMembers(list)
    })
  }, [user?.id, ownerUserId, isTeamMember])

  const [local, setLocal] = useState<BusinessProspect>(prospect)
  // Sync local when prospect changes (e.g., realtime update from call details)
  useEffect(() => {
    setLocal(prospect)
  }, [prospect.id])
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'rappels' | 'historique'>('info')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Payment details
  const [editingPayment, setEditingPayment] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [editCustomCommissionEnabled, setEditCustomCommissionEnabled] = useState(false)
  const [editCustomCommissionRate, setEditCustomCommissionRate] = useState<number>(0)
  const [editScheduleMode, setEditScheduleMode] = useState<'equal' | 'custom'>('equal')
  const [editCustomSchedule, setEditCustomSchedule] = useState<{ month: number; amount: number }[]>([])

  // Stripe linking (3 modes)
  const [stripeConnected, setStripeConnected] = useState(false)
  const [stripeLinkMode, setStripeLinkMode] = useState<'auto' | 'search' | 'manual'>('auto')
  const [stripeLinkOpen, setStripeLinkOpen] = useState(false)
  const [stripeSearchEmail, setStripeSearchEmail] = useState('')
  const [stripeSearching, setStripeSearching] = useState(false)
  const [stripeSearchResults, setStripeSearchResults] = useState<any[]>([])
  const [stripeSearched, setStripeSearched] = useState(false)
  const [stripeMatching, setStripeMatching] = useState(false)
  const [stripeManualCusId, setStripeManualCusId] = useState('')
  const [stripeManualSubId, setStripeManualSubId] = useState('')
  const [stripeAutoStatus, setStripeAutoStatus] = useState<'idle' | 'loading' | 'matched' | 'not_found'>('idle')
  const [paymentMode, setPaymentMode] = useState<'cash' | 'installments'>(prospect.payment_type === 'installments' ? 'installments' : 'cash')
  const [editedInstallments, setEditedInstallments] = useState(prospect.installments || 1)
  const [editedValue, setEditedValue] = useState(prospect.value || 0)
  const [memberCommissionRate, setMemberCommissionRate] = useState(10)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error(t.prospect_toast_file_required); return }
    if (file.size > 5 * 1024 * 1024) { toast.error(t.prospect_toast_file_too_large); return }

    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `prospect-${prospect.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const avatarUrl = data.publicUrl

      await supabase.from('business_prospects').update({ avatar_url: avatarUrl }).eq('id', prospect.id)
      setLocal(prev => ({ ...prev, avatar_url: avatarUrl }))
      onUpdate(prospect.id, { avatar_url: avatarUrl })
      toast.success(t.prospect_toast_photo_updated)
    } catch (err) {
      console.error(err)
      toast.error(t.prospect_toast_upload_error)
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // Load commission rate for the viewing team member
  useEffect(() => {
    if (!isTeamMember || !teamMember?.id) return
    supabase.from('business_team_members').select('commission_rate').eq('id', teamMember.id).single()
      .then(({ data }) => {
        if (data?.commission_rate != null) setMemberCommissionRate(data.commission_rate)
      })
  }, [isTeamMember, teamMember?.id])

  // Sync custom commission + custom schedule edit state when prospect changes
  useEffect(() => {
    setEditCustomCommissionEnabled(local.custom_commission_rate != null)
    setEditCustomCommissionRate(local.custom_commission_rate != null ? Number(local.custom_commission_rate) : 0)
    if (Array.isArray(local.installments_schedule) && local.installments_schedule.length > 0) {
      setEditScheduleMode('custom')
      setEditCustomSchedule(local.installments_schedule)
    } else {
      setEditScheduleMode('equal')
      setEditCustomSchedule([])
    }
  }, [prospect.id, local.custom_commission_rate, local.installments_schedule])

  // Sync payment state when prospect changes
  useEffect(() => {
    setEditedValue(prospect.value || 0)
    setPaymentMode(prospect.payment_type === 'installments' ? 'installments' : 'cash')
    setEditedInstallments(prospect.installments || 1)
  }, [prospect.id, prospect.value, prospect.payment_type, prospect.installments])

  // Permission: everyone can edit payment mode/installments, only owner+HOS can edit price
  const isOwner = !isTeamMember
  const canEditPrice = isOwner || isHosOrAdmin

  // Payment calculations
  const closerIsOwner = teamMembers.some(tm => tm.id === (local as any).assigned_to && tm.role === 'Owner')
  const standardCommissionRate = memberCommissionRate
  const commissionRate = editCustomCommissionEnabled ? editCustomCommissionRate : standardCommissionRate
  // Effective edited amount: when custom schedule is used, the sale total = sum of installments
  const editCustomScheduleTotal = editCustomSchedule.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const effectiveEditedValue = editScheduleMode === 'custom' ? editCustomScheduleTotal : editedValue
  const commissionAmount = (effectiveEditedValue * commissionRate) / 100
  const savedInstallments = local.installments || 1
  const savedCommissionRate = local.custom_commission_rate != null ? Number(local.custom_commission_rate) : memberCommissionRate
  const savedCommission = (local.value || 0) * (savedCommissionRate / 100)
  const savedMonthlyPayment = (local.value || 0) / savedInstallments
  const savedMonthlyCommission = savedCommission / savedInstallments
  const isPayingInInstallments = local.payment_type === 'installments' || (savedInstallments > 1)
  const hasCustomException = editCustomCommissionEnabled || editScheduleMode === 'custom'

  const handleSavePayment = async () => {
    const updates: any = {
      value: effectiveEditedValue,
      payment_type: paymentMode,
    }
    if (paymentMode === 'installments') {
      if (editScheduleMode === 'custom') {
        updates.installments = editCustomSchedule.length
        updates.installments_schedule = editCustomSchedule
      } else {
        updates.installments = editedInstallments
        updates.installments_schedule = null
      }
    } else {
      updates.installments = 1
      updates.installments_schedule = null
    }
    updates.custom_commission_rate = editCustomCommissionEnabled ? editCustomCommissionRate : null
    handleUpdate(updates)

    // Business: trigger commission approval workflow if closer uses exception
    if (hasCustomException && isTeamMember && teamMember?.id && (ownerUserId || user?.id)) {
      const { createCommissionApproval } = await import('../services/commissionApproval')
      const reason: 'commission' | 'schedule' | 'both' =
        editCustomCommissionEnabled && editScheduleMode === 'custom'
          ? 'both'
          : editCustomCommissionEnabled
            ? 'commission'
            : 'schedule'
      await createCommissionApproval(
        {
          business_owner_id: ownerUserId || user!.id,
          prospect_id: prospect.id,
          closer_id: teamMember.id,
          reason,
          sale_amount: effectiveEditedValue,
          standard_commission_rate: standardCommissionRate,
          custom_commission_rate: editCustomCommissionEnabled ? editCustomCommissionRate : null,
          installments_schedule: editScheduleMode === 'custom' ? editCustomSchedule : null,
        },
        {
          closerName: `${teamMember.first_name || ''} ${teamMember.last_name || ''}`.trim() || 'Un closer',
          prospectName: local.contact || `${local.firstName || ''} ${local.lastName || ''}`.trim() || 'Prospect',
          offerName: local.offer,
        }
      )
    }
    setEditingPayment(false)
  }

  // Next appointment + tous les RDV liés (pour la modale planning)
  type LinkedAppt = { id: string; date: string; time: string; status: string; datetime_utc?: string | null; duration?: number }
  const [nextAppointment, setNextAppointment] = useState<LinkedAppt | null>(null)
  const [allAppointments, setAllAppointments] = useState<LinkedAppt[]>([])
  const [showApptsModal, setShowApptsModal] = useState(false)
  const [apptRefreshKey, setApptRefreshKey] = useState(0)
  useEffect(() => {
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId || !prospect.id) return
    const nowUtc = new Date().toISOString()
    supabase
      .from('business_appointments')
      .select('id, date, time, status, datetime_utc, duration')
      .eq('prospect_id', prospect.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .then(({ data }) => {
        // Convertit chaque RDV à l'heure locale du visiteur.
        const rows: LinkedAppt[] = (data || []).map(a => {
          if (a.datetime_utc) {
            const l = fromUTC(a.datetime_utc, userTimezone)
            return { id: a.id, date: l.date, time: l.time, status: a.status, datetime_utc: a.datetime_utc, duration: a.duration }
          }
          return { id: a.id, date: a.date, time: a.time?.slice(0, 5) || '00:00', status: a.status, datetime_utc: null, duration: a.duration }
        })
        setAllAppointments(rows)
        // Prochain RDV = premier RDV futur en attente/confirmé.
        const localNow = fromUTC(new Date().toISOString(), userTimezone)
        const future = rows.find(a => {
          if (a.status !== 'pending' && a.status !== 'confirmed') return false
          if (a.datetime_utc) return a.datetime_utc > nowUtc
          return a.date > localNow.date || (a.date === localNow.date && a.time >= localNow.time)
        })
        setNextAppointment(future ?? null)
      })
  }, [prospect.id, user?.id, ownerUserId, isTeamMember, userTimezone, apptRefreshKey])

  // Cancel / Reschedule next appointment (internal flow)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleLoading, setRescheduleLoading] = useState(false)

  const handleCancelAppointment = async () => {
    if (!nextAppointment) return
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId) return
    if (!window.confirm('Annuler ce rendez-vous ? Le prospect recevra un email de notification.')) return
    setCancelLoading(true)
    try {
      const res = await fetch(`${API_URL}?action=appointment-cancel-internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: ownerId, appointment_id: nextAppointment.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'Erreur lors de l\'annulation')
        return
      }
      toast.success(data.email_sent ? 'Rendez-vous annulé, email envoyé au prospect' : 'Rendez-vous annulé')
      setApptRefreshKey(k => k + 1)
    } catch (e) {
      console.error(e)
      toast.error('Erreur lors de l\'annulation')
    } finally {
      setCancelLoading(false)
    }
  }

  const openRescheduleModal = () => {
    if (!nextAppointment) return
    setRescheduleDate(nextAppointment.date)
    setRescheduleTime(nextAppointment.time || '')
    setShowRescheduleModal(true)
  }

  const handleRescheduleSubmit = async () => {
    if (!nextAppointment || !rescheduleDate || !rescheduleTime) return
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId) return
    setRescheduleLoading(true)
    try {
      const res = await fetch(`${API_URL}?action=appointment-reschedule-internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: ownerId,
          appointment_id: nextAppointment.id,
          date: rescheduleDate,
          time: rescheduleTime,
          timezone: userTimezone || 'Europe/Paris',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'Erreur lors de la reprogrammation')
        return
      }
      toast.success(data.email_sent ? 'Rendez-vous reprogrammé, email envoyé au prospect' : 'Rendez-vous reprogrammé')
      setShowRescheduleModal(false)
      setApptRefreshKey(k => k + 1)
    } catch (e) {
      console.error(e)
      toast.error('Erreur lors de la reprogrammation')
    } finally {
      setRescheduleLoading(false)
    }
  }

  // Client edit
  const [editingClient, setEditingClient] = useState(false)
  const [editedContact, setEditedContact] = useState(prospect.contact)
  const [editedCompany, setEditedCompany] = useState(prospect.company)
  const [editedEmail, setEditedEmail] = useState(prospect.email)
  const [editedPhone, setEditedPhone] = useState(prospect.phone)
  const [editedTimezone, setEditedTimezone] = useState<string>(prospect.timezone || '')

  // Re-render once a minute so the prospect's current local time stays fresh
  const [, setNowTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setNowTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Notes internes
  const [editingNotes, setEditingNotes] = useState(false)
  const [tempNotes, setTempNotes] = useState(parseNotesField(prospect.notes).internal)

  // Call notes
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Reminders
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderDesc, setReminderDesc] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [reminderSubmitting, setReminderSubmitting] = useState(false)
  const [prospectReminders, setProspectReminders] = useState<any[]>([])
  const [remindersLoading, setRemindersLoading] = useState(false)
  const [reminderActionLoading, setReminderActionLoading] = useState<number | null>(null)

  // Quick booking
  const [showBookModal, setShowBookModal] = useState(false)
  const [bookDate, setBookDate] = useState('')
  const [bookTime, setBookTime] = useState('')
  const [bookDuration, setBookDuration] = useState(30)
  const [bookTitle, setBookTitle] = useState('')
  const [bookDescription, setBookDescription] = useState('')
  const [bookAssigneeId, setBookAssigneeId] = useState<string>('')
  const [bookSubmitting, setBookSubmitting] = useState(false)

  // Tags
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string; is_system?: boolean }[]>([])
  const [prospectTagIds, setProspectTagIds] = useState<string[]>([])
  const [showTagPicker, setShowTagPicker] = useState(false)

  useEffect(() => {
    const ownerId = isTeamMember ? ownerUserId : user?.id
    if (!ownerId || !prospect.id) return
    supabase.from('business_tags').select('id, name, color, is_system').eq('owner_id', ownerId)
      .then(({ data }) => setAllTags(data || []))
    supabase.from('business_prospect_tags').select('tag_id').eq('prospect_id', prospect.id)
      .then(({ data }) => setProspectTagIds((data || []).map(d => d.tag_id)))
  }, [prospect.id, user?.id, ownerUserId, isTeamMember])

  const handleToggleTag = async (tagId: string) => {
    const tag = allTags.find(t => t.id === tagId)
    if (tag?.is_system && prospectTagIds.includes(tagId)) {
      await supabase.rpc('remove_system_tag_from_prospect', { p_prospect_id: prospect.id, p_tag_id: tagId })
      const next = prospectTagIds.filter(id => id !== tagId)
      setProspectTagIds(next)
      onTagsChange?.(prospect.id, next)
      return
    }
    if (prospectTagIds.includes(tagId)) {
      await supabase.from('business_prospect_tags').delete().eq('prospect_id', prospect.id).eq('tag_id', tagId)
      const next = prospectTagIds.filter(id => id !== tagId)
      setProspectTagIds(next)
      onTagsChange?.(prospect.id, next)
    } else {
      await supabase.from('business_prospect_tags').insert({ prospect_id: prospect.id, tag_id: tagId })
      const next = [...prospectTagIds, tagId]
      setProspectTagIds(next)
      onTagsChange?.(prospect.id, next)
    }
  }

  // Formula & Campaign
  const [formula, setFormula] = useState<Formula | null>(null)
  const [allFormulas, setAllFormulas] = useState<Formula[]>([])
  const [campaign, setCampaign] = useState<Campaign | null>(null)

  // Sync local on prospect ID change (new prospect selected)
  useEffect(() => {
    const p = { ...prospect }
    setLocal(p)
    setTempNotes(parseNotesField(p.notes).internal)
    setEditedContact(p.contact)
    setEditedCompany(p.company)
    setEditedEmail(p.email)
    setEditedPhone(p.phone)
  }, [prospect.id])

  // Fetch all formulas
  useEffect(() => {
    const effectiveId = isTeamMember ? ownerUserId : user?.id
    if (!effectiveId) return
    fetch(`${API_URL}?action=formulas-list&user_id=${effectiveId}`)
      .then(r => r.json())
      .then(data => {
        const formulas = data.formulas || []
        setAllFormulas(formulas)
        if (prospect.formula_id) {
          const f = formulas.find((f: Formula) => f.id === prospect.formula_id)
          setFormula(f || null)
        } else {
          setFormula(null)
        }
      })
      .catch(() => { setAllFormulas([]); setFormula(null) })
  }, [user?.id, ownerUserId, isTeamMember, prospect.formula_id])

  // Check Stripe connection
  const effectiveOwnerId = isTeamMember ? ownerUserId : user?.id
  useEffect(() => {
    if (!effectiveOwnerId) return
    supabase.from('profiles').select('stripe_connected, stripe_account_id').eq('id', effectiveOwnerId).maybeSingle()
      .then(({ data }) => setStripeConnected(!!(data?.stripe_connected && data?.stripe_account_id)))
  }, [effectiveOwnerId])

  // Stripe: auto-match by email
  const handleStripeAutoMatch = async () => {
    if (!effectiveOwnerId || !local.email) return
    setStripeAutoStatus('loading')
    try {
      const res = await fetch('/api/business-auto-match-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveOwnerId, prospect_id: local.id, email: local.email }),
      })
      const data = await res.json()
      if (data.matched) {
        setStripeAutoStatus('matched')
        onUpdate(local.id, {
          stripe_customer_id: data.stripe_customer_id,
          stripe_subscription_id: data.stripe_subscription_id,
          subscription_status: data.subscription_status,
          subscription_amount: data.subscription_amount,
          subscription_interval: data.subscription_interval,
          matched_via: data.matched_via,
        } as any)
        toast.success(t.prospect_toast_stripe_auto)
      } else {
        setStripeAutoStatus('not_found')
      }
    } catch {
      setStripeAutoStatus('not_found')
    }
  }

  // Stripe: search by email
  const handleStripeSearch = async () => {
    if (!effectiveOwnerId || !stripeSearchEmail.trim()) return
    setStripeSearching(true)
    setStripeSearched(false)
    try {
      const res = await fetch(`/api/business-stripe-search?user_id=${effectiveOwnerId}&email=${encodeURIComponent(stripeSearchEmail.trim())}`)
      const data = await res.json()
      setStripeSearchResults(data.customers || [])
      setStripeSearched(true)
    } catch {
      setStripeSearchResults([])
      setStripeSearched(true)
    }
    setStripeSearching(false)
  }

  // Stripe: select subscription from search
  const handleStripeSelectSub = async (customerId: string, subscriptionId: string) => {
    if (!effectiveOwnerId) return
    setStripeMatching(true)
    try {
      const res = await fetch('/api/business-stripe-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveOwnerId, prospect_id: local.id, stripe_customer_id: customerId, stripe_subscription_id: subscriptionId }),
      })
      const data = await res.json()
      if (data.matched) {
        onUpdate(local.id, {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: data.subscription_status,
          subscription_amount: data.subscription_amount,
          subscription_interval: data.subscription_interval,
          matched_via: 'manual',
        } as any)
        setStripeAutoStatus('matched')
        setStripeLinkOpen(false)
        toast.success(t.prospect_toast_stripe_linked)
      } else {
        toast.error(t.prospect_toast_stripe_error)
      }
    } catch {
      toast.error(t.prospect_toast_stripe_link_error)
    }
    setStripeMatching(false)
  }

  // Stripe: manual match (subscription ID optional)
  const handleStripeManualMatch = async () => {
    if (!effectiveOwnerId || !stripeManualCusId.trim()) return
    setStripeMatching(true)
    try {
      const res = await fetch('/api/business-stripe-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveOwnerId, prospect_id: local.id, stripe_customer_id: stripeManualCusId.trim(), ...(stripeManualSubId.trim() ? { stripe_subscription_id: stripeManualSubId.trim() } : {}) }),
      })
      const data = await res.json()
      if (data.matched) {
        onUpdate(local.id, {
          stripe_customer_id: stripeManualCusId.trim(),
          ...(stripeManualSubId.trim() ? { stripe_subscription_id: stripeManualSubId.trim() } : {}),
          subscription_status: data.subscription_status,
          subscription_amount: data.subscription_amount,
          subscription_interval: data.subscription_interval,
          matched_via: 'manual',
        } as any)
        setStripeAutoStatus('matched')
        setStripeLinkOpen(false)
        toast.success(t.prospect_toast_stripe_manual)
      } else {
        toast.error(t.prospect_toast_stripe_error)
      }
    } catch {
      toast.error(t.prospect_toast_stripe_link_error)
    }
    setStripeMatching(false)
  }

  // Fetch linked campaign
  useEffect(() => {
    const effectiveId = isTeamMember ? ownerUserId : user?.id
    if (!effectiveId || !(prospect as any).campaign_id) { setCampaign(null); return }
    fetch(`${API_URL}?action=campaigns-list&user_id=${effectiveId}`)
      .then(r => r.json())
      .then(data => {
        const c = (data.campaigns || []).find((c: Campaign) => c.id === (prospect as any).campaign_id)
        setCampaign(c || null)
      })
      .catch(() => setCampaign(null))
  }, [user?.id, ownerUserId, isTeamMember, (prospect as any).campaign_id])

  // Fetch reminders
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

  const activeRemindersCount = prospectReminders.filter(r => !r.is_done).length

  // History
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  const historyInitRef = useRef(false)

  useEffect(() => {
    if (activeTab !== 'historique' || !prospect.id) return
    setHistoryLoading(true)
    historyInitRef.current = false
    supabase
      .from('business_prospect_history')
      .select('*')
      .eq('prospect_id', prospect.id)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        setHistory(data || [])
        setHistoryLoading(false)
      })
  }, [activeTab, prospect.id])

  // Group history entries by timestamp (same insert = same created_at)
  interface HistoryGroup {
    key: string
    created_at: string
    changed_by_name: string
    type: 'created' | 'stage_change' | 'stripe_linked' | 'stripe_renewal' | 'field_update'
    entries: any[]
    metadata?: Record<string, string>
  }

  const historyGroups = useMemo<HistoryGroup[]>(() => {
    const groups: HistoryGroup[] = []
    for (const entry of history) {
      if (entry.change_type === 'created') {
        groups.push({
          key: entry.created_at,
          created_at: entry.created_at,
          changed_by_name: entry.changed_by_name || t.prospect_system_author,
          type: 'created',
          entries: [entry],
          metadata: entry.metadata || {},
        })
        continue
      }
      const last = groups[groups.length - 1]
      if (last && last.type !== 'created' && last.created_at === entry.created_at && last.changed_by_name === entry.changed_by_name) {
        last.entries.push(entry)
        if (entry.change_type === 'stage_change') last.type = 'stage_change'
        else if (entry.change_type === 'stripe_linked' && last.type === 'field_update') last.type = 'stripe_linked'
        else if (entry.change_type === 'stripe_renewal') last.type = 'stripe_renewal'
      } else {
        groups.push({
          key: `${entry.created_at}_${entry.id}`,
          created_at: entry.created_at,
          changed_by_name: entry.changed_by_name || t.prospect_system_author,
          type: entry.change_type || 'field_update',
          entries: [entry],
        })
      }
    }
    return groups
  }, [history, t])

  // Auto-expand last group on first load
  useEffect(() => {
    if (historyGroups.length > 0 && !historyInitRef.current) {
      historyInitRef.current = true
      setExpandedHistory(new Set([historyGroups[historyGroups.length - 1].key]))
    }
  }, [historyGroups])

  // Helpers for resolving IDs to display names
  const resolveMemberName = useCallback((id: string | null | undefined) => {
    if (!id) return t.prospect_assign_none
    const member = teamMembers.find(m => m.id === id)
    if (member) return `${member.first_name} ${member.last_name}`.trim()
    return id
  }, [teamMembers])

  const resolveStageLabel = useCallback((stage: string | null | undefined) => {
    if (!stage) return t.prospect_assign_none
    const custom = customStages.find(s => s.id === stage)
    if (custom) return custom.label
    const s = ALL_STAGES.find(s => s.id === stage)
    return s?.name || stage
  }, [customStages])

  const resolveFormulaName = useCallback((formulaId: string | null | undefined) => {
    if (!formulaId) return t.prospect_history_none_formula
    const f = allFormulas.find(f => f.id === formulaId)
    return f?.name || formulaId
  }, [allFormulas])

  const formatHistoryValue = useCallback((field: string, value: string | null | undefined): string => {
    if (value == null || value === '') return t.prospect_history_empty
    if (field === 'assigned_to' || field === 'assigned_setter') return resolveMemberName(value)
    if (field === 'stage') return resolveStageLabel(value)
    if (field === 'formula_id') return resolveFormulaName(value)
    if (field === 'value') return `${Number(value).toLocaleString('fr-FR')}€`
    if (field === 'probability') return `${value}%`
    if (field === 'pipeline_visible') return value === 'true' ? t.prospect_history_yes : t.prospect_history_no
    if (field === 'payment_type') {
      const labels: Record<string, string> = { once: t.prospect_history_cash, installments: t.prospect_history_installments_label, cash: t.prospect_history_cash, comptant: t.prospect_history_cash }
      return labels[value] || value
    }
    if (field === 'avatar_url') return t.prospect_history_photo_updated
    return value
  }, [resolveMemberName, resolveStageLabel, resolveFormulaName])

  // -- Optimistic update helper --
  const handleUpdate = (updates: Partial<BusinessProspect>) => {
    setLocal(prev => ({ ...prev, ...updates }))
    const { id: _id, ...dbUpdates }: any = { ...updates }
    if (updates.call_notes !== undefined) {
      dbUpdates.call_notes = updates.call_notes
    }
    onUpdate(prospect.id, dbUpdates)
  }

  // -- Client save --
  const handleSaveClient = () => {
    const nameParts = editedContact.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    handleUpdate({ contact: editedContact, firstName, lastName, company: editedCompany, email: editedEmail, phone: editedPhone, timezone: editedTimezone || null })
    setEditingClient(false)
  }

  // -- Notes --
  const handleSaveNotes = () => {
    const { capture } = parseNotesField(local.notes)
    // Lead issu d'un formulaire de capture : on conserve les réponses et on range
    // les notes internes sous la clé réservée, au lieu d'écraser le JSON.
    const nextNotes = capture
      ? JSON.stringify({ ...capture, ...(tempNotes ? { [INTERNAL_NOTES_KEY]: tempNotes } : {}) })
      : tempNotes
    handleUpdate({ notes: nextNotes })
    setEditingNotes(false)
  }

  // -- Call notes --
  const callNotes: CallNote[] = local.call_notes || []

  const handleAddManualNote = () => {
    const content = noteTextareaRef.current?.value || ''
    if (!content.trim()) return
    const newNote: CallNote = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      content,
      author: t.prospect_manual_author,
    }
    const updated = [newNote, ...callNotes]
    handleUpdate({ call_notes: updated })
    if (noteTextareaRef.current) noteTextareaRef.current.value = ''
    setIsAddingNote(false)
  }

  const handleDeleteNote = (noteId: string) => {
    if (!confirm(t.prospect_confirm_delete_note)) return
    const updated = callNotes.filter(n => n.id !== noteId)
    handleUpdate({ call_notes: updated })
  }

  // -- Reminders --
  const handleCreateReminder = async () => {
    if (!user || !reminderTitle.trim() || !reminderDate || !reminderTime) return
    setReminderSubmitting(true)
    try {
      const reminder_date = new Date(`${reminderDate}T${reminderTime}`).toISOString()
      const { data, error } = await supabase
        .from('reminders')
        .insert([{ user_id: user.id, title: reminderTitle.trim(), description: reminderDesc.trim() || null, reminder_date, prospect_id: prospect.id, is_done: false }])
        .select().single()
      if (error) throw error
      setProspectReminders(prev => [...prev, data])
      setShowReminderForm(false)
      setReminderTitle(''); setReminderDesc(''); setReminderDate(''); setReminderTime('')
      toast.success(t.prospect_toast_reminder_created)
    } catch { toast.error(t.prospect_toast_reminder_error) }
    finally { setReminderSubmitting(false) }
  }

  const handleMarkReminderDone = async (id: number) => {
    if (!user) return
    setReminderActionLoading(id)
    try {
      await supabase.from('reminders').update({ is_done: true }).eq('id', id).eq('user_id', user.id)
      setProspectReminders(prev => prev.map(r => r.id === id ? { ...r, is_done: true } : r))
    } catch { /* ignore */ }
    finally { setReminderActionLoading(null) }
  }

  const handleDeleteReminder = async (id: number) => {
    if (!user) return
    setReminderActionLoading(id)
    try {
      await supabase.from('reminders').delete().eq('id', id).eq('user_id', user.id)
      setProspectReminders(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
    finally { setReminderActionLoading(null) }
  }

  // -- Actions --
  const handleOpenGmail = () => {
    if (local.email) window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${local.email}`, '_blank')
    else toast.error(t.prospect_toast_email_missing)
  }
  const handleOpenWhatsApp = () => {
    if (local.phone) {
      const clean = local.phone.replace(/[^0-9+]/g, '')
      window.open(`https://wa.me/${clean}`, '_blank')
    } else toast.error(t.prospect_toast_phone_missing)
  }
  const handleDelete = () => {
    if (confirm(t.prospect_confirm_delete.replace('{name}', local.contact))) { onDelete(prospect.id); onClose() }
  }

  const openBookModal = () => {
    const now = new Date()
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    setBookDate(`${nextHour.getFullYear()}-${pad(nextHour.getMonth() + 1)}-${pad(nextHour.getDate())}`)
    setBookTime(`${pad(nextHour.getHours())}:${pad(nextHour.getMinutes())}`)
    setBookDuration(30)
    setBookTitle(`RDV avec ${local.contact || ''}`.trim())
    setBookDescription('')
    const defaultAssigneeId = isTeamMember ? (teamMember?.id || '') : (user?.id || '')
    setBookAssigneeId(defaultAssigneeId)
    setShowBookModal(true)
  }

  const handleBookSubmit = async () => {
    if (!bookDate || !bookTime || !bookAssigneeId) return
    setBookSubmitting(true)
    try {
      const ownerId = isTeamMember ? ownerUserId : user?.id
      if (!ownerId) throw new Error('No owner id')
      const isOwnerAssignee = bookAssigneeId === ownerId
      const payload = {
        owner_id: ownerId,
        prospect_id: prospect.id,
        assignee_type: isOwnerAssignee ? 'owner' : 'team_member',
        assignee_team_member_id: isOwnerAssignee ? null : bookAssigneeId,
        date: bookDate,
        time: bookTime,
        duration: bookDuration,
        title: bookTitle.trim() || `RDV avec ${local.contact || 'prospect'}`,
        timezone: userTimezone || 'Europe/Paris',
        description: bookDescription.trim(),
      }
      const res = await fetch(`${API_URL}?action=appointments-book-quick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || t.prospect_book_error)
        return
      }
      const warnings: string[] = data.warnings || []
      const noMeet = warnings.includes('no_google_calendar') || warnings.includes('gcal_failed')
      const noEmail = warnings.includes('no_prospect_email') || warnings.includes('email_failed')
      if (noMeet && noEmail) toast.success(t.prospect_book_success_no_meet_no_email)
      else if (noMeet) toast.success(t.prospect_book_success_no_meet)
      else if (noEmail) toast.success(t.prospect_book_success_no_email)
      else toast.success(t.prospect_book_success)
      setShowBookModal(false)
    } catch (err) {
      console.error(err)
      toast.error(t.prospect_book_error)
    } finally {
      setBookSubmitting(false)
    }
  }

  // Parse capture custom data + notes internes depuis la colonne `notes`
  const { capture: captureData, internal: internalNotes } = parseNotesField(local.notes)

  const content = (
      <aside className={inline
        ? "flex flex-col h-full overflow-hidden bg-white/70 dark:bg-neutral-900/90 backdrop-blur-[20px]"
        : "absolute inset-y-0 right-0 w-full md:max-w-[580px] flex flex-col shadow-2xl md:rounded-l-2xl md:border-l border-[#c4c7c7]/10 dark:border-neutral-700 overflow-hidden bg-white/70 dark:bg-neutral-900/90 backdrop-blur-[20px]"
      }>

        {/* Header */}
        <header className="p-4 md:p-6 pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex flex-col items-center shrink-0 gap-1">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative w-11 h-11 rounded-full bg-[#e4e2e1] dark:bg-neutral-800 flex items-center justify-center overflow-hidden text-lg font-business-display font-extrabold text-stone-500 dark:text-neutral-400 group cursor-pointer"
                  title={t.prospect_change_photo}
                >
                  {local.avatar_url ? (
                    <img src={local.avatar_url} alt={local.contact} className="w-full h-full object-cover" />
                  ) : (
                    (local.contact || '?')[0]?.toUpperCase()
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    {avatarUploading ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </button>
                {/* Qualification score ring */}
                {(() => {
                  if (!qualificationData?.answers) return null
                  if (qualificationData.questionnaire?.qualifying === false) return null
                  const scored = qualificationData.answers.filter(a => a.score !== null && a.score !== undefined)
                  if (scored.length === 0) return null
                  const avg = Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length)
                  const circumference = 2 * Math.PI * 24 // r=24
                  const strokeColor = avg < 40 ? 'stroke-red-500' : avg < 70 ? 'stroke-orange-500' : 'stroke-emerald-500'
                  const textColor = avg < 40 ? 'fill-red-500' : avg < 70 ? 'fill-orange-500' : 'fill-emerald-500'
                  return (
                    <svg className="w-10 h-10" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4.5" className="stroke-stone-200 dark:stroke-neutral-700" />
                      <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4.5"
                        className={strokeColor}
                        strokeDasharray={`${(avg / 100) * circumference} ${circumference}`}
                        strokeLinecap="round"
                        transform="rotate(-90 28 28)"
                      />
                      <text x="28" y="28" textAnchor="middle" dominantBaseline="central"
                        className={cn('text-xs font-extrabold', textColor)}>
                        {avg}%
                      </text>
                    </svg>
                  )
                })()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white truncate">
                    {local.contact || t.prospect_no_name}
                  </h2>
                  <DMRBadge prospect={local} size="sm" />
                </div>
                {local.company && (
                  <p className="text-stone-500 dark:text-neutral-400 font-medium truncate">{local.company}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center hover:bg-[#efedec] dark:hover:bg-neutral-700 transition-colors shrink-0"
            >
              <X className="h-5 w-5 text-stone-900 dark:text-white" strokeWidth={1.5} />
            </button>
          </div>

          {/* Tags - below name */}
          <div className="mt-2 ml-0 md:ml-[60px] relative">
            <div className="flex flex-wrap items-center gap-2">
              {prospectTagIds.map(tagId => {
                const tag = allTags.find(t => t.id === tagId)
                if (!tag) return null
                if (tag.is_system) {
                  return (
                    <button
                      key={tagId}
                      onClick={() => handleToggleTag(tagId)}
                      className="group inline-flex items-center gap-1.5 text-xs font-bold pl-2.5 pr-2 py-1 rounded-full text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
                    </button>
                  )
                }
                return (
                  <button
                    key={tagId}
                    onClick={() => handleToggleTag(tagId)}
                    className="group inline-flex items-center gap-1.5 text-xs font-semibold pl-2 pr-1.5 py-1 rounded-full border transition-all hover:opacity-80"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                    <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
                  </button>
                )
              })}
              <button
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-400 dark:text-neutral-500 px-2.5 py-1 rounded-full border border-dashed border-stone-300 dark:border-neutral-600 hover:border-stone-400 dark:hover:border-neutral-500 hover:text-stone-500 dark:hover:text-neutral-400 transition-all"
              >
                <Plus className="h-3 w-3" strokeWidth={2} />
                tag
              </button>
            </div>

            {/* Tag dropdown */}
            {showTagPicker && (
              <div className="absolute left-0 top-full mt-1.5 z-20 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-stone-200/60 dark:border-neutral-700 p-2 min-w-[200px] max-w-[300px]">
                <div className="flex flex-col gap-0.5">
                  {allTags.filter(t => !t.is_system).map(tag => {
                    const isActive = prospectTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.id)}
                        className={cn(
                          'flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-all',
                          isActive ? 'bg-stone-100 dark:bg-neutral-800 font-semibold' : 'hover:bg-stone-50 dark:hover:bg-neutral-800'
                        )}
                      >
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-stone-700 dark:text-neutral-200">{tag.name}</span>
                        {isActive && <Check className="h-3.5 w-3.5 text-stone-500 dark:text-neutral-400" strokeWidth={2} />}
                      </button>
                    )
                  })}
                  {allTags.length === 0 && (
                    <p className="text-xs text-stone-400 dark:text-neutral-500 text-center py-3">{t.prospect_no_tags}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Quick Actions */}
        <section className="px-6 py-3 flex flex-wrap gap-2.5 border-b border-[#c4c7c7]/10 dark:border-neutral-700">
          <button
            onClick={() => navigate(`/business/cockpit?name=${encodeURIComponent(local.contact)}&prospectId=${prospect.id}`)}
            className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-full font-business-display font-bold text-sm tracking-wide transition-transform active:scale-95 shadow-lg shadow-stone-900/20"
          >
            <PhoneCall className="h-4 w-4" strokeWidth={1.5} />
            {t.prospect_open_callroom}
          </button>
          <button
            onClick={() => setShowReminderForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#ffddb8] text-[#2a1700] dark:bg-amber-700/30 dark:text-amber-200 rounded-full font-business-display font-bold text-sm transition-all hover:brightness-105 active:scale-95"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            {t.prospect_create_reminder}
          </button>
          <button
            onClick={openBookModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#d4f0e2] text-[#0a3d2a] dark:bg-emerald-700/30 dark:text-emerald-200 rounded-full font-business-display font-bold text-sm transition-all hover:brightness-105 active:scale-95"
          >
            <CalendarPlus className="h-4 w-4" strokeWidth={1.5} />
            {t.prospect_book_appointment}
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleOpenGmail}
              className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 flex items-center justify-center text-stone-900 dark:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors"
            >
              <Mail className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 flex items-center justify-center text-stone-900 dark:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </section>

        {/* Tabs */}
        <nav className="px-4 md:px-6 pt-4 flex gap-4 md:gap-6 overflow-x-auto">
          {([
            { key: 'info' as const, label: t.prospect_tab_info },
            { key: 'notes' as const, label: t.prospect_tab_call_notes },
            { key: 'rappels' as const, label: t.prospect_tab_reminders, badge: activeRemindersCount },
            { key: 'historique' as const, label: t.prospect_tab_history },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'pb-4 font-business-display font-bold transition-all flex items-center gap-2',
                activeTab === tab.key
                  ? 'text-stone-900 dark:text-white font-extrabold border-b-2 border-stone-900 dark:border-white'
                  : 'text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white'
              )}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-2 py-0.5 bg-[#ffddb8] text-[#2a1700] dark:bg-amber-700/30 dark:text-amber-200 text-[10px] rounded-full font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">

          {/* ─── TAB: INFO ─── */}
          {activeTab === 'info' && (
            <div className="space-y-8">

              {/* Stage */}
              <div>
                <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_current_stage}</label>
                <div className="relative">
                  <select
                    value={local.stage}
                    onChange={(e) => {
                      const newStage = e.target.value
                      const wasFollowup = local.stage === 'followup'
                      handleUpdate({ stage: newStage })
                      if (newStage === 'followup' && !wasFollowup) {
                        openBookModal()
                      }
                    }}
                    className={cn(SELECT_CLS, 'py-4 px-5')}
                  >
                    {ALL_STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    {customStages.length > 0 && <option disabled>──────────</option>}
                    {customStages.map(cs => <option key={`custom_${cs.id}`} value={`custom_${cs.id}`}>{cs.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none h-5 w-5 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                </div>
              </div>

              {/* SECTION RAISON DE PERTE — visible quand stage = lost */}
              {local.stage === 'lost' && (() => {
                const isAssignedSetter = isTeamMember && teamMember?.id === (local as any).assigned_setter
                const canEditLoss = !isTeamMember || isHosOrAdmin || isAssignedSetter
                // Parse from call_notes if loss_reason is empty
                let displayReason = (local as any).loss_reason || ''
                let displayDetails = (local as any).loss_details || ''
                if (!displayReason && Array.isArray(local.call_notes)) {
                  for (let i = local.call_notes.length - 1; i >= 0; i--) {
                    const match = local.call_notes[i].content?.match(/- Motif: (.+)/)
                    if (match) { displayReason = match[1]; break }
                  }
                }
                const lossReasons = [t.loss_thinking, t.loss_budget, t.loss_need_talk, t.loss_not_now, t.loss_fear, t.loss_smokescreen, t.loss_other]
                return (
                  <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                    <h3 className="flex items-center gap-2 text-sm font-business-display font-extrabold text-red-600 dark:text-red-400 mb-3">
                      <X className="h-4 w-4" /> {t.prospect_loss_reason_title}
                    </h3>
                    <div className="space-y-3 rounded-2xl border border-red-500/20 bg-red-500/5 dark:bg-red-500/5 p-5">
                      {canEditLoss ? (
                        <>
                          <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-neutral-400 mb-1.5 block">{t.prospect_loss_reason_label}</label>
                            <div className="relative">
                              <select
                                value={displayReason}
                                onChange={(e) => handleUpdate({ loss_reason: e.target.value } as any)}
                                className={cn(SELECT_CLS, 'text-sm py-3')}
                              >
                                <option value="">{t.prospect_loss_reason_select}</option>
                                {lossReasons.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-stone-400" strokeWidth={1.5} />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-neutral-400 mb-1.5 block">{t.prospect_loss_details}</label>
                            <input
                              type="text"
                              value={displayDetails}
                              onChange={(e) => handleUpdate({ loss_details: e.target.value } as any)}
                              placeholder={t.prospect_loss_details_placeholder}
                              className={INPUT_CLS}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-neutral-400 mb-1 block">{t.prospect_loss_reason_label}</label>
                            <p className="text-sm font-medium text-stone-900 dark:text-white">{displayReason || '—'}</p>
                          </div>
                          {displayDetails && (
                            <div>
                              <label className="text-xs font-bold text-stone-500 dark:text-neutral-400 mb-1 block">{t.prospect_loss_details}</label>
                              <p className="text-sm text-stone-700 dark:text-neutral-300">{displayDetails}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* SECTION PAIEMENT — visible quand stage = won */}
              {local.stage === 'won' && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-business-display font-extrabold text-emerald-600 dark:text-emerald-400">
                      <CreditCard className="h-4 w-4" /> {t.prospect_payment_title}
                    </h3>
                    <button onClick={() => { setEditingPayment(!editingPayment); setEditedValue(local.value || 0); }} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>

                  {editingPayment ? (
                    <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/5 p-5">
                      {canEditPrice ? (
                        <div>
                          <label className="text-xs font-bold text-stone-500 dark:text-neutral-400">{t.prospect_payment_final_amount}</label>
                          <input
                            type="number"
                            value={editScheduleMode === 'custom' ? effectiveEditedValue : editedValue}
                            onChange={(e) => setEditedValue(parseFloat(e.target.value) || 0)}
                            readOnly={editScheduleMode === 'custom'}
                            className={cn("mt-1.5 w-full rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 text-sm font-bold text-stone-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all", editScheduleMode === 'custom' && 'opacity-60 cursor-not-allowed')}
                          />
                          {editScheduleMode === 'custom' && (
                            <p className="mt-1.5 text-[10px] text-stone-500 dark:text-neutral-400">{t.schedule_custom_amount_locked}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-500 dark:text-neutral-400">{t.prospect_payment_sale_amount}</span>
                          <span className="text-sm font-extrabold text-stone-900 dark:text-white">{effectiveEditedValue.toLocaleString()}€</span>
                        </div>
                      )}
                      <div className="flex rounded-xl bg-stone-100 dark:bg-neutral-800 p-1">
                        <button type="button" onClick={() => { setPaymentMode('cash'); setEditedInstallments(1); setEditScheduleMode('equal'); }} className={cn("flex-1 rounded-lg py-2 text-xs font-bold transition-all", paymentMode === 'cash' ? "bg-emerald-600 text-white shadow-md" : "text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white")}>{t.prospect_payment_cash}</button>
                        <button type="button" onClick={() => setPaymentMode('installments')} className={cn("flex-1 rounded-lg py-2 text-xs font-bold transition-all", paymentMode === 'installments' ? "bg-emerald-600 text-white shadow-md" : "text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white")}>{t.prospect_payment_installments}</button>
                      </div>
                      {paymentMode === 'installments' && (
                        <div className="animate-in fade-in slide-in-from-top-1 space-y-3">
                          <label className="text-xs font-bold text-stone-500 dark:text-neutral-400">{t.prospect_payment_nb_installments}</label>
                          <select
                            value={editScheduleMode === 'custom' ? 'custom' : String(editedInstallments)}
                            onChange={(e) => {
                              const v = e.target.value
                              if (v === 'custom') {
                                setEditScheduleMode('custom')
                                if (editCustomSchedule.length === 0) {
                                  const base = editedValue > 0 ? editedValue / editedInstallments : 0
                                  setEditCustomSchedule(Array.from({ length: editedInstallments }, (_, i) => ({ month: i + 1, amount: Math.round(base * 100) / 100 })))
                                }
                              } else {
                                setEditScheduleMode('equal')
                                setEditedInstallments(parseInt(v))
                              }
                            }}
                            className="mt-1.5 w-full rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 text-sm font-medium text-stone-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                          >
                            <option value="custom">{t.schedule_custom_option}</option>
                            {[2, 3, 4, 5, 6, 10, 12].map(n => (
                              <option key={n} value={n}>
                                {t.prospect_payment_times_per_month.replace('{n}', String(n)).replace('{amount}', `${(editedValue / n).toFixed(2)}€`)}
                              </option>
                            ))}
                          </select>
                          {editScheduleMode === 'custom' && (
                            <div className="rounded-xl border border-stone-200 dark:border-neutral-700 bg-white/40 dark:bg-neutral-800/40 p-3">
                              <InstallmentScheduleEditor
                                value={editCustomSchedule}
                                onChange={setEditCustomSchedule}
                                labels={{
                                  monthsCount: t.schedule_custom_months_label,
                                  month: t.schedule_custom_month,
                                  amount: t.schedule_custom_amount,
                                  total: t.schedule_custom_total,
                                  addRow: t.schedule_custom_add_row,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {!closerIsOwner && (
                      <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> {t.prospect_payment_commission.replace('{rate}', String(commissionRate))}</span>
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
                                  ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                  : 'border-stone-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 hover:border-amber-500 hover:text-amber-700'
                              )}
                            >
                              <Settings2 className="h-2.5 w-2.5" />
                              {editCustomCommissionEnabled ? t.custom_commission_cancel : t.custom_commission_btn}
                            </button>
                            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{commissionAmount.toFixed(2)}€</span>
                          </div>
                        </div>
                        {editCustomCommissionEnabled && (
                          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-2.5">
                            <label className="text-[10px] font-bold text-amber-800 dark:text-amber-400 mb-1 block">
                              {t.custom_commission_rate_label} <span className="font-normal text-stone-500">(standard : {standardCommissionRate}%)</span>
                            </label>
                            <div className="relative">
                              <input
                                type="number" min="0" max="100" step="0.1"
                                value={editCustomCommissionRate || ''}
                                onChange={(e) => setEditCustomCommissionRate(parseFloat(e.target.value) || 0)}
                                className="w-full rounded-lg border border-amber-300 bg-white dark:bg-neutral-800 px-3 py-2 pr-7 text-sm text-stone-900 dark:text-white focus:border-amber-500 focus:outline-none"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-700 text-xs">%</span>
                            </div>
                          </div>
                        )}
                        {paymentMode === 'installments' && editScheduleMode === 'equal' && (
                          <p className="mt-1 text-[10px] text-emerald-500/70 dark:text-emerald-300/70">
                            {t.prospect_payment_you_receive.replace('{amount}', `${(commissionAmount / editedInstallments).toFixed(2)}€`)}
                          </p>
                        )}
                      </div>
                      )}
                      {hasCustomException && isTeamMember && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-3 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">{t.custom_commission_banner_business}</p>
                        </div>
                      )}
                      <button onClick={handleSavePayment} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-business-display font-bold text-white hover:bg-emerald-500 transition-colors">{t.prospect_payment_validate}</button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/5 p-5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.prospect_payment_sale_amount}</span>
                        <span className="text-sm font-extrabold text-stone-900 dark:text-white">{(local.value || 0).toLocaleString()}€</span>
                      </div>
                      {!closerIsOwner && (
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.prospect_payment_total_commission.replace('{rate}', String(commissionRate))}</span>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">+{savedCommission.toFixed(2)}€</span>
                      </div>
                      )}

                      {isPayingInInstallments && (
                        <div className="mt-3 pt-3 border-t border-emerald-500/20 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-stone-500 dark:text-neutral-300">{t.prospect_payment_client_pays.replace('{count}', String(savedInstallments))}</span>
                            <span className="text-sm font-bold text-stone-900 dark:text-white">{savedMonthlyPayment.toFixed(2)}€ {t.prospect_payment_monthly}</span>
                          </div>
                          {!closerIsOwner && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">{t.prospect_payment_you_get}</span>
                            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{savedMonthlyCommission.toFixed(2)}€ {t.prospect_payment_monthly}</span>
                          </div>
                          )}
                        </div>
                      )}

                      <div className="pt-2.5 border-t border-emerald-500/20 text-center mt-2.5">
                        <span className="text-[10px] font-bold text-emerald-600/50 dark:text-emerald-300/50 uppercase tracking-widest">
                          {isPayingInInstallments ? t.prospect_payment_label_installments.replace('{count}', String(savedInstallments)) : t.prospect_payment_label_cash}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION COMMISSION INHABITUELLE + ÉCHÉANCIER CUSTOM */}
              {local.stage === 'won' && (local.custom_commission_rate != null || (local.installments_schedule && local.installments_schedule.length > 0)) && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-business-display font-extrabold text-amber-600 dark:text-amber-400">
                      <Award className="h-4 w-4" /> Détails inhabituels
                    </h3>
                    {local.commission_approval_status === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-500/15 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                        <AlertCircle className="h-3 w-3" /> {t.custom_commission_status_pending}
                      </span>
                    )}
                    {local.commission_approval_status === 'approved' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> {t.custom_commission_status_approved}
                      </span>
                    )}
                    {local.commission_approval_status === 'rejected' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-500/15 border border-red-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-700">
                        <XCircle className="h-3 w-3" /> {t.custom_commission_status_rejected}
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 dark:bg-amber-500/5 p-4 space-y-2">
                    {local.custom_commission_rate != null && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-stone-600 dark:text-neutral-300">{t.custom_commission_rate_label}</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">{local.custom_commission_rate}%</span>
                      </div>
                    )}
                    {local.installments_schedule && local.installments_schedule.length > 0 && (
                      <div className="pt-2 border-t border-amber-300/40">
                        <div className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-1.5">{t.approval_modal_schedule_title}</div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {local.installments_schedule.map((entry) => (
                            <div key={entry.month} className="flex justify-between text-xs">
                              <span className="text-stone-600 dark:text-neutral-300">{t.schedule_custom_month} {entry.month}</span>
                              <span className="font-semibold text-stone-900 dark:text-white">{Number(entry.amount).toFixed(2)} €</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bouton de validation visible pour HOS/Admin/Owner sur status pending */}
                  {local.commission_approval_status === 'pending' && local.commission_approval_id && (isOwner || isHosOrAdmin) && (
                    <button
                      onClick={() => setShowApprovalModal(true)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-3 text-sm font-bold text-white transition-all"
                    >
                      <Check className="h-4 w-4" /> Examiner et valider
                    </button>
                  )}
                </div>
              )}

              {/* Modal de validation */}
              {showApprovalModal && local.commission_approval_id && (
                <CommissionApprovalModal
                  approvalId={local.commission_approval_id}
                  onClose={() => setShowApprovalModal(false)}
                  onDecided={async () => {
                    // Refresh local state from DB
                    const { data } = await supabase.from('business_prospects').select('*').eq('id', local.id).maybeSingle()
                    if (data) setLocal(data as BusinessProspect)
                  }}
                />
              )}

              {/* SECTION STRIPE — visible quand prospect lié à Stripe ET Stripe connecté */}
              {local.stripe_subscription_id && stripeConnected && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                  <h3 className="flex items-center gap-2 text-sm font-business-display font-extrabold text-[#635BFF] mb-3">
                    <CreditCard className="h-4 w-4" /> {t.prospect_stripe_subscription}
                  </h3>
                  <div className="rounded-2xl border border-[#635BFF]/20 bg-[#635BFF]/5 p-5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.prospect_stripe_status}</span>
                      <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', {
                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400': local.subscription_status === 'active',
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400': local.subscription_status === 'past_due',
                        'bg-red-500/10 text-red-600 dark:text-red-400': local.subscription_status === 'canceled',
                        'bg-blue-500/10 text-blue-600 dark:text-blue-400': local.subscription_status === 'trialing',
                      })}>
                        {local.subscription_status === 'active' ? t.prospect_stripe_active : local.subscription_status === 'past_due' ? t.prospect_stripe_past_due : local.subscription_status === 'canceled' ? t.prospect_stripe_canceled : local.subscription_status === 'trialing' ? t.prospect_stripe_trialing : local.subscription_status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.prospect_stripe_amount_label}</span>
                      <span className="text-sm font-extrabold text-stone-900 dark:text-white">
                        {(Number(local.subscription_amount) || 0).toFixed(2)} EUR / {local.subscription_interval === 'month' ? t.prospect_stripe_month : t.prospect_stripe_year}
                      </span>
                    </div>
                    {local.last_payment_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.prospect_stripe_last_payment}</span>
                        <span className="text-xs text-stone-700 dark:text-neutral-300">{new Date(local.last_payment_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}</span>
                      </div>
                    )}
                    {local.next_payment_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.prospect_stripe_next_payment}</span>
                        <span className="text-xs text-stone-700 dark:text-neutral-300">{new Date(local.next_payment_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-[#635BFF]/10 text-center">
                      <span className="text-[10px] font-bold text-[#635BFF]/50 uppercase tracking-widest">
                        {local.matched_via === 'webhook' ? t.prospect_stripe_linked_webhook : local.matched_via === 'auto_won' ? t.prospect_stripe_linked_auto : t.prospect_stripe_linked_manual}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stripe linking — 3 modes */}
              {local.stage === 'won' && stripeConnected && !local.stripe_subscription_id && stripeAutoStatus !== 'matched' && !(isTeamMember && teamMember?.role === 'Setter') && (
                <div className="space-y-3">
                  {!stripeLinkOpen ? (
                    <button
                      onClick={() => { setStripeLinkOpen(true); setStripeSearchEmail(local.email || '') }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#635BFF]/30 text-[#635BFF] hover:bg-[#635BFF]/5 transition-colors text-sm font-bold"
                    >
                      <Link2 className="h-4 w-4" />
                      {t.prospect_stripe_link_btn}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-[#635BFF]/20 bg-[#635BFF]/5 dark:bg-[#635BFF]/5 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-business-display font-extrabold text-[#635BFF]">
                          <CreditCard className="h-4 w-4" /> {t.prospect_stripe_link_title}
                        </h3>
                        <button onClick={() => setStripeLinkOpen(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* 3 mode tabs */}
                      <div className="flex rounded-xl bg-white/60 dark:bg-neutral-800 p-1">
                        <button onClick={() => setStripeLinkMode('auto')}
                          className={cn('flex-1 rounded-lg py-2 text-[11px] font-bold transition-all flex items-center justify-center gap-1',
                            stripeLinkMode === 'auto' ? 'bg-[#635BFF] text-white shadow-sm' : 'text-stone-500 dark:text-neutral-400')}>
                          <Zap className="h-3 w-3" /> Auto
                        </button>
                        <button onClick={() => setStripeLinkMode('search')}
                          className={cn('flex-1 rounded-lg py-2 text-[11px] font-bold transition-all flex items-center justify-center gap-1',
                            stripeLinkMode === 'search' ? 'bg-[#635BFF] text-white shadow-sm' : 'text-stone-500 dark:text-neutral-400')}>
                          <Search className="h-3 w-3" /> {t.prospect_search_label}
                        </button>
                        <button onClick={() => setStripeLinkMode('manual')}
                          className={cn('flex-1 rounded-lg py-2 text-[11px] font-bold transition-all flex items-center justify-center gap-1',
                            stripeLinkMode === 'manual' ? 'bg-[#635BFF] text-white shadow-sm' : 'text-stone-500 dark:text-neutral-400')}>
                          <Link2 className="h-3 w-3" /> {t.prospect_manual_label}
                        </button>
                      </div>

                      {/* Auto */}
                      {stripeLinkMode === 'auto' && (
                        <div className="space-y-3">
                          <p className="text-xs text-stone-500 dark:text-neutral-400">
                            {t.prospect_stripe_auto_search} <span className="font-bold text-stone-700 dark:text-white">{local.email || '—'}</span>
                          </p>
                          {stripeAutoStatus === 'not_found' && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5 border border-amber-200 dark:border-amber-500/20">
                              {t.prospect_stripe_not_found}
                            </p>
                          )}
                          <button onClick={handleStripeAutoMatch} disabled={!local.email || stripeAutoStatus === 'loading'}
                            className="w-full py-2.5 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                            {stripeAutoStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-3.5 w-3.5" /> {t.prospect_stripe_search_btn}</>}
                          </button>
                        </div>
                      )}

                      {/* Search */}
                      {stripeLinkMode === 'search' && (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <input type="email" value={stripeSearchEmail} onChange={e => setStripeSearchEmail(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleStripeSearch()}
                              placeholder={t.prospect_stripe_search_placeholder}
                              className="flex-1 px-3 py-2 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30" />
                            <button onClick={handleStripeSearch} disabled={stripeSearching || !stripeSearchEmail.trim()}
                              className="px-3 py-2 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-bold rounded-lg transition-colors">
                              {stripeSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          {stripeSearched && stripeSearchResults.length === 0 && (
                            <p className="text-xs text-stone-500 dark:text-neutral-400 text-center py-3">{t.prospect_stripe_no_customer}</p>
                          )}
                          {stripeSearchResults.map((customer: any) => (
                            <div key={customer.id} className="bg-white dark:bg-neutral-800 rounded-xl p-3 border border-stone-200 dark:border-neutral-700">
                              <p className="text-xs font-bold text-stone-900 dark:text-white">{customer.name || customer.email}</p>
                              <p className="text-[10px] text-stone-500 font-mono mb-2">{customer.id}</p>
                              {customer.subscriptions?.length === 0 ? (
                                <p className="text-[10px] text-stone-400">{t.prospect_stripe_no_sub}</p>
                              ) : customer.subscriptions?.map((sub: any) => (
                                <button key={sub.id} onClick={() => handleStripeSelectSub(customer.id, sub.id)} disabled={stripeMatching}
                                  className="w-full flex items-center justify-between p-2.5 bg-stone-50 dark:bg-neutral-900 rounded-lg border border-stone-200 dark:border-neutral-700 hover:border-[#635BFF]/30 hover:bg-[#635BFF]/5 transition-all text-left group mt-1">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${sub.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                      <span className="text-xs font-medium text-stone-900 dark:text-white">{sub.amount?.toFixed(2)} EUR / {sub.interval === 'month' ? t.prospect_stripe_month : t.prospect_stripe_year}</span>
                                    </div>
                                    <p className="text-[9px] text-stone-500 font-mono mt-0.5">{sub.id}</p>
                                  </div>
                                  {stripeMatching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#635BFF]" /> : <CheckCircle2 className="h-4 w-4 text-[#635BFF] opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Manual */}
                      {stripeLinkMode === 'manual' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-bold text-stone-500 dark:text-neutral-400 mb-1">Customer ID</label>
                            <input type="text" value={stripeManualCusId} onChange={e => setStripeManualCusId(e.target.value)} placeholder="cus_..."
                              className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg text-xs text-stone-900 dark:text-white font-mono placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-stone-500 dark:text-neutral-400 mb-1">Subscription ID</label>
                            <input type="text" value={stripeManualSubId} onChange={e => setStripeManualSubId(e.target.value)} placeholder="sub_..."
                              className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg text-xs text-stone-900 dark:text-white font-mono placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30" />
                          </div>
                          <button onClick={handleStripeManualMatch} disabled={stripeMatching || !stripeManualCusId.trim() || !stripeManualSubId.trim()}
                            className="w-full py-2.5 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                            {stripeMatching ? <Loader2 className="h-4 w-4 animate-spin" /> : t.prospect_stripe_link_manual_btn}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Stripe linked success (inline) */}
              {local.stage === 'won' && formula?.billing_type === 'subscription' && stripeConnected && !local.stripe_subscription_id && stripeAutoStatus === 'matched' && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{t.prospect_stripe_linked_success}</p>
                </div>
              )}

              {/* Assignment */}
              {teamMembers.length > 0 && (() => {
                const closers = teamMembers.filter(tm => tm.role === 'Closer' || tm.role === 'Setter-Closer' || tm.role === 'Head of Sales' || tm.role === 'Admin' || (tm.owner_assignable_roles || []).includes('Closer') || (!isTeamMember && tm.role === 'Owner'))
                const setters = teamMembers.filter(tm => tm.role === 'Setter' || tm.role === 'Setter-Closer' || tm.role === 'Head of Sales' || tm.role === 'Admin' || (tm.owner_assignable_roles || []).includes('Setter') || (!isTeamMember && tm.role === 'Owner'))

                return (
                  <div className="grid grid-cols-2 gap-4">
                    {closers.length > 0 && (
                      <div>
                        <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_assign_closer}</label>
                        <div className="relative">
                          <select
                            value={closers.find(c => c.id === (local as any).assigned_to)?.id || ''}
                            onChange={(e) => handleUpdate({ assigned_to: e.target.value || null } as any)}
                            disabled={!canAssign}
                            className={cn(SELECT_CLS, 'text-sm font-semibold font-sans', !canAssign && 'opacity-60 cursor-not-allowed')}
                          >
                            <option value="">{t.prospect_assign_none}</option>
                            {closers.map(tm => (
                              <option key={tm.id} value={tm.id}>
                                {tm.first_name} {tm.last_name}{tm.role === 'Owner' ? ' (Owner)' : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                        </div>
                      </div>
                    )}

                    {setters.length > 0 && (
                      <div>
                        <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_assign_setter}</label>
                        <div className="relative">
                          <select
                            value={setters.find(s => s.id === (local as any).assigned_setter)?.id || ''}
                            onChange={(e) => {
                              const setterId = e.target.value || null
                              const updates: any = { assigned_setter: setterId }
                              if (setterId) {
                                const selected = teamMembers.find(tm => tm.id === setterId)
                                if (selected?.role === 'Setter-Closer' && selected?.setter_scope === 'self') {
                                  updates.assigned_to = setterId
                                }
                              }
                              handleUpdate(updates)
                            }}
                            disabled={!(!isTeamMember || isHosOrAdmin)}
                            className={cn(SELECT_CLS, 'text-sm font-semibold font-sans', !(!isTeamMember || isHosOrAdmin) && 'opacity-60 cursor-not-allowed')}
                          >
                            <option value="">{t.prospect_assign_none}</option>
                            {setters.map(tm => (
                              <option key={tm.id} value={tm.id}>
                                {tm.first_name} {tm.last_name}{tm.role === 'Owner' ? ' (Owner)' : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Campagne d'origine */}
              {campaign && (
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_campaign_origin}</label>
                  <div className="rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 px-5 py-3.5">
                    <p className="font-business-display font-bold text-stone-900 dark:text-white">{campaign.name}</p>
                  </div>
                </div>
              )}

              {/* Offre / Formule */}
              <div>
                <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_offer_formula}</label>
                <div className="relative">
                  <select
                    value={(local as any).formula_id || ''}
                    onChange={(e) => {
                      const fId = e.target.value || null
                      const selected = allFormulas.find(f => f.id === fId)
                      const hasStripe = !!(local as any).stripe_customer_id || !!(local as any).stripe_subscription_id
                      handleUpdate({ formula_id: fId, ...(hasStripe ? {} : { value: selected?.price || 0 }) } as any)
                      setFormula(selected || null)
                    }}
                    className={cn(SELECT_CLS, 'py-4 px-5')}
                  >
                    <option value="">{t.prospect_no_offer}</option>
                    {allFormulas.map(f => (
                      <option key={f.id} value={f.id}>{f.name} — {f.price}€</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none h-5 w-5 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                </div>
                {formula && formula.resources && formula.resources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {formula.resources.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-neutral-200 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" strokeWidth={1.5} /> {r.name || r.type}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Capture custom data */}
              {captureData && Object.keys(captureData).length > 0 && (
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-2 ml-1 flex items-center gap-2')}>
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.5} /> {t.prospect_capture_responses}
                  </label>
                  <div className="rounded-xl bg-white dark:bg-neutral-800 p-5 space-y-3 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm">
                    {Object.entries(captureData).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2">
                        <span className="text-xs font-bold text-stone-500 dark:text-neutral-400 min-w-0 shrink-0">{key} :</span>
                        <span className="text-sm text-stone-900 dark:text-white">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Qualification (questionnaire answers) */}
              {qualificationData && qualificationData.answers.length > 0 && (() => {
                const isQualifying = qualificationData.questionnaire?.qualifying !== false
                const scoredAnswers = qualificationData.answers.filter(a => a.score !== null && a.score !== undefined)
                const avgScore = isQualifying && scoredAnswers.length > 0 ? Math.round(scoredAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0) / scoredAnswers.length) : null
                const eliminatoryCount = qualificationData.answers.filter(a => a.is_eliminatory).length
                const maxElim = qualificationData.questionnaire?.max_eliminatory ?? 0
                return (
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-2 ml-1 flex items-center gap-2')}>
                      <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.5} /> {isQualifying ? t.prospect_qualification : t.prospect_answers}
                    </label>
                    <div className="rounded-xl bg-white dark:bg-neutral-800 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm space-y-4">
                      {/* Global summary — only in qualifying mode */}
                      {isQualifying && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {avgScore !== null && (
                            <div className={cn(
                              'text-lg font-extrabold font-business-display',
                              avgScore >= 70 ? 'text-emerald-500' : avgScore >= 40 ? 'text-orange-500' : 'text-red-500'
                            )}>
                              {avgScore}%
                            </div>
                          )}
                          <span className="text-xs text-stone-500 dark:text-neutral-400">{t.prospect_global_score}</span>
                        </div>
                        <div className={cn(
                          'text-xs font-bold px-2.5 py-1 rounded-lg',
                          eliminatoryCount > maxElim
                            ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-stone-100 text-stone-500 dark:bg-neutral-700 dark:text-neutral-400'
                        )}>
                          {t.prospect_eliminatory.replace('{count}', String(eliminatoryCount)).replace('{max}', String(maxElim))}
                          {eliminatoryCount > maxElim && ` — ${t.prospect_disqualified}`}
                        </div>
                      </div>
                      )}

                      {/* Per-question cards */}
                      <div className="space-y-2">
                        {qualificationData.answers.map((a, i) => {
                          if (!isQualifying) {
                            // Neutral mode: grey cards, just question + answer
                            return (
                              <div key={i} className="p-3 rounded-lg border border-stone-100 bg-stone-50 dark:border-neutral-700 dark:bg-neutral-800/50">
                                <p className="text-xs font-bold text-stone-700 dark:text-neutral-300">{a.question_text}</p>
                                <p className="text-sm text-stone-900 dark:text-white mt-1">
                                  {Array.isArray(a.answer_value) ? a.answer_value.join(', ') : String(a.answer_value ?? '')}
                                </p>
                              </div>
                            )
                          }
                          const isText = a.question_type === 'text' || a.score === null
                          const scoreColor = a.is_eliminatory ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                            : isText ? 'border-stone-100 bg-stone-50 dark:border-neutral-700 dark:bg-neutral-800/50'
                            : (a.score ?? 0) >= 70 ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'
                            : (a.score ?? 0) >= 40 ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/10'
                            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                          return (
                            <div key={i} className={cn('p-3 rounded-lg border', scoreColor)}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-bold text-stone-700 dark:text-neutral-300">{a.question_text}</p>
                                {!isText && (
                                  <span className={cn(
                                    'text-xs font-extrabold flex-shrink-0',
                                    (a.score ?? 0) >= 70 ? 'text-emerald-600' : (a.score ?? 0) >= 40 ? 'text-orange-600' : 'text-red-600'
                                  )}>
                                    {a.score}%
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-stone-900 dark:text-white mt-1">
                                {Array.isArray(a.answer_value) ? a.answer_value.join(', ') : String(a.answer_value ?? '')}
                              </p>
                              {!isText && (
                                <div className="w-full h-1.5 bg-stone-200 dark:bg-neutral-700 rounded-full mt-2 overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      (a.score ?? 0) >= 70 ? 'bg-emerald-500' : (a.score ?? 0) >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                    )}
                                    style={{ width: `${a.score ?? 0}%` }}
                                  />
                                </div>
                              )}
                              {a.is_eliminatory && (
                                <span className="inline-block mt-1.5 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">{t.prospect_eliminatory_label}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Réponses du questionnaire externe (lead_answers) */}
              {(() => {
                const la = (local as any).lead_answers
                const arr = Array.isArray(la) ? la : (la && typeof la === 'object' ? Object.entries(la).map(([q, a]) => ({ question: q, answer: a })) : [])
                if (arr.length === 0) return null
                return (
                  <section className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-[#c4c7c7]/5 dark:border-neutral-700">
                    <h3 className={cn(LABEL_STYLE, 'text-xs mb-4')}>Réponses du questionnaire externe</h3>
                    <ul className="space-y-3">
                      {arr.map((qa: any, i: number) => {
                        const q = qa?.question ?? qa?.q ?? qa?.question_text ?? '?'
                        const a = qa?.answer ?? qa?.a ?? qa?.answer_value ?? ''
                        const aText = a && typeof a === 'object' ? JSON.stringify(a) : String(a ?? '')
                        return (
                          <li key={i} className="border-l-2 border-[#c4c7c7]/30 pl-4">
                            <p className="text-xs font-bold text-stone-500 dark:text-neutral-400">{String(q)}</p>
                            <p className="text-sm text-[#1b1c1b] dark:text-white mt-0.5 whitespace-pre-wrap break-words">{aText}</p>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })()}

              {/* Données additionnelles (metadata) */}
              {(() => {
                const md = (local as any).metadata
                if (!md || typeof md !== 'object' || Array.isArray(md)) return null
                const entries = Object.entries(md).filter(([, v]) => v !== null && v !== undefined && v !== '')
                if (entries.length === 0) return null
                return (
                  <section className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-[#c4c7c7]/5 dark:border-neutral-700">
                    <h3 className={cn(LABEL_STYLE, 'text-xs mb-4')}>Données additionnelles</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {entries.map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs font-bold text-stone-500 dark:text-neutral-400">{k}</dt>
                          <dd className="text-sm text-[#1b1c1b] dark:text-white mt-0.5 break-words">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )
              })()}

              {/* Fiche Client */}
              <section className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-[#c4c7c7]/5 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn(LABEL_STYLE, 'text-xs')}>{t.prospect_client_card}</h3>
                  <button onClick={() => setEditingClient(!editingClient)} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                {editingClient ? (
                  <div className="space-y-3">
                    <input type="text" value={editedContact} onChange={e => setEditedContact(e.target.value)} className={INPUT_CLS} placeholder={t.prospect_field_contact} />
                    <input type="text" value={editedCompany} onChange={e => setEditedCompany(e.target.value)} className={INPUT_CLS} placeholder={t.prospect_field_company} />
                    <input type="email" value={editedEmail} onChange={e => setEditedEmail(e.target.value)} className={INPUT_CLS} placeholder="Email" />
                    <PhoneInput value={editedPhone} onChange={setEditedPhone} />
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 ml-1">Fuseau horaire</label>
                      <TimezonePicker value={editedTimezone} onChange={setEditedTimezone} />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleSaveClient} className="flex-1 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-business-display font-bold text-white hover:bg-stone-800 transition-colors">{t.prospect_sauvegarder}</button>
                      <button onClick={() => { setEditingClient(false); setEditedContact(local.contact); setEditedCompany(local.company); setEditedEmail(local.email); setEditedPhone(local.phone); setEditedTimezone(local.timezone || '') }} className="rounded-full border border-[#c4c7c7]/20 dark:border-neutral-700 px-4 py-2.5 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors">{t.prospect_cancel_btn}</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center text-stone-500 dark:text-neutral-400">
                        <Mail className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">Email</p>
                        <button onClick={handleOpenGmail} className="text-sm font-semibold text-stone-900 dark:text-white hover:text-[#006c49] truncate text-left transition-colors">{local.email || '—'}</button>
                      </div>
                      {local.email && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(local.email!); toast.success(t.common_copied) }}
                          className="shrink-0 p-2 rounded-full text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors"
                          title={t.common_copy}
                          aria-label={t.common_copy}
                        >
                          <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center text-stone-500 dark:text-neutral-400">
                        <Phone className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{t.prospect_phone}</p>
                        <button onClick={handleOpenWhatsApp} className="text-sm font-semibold text-stone-900 dark:text-white hover:text-[#006c49] text-left transition-colors">{local.phone || '—'}</button>
                      </div>
                      {local.phone && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(local.phone!); toast.success(t.common_copied) }}
                          className="shrink-0 p-2 rounded-full text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors"
                          title={t.common_copy}
                          aria-label={t.common_copy}
                        >
                          <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                    {(() => {
                      const tz = local.timezone
                      if (!tz) {
                        return (
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center text-stone-500 dark:text-neutral-400">
                              <Globe className="h-5 w-5" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">Fuseau horaire</p>
                              <button onClick={() => setEditingClient(true)} className="text-sm font-medium text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300 italic transition-colors">Non renseigné — cliquer pour ajouter</button>
                            </div>
                          </div>
                        )
                      }
                      const local2 = getCurrentLocalTime(tz)
                      const offset = getTimezoneOffsetHours(tz, userTimezone)
                      const sign = offset > 0 ? '+' : ''
                      const offsetTxt = Number.isInteger(offset) ? `${sign}${offset}h` : `${sign}${offset.toFixed(1)}h`
                      return (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center text-stone-500 dark:text-neutral-400">
                            <Globe className="h-5 w-5" strokeWidth={1.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">Fuseau horaire</p>
                            <p className="text-sm font-semibold text-stone-900 dark:text-white">{getTimezoneLabel(tz)}</p>
                            <p className="text-[11px] text-stone-500 dark:text-neutral-400 mt-0.5">
                              Il est <span className="font-semibold text-stone-700 dark:text-neutral-200">{local2.time}</span> chez le prospect ({local2.day})
                            </p>
                            {tz !== userTimezone && (
                              <p className="text-[11px] text-stone-500 dark:text-neutral-400">
                                <span className="font-semibold text-stone-700 dark:text-neutral-200">{offsetTxt}</span> par rapport à toi
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center text-stone-500 dark:text-neutral-400">
                        <Calendar className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{t.prospect_creation_date}</p>
                        <p className="text-sm font-semibold text-stone-900 dark:text-white">
                          {local.created_at ? new Date(local.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          }) : '—'}
                        </p>
                      </div>
                    </div>
                    {nextAppointment && (
                      <div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[#006c49]/10 flex items-center justify-center text-[#006c49]">
                            <Calendar className="h-5 w-5" strokeWidth={1.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-[#006c49] uppercase tracking-wider">{t.prospect_next_appointment}</p>
                            <p className="text-sm font-semibold text-stone-900 dark:text-white">
                              {new Date(nextAppointment.date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
                                weekday: 'short', day: 'numeric', month: 'long'
                              })} {lang === 'en' ? 'at' : 'à'} {nextAppointment.time?.slice(0, 5)}
                            </p>
                            {(() => {
                              const ptz = local.timezone
                              if (!ptz || ptz === userTimezone || !nextAppointment.datetime_utc) return null
                              const pl = fromUTC(nextAppointment.datetime_utc, ptz)
                              const pdate = new Date(pl.date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
                              return (
                                <p className="text-[11px] text-stone-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1" title={`Heure locale du prospect (${getTimezoneLabel(ptz)})`}>
                                  <Globe className="h-3 w-3" strokeWidth={1.5} />
                                  {pdate} {lang === 'en' ? 'at' : 'à'} {pl.time} chez le prospect
                                </p>
                              )
                            })()}
                          </div>
                          {allAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length > 1 && (
                            <button
                              onClick={() => setShowApptsModal(true)}
                              title="Voir tous les rendez-vous à venir"
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#006c49]/10 hover:bg-[#006c49]/20 px-3 py-1.5 text-xs font-business-display font-bold text-[#006c49] transition-colors"
                            >
                              <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
                              {allAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3 pl-14">
                          <button
                            onClick={openRescheduleModal}
                            disabled={cancelLoading || rescheduleLoading}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 hover:bg-stone-200 dark:hover:bg-neutral-700 px-3 py-1.5 text-xs font-business-display font-bold text-stone-700 dark:text-neutral-200 transition-colors disabled:opacity-50"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                            Reprogrammer
                          </button>
                          <button
                            onClick={handleCancelAppointment}
                            disabled={cancelLoading || rescheduleLoading}
                            className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 px-3 py-1.5 text-xs font-business-display font-bold text-rose-600 dark:text-rose-400 transition-colors disabled:opacity-50"
                          >
                            {cancelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} />}
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Notes internes */}
              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label className={LABEL_STYLE}>{t.prospect_internal_notes}</label>
                  <button onClick={() => setEditingNotes(!editingNotes)} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                {editingNotes ? (
                  <div>
                    <textarea value={tempNotes} onChange={e => setTempNotes(e.target.value)} className={cn(INPUT_CLS, 'resize-none h-32')} placeholder={t.prospect_notes_placeholder} />
                    <div className="mt-3 flex gap-2">
                      <button onClick={handleSaveNotes} className="rounded-full bg-stone-900 px-5 py-2 text-sm font-business-display font-bold text-white hover:bg-stone-800 transition-colors">{t.prospect_save_btn}</button>
                      <button onClick={() => setEditingNotes(false)} className="rounded-full border border-[#c4c7c7]/20 px-5 py-2 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors">{t.prospect_cancel_btn}</button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 p-5">
                    <p className="whitespace-pre-wrap text-sm text-stone-600 dark:text-neutral-300">
                      {internalNotes || t.prospect_no_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB: NOTES D'APPEL ─── */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {!isAddingNote ? (
                <button
                  onClick={() => setIsAddingNote(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 py-4 text-sm font-business-display font-bold text-stone-500 dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 hover:border-stone-300 dark:hover:border-neutral-600 transition-all"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} /> {t.prospect_add_manual_note}
                </button>
              ) : (
                <div className="rounded-xl bg-white dark:bg-neutral-800 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm">
                  <h4 className={cn(LABEL_STYLE, 'mb-3')}>{t.prospect_new_note}</h4>
                  <textarea
                    ref={noteTextareaRef}
                    defaultValue=""
                    placeholder={t.prospect_note_placeholder}
                    className={cn(INPUT_CLS, 'min-h-[100px] mb-3')}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setIsAddingNote(false); if (noteTextareaRef.current) noteTextareaRef.current.value = '' }} className="px-4 py-2 text-sm font-medium text-stone-500 dark:text-neutral-400 hover:text-stone-700 dark:hover:text-neutral-200 rounded-full hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors">{t.prospect_cancel_btn}</button>
                    <button onClick={handleAddManualNote} className="px-5 py-2 rounded-full bg-stone-900 text-sm font-business-display font-bold text-white hover:bg-stone-800 disabled:opacity-50 transition-colors">{t.prospect_save_btn}</button>
                  </div>
                </div>
              )}

              <div className="h-px bg-[#c4c7c7]/20 dark:bg-neutral-700 my-4" />

              <div className="space-y-3">
                {callNotes.length > 0 ? (
                  callNotes.map(note => (
                    <details key={note.id} className="group rounded-xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700 open:shadow-sm transition-all overflow-hidden">
                      <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f3f2] dark:bg-neutral-700 text-stone-400 dark:text-neutral-400 group-open:bg-[#ffddb8] group-open:text-[#2a1700] dark:group-open:bg-amber-700/30 dark:group-open:text-amber-200 transition-colors">
                            <Calendar className="h-4 w-4" strokeWidth={1.5} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-stone-900 dark:text-white">
                              {new Date(note.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
                              <Clock className="h-3 w-3" strokeWidth={1.5} />
                              <span>{new Date(note.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              {note.author && <><span>·</span><span className="uppercase tracking-wider">{note.author}</span></>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={e => { e.preventDefault(); handleDeleteNote(note.id) }} className="rounded-full p-1.5 text-stone-400 hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/5 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                          <ChevronDown className="h-5 w-5 text-stone-400 dark:text-neutral-500 transition-transform duration-300 group-open:rotate-180" strokeWidth={1.5} />
                        </div>
                      </summary>
                      <div className="border-t border-[#c4c7c7]/10 dark:border-neutral-700 p-5 pt-3">
                        <p className="text-sm text-stone-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                      </div>
                    </details>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f3f2] dark:bg-neutral-800 mb-3">
                      <ClipboardList className="h-6 w-6 text-stone-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-medium text-stone-500 dark:text-neutral-400">{t.prospect_no_call_notes}</p>
                    <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">{t.prospect_manual_notes_hint}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB: RAPPELS ─── */}
          {activeTab === 'rappels' && (
            <div className="space-y-4">
              <button
                onClick={() => setShowReminderForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50 py-4 text-sm font-business-display font-bold text-stone-500 dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 hover:border-stone-300 dark:hover:border-neutral-600 transition-all"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} /> {t.prospect_add_reminder}
              </button>

              {remindersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-stone-400" strokeWidth={1.5} />
                </div>
              ) : prospectReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f3f2] dark:bg-neutral-800 mb-3">
                    <Bell className="h-6 w-6 text-stone-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-stone-500 dark:text-neutral-400">{t.prospect_no_reminders}</p>
                  <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">{t.prospect_create_reminder_hint}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {prospectReminders.map(reminder => {
                    const isDone = reminder.is_done
                    const isOverdue = !isDone && new Date(reminder.reminder_date) < new Date()
                    const isLoading = reminderActionLoading === reminder.id
                    return (
                      <div
                        key={reminder.id}
                        className={cn(
                          'rounded-xl p-4 transition-all',
                          isDone ? 'bg-[#f5f3f2] dark:bg-neutral-800' : isOverdue ? 'bg-[#ba1a1a]/5 dark:bg-red-900/20 ring-1 ring-[#ba1a1a]/10 dark:ring-red-500/20' : 'bg-white dark:bg-neutral-800 border border-[#c4c7c7]/10 dark:border-neutral-700'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-sm font-semibold', isDone ? 'text-stone-400 dark:text-neutral-500 line-through' : 'text-stone-900 dark:text-white')}>
                              {reminder.title}
                            </p>
                            {reminder.description && <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5 truncate">{reminder.description}</p>}
                            <div className="flex items-center gap-2 mt-1.5">
                              <Clock className="h-3 w-3 text-stone-400" strokeWidth={1.5} />
                              <span className={cn('text-xs', isOverdue ? 'text-[#ba1a1a] font-medium' : 'text-stone-400')}>
                                {new Date(reminder.reminder_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })} {lang === 'en' ? 'at' : 'à'} {new Date(reminder.reminder_date).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isDone && <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">{t.prospect_reminder_done}</span>}
                              {isOverdue && <span className="text-[10px] text-[#ba1a1a] font-bold uppercase tracking-wider">{t.prospect_reminder_overdue}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!isDone && (
                              <button onClick={() => handleMarkReminderDone(reminder.id)} disabled={isLoading} className="rounded-full p-2 text-[#006c49] hover:bg-[#006c49]/10 transition-colors disabled:opacity-50">
                                <Check className="h-4 w-4" strokeWidth={1.5} />
                              </button>
                            )}
                            <button onClick={() => handleDeleteReminder(reminder.id)} disabled={isLoading} className="rounded-full p-2 text-stone-400 hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/5 transition-colors disabled:opacity-50">
                              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: HISTORIQUE ─── */}
          {activeTab === 'historique' && (
            <div className="space-y-1">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-stone-400" strokeWidth={1.5} />
                </div>
              ) : historyGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border-2 border-dashed border-stone-200/30 dark:border-neutral-700 bg-[#f5f3f2]/50 dark:bg-neutral-800/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f3f2] dark:bg-neutral-800 mb-3">
                    <Clock className="h-6 w-6 text-stone-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-stone-500 dark:text-neutral-400">{t.prospect_no_history}</p>
                  <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">{t.prospect_history_changes_hint}</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {historyGroups.map((group, gIdx) => {
                    const isExpanded = expandedHistory.has(group.key)
                    const isLast = gIdx === historyGroups.length - 1
                    const date = new Date(group.created_at)
                    const timeStr = date.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ` ${lang === 'en' ? 'at' : 'à'} ` + date.toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })

                    const FIELD_LABELS: Record<string, string> = {
                      firstName: t.prospect_field_firstname, lastName: t.prospect_field_lastname, contact: t.prospect_field_contact,
                      email: t.prospect_field_email, phone: t.prospect_field_phone_label, company: t.prospect_field_company, title: t.prospect_field_title,
                      stage: t.prospect_field_stage, value: t.prospect_field_value,
                      offer: t.prospect_field_offer, offer_id: t.prospect_field_offer_id, formula_id: t.prospect_field_formula_id,
                      assigned_to: t.prospect_field_assigned_closer, assigned_setter: t.prospect_field_assigned_setter,
                      payment_type: t.prospect_field_payment_type, installments: t.prospect_field_installments,
                      probability: t.prospect_field_probability, notes: t.prospect_field_notes_label,
                      avatar_url: t.prospect_field_avatar, pipeline_visible: t.prospect_field_pipeline_visible,
                      loss_reason: t.prospect_field_loss_reason, loss_details: t.prospect_field_loss_details,
                      stripe_subscription_id: t.prospect_field_stripe_sub, subscription_status: t.prospect_field_sub_status,
                    }

                    const CHANGE_ICONS: Record<string, { icon: typeof Plus; bg: string; text: string }> = {
                      created: { icon: Plus, bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
                      stage_change: { icon: Tag, bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
                      stripe_renewal: { icon: CreditCard, bg: 'bg-[#635BFF]/10', text: 'text-[#635BFF]' },
                      stripe_linked: { icon: Link2, bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
                      field_update: { icon: Pencil, bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
                    }

                    const style = CHANGE_ICONS[group.type] || CHANGE_ICONS.field_update
                    const IconComponent = style.icon

                    let title = ''
                    if (group.type === 'created') {
                      title = t.prospect_history_created
                    } else if (group.type === 'stage_change') {
                      const stageEntry = group.entries.find(e => e.change_type === 'stage_change')
                      title = stageEntry ? t.prospect_history_stage_arrow.replace('{stage}', resolveStageLabel(stageEntry.new_value)) : t.prospect_history_step_change
                    } else if (group.type === 'stripe_renewal') {
                      title = t.prospect_history_stripe_renewal
                    } else if (group.type === 'stripe_linked') {
                      title = t.prospect_history_stripe_linked
                    } else {
                      const count = group.entries.length
                      title = count === 1
                        ? t.prospect_history_field_modified.replace('{field}', FIELD_LABELS[group.entries[0].field_name] || group.entries[0].field_name)
                        : t.prospect_history_fields_modified.replace('{count}', String(count))
                    }

                    return (
                      <div key={group.key}>
                        <button
                          onClick={() => setExpandedHistory(prev => {
                            const next = new Set(prev)
                            next.has(group.key) ? next.delete(group.key) : next.add(group.key)
                            return next
                          })}
                          className="w-full text-left rounded-xl border border-stone-200/60 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 hover:bg-[#f5f3f2]/50 dark:hover:bg-neutral-700/50 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn('p-1.5 rounded-lg shrink-0', style.bg)}>
                              <IconComponent className={cn('h-3.5 w-3.5', style.text)} strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-stone-900 dark:text-white truncate">{title}</p>
                              <p className="text-[10px] text-stone-400 dark:text-neutral-500">
                                {t.prospect_history_by} {group.changed_by_name} &bull; {timeStr}
                              </p>
                            </div>
                            <ChevronDown className={cn('h-4 w-4 text-stone-400 transition-transform shrink-0', isExpanded && 'rotate-180')} />
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-neutral-700">
                              {group.type === 'created' && group.metadata ? (
                                <div className="space-y-1.5">
                                  {Object.entries(group.metadata).map(([field, val]) => (
                                    <div key={field} className="flex items-start gap-2">
                                      <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 w-24 shrink-0 pt-0.5 truncate">{FIELD_LABELS[field] || field}</span>
                                      <span className="text-xs text-stone-900 dark:text-white font-medium">{formatHistoryValue(field, val)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {group.entries.map((entry: any) => {
                                    const fieldLabel = FIELD_LABELS[entry.field_name] || entry.field_name
                                    const oldDisplay = formatHistoryValue(entry.field_name, entry.old_value)
                                    const newDisplay = formatHistoryValue(entry.field_name, entry.new_value)
                                    return (
                                      <div key={entry.id} className="flex items-start gap-2">
                                        <span className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 w-24 shrink-0 pt-0.5 truncate">{fieldLabel}</span>
                                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                          {entry.old_value && (
                                            <>
                                              <span className="text-xs text-stone-500 dark:text-neutral-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-md border border-red-100 dark:border-red-500/20 line-through truncate max-w-[140px]">
                                                {oldDisplay}
                                              </span>
                                              <span className="text-[10px] text-stone-400 dark:text-neutral-500">→</span>
                                            </>
                                          )}
                                          <span className="text-xs text-stone-900 dark:text-white bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-500/20 font-medium truncate max-w-[140px]">
                                            {newDisplay}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </button>

                        {!isLast && (
                          <div className="flex justify-center py-1">
                            <div className="flex flex-col items-center">
                              <div className="w-px h-2 bg-stone-200 dark:bg-neutral-700" />
                              <ChevronDown className="h-3 w-3 text-stone-300 dark:text-neutral-600 -my-0.5" />
                              <div className="w-px h-2 bg-stone-200 dark:bg-neutral-700" />
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

        {/* Quick booking modal */}
        {showBookModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm" onClick={() => !bookSubmitting && setShowBookModal(false)} />
            <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-[#c4c7c7]/10 dark:border-neutral-700">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c7c7]/10 dark:border-neutral-700">
                <h3 className="font-business-display font-extrabold text-stone-900 dark:text-white">{t.prospect_book_modal_title}</h3>
                <button onClick={() => !bookSubmitting && setShowBookModal(false)} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_book_title_label}</label>
                  <input
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                {(() => {
                  const ptz = local.timezone
                  if (!ptz || ptz === userTimezone || !bookDate || !bookTime) return null
                  let prospectDate: string, prospectTime: string
                  try {
                    const utc = toUTC(bookDate, bookTime, userTimezone)
                    const pl = fromUTC(utc, ptz)
                    prospectDate = pl.date
                    prospectTime = pl.time
                  } catch { return null }
                  const offset = getTimezoneOffsetHours(ptz, userTimezone)
                  const sign = offset > 0 ? '+' : ''
                  const offsetTxt = Number.isInteger(offset) ? `${sign}${offset}h` : `${sign}${offset.toFixed(1)}h`
                  const pDateFr = new Date(prospectDate + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
                  return (
                    <div className="rounded-xl bg-[#006c49]/5 dark:bg-[#006c49]/10 border border-[#006c49]/15 px-3 py-2 flex items-center gap-2 text-xs text-stone-700 dark:text-neutral-200" title={getTimezoneLabel(ptz)}>
                      <Globe className="h-3.5 w-3.5 text-[#006c49] shrink-0" strokeWidth={1.5} />
                      <span>
                        Chez le prospect : <strong className="font-semibold">{pDateFr} {lang === 'en' ? 'at' : 'à'} {prospectTime}</strong>
                        <span className="text-stone-500 dark:text-neutral-400"> ({offsetTxt} vs toi)</span>
                      </span>
                    </div>
                  )
                })()}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_book_date}</label>
                    <input
                      type="date"
                      value={bookDate}
                      onChange={(e) => setBookDate(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_book_time}</label>
                    <input
                      type="time"
                      value={bookTime}
                      onChange={(e) => setBookTime(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_book_duration}</label>
                  <div className="relative">
                    <select
                      value={bookDuration}
                      onChange={(e) => setBookDuration(Number(e.target.value))}
                      className={SELECT_CLS}
                    >
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                  </div>
                </div>
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>{t.prospect_book_assignee}</label>
                  <div className="relative">
                    <select
                      value={bookAssigneeId}
                      onChange={(e) => setBookAssigneeId(e.target.value)}
                      className={SELECT_CLS}
                    >
                      {(() => {
                        const ownerId = isTeamMember ? ownerUserId : user?.id
                        const currentId = isTeamMember ? teamMember?.id : user?.id
                        const seen = new Set<string>()
                        const options: { id: string; label: string }[] = []
                        // Owner self-assignment is always allowed when current user IS the owner.
                        // For team members, owner appears only if owner_assignable is enabled (already handled in teamMembers fetch).
                        if (!isTeamMember && ownerId) {
                          options.push({ id: ownerId, label: `${t.prospect_book_assignee_you} ${t.prospect_book_assignee_owner_suffix}` })
                          seen.add(ownerId)
                        }
                        for (const m of teamMembers) {
                          if (seen.has(m.id)) continue
                          seen.add(m.id)
                          const isMe = m.id === currentId
                          const isOwnerRow = m.role === 'Owner'
                          const name = `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Sans nom'
                          const suffix = isOwnerRow ? ` ${t.prospect_book_assignee_owner_suffix}` : (m.role ? ` (${m.role})` : '')
                          const label = isMe ? `${t.prospect_book_assignee_you}${suffix}` : `${name}${suffix}`
                          options.push({ id: m.id, label })
                        }
                        return options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)
                      })()}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                  </div>
                </div>
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>Description</label>
                  <textarea
                    value={bookDescription}
                    onChange={(e) => setBookDescription(e.target.value)}
                    placeholder="Ajoutez une description pour ce rendez-vous (optionnel)…"
                    rows={3}
                    className={cn(INPUT_CLS, 'resize-none')}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#c4c7c7]/10 dark:border-neutral-700">
                <button
                  onClick={() => !bookSubmitting && setShowBookModal(false)}
                  disabled={bookSubmitting}
                  className="px-4 py-2 rounded-full text-sm font-business-display font-bold text-stone-500 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {t.prospect_book_cancel}
                </button>
                <button
                  onClick={handleBookSubmit}
                  disabled={!bookDate || !bookTime || !bookAssigneeId || bookSubmitting}
                  className="px-5 py-2 rounded-full text-sm font-business-display font-bold bg-stone-900 text-white hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {bookSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> {t.prospect_book_submitting}</> : t.prospect_book_submit}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule modal */}
        {showApptsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm" onClick={() => setShowApptsModal(false)} />
            <div className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-[#c4c7c7]/10 dark:border-neutral-700">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c7c7]/10 dark:border-neutral-700">
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-5 w-5 text-[#006c49]" strokeWidth={1.5} />
                  <h3 className="font-business-display font-extrabold text-stone-900 dark:text-white">Rendez-vous de {prospect.contact || 'ce prospect'}</h3>
                </div>
                <button onClick={() => setShowApptsModal(false)} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="px-4 py-4 space-y-2 overflow-y-auto">
                {(() => {
                  const STATUS_UI: Record<string, { label: string; cls: string }> = {
                    pending: { label: 'En attente', cls: 'bg-amber-100/80 text-amber-700' },
                    confirmed: { label: 'Confirmé', cls: 'bg-[#006c49]/10 text-[#006c49]' },
                    cancelled: { label: 'Annulé', cls: 'bg-rose-100/80 text-rose-600' },
                    done: { label: 'Terminé', cls: 'bg-stone-200/70 text-stone-600 dark:bg-neutral-800 dark:text-neutral-300' },
                  }
                  const endTime = (time: string, dur?: number) => {
                    const [h, m] = (time || '00:00').split(':').map(Number)
                    const e = new Date(2000, 0, 1, h || 0, m || 0)
                    e.setMinutes(e.getMinutes() + (dur || 30))
                    return `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`
                  }
                  // Uniquement les RDV à venir / en cours (sans les annulés ni les terminés), du plus proche au plus lointain.
                  const sorted = allAppointments
                    .filter(a => a.status === 'pending' || a.status === 'confirmed')
                    .sort((a, b) => (a.datetime_utc || `${a.date}T${a.time}`).localeCompare(b.datetime_utc || `${b.date}T${b.time}`))
                  return sorted.map(a => {
                    const ui = STATUS_UI[a.status] ?? { label: a.status, cls: 'bg-stone-200/70 text-stone-600' }
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#c4c7c7]/15 dark:border-neutral-800 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-business-display font-bold text-stone-900 dark:text-white">{a.time} — {endTime(a.time, a.duration)}</p>
                          <p className="text-xs text-stone-500 dark:text-neutral-400 capitalize">
                            {new Date(a.date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${ui.cls}`}>{ui.label}</span>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>
        )}

        {showRescheduleModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm" onClick={() => !rescheduleLoading && setShowRescheduleModal(false)} />
            <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-[#c4c7c7]/10 dark:border-neutral-700">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c7c7]/10 dark:border-neutral-700">
                <h3 className="font-business-display font-extrabold text-stone-900 dark:text-white">Reprogrammer le rendez-vous</h3>
                <button onClick={() => !rescheduleLoading && setShowRescheduleModal(false)} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs text-stone-500 dark:text-neutral-400">Le prospect recevra automatiquement un email avec la nouvelle date.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>Date</label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-2 ml-1')}>Heure</label>
                    <input
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#c4c7c7]/10 dark:border-neutral-700">
                <button
                  onClick={() => !rescheduleLoading && setShowRescheduleModal(false)}
                  disabled={rescheduleLoading}
                  className="px-4 py-2 rounded-full text-sm font-business-display font-bold text-stone-500 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRescheduleSubmit}
                  disabled={!rescheduleDate || !rescheduleTime || rescheduleLoading}
                  className="px-5 py-2 rounded-full text-sm font-business-display font-bold bg-stone-900 text-white hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {rescheduleLoading ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> Envoi…</> : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reminder creation modal */}
        {showReminderForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm" onClick={() => setShowReminderForm(false)} />
            <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-[#c4c7c7]/10 dark:border-neutral-700">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c7c7]/10 dark:border-neutral-700">
                <h3 className="font-business-display font-extrabold text-stone-900 dark:text-white">{t.prospect_new_reminder}</h3>
                <button onClick={() => setShowReminderForm(false)} className="rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-1.5')}>{t.prospect_reminder_title}</label>
                  <input type="text" value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} placeholder={t.prospect_reminder_title_placeholder} className={INPUT_CLS} autoFocus />
                </div>
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-1.5')}>{t.prospect_reminder_description}</label>
                  <textarea value={reminderDesc} onChange={e => setReminderDesc(e.target.value)} placeholder={t.prospect_reminder_desc_placeholder} rows={2} className={cn(INPUT_CLS, 'resize-none')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-1.5')}>{t.prospect_reminder_date}</label>
                    <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-1.5')}>{t.prospect_reminder_time}</label>
                    <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className={INPUT_CLS} />
                  </div>
                </div>
                <div className="rounded-xl bg-[#ffddb8]/30 dark:bg-amber-700/20 px-4 py-3">
                  <p className="text-xs text-[#2a1700] dark:text-amber-200 font-medium">
                    <Bell className="h-3 w-3 inline mr-1" strokeWidth={1.5} />
                    {t.prospect_reminder_linked} <span className="font-bold">{local.contact || t.prospect_reminder_this_prospect}</span>
                  </p>
                </div>
                <button
                  onClick={handleCreateReminder}
                  disabled={!reminderTitle.trim() || !reminderDate || !reminderTime || reminderSubmitting}
                  className="w-full rounded-full bg-stone-900 py-3 text-sm font-business-display font-bold text-white hover:bg-stone-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {reminderSubmitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" strokeWidth={1.5} /> : t.prospect_reminder_create_btn}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="p-4 md:p-8 border-t border-[#c4c7c7]/10 dark:border-neutral-700 flex justify-between items-center bg-white/20 dark:bg-neutral-900/20">
          <div className="flex items-center gap-2">
            {(isOwner || isHosOrAdmin) && (
              <button
                onClick={handleDelete}
                className="text-[#ba1a1a] font-business-display font-bold text-sm flex items-center gap-2 px-4 py-2 hover:bg-[#ba1a1a]/5 rounded-full transition-colors"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                {t.prospect_footer_delete}
              </button>
            )}
            <button
              onClick={async () => {
                if (!user) return
                try {
                  if (isDismissed) {
                    await supabase.from('business_pipeline_dismissals').delete().eq('user_id', user.id).eq('prospect_id', prospect.id)
                    toast.success(t.prospect_toast_added_pipeline)
                    setIsDismissed(false)
                    onDismissFromPipeline?.(prospect.id, false)
                  } else {
                    await supabase.from('business_pipeline_dismissals').upsert({ user_id: user.id, prospect_id: prospect.id }, { onConflict: 'user_id,prospect_id' })
                    toast.success(t.prospect_toast_removed_pipeline)
                    setIsDismissed(true)
                    onDismissFromPipeline?.(prospect.id, true)
                    onClose()
                  }
                } catch { toast.error(t.prospect_toast_error) }
              }}
              className={cn(
                "font-business-display font-bold text-sm flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
                isDismissed
                  ? "text-[#006c49] hover:bg-[#006c49]/10"
                  : "text-stone-500 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800"
              )}
            >
              {isDismissed ? (
                <><Plus className="h-4 w-4" strokeWidth={1.5} /> {t.prospect_footer_add_pipeline}</>
              ) : (
                <><X className="h-4 w-4" strokeWidth={1.5} /> {t.prospect_footer_remove_pipeline}</>
              )}
            </button>
          </div>
          <button
            onClick={() => handleUpdate(local)}
            className="bg-stone-900 text-white px-8 py-3 rounded-full font-business-display font-bold text-sm transition-transform active:scale-95"
          >
            {t.prospect_footer_save}
          </button>
        </footer>
      </aside>
  )

  if (inline) return content

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-stone-900/10 dark:bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {content}
    </div>
  )
}
