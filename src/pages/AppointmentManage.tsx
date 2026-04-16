import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle, Calendar, ChevronLeft, ChevronRight, Clock, AlertTriangle, CreditCard } from 'lucide-react'
import { fromUTC } from '../lib/timezone'

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
  title: string | null
  prospect_name: string
  prospect_email: string
  assignee_name: string | null
  campaign_slug: string | null
  booking_slug: string | null
  user_id: string | null
  assigned_to: string | null
  token_type: 'cancel' | 'reschedule'
  // Stripe payment info
  stripe_payment_status: string | null
  stripe_amount_paid: number
  stripe_currency: string
  // Campaign config
  refund_enabled: boolean
  refund_tiers: { days: number; percent: number }[]
  reschedule_enabled: boolean
  reschedule_paid: boolean
  reschedule_price: number
  reschedule_currency: string
}

const CURRENCY_SYMBOLS: Record<string, string> = { eur: '€', usd: '$', gbp: '£' }

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
  const [requestRefund, setRequestRefund] = useState(false)
  const [refundAmount, setRefundAmount] = useState(0)
  const [refundPercent, setRefundPercent] = useState(0)

  // Reschedule state
  const [slots, setSlots] = useState<{ date: string; time: string; member_ids: string[]; datetime_utc: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduled, setRescheduled] = useState(false)
  const [reschedulePaymentProcessing, setReschedulePaymentProcessing] = useState(false)

  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())
  const prospectTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

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

  // Compute refund info when appointment info loads
  useEffect(() => {
    if (!info || !info.refund_enabled || !info.stripe_payment_status || info.stripe_payment_status !== 'paid') return
    const tiers = info.refund_tiers || []
    if (tiers.length === 0) return
    const apptDateTime = new Date(`${info.date}T${info.time?.slice(0, 5) || '00:00'}:00`)
    const now = new Date()
    const daysUntil = Math.floor((apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    // Find the best matching tier (tier with the smallest days that is still >= daysUntil)
    const sorted = [...tiers].sort((a, b) => a.days - b.days)
    let matchedTier: { days: number; percent: number } | null = null
    for (const tier of sorted) {
      if (daysUntil >= tier.days) matchedTier = tier
    }
    if (matchedTier) {
      setRefundPercent(matchedTier.percent)
      setRefundAmount(Math.round(info.stripe_amount_paid * matchedTier.percent / 100))
      setRequestRefund(true)
    }
  }, [info])

  // Handle reschedule payment return
  useEffect(() => {
    const paymentSuccess = searchParams.get('payment_success')
    const sessionId = searchParams.get('session_id')
    if (paymentSuccess === 'true' && sessionId && actionParam === 'reschedule') {
      setReschedulePaymentProcessing(true)
      // Verify payment, then reschedule
      fetch(`${API_URL}?action=campaign-payment-success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setRescheduled(true)
          }
        })
        .catch(() => {})
        .finally(() => setReschedulePaymentProcessing(false))
    }
  }, [searchParams, actionParam])

  // Fetch available slots for reschedule
  const [noSlotsSource, setNoSlotsSource] = useState(false)
  useEffect(() => {
    if (actionParam !== 'reschedule' || !info) return
    const slug = info.campaign_slug || info.booking_slug
    if (!slug) { setNoSlotsSource(true); return }
    const action = info.campaign_slug ? 'capture-slots' : 'booking-info'
    setSlotsLoading(true)
    fetch(`${API_URL}?action=${action}&slug=${slug}${info.campaign_slug ? '&reschedule=true' : ''}`)
      .then(r => r.json())
      .then(data => setSlots(data.slots || []))
      .catch(() => {})
      .finally(() => setSlotsLoading(false))
  }, [info?.campaign_slug, info?.booking_slug, actionParam])

  // Convert slots from UTC to prospect's local timezone
  const convertedSlots = useMemo(() => {
    return slots.map(slot => {
      if (!slot.datetime_utc) return slot
      const local = fromUTC(slot.datetime_utc, prospectTimezone)
      return { ...slot, date: local.date, time: local.time }
    })
  }, [slots, prospectTimezone])

  const handleCancel = async () => {
    if (!token || cancelling) return
    setCancelling(true)
    try {
      const body: any = { token }
      if (requestRefund && info?.stripe_payment_status === 'paid') body.request_refund = true
      const res = await fetch(`${API_URL}?action=appointment-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
      const matchingSlot = convertedSlots.find(s => s.date === dateStr && s.time === selectedTime)
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
      // If paid reschedule required, redirect to Stripe Checkout
      if (data.requires_payment) {
        const checkoutRes = await fetch('/api/campaign-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_id: null,
            appointment_id: info?.id,
            payment_type: 'reschedule',
            amount: info?.reschedule_price,
            currency: info?.reschedule_currency || 'eur',
            success_url: `${window.location.origin}/appointment/${token}?action=reschedule&payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/appointment/${token}?action=reschedule&payment_cancelled=true`,
          })
        })
        const checkoutData = await checkoutRes.json()
        if (checkoutData.url) {
          window.location.href = checkoutData.url
          return
        }
      }
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
    for (const s of convertedSlots) set.add(s.date)
    return set
  }, [convertedSlots])

  const availableTimesForDate = useMemo(() => {
    if (!selectedDate) return []
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    return convertedSlots.filter(s => s.date === dateStr)
  }, [selectedDate, convertedSlots])

  const prevMonth = useCallback(() => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }, [calMonth])
  const nextMonth = useCallback(() => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }, [calMonth])

  if (loading || reschedulePaymentProcessing) {
    return (
      <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-[#006c49] animate-spin mx-auto mb-4" />
          {reschedulePaymentProcessing && (
            <p className="text-sm text-[#444748]">{lang === 'fr' ? 'Vérification du paiement...' : 'Verifying payment...'}</p>
          )}
        </div>
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

  // Format date — time may be HH:MM or HH:MM:SS, normalize to HH:MM
  const timeHHMM = info.time?.slice(0, 5) || '00:00'
  const apptDate = new Date(`${info.date}T${timeHHMM}:00`)
  const dateFr = !isNaN(apptDate.getTime())
    ? apptDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : info.date
  const [eH, eM] = timeHHMM.split(':').map(Number)
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
          <p className="text-[#444748] mb-6">{lang === 'fr' ? `Votre rendez-vous du ${dateFr} à ${timeHHMM} a été annulé.` : `Your appointment on ${dateFr} at ${timeHHMM} has been cancelled.`}</p>
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
              {info.title && (
                <p className="font-bold text-[#1b1c1b] mb-3">{info.title}</p>
              )}
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="h-5 w-5 text-[#006c49]" />
                <span className="font-bold text-[#1b1c1b] capitalize">{dateFr}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-[#006c49]" />
                <span className="font-bold text-[#1b1c1b]">{timeHHMM} — {endTimeStr} ({info.duration} min)</span>
              </div>
              {info.assignee_name && (
                <p className="text-sm text-[#444748] mt-3">{lang === 'fr' ? 'Avec' : 'With'} {info.assignee_name}</p>
              )}
            </div>

            {/* Refund option */}
            {info.stripe_payment_status === 'paid' && info.refund_enabled && refundPercent > 0 && (
              <div className="rounded-2xl bg-[#635bff]/5 p-5 mb-8">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[#635bff]" />
                    <span className="text-sm font-bold text-[#1b1c1b]">
                      {lang === 'fr' ? 'Demander un remboursement' : 'Request a refund'}
                    </span>
                  </div>
                  <button onClick={() => setRequestRefund(!requestRefund)} className="relative">
                    <div className={`w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors ${requestRefund ? 'bg-[#635bff]/20' : 'bg-[#eae8e7]'}`}>
                      <div className={`w-3 h-3 rounded-full absolute transition-all ${requestRefund ? 'bg-[#635bff] right-1' : 'bg-[#747878] left-1'}`} />
                    </div>
                  </button>
                </div>
                {requestRefund && (
                  <div className="text-xs text-[#444748] space-y-1">
                    <p>{lang === 'fr' ? `Remboursement de ${refundPercent}%` : `${refundPercent}% refund`} → <span className="font-bold text-[#635bff]">{(refundAmount / 100).toFixed(2)} {CURRENCY_SYMBOLS[info.stripe_currency] || info.stripe_currency.toUpperCase()}</span></p>
                    <p className="text-[#444748]/60">{lang === 'fr' ? `sur ${(info.stripe_amount_paid / 100).toFixed(2)} ${CURRENCY_SYMBOLS[info.stripe_currency] || info.stripe_currency.toUpperCase()} payé` : `out of ${(info.stripe_amount_paid / 100).toFixed(2)} ${CURRENCY_SYMBOLS[info.stripe_currency] || info.stripe_currency.toUpperCase()} paid`}</p>
                  </div>
                )}
              </div>
            )}

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
              {info.title && <p className="font-bold text-[#1b1c1b] mb-0.5">{info.title}</p>}
              <p className={`font-bold text-[#1b1c1b] capitalize ${info.title ? 'text-sm font-medium' : ''}`}>{dateFr}</p>
              <p className="text-sm text-[#444748]">{timeHHMM} — {endTimeStr}</p>
              {info.assignee_name && <p className="text-xs text-[#444748]/60 mt-1">{lang === 'fr' ? 'Avec' : 'With'} {info.assignee_name}</p>}
            </div>
          </div>

          <h2 className="text-lg font-extrabold text-[#1b1c1b] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {lang === 'fr' ? 'Choisissez un nouveau créneau' : 'Choose a new time slot'}
          </h2>

          {noSlotsSource ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-amber-800">{lang === 'fr' ? 'Reprogrammation indisponible' : 'Rescheduling unavailable'}</p>
              <p className="text-xs text-amber-600 mt-1">{lang === 'fr' ? 'Veuillez contacter directement votre interlocuteur pour reprogrammer ce rendez-vous.' : 'Please contact your representative directly to reschedule this appointment.'}</p>
            </div>
          ) : slotsLoading ? (
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

              {/* Reschedule fee + Confirm button */}
              {selectedDate && selectedTime && (
                <>
                  {info.reschedule_paid && info.reschedule_price > 0 && (
                    <div className="mt-6 rounded-2xl bg-[#635bff]/5 p-4 flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-[#635bff] shrink-0" />
                      <p className="text-xs text-[#444748]">
                        {lang === 'fr' ? 'Frais de reprogrammation :' : 'Rescheduling fee:'}{' '}
                        <span className="font-bold text-[#635bff]">
                          {(info.reschedule_price / 100).toFixed(2)} {CURRENCY_SYMBOLS[info.reschedule_currency] || info.reschedule_currency.toUpperCase()}
                        </span>
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handleReschedule}
                    disabled={rescheduling}
                    className="w-full mt-4 py-4 rounded-full bg-[#006c49] text-white font-bold text-sm hover:bg-[#005a3d] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ fontFamily: 'Manrope, sans-serif' }}
                  >
                    {rescheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {lang === 'fr' ? 'Confirmer le nouveau créneau' : 'Confirm new time slot'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
