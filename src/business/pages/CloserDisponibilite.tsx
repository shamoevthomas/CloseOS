import { useState, useEffect, useCallback, useRef } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { supabase } from '../../lib/supabase'
import {
  Calendar, Clock, Plus, Trash2, Loader2, X, CalendarOff, Copy, ChevronDown, Settings2, Shield,
  CalendarRange, Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { TemporaryAvailabilityModal } from '../components/TemporaryAvailabilityModal'
import { type TempPeriod } from '../../lib/temporaryAvailability'

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

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAYS_SHORT_FR = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']
const DAYS_SHORT_EN = ['Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.', 'Sun.']

const GLASS_PANEL = 'bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/5 dark:ring-white/10 shadow-sm'
// Téléphone : les jours forment une seule carte, une ligne par jour (pas une carte par jour)
const MOBILE_LIST = 'max-sm:rounded-2xl max-sm:bg-white/70 dark:max-sm:bg-white/5 max-sm:ring-1 max-sm:ring-[#c4c7c7]/20 dark:max-sm:ring-white/10 max-sm:shadow-sm max-sm:divide-y max-sm:divide-stone-100 dark:max-sm:divide-white/10'
const MOBILE_ROW = 'max-sm:rounded-none max-sm:bg-transparent dark:max-sm:bg-transparent max-sm:ring-0 max-sm:shadow-none max-sm:backdrop-blur-none'
// Ligne de liste à fleur de carte sur téléphone (périodes, absences)
const MOBILE_FLAT_ITEM = 'max-sm:rounded-none max-sm:bg-transparent dark:max-sm:bg-transparent max-sm:ring-0 max-sm:px-0 max-sm:py-3'

export function CloserDisponibilite() {
  const { teamMember, ownerUserId, isTeamMember, user } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const DAYS = lang === 'en' ? DAYS_EN : DAYS_FR
  const DAYS_SHORT = lang === 'en' ? DAYS_SHORT_EN : DAYS_SHORT_FR

  // Owner mode: owner uses their own user.id as business_owner_id, no team_member_id
  const isOwner = !isTeamMember
  const effectiveOwnerId = isOwner ? user?.id : ownerUserId
  const effectiveTeamMemberId = isOwner ? null : teamMember?.id

  const [slots, setSlots] = useState<Slot[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [tempPeriods, setTempPeriods] = useState<TempPeriod[]>([])
  const [showTempModal, setShowTempModal] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<TempPeriod | null>(null)
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
      let tempQuery = supabase.from('business_temporary_availability').select('*')

      if (isOwner) {
        slotsQuery = slotsQuery.eq('business_owner_id', effectiveOwnerId!).is('team_member_id', null)
        absQuery = absQuery.eq('business_owner_id', effectiveOwnerId!).is('team_member_id', null)
        tempQuery = tempQuery.eq('business_owner_id', effectiveOwnerId!).is('team_member_id', null)
      } else {
        slotsQuery = slotsQuery.eq('team_member_id', effectiveTeamMemberId!)
        absQuery = absQuery.eq('team_member_id', effectiveTeamMemberId!)
        tempQuery = tempQuery.eq('team_member_id', effectiveTeamMemberId!)
      }

      // Fetch booking constraints
      const constraintsQuery = isOwner
        ? supabase.from('business_users').select('max_calls_per_day, buffer_before_booking, min_booking_notice').eq('id', effectiveOwnerId!).single()
        : supabase.from('business_team_members').select('max_calls_per_day, buffer_before_booking, min_booking_notice').eq('id', effectiveTeamMemberId!).single()

      const [slotsRes, absRes, tempRes, constraintsRes] = await Promise.all([
        slotsQuery.order('day_of_week').order('start_time'),
        absQuery.order('start_date', { ascending: false }),
        tempQuery.order('start_date', { ascending: true }),
        constraintsQuery,
      ])
      setSlots(slotsRes.data || [])
      setAbsences(absRes.data || [])
      setTempPeriods((tempRes.data || []) as unknown as TempPeriod[])
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
    if (error) { toast.error(t.common_error); return }
    await notifyOwnerAndHoS(
      `Disponibilité modifiée — ${memberName}`,
      `Nouveau créneau ${DAYS[dayOfWeek]} ${newStart}–${newEnd}`
    )
    toast.success(t.availability_slot_added)
    setAddingDay(null)
    setNewStart('09:00')
    setNewEnd('12:00')
    fetchData()
  }

  const handleDeleteSlot = async (id: number) => {
    const slot = slots.find(s => s.id === id)
    const { error } = await supabase.from('business_availability_slots').delete().eq('id', id)
    if (error) { toast.error(t.common_error); return }
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
    if (sourceSlots.length === 0) { toast.error(t.calls_no_slots_to_copy); return }
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
    toast.success(t.availability_slots_copied.replace('{names}', names))
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
    if (error) { toast.error(t.common_error); return }
    const fmtStart = new Date(absStartDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')
    const fmtEnd = new Date(absEndDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')
    await notifyOwnerAndHoS(
      `Absence programmée — ${memberName}`,
      `Du ${fmtStart} au ${fmtEnd}${absReason ? ` (${absReason})` : ''}`
    )
    toast.success(t.availability_absence_added)
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
      toast.success(t.availability_settings_saved)
    } catch { toast.error(t.common_error) }
    finally { setSavingConstraints(false) }
  }

  const handleDeleteTempPeriod = async (period: TempPeriod) => {
    if (!window.confirm(t.temp_avail_delete_confirm)) return
    const { error } = await supabase.from('business_temporary_availability').delete().eq('id', period.id)
    if (error) { toast.error(t.common_error); return }
    setTempPeriods(prev => prev.filter(p => p.id !== period.id))
    const fmt = (d: string) => new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')
    await notifyOwnerAndHoS(
      `${t.temp_avail_title} — ${memberName}`,
      `${t.temp_avail_deleted} : ${fmt(period.start_date)} → ${fmt(period.end_date)}`
    )
    toast.success(t.temp_avail_deleted)
  }

  // Statut d'une période par rapport à aujourd'hui
  const periodStatus = (p: TempPeriod): 'past' | 'active' | 'upcoming' => {
    const today = new Date().toISOString().split('T')[0]
    if (p.end_date < today) return 'past'
    if (p.start_date > today) return 'upcoming'
    return 'active'
  }

  const handleDeleteAbsence = async (id: number) => {
    const { error } = await supabase.from('business_absences').delete().eq('id', id)
    if (error) { toast.error(t.common_error); return }
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
    <div className="space-y-6 sm:space-y-10">
      {/* Header */}
      <header className="space-y-1 sm:space-y-2">
        <div className="flex items-center gap-4 text-[#006c49] mb-2 max-sm:hidden">
          <Clock className="h-6 w-6" strokeWidth={1.5} />
          <span className="h-px w-10 bg-[#c4c7c7]/30" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Workspace</span>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-4xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">{t.sidebar_availability}</h1>
        <p className="text-stone-500 dark:text-neutral-400 text-sm sm:text-base max-w-2xl font-light italic opacity-80">{t.availability_subtitle}</p>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6 md:gap-8">
        {/* ─── Left: Weekly Slots ─── */}
        <section className="col-span-12 xl:col-span-8 space-y-3 sm:space-y-6">
          <h3 className="font-business-display font-extrabold text-base sm:text-lg md:text-2xl tracking-tight flex items-center gap-3 text-stone-900 dark:text-white">
            {t.availability_weekly_slots}
          </h3>

          <div className="space-y-3 sm:space-y-4">
            {/* Weekdays (Mon-Fri) */}
            <div className={cn('space-y-4 max-sm:space-y-0', MOBILE_LIST)}>
            {DAYS.slice(0, 5).map((day, idx) => {
              const daySlots = slots.filter(s => s.day_of_week === idx)
              const hasSlots = daySlots.length > 0
              return (
                <div
                  key={idx}
                  className={cn(
                    GLASS_PANEL,
                    'rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow',
                    // Téléphone : ligne « jour … copier » puis créneaux en dessous
                    'max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-2 max-sm:px-4 max-sm:py-3',
                    MOBILE_ROW
                  )}
                >
                  <div className="flex items-center gap-3 md:gap-6 min-w-[100px] md:min-w-[140px] max-sm:flex-1 max-sm:gap-2">
                    <span className={cn(
                      'font-business-display font-extrabold text-base md:text-xl w-12 max-sm:w-auto',
                      hasSlots ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-neutral-600'
                    )}>
                      {DAYS_SHORT[idx]}
                    </span>
                    <div className={cn('h-2 w-2 rounded-full', hasSlots ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/30 dark:bg-neutral-600')} />
                  </div>

                  <div className="flex flex-wrap gap-2 flex-grow items-center max-sm:order-last max-sm:basis-full">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="flex items-center gap-2 max-sm:gap-0.5 bg-[#ffddb8] dark:bg-amber-900/30 text-[#2a1700] dark:text-amber-400 px-3 md:px-4 max-sm:pl-3 max-sm:pr-1 py-2 max-xl:py-0 rounded-full text-xs md:text-sm font-semibold min-h-[44px] max-sm:min-h-[36px] tabular-nums">
                        {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        <button onClick={() => handleDeleteSlot(slot.id)} aria-label={lang === 'en' ? 'Delete' : 'Supprimer'} className="hover:text-[#ba1a1a] dark:hover:text-red-400 transition-colors min-h-[44px] min-w-[28px] max-sm:min-h-[36px] max-sm:min-w-[32px] flex items-center justify-center">
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                    {!hasSlots && !addingDay && (
                      <span className="text-sm text-stone-400/50 dark:text-neutral-500/50 italic py-2 max-sm:py-0 max-sm:text-xs">{t.availability_unavailable}</span>
                    )}

                    {addingDay === idx ? (
                      <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                        <input type="time" value={newStart} onChange={e => handleStartChange(e.target.value)} className="rounded-full bg-stone-50 max-sm:bg-stone-100 dark:bg-neutral-800 border-none px-3 py-2 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 min-h-[44px] max-sm:min-h-[40px] max-sm:w-full max-sm:min-w-0" />
                        <span className="text-xs text-stone-400 dark:text-neutral-500">{t.availability_to_time}</span>
                        <input type="time" value={newEnd} onChange={e => handleEndChange(e.target.value)} className="rounded-full bg-stone-50 max-sm:bg-stone-100 dark:bg-neutral-800 border-none px-3 py-2 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 min-h-[44px] max-sm:min-h-[40px] max-sm:w-full max-sm:min-w-0" />
                        <button onClick={() => handleAddSlot(idx)} className="rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition-all min-h-[44px] max-sm:min-h-[40px] max-sm:row-start-2 max-sm:col-start-3">OK</button>
                        <button onClick={() => setAddingDay(null)} className="text-xs text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300 min-h-[44px] max-sm:min-h-[40px] max-sm:px-3 max-sm:row-start-2 max-sm:col-start-1 max-sm:col-span-2 max-sm:justify-self-end">{t.availability_cancel}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartAdding(idx)}
                        aria-label={t.availability_add_slot_btn}
                        className="flex items-center gap-2 border border-dashed border-[#c4c7c7] dark:border-neutral-700/50 px-4 py-2 rounded-full text-xs md:text-sm text-stone-500 dark:text-neutral-400 hover:bg-stone-50 dark:hover:bg-white/5 hover:border-stone-400 transition-all min-h-[44px] max-sm:min-h-[36px] max-sm:px-3 max-sm:py-0 max-sm:gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span className="sm:hidden">{t.availability_add_short}</span>
                        <span className="hidden sm:inline">{t.availability_add_slot_btn}</span>
                      </button>
                    )}
                  </div>

                  {/* Copy button */}
                  {hasSlots && (
                    <div className="relative">
                      <button
                        onClick={() => { setCopyingDay(copyingDay === idx ? null : idx); setSelectedCopyTargets([]) }}
                        aria-label={lang === 'en' ? 'Copy to other days' : 'Copier vers d’autres jours'}
                        className="text-stone-400 hover:text-[#006c49] p-2 transition-colors max-sm:-my-1 max-sm:-mr-2 max-sm:h-9 max-sm:w-9 max-sm:flex max-sm:items-center max-sm:justify-center"
                      >
                        <Copy className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                      {copyingDay === idx && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => { setCopyingDay(null); setSelectedCopyTargets([]) }} />
                          <div className="absolute bottom-full max-sm:bottom-auto max-sm:top-full right-0 mb-1 max-sm:mb-0 max-sm:mt-1 z-50 rounded-2xl bg-white dark:bg-white/5 max-sm:dark:bg-neutral-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 py-2 min-w-[180px] max-w-[calc(100vw-2rem)] dark:backdrop-blur-xl">
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
                                  {t.availability_copy_to.replace('{n}', String(selectedCopyTargets.length)).replace('{s}', selectedCopyTargets.length > 1 ? 's' : '')}
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
            </div>

            {/* Weekend separator */}
            <div className="flex items-center gap-4 py-2 text-stone-300 dark:text-neutral-500">
              <div className="h-px flex-grow bg-[#c4c7c7]/20 dark:bg-white/10" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t.availability_weekend}</span>
              <div className="h-px flex-grow bg-[#c4c7c7]/20 dark:bg-white/10" />
            </div>

            {/* Weekend (Sat-Sun) */}
            <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4 max-sm:gap-0', MOBILE_LIST)}>
              {DAYS.slice(5).map((day, i) => {
                const idx = i + 5
                const daySlots = slots.filter(s => s.day_of_week === idx)
                const hasSlots = daySlots.length > 0
                return (
                  <div
                    key={idx}
                    className={cn(
                      GLASS_PANEL,
                      'rounded-2xl p-5 max-sm:px-4 max-sm:py-3',
                      MOBILE_ROW,
                      !hasSlots && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3 max-sm:mb-2">
                      <span className="font-business-display font-extrabold text-lg max-sm:text-base text-stone-900 dark:text-white">{DAYS_SHORT[idx]}</span>
                      <div className={cn('h-2 w-2 rounded-full', hasSlots ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/30 dark:bg-neutral-600')} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-2 max-sm:gap-0.5 bg-[#ffddb8] dark:bg-amber-900/30 text-[#2a1700] dark:text-amber-400 px-3 py-1.5 max-sm:pr-1 max-sm:py-0 max-sm:min-h-[36px] rounded-full text-xs font-bold tabular-nums">
                          {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                          <button onClick={() => handleDeleteSlot(slot.id)} aria-label={lang === 'en' ? 'Delete' : 'Supprimer'} className="hover:text-[#ba1a1a] dark:hover:text-red-400 transition-colors max-sm:min-h-[36px] max-sm:min-w-[32px] max-sm:flex max-sm:items-center max-sm:justify-center">
                            <X className="h-3 w-3" strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                      {!hasSlots && (
                        <span className="text-[10px] italic text-stone-400 dark:text-neutral-500">{t.availability_unavailable}</span>
                      )}
                    </div>
                    {addingDay === idx ? (
                      <div className="flex items-center gap-2 mt-3 max-sm:mt-2 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                        <input type="time" value={newStart} onChange={e => handleStartChange(e.target.value)} className="rounded-full bg-stone-50 max-sm:bg-stone-100 dark:bg-neutral-800 border-none px-3 py-1.5 text-xs font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 max-sm:min-h-[40px] max-sm:w-full max-sm:min-w-0" />
                        <span className="text-xs text-stone-400 dark:text-neutral-500">{t.availability_to_time}</span>
                        <input type="time" value={newEnd} onChange={e => handleEndChange(e.target.value)} className="rounded-full bg-stone-50 max-sm:bg-stone-100 dark:bg-neutral-800 border-none px-3 py-1.5 text-xs font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 max-sm:min-h-[40px] max-sm:w-full max-sm:min-w-0" />
                        <button onClick={() => handleAddSlot(idx)} className="rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 max-sm:min-h-[40px] max-sm:row-start-2 max-sm:col-start-3">OK</button>
                        <button onClick={() => setAddingDay(null)} aria-label={t.availability_cancel} className="text-xs text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300 max-sm:h-10 max-sm:w-10 max-sm:flex max-sm:items-center max-sm:justify-center max-sm:row-start-2 max-sm:col-start-1 max-sm:col-span-2 max-sm:justify-self-end">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartAdding(idx)}
                        className="mt-3 max-sm:mt-2 max-sm:min-h-[32px] flex items-center gap-1.5 text-xs text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300 transition-colors"
                      >
                        <Plus className="h-3 w-3" strokeWidth={1.5} />
                        {t.availability_add_short}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── Right: Absences ─── */}
        <aside className="col-span-12 xl:col-span-4 space-y-4 sm:space-y-8">
          {/* Temporary availability Card */}
          <div className={cn(GLASS_PANEL, 'rounded-2xl p-4 sm:p-5 md:p-8 shadow-lg max-sm:shadow-sm relative overflow-hidden')}>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#006c49]/5 rounded-full blur-3xl hidden lg:block" />
            <h3 className="font-business-display font-extrabold text-base sm:text-lg md:text-2xl mb-1 sm:mb-2 relative z-10 flex items-center gap-2 sm:gap-3 text-stone-900 dark:text-white">
              <CalendarRange className="h-5 w-5 text-[#006c49]" strokeWidth={1.5} />
              {t.temp_avail_title}
            </h3>
            <p className="text-xs text-stone-400 dark:text-neutral-500 mb-3 sm:mb-6 relative z-10">{t.temp_avail_subtitle}</p>

            <div className="space-y-3 mb-4 sm:mb-6 relative z-10 max-sm:space-y-0 max-sm:divide-y max-sm:divide-stone-100 dark:max-sm:divide-white/10">
              {tempPeriods.length === 0 ? (
                <div className="text-center py-6 max-sm:py-4">
                  <p className="text-sm text-stone-400 dark:text-neutral-500">{t.temp_avail_none}</p>
                  <p className="text-xs text-stone-400/70 dark:text-neutral-500/70 mt-1">{t.temp_avail_none_desc}</p>
                </div>
              ) : (
                tempPeriods.map(period => {
                  const status = periodStatus(period)
                  const nbSlots = (period.slots || []).length
                  return (
                    <div key={period.id} className={cn(
                      'p-4 rounded-2xl ring-1 transition-colors',
                      status === 'past'
                        ? 'bg-stone-100 dark:bg-white/5 ring-stone-200/50 dark:ring-white/5 opacity-60'
                        : 'bg-[#efedec] dark:bg-white/5 ring-[#c4c7c7]/10 dark:ring-white/10',
                      MOBILE_FLAT_ITEM
                    )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-stone-900 dark:text-white">
                              {new Date(period.start_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })} — {new Date(period.end_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                            </p>
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
                              status === 'active' ? 'bg-[#006c49]/10 text-[#006c49]'
                                : status === 'upcoming' ? 'bg-[#ffddb8] text-[#2a1700] dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-stone-200 dark:bg-white/10 text-stone-500 dark:text-neutral-400'
                            )}>
                              {status === 'active' ? t.temp_avail_status_active : status === 'upcoming' ? t.temp_avail_status_upcoming : t.temp_avail_status_past}
                            </span>
                          </div>
                          {period.label && (
                            <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase tracking-wider mt-0.5 truncate">{period.label}</p>
                          )}
                          <p className="text-[11px] text-stone-500 dark:text-neutral-400 mt-1">
                            {t.temp_avail_slot_count.replace('{n}', String(nbSlots)).replace('{s}', nbSlots > 1 ? 'x' : '')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingPeriod(period); setShowTempModal(true) }}
                            aria-label={lang === 'en' ? 'Edit' : 'Modifier'}
                            className="text-stone-300 dark:text-neutral-600 hover:text-[#006c49] transition-colors p-1 max-sm:p-2 max-sm:text-stone-400"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => handleDeleteTempPeriod(period)}
                            aria-label={lang === 'en' ? 'Delete' : 'Supprimer'}
                            className="text-stone-300 dark:text-neutral-600 hover:text-[#ba1a1a] transition-colors p-1 max-sm:p-2 max-sm:-mr-2 max-sm:text-stone-400"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <button
              onClick={() => { setEditingPeriod(null); setShowTempModal(true) }}
              className="w-full py-4 max-sm:py-3 border-2 border-dashed border-[#c4c7c7] dark:border-neutral-700/50 hover:border-[#006c49] hover:text-[#006c49] hover:bg-[#006c49]/5 rounded-2xl transition-all flex items-center justify-center gap-2 text-stone-500 dark:text-neutral-400 relative z-10 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-sm font-bold">{t.temp_avail_new}</span>
            </button>
          </div>

          {/* Absences Card */}
          <div className={cn(GLASS_PANEL, 'rounded-2xl p-4 sm:p-5 md:p-8 shadow-lg max-sm:shadow-sm relative overflow-hidden')}>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#006c49]/5 rounded-full blur-3xl hidden lg:block" />
            <h3 className="font-business-display font-extrabold text-base sm:text-lg md:text-2xl mb-3 sm:mb-6 relative z-10 text-stone-900 dark:text-white">{t.availability_absences_title}</h3>

            <div className="space-y-4 mb-4 sm:mb-6 relative z-10 max-sm:space-y-0 max-sm:divide-y max-sm:divide-stone-100 dark:max-sm:divide-white/10">
              {absences.length === 0 ? (
                <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-6 max-sm:py-4">{t.availability_no_absences}</p>
              ) : (
                absences.map(abs => {
                  const isPast = new Date(abs.end_date + 'T23:59:59') < new Date()
                  return (
                  <div key={abs.id} className={cn(
                    'flex items-center justify-between p-4 rounded-2xl ring-1 transition-colors',
                    isPast
                      ? 'bg-stone-100 dark:bg-white/5 ring-stone-200/50 dark:ring-white/5 opacity-60'
                      : 'bg-[#efedec] dark:bg-white/5 ring-[#c4c7c7]/10 dark:ring-white/10',
                    MOBILE_FLAT_ITEM, 'max-sm:gap-3'
                  )}>
                    <div className="flex items-center gap-3 max-sm:min-w-0">
                      <div className={cn('p-2 rounded-xl', isPast ? 'bg-stone-200/60 dark:bg-white/10' : 'bg-[#006c49]/10')}>
                        <Calendar className={cn('h-4 w-4', isPast ? 'text-stone-400 dark:text-neutral-500' : 'text-[#006c49]')} strokeWidth={1.5} />
                      </div>
                      <div className="max-sm:min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-stone-900 dark:text-white max-sm:whitespace-nowrap">
                            {new Date(abs.start_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })} — {new Date(abs.end_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                          </p>
                          {isPast && (
                            <span className="rounded-full bg-stone-200 dark:bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-stone-500 dark:text-neutral-400">
                              {lang === 'en' ? 'Past' : 'Passé'}
                            </span>
                          )}
                        </div>
                        {abs.reason && (
                          <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase tracking-wider max-sm:truncate">{abs.reason}</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteAbsence(abs.id)} aria-label={lang === 'en' ? 'Delete' : 'Supprimer'} className="text-stone-300 dark:text-neutral-600 hover:text-[#ba1a1a] transition-colors max-sm:p-2 max-sm:-mr-2 max-sm:text-stone-400 max-sm:shrink-0">
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                  )
                })
              )}
            </div>

            {/* Absence Form */}
            {showAbsenceForm && (
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-5 max-sm:p-3 mb-4 space-y-4 max-sm:space-y-3 relative z-10">
                <div className="grid grid-cols-2 gap-3 max-sm:gap-2">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">{t.availability_start_date}</label>
                    <input type="date" value={absStartDate} onChange={e => setAbsStartDate(e.target.value)} className="w-full min-w-0 rounded-full bg-white dark:bg-neutral-800 border-none px-4 max-sm:px-3 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">{t.availability_end_date}</label>
                    <input type="date" value={absEndDate} onChange={e => setAbsEndDate(e.target.value)} className="w-full min-w-0 rounded-full bg-white dark:bg-neutral-800 border-none px-4 max-sm:px-3 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">{t.availability_reason_optional}</label>
                  <input type="text" value={absReason} onChange={e => setAbsReason(e.target.value)} placeholder={t.availability_reason_placeholder} className="w-full rounded-full bg-white dark:bg-neutral-800 border-none px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAddAbsence} disabled={!absStartDate || !absEndDate} className="flex-1 rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-4 py-3 text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-50">{t.availability_confirm}</button>
                  <button onClick={() => setShowAbsenceForm(false)} className="px-4 py-3 text-sm font-bold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors">{t.availability_cancel}</button>
                </div>
              </div>
            )}

            {/* New absence button */}
            {!showAbsenceForm && (
              <button
                onClick={() => setShowAbsenceForm(true)}
                className="w-full py-4 max-sm:py-3 active:scale-[0.98] border-2 border-dashed border-[#c4c7c7] dark:border-neutral-700/50 hover:border-[#006c49] hover:text-[#006c49] hover:bg-[#006c49]/5 rounded-2xl transition-all flex items-center justify-center gap-2 text-stone-500 dark:text-neutral-400 relative z-10"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-sm font-bold">{t.availability_new_absence}</span>
              </button>
            )}
          </div>

          {/* Booking Constraints Card */}
          <div className={cn(GLASS_PANEL, 'rounded-2xl p-4 sm:p-5 md:p-8 shadow-lg max-sm:shadow-sm relative overflow-hidden')}>
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-[#006c49]/5 rounded-full blur-3xl hidden lg:block" />
            <h3 className="font-business-display font-extrabold text-base sm:text-lg md:text-2xl mb-1 sm:mb-2 relative z-10 flex items-center gap-2 sm:gap-3 text-stone-900 dark:text-white">
              <Settings2 className="h-5 w-5 text-[#006c49]" strokeWidth={1.5} />
              {t.availability_booking_settings}
            </h3>
            <p className="text-xs text-stone-400 dark:text-neutral-500 mb-4 sm:mb-6 relative z-10">{t.availability_booking_rules_desc}</p>

            <div className="space-y-6 max-sm:space-y-4 relative z-10">
              {/* Max calls per day */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">
                  {t.availability_max_per_day}
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={maxCallsPerDay ?? ''}
                    onChange={e => setMaxCallsPerDay(e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
                  >
                    <option value="">{t.availability_unlimited}</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15].map(n => (
                      <option key={n} value={n}>{t.availability_per_day.replace('{n}', String(n))}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Buffer before booking */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">
                  {t.availability_buffer_before}
                </label>
                <p className="text-[10px] text-stone-400/70 dark:text-neutral-500/70 mb-2">{t.availability_buffer_desc}</p>
                <select
                  value={bufferBeforeBooking}
                  onChange={e => setBufferBeforeBooking(Number(e.target.value))}
                  className="w-full rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
                >
                  <option value={0}>{t.availability_no_buffer}</option>
                  <option value={10}>{t.availability_minutes.replace('{n}', '10')}</option>
                  <option value={15}>{t.availability_minutes.replace('{n}', '15')}</option>
                  <option value={20}>{t.availability_minutes.replace('{n}', '20')}</option>
                  <option value={30}>{t.availability_minutes.replace('{n}', '30')}</option>
                  <option value={45}>{t.availability_minutes.replace('{n}', '45')}</option>
                  <option value={60}>{t.availability_hour.replace('{n}', '1')}</option>
                </select>
              </div>

              {/* Min booking notice */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">
                  {t.availability_min_notice}
                </label>
                <p className="text-[10px] text-stone-400/70 dark:text-neutral-500/70 mb-2">{t.availability_min_notice_desc}</p>
                <select
                  value={minBookingNotice}
                  onChange={e => setMinBookingNotice(Number(e.target.value))}
                  className="w-full rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
                >
                  <option value={0}>{t.availability_no_delay}</option>
                  <option value={1}>{t.availability_hours_before.replace('{n}', '1').replace('{s}', '')}</option>
                  <option value={3}>{t.availability_hours_before.replace('{n}', '3').replace('{s}', 's')}</option>
                  <option value={5}>{t.availability_hours_before.replace('{n}', '5').replace('{s}', 's')}</option>
                  <option value={10}>{t.availability_hours_before.replace('{n}', '10').replace('{s}', 's')}</option>
                  <option value={24}>{t.availability_hours_before.replace('{n}', '24').replace('{s}', 's')}</option>
                </select>
              </div>

              {/* Save button */}
              <button
                onClick={handleSaveConstraints}
                disabled={savingConstraints}
                className="w-full py-3.5 rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 text-white text-sm font-business-display font-extrabold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingConstraints ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" strokeWidth={1.5} />}
                {t.availability_save_settings}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Temporary availability modal */}
      <TemporaryAvailabilityModal
        open={showTempModal}
        onClose={() => { setShowTempModal(false); setEditingPeriod(null) }}
        ownerId={effectiveOwnerId!}
        teamMemberId={effectiveTeamMemberId}
        baseSlots={slots}
        periods={tempPeriods}
        editing={editingPeriod}
        onSaved={async (summary) => {
          await notifyOwnerAndHoS(`${t.temp_avail_title} — ${memberName}`, summary)
          fetchData()
        }}
      />

      {/* Onboarding Popup */}
      {showOnboardingPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={dismissOnboarding} />
          <div className="relative w-full max-w-md max-sm:max-w-none max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl p-8 max-sm:px-5 max-sm:pt-3 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-stone-300 dark:bg-neutral-700" />
            <button onClick={dismissOnboarding} aria-label={lang === 'en' ? 'Close' : 'Fermer'} className="absolute top-5 right-5 max-sm:top-4 max-sm:right-4 max-sm:p-1 text-stone-300 dark:text-neutral-600 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="text-center mb-8 max-sm:mb-5">
              <div className="flex h-16 w-16 max-sm:h-12 max-sm:w-12 items-center justify-center rounded-2xl bg-[#006c49]/10 mx-auto mb-5 max-sm:mb-3">
                <Calendar className="h-8 w-8 text-[#006c49]" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl max-sm:text-xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">{t.availability_onboarding_title}</h2>
              <p className="text-sm text-stone-500 dark:text-neutral-400 mt-3 leading-relaxed">
                {t.availability_onboarding_desc}
              </p>
            </div>
            <div className="space-y-3 max-sm:space-y-2">
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-4 max-sm:p-3">
                <p className="text-sm text-stone-700 dark:text-neutral-200 font-medium">{t.availability_onboarding_step1}</p>
              </div>
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-4 max-sm:p-3">
                <p className="text-sm text-stone-700 dark:text-neutral-200 font-medium">{t.availability_onboarding_step2}</p>
              </div>
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-4 max-sm:p-3">
                <p className="text-sm text-stone-700 dark:text-neutral-200 font-medium">{t.availability_onboarding_step3}</p>
              </div>
            </div>
            <button
              onClick={dismissOnboarding}
              className="w-full mt-8 max-sm:mt-5 rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 py-4 text-sm font-business-display font-extrabold text-white hover:opacity-90 transition-all"
            >
              {t.availability_onboarding_go}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
