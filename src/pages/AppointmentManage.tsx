import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle, Calendar, ChevronLeft, ChevronRight, Clock, AlertTriangle } from 'lucide-react'

const API_URL = '/api/business'

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface AppointmentInfo {
  id: string
  date: string
  time: string
  duration: number
  status: string
  timezone: string | null
  prospect_name: string
  prospect_email: string
  assignee_name: string | null
  campaign_slug: string | null
  booking_slug: string | null
  token_type: 'cancel' | 'reschedule'
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function AppointmentManage() {
  const lang = (localStorage.getItem('closeos_lang') || 'fr') as 'fr' | 'en'
  const MONTHS = lang === 'fr' ? MONTHS_FR : MONTHS_EN
  const DAYS = lang === 'fr' ? DAYS_FR : DAYS_EN
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const actionParam = searchParams.get('action') as 'cancel' | 'reschedule' | null

  const [info, setInfo] = useState<AppointmentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cancel state
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  // Reschedule state
  const [slots, setSlots] = useState<{ date: string; time: string; member_ids: string[]; datetime_utc: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduled, setRescheduled] = useState(false)

  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())

  // Fetch appointment info
  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API_URL}?action=appointment-info&token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setInfo(data)
        if (data.status === 'cancelled') setCancelled(true)
      })
      .catch(() => setError(lang === 'fr' ? 'Impossible de charger le rendez-vous' : 'Unable to load appointment'))
      .finally(() => setLoading(false))
  }, [token])

  // Fetch available slots for reschedule
  useEffect(() => {
    if (actionParam !== 'reschedule' || !info) return
    const slug = info.campaign_slug || info.booking_slug
    if (!slug) return
    const action = info.campaign_slug ? 'capture-slots' : 'booking-info'
    setSlotsLoading(true)
    fetch(`${API_URL}?action=${action}&slug=${slug}`)
      .then(r => r.json())
      .then(data => setSlots(data.slots || []))
      .catch(() => {})
      .finally(() => setSlotsLoading(false))
  }, [info?.campaign_slug, info?.booking_slug, actionParam])

  const handleCancel = async () => {
    if (!token || cancelling) return
    setCancelling(true)
    try {
      const res = await fetch(`${API_URL}?action=appointment-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      const data = await res.json()
      if (data.cancelled || data.already) setCancelled(true)
    } catch {}
    finally { setCancelling(false) }
  }

  const handleReschedule = async () => {
    if (!token || !selectedDate || !selectedTime || rescheduling) return
    setRescheduling(true)
    try {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
      const matchingSlot = slots.find(s => s.date === dateStr && s.time === selectedTime)
      const res = await fetch(`${API_URL}?action=appointment-reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          date: dateStr,
          time: selectedTime,
          datetime_utc: matchingSlot?.datetime_utc || null,
          prospect_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      })
      const data = await res.json()
      if (data.rescheduled) setRescheduled(true)
    } catch {}
    finally { setRescheduling(false) }
  }

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1)
    const lastDay = new Date(calYear, calMonth + 1, 0)
    let startIdx = firstDay.getDay() - 1
    if (startIdx < 0) startIdx = 6
    const days: (Date | null)[] = Array(startIdx).fill(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(calYear, calMonth, d))
    return days
  }, [calMonth, calYear])

  const availableDates = useMemo(() => {
    const set = new Set<string>()
    for (const s of slots) set.add(s.date)
    return set
  }, [slots])

  const availableTimesForDate = useMemo(() => {
    if (!selectedDate) return []
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    return slots.filter(s => s.date === dateStr)
  }, [selectedDate, slots])

  const prevMonth = useCallback(() => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }, [calMonth])
  const nextMonth = useCallback(() => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }, [calMonth])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#006c49] animate-spin" />
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold text-[#1b1c1b] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {lang === 'fr' ? 'Rendez-vous introuvable' : 'Appointment not found'}
          </h1>
          <p className="text-[#444748]">{lang === 'fr' ? "Ce lien n'est plus valide ou le rendez-vous n'existe pas." : "This link is no longer valid or the appointment doesn't exist."}</p>
        </div>
      </div>
    )
  }

  // Format date
  const apptDate = new Date(`${info.date}T${info.time}:00`)
  const dateFr = apptDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const [eH, eM] = info.time.split(':').map(Number)
  const endMins = eH * 60 + eM + (info.duration || 30)
  const endTimeStr = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`

  // Success states
  if (cancelled) {
    return (
      <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="flex justify-center mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1b1c1b] mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {lang === 'fr' ? 'Rendez-vous annulé' : 'Appointment cancelled'}
          </h1>
          <p className="text-[#444748] mb-6">{lang === 'fr' ? `Votre rendez-vous du ${dateFr} à ${info.time} a été annulé.` : `Your appointment on ${dateFr} at ${info.time} has been cancelled.`}</p>
          <p className="text-sm text-[#444748]/60">{lang === 'fr' ? "L'équipe a été notifiée de cette annulation." : 'The team has been notified of this cancellation.'}</p>
        </div>
      </div>
    )
  }

  if (rescheduled) {
    const newDate = selectedDate!
    const newDateFr = newDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return (
      <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="flex justify-center mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#006c49]/10">
              <CheckCircle2 className="h-10 w-10 text-[#006c49]" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1b1c1b] mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {lang === 'fr' ? 'Rendez-vous reprogrammé' : 'Appointment rescheduled'}
          </h1>
          <div className="rounded-2xl bg-[#f5f3f2] p-5 mb-4">
            <p className="text-sm font-bold text-[#1b1c1b]">{newDateFr}</p>
            <p className="text-sm text-[#444748] mt-1">{selectedTime}</p>
          </div>
          <p className="text-sm text-[#444748]/60">{lang === 'fr' ? 'Un email de confirmation vous a été envoyé.' : 'A confirmation email has been sent to you.'}</p>
        </div>
      </div>
    )
  }

  // Cancel view
  if (actionParam === 'cancel') {
    return (
      <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center">
        <div className="max-w-lg mx-auto p-8">
          <div className="bg-white rounded-3xl p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)]" style={{ border: '1px solid rgba(196,199,199,0.1)' }}>
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1b1c1b] text-center mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {lang === 'fr' ? 'Annuler votre rendez-vous ?' : 'Cancel your appointment?'}
            </h1>
            <p className="text-[#444748] text-center mb-8">{lang === 'fr' ? 'Cette action est irréversible.' : 'This action is irreversible.'}</p>

            <div className="rounded-2xl bg-[#f5f3f2] p-6 mb-8">
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="h-5 w-5 text-[#006c49]" />
                <span className="font-bold text-[#1b1c1b] capitalize">{dateFr}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-[#006c49]" />
                <span className="font-bold text-[#1b1c1b]">{info.time} — {endTimeStr} ({info.duration} min)</span>
              </div>
              {info.assignee_name && (
                <p className="text-sm text-[#444748] mt-3">{lang === 'fr' ? 'Avec' : 'With'} {info.assignee_name}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-4 rounded-full bg-[#ba1a1a] text-white font-bold text-sm hover:bg-[#a01515] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                {lang === 'fr' ? "Confirmer l'annulation" : 'Confirm cancellation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Reschedule view
  return (
    <div className="min-h-screen bg-[#fbf9f8] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-10 shadow-[0_20px_40px_rgba(27,28,27,0.04)]" style={{ border: '1px solid rgba(196,199,199,0.1)' }}>
          <h1 className="text-2xl font-extrabold text-[#1b1c1b] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {lang === 'fr' ? 'Reprogrammer votre rendez-vous' : 'Reschedule your appointment'}
          </h1>
          <p className="text-[#444748] mb-2">{lang === 'fr' ? 'Rendez-vous actuel :' : 'Current appointment:'}</p>
          <div className="rounded-2xl bg-[#f5f3f2] p-5 mb-8 flex items-center gap-4">
            <Calendar className="h-5 w-5 text-[#006c49] shrink-0" />
            <div>
              <p className="font-bold text-[#1b1c1b] capitalize">{dateFr}</p>
              <p className="text-sm text-[#444748]">{info.time} — {endTimeStr}</p>
            </div>
          </div>

          <h2 className="text-lg font-extrabold text-[#1b1c1b] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {lang === 'fr' ? 'Choisissez un nouveau créneau' : 'Choose a new time slot'}
          </h2>

          {slotsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 text-[#006c49] animate-spin" />
            </div>
          ) : (
            <div>
              {/* Calendar */}
              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${selectedDate ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-lg font-bold text-[#1b1c1b]">{MONTHS[calMonth]} {calYear}</span>
                  <div className="flex gap-1">
                    <button onClick={prevMonth} className="p-2 hover:bg-[#f5f3f2] rounded-full transition-colors">
                      <ChevronLeft className="h-5 w-5 text-[#1b1c1b]" />
                    </button>
                    <button onClick={nextMonth} className="p-2 hover:bg-[#f5f3f2] rounded-full transition-colors">
                      <ChevronRight className="h-5 w-5 text-[#1b1c1b]" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {DAYS.map((d, i) => (
                    <div key={i} className="py-1 text-[10px] font-bold text-[#444748]/40 uppercase tracking-widest">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} />
                    const past = day < today && !isSameDay(day, today)
                    const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                    const noAvailability = !availableDates.has(dayStr)
                    const disabled = past || noAvailability
                    const isToday = isSameDay(day, today)
                    return (
                      <button
                        key={i}
                        disabled={disabled}
                        onClick={() => { setSelectedDate(day); setSelectedTime(null) }}
                        className={`p-2.5 rounded-full text-sm font-medium transition-all ${
                          isToday && !disabled ? 'bg-[#006c49]/10 text-[#006c49] hover:bg-[#006c49]/20'
                            : disabled ? 'text-[#c4c7c7] cursor-not-allowed'
                            : 'text-[#1b1c1b] hover:bg-[#eae8e7]'
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${selectedDate ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {selectedDate && (
                  <div>
                    <button
                      onClick={() => { setSelectedDate(null); setSelectedTime(null) }}
                      className="flex items-center gap-3 mb-5 px-4 py-2.5 rounded-full bg-[#006c49]/8 hover:bg-[#006c49]/15 transition-colors group"
                    >
                      <ChevronLeft className="h-4 w-4 text-[#006c49] group-hover:-translate-x-0.5 transition-transform" />
                      <Calendar className="h-4 w-4 text-[#006c49]" />
                      <span className="text-sm font-bold text-[#006c49]">
                        {selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                      <span className="text-xs text-[#006c49]/60 font-medium">— {lang === 'fr' ? 'Changer de date' : 'Change date'}</span>
                    </button>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-3">{lang === 'fr' ? 'Créneaux disponibles' : 'Available slots'}</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {availableTimesForDate.map(slot => (
                        <button
                          key={slot.time}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`py-2.5 px-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                            selectedTime === slot.time
                              ? 'bg-[#1b1c1b] text-white shadow-lg'
                              : 'border border-[#c4c7c7]/30 text-[#1b1c1b] hover:border-[#006c49]'
                          }`}
                        >
                          {slot.time}
                          {selectedTime === slot.time && <CheckCircle2 className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                    {availableTimesForDate.length === 0 && (
                      <p className="text-xs text-[#444748]/40 mt-2">{lang === 'fr' ? 'Aucun créneau disponible ce jour.' : 'No slots available for this day.'}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm button */}
              {selectedDate && selectedTime && (
                <button
                  onClick={handleReschedule}
                  disabled={rescheduling}
                  className="w-full mt-8 py-4 rounded-full bg-[#006c49] text-white font-bold text-sm hover:bg-[#005a3d] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {rescheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {lang === 'fr' ? 'Confirmer le nouveau créneau' : 'Confirm new time slot'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
