import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, Calendar,
  LayoutList, PenTool, Bell, Loader2, Save, Shuffle, ArrowRightCircle,
  User, CalendarCheck, AlertCircle,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const setterOutcomes = [
  { id: 'qualified', label: 'Qualifié', description: 'Prospect qualifié', icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600' },
  { id: 'booklater', label: 'À booker plus tard', description: 'Qualifié, rappel', icon: Clock, color: 'orange', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' },
  { id: 'unqualified', label: 'Non Qualifié', description: 'Prospect non qualifié', icon: XCircle, color: 'red', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' },
  { id: 'noanswer', label: 'Pas de Réponse', description: 'Aucune réponse', icon: XCircle, color: 'slate', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
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
  const { user, teamMember, ownerUserId, isTeamMember } = useBusinessAuth()
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
      supabase.from('business_team_members').select('id, first_name, last_name, email, role').eq('business_owner_id', effectiveOwnerId),
      supabase.from('business_users').select('id, full_name, email').eq('id', effectiveOwnerId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const closerList = (tmRes.data || []).filter((m: any) => m.role?.toLowerCase() === 'closer')
      if (ownerRes.data) {
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

  // Round-robin: get next closer
  const getNextCloser = useCallback(async () => {
    if (closers.length === 0) return null

    // Get round-robin state
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
      // Fetch availability, absences, and existing appointments in parallel
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

      // Generate slots for the next 14 days
      const slots: TimeSlot[] = []
      const now = new Date()
      const SLOT_DURATION = 30 // minutes

      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const date = new Date(now)
        date.setDate(date.getDate() + dayOffset)

        // day_of_week: 0=Monday, 1=Tuesday, ... 6=Sunday
        const jsDay = date.getDay() // 0=Sunday, 1=Monday...
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1

        const dateStr = date.toISOString().split('T')[0]

        // Check if day is in an absence period
        const isAbsent = absences.some(a => dateStr >= a.start_date && dateStr <= a.end_date)
        if (isAbsent) continue

        // Get availability slots for this day
        const daySlots = weeklySlots.filter(s => s.day_of_week === dayOfWeek)
        if (daySlots.length === 0) continue

        // Get existing appointments for this day
        const dayAppointments = existingAppointments.filter((a: any) => a.date === dateStr)

        // Generate 30-min time slots within each availability window
        for (const slot of daySlots) {
          const [startH, startM] = slot.start_time.split(':').map(Number)
          const [endH, endM] = slot.end_time.split(':').map(Number)
          const startMinutes = startH * 60 + startM
          const endMinutes = endH * 60 + endM

          for (let mins = startMinutes; mins + SLOT_DURATION <= endMinutes; mins += SLOT_DURATION) {
            const h = Math.floor(mins / 60)
            const m = mins % 60
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

            // Skip if in the past
            if (dayOffset === 0) {
              const slotTime = new Date(date)
              slotTime.setHours(h, m, 0, 0)
              if (slotTime <= now) continue
            }

            // Check for conflict with existing appointments
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

      // Build technical summary
      let technicalSummary = `[${new Date().toLocaleDateString('fr-FR')}] Qualification: ${selectedOutcome}`
      if (selectedOutcome === 'qualified' && selectedCloser && selectedSlot) {
        technicalSummary += `\n- Closer assigné: ${selectedCloser.first_name} ${selectedCloser.last_name}`
        technicalSummary += `\n- RDV: ${selectedSlot.dateLabel} à ${selectedSlot.timeLabel}`
        technicalSummary += `\n- Mode: ${assignmentMode === 'suivant' ? 'Tournante' : assignmentMode === 'hasard' ? 'Hasard' : 'Manuel'}`
      }
      if (selectedOutcome === 'booklater') {
        technicalSummary += `\n- À booker plus tard — Rappel: ${reminderDate} à ${reminderTime}`
      }

      // Save notes to call history
      const finalNotes = notes ? `${notes}\n\n${technicalSummary}` : technicalSummary
      const { error: callError } = await supabase.from('business_call_history').update({ notes: finalNotes }).eq('id', call.id)
      if (callError) console.error('Erreur update call:', callError.message)

      // Update prospect if found
      if (prospect && selectedOutcome) {
        const updates: any = {
          stage: stageMap[selectedOutcome],
          last_contact: new Date().toISOString(),
        }

        if (selectedOutcome === 'qualified' && selectedCloser) {
          updates.assigned_to = selectedCloser.id
        }

        // Save call notes as JSONB
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

      // If booklater: create reminder (no closer assignment)
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

      // If qualified: create appointment, sync Google Calendar, update round-robin
      if (selectedOutcome === 'qualified' && selectedCloser && selectedSlot && effectiveOwnerId) {
        // Create appointment assigned to the closer
        const { error: apptError } = await supabase.from('business_appointments').insert([{
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
          notes: `Qualifié par ${teamMember?.first_name || 'Setter'}. ${notes || ''}`.trim(),
        }])
        if (apptError) console.error('Erreur appointment:', apptError.message)

        // Sync to Google Calendar if connected
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

        // Update round-robin state
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate('/business/appels')} className="mb-4 flex items-center gap-2 text-slate-400 hover:text-amber-700 transition-colors">
          <ArrowLeft className="h-5 w-5" /> Retour
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Qualification Setter</h1>
          <p className="mt-1 text-slate-500">
            Qualifiez votre appel avec <span className="font-semibold text-slate-900">{call.contact_name}</span>
          </p>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
            <Clock className="h-3 w-3" />
            {new Date(call.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {call.duration && call.duration !== 'En cours...' && <span className="ml-2">({call.duration})</span>}
          </p>
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
                Résultat de l'appel <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {setterOutcomes.map(outcome => {
                  const Icon = outcome.icon
                  const isSelected = selectedOutcome === outcome.id
                  return (
                    <button
                      key={outcome.id}
                      onClick={() => {
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
                })}
              </div>
            </div>

            {/* QUALIFIED: Scheduling Section */}
            {selectedOutcome === 'qualified' && (
              <div className="space-y-5">
                {/* Step 1: Closer Assignment */}
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-6">
                  <h3 className="text-sm font-bold text-purple-700 flex items-center gap-2 mb-4">
                    <User className="h-4 w-4" /> Étape 1 — Assigner un Closer
                  </h3>

                  {closers.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-white rounded-lg p-4 border border-slate-200">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Aucun closer dans l'équipe
                    </div>
                  ) : (
                    <>
                      {/* Manual closer dropdown */}
                      <div className="mb-4">
                        <label className="mb-2 block text-xs font-medium text-purple-600">Sélectionner manuellement</label>
                        <select
                          value={assignmentMode === 'manual' ? selectedCloser?.id || '' : ''}
                          onChange={(e) => e.target.value && handleManualSelect(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        >
                          <option value="">— Choisir un closer —</option>
                          {closers.map(c => (
                            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-3 mb-4">
                        <button
                          onClick={() => handleAssign('suivant')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all',
                            assignmentMode === 'suivant'
                              ? 'border-purple-500 bg-purple-100 text-purple-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:bg-purple-50'
                          )}
                        >
                          <ArrowRightCircle className="h-4 w-4" /> Suivant (Tournante)
                        </button>
                        <button
                          onClick={() => handleAssign('hasard')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all',
                            assignmentMode === 'hasard'
                              ? 'border-purple-500 bg-purple-100 text-purple-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:bg-purple-50'
                          )}
                        >
                          <Shuffle className="h-4 w-4" /> Hasard
                        </button>
                      </div>

                      {selectedCloser && (
                        <div className="flex items-center gap-3 rounded-lg bg-white border border-purple-200 p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
                            {selectedCloser.first_name?.[0]}{selectedCloser.last_name?.[0]}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {selectedCloser.first_name} {selectedCloser.last_name}
                            </p>
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
                        Vérifiez ses disponibilités.
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
                                const isSelected = selectedSlot?.date === slot.date && selectedSlot?.time === slot.time
                                return (
                                  <button
                                    key={`${slot.date}-${slot.time}`}
                                    onClick={() => setSelectedSlot(slot)}
                                    className={cn(
                                      'rounded-lg border px-3 py-2 text-xs font-medium transition-all text-center',
                                      isSelected
                                        ? 'border-blue-500 bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                                    )}
                                  >
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
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Prenez vos notes ici. Elles seront enregistrées dans l'historique des appels..."
              className="flex-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none leading-relaxed"
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
      </div>
    </div>
  )
}
