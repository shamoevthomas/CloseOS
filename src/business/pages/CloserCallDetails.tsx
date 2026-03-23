import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, DollarSign,
  Calendar, Award, Bell, Loader2,
  User, Shuffle, ArrowRightCircle, CalendarCheck, AlertCircle,
  ChevronLeft, ChevronRight, PhoneMissed,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import { supabase } from '../../lib/supabase'
import { toUTC } from '../../lib/timezone'
import toast from 'react-hot-toast'

const objectionReasons = [
  'Je dois y réfléchir',
  'Manque de budget',
  'Doit en parler',
  "C'est pas le moment",
  'Autre'
]

const closerOutcomes = [
  { id: 'won', label: 'Vente', icon: CheckCircle2, iconClass: 'text-emerald-600' },
  { id: 'followup', label: 'Follow up', icon: Clock, iconClass: 'text-stone-500' },
  { id: 'lost', label: 'Perdu', icon: XCircle, iconClass: 'text-stone-500' },
  { id: 'noshow', label: 'No Show', icon: PhoneMissed, iconClass: 'text-stone-500' },
]

const setterOutcomesForOwner = [
  { id: 'qualified', label: 'Qualifié', icon: CheckCircle2, iconClass: 'text-emerald-600' },
  { id: 'booklater', label: 'À booker plus tard', icon: Calendar, iconClass: 'text-stone-500' },
  { id: 'unqualified', label: 'Non Qualifié', icon: XCircle, iconClass: 'text-stone-500' },
  { id: 'noanswer', label: 'Pas de Réponse', icon: PhoneMissed, iconClass: 'text-stone-500' },
]

interface Formula {
  id: string
  name: string
  price: number
  commission?: string
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
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const isSetterCloser = isTeamMember && teamMember?.role === 'Setter-Closer'
  const isSetterCloserSelf = isSetterCloser && teamMember?.setter_scope === 'self'
  const showSetterOutcomes = isOwnerView || isSetterCloser
  const { prospects, updateProspect } = useBusinessProspects()
  const { createEvent: createGoogleEvent, isConnected: isGoogleConnected } = useBusinessGoogleCalendar()

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
    if (!id) return
    setLoading(true)
    supabase.from('business_call_history').select('*').eq('id', id)
      .single().then(({ data, error }) => {
        if (error) console.error('Erreur chargement appel:', error.message)
        setCall(data)
        setNotes(data?.notes || liveNotes || '')
        if (liveNotes) setActiveTab('notes')
        setLoading(false)
      })
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
      supabase.from('business_team_members').select('id, first_name, last_name, email, role').eq('business_owner_id', effectiveOwnerId),
      supabase.from('business_users').select('id, full_name, email, owner_assignable').eq('id', effectiveOwnerId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const closerList = (tmRes.data || []).filter((m: any) => m.role === 'Closer' || m.role === 'Setter-Closer')
      if (ownerRes.data?.owner_assignable) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        closerList.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', email: ownerRes.data.email || '', role: 'Owner' })
      }
      setCloserMembers(closerList)
    })
  }, [showSetterOutcomes, effectiveOwnerId])

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

  // Commission calc
  const commissionRate = 10
  const totalCommission = amount > 0 ? (amount * commissionRate) / 100 : 0
  const monthlyCommission = paymentType === 'installments' && installmentsCount > 0
    ? totalCommission / installmentsCount : 0

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
      toast.error('Aucun closer disponible')
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
              dateLabel: date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
              timeLabel: `${timeStr} - ${String(Math.floor((mins + SLOT_DURATION) / 60)).padStart(2, '0')}:${String((mins + SLOT_DURATION) % 60).padStart(2, '0')}`,
            })
          }
        }
      }
      setAvailableSlots(slots)
      setCurrentDateIndex(0)
    } catch (err) {
      console.error('Error loading slots:', err)
      toast.error('Erreur lors du chargement des créneaux')
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
      if (followupReason === 'Autre' && !followupReasonOther.trim()) return false
    }
    if (selectedOutcome === 'lost') {
      if (!lostReason) return false
      if (lostReason === 'Autre' && !lostReasonOther.trim()) return false
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
        if (selectedOutcome === 'won' && amount > 0) {
          updates.value = amount
          updates.payment_type = paymentType
          updates.installments = paymentType === 'installments' ? installmentsCount : null
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
          description: `Follow up — Motif: ${followupReason === 'Autre' ? followupReasonOther : followupReason}`,
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
            description: `Follow up — Motif: ${followupReason === 'Autre' ? followupReasonOther : followupReason}`,
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

      toast.success('Sauvegardé')
      navigate('/business/appels')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
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
      toast.success('Rappel programmé')
    } catch {
      toast.error('Erreur lors de la création du rappel')
    }
    setIsSavingReminder(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-stone-400" /></div>
  }

  if (!call) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-500 dark:text-neutral-400">Appel introuvable</p>
        <button onClick={() => navigate('/business/appels')} className="mt-4 text-stone-900 dark:text-white font-semibold hover:underline">Retour aux appels</button>
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

  const renderOutcomeCards = (outcomes: typeof closerOutcomes, label: string, required?: boolean) => (
    <section>
      <h3 className="font-['Manrope'] text-lg font-bold mb-5 flex items-center gap-2">
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
      </div>
    </section>
  )

  const tabs = [
    { id: 'qualification' as const, label: 'Qualification' },
    { id: 'notes' as const, label: "Notes d'appel" },
    { id: 'reminder' as const, label: 'Programmer un rappel' },
  ]

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="mb-10">
        <button
          onClick={() => navigate('/business/appels')}
          className="mb-6 flex items-center gap-2 text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors font-['Manrope'] font-semibold"
        >
          <ArrowLeft className="h-5 w-5" /> Retour
        </button>

        {/* Readonly banner */}
        {isReadonly && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 backdrop-blur-md px-5 py-3 flex items-center gap-3 mb-6">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
            <p className="text-sm font-medium text-blue-700">Mode consultation — Cet appel a déjà été qualifié</p>
          </div>
        )}

        <h1 className="font-['Manrope'] text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white mb-2">
          {isReadonly ? "Détails de l'appel avec" : isSetterCloser ? "Résumé d'appel avec" : 'Résumé de Vente avec'} {call.contact_name}
        </h1>
        <div className="flex items-center gap-2 text-stone-500 dark:text-neutral-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">
            {new Date(call.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' à '}
            {new Date(call.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {call.duration && call.duration !== 'En cours...' && ` (${call.duration})`}
          </span>
        </div>
        {prospect && prospectFormula && (
          <div className="mt-4 inline-flex items-center gap-3 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm px-5 py-3">
            <Award className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-xs text-stone-400 dark:text-neutral-500">Offre liée</p>
              <p className="text-sm font-bold text-stone-900 dark:text-white font-['Manrope']">{prospectFormula.name} - {prospectFormula.price}€</p>
            </div>
          </div>
        )}
        {prospect && !prospectFormula && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-stone-50/50 dark:bg-white/5 border border-stone-200/40 dark:border-white/10 px-5 py-3">
            <p className="text-sm text-stone-500 dark:text-neutral-400">Aucune offre liée à ce prospect</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-8 mb-10 border-b border-stone-200/60 dark:border-white/10">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-10">
            {/* Closer Outcomes */}
            {renderOutcomeCards(closerOutcomes, "Résultat de l'appel — Closer", true)}

            {/* Setter Outcomes (for owner/HOS/admin/setter-closer) */}
            {showSetterOutcomes && renderOutcomeCards(setterOutcomesForOwner, "Résultat de l'appel — Setter")}

            {/* Won: Payment Terms & Commission */}
            {selectedOutcome === 'won' && (
              <section className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 space-y-5">
                <h3 className="font-['Manrope'] text-lg font-bold flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" /> Détails de la vente
                </h3>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Montant de la vente <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.01"
                      value={amount || ''}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Ex: 5000"
                      className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-3 pr-12 text-lg text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-medium">€</div>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Mode de paiement</label>
                  <div className="flex gap-3">
                    <button onClick={() => setPaymentType('comptant')}
                      className={cn('flex-1 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-all font-[\"Manrope\"]',
                        paymentType === 'comptant' ? 'border-emerald-600 bg-white text-emerald-700' : 'border-stone-200/40 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 text-stone-500 dark:text-neutral-400 hover:border-stone-300 dark:hover:border-white/20')}>
                      Comptant
                    </button>
                    <button onClick={() => setPaymentType('installments')}
                      className={cn('flex-1 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-all font-[\"Manrope\"]',
                        paymentType === 'installments' ? 'border-emerald-600 bg-white text-emerald-700' : 'border-stone-200/40 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 text-stone-500 dark:text-neutral-400 hover:border-stone-300 dark:hover:border-white/20')}>
                      Plusieurs fois
                    </button>
                  </div>
                </div>
                {paymentType === 'installments' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Nombre de mensualités</label>
                    <select value={installmentsCount} onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
                      className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10">
                      {Array.from({ length: 23 }, (_, i) => i + 2).map(num => (
                        <option key={num} value={num}>{num} mois</option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm text-stone-500 dark:text-neutral-400">
                      Montant par mois: <span className="text-emerald-600 font-semibold">{(amount / installmentsCount).toFixed(2)}€</span>
                    </p>
                  </div>
                )}
                {amount > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-emerald-600" />
                      <h4 className="text-sm font-bold text-emerald-700 font-['Manrope']">Ta Commission</h4>
                    </div>
                    <p className="text-2xl font-extrabold text-emerald-600 font-['Manrope']">{totalCommission.toFixed(2)} €</p>
                    {paymentType === 'installments' && (
                      <p className="mt-1 text-sm text-stone-600 dark:text-neutral-300">
                        Tu recevras: <span className="font-semibold text-emerald-600">{monthlyCommission.toFixed(2)}€/mois</span>
                      </p>
                    )}
                    <p className="mt-2 text-xs text-stone-400 dark:text-neutral-500">Taux de commission: {commissionRate}%</p>
                  </div>
                )}
              </section>
            )}

            {/* Follow up (closer outcome) */}
            {selectedOutcome === 'followup' && (
              <section className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 space-y-5">
                <h3 className="font-['Manrope'] text-lg font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-stone-500" /> Informations de suivi
                </h3>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-neutral-200">
                    <Calendar className="h-4 w-4" /> Date de reprogrammation <span className="text-red-500">*</span>
                  </label>
                  <input type="datetime-local" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Motif du report <span className="text-red-500">*</span></label>
                  <select value={followupReason} onChange={(e) => { setFollowupReason(e.target.value); if (e.target.value !== 'Autre') setFollowupReasonOther('') }}
                    className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10">
                    <option value="">Sélectionnez un motif</option>
                    {objectionReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {followupReason === 'Autre' && (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Précisez le motif <span className="text-red-500">*</span></label>
                      <input type="text" value={followupReasonOther} onChange={(e) => setFollowupReasonOther(e.target.value)}
                        placeholder="Ex: Indisponibilité exceptionnelle..."
                        className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Lost (closer outcome) */}
            {selectedOutcome === 'lost' && (
              <section className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 space-y-5">
                <h3 className="font-['Manrope'] text-lg font-bold flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-stone-500" /> Raison de la perte
                </h3>
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Motif <span className="text-red-500">*</span></label>
                  <select value={lostReason} onChange={(e) => { setLostReason(e.target.value); if (e.target.value !== 'Autre') setLostReasonOther('') }}
                    className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10">
                    <option value="">Sélectionnez un motif</option>
                    {objectionReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {lostReason === 'Autre' && (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Précisez le motif <span className="text-red-500">*</span></label>
                      <input type="text" value={lostReasonOther} onChange={(e) => setLostReasonOther(e.target.value)}
                        placeholder="Ex: Prix trop élevé..."
                        className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Qualified: auto-assign for setter-closer self */}
            {selectedOutcome === 'qualified' && isSetterCloserSelf && (
              <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-5">
                <p className="text-sm text-stone-700 dark:text-neutral-200 text-center font-['Manrope'] font-medium">
                  Le prospect sera automatiquement assigné à vous en tant que Closer.
                </p>
              </div>
            )}

            {/* Qualified: Closer assignment (setter outcome for owner) */}
            {selectedOutcome === 'qualified' && showSetterOutcomes && !isSetterCloserSelf && (
              <section>
                <h3 className="font-['Manrope'] text-lg font-bold mb-5">Étape 1 — Assigner un Closer</h3>
                <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl p-7 rounded-xl border border-white/40 dark:border-white/10 shadow-sm">
                  {closerMembers.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-neutral-400 bg-stone-50 dark:bg-white/5 rounded-lg p-4 border border-stone-200 dark:border-white/10">
                      <AlertCircle className="h-4 w-4 text-stone-400" />
                      Aucun closer dans l'équipe
                    </div>
                  ) : (
                    <>
                      {/* Manual closer dropdown */}
                      <div className="mb-5">
                        <label className="mb-2 block text-xs font-medium text-stone-500 dark:text-neutral-400">Sélectionner manuellement</label>
                        <select
                          value={assignmentMode === 'manual' ? selectedCloser?.id || '' : ''}
                          onChange={(e) => e.target.value && handleManualSelect(e.target.value)}
                          className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm text-stone-700 dark:text-neutral-200 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                        >
                          <option value="">-- Choisir un closer --</option>
                          {closerMembers.map(c => (
                            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.role === 'Owner' ? ' (Owner)' : ''}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-3 mb-6">
                        <button
                          onClick={() => handleAssign('suivant')}
                          className={cn(
                            'flex-1 py-3 px-6 rounded-full font-["Manrope"] font-bold text-sm transition-all',
                            assignmentMode === 'suivant'
                              ? 'bg-stone-900 text-white'
                              : 'border border-stone-300 dark:border-white/10 text-stone-700 dark:text-neutral-200 hover:bg-stone-100 dark:hover:bg-white/5'
                          )}
                        >
                          Suivant (Tournante)
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
                          Hasard
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
                              {selectedCloser.role === 'Owner' ? 'Owner' : 'Closer'} {'\u2022'} Disponible
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
          </div>

          {/* Right Column: Step 2 - Scheduling */}
          {selectedOutcome === 'qualified' && selectedCloser && showSetterOutcomes && !isSetterCloserSelf && (
            <div className="lg:col-span-5">
              <section>
                <h3 className="font-['Manrope'] text-lg font-bold mb-5">Étape 2 — Programmer le RDV</h3>
                <div className="bg-white dark:bg-white/5 p-7 rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                      <span className="ml-2 text-sm text-stone-500">Chargement des créneaux...</span>
                    </div>
                  ) : dateKeys.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-neutral-400 bg-stone-50 dark:bg-white/5 rounded-lg p-4 border border-stone-200 dark:border-white/10">
                      <AlertCircle className="h-4 w-4 text-stone-400" />
                      Aucun créneau disponible pour ce closer dans les 14 prochains jours.
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
                            Voir tous les créneaux
                          </button>
                        </div>
                      )}

                      {/* Selected slot confirmation */}
                      {selectedSlot && (
                        <div className="mt-5 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                          <div className="flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-emerald-600" />
                            <div>
                              <p className="text-sm font-semibold text-stone-900 dark:text-white">RDV confirmé</p>
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
      )}

      {/* NOTES TAB */}
      {activeTab === 'notes' && (
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 h-[500px] flex flex-col">
          <label className="mb-4 flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-white font-['Manrope']">
            <FileText className="h-4 w-4 text-stone-500" /> Historique et Notes de l'appel
          </label>
          <textarea
            value={notes}
            onChange={(e) => !isReadonly && setNotes(e.target.value)}
            readOnly={isReadonly}
            placeholder="Prenez vos notes ici. Elles seront enregistrées dans l'historique des appels..."
            className={cn(
              "flex-1 w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-3 text-base text-stone-800 dark:text-neutral-100 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 resize-none leading-relaxed",
              isReadonly && "cursor-default"
            )}
          />
          <p className="mt-3 text-xs text-stone-400 dark:text-neutral-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Ces notes s'ajouteront a l'historique des appels du prospect.
          </p>
        </div>
      )}

      {/* REMINDER TAB */}
      {activeTab === 'reminder' && (
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-7 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-5 w-5 text-stone-500" />
            <h3 className="text-lg font-bold text-stone-900 dark:text-white font-['Manrope']">Programmer un rappel</h3>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Titre <span className="text-red-500">*</span></label>
            <input type="text" value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)}
              placeholder="Ex: Rappeler Jean pour le contrat"
              className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Description <span className="text-stone-400">(optionnel)</span></label>
            <textarea value={reminderDescription} onChange={(e) => setReminderDescription(e.target.value)}
              placeholder="Details supplémentaires..." rows={3}
              className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-neutral-200">
                <Calendar className="h-4 w-4" /> Date <span className="text-red-500">*</span>
              </label>
              <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-neutral-200">
                <Clock className="h-4 w-4" /> Heure <span className="text-red-500">*</span>
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
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</span>
            ) : 'Enregistrer le rappel'}
          </button>
        </div>
      )}

      {/* Footer Actions */}
      {!isReadonly && (
        <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-8 py-5 flex items-center justify-end gap-5 z-40 border-t border-stone-200/40 dark:border-white/10">
          <button onClick={() => navigate('/business/appels')}
            className="px-8 py-3 rounded-full border border-stone-300 dark:border-white/10 text-stone-700 dark:text-neutral-200 font-['Manrope'] font-bold text-sm hover:bg-stone-50 dark:hover:bg-white/5 transition-all">
            Annuler
          </button>
          <button onClick={handleSave} disabled={!isFormValid() || saving}
            className={cn(
              "px-10 py-3 rounded-full font-['Manrope'] font-bold text-sm text-white transition-all shadow-xl active:scale-95",
              isFormValid() && !saving
                ? 'bg-stone-900 hover:bg-stone-800'
                : 'bg-stone-300 !text-stone-500 cursor-not-allowed'
            )}>
            {saving ? 'Enregistrement...' : 'Tout Enregistrer'}
          </button>
        </div>
      )}
      {isReadonly && (
        <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-8 py-5 flex items-center justify-center z-40 border-t border-stone-200/40 dark:border-white/10">
          <button onClick={() => navigate('/business/appels')}
            className="px-10 py-3 rounded-full bg-stone-900 text-white font-['Manrope'] font-bold text-sm hover:bg-stone-800 transition-all shadow-xl active:scale-95">
            Retour aux appels
          </button>
        </div>
      )}
    </div>
  )
}
