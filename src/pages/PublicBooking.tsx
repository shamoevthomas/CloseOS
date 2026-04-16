import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Clock, Calendar, ChevronLeft, ChevronRight, CheckCircle2, User, Mail, Phone, Globe, ArrowRight, Hash, List, Type } from 'lucide-react'
import { toUTC, fromUTC, getTimezoneLabel } from '../lib/timezone'
import { supabase } from '../lib/supabase'

interface SlotData { date: string; time: string; datetime_utc?: string }
interface CustomField {
  label: string
  type: 'text' | 'email' | 'phone' | 'number' | 'select'
  required: boolean
  options?: string[]
}

interface BookingInfo {
  label: string
  duration: number
  description: string | null
  redirectUrl: string | null
  companyName: string | null
  logoUrl: string | null
  emailEnabled: boolean
  emailRequired: boolean
  phoneEnabled: boolean
  phoneRequired: boolean
  customFields: CustomField[]
  slots?: SlotData[]
}

interface CreatorInfo {
  name: string
  avatarUrl: string | null
}

const API_URL = '/api/business'

const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const getMonthDates = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1)
  const startDay = firstDay.getDay()
  const startOffset = startDay === 0 ? -6 : 1 - startDay
  const start = new Date(year, month, startOffset)
  const dates: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d)
  }
  return dates
}

const formatDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export function PublicBooking() {
  const lang = (localStorage.getItem('closeos_lang') || 'fr') as 'fr' | 'en'
  const { slug } = useParams<{ slug: string }>()
  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'form' | 'calendar' | 'confirm'>('form')

  // Calendar
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  // Prospect timezone
  const prospectTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  // Creator info
  const [creator, setCreator] = useState<CreatorInfo | null>(null)

  // Link metadata for direct Supabase submit
  const [linkMeta, setLinkMeta] = useState<{ business_owner_id: string; team_member_id: string | null; duration: number } | null>(null)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`${API_URL}?action=booking-info&slug=${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(async (d) => {
        // Compléter avec données Supabase (description, redirect, creator)
        const { data: link } = await supabase
          .from('business_booking_links')
          .select('description, redirect_url, business_owner_id, team_member_id, email_enabled, email_required, phone_enabled, phone_required, custom_fields')
          .eq('slug', slug)
          .maybeSingle()
        if (link) {
          if (!d.description && link.description) d.description = link.description
          if (!d.redirectUrl && link.redirect_url) d.redirectUrl = link.redirect_url
          setLinkMeta({ business_owner_id: link.business_owner_id, team_member_id: link.team_member_id, duration: d.duration || 30 })
          d.emailEnabled = link.email_enabled ?? true
          d.emailRequired = link.email_required ?? false
          d.phoneEnabled = link.phone_enabled ?? true
          d.phoneRequired = link.phone_required ?? false
          d.customFields = (link.custom_fields as CustomField[]) || []

          // Fallback: compute slots client-side if API doesn't return them (deployed API still uses freeMode)
          if (!d.slots || d.slots.length === 0 || d.freeMode) {
            const isOwnerLink = !link.team_member_id
            const today = new Date().toISOString().split('T')[0]
            const duration = d.duration || 30

            const slotsQuery = isOwnerLink
              ? supabase.from('business_availability_slots').select('*').eq('business_owner_id', link.business_owner_id).is('team_member_id', null)
              : supabase.from('business_availability_slots').select('*').eq('team_member_id', link.team_member_id)

            const absencesQuery = isOwnerLink
              ? supabase.from('business_absences').select('start_date, end_date').eq('business_owner_id', link.business_owner_id).is('team_member_id', null).gte('end_date', today)
              : supabase.from('business_absences').select('start_date, end_date').eq('team_member_id', link.team_member_id).gte('end_date', today)

            const appointmentsQuery = isOwnerLink
              ? supabase.from('business_appointments').select('date, time, duration').eq('user_id', link.business_owner_id).is('assigned_to', null).gte('date', today).in('status', ['upcoming', 'pending', 'confirmed'])
              : supabase.from('business_appointments').select('date, time, duration').eq('assigned_to', link.team_member_id).gte('date', today).in('status', ['upcoming', 'pending', 'confirmed'])

            const [slotsRes, absencesRes, appointmentsRes] = await Promise.all([slotsQuery, absencesQuery, appointmentsQuery])

            const weeklySlots = slotsRes.data || []
            const absences = absencesRes.data || []
            const existingAppts = appointmentsRes.data || []
            const now = new Date()
            const computedSlots: SlotData[] = []

            for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
              const dateObj = new Date(now)
              dateObj.setDate(dateObj.getDate() + dayOffset)
              const jsDay = dateObj.getDay()
              const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
              const dateStr = dateObj.toISOString().split('T')[0]

              const isAbsent = absences.some((a: any) => dateStr >= a.start_date && dateStr <= a.end_date)
              if (isAbsent) continue

              const daySlots = weeklySlots.filter((s: any) => s.day_of_week === dayOfWeek)
              if (daySlots.length === 0) continue

              const dayAppts = existingAppts.filter((a: any) => a.date === dateStr)

              for (const slot of daySlots) {
                const [startH, startM] = (slot as any).start_time.split(':').map(Number)
                const [endH, endM] = (slot as any).end_time.split(':').map(Number)
                const startMins = startH * 60 + startM
                const endMins = endH * 60 + endM

                for (let mins = startMins; mins + duration <= endMins; mins += duration) {
                  const h = Math.floor(mins / 60)
                  const m = mins % 60
                  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

                  if (dayOffset === 0) {
                    const slotTime = new Date(dateObj)
                    slotTime.setHours(h, m, 0, 0)
                    if (slotTime <= now) continue
                  }

                  const hasConflict = dayAppts.some((appt: any) => {
                    const [aH, aM] = appt.time.split(':').map(Number)
                    const apptStart = aH * 60 + aM
                    const apptEnd = apptStart + (appt.duration || 30)
                    return mins < apptEnd && (mins + duration) > apptStart
                  })
                  if (hasConflict) continue

                  computedSlots.push({ date: dateStr, time: timeStr })
                }
              }
            }
            d.slots = computedSlots
            delete d.freeMode
          }

          // Fetch creator info (team member if assigned, otherwise owner)
          if (link.team_member_id) {
            const { data: tm } = await supabase
              .from('business_team_members')
              .select('first_name, last_name, avatar_url')
              .eq('id', link.team_member_id)
              .maybeSingle()
            if (tm) setCreator({ name: `${tm.first_name} ${tm.last_name}`, avatarUrl: tm.avatar_url })
          } else if (link.business_owner_id) {
            const { data: owner } = await supabase
              .from('business_users')
              .select('full_name, avatar_url')
              .eq('id', link.business_owner_id)
              .maybeSingle()
            if (owner) setCreator({ name: owner.full_name, avatarUrl: owner.avatar_url })
          }
        }
        setInfo(d)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  // Convert API slots from UTC to prospect's timezone for display
  const prospectSlots = useMemo(() => {
    if (!info?.slots) return []
    return info.slots.map(slot => {
      if (!slot.datetime_utc) return slot
      const local = fromUTC(slot.datetime_utc, prospectTimezone)
      return { ...slot, date: local.date, time: local.time }
    })
  }, [info?.slots, prospectTimezone])

  // Available dates set (for calendar highlighting)
  const availableDates = useMemo(() => {
    if (!info?.slots) return new Set<string>()
    return new Set(prospectSlots.map(s => s.date))
  }, [info?.slots, prospectSlots])

  // Slots for selected date
  const slotsForDate = useMemo(() => {
    if (!selectedDate) return []
    return prospectSlots.filter(s => s.date === selectedDate).map(s => s.time)
  }, [selectedDate, prospectSlots])

  const handleContactSubmit = () => {
    if (!name.trim()) return
    setStep('calendar')
  }

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !slug || !linkMeta) return
    setSubmitting(true)
    try {
      const matchSlot = prospectSlots.find(s => s.date === selectedDate && s.time === selectedTime)
      const datetimeUtc = matchSlot?.datetime_utc || toUTC(selectedDate, selectedTime, prospectTimezone).toISOString()

      // Re-validate: check no conflicting appointment
      const conflictQuery = linkMeta.team_member_id
        ? supabase.from('business_appointments').select('id, time, duration').eq('assigned_to', linkMeta.team_member_id).eq('date', selectedDate).in('status', ['upcoming', 'pending', 'confirmed'])
        : supabase.from('business_appointments').select('id, time, duration').eq('user_id', linkMeta.business_owner_id).is('assigned_to', null).eq('date', selectedDate).in('status', ['upcoming', 'pending', 'confirmed'])

      const { data: conflicts } = await conflictQuery
      const [rH, rM] = selectedTime.split(':').map(Number)
      const reqStart = rH * 60 + rM
      const reqEnd = reqStart + linkMeta.duration
      const hasConflict = (conflicts || []).some((appt: any) => {
        const [aH, aM] = appt.time.split(':').map(Number)
        const apptStart = aH * 60 + aM
        const apptEnd = apptStart + (appt.duration || 30)
        return reqStart < apptEnd && reqEnd > apptStart
      })
      if (hasConflict) {
        alert(lang === 'fr' ? 'Ce créneau vient d\'être réservé. Veuillez en choisir un autre.' : 'This slot has just been booked. Please choose another.')
        setSubmitting(false)
        return
      }

      // Generate tokens
      const cancelToken = crypto.randomUUID()
      const rescheduleToken = crypto.randomUUID()

      // Create appointment directly via Supabase (no prospect)
      const { data: appointment, error: apptErr } = await supabase
        .from('business_appointments')
        .insert({
          user_id: linkMeta.business_owner_id,
          prospect_id: null,
          assigned_to: linkMeta.team_member_id || null,
          date: selectedDate,
          time: selectedTime,
          duration: linkMeta.duration,
          status: 'pending',
          datetime_utc: datetimeUtc,
          timezone: prospectTimezone,
          cancel_token: cancelToken,
          reschedule_token: rescheduleToken,
          notes: `Booking: ${name}${email ? ` — ${email}` : ''}${phone ? ` — ${phone}` : ''}${Object.entries(customFieldValues).filter(([, v]) => v.trim()).map(([k, v]) => ` — ${k}: ${v}`).join('')}`,
        })
        .select()
        .single()

      if (apptErr) {
        console.error('Appointment creation error:', apptErr)
        alert(lang === 'fr' ? 'Erreur lors de la création du rendez-vous' : 'Error creating appointment')
        setSubmitting(false)
        return
      }

      // Create notification for owner + assigned member + HoS
      const notifTitle = `Nouveau rendez-vous : ${name}`
      const notifDesc = `${name} a réservé un créneau le ${selectedDate} à ${selectedTime} (${linkMeta.duration} min)${email ? ` — ${email}` : ''}`
      const reminderRows: { user_id: string; title: string; description: string; reminder_date: string; is_done: boolean; is_notification: boolean }[] = []

      // Owner
      reminderRows.push({ user_id: linkMeta.business_owner_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })

      // Assigned member
      if (linkMeta.team_member_id) {
        const { data: tmUser } = await supabase.from('business_team_members').select('user_id').eq('id', linkMeta.team_member_id).single()
        if (tmUser?.user_id && tmUser.user_id !== linkMeta.business_owner_id) {
          reminderRows.push({ user_id: tmUser.user_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })
        }
      }

      // HoS / Admin
      const { data: hosMembers } = await supabase
        .from('business_team_members')
        .select('user_id')
        .eq('business_owner_id', linkMeta.business_owner_id)
        .in('role', ['Head of Sales', 'Admin'])
      if (hosMembers) {
        for (const hos of hosMembers) {
          if (hos.user_id && !reminderRows.some(r => r.user_id === hos.user_id)) {
            reminderRows.push({ user_id: hos.user_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })
          }
        }
      }

      await supabase.from('reminders').insert(reminderRows)

      // Call API for Google Calendar + Meet + emails
      fetch(`${API_URL}?action=booking-gcal-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, name, email, phone, date: selectedDate, time: selectedTime,
          datetime_utc: datetimeUtc,
          prospect_timezone: prospectTimezone,
          appointment_id: appointment.id,
        }),
      }).catch(() => {})

      if (info?.redirectUrl) {
        const url = info.redirectUrl!.match(/^https?:\/\//) ? info.redirectUrl! : `https://${info.redirectUrl!}`
        setTimeout(() => { window.location.href = url }, 2500)
      }
      setDone(true)
    } catch (err) {
      console.error('Booking error:', err)
      alert(lang === 'fr' ? 'Erreur de connexion' : 'Connection error')
    } finally {
      setSubmitting(false)
    }
  }

  const monthDates = getMonthDates(calYear, calMonth)
  const today = formatDateKey(new Date())

  const goNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }
  const goPrevMonth = () => {
    const now = new Date()
    if (calYear === now.getFullYear() && calMonth <= now.getMonth()) return
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }

  const isDateSelectable = (d: Date) => {
    const key = formatDateKey(d)
    if (key < today) return false
    if (d.getMonth() !== calMonth) return false
    return availableDates.has(key)
  }

  const endTime = (time: string, duration: number) => {
    const [h, m] = time.split(':').map(Number)
    const end = h * 60 + m + duration
    return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  }

  const inputCls = "w-full bg-transparent border-b-2 border-[#c4c7c7]/30 py-3 text-sm text-[#1b1c1b] placeholder:text-[#444748]/40 focus:border-[#006c49] focus:ring-0 transition-colors outline-none font-medium"

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#006c49]" />
      </div>
    )
  }

  // ─── Error ───
  if (error || !info) {
    return (
      <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[#f5f3f2] flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#444748]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1b1c1b] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Lien introuvable</h1>
          <p className="text-[#444748]">Ce lien de réservation n'existe pas ou a été supprimé.</p>
        </div>
      </div>
    )
  }

  // ─── Done ───
  if (done) {
    const dateLabel = selectedDate
      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    return (
      <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-[#006c49]/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-[#006c49]" />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-[#1b1c1b] mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>Réservation confirmée</h2>
          <p className="text-[#444748] mb-6">Votre rendez-vous a été réservé avec succès.</p>
          <div className="rounded-2xl bg-white p-6 space-y-4 text-left" style={{ boxShadow: 'inset 0 0 0 1px rgba(196,199,199,0.1), 0 20px 40px rgba(27,28,27,0.04)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f5f3f2] flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-[#444748]" />
              </div>
              <span className="text-sm font-bold text-[#1b1c1b] capitalize">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f5f3f2] flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-[#444748]" />
              </div>
              <span className="text-sm font-bold text-[#1b1c1b]">
                {selectedTime} - {endTime(selectedTime!, info.duration)} ({info.duration} min)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f5f3f2] flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-[#444748]" />
              </div>
              <span className="text-sm text-[#444748]">{getTimezoneLabel(prospectTimezone)}</span>
            </div>
          </div>
          {info.redirectUrl ? (
            <p className="mt-6 text-xs text-[#444748]/50 animate-pulse">Vous allez être redirigé...</p>
          ) : info.companyName ? (
            <p className="mt-6 text-xs text-[#444748]/50">{info.companyName} vous contactera pour confirmer.</p>
          ) : null}
        </div>
      </div>
    )
  }

  // ─── Main ───
  return (
    <div className="min-h-screen bg-[#fbf9f8]">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl border-b border-[#c4c7c7]/10 py-5">
        <div className="mx-auto max-w-4xl px-6 flex items-center justify-center gap-3">
          {info.logoUrl ? (
            <img src={info.logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <span className="text-lg font-extrabold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Close<span style={{ background: 'linear-gradient(135deg, #ff4b72, #a03cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
            </span>
          )}
          {info.companyName && info.logoUrl && (
            <span className="text-base font-bold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {info.companyName}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="bg-white rounded-[2rem] overflow-hidden" style={{ boxShadow: 'inset 0 0 0 1px rgba(196,199,199,0.1), 0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="md:flex min-h-[480px]">
            {/* Left panel — info */}
            <div className="md:w-80 bg-[#f5f3f2] p-8 md:p-10 border-b md:border-b-0 md:border-r border-[#c4c7c7]/10 flex flex-col">
              {info.logoUrl && (
                <img src={info.logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover mb-5" />
              )}
              <h1 className="text-2xl font-extrabold text-[#1b1c1b] mb-3 leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {info.label}
              </h1>

              {info.description && (
                <p className="text-sm text-[#444748] leading-relaxed mb-4">{info.description}</p>
              )}

              {/* Contact info recap */}
              {step !== 'form' && name && (
                <div className="mt-2 pt-5 border-t border-[#c4c7c7]/20 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/50">Vos informations</p>
                  <div className="space-y-2">
                    <p className="text-sm text-[#1b1c1b] flex items-center gap-2.5 font-medium">
                      <User className="h-3.5 w-3.5 text-[#444748]/50" />{name}
                    </p>
                    {email && (
                      <p className="text-sm text-[#1b1c1b] flex items-center gap-2.5 font-medium">
                        <Mail className="h-3.5 w-3.5 text-[#444748]/50" />{email}
                      </p>
                    )}
                    {phone && (
                      <p className="text-sm text-[#1b1c1b] flex items-center gap-2.5 font-medium">
                        <Phone className="h-3.5 w-3.5 text-[#444748]/50" />{phone}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setStep('form')} className="text-xs text-[#006c49] font-bold hover:underline">
                    Modifier
                  </button>
                </div>
              )}

              {/* Selected slot recap */}
              {step === 'confirm' && selectedDate && selectedTime && (
                <div className="mt-4 pt-5 border-t border-[#c4c7c7]/20 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/50">Créneau sélectionné</p>
                  <p className="text-sm text-[#1b1c1b] flex items-center gap-2.5 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-[#444748]/50" />
                    <span className="capitalize">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </p>
                  <p className="text-sm text-[#1b1c1b] flex items-center gap-2.5 font-medium">
                    <Clock className="h-3.5 w-3.5 text-[#444748]/50" />
                    {selectedTime} - {endTime(selectedTime, info.duration)}
                  </p>
                </div>
              )}

              <div className="mt-auto pt-8 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#006c49]" />
                  <span className="text-sm font-bold text-[#444748]">{info.duration} minutes</span>
                </div>
                {creator && (
                  <div className="flex items-center gap-3">
                    {creator.avatarUrl ? (
                      <img src={creator.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-[#006c49]/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-[#006c49]" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-[#1b1c1b]">{creator.name}</span>
                  </div>
                )}
                <p className="text-[10px] tracking-widest uppercase text-[#444748]/30 font-bold">
                  Propulsé par <span className="text-[#444748]/50">CloseOS</span>
                </p>
              </div>
            </div>

            {/* Right panel — form / calendar */}
            <div className="flex-1 p-8 md:p-10">
              {/* Step 1: Contact info */}
              {step === 'form' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-full bg-[#1b1c1b] flex items-center justify-center text-white text-sm font-bold shrink-0">1</div>
                    <h2 className="text-2xl font-extrabold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>Vos coordonnées</h2>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">Nom complet *</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Jean Dupont"
                        className={inputCls}
                      />
                    </div>
                    {(info.emailEnabled !== false) && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">Email{info.emailRequired ? ' *' : ''}</label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="jean@example.com"
                          className={inputCls}
                        />
                      </div>
                    )}
                    {(info.phoneEnabled !== false) && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">Téléphone{info.phoneRequired ? ' *' : ''}</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+33 6 12 34 56 78"
                          className={inputCls}
                        />
                      </div>
                    )}

                    {/* Custom fields */}
                    {(info.customFields || []).map((cf, idx) => (
                      <div key={idx} className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">
                          {cf.label}{cf.required ? ' *' : ''}
                        </label>
                        {cf.type === 'select' ? (
                          <select
                            value={customFieldValues[cf.label] || ''}
                            onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.label]: e.target.value }))}
                            className={inputCls}
                          >
                            <option value="">{lang === 'fr' ? 'Sélectionner...' : 'Select...'}</option>
                            {(cf.options || []).filter(o => o.trim()).map((opt, oi) => (
                              <option key={oi} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={cf.type === 'phone' ? 'tel' : cf.type === 'number' ? 'number' : cf.type === 'email' ? 'email' : 'text'}
                            value={customFieldValues[cf.label] || ''}
                            onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.label]: e.target.value }))}
                            placeholder={cf.label}
                            className={inputCls}
                          />
                        )}
                      </div>
                    ))}

                    <button
                      onClick={handleContactSubmit}
                      disabled={!name.trim() || (info.emailRequired && !email.trim()) || (info.phoneRequired && !phone.trim()) || (info.customFields || []).some(cf => cf.required && !customFieldValues[cf.label]?.trim())}
                      className="w-full flex items-center justify-center gap-3 rounded-full bg-[#1b1c1b] py-4 text-base font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl mt-4"
                      style={{ fontFamily: 'Manrope, sans-serif' }}
                    >
                      <span>Choisir un créneau</span>
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Calendar + time slots */}
              {step === 'calendar' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-full bg-[#1b1c1b] flex items-center justify-center text-white text-sm font-bold shrink-0">2</div>
                    <h2 className="text-2xl font-extrabold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>Choisissez un créneau</h2>
                  </div>

                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <span className="text-lg font-bold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {MONTHS_FR[calMonth]} {calYear}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={goPrevMonth} className="p-2 hover:bg-[#f5f3f2] rounded-full transition-colors">
                        <ChevronLeft className="h-5 w-5 text-[#1b1c1b]" />
                      </button>
                      <button onClick={goNextMonth} className="p-2 hover:bg-[#f5f3f2] rounded-full transition-colors">
                        <ChevronRight className="h-5 w-5 text-[#1b1c1b]" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {DAY_NAMES.map((d, i) => (
                      <div key={i} className="py-1 text-[10px] font-bold text-[#444748]/40 uppercase tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-6">
                    {monthDates.map((d, i) => {
                      const key = formatDateKey(d)
                      const selectable = isDateSelectable(d)
                      const isSelected = key === selectedDate
                      const isCurrentMonth = d.getMonth() === calMonth
                      const isToday = key === today
                      return (
                        <button
                          key={i}
                          disabled={!selectable}
                          onClick={() => { setSelectedDate(key); setSelectedTime(null) }}
                          className={`
                            p-2.5 rounded-full text-sm font-medium transition-all
                            ${!isCurrentMonth ? 'text-[#c4c7c7]/30' : ''}
                            ${selectable && !isSelected ? 'text-[#1b1c1b] hover:bg-[#eae8e7]' : ''}
                            ${selectable && isSelected ? 'bg-[#006c49] text-white shadow-lg shadow-[#006c49]/20' : ''}
                            ${!selectable && isCurrentMonth ? 'text-[#c4c7c7] cursor-not-allowed' : ''}
                            ${isToday && !isSelected && selectable ? 'bg-[#006c49]/10 text-[#006c49]' : ''}
                          `}
                        >
                          {d.getDate()}
                        </button>
                      )
                    })}
                  </div>

                  {/* Time slots */}
                  {selectedDate && (
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-4">
                        Créneaux — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </h3>
                      {slotsForDate.length === 0 ? (
                        <p className="text-sm text-[#444748]/40 text-center py-4">Aucun créneau disponible ce jour.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
                          {slotsForDate.map(time => (
                            <button
                              key={time}
                              onClick={() => { setSelectedTime(time); setStep('confirm') }}
                              className={`
                                py-3 px-4 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2
                                ${selectedTime === time
                                  ? 'bg-[#1b1c1b] text-white shadow-lg'
                                  : 'border border-[#c4c7c7]/30 text-[#1b1c1b] hover:border-[#006c49] hover:text-[#006c49]'
                                }
                              `}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Confirm */}
              {step === 'confirm' && selectedDate && selectedTime && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-full bg-[#006c49] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>Confirmer</h2>
                  </div>

                  <div className="rounded-2xl bg-[#f5f3f2] p-6 space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                        <Calendar className="h-4 w-4 text-[#006c49]" />
                      </div>
                      <span className="text-sm font-bold text-[#1b1c1b] capitalize">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-[#006c49]" />
                      </div>
                      <span className="text-sm font-bold text-[#1b1c1b]">
                        {selectedTime} - {endTime(selectedTime, info.duration)} ({info.duration} min)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-[#006c49]" />
                      </div>
                      <span className="text-sm font-bold text-[#1b1c1b]">{name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                        <Globe className="h-4 w-4 text-[#444748]/50" />
                      </div>
                      <span className="text-sm text-[#444748]">{getTimezoneLabel(prospectTimezone)}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('calendar')}
                      className="flex-1 rounded-full border border-[#c4c7c7]/30 px-5 py-4 text-sm font-bold text-[#444748] hover:bg-[#f5f3f2] transition-all"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#1b1c1b] px-5 py-4 text-sm font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-xl"
                      style={{ fontFamily: 'Manrope, sans-serif' }}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          <span>Confirmer</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-center text-[10px] text-[#444748]/40 mt-6 font-medium leading-relaxed">
                    En confirmant, vous acceptez d'être recontacté(e) et que vos informations soient enregistrées.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
