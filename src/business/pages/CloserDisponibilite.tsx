import { useState, useEffect, useCallback, useRef } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import {
  Calendar, Clock, Plus, Trash2, Loader2, X, CalendarOff, Copy, ChevronDown, Settings2, Shield,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'

interface Slot {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
}

interface Absence {
  id: number
  start_date: string
  end_date: string
  reason: string | null
  created_at: string
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_SHORT = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']

const GLASS_PANEL = 'bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/5 dark:ring-white/10 shadow-sm'

export function CloserDisponibilite() {
  const { teamMember, ownerUserId, isTeamMember, user } = useBusinessAuth()

  // Owner mode: owner uses their own user.id as business_owner_id, no team_member_id
  const isOwner = !isTeamMember
  const effectiveOwnerId = isOwner ? user?.id : ownerUserId
  const effectiveTeamMemberId = isOwner ? null : teamMember?.id

  const [slots, setSlots] = useState<Slot[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(false)

  // Add slot form
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('12:00')

  // Copy slots
  const [copyingDay, setCopyingDay] = useState<number | null>(null)
  const [selectedCopyTargets, setSelectedCopyTargets] = useState<number[]>([])

  // Add absence form
  const [showAbsenceForm, setShowAbsenceForm] = useState(false)
  const [absStartDate, setAbsStartDate] = useState('')
  const [absEndDate, setAbsEndDate] = useState('')
  const [absReason, setAbsReason] = useState('')

  // Booking constraints
  const [maxCallsPerDay, setMaxCallsPerDay] = useState<number | null>(null)
  const [bufferBeforeBooking, setBufferBeforeBooking] = useState(0)
  const [minBookingNotice, setMinBookingNotice] = useState(0)
  const [savingConstraints, setSavingConstraints] = useState(false)

  const fetchData = useCallback(async () => {
    if (!effectiveOwnerId && !effectiveTeamMemberId) { setLoading(false); return }
    setLoading(true)
    try {
      let slotsQuery = supabase.from('business_availability_slots').select('*')
      let absQuery = supabase.from('business_absences').select('*')

      if (isOwner) {
        slotsQuery = slotsQuery.eq('business_owner_id', effectiveOwnerId!).is('team_member_id', null)
        absQuery = absQuery.eq('business_owner_id', effectiveOwnerId!).is('team_member_id', null)
      } else {
        slotsQuery = slotsQuery.eq('team_member_id', effectiveTeamMemberId!)
        absQuery = absQuery.eq('team_member_id', effectiveTeamMemberId!)
      }

      // Fetch booking constraints
      const constraintsQuery = isOwner
        ? supabase.from('business_users').select('max_calls_per_day, buffer_before_booking, min_booking_notice').eq('id', effectiveOwnerId!).single()
        : supabase.from('business_team_members').select('max_calls_per_day, buffer_before_booking, min_booking_notice').eq('id', effectiveTeamMemberId!).single()

      const [slotsRes, absRes, constraintsRes] = await Promise.all([
        slotsQuery.order('day_of_week').order('start_time'),
        absQuery.order('start_date', { ascending: false }),
        constraintsQuery,
      ])
      setSlots(slotsRes.data || [])
      setAbsences(absRes.data || [])
      if (constraintsRes.data) {
        setMaxCallsPerDay(constraintsRes.data.max_calls_per_day)
        setBufferBeforeBooking(constraintsRes.data.buffer_before_booking || 0)
        setMinBookingNotice(constraintsRes.data.min_booking_notice || 0)
      }
    } finally {
      setLoading(false)
    }
  }, [effectiveOwnerId, effectiveTeamMemberId, isOwner])

  useEffect(() => { fetchData() }, [fetchData])

  const storageKey = isOwner ? `dispo-onboarding-owner-${effectiveOwnerId}` : `dispo-onboarding-${effectiveTeamMemberId}`

  useEffect(() => {
    if (!loading && slots.length === 0 && (effectiveTeamMemberId || effectiveOwnerId)) {
      const dismissed = localStorage.getItem(storageKey)
      if (!dismissed) {
        setShowOnboardingPopup(true)
      }
    }
  }, [loading, slots.length, effectiveTeamMemberId, effectiveOwnerId, storageKey])

  const dismissOnboarding = () => {
    localStorage.setItem(storageKey, 'true')
    setShowOnboardingPopup(false)
  }

  // Notify owner + HOS when availability/absence changes (debounced: batches changes over 5s)
  const pendingChangesRef = useRef<string[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushNotifications = useCallback(async () => {
    if (isOwner || !teamMember?.id || !ownerUserId) return
    const changes = [...pendingChangesRef.current]
    pendingChangesRef.current = []
    if (changes.length === 0) return

    const title = `Disponibilité modifiée — ${isOwner ? 'Owner' : (`${teamMember?.first_name || ''} ${teamMember?.last_name || ''}`.trim() || 'Un membre')}`
    const description = changes.join('\n')

    try {
      const rows: { user_id: string; title: string; description: string; reminder_date: string; is_done: boolean }[] = [
        { user_id: ownerUserId, title, description, reminder_date: new Date().toISOString(), is_done: false },
      ]
      const { data: hosMembers } = await supabase
        .from('business_team_members')
        .select('user_id')
        .eq('business_owner_id', ownerUserId)
        .in('role', ['Head of Sales', 'Admin'])
      if (hosMembers) {
        for (const hos of hosMembers) {
          if (hos.user_id) rows.push({ user_id: hos.user_id, title, description, reminder_date: new Date().toISOString(), is_done: false })
        }
      }
      await supabase.from('reminders').insert(rows)
      const userIds = rows.map(r => r.user_id)
      fetch('/api/business-send-notification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIds, title, description })
      }).catch(() => {})
    } catch (err) {
      console.error('Notification error:', err)
    }
  }, [isOwner, teamMember, ownerUserId])

  // Flush on unmount (page leave)
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (pendingChangesRef.current.length > 0) flushNotifications()
    }
  }, [flushNotifications])

  const notifyOwnerAndHoS = async (_title: string, description: string) => {
    if (isOwner) return
    pendingChangesRef.current.push(description)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => flushNotifications(), 60000)
  }

  const memberName = isOwner ? 'Owner' : (`${teamMember?.first_name || ''} ${teamMember?.last_name || ''}`.trim() || 'Un membre')

  const handleAddSlot = async (dayOfWeek: number) => {
    if (!effectiveOwnerId && !effectiveTeamMemberId) return
    const insertData: any = {
      business_owner_id: effectiveOwnerId,
      day_of_week: dayOfWeek,
      start_time: newStart,
      end_time: newEnd,
    }
    if (effectiveTeamMemberId) insertData.team_member_id = effectiveTeamMemberId
    const { error } = await supabase.from('business_availability_slots').insert([insertData])
    if (error) { toast.error('Erreur'); return }
    await notifyOwnerAndHoS(
      `Disponibilité modifiée — ${memberName}`,
      `Nouveau créneau ${DAYS[dayOfWeek]} ${newStart}–${newEnd}`
    )
    toast.success('Créneau ajouté')
    setAddingDay(null)
    setNewStart('09:00')
    setNewEnd('12:00')
    fetchData()
  }

  const handleDeleteSlot = async (id: number) => {
    const slot = slots.find(s => s.id === id)
    const { error } = await supabase.from('business_availability_slots').delete().eq('id', id)
    if (error) { toast.error('Erreur'); return }
    if (slot) {
      await notifyOwnerAndHoS(
        `Disponibilité modifiée — ${memberName}`,
        `Créneau supprimé ${DAYS[slot.day_of_week]} ${slot.start_time}–${slot.end_time}`
      )
    }
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  const handleCopySlots = async (fromDay: number, targetDays: number[]) => {
    if ((!effectiveOwnerId && !effectiveTeamMemberId) || targetDays.length === 0) return
    const sourceSlots = slots.filter(s => s.day_of_week === fromDay)
    if (sourceSlots.length === 0) { toast.error('Aucun créneau à copier'); return }
    for (const toDay of targetDays) {
      for (const slot of sourceSlots) {
        const insertData: any = {
          business_owner_id: effectiveOwnerId,
          day_of_week: toDay,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }
        if (effectiveTeamMemberId) insertData.team_member_id = effectiveTeamMemberId
        await supabase.from('business_availability_slots').insert([insertData])
      }
    }
    const names = targetDays.map(d => DAYS[d]).join(', ')
    await notifyOwnerAndHoS(
      `Disponibilité modifiée — ${memberName}`,
      `Créneaux copiés de ${DAYS[fromDay]} vers ${names}`
    )
    toast.success(`Créneaux copiés vers ${names}`)
    setCopyingDay(null)
    setSelectedCopyTargets([])
    fetchData()
  }

  // Helper: shift time string HH:MM by N hours, clamped 00:00–23:00
  const shiftTime = (time: string, hours: number) => {
    const [h, m] = time.split(':').map(Number)
    const nh = Math.max(0, Math.min(h + hours, 23))
    return `${String(nh).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // Open "add slot" form with smart defaults based on existing slots
  const handleStartAdding = (dayIdx: number) => {
    const daySlots = slots.filter(s => s.day_of_week === dayIdx).sort((a, b) => a.end_time.localeCompare(b.end_time))
    if (daySlots.length > 0) {
      const lastEnd = daySlots[daySlots.length - 1].end_time
      const start = shiftTime(lastEnd, 1)
      setNewStart(start)
      setNewEnd(shiftTime(start, 3))
    } else {
      setNewStart('09:00')
      setNewEnd('12:00')
    }
    setAddingDay(dayIdx)
  }

  // Enforce start < end constraints on time inputs
  const handleStartChange = (val: string) => {
    setNewStart(val)
    if (val >= newEnd) setNewEnd(shiftTime(val, 1))
  }
  const handleEndChange = (val: string) => {
    setNewEnd(val)
    if (val <= newStart) setNewStart(shiftTime(val, -1))
  }

  const handleAddAbsence = async () => {
    if ((!effectiveOwnerId && !effectiveTeamMemberId) || !absStartDate || !absEndDate) return
    const insertData: any = {
      business_owner_id: effectiveOwnerId,
      start_date: absStartDate,
      end_date: absEndDate,
      reason: absReason || null,
    }
    if (effectiveTeamMemberId) insertData.team_member_id = effectiveTeamMemberId
    const { error } = await supabase.from('business_absences').insert([insertData])
    if (error) { toast.error('Erreur'); return }
    const fmtStart = new Date(absStartDate).toLocaleDateString('fr-FR')
    const fmtEnd = new Date(absEndDate).toLocaleDateString('fr-FR')
    await notifyOwnerAndHoS(
      `Absence programmée — ${memberName}`,
      `Du ${fmtStart} au ${fmtEnd}${absReason ? ` (${absReason})` : ''}`
    )
    toast.success('Absence ajoutée')
    setShowAbsenceForm(false)
    setAbsStartDate(''); setAbsEndDate(''); setAbsReason('')
    fetchData()
  }

  const handleSaveConstraints = async () => {
    setSavingConstraints(true)
    try {
      const updates = {
        max_calls_per_day: maxCallsPerDay,
        buffer_before_booking: bufferBeforeBooking,
        min_booking_notice: minBookingNotice,
      }
      if (isOwner) {
        await supabase.from('business_users').update(updates).eq('id', effectiveOwnerId!)
      } else {
        await supabase.from('business_team_members').update(updates).eq('id', effectiveTeamMemberId!)
      }
      toast.success('Paramètres enregistrés')
    } catch { toast.error('Erreur') }
    finally { setSavingConstraints(false) }
  }

  const handleDeleteAbsence = async (id: number) => {
    const { error } = await supabase.from('business_absences').delete().eq('id', id)
    if (error) { toast.error('Erreur'); return }
    setAbsences(prev => prev.filter(a => a.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-stone-300 dark:text-neutral-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-4 text-[#006c49] mb-2">
          <Clock className="h-6 w-6" strokeWidth={1.5} />
          <span className="h-px w-10 bg-[#c4c7c7]/30" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Workspace</span>
        </div>
        <h1 className="text-2xl md:text-4xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">Disponibilité</h1>
        <p className="text-stone-500 dark:text-neutral-400 text-base max-w-2xl font-light italic opacity-80">Gérez vos créneaux et absences pour optimiser votre tunnel de vente.</p>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-4 md:gap-8">
        {/* ─── Left: Weekly Slots ─── */}
        <section className="col-span-12 xl:col-span-8 space-y-6">
          <h3 className="font-business-display font-extrabold text-lg md:text-2xl tracking-tight flex items-center gap-3 text-stone-900 dark:text-white">
            Créneaux hebdomadaires
          </h3>

          <div className="space-y-4">
            {/* Weekdays (Mon-Fri) */}
            {DAYS.slice(0, 5).map((day, idx) => {
              const daySlots = slots.filter(s => s.day_of_week === idx)
              const hasSlots = daySlots.length > 0
              return (
                <div
                  key={idx}
                  className={cn(
                    GLASS_PANEL,
                    'rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow'
                  )}
                >
                  <div className="flex items-center gap-3 md:gap-6 min-w-[100px] md:min-w-[140px]">
                    <span className={cn(
                      'font-business-display font-extrabold text-base md:text-xl w-12',
                      hasSlots ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-neutral-600'
                    )}>
                      {DAYS_SHORT[idx]}
                    </span>
                    <div className={cn('h-2 w-2 rounded-full', hasSlots ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/30 dark:bg-neutral-600')} />
                  </div>

                  <div className="flex flex-wrap gap-2 flex-grow items-center">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="flex items-center gap-2 bg-[#ffddb8] dark:bg-amber-900/30 text-[#2a1700] dark:text-amber-400 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold min-h-[44px]">
                        {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        <button onClick={() => handleDeleteSlot(slot.id)} className="hover:text-[#ba1a1a] dark:hover:text-red-400 transition-colors min-h-[44px] min-w-[28px] flex items-center justify-center">
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                    {!hasSlots && !addingDay && (
                      <span className="text-sm text-stone-400/50 dark:text-neutral-500/50 italic py-2">Indisponible</span>
                    )}

                    {addingDay === idx ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="time" value={newStart} onChange={e => handleStartChange(e.target.value)} className="rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-3 py-2 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 min-h-[44px]" />
                        <span className="text-xs text-stone-400 dark:text-neutral-500">à</span>
                        <input type="time" value={newEnd} onChange={e => handleEndChange(e.target.value)} className="rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-3 py-2 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 min-h-[44px]" />
                        <button onClick={() => handleAddSlot(idx)} className="rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition-all min-h-[44px]">OK</button>
                        <button onClick={() => setAddingDay(null)} className="text-xs text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300 min-h-[44px]">Annuler</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartAdding(idx)}
                        className="flex items-center gap-2 border border-dashed border-[#c4c7c7] dark:border-neutral-700/50 px-4 py-2 rounded-full text-xs md:text-sm text-stone-500 dark:text-neutral-400 hover:bg-stone-50 dark:hover:bg-white/5 hover:border-stone-400 transition-all min-h-[44px]"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Ajouter un créneau
                      </button>
                    )}
                  </div>

                  {/* Copy button */}
                  {hasSlots && (
                    <div className="relative">
                      <button
                        onClick={() => { setCopyingDay(copyingDay === idx ? null : idx); setSelectedCopyTargets([]) }}
                        className="text-stone-400 hover:text-[#006c49] p-2 transition-colors"
                      >
                        <Copy className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                      {copyingDay === idx && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => { setCopyingDay(null); setSelectedCopyTargets([]) }} />
                          <div className="absolute bottom-full right-0 mb-1 z-50 rounded-2xl bg-white dark:bg-white/5 shadow-xl ring-1 ring-black/5 dark:ring-white/10 py-2 min-w-[180px] dark:backdrop-blur-xl">
                            {DAYS.map((targetDay, targetIdx) => {
                              if (targetIdx === idx) return null
                              const isSelected = selectedCopyTargets.includes(targetIdx)
                              return (
                                <button
                                  key={targetIdx}
                                  onClick={() => setSelectedCopyTargets(prev => isSelected ? prev.filter(d => d !== targetIdx) : [...prev, targetIdx])}
                                  className={cn(
                                    'w-full text-left px-4 py-2 text-sm font-medium flex items-center gap-3 transition-colors',
                                    isSelected ? 'bg-[#006c49]/5 text-[#006c49]' : 'text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-white/5'
                                  )}
                                >
                                  <span className={cn(
                                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                    isSelected ? 'border-[#006c49] bg-[#006c49] text-white' : 'border-stone-300 dark:border-neutral-600'
                                  )}>
                                    {isSelected && <span className="text-[10px]">✓</span>}
                                  </span>
                                  {targetDay}
                                </button>
                              )
                            })}
                            {selectedCopyTargets.length > 0 && (
                              <div className="px-3 pt-2 mt-1 border-t border-stone-100 dark:border-white/10">
                                <button
                                  onClick={() => handleCopySlots(idx, selectedCopyTargets)}
                                  className="w-full rounded-full bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 transition-all"
                                >
                                  Copier vers {selectedCopyTargets.length} jour{selectedCopyTargets.length > 1 ? 's' : ''}
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Weekend separator */}
            <div className="flex items-center gap-4 py-2 text-stone-300 dark:text-neutral-500">
              <div className="h-px flex-grow bg-[#c4c7c7]/20 dark:bg-white/10" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Weekend</span>
              <div className="h-px flex-grow bg-[#c4c7c7]/20 dark:bg-white/10" />
            </div>

            {/* Weekend (Sat-Sun) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DAYS.slice(5).map((day, i) => {
                const idx = i + 5
                const daySlots = slots.filter(s => s.day_of_week === idx)
                const hasSlots = daySlots.length > 0
                return (
                  <div
                    key={idx}
                    className={cn(
                      GLASS_PANEL,
                      'rounded-2xl p-5',
                      !hasSlots && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-business-display font-extrabold text-lg text-stone-900 dark:text-white">{DAYS_SHORT[idx]}</span>
                      <div className={cn('h-2 w-2 rounded-full', hasSlots ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/30 dark:bg-neutral-600')} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-2 bg-[#ffddb8] dark:bg-amber-900/30 text-[#2a1700] dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold">
                          {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                          <button onClick={() => handleDeleteSlot(slot.id)} className="hover:text-[#ba1a1a] dark:hover:text-red-400 transition-colors">
                            <X className="h-3 w-3" strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                      {!hasSlots && (
                        <span className="text-[10px] italic text-stone-400 dark:text-neutral-500">Indisponible</span>
                      )}
                    </div>
                    {addingDay === idx ? (
                      <div className="flex items-center gap-2 mt-3">
                        <input type="time" value={newStart} onChange={e => handleStartChange(e.target.value)} className="rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-3 py-1.5 text-xs font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                        <span className="text-xs text-stone-400 dark:text-neutral-500">à</span>
                        <input type="time" value={newEnd} onChange={e => handleEndChange(e.target.value)} className="rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-3 py-1.5 text-xs font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                        <button onClick={() => handleAddSlot(idx)} className="rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">OK</button>
                        <button onClick={() => setAddingDay(null)} className="text-xs text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartAdding(idx)}
                        className="mt-3 flex items-center gap-1.5 text-xs text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300 transition-colors"
                      >
                        <Plus className="h-3 w-3" strokeWidth={1.5} />
                        Ajouter
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── Right: Absences ─── */}
        <aside className="col-span-12 xl:col-span-4 space-y-8">
          {/* Absences Card */}
          <div className={cn(GLASS_PANEL, 'rounded-2xl p-5 md:p-8 shadow-lg relative overflow-hidden')}>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#006c49]/5 rounded-full blur-3xl" />
            <h3 className="font-business-display font-extrabold text-lg md:text-2xl mb-6 relative z-10 text-stone-900 dark:text-white">Absences</h3>

            <div className="space-y-4 mb-6 relative z-10">
              {absences.length === 0 ? (
                <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-6">Aucune absence programmée</p>
              ) : (
                absences.map(abs => (
                  <div key={abs.id} className="flex items-center justify-between p-4 bg-[#efedec] dark:bg-white/5 rounded-2xl ring-1 ring-[#c4c7c7]/10 dark:ring-white/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#006c49]/10 rounded-xl">
                        <Calendar className="h-4 w-4 text-[#006c49]" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-stone-900 dark:text-white">
                          {new Date(abs.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {new Date(abs.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                        {abs.reason && (
                          <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{abs.reason}</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteAbsence(abs.id)} className="text-stone-300 dark:text-neutral-600 hover:text-[#ba1a1a] transition-colors">
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Absence Form */}
            {showAbsenceForm && (
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-5 mb-4 space-y-4 relative z-10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">Date début</label>
                    <input type="date" value={absStartDate} onChange={e => setAbsStartDate(e.target.value)} className="w-full rounded-full bg-white dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">Date fin</label>
                    <input type="date" value={absEndDate} onChange={e => setAbsEndDate(e.target.value)} className="w-full rounded-full bg-white dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">Motif (optionnel)</label>
                  <input type="text" value={absReason} onChange={e => setAbsReason(e.target.value)} placeholder="Ex: Vacances, Formation..." className="w-full rounded-full bg-white dark:bg-neutral-800 border-none px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAddAbsence} disabled={!absStartDate || !absEndDate} className="flex-1 rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-4 py-3 text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-50">Confirmer</button>
                  <button onClick={() => setShowAbsenceForm(false)} className="px-4 py-3 text-sm font-bold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors">Annuler</button>
                </div>
              </div>
            )}

            {/* New absence button */}
            {!showAbsenceForm && (
              <button
                onClick={() => setShowAbsenceForm(true)}
                className="w-full py-4 border-2 border-dashed border-[#c4c7c7] dark:border-neutral-700/50 hover:border-[#006c49] hover:text-[#006c49] hover:bg-[#006c49]/5 rounded-2xl transition-all flex items-center justify-center gap-2 text-stone-500 dark:text-neutral-400 relative z-10"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-sm font-bold">Nouvelle absence</span>
              </button>
            )}
          </div>

          {/* Booking Constraints Card */}
          <div className={cn(GLASS_PANEL, 'rounded-2xl p-5 md:p-8 shadow-lg relative overflow-hidden')}>
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-[#006c49]/5 rounded-full blur-3xl" />
            <h3 className="font-business-display font-extrabold text-lg md:text-2xl mb-2 relative z-10 flex items-center gap-3 text-stone-900 dark:text-white">
              <Settings2 className="h-5 w-5 text-[#006c49]" strokeWidth={1.5} />
              Paramètres de booking
            </h3>
            <p className="text-xs text-stone-400 dark:text-neutral-500 mb-6 relative z-10">Ces règles s'appliquent à vos liens de réservation</p>

            <div className="space-y-6 relative z-10">
              {/* Max calls per day */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">
                  Max de RDV par jour
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={maxCallsPerDay ?? ''}
                    onChange={e => setMaxCallsPerDay(e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
                  >
                    <option value="">Illimité</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15].map(n => (
                      <option key={n} value={n}>{n} RDV / jour</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Buffer before booking */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">
                  Temps libre avant un RDV
                </label>
                <p className="text-[10px] text-stone-400/70 dark:text-neutral-500/70 mb-2">Empêche les bookings trop proches d'un autre RDV</p>
                <select
                  value={bufferBeforeBooking}
                  onChange={e => setBufferBeforeBooking(Number(e.target.value))}
                  className="w-full rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
                >
                  <option value={0}>Pas de buffer</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 heure</option>
                </select>
              </div>

              {/* Min booking notice */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">
                  Délai minimum avant un booking
                </label>
                <p className="text-[10px] text-stone-400/70 dark:text-neutral-500/70 mb-2">Impossible de réserver un créneau avant ce délai</p>
                <select
                  value={minBookingNotice}
                  onChange={e => setMinBookingNotice(Number(e.target.value))}
                  className="w-full rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
                >
                  <option value={0}>Pas de délai</option>
                  <option value={1}>1 heure avant</option>
                  <option value={3}>3 heures avant</option>
                  <option value={5}>5 heures avant</option>
                  <option value={10}>10 heures avant</option>
                  <option value={24}>24 heures avant</option>
                </select>
              </div>

              {/* Save button */}
              <button
                onClick={handleSaveConstraints}
                disabled={savingConstraints}
                className="w-full py-3.5 rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 text-white text-sm font-business-display font-extrabold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingConstraints ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" strokeWidth={1.5} />}
                Enregistrer
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Onboarding Popup */}
      {showOnboardingPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={dismissOnboarding} />
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl p-8">
            <button onClick={dismissOnboarding} className="absolute top-5 right-5 text-stone-300 dark:text-neutral-600 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="text-center mb-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#006c49]/10 mx-auto mb-5">
                <Calendar className="h-8 w-8 text-[#006c49]" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">Configurez vos disponibilités</h2>
              <p className="text-sm text-stone-500 dark:text-neutral-400 mt-3 leading-relaxed">
                Avant de commencer, indiquez vos créneaux de disponibilité hebdomadaires.
                Cela permettra à votre manager de vous assigner des rendez-vous aux bons moments.
              </p>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-4">
                <p className="text-sm text-stone-700 dark:text-neutral-200 font-medium">1. Ajoutez vos créneaux pour chaque jour</p>
              </div>
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-4">
                <p className="text-sm text-stone-700 dark:text-neutral-200 font-medium">2. Indiquez vos périodes d'absence si nécessaire</p>
              </div>
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-4">
                <p className="text-sm text-stone-700 dark:text-neutral-200 font-medium">3. Modifiez ces informations à tout moment</p>
              </div>
            </div>
            <button
              onClick={dismissOnboarding}
              className="w-full mt-8 rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 py-4 text-sm font-business-display font-extrabold text-white hover:opacity-90 transition-all"
            >
              C'est parti !
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
