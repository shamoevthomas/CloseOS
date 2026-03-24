import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, Calendar,
  LayoutList, PenTool, Bell, Loader2, Save, Shuffle, ArrowRightCircle,
  User, CalendarCheck, AlertCircle, ChevronLeft, ChevronRight, PhoneMissed,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import { supabase } from '../../lib/supabase'
import { toUTC } from '../../lib/timezone'
import toast from 'react-hot-toast'

const setterOutcomes = [
  { id: 'qualified', label: 'Qualifié', icon: CheckCircle2, iconClass: 'text-emerald-600' },
  { id: 'booklater', label: 'À booker plus tard', icon: Calendar, iconClass: 'text-stone-500' },
  { id: 'unqualified', label: 'Non Qualifié', icon: XCircle, iconClass: 'text-stone-500' },
  { id: 'noanswer', label: 'Pas de Réponse', icon: PhoneMissed, iconClass: 'text-stone-500' },
]

interface Closer {
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

export function SetterCallDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isReadonly = searchParams.get('readonly') === '1'
  const { user, teamMember, ownerUserId, isTeamMember, userTimezone } = useBusinessAuth()
  const { prospects, updateProspect } = useBusinessProspects()
  const { createEvent: createGoogleEvent, isConnected: isGoogleConnected } = useBusinessGoogleCalendar()

  const [call, setCall] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'qualification' | 'notes' | 'reminder'>('qualification')

  // Form state
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Closer assignment
  const [closers, setClosers] = useState<Closer[]>([])
  const [selectedCloser, setSelectedCloser] = useState<Closer | null>(null)
  const [assignmentMode, setAssignmentMode] = useState<'suivant' | 'hasard' | 'manual' | null>(null)

  // Scheduling
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [currentDateIndex, setCurrentDateIndex] = useState(0)
  const [showAllSlots, setShowAllSlots] = useState(false)

  // Reminder fields
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderDescription, setReminderDescription] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [isSavingReminder, setIsSavingReminder] = useState(false)

  const liveNotes = (location.state as any)?.liveNotes || ''
  const effectiveOwnerId = ownerUserId || user?.id

  // Load call
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

  // Load closers + owner
  useEffect(() => {
    if (!effectiveOwnerId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, email, role, owner_assignable').eq('business_owner_id', effectiveOwnerId),
      supabase.from('business_users').select('id, full_name, email, owner_assignable').eq('id', effectiveOwnerId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const closerList = (tmRes.data || []).filter((m: any) => m.role?.toLowerCase() === 'closer' || m.owner_assignable)
      if (ownerRes.data?.owner_assignable) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        closerList.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', email: ownerRes.data.email || '', role: 'Owner' })
      }
      setClosers(closerList)
    })
  }, [effectiveOwnerId])

  // Find linked prospect
  const prospect = call?.contact_id
    ? prospects.find(p => p.id === call.contact_id)
    : call?.contact_name
      ? prospects.find(p => {
          const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim()
          return p.contact === call.contact_name || fullName === call.contact_name
        })
      : null

  // Readonly: pre-fill outcome from prospect stage
  useEffect(() => {
    if (!isReadonly || !prospect) return
    const stage = (prospect as any).stage
    const reverseMap: Record<string, string> = {
      qualified: 'qualified', unqualified: 'unqualified', noanswer: 'noanswer',
    }
    if (stage && reverseMap[stage]) setSelectedOutcome(reverseMap[stage])
    if (stage === 'qualified' && call?.notes?.includes('booker plus tard')) setSelectedOutcome('booklater')
  }, [isReadonly, prospect, call])

  // Round-robin: get next closer
  const getNextCloser = useCallback(async () => {
    if (closers.length === 0) return null
    const { data: rrState } = await supabase
      .from('business_round_robin_state')
      .select('last_assigned_closer_id')
      .eq('business_owner_id', effectiveOwnerId!)
      .single()

    const lastId = rrState?.last_assigned_closer_id
    if (!lastId) return closers[0]

    const lastIdx = closers.findIndex(c => c.id === lastId)
    const nextIdx = (lastIdx + 1) % closers.length
    return closers[nextIdx]
  }, [closers, effectiveOwnerId])

  // Random closer
  const getRandomCloser = useCallback(() => {
    if (closers.length === 0) return null
    return closers[Math.floor(Math.random() * closers.length)]
  }, [closers])

  // Handle assignment mode
  const handleAssign = async (mode: 'suivant' | 'hasard') => {
    setAssignmentMode(mode)
    setSelectedSlot(null)
    setAvailableSlots([])

    let closer: Closer | null = null
    if (mode === 'suivant') {
      closer = await getNextCloser()
    } else {
      closer = getRandomCloser()
    }

    if (closer) {
      setSelectedCloser(closer)
      loadAvailableSlots(closer.id)
    } else {
      toast.error('Aucun closer disponible')
    }
  }

  // Handle manual closer selection
  const handleManualSelect = (closerId: string) => {
    const closer = closers.find(c => c.id === closerId) || null
    if (closer) {
      setAssignmentMode('manual')
      setSelectedCloser(closer)
      setSelectedSlot(null)
      setAvailableSlots([])
      loadAvailableSlots(closer.id)
    }
  }

  // Load available time slots for a closer
  const loadAvailableSlots = async (closerId: string) => {
    if (!effectiveOwnerId) return
    setLoadingSlots(true)

    try {
      const [slotsRes, absencesRes, appointmentsRes] = await Promise.all([
        supabase.from('business_availability_slots').select('*')
          .eq('team_member_id', closerId),
        supabase.from('business_absences').select('start_date, end_date')
          .eq('team_member_id', closerId)
          .gte('end_date', new Date().toISOString().split('T')[0]),
        supabase.from('business_appointments').select('date, time, duration')
          .eq('assigned_to', closerId)
          .gte('date', new Date().toISOString().split('T')[0])
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
              const slotStart = mins
              const slotEnd = mins + SLOT_DURATION
              return slotStart < apptEnd && slotEnd > apptStart
            })
            if (hasConflict) continue

            const dateLabel = date.toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long'
            })

            slots.push({
              date: dateStr,
              time: timeStr,
              dateLabel,
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

  const isFormValid = () => {
    if (!selectedOutcome) return false
    if (selectedOutcome === 'qualified' && (!selectedCloser || !selectedSlot)) return false
    if (selectedOutcome === 'booklater' && (!reminderTitle || !reminderDate || !reminderTime)) return false
    return true
  }

  const handleSave = async () => {
    if (!call || !isFormValid()) return
    setSaving(true)
    try {
      const stageMap: Record<string, string> = {
        qualified: 'qualified', booklater: 'qualified', unqualified: 'unqualified', noanswer: 'noanswer'
      }

      let technicalSummary = `[${new Date().toLocaleDateString('fr-FR')}] Qualification: ${selectedOutcome}`
      if (selectedOutcome === 'qualified' && selectedCloser && selectedSlot) {
        technicalSummary += `\n- Closer assigné: ${selectedCloser.first_name} ${selectedCloser.last_name}`
        technicalSummary += `\n- RDV: ${selectedSlot.dateLabel} à ${selectedSlot.timeLabel}`
        technicalSummary += `\n- Mode: ${assignmentMode === 'suivant' ? 'Tournante' : assignmentMode === 'hasard' ? 'Hasard' : 'Manuel'}`
      }
      if (selectedOutcome === 'booklater') {
        technicalSummary += `\n- À booker plus tard — Rappel: ${reminderDate} à ${reminderTime}`
      }

      const finalNotes = notes ? `${notes}\n\n${technicalSummary}` : technicalSummary
      const { error: callError } = await supabase.from('business_call_history').update({ notes: finalNotes }).eq('id', call.id)
      if (callError) console.error('Erreur update call:', callError.message)

      if (prospect && selectedOutcome) {
        const updates: any = {
          stage: stageMap[selectedOutcome],
          last_contact: new Date().toISOString(),
        }

        if (selectedOutcome === 'qualified' && selectedCloser) {
          updates.assigned_to = selectedCloser.id
        }

        const currentCallNotes = Array.isArray((prospect as any).call_notes) ? (prospect as any).call_notes : []
        updates.call_notes = [...currentCallNotes, {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          content: finalNotes,
          type: 'call',
          call_id: id,
          author: teamMember?.first_name || 'Setter'
        }]

        await updateProspect(prospect.id, updates)
      }

      if (selectedOutcome === 'booklater' && effectiveOwnerId) {
        const reminderDateTime = `${reminderDate}T${reminderTime}:00`
        const { error: remErr } = await supabase.from('business_reminders').insert([{
          user_id: effectiveOwnerId,
          team_member_id: teamMember?.id,
          call_id: call.id,
          title: reminderTitle,
          description: reminderDescription || null,
          reminder_date: reminderDateTime,
          is_done: false,
        }])
        if (remErr) console.error('Erreur reminder:', remErr.message)
      }

      if (selectedOutcome === 'qualified' && selectedCloser && selectedSlot && effectiveOwnerId) {
        const { error: apptError } = await supabase.from('business_appointments').insert([{
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
          notes: `Qualifié par ${teamMember?.first_name || 'Setter'}. ${notes || ''}`.trim(),
        }])
        if (apptError) console.error('Erreur appointment:', apptError.message)

        if (isGoogleConnected) {
          const [startH, startM] = selectedSlot.time.split(':').map(Number)
          const endMinutes = startH * 60 + startM + 30
          const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
          await createGoogleEvent({
            title: `Call — ${call.contact_name}`,
            date: selectedSlot.date,
            startTime: selectedSlot.time,
            endTime,
            description: `Prospect qualifié par ${teamMember?.first_name || 'Setter'}.\nCloser: ${selectedCloser.first_name} ${selectedCloser.last_name}\n${notes || ''}`.trim(),
            withGoogleMeet: true,
          })
        }

        if (assignmentMode === 'suivant') {
          const { data: existing } = await supabase
            .from('business_round_robin_state')
            .select('id')
            .eq('business_owner_id', effectiveOwnerId)
            .single()

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

      toast.success('Sauvegardé')
      navigate('/business/appels')
    } catch (err) {
      console.error(err)
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
        <p className="text-stone-500">Appel introuvable</p>
        <button onClick={() => navigate('/business/appels')} className="mt-4 text-stone-900 font-semibold hover:underline">Retour aux appels</button>
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
          {isReadonly ? "Détails de l'appel avec" : 'Qualifiez votre appel avec'} {call.contact_name}
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
            {/* Résultat de l'appel */}
            <section>
              <h3 className="font-['Manrope'] text-lg font-bold mb-5 flex items-center gap-2 text-stone-900 dark:text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Résultat de l'appel
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {setterOutcomes.map(outcome => {
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

            {/* Étape 1 — Assigner un Closer */}
            {selectedOutcome === 'qualified' && (
              <section>
                <h3 className="font-['Manrope'] text-lg font-bold mb-5 text-stone-900 dark:text-white">Étape 1 — Assigner un Closer</h3>
                <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl p-7 rounded-xl border border-white/40 dark:border-white/10 shadow-sm">
                  {closers.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-neutral-400 bg-stone-50 dark:bg-white/5 rounded-lg p-4 border border-stone-200 dark:border-white/10">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
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
                          className="w-full rounded-lg border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm text-stone-700 dark:text-neutral-200 focus:border-stone-900 dark:focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                        >
                          <option value="">— Choisir un closer —</option>
                          {closers.map(c => (
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
                              ? 'bg-stone-900 dark:bg-white text-white dark:text-neutral-900'
                              : 'border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-200 hover:bg-stone-100 dark:hover:bg-white/5'
                          )}
                        >
                          Suivant (Tournante)
                        </button>
                        <button
                          onClick={() => handleAssign('hasard')}
                          className={cn(
                            'flex-1 py-3 px-6 rounded-full font-["Manrope"] font-bold text-sm transition-all',
                            assignmentMode === 'hasard'
                              ? 'bg-stone-900 dark:bg-white text-white dark:text-neutral-900'
                              : 'border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-200 hover:bg-stone-100 dark:hover:bg-white/5'
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
                              {selectedCloser.role === 'Owner' ? 'Owner' : 'Closer'} • Disponible
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
          {selectedOutcome === 'qualified' && selectedCloser && (
            <div className="lg:col-span-5">
              <section>
                <h3 className="font-['Manrope'] text-lg font-bold mb-5 text-stone-900 dark:text-white">Étape 2 — Programmer le RDV</h3>
                <div className="bg-white dark:bg-white/5 p-7 rounded-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                      <span className="ml-2 text-sm text-stone-500">Chargement des créneaux...</span>
                    </div>
                  ) : dateKeys.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-neutral-400 bg-stone-50 dark:bg-white/5 rounded-lg p-4 border border-stone-200 dark:border-white/10">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
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
                            className="p-2 rounded-full hover:bg-stone-100 transition-colors disabled:opacity-30"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setCurrentDateIndex(Math.min(dateKeys.length - 1, currentDateIndex + 1))}
                            disabled={currentDateIndex >= dateKeys.length - 1}
                            className="p-2 rounded-full hover:bg-stone-100 transition-colors disabled:opacity-30"
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
              "flex-1 w-full rounded-lg border border-stone-200 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-3 text-base text-stone-800 dark:text-neutral-100 placeholder-stone-400 dark:placeholder-neutral-500 focus:border-stone-900 dark:focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-stone-900/10 resize-none leading-relaxed",
              isReadonly && "cursor-default"
            )}
          />
          <p className="mt-3 text-xs text-stone-400 dark:text-neutral-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Ces notes s'ajouteront à l'historique des appels du prospect.
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
              className="w-full rounded-lg border border-stone-200 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-neutral-500 focus:border-stone-900 dark:focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-neutral-200">Description <span className="text-stone-400">(optionnel)</span></label>
            <textarea value={reminderDescription} onChange={(e) => setReminderDescription(e.target.value)}
              placeholder="Détails supplémentaires..." rows={3}
              className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-neutral-200">
                <Calendar className="h-4 w-4" /> Date <span className="text-red-500">*</span>
              </label>
              <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 dark:focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-neutral-200">
                <Clock className="h-4 w-4" /> Heure <span className="text-red-500">*</span>
              </label>
              <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
                className="w-full rounded-lg border border-stone-200 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-900 dark:focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-stone-900/10" />
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
            className="px-8 py-3 rounded-full border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-200 font-['Manrope'] font-bold text-sm hover:bg-stone-50 dark:hover:bg-white/5 transition-all">
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
