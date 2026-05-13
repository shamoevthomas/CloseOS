import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, DollarSign,
  Calendar, Award, Bell, Loader2, Settings2,
  User, Shuffle, ArrowRightCircle, CalendarCheck, AlertCircle,
  ChevronLeft, ChevronRight, PhoneMissed, UserPlus, Lock,
  CreditCard, Search, Link2, Zap,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { InstallmentScheduleEditor, type ScheduleEntry } from '../../components/InstallmentScheduleEditor'
import { createCommissionApproval } from '../services/commissionApproval'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { supabase } from '../../lib/supabase'
import { toUTC } from '../../lib/timezone'
import toast from 'react-hot-toast'

const getObjectionReasons = (t: any) => [
  t.closer_calldetails_objection_think,
  t.closer_calldetails_objection_budget,
  t.closer_calldetails_objection_discuss,
  t.closer_calldetails_objection_timing,
  t.closer_calldetails_objection_fear,
  t.closer_calldetails_objection_smokescreen,
  t.closer_calldetails_objection_other,
]

const getCloserOutcomes = (t: any) => [
  { id: 'won', label: t.closer_calldetails_outcome_won, icon: CheckCircle2, iconClass: 'text-emerald-600' },
  { id: 'followup', label: t.closer_calldetails_outcome_followup, icon: Clock, iconClass: 'text-stone-500' },
  { id: 'lost', label: t.closer_calldetails_outcome_lost, icon: XCircle, iconClass: 'text-stone-500' },
  { id: 'noshow', label: t.closer_calldetails_outcome_noshow, icon: PhoneMissed, iconClass: 'text-stone-500' },
]

const getSetterOutcomesForOwner = (t: any) => [
  { id: 'qualified', label: t.closer_calldetails_setter_qualified, icon: CheckCircle2, iconClass: 'text-emerald-600' },
  { id: 'booklater', label: t.closer_calldetails_setter_booklater, icon: Calendar, iconClass: 'text-stone-500' },
  { id: 'unqualified', label: t.closer_calldetails_setter_unqualified, icon: XCircle, iconClass: 'text-stone-500' },
  { id: 'noanswer', label: t.closer_calldetails_setter_noanswer, icon: PhoneMissed, iconClass: 'text-stone-500' },
]

interface Formula {
  id: string
  name: string
  price: number
  commission?: string
  billing_type?: 'one_time' | 'subscription' | 'quote'
}

interface CloserMember {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

interface AvailabilitySlot {
  day_of_week: number
  start_time: string
  end_time: string
}

interface Absence {
  start_date: string
  end_date: string
}

interface TimeSlot {
  date: string
  time: string
  dateLabel: string
  timeLabel: string
}

export function CloserCallDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isReadonly = searchParams.get('readonly') === '1'
  const { user, teamMember, ownerUserId, isTeamMember, userTimezone } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const objectionReasons = getObjectionReasons(t)
  const closerOutcomes = getCloserOutcomes(t)
  const setterOutcomesForOwner = getSetterOutcomesForOwner(t)
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const isSetterCloser = isTeamMember && teamMember?.role === 'Setter-Closer'
  const isSetterCloserSelf = isSetterCloser && teamMember?.setter_scope === 'self'
  const showSetterOutcomes = isOwnerView || isSetterCloser
  const { prospects, addProspect, updateProspect } = useBusinessProspects()
  const { createEvent: createGoogleEvent, isConnected: isGoogleConnected } = useBusinessGoogleCalendar()
  const { getStagesForRole } = useCustomStages()
  const closerCustomStages = getStagesForRole('Closer')

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

  // Custom commission + custom installment schedule
  const [customCommissionEnabled, setCustomCommissionEnabled] = useState(false)
  const [customCommissionRate, setCustomCommissionRate] = useState<number>(0)
  const [scheduleMode, setScheduleMode] = useState<'equal' | 'custom'>('equal')
  const [customSchedule, setCustomSchedule] = useState<ScheduleEntry[]>([])
  const [memberCommissionRate, setMemberCommissionRate] = useState<number | null>(null)

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

  // Create prospect from call
  const [creatingProspect, setCreatingProspect] = useState(false)
  const [newProspectEmail, setNewProspectEmail] = useState('')
  const [newProspectPhone, setNewProspectPhone] = useState('')
  const [newProspectCompany, setNewProspectCompany] = useState('')

  // Formulas for commission calc
  const [formulas, setFormulas] = useState<Formula[]>([])

  // Stripe linking
  const [stripeConnected, setStripeConnected] = useState(false)
  const [stripeLinkMode, setStripeLinkMode] = useState<'auto' | 'search' | 'manual'>('auto')
  const [stripeSearchEmail, setStripeSearchEmail] = useState('')
  const [stripeSearching, setStripeSearching] = useState(false)
  const [stripeSearchResults, setStripeSearchResults] = useState<any[]>([])
  const [stripeSearched, setStripeSearched] = useState(false)
  const [stripeMatching, setStripeMatching] = useState(false)
  const [stripeManualCustomerId, setStripeManualCustomerId] = useState('')
  const [stripeManualSubId, setStripeManualSubId] = useState('')
  const [stripeAutoResult, setStripeAutoResult] = useState<{ status: 'idle' | 'loading' | 'matched' | 'not_found'; data?: any }>({ status: 'idle' })

  // Closer assignment (for setter outcomes: qualified)
  const [closerMembers, setCloserMembers] = useState<CloserMember[]>([])
  const [selectedCloser, setSelectedCloser] = useState<CloserMember | null>(null)
  const [assignmentMode, setAssignmentMode] = useState<'suivant' | 'hasard' | 'manual' | null>(null)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [currentDateIndex, setCurrentDateIndex] = useState(0)
  const [showAllSlots, setShowAllSlots] = useState(false)

  // Get live notes from state if coming from cockpit
  const liveNotes = (location.state as any)?.liveNotes || ''
  const effectiveOwnerId = ownerUserId || user?.id

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    supabase.from('business_call_history').select('*').eq('id', id)
      .single().then(({ data, error }) => {
        if (error) console.error('Erreur chargement appel:', error.message)
        setCall(data)
        setNotes(data?.notes || liveNotes || '')
        if (liveNotes) setActiveTab('notes')
      })
      .catch(err => console.error('Erreur chargement appel:', err))
      .finally(() => setLoading(false))
  }, [id])

  // Fetch formulas for commission
  useEffect(() => {
    if (!effectiveOwnerId) return
    fetch(`/api/business?action=formulas-list&user_id=${effectiveOwnerId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setFormulas(data)
        else if (data?.formulas) setFormulas(data.formulas)
      })
      .catch(() => {})
  }, [effectiveOwnerId])

  // Load closers for assignment (when setter outcomes are available)
  useEffect(() => {
    if (!showSetterOutcomes || !effectiveOwnerId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, email, role, owner_assignable, owner_assignable_roles').eq('business_owner_id', effectiveOwnerId),
      supabase.from('business_users').select('id, full_name, email, owner_assignable, owner_assignable_roles').eq('id', effectiveOwnerId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const closerList = (tmRes.data || []).filter((m: any) => m.role === 'Closer' || m.role === 'Setter-Closer' || (m.owner_assignable_roles || []).includes('Closer'))
      if (ownerRes.data?.owner_assignable && (ownerRes.data.owner_assignable_roles || []).includes('Closer')) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        closerList.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', email: ownerRes.data.email || '', role: 'Owner' })
      }
      setCloserMembers(closerList)
    })
  }, [showSetterOutcomes, effectiveOwnerId])

  // Check Stripe connection
  useEffect(() => {
    if (!effectiveOwnerId) return
    supabase.from('profiles').select('stripe_connected, stripe_account_id').eq('id', effectiveOwnerId).maybeSingle()
      .then(({ data }) => {
        setStripeConnected(!!(data?.stripe_connected && data?.stripe_account_id))
      })
  }, [effectiveOwnerId])

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

  // Readonly: pre-fill outcome from prospect stage
  useEffect(() => {
    if (!isReadonly || !prospect) return
    const reverseStageMap: Record<string, string> = {
      won: 'won', lost: 'lost', qualified: 'followup', noshow: 'noshow',
      unqualified: 'unqualified', noanswer: 'noanswer',
    }
    const stage = (prospect as any).stage
    if (stage && reverseStageMap[stage]) {
      setSelectedOutcome(reverseStageMap[stage])
    } else if (stage?.startsWith('custom_')) {
      setSelectedOutcome(stage)
    }
    const val = (prospect as any).value
    if (val && val > 0) setAmount(val)
    const pt = (prospect as any).payment_type
    if (pt === 'installments') {
      setPaymentType('installments')
      const inst = (prospect as any).installments
      if (inst) setInstallmentsCount(inst)
    }
  }, [isReadonly, prospect])

  // Auto-fill amount from formula when Won
  useEffect(() => {
    if (isReadonly) return
    if (selectedOutcome === 'won' && prospectFormula && amount === 0) {
      const price = prospectFormula.price
      if (price > 0) setAmount(price)
    }
  }, [selectedOutcome, prospectFormula, amount, isReadonly])

  // Fetch closer's standard commission rate from business_team_members
  useEffect(() => {
    if (!teamMember?.id) return
    supabase
      .from('business_team_members')
      .select('commission_rate')
      .eq('id', teamMember.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.commission_rate != null) setMemberCommissionRate(Number(data.commission_rate))
      })
  }, [teamMember?.id])

  // Commission calc (standard from team member; custom if enabled)
  const standardRate = memberCommissionRate ?? 10
  const commissionRate = customCommissionEnabled ? customCommissionRate : standardRate

  // Effective amount: when schedule is custom, the sale total = sum of installments
  const customScheduleTotal = customSchedule.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const effectiveAmount = scheduleMode === 'custom' ? customScheduleTotal : amount

  // Sync displayed amount when in custom mode
  useEffect(() => {
    if (scheduleMode === 'custom' && customScheduleTotal !== amount) {
      setAmount(customScheduleTotal)
    }
  }, [scheduleMode, customScheduleTotal])

  const totalCommission = effectiveAmount > 0 ? (effectiveAmount * commissionRate) / 100 : 0
  const monthlyCommission = paymentType === 'installments' && installmentsCount > 0
    ? totalCommission / installmentsCount : 0

  const hasCustomException = customCommissionEnabled || scheduleMode === 'custom'

  // Stripe: auto-match by email
  const handleStripeAutoMatch = useCallback(async () => {
    if (!effectiveOwnerId || !prospect?.email) return
    setStripeAutoResult({ status: 'loading' })
    try {
      const res = await fetch('/api/business-auto-match-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveOwnerId, prospect_id: prospect.id, email: prospect.email }),
      })
      const data = await res.json()
      if (data.matched) {
        setStripeAutoResult({ status: 'matched', data })
        toast.success(t.closer_calldetails_toast_stripe_auto)
      } else {
        setStripeAutoResult({ status: 'not_found' })
      }
    } catch {
      setStripeAutoResult({ status: 'not_found' })
    }
  }, [effectiveOwnerId, prospect?.email, prospect?.id])

  // Stripe: search by email
  const handleStripeSearch = useCallback(async () => {
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
  }, [effectiveOwnerId, stripeSearchEmail])

  // Stripe: select a subscription from search results
  const handleStripeSelectSub = useCallback(async (customerId: string, subscriptionId: string) => {
    if (!effectiveOwnerId || !prospect) return
    setStripeMatching(true)
    try {
      const res = await fetch('/api/business-stripe-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveOwnerId, prospect_id: prospect.id, stripe_customer_id: customerId, stripe_subscription_id: subscriptionId }),
      })
      const data = await res.json()
      if (data.matched) {
        toast.success(t.closer_calldetails_toast_stripe_success)
        setStripeAutoResult({ status: 'matched', data })
      } else {
        toast.error(t.closer_calldetails_toast_stripe_fail)
      }
    } catch {
      toast.error(t.closer_calldetails_toast_stripe_error)
    }
    setStripeMatching(false)
  }, [effectiveOwnerId, prospect])

  // Stripe: manual match
  const handleStripeManualMatch = useCallback(async () => {
    if (!effectiveOwnerId || !prospect || !stripeManualCustomerId.trim() || !stripeManualSubId.trim()) return
    setStripeMatching(true)
    try {
      const res = await fetch('/api/business-stripe-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveOwnerId, prospect_id: prospect.id, stripe_customer_id: stripeManualCustomerId.trim(), stripe_subscription_id: stripeManualSubId.trim() }),
      })
      const data = await res.json()
      if (data.matched) {
        toast.success(t.closer_calldetails_toast_stripe_manual)
        setStripeAutoResult({ status: 'matched', data })
      } else {
        toast.error(t.closer_calldetails_toast_stripe_fail)
      }
    } catch {
      toast.error(t.closer_calldetails_toast_stripe_error)
    }
    setStripeMatching(false)
  }, [effectiveOwnerId, prospect, stripeManualCustomerId, stripeManualSubId])

  // Round-robin: get next closer
  const getNextCloser = useCallback(async () => {
    if (closerMembers.length === 0) return null
    const { data: rrState } = await supabase
      .from('business_round_robin_state')
      .select('last_assigned_closer_id')
      .eq('business_owner_id', effectiveOwnerId!)
      .single()
    const lastId = rrState?.last_assigned_closer_id
    if (!lastId) return closerMembers[0]
    const lastIdx = closerMembers.findIndex(c => c.id === lastId)
    const nextIdx = (lastIdx + 1) % closerMembers.length
    return closerMembers[nextIdx]
  }, [closerMembers, effectiveOwnerId])

  const getRandomCloser = useCallback(() => {
    if (closerMembers.length === 0) return null
    return closerMembers[Math.floor(Math.random() * closerMembers.length)]
  }, [closerMembers])

  const handleAssign = async (mode: 'suivant' | 'hasard') => {
    setAssignmentMode(mode)
    setSelectedSlot(null)
    setAvailableSlots([])
    let closer: CloserMember | null = null
    if (mode === 'suivant') closer = await getNextCloser()
    else closer = getRandomCloser()
    if (closer) {
      setSelectedCloser(closer)
      loadAvailableSlots(closer.id)
    } else {
      toast.error(t.closer_calldetails_toast_no_closer)
    }
  }

  const handleManualSelect = (closerId: string) => {
    const closer = closerMembers.find(c => c.id === closerId) || null
    if (closer) {
      setAssignmentMode('manual')
      setSelectedCloser(closer)
      setSelectedSlot(null)
      setAvailableSlots([])
      loadAvailableSlots(closer.id)
    }
  }

  const loadAvailableSlots = async (closerId: string) => {
    if (!effectiveOwnerId) return
    setLoadingSlots(true)
    try {
      const [slotsRes, absencesRes, appointmentsRes] = await Promise.all([
        supabase.from('business_availability_slots').select('*').eq('team_member_id', closerId),
        supabase.from('business_absences').select('start_date, end_date')
          .eq('team_member_id', closerId).gte('end_date', new Date().toISOString().split('T')[0]),
        supabase.from('business_appointments').select('date, time, duration')
          .eq('assigned_to', closerId).gte('date', new Date().toISOString().split('T')[0])
          .in('status', ['upcoming', 'pending', 'confirmed']),
      ])
      const weeklySlots: AvailabilitySlot[] = slotsRes.data || []
      const absences: Absence[] = absencesRes.data || []
      const existingAppointments = appointmentsRes.data || []
      const slots: TimeSlot[] = []
      const now = new Date()
      const SLOT_DURATION = 30
      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const date = new Date(now)
        date.setDate(date.getDate() + dayOffset)
        const jsDay = date.getDay()
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
        const dateStr = date.toISOString().split('T')[0]
        const isAbsent = absences.some(a => dateStr >= a.start_date && dateStr <= a.end_date)
        if (isAbsent) continue
        const daySlots = weeklySlots.filter(s => s.day_of_week === dayOfWeek)
        if (daySlots.length === 0) continue
        const dayAppointments = existingAppointments.filter((a: any) => a.date === dateStr)
        for (const slot of daySlots) {
          const [startH, startM] = slot.start_time.split(':').map(Number)
          const [endH, endM] = slot.end_time.split(':').map(Number)
          const startMinutes = startH * 60 + startM
          const endMinutes = endH * 60 + endM
          for (let mins = startMinutes; mins + SLOT_DURATION <= endMinutes; mins += SLOT_DURATION) {
            const h = Math.floor(mins / 60)
            const m = mins % 60
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
            if (dayOffset === 0) {
              const slotTime = new Date(date)
              slotTime.setHours(h, m, 0, 0)
              if (slotTime <= now) continue
            }
            const hasConflict = dayAppointments.some((appt: any) => {
              const [aH, aM] = appt.time.split(':').map(Number)
              const apptStart = aH * 60 + aM
              const apptEnd = apptStart + (appt.duration || 30)
              return mins < apptEnd && (mins + SLOT_DURATION) > apptStart
            })
            if (hasConflict) continue
            slots.push({
              date: dateStr,
              time: timeStr,
              dateLabel: date.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
              timeLabel: `${timeStr} - ${String(Math.floor((mins + SLOT_DURATION) / 60)).padStart(2, '0')}:${String((mins + SLOT_DURATION) % 60).padStart(2, '0')}`,
            })
          }
        }
      }
      setAvailableSlots(slots)
      setCurrentDateIndex(0)
    } catch (err) {
      console.error('Error loading slots:', err)
      toast.error(t.closer_calldetails_toast_slots_error)
    } finally {
      setLoadingSlots(false)
    }
  }

  const isSetterOutcome = (outcome: string) => ['qualified', 'booklater', 'unqualified', 'noanswer'].includes(outcome)

  const isFormValid = () => {
    if (!selectedOutcome) return false
    if (selectedOutcome === 'won' && (!amount || amount <= 0)) return false
    if (selectedOutcome === 'followup') {
      if (!followupDate || !followupReason) return false
      if (followupReason === t.closer_calldetails_objection_other && !followupReasonOther.trim()) return false
    }
    if (selectedOutcome === 'lost') {
      if (!lostReason) return false
    }
    if (selectedOutcome === 'qualified' && !isSetterCloserSelf && (!selectedCloser || !selectedSlot)) return false
    if (selectedOutcome === 'booklater' && (!reminderTitle || !reminderDate || !reminderTime)) return false
    return true
  }

  const handleSave = async () => {
    if (!call || !isFormValid()) return
    setSaving(true)
    try {
      const stageMap: Record<string, string> = {
        won: 'won', lost: 'lost', followup: 'qualified', noshow: 'noshow',
        qualified: 'qualified', booklater: 'qualified', unqualified: 'unqualified', noanswer: 'noanswer',
      }
      // Custom stages: outcome is "custom_123" → stage is "custom_123"
      if (selectedOutcome?.startsWith('custom_')) {
        stageMap[selectedOutcome] = selectedOutcome
      }

      // Build technical summary
      let technicalSummary = `[${new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}] Appel: ${selectedOutcome}`
      if (selectedOutcome === 'won') {
        technicalSummary += `\n- Montant: ${amount}€ (${paymentType === 'comptant' ? 'Comptant' : `${installmentsCount}x`})`
        technicalSummary += `\n- Commission: ${totalCommission.toFixed(2)}€${paymentType === 'installments' ? ` (${monthlyCommission.toFixed(2)}€/mois)` : ''}`
      }
      if (selectedOutcome === 'followup') {
        const reason = followupReason === t.closer_calldetails_objection_other ? followupReasonOther : followupReason
        technicalSummary += `\n- Motif: ${reason}\n- Rappel: ${new Date(followupDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}`
      }
      if (selectedOutcome === 'lost') {
        technicalSummary += `\n- Motif: ${lostReason}`
        if (lostReasonOther.trim()) technicalSummary += `\n- Détails: ${lostReasonOther}`
      }
      if (selectedOutcome === 'qualified') {
        if (isSetterCloserSelf) {
          technicalSummary += `\n- Auto-assigné (Setter-Closer)`
        } else if (selectedCloser && selectedSlot) {
          technicalSummary += `\n- Closer assigné: ${selectedCloser.first_name} ${selectedCloser.last_name}`
          technicalSummary += `\n- RDV: ${selectedSlot.dateLabel} à ${selectedSlot.timeLabel}`
          technicalSummary += `\n- Mode: ${assignmentMode === 'suivant' ? 'Tournante' : assignmentMode === 'hasard' ? 'Hasard' : 'Manuel'}`
        }
      }
      if (selectedOutcome === 'booklater') {
        technicalSummary += `\n- À booker plus tard — Rappel: ${reminderDate} à ${reminderTime}`
      }

      // Save notes to call history
      const finalNotes = notes ? `${notes}\n\n${technicalSummary}` : technicalSummary
      await supabase.from('business_call_history').update({ notes: finalNotes }).eq('id', call.id)

      // Update prospect if found
      if (prospect && selectedOutcome) {
        const updates: any = {
          stage: stageMap[selectedOutcome],
          last_contact: new Date().toISOString(),
        }
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
          updates.custom_commission_rate = customCommissionEnabled ? customCommissionRate : null
        }
        if (selectedOutcome === 'lost') {
          updates.loss_reason = lostReason
          updates.loss_details = lostReasonOther.trim() || null
        }
        if (selectedOutcome === 'qualified') {
          if (isSetterCloserSelf && teamMember?.id) {
            updates.assigned_to = teamMember.id
          } else if (selectedCloser) {
            updates.assigned_to = selectedCloser.id
          }
        }

        // Save call notes as JSONB
        const currentCallNotes = Array.isArray((prospect as any).call_notes) ? (prospect as any).call_notes : []
        updates.call_notes = [...currentCallNotes, {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          content: finalNotes,
          type: 'call',
          call_id: id,
          author: teamMember?.first_name || (isSetterCloser ? 'Setter-Closer' : 'Closer')
        }]

        await updateProspect(prospect.id, updates)

        // Trigger commission approval workflow if closer used exception (commission and/or schedule)
        if (
          selectedOutcome === 'won' &&
          hasCustomException &&
          isTeamMember &&
          teamMember?.id &&
          effectiveOwnerId
        ) {
          const reason: 'commission' | 'schedule' | 'both' =
            customCommissionEnabled && scheduleMode === 'custom'
              ? 'both'
              : customCommissionEnabled
                ? 'commission'
                : 'schedule'
          await createCommissionApproval(
            {
              business_owner_id: effectiveOwnerId,
              prospect_id: prospect.id,
              closer_id: teamMember.id,
              reason,
              sale_amount: effectiveAmount,
              standard_commission_rate: standardRate,
              custom_commission_rate: customCommissionEnabled ? customCommissionRate : null,
              installments_schedule: scheduleMode === 'custom' ? customSchedule : null,
            },
            {
              closerName: `${teamMember.first_name || ''} ${teamMember.last_name || ''}`.trim() || 'Un closer',
              prospectName: (prospect as any).contact || (prospect as any).firstName || 'Prospect',
              offerName: prospectFormula?.name,
            }
          )
        }
      }

      // Create follow-up appointment if needed (closer outcome)
      if (selectedOutcome === 'followup' && followupDate && effectiveOwnerId) {
        const followupDateTime = new Date(followupDate)
        const dateStr = followupDateTime.toISOString().split('T')[0]
        const timeStr = followupDateTime.toTimeString().slice(0, 5)
        await supabase.from('business_appointments').insert([{
          user_id: effectiveOwnerId,
          team_member_id: teamMember?.id,
          title: `Follow up — ${call.contact_name}`,
          date: dateStr,
          time: timeStr,
          datetime_utc: toUTC(dateStr, timeStr, userTimezone).toISOString(),
          timezone: userTimezone,
          type: 'call',
          contact: call.contact_name,
          status: 'upcoming',
          description: `Follow up — Motif: ${followupReason === t.closer_calldetails_objection_other ? followupReasonOther : followupReason}`,
        }])
        if (isGoogleConnected) {
          const [h, m] = timeStr.split(':').map(Number)
          const endMinutes = h * 60 + m + 30
          const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
          await createGoogleEvent({
            title: `Follow up — ${call.contact_name}`,
            date: dateStr,
            startTime: timeStr,
            endTime,
            description: `Follow up — Motif: ${followupReason === t.closer_calldetails_objection_other ? followupReasonOther : followupReason}`,
            withGoogleMeet: true,
          })
        }
      }

      // Qualified: create appointment + sync Google + round-robin (setter outcome)
      if (selectedOutcome === 'qualified' && selectedCloser && selectedSlot && effectiveOwnerId) {
        await supabase.from('business_appointments').insert([{
          user_id: effectiveOwnerId,
          assigned_to: selectedCloser.id,
          prospect_id: prospect?.id || null,
          title: `Call — ${call.contact_name}`,
          contact: call.contact_name,
          date: selectedSlot.date,
          time: selectedSlot.time,
          datetime_utc: toUTC(selectedSlot.date, selectedSlot.time, userTimezone).toISOString(),
          timezone: userTimezone,
          duration: 30,
          type: 'call',
          status: 'pending',
          notes: `Qualifié par ${teamMember?.first_name || 'Setter-Closer'}. ${notes || ''}`.trim(),
        }])
        if (isGoogleConnected) {
          const [startH, startM] = selectedSlot.time.split(':').map(Number)
          const endMinutes = startH * 60 + startM + 30
          const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
          await createGoogleEvent({
            title: `Call — ${call.contact_name}`,
            date: selectedSlot.date,
            startTime: selectedSlot.time,
            endTime,
            description: `Prospect qualifié par ${teamMember?.first_name || 'Setter-Closer'}.\nCloser: ${selectedCloser.first_name} ${selectedCloser.last_name}\n${notes || ''}`.trim(),
            withGoogleMeet: true,
          })
        }
        if (assignmentMode === 'suivant') {
          const { data: existing } = await supabase
            .from('business_round_robin_state').select('id')
            .eq('business_owner_id', effectiveOwnerId).single()
          if (existing) {
            await supabase.from('business_round_robin_state')
              .update({ last_assigned_closer_id: selectedCloser.id, updated_at: new Date().toISOString() })
              .eq('business_owner_id', effectiveOwnerId)
          } else {
            await supabase.from('business_round_robin_state')
              .insert([{ business_owner_id: effectiveOwnerId, last_assigned_closer_id: selectedCloser.id }])
          }
        }
      }

      // Booklater: create reminder (setter outcome)
      if (selectedOutcome === 'booklater' && effectiveOwnerId) {
        const reminderDateTime = `${reminderDate}T${reminderTime}:00`
        await supabase.from('business_reminders').insert([{
          user_id: effectiveOwnerId,
          team_member_id: teamMember?.id,
          call_id: call.id,
          title: reminderTitle,
          description: reminderDescription || null,
          reminder_date: reminderDateTime,
          is_done: false,
        }])
      }

      toast.success(t.closer_calldetails_toast_saved)
      navigate('/business/appels')
    } catch {
      toast.error(t.closer_calldetails_toast_save_error)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveReminder = async () => {
    if (!reminderTitle || !reminderDate || !reminderTime || !effectiveOwnerId) return
    setIsSavingReminder(true)
    try {
      const reminderDateTime = `${reminderDate}T${reminderTime}:00`
      await supabase.from('business_reminders').insert([{
        user_id: effectiveOwnerId,
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
      toast.success(t.closer_calldetails_toast_reminder_saved)
    } catch {
      toast.error(t.closer_calldetails_toast_reminder_error)
    }
    setIsSavingReminder(false)
  }

  const handleCreateProspect = async () => {
    if (!call?.contact_name || !effectiveOwnerId) return
    setCreatingProspect(true)
    try {
      const role = teamMember?.role
      const memberId = teamMember?.id
      const prospectData: any = {
        contact: call.contact_name,
        email: newProspectEmail,
        phone: newProspectPhone,
        company: newProspectCompany,
        stage: 'prospect',
      }
      // Auto-assign based on role
      if (role === 'Closer') {
        prospectData.assigned_to = memberId
      } else if (role === 'Setter') {
        prospectData.assigned_setter = memberId
      } else if (role === 'Setter-Closer') {
        prospectData.assigned_setter = memberId
        prospectData.assigned_to = memberId
      }
      await addProspect(prospectData)
      // Link call to new prospect
      const { data: newProspect } = await supabase
        .from('business_prospects')
        .select('id')
        .eq('user_id', user?.id)
        .eq('contact', call.contact_name)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (newProspect) {
        await supabase.from('business_call_history')
          .update({ contact_id: newProspect.id })
          .eq('id', call.id)
        setCall((prev: any) => ({ ...prev, contact_id: newProspect.id }))
      }
      toast.success(t.closer_calldetails_toast_prospect_created)
    } catch {
      toast.error(t.closer_calldetails_toast_prospect_error)
    }
    setCreatingProspect(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-stone-400" /></div>
  }

  if (!call) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-500 dark:text-neutral-400">{t.closer_calldetails_not_found}</p>
        <button onClick={() => navigate('/business/appels')} className="mt-4 text-stone-900 dark:text-white font-semibold hover:underline">{t.closer_calldetails_back_to_calls}</button>
      </div>
    )
  }

  // Group slots by date for display
  const slotsByDate = availableSlots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = []
    acc[slot.date].push(slot)
    return acc
  }, {})
  const dateKeys = Object.keys(slotsByDate)
  const currentDateKey = dateKeys[currentDateIndex]
  const currentDateSlots = currentDateKey ? slotsByDate[currentDateKey] : []

  const renderOutcomeCards = (outcomes: typeof closerOutcomes, label: string, required?: boolean, extraCustomStages?: typeof closerCustomStages) => (
    <section>
      <h3 className="font-['Manrope'] text-lg font-bold mb-5 flex items-center gap-2 text-stone-900 dark:text-white">
        <span className="w-2 h-2 rounded-full bg-emerald-600" />
        {label} {required && <span className="text-red-500">*</span>}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {outcomes.map(outcome => {
          const Icon = outcome.icon
          const isSelected = selectedOutcome === outcome.id
          return (
            <button
              key={outcome.id}
              disabled={isReadonly}
              onClick={() => {
                if (isReadonly) return
                setSelectedOutcome(outcome.id)
                if (outcome.id !== 'qualified') {
                  setSelectedCloser(null)
                  setSelectedSlot(null)
                  setAssignmentMode(null)
                  setAvailableSlots([])
                }
                if (outcome.id === 'booklater') {
                  setActiveTab('reminder')
                }
              }}
              className={cn(
                'p-5 rounded-xl border-2 text-left transition-all cursor-pointer',
                isSelected
                  ? 'bg-white dark:bg-white/5 border-emerald-600 shadow-[0_20px_40px_rgba(27,28,27,0.04)]'
                  : 'bg-stone-50/50 dark:bg-white/5 border-stone-200/40 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 hover:border-stone-300 dark:hover:border-white/20'
              )}
            >
              <div className="mb-3">
                <Icon className={cn('h-5 w-5', isSelected ? 'text-emerald-600' : outcome.iconClass)} />
              </div>
              <p className={cn(
                "font-['Manrope'] font-bold text-sm",
                isSelected ? 'text-stone-900 dark:text-white' : 'text-stone-500 dark:text-neutral-400'
              )}>
                {outcome.label}
              </p>
            </button>
          )
        })}
        {extraCustomStages?.map(cs => {
          const stageId = `custom_${cs.id}`
          const isSelected = selectedOutcome === stageId
          return (
            <button
              key={stageId}
              disabled={isReadonly}
              onClick={() => {
                if (isReadonly) return
                setSelectedOutcome(stageId)
                setSelectedCloser(null)
                setSelectedSlot(null)
                setAssignmentMode(null)
                setAvailableSlots([])
              }}
              className={cn(
                'p-5 rounded-xl border-2 text-left transition-all cursor-pointer',
                isSelected
                  ? 'bg-white dark:bg-white/5 border-emerald-600 shadow-[0_20px_40px_rgba(27,28,27,0.04)]'
                  : 'bg-stone-50/50 dark:bg-white/5 border-stone-200/40 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 hover:border-stone-300 dark:hover:border-white/20'
              )}
            >
              <div className="mb-3">
                <span className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: cs.color }} />
              </div>
              <p className={cn(
                "font-['Manrope'] font-bold text-sm",
                isSelected ? 'text-stone-900 dark:text-white' : 'text-stone-500 dark:text-neutral-400'
              )}>
                {cs.name}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )

  const tabs = [
    { id: 'qualification' as const, label: t.closer_calldetails_tab_qualification },
    { id: 'notes' as const, label: t.closer_calldetails_tab_notes },
    { id: 'reminder' as const, label: t.closer_calldetails_tab_reminder },
  ]

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="mb-10">
        <button
          onClick={() => navigate('/business/appels')}
          className="mb-6 flex items-center gap-2 text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors font-['Manrope'] font-semibold"
        >
          <ArrowLeft className="h-5 w-5" /> {t.closer_calldetails_back}
        </button>

        {/* Readonly banner */}
        {isReadonly && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 backdrop-blur-md px-5 py-3 flex items-center gap-3 mb-6">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
            <p className="text-sm font-medium text-blue-700">{t.closer_calldetails_readonly_banner}</p>
          </div>
        )}

        <h1 className="font-['Manrope'] text-2xl md:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white mb-2">
          {isReadonly ? t.closer_calldetails_title_readonly : isSetterCloser ? t.closer_calldetails_title_settercloser : t.closer_calldetails_title_closer} {call.contact_name}
        </h1>
        <div className="flex items-center gap-2 text-stone-500 dark:text-neutral-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">
            {new Date(call.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {` ${t.closer_calldetails_at} `}
            {new Date(call.date).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {call.duration && call.duration !== 'En cours...' && ` (${call.duration})`}
          </span>
        </div>
        {prospect && prospectFormula && (
          <div className="mt-4 inline-flex items-center gap-3 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm px-5 py-3">
            <Award className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-xs text-stone-400 dark:text-neutral-500">{t.closer_calldetails_linked_offer}</p>
              <p className="text-sm font-bold text-stone-900 dark:text-white font-['Manrope']">{prospectFormula.name} - {prospectFormula.price}€</p>
            </div>
          </div>
        )}
        {prospect && !prospectFormula && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-stone-50/50 dark:bg-white/5 border border-stone-200/40 dark:border-white/10 px-5 py-3">
            <p className="text-sm text-stone-500 dark:text-neutral-400">{t.closer_calldetails_no_linked_offer}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 md:gap-8 mb-10 border-b border-stone-200/60 dark:border-white/10 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "pb-4 font-['Manrope'] font-semibold transition-colors",
              activeTab === tab.id
                ? "text-stone-900 dark:text-white border-b-2 border-stone-900 dark:border-white font-bold"
                : "text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {/* QUALIFICATION TAB */}
      {activeTab === 'qualification' && (
        <div className="relative">
          {/* No prospect linked — blur overlay + create prospect */}
          {!prospect && !isReadonly && (
            <div className="absolute inset-0 z-30 flex items-start justify-center pt-16">
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-stone-200 dark:border-white/10 shadow-2xl p-8 max-w-md w-full mx-4 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-full bg-stone-100 dark:bg-white/10">
                    <Lock className="h-5 w-5 text-stone-500 dark:text-neutral-400" />
                  </div>
                  <div>
                    <h3 className="font-['Manrope'] text-lg font-extrabold text-stone-900 dark:text-white">{t.closer_calldetails_no_prospect}</h3>
                    <p className="text-sm text-stone-500 dark:text-neutral-400">{t.closer_calldetails_create_prospect_desc}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{t.closer_calldetails_label_name}</label>
                    <input
                      type="text"
                      value={call?.contact_name || ''}
                      readOnly
                      className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-800 px-4 py-2.5 text-sm text-stone-900 dark:text-white cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{t.closer_calldetails_label_email}</label>
                    <input
                      type="email"
                      value={newProspectEmail}
                      onChange={(e) => setNewProspectEmail(e.target.value)}
                      placeholder="email@exemple.com"
                      className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{t.closer_calldetails_label_phone}</label>
                    <input
                      type="tel"
                      value={newProspectPhone}
                      onChange={(e) => setNewProspectPhone(e.target.value)}
                      placeholder="+33 6 00 00 00 00"
                      className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{t.closer_calldetails_label_company}</label>
                    <input
                      type="text"
                      value={newProspectCompany}
                      onChange={(e) => setNewProspectCompany(e.target.value)}
                      placeholder={t.closer_calldetails_company_placeholder}
                      className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreateProspect}
                  disabled={creatingProspect}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 text-white px-6 py-3.5 font-['Manrope'] font-bold text-sm transition-all hover:bg-stone-800 dark:hover:bg-neutral-100 shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {creatingProspect ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t.closer_calldetails_creating}</>
                  ) : (
                    <><UserPlus className="h-4 w-4" /> {t.closer_calldetails_create_prospect}</>
                  )}
                </button>
              </div>
            </div>
          )}

        <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-10", !prospect && !isReadonly && "blur-sm pointer-events-none select-none")}>
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-10">
            {/* Closer Outcomes */}
            {renderOutcomeCards(closerOutcomes, t.closer_calldetails_outcome_label_closer, true, closerCustomStages)}

            {/* Won: Payment Terms & Commission */}
            {selectedOutcome === 'won' && (
              <section className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 space-y-5">
                <h3 className="font-['Manrope'] text-lg font-bold flex items-center gap-2 text-stone-900 dark:text-white">
                  <DollarSign className="h-5 w-5 text-emerald-600" /> {t.closer_calldetails_sale_details}
                </h3>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">{t.closer_calldetails_sale_amount} <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.01"
                      value={amount || ''}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Ex: 5000"
                      readOnly={scheduleMode === 'custom'}
                      className={cn("w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-3 pr-12 text-lg text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10", scheduleMode === 'custom' && 'opacity-60 cursor-not-allowed')}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-medium">€</div>
                  </div>
                  {scheduleMode === 'custom' && (
                    <p className="mt-2 text-xs text-stone-500 dark:text-neutral-400">{t.schedule_custom_amount_locked}</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">{t.closer_calldetails_payment_mode}</label>
                  <div className="flex gap-3">
                    <button onClick={() => setPaymentType('comptant')}
                      className={cn('flex-1 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-all font-[\"Manrope\"]',
                        paymentType === 'comptant' ? 'border-emerald-600 bg-white text-emerald-700' : 'border-stone-200/40 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 text-stone-500 dark:text-neutral-400 hover:border-stone-300 dark:hover:border-white/20')}>
                      {t.closer_calldetails_payment_cash}
                    </button>
                    <button onClick={() => setPaymentType('installments')}
                      className={cn('flex-1 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-all font-[\"Manrope\"]',
                        paymentType === 'installments' ? 'border-emerald-600 bg-white text-emerald-700' : 'border-stone-200/40 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 text-stone-500 dark:text-neutral-400 hover:border-stone-300 dark:hover:border-white/20')}>
                      {t.closer_calldetails_payment_installments}
                    </button>
                  </div>
                </div>
                {paymentType === 'installments' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">{t.closer_calldetails_installments_count}</label>
                    <select
                      value={scheduleMode === 'custom' ? 'custom' : String(installmentsCount)}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === 'custom') {
                          setScheduleMode('custom')
                          if (customSchedule.length === 0) {
                            const base = amount > 0 ? amount / installmentsCount : 0
                            setCustomSchedule(Array.from({ length: installmentsCount }, (_, i) => ({ month: i + 1, amount: Math.round(base * 100) / 100 })))
                          }
                        } else {
                          setScheduleMode('equal')
                          setInstallmentsCount(parseInt(v))
                        }
                      }}
                      className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    >
                      <option value="custom">{t.schedule_custom_option}</option>
                      {Array.from({ length: 23 }, (_, i) => i + 2).map(num => (
                        <option key={num} value={num}>{num} {t.closer_calldetails_months}</option>
                      ))}
                    </select>
                    {scheduleMode === 'equal' ? (
                      <p className="mt-2 text-sm text-stone-500 dark:text-neutral-400">
                        {t.closer_calldetails_amount_per_month} <span className="text-emerald-600 font-semibold">{(amount / installmentsCount).toFixed(2)}€</span>
                      </p>
                    ) : (
                      <div className="mt-3">
                        <InstallmentScheduleEditor
                          value={customSchedule}
                          onChange={setCustomSchedule}
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
                {effectiveAmount > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-emerald-700 font-['Manrope']">{t.closer_calldetails_your_commission}</h4>
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
                            ? 'border-amber-500/60 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'border-stone-300 bg-white text-stone-600 hover:border-amber-500 hover:text-amber-700'
                        )}
                      >
                        <Settings2 className="h-3 w-3" />
                        {customCommissionEnabled ? t.custom_commission_cancel : t.custom_commission_btn}
                      </button>
                    </div>

                    {customCommissionEnabled && (
                      <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                        <label className="mb-1.5 block text-xs font-medium text-amber-800">
                          {t.custom_commission_rate_label}
                          <span className="ml-2 text-stone-500">(standard : {standardRate}%)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number" min="0" max="100" step="0.1"
                            value={customCommissionRate || ''}
                            onChange={(e) => setCustomCommissionRate(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 pr-8 text-sm text-stone-900 focus:border-amber-500 focus:outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-700 text-sm">%</span>
                        </div>
                      </div>
                    )}

                    <p className="text-2xl font-extrabold text-emerald-600 font-['Manrope']">{totalCommission.toFixed(2)} €</p>
                    {paymentType === 'installments' && scheduleMode === 'equal' && (
                      <p className="mt-1 text-sm text-stone-600 dark:text-neutral-300">
                        {t.closer_calldetails_you_will_receive} <span className="font-semibold text-emerald-600">{monthlyCommission.toFixed(2)}€/{t.closer_calldetails_stripe_month}</span>
                      </p>
                    )}
                    <p className="mt-2 text-xs text-stone-400 dark:text-neutral-500">
                      {t.closer_calldetails_commission_rate} {commissionRate}%
                      {customCommissionEnabled && (
                        <span className="ml-2 text-amber-700">({t.custom_commission_diff_standard})</span>
                      )}
                    </p>
                  </div>
                )}

                {hasCustomException && isTeamMember && (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">{t.custom_commission_banner_business}</p>
                  </div>
                )}
              </section>
            )}

            {/* Won: Stripe already linked */}
            {selectedOutcome === 'won' && prospectFormula?.billing_type === 'subscription' && prospect?.stripe_subscription_id && (
              <section className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-emerald-500/20 shadow-sm p-7">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h3 className="font-['Manrope'] text-lg font-bold text-emerald-600">{t.closer_calldetails_stripe_linked}</h3>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-stone-500 dark:text-neutral-400">{t.closer_calldetails_stripe_amount}</span>
                    <span className="text-sm font-bold text-stone-900 dark:text-white">{(Number((prospect as any).subscription_amount) || 0).toFixed(2)} EUR / {(prospect as any).subscription_interval === 'month' ? t.closer_calldetails_stripe_month : t.closer_calldetails_stripe_year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-stone-500 dark:text-neutral-400">{t.closer_calldetails_stripe_status}</span>
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', {
                      'bg-emerald-500/10 text-emerald-600': (prospect as any).subscription_status === 'active',
                      'bg-amber-500/10 text-amber-600': (prospect as any).subscription_status === 'past_due',
                      'bg-red-500/10 text-red-600': (prospect as any).subscription_status === 'canceled',
                    })}>
                      {(prospect as any).subscription_status === 'active' ? t.closer_calldetails_stripe_active : (prospect as any).subscription_status === 'past_due' ? t.closer_calldetails_stripe_late : (prospect as any).subscription_status === 'canceled' ? t.closer_calldetails_stripe_canceled : (prospect as any).subscription_status}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Won: Stripe Linking — 3 methods (only for subscription formulas) */}
            {selectedOutcome === 'won' && prospectFormula?.billing_type === 'subscription' && stripeConnected && prospect && !prospect.stripe_subscription_id && stripeAutoResult.status !== 'matched' && (
              <section className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-[#635BFF]/20 shadow-sm p-7 space-y-5">
                <h3 className="font-['Manrope'] text-lg font-bold flex items-center gap-2 text-[#635BFF]">
                  <CreditCard className="h-5 w-5" /> {t.closer_calldetails_stripe_link}
                </h3>

                {/* 3 mode tabs */}
                <div className="flex rounded-xl bg-stone-100 dark:bg-neutral-800 p-1">
                  <button onClick={() => setStripeLinkMode('auto')}
                    className={cn('flex-1 rounded-lg py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                      stripeLinkMode === 'auto' ? 'bg-[#635BFF] text-white shadow-md' : 'text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white')}>
                    <Zap className="h-3.5 w-3.5" /> {t.closer_calldetails_stripe_auto}
                  </button>
                  <button onClick={() => setStripeLinkMode('search')}
                    className={cn('flex-1 rounded-lg py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                      stripeLinkMode === 'search' ? 'bg-[#635BFF] text-white shadow-md' : 'text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white')}>
                    <Search className="h-3.5 w-3.5" /> {t.closer_calldetails_stripe_search}
                  </button>
                  <button onClick={() => setStripeLinkMode('manual')}
                    className={cn('flex-1 rounded-lg py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                      stripeLinkMode === 'manual' ? 'bg-[#635BFF] text-white shadow-md' : 'text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white')}>
                    <Link2 className="h-3.5 w-3.5" /> {t.closer_calldetails_stripe_manual}
                  </button>
                </div>

                {/* MODE 1: Auto-match by email */}
                {stripeLinkMode === 'auto' && (
                  <div className="space-y-3">
                    <p className="text-sm text-stone-500 dark:text-neutral-400">
                      {t.closer_calldetails_stripe_auto_desc} <span className="font-bold text-stone-700 dark:text-white">{prospect.email || '—'}</span>
                    </p>
                    {stripeAutoResult.status === 'not_found' && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">{t.closer_calldetails_stripe_not_found}</p>
                      </div>
                    )}
                    <button
                      onClick={handleStripeAutoMatch}
                      disabled={!prospect.email || stripeAutoResult.status === 'loading'}
                      className="w-full py-3 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {stripeAutoResult.status === 'loading' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><Zap className="h-4 w-4" /> {t.closer_calldetails_stripe_search_auto}</>
                      )}
                    </button>
                  </div>
                )}

                {/* MODE 2: Search by email */}
                {stripeLinkMode === 'search' && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={stripeSearchEmail || prospect.email || ''}
                        onChange={e => setStripeSearchEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleStripeSearch()}
                        placeholder={t.closer_calldetails_stripe_email_placeholder}
                        className="flex-1 px-4 py-2.5 bg-stone-50 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
                      />
                      <button
                        onClick={handleStripeSearch}
                        disabled={stripeSearching}
                        className="px-4 py-2.5 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
                      >
                        {stripeSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </button>
                    </div>

                    {stripeSearched && stripeSearchResults.length === 0 && (
                      <p className="text-sm text-stone-500 dark:text-neutral-400 text-center py-4">{t.closer_calldetails_stripe_no_customer}</p>
                    )}

                    {stripeSearchResults.map((customer: any) => (
                      <div key={customer.id} className="bg-stone-50 dark:bg-neutral-800 rounded-xl p-4 border border-stone-200 dark:border-neutral-700">
                        <div className="mb-2">
                          <p className="text-sm font-bold text-stone-900 dark:text-white">{customer.name || customer.email}</p>
                          <p className="text-[10px] text-stone-500 dark:text-neutral-500 font-mono">{customer.id}</p>
                        </div>
                        {customer.subscriptions?.length === 0 ? (
                          <p className="text-xs text-stone-400">{t.closer_calldetails_stripe_no_subscription}</p>
                        ) : (
                          <div className="space-y-2">
                            {customer.subscriptions?.map((sub: any) => (
                              <button
                                key={sub.id}
                                onClick={() => handleStripeSelectSub(customer.id, sub.id)}
                                disabled={stripeMatching}
                                className="w-full flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border border-stone-200 dark:border-neutral-700 hover:border-[#635BFF]/30 hover:bg-[#635BFF]/5 transition-all text-left group"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-block w-2 h-2 rounded-full ${sub.status === 'active' ? 'bg-emerald-500' : sub.status === 'past_due' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                    <span className="text-sm font-medium text-stone-900 dark:text-white">{sub.amount?.toFixed(2)} EUR / {sub.interval === 'month' ? t.closer_calldetails_stripe_month : t.closer_calldetails_stripe_year}</span>
                                  </div>
                                  <p className="text-[10px] text-stone-500 font-mono mt-0.5">{sub.id}</p>
                                </div>
                                {stripeMatching ? <Loader2 className="h-4 w-4 animate-spin text-[#635BFF]" /> : <CheckCircle2 className="h-5 w-5 text-[#635BFF] opacity-0 group-hover:opacity-100 transition-opacity" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* MODE 3: Manual IDs */}
                {stripeLinkMode === 'manual' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 dark:text-neutral-200 mb-1.5">{t.closer_calldetails_stripe_customer_id}</label>
                      <input
                        type="text"
                        value={stripeManualCustomerId}
                        onChange={e => setStripeManualCustomerId(e.target.value)}
                        placeholder="cus_..."
                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl text-sm text-stone-900 dark:text-white font-mono placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 dark:text-neutral-200 mb-1.5">{t.closer_calldetails_stripe_subscription_id}</label>
                      <input
                        type="text"
                        value={stripeManualSubId}
                        onChange={e => setStripeManualSubId(e.target.value)}
                        placeholder="sub_..."
                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-xl text-sm text-stone-900 dark:text-white font-mono placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
                      />
                    </div>
                    <button
                      onClick={handleStripeManualMatch}
                      disabled={stripeMatching || !stripeManualCustomerId.trim() || !stripeManualSubId.trim()}
                      className="w-full py-3 bg-[#635BFF] hover:bg-[#5349E0] disabled:opacity-50 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {stripeMatching ? <Loader2 className="h-5 w-5 animate-spin" /> : t.closer_calldetails_stripe_link_btn}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Won: Stripe linked success */}
            {selectedOutcome === 'won' && prospectFormula?.billing_type === 'subscription' && stripeAutoResult.status === 'matched' && stripeAutoResult.data && (
              <section className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-emerald-500/20 shadow-sm p-7">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h3 className="font-['Manrope'] text-lg font-bold text-emerald-600">{t.closer_calldetails_stripe_linked}</h3>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-stone-500 dark:text-neutral-400">{t.closer_calldetails_stripe_amount}</span>
                    <span className="text-sm font-bold text-stone-900 dark:text-white">{stripeAutoResult.data.subscription_amount?.toFixed(2)} EUR / {stripeAutoResult.data.subscription_interval === 'month' ? t.closer_calldetails_stripe_month : t.closer_calldetails_stripe_year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-stone-500 dark:text-neutral-400">{t.closer_calldetails_stripe_status}</span>
                    <span className="text-xs font-bold text-emerald-600">{stripeAutoResult.data.subscription_status === 'active' ? t.closer_calldetails_stripe_active : stripeAutoResult.data.subscription_status}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Follow up (closer outcome) */}
            {selectedOutcome === 'followup' && (
              <section className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 space-y-5">
                <h3 className="font-['Manrope'] text-lg font-bold flex items-center gap-2 text-stone-900 dark:text-white">
                  <Clock className="h-5 w-5 text-stone-500" /> {t.closer_calldetails_followup_title}
                </h3>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-neutral-200">
                    <Calendar className="h-4 w-4" /> {t.closer_calldetails_followup_date} <span className="text-red-500">*</span>
                  </label>
                  <input type="datetime-local" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">{t.closer_calldetails_followup_reason} <span className="text-red-500">*</span></label>
                  <select value={followupReason} onChange={(e) => { setFollowupReason(e.target.value); if (e.target.value !== t.closer_calldetails_objection_other) setFollowupReasonOther('') }}
                    className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10">
                    <option value="">{t.closer_calldetails_followup_select}</option>
                    {objectionReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {followupReason === t.closer_calldetails_objection_other && (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">{t.closer_calldetails_followup_specify} <span className="text-red-500">*</span></label>
                      <input type="text" value={followupReasonOther} onChange={(e) => setFollowupReasonOther(e.target.value)}
                        placeholder={t.closer_calldetails_followup_other_placeholder}
                        className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Lost (closer outcome) */}
            {selectedOutcome === 'lost' && (
              <section className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 space-y-5">
                <h3 className="font-['Manrope'] text-lg font-bold flex items-center gap-2 text-stone-900 dark:text-white">
                  <XCircle className="h-5 w-5 text-stone-500" /> {t.closer_calldetails_lost_title}
                </h3>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">{t.closer_calldetails_lost_reason} <span className="text-red-500">*</span></label>
                  <select value={lostReason} onChange={(e) => setLostReason(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10">
                    <option value="">{t.closer_calldetails_followup_select}</option>
                    {objectionReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {lostReason && (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">{t.closer_calldetails_lost_details}</label>
                      <input type="text" value={lostReasonOther} onChange={(e) => setLostReasonOther(e.target.value)}
                        placeholder={t.closer_calldetails_lost_details_placeholder}
                        className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-neutral-500 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Qualified: auto-assign for setter-closer self */}
            {selectedOutcome === 'qualified' && isSetterCloserSelf && (
              <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-5">
                <p className="text-sm text-stone-700 dark:text-neutral-200 text-center font-['Manrope'] font-medium">
                  {t.closer_calldetails_auto_assign_self}
                </p>
              </div>
            )}

            {/* Qualified: Closer assignment (setter outcome for owner) */}
            {selectedOutcome === 'qualified' && showSetterOutcomes && !isSetterCloserSelf && (
              <section>
                <h3 className="font-['Manrope'] text-lg font-bold mb-5 text-stone-900 dark:text-white">{t.closer_calldetails_step1_assign}</h3>
                <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl p-7 rounded-xl border border-white/40 dark:border-white/10 shadow-sm">
                  {closerMembers.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-neutral-400 bg-stone-50 dark:bg-white/5 rounded-lg p-4 border border-stone-200 dark:border-white/10">
                      <AlertCircle className="h-4 w-4 text-stone-400" />
                      {t.closer_calldetails_no_closer}
                    </div>
                  ) : (
                    <>
                      {/* Manual closer dropdown */}
                      <div className="mb-5">
                        <label className="mb-2 block text-xs font-medium text-stone-500 dark:text-neutral-400">{t.closer_calldetails_select_manually}</label>
                        <select
                          value={assignmentMode === 'manual' ? selectedCloser?.id || '' : ''}
                          onChange={(e) => e.target.value && handleManualSelect(e.target.value)}
                          className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm text-stone-700 dark:text-neutral-200 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                        >
                          <option value="">{t.closer_calldetails_choose_closer}</option>
                          {closerMembers.map(c => (
                            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.role === 'Owner' ? ' (Owner)' : ''}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <button
                          onClick={() => handleAssign('suivant')}
                          className={cn(
                            'flex-1 py-3 px-6 rounded-full font-["Manrope"] font-bold text-sm transition-all',
                            assignmentMode === 'suivant'
                              ? 'bg-stone-900 text-white'
                              : 'border border-stone-300 dark:border-white/10 text-stone-700 dark:text-neutral-200 hover:bg-stone-100 dark:hover:bg-white/5'
                          )}
                        >
                          {t.closer_calldetails_round_robin}
                        </button>
                        <button
                          onClick={() => handleAssign('hasard')}
                          className={cn(
                            'flex-1 py-3 px-6 rounded-full font-["Manrope"] font-bold text-sm transition-all',
                            assignmentMode === 'hasard'
                              ? 'bg-stone-900 text-white'
                              : 'border border-stone-300 dark:border-white/10 text-stone-700 dark:text-neutral-200 hover:bg-stone-100 dark:hover:bg-white/5'
                          )}
                        >
                          {t.closer_calldetails_random}
                        </button>
                      </div>

                      {selectedCloser && (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-stone-200/30 dark:border-white/10">
                          <div className="w-14 h-14 rounded-full bg-stone-200 dark:bg-white/10 flex items-center justify-center text-stone-700 dark:text-neutral-200 font-bold text-lg shrink-0">
                            {selectedCloser.first_name?.[0]}{selectedCloser.last_name?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-['Manrope'] font-extrabold text-stone-900 dark:text-white">
                              {selectedCloser.first_name} {selectedCloser.last_name}
                            </h4>
                            <p className="text-emerald-700 font-bold text-xs uppercase tracking-widest">
                              {selectedCloser.role === 'Owner' ? 'Owner' : 'Closer'} {'\u2022'} {t.closer_calldetails_available}
                            </p>
                          </div>
                          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Setter Outcomes (for owner/HOS/admin/setter-closer) */}
            {showSetterOutcomes && renderOutcomeCards(setterOutcomesForOwner, t.closer_calldetails_outcome_label_setter)}
          </div>

          {/* Right Column: Step 2 - Scheduling */}
          {selectedOutcome === 'qualified' && selectedCloser && showSetterOutcomes && !isSetterCloserSelf && (
            <div className="lg:col-span-5">
              <section>
                <h3 className="font-['Manrope'] text-lg font-bold mb-5 text-stone-900 dark:text-white">{t.closer_calldetails_step2_schedule}</h3>
                <div className="bg-white dark:bg-white/5 p-7 rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                      <span className="ml-2 text-sm text-stone-500">{t.closer_calldetails_loading_slots}</span>
                    </div>
                  ) : dateKeys.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-neutral-400 bg-stone-50 dark:bg-white/5 rounded-lg p-4 border border-stone-200 dark:border-white/10">
                      <AlertCircle className="h-4 w-4 text-stone-400" />
                      {t.closer_calldetails_no_slots}
                    </div>
                  ) : (
                    <>
                      {/* Date navigation */}
                      <div className="flex justify-between items-center mb-5">
                        <h4 className="font-['Manrope'] font-bold text-stone-900 dark:text-white capitalize">
                          {currentDateSlots[0]?.dateLabel || ''}
                        </h4>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCurrentDateIndex(Math.max(0, currentDateIndex - 1))}
                            disabled={currentDateIndex === 0}
                            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setCurrentDateIndex(Math.min(dateKeys.length - 1, currentDateIndex + 1))}
                            disabled={currentDateIndex >= dateKeys.length - 1}
                            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {/* Time slots grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {(showAllSlots ? currentDateSlots : currentDateSlots.slice(0, 10)).map(slot => {
                          const isSelected = selectedSlot?.date === slot.date && selectedSlot?.time === slot.time
                          return (
                            <button
                              key={`${slot.date}-${slot.time}`}
                              onClick={() => setSelectedSlot(slot)}
                              className={cn(
                                'py-3.5 text-sm font-bold rounded-lg transition-all',
                                isSelected
                                  ? 'bg-emerald-700 text-white shadow-md'
                                  : 'border border-stone-200/60 dark:border-white/10 text-stone-600 dark:text-neutral-300 hover:border-emerald-600/30'
                              )}
                            >
                              {slot.timeLabel}
                            </button>
                          )
                        })}
                      </div>

                      {/* Show all slots link */}
                      {currentDateSlots.length > 10 && !showAllSlots && (
                        <div className="mt-6 flex items-center justify-center">
                          <button
                            onClick={() => setShowAllSlots(true)}
                            className="text-emerald-700 font-['Manrope'] font-bold text-sm hover:underline"
                          >
                            {t.closer_calldetails_see_all_slots}
                          </button>
                        </div>
                      )}

                      {/* Selected slot confirmation */}
                      {selectedSlot && (
                        <div className="mt-5 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                          <div className="flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-emerald-600" />
                            <div>
                              <p className="text-sm font-semibold text-stone-900 dark:text-white">{t.closer_calldetails_slot_confirmed}</p>
                              <p className="text-xs text-stone-500 dark:text-neutral-400">
                                {selectedSlot.dateLabel} — {selectedSlot.timeLabel} avec {selectedCloser.first_name} {selectedCloser.last_name}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
        </div>
      )}

      {/* NOTES TAB */}
      {activeTab === 'notes' && (
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 h-[500px] flex flex-col">
          <label className="mb-4 flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-white font-['Manrope']">
            <FileText className="h-4 w-4 text-stone-500" /> {t.closer_calldetails_notes_label}
          </label>
          <textarea
            value={notes}
            onChange={(e) => !isReadonly && setNotes(e.target.value)}
            readOnly={isReadonly}
            placeholder={t.closer_calldetails_notes_placeholder}
            className={cn(
              "flex-1 w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-3 text-base text-stone-800 dark:text-neutral-100 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 resize-none leading-relaxed",
              isReadonly && "cursor-default"
            )}
          />
          <p className="mt-3 text-xs text-stone-400 dark:text-neutral-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t.closer_calldetails_notes_info}
          </p>
        </div>
      )}

      {/* REMINDER TAB */}
      {activeTab === 'reminder' && (
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-5 w-5 text-stone-500" />
            <h3 className="text-lg font-bold text-stone-900 dark:text-white font-['Manrope']">{t.closer_calldetails_reminder_title}</h3>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">{t.closer_calldetails_reminder_label_title} <span className="text-red-500">*</span></label>
            <input type="text" value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)}
              placeholder={t.closer_calldetails_reminder_title_placeholder}
              className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">{t.closer_calldetails_reminder_label_desc} <span className="text-stone-400">{t.closer_calldetails_reminder_optional}</span></label>
            <textarea value={reminderDescription} onChange={(e) => setReminderDescription(e.target.value)}
              placeholder={t.closer_calldetails_reminder_desc_placeholder} rows={3}
              className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-neutral-200">
                <Calendar className="h-4 w-4" /> {t.closer_calldetails_reminder_label_date} <span className="text-red-500">*</span>
              </label>
              <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-neutral-200">
                <Clock className="h-4 w-4" /> {t.closer_calldetails_reminder_label_time} <span className="text-red-500">*</span>
              </label>
              <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
                className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
            </div>
          </div>

          <button onClick={handleSaveReminder}
            disabled={!reminderTitle || !reminderDate || !reminderTime || isSavingReminder}
            className={cn('w-full rounded-full px-6 py-3 text-sm font-bold text-white transition-all mt-2 font-["Manrope"]',
              reminderTitle && reminderDate && reminderTime && !isSavingReminder
                ? 'bg-stone-900 hover:bg-stone-800 shadow-sm'
                : 'bg-stone-300 !text-stone-500 cursor-not-allowed'
            )}>
            {isSavingReminder ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t.closer_calldetails_reminder_saving}</span>
            ) : t.closer_calldetails_reminder_save}
          </button>
        </div>
      )}

      {/* Footer Actions */}
      {!isReadonly && (
        <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-4 md:px-8 py-4 md:py-5 flex items-center justify-end gap-3 md:gap-5 z-40 border-t border-stone-200/40 dark:border-white/10">
          <button onClick={() => navigate('/business/appels')}
            className="px-8 py-3 rounded-full border border-stone-300 dark:border-white/10 text-stone-700 dark:text-neutral-200 font-['Manrope'] font-bold text-sm hover:bg-stone-50 dark:hover:bg-white/5 transition-all">
            {t.closer_calldetails_cancel}
          </button>
          <button onClick={handleSave} disabled={!isFormValid() || saving}
            className={cn(
              "px-10 py-3 rounded-full font-['Manrope'] font-bold text-sm text-white transition-all shadow-xl active:scale-95",
              isFormValid() && !saving
                ? 'bg-stone-900 hover:bg-stone-800'
                : 'bg-stone-300 !text-stone-500 cursor-not-allowed'
            )}>
            {saving ? t.closer_calldetails_saving : t.closer_calldetails_save_all}
          </button>
        </div>
      )}
      {isReadonly && (
        <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-4 md:px-8 py-4 md:py-5 flex items-center justify-center z-40 border-t border-stone-200/40 dark:border-white/10">
          <button onClick={() => navigate('/business/appels')}
            className="px-10 py-3 rounded-full bg-stone-900 text-white font-['Manrope'] font-bold text-sm hover:bg-stone-800 transition-all shadow-xl active:scale-95">
            {t.closer_calldetails_back_to_calls}
          </button>
        </div>
      )}
    </div>
  )
}
