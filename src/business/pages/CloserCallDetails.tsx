import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, DollarSign,
  Calendar, Award, LayoutList, PenTool, Bell, Loader2, Save, Eye,
  User, Shuffle, ArrowRightCircle, CalendarCheck, AlertCircle,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const objectionReasons = [
  'Je dois y réfléchir',
  'Manque de budget',
  'Doit en parler',
  "C'est pas le moment",
  'Autre'
]

const closerOutcomes = [
  { id: 'won', label: 'Vente', description: 'Deal gagné', icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600' },
  { id: 'followup', label: 'Follow up', description: 'Follow-up nécessaire', icon: Clock, color: 'orange', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' },
  { id: 'lost', label: 'Perdu', description: 'Deal perdu', icon: XCircle, color: 'red', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' },
  { id: 'noshow', label: 'No Show', description: 'Pas de réponse', icon: XCircle, color: 'slate', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
]

const setterOutcomesForOwner = [
  { id: 'qualified', label: 'Qualifié', description: 'Prospect qualifié', icon: CheckCircle2, color: 'purple', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600' },
  { id: 'booklater', label: 'À booker plus tard', description: 'Qualifié, rappel', icon: Clock, color: 'indigo', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600' },
  { id: 'unqualified', label: 'Non Qualifié', description: 'Prospect non qualifié', icon: XCircle, color: 'rose', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600' },
  { id: 'noanswer', label: 'Pas de Réponse', description: 'Aucune réponse', icon: XCircle, color: 'zinc', bg: 'bg-zinc-50', border: 'border-zinc-200', text: 'text-zinc-600' },
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
  const { user, teamMember, ownerUserId, isTeamMember } = useBusinessAuth()
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
      supabase.from('business_users').select('id, full_name, email').eq('id', effectiveOwnerId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const closerList = (tmRes.data || []).filter((m: any) => m.role === 'Closer' || m.role === 'Setter-Closer')
      if (ownerRes.data) {
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

  // Group slots by date for display
  const slotsByDate = availableSlots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = []
    acc[slot.date].push(slot)
    return acc
  }, {})

  const renderOutcomeButton = (outcome: any) => {
    const Icon = outcome.icon
    const isSelected = selectedOutcome === outcome.id
    return (
      <button
        key={outcome.id}
        disabled={isReadonly}
        onClick={() => {
          if (isReadonly) return
          setSelectedOutcome(outcome.id)
          // Reset closer assignment when switching outcomes
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
  }

  return (
    <div className={cn("max-w-3xl mx-auto space-y-6", isReadonly && "pointer-events-auto")}>
      {/* Readonly banner */}
      {isReadonly && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <Eye className="h-5 w-5 text-blue-600 shrink-0" />
          <p className="text-sm font-medium text-blue-700">Mode consultation — Cet appel a déjà été qualifié</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate('/business/appels')} className="mb-4 flex items-center gap-2 text-slate-400 hover:text-amber-700 transition-colors">
          <ArrowLeft className="h-5 w-5" /> Retour
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isReadonly ? 'Détails de l\'appel' : isSetterCloser ? 'Résumé d\'appel' : 'Résumé de Vente'}
          </h1>
          <p className="mt-1 text-slate-500">
            {isReadonly ? 'Appel avec' : 'Qualifiez votre appel avec'} <span className="font-semibold text-slate-900">{call.contact_name}</span>
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
                Résultat de l'appel — Closer <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {closerOutcomes.map(renderOutcomeButton)}
              </div>

              {showSetterOutcomes && (
                <>
                  <label className="mt-6 mb-4 block text-sm font-bold text-slate-900">
                    Résultat de l'appel — Setter
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {setterOutcomesForOwner.map(renderOutcomeButton)}
                  </div>
                </>
              )}
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

            {/* Follow up (closer outcome) */}
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

            {/* Lost (closer outcome) */}
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

            {/* Qualified: auto-assign for setter-closer self */}
            {selectedOutcome === 'qualified' && isSetterCloserSelf && (
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                <p className="text-sm text-purple-700 text-center">
                  Le prospect sera automatiquement assigné à vous en tant que Closer.
                </p>
              </div>
            )}

            {/* Qualified: Closer assignment + scheduling (setter outcome) */}
            {selectedOutcome === 'qualified' && showSetterOutcomes && !isSetterCloserSelf && (
              <div className="space-y-5">
                {/* Step 1: Closer Assignment */}
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-6">
                  <h3 className="text-sm font-bold text-purple-700 flex items-center gap-2 mb-4">
                    <User className="h-4 w-4" /> Étape 1 — Assigner un Closer
                  </h3>

                  {closerMembers.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-white rounded-lg p-4 border border-slate-200">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Aucun closer dans l'équipe
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <label className="mb-2 block text-xs font-medium text-purple-600">Sélectionner manuellement</label>
                        <select
                          value={assignmentMode === 'manual' ? selectedCloser?.id || '' : ''}
                          onChange={(e) => e.target.value && handleManualSelect(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        >
                          <option value="">— Choisir un closer —</option>
                          {closerMembers.map(c => (
                            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-3 mb-4">
                        <button onClick={() => handleAssign('suivant')}
                          className={cn('flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all',
                            assignmentMode === 'suivant' ? 'border-purple-500 bg-purple-100 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:bg-purple-50')}>
                          <ArrowRightCircle className="h-4 w-4" /> Suivant (Tournante)
                        </button>
                        <button onClick={() => handleAssign('hasard')}
                          className={cn('flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all',
                            assignmentMode === 'hasard' ? 'border-purple-500 bg-purple-100 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:bg-purple-50')}>
                          <Shuffle className="h-4 w-4" /> Hasard
                        </button>
                      </div>
                      {selectedCloser && (
                        <div className="flex items-center gap-3 rounded-lg bg-white border border-purple-200 p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
                            {selectedCloser.first_name?.[0]}{selectedCloser.last_name?.[0]}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900">{selectedCloser.first_name} {selectedCloser.last_name}</p>
                            <p className="text-xs text-slate-500">{selectedCloser.email}</p>
                          </div>
                          <div className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
                            {assignmentMode === 'suivant' ? 'Tournante' : assignmentMode === 'hasard' ? 'Hasard' : 'Manuel'}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Step 2: Time Slot Selection */}
                {selectedCloser && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6">
                    <h3 className="text-sm font-bold text-blue-700 flex items-center gap-2 mb-4">
                      <CalendarCheck className="h-4 w-4" /> Étape 2 — Programmer le RDV
                    </h3>
                    {loadingSlots ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        <span className="ml-2 text-sm text-slate-500">Chargement des créneaux...</span>
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500 bg-white rounded-lg p-4 border border-slate-200">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        Aucun créneau disponible pour ce closer dans les 14 prochains jours.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                        {Object.entries(slotsByDate).map(([date, slots]) => (
                          <div key={date}>
                            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2 sticky top-0 bg-blue-50/90 py-1">
                              {slots[0].dateLabel}
                            </p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                              {slots.map(slot => {
                                const isSlotSelected = selectedSlot?.date === slot.date && selectedSlot?.time === slot.time
                                return (
                                  <button key={`${slot.date}-${slot.time}`} onClick={() => setSelectedSlot(slot)}
                                    className={cn('rounded-lg border px-3 py-2 text-xs font-medium transition-all text-center',
                                      isSlotSelected ? 'border-blue-500 bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50')}>
                                    {slot.timeLabel}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedSlot && (
                      <div className="mt-4 rounded-lg bg-white border border-blue-200 p-4">
                        <div className="flex items-center gap-2">
                          <CalendarCheck className="h-4 w-4 text-blue-600" />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">RDV confirmé</p>
                            <p className="text-xs text-slate-500">
                              {selectedSlot.dateLabel} — {selectedSlot.timeLabel} avec {selectedCloser.first_name} {selectedCloser.last_name}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
              onChange={(e) => !isReadonly && setNotes(e.target.value)}
              readOnly={isReadonly}
              placeholder="Prenez vos notes ici. Elles seront enregistrées dans l'historique des appels..."
              className={cn("flex-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none leading-relaxed", isReadonly && "cursor-default")}
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
        {!isReadonly && (
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
        )}
        {isReadonly && (
          <div className="flex justify-center pt-4 border-t border-slate-200 mt-6">
            <button onClick={() => navigate('/business/appels')}
              className="rounded-xl bg-amber-600 px-8 py-2.5 text-sm font-bold text-white hover:bg-amber-500 transition-all">
              Retour aux appels
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
