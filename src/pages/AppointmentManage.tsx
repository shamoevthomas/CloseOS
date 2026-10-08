import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle, Calendar, ChevronLeft, ChevronRight, Clock, AlertTriangle, CreditCard, X } from 'lucide-react'
import { fromUTC } from '../lib/timezone'
import {
  DoodleSquiggle, DoodleBubble, DoodleFace, DoodlePlane, DoodleSparkle, DoodleCross,
  DoodleStar5, DoodleCheck, DoodleClock, DoodleZigzag,
} from '../components/doodles'

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
  // Liens inutilisables 24 h après la fin du rendez-vous
  expired: boolean
  // Fourni seulement via le lien d'annulation, pour « reporter plutôt »
  reschedule_token: string | null
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
  // Sans ?action=, le type de jeton décide de la vue
  const view = actionParam || info?.token_type || 'reschedule'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cancel state
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [requestRefund, setRequestRefund] = useState(false)
  const [refundAmount, setRefundAmount] = useState(0)
  const [refundPercent, setRefundPercent] = useState(0)
  const [showRescheduleOffer, setShowRescheduleOffer] = useState(false)
  const [expired, setExpired] = useState(false)

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
        else if (data.expired) setExpired(true)
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
    if (view !== 'reschedule' || !info || info.expired) return
    const slug = info.campaign_slug || info.booking_slug
    if (!slug) { setNoSlotsSource(true); return }
    const action = info.campaign_slug ? 'capture-slots' : 'booking-info'
    setSlotsLoading(true)
    fetch(`${API_URL}?action=${action}&slug=${slug}${info.campaign_slug ? '&reschedule=true' : ''}`)
      .then(r => r.json())
      .then(data => setSlots(data.slots || []))
      .catch(() => {})
      .finally(() => setSlotsLoading(false))
  }, [info?.campaign_slug, info?.booking_slug, info?.expired, view])

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
      if (data.expired) { setExpired(true); setShowRescheduleOffer(false) }
      else if (data.cancelled || data.already) setCancelled(true)
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
      if (data.expired) { setExpired(true); return }
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

  // « Reporter plutôt » : seulement si un jeton de report et une source de créneaux existent
  const canOfferReschedule = !!(info?.reschedule_token && (info.campaign_slug || info.booking_slug))

  if (loading || reschedulePaymentProcessing) {
    return (
      <PageShell>
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-[#111111] animate-spin mx-auto mb-4" />
          {reschedulePaymentProcessing && (
            <p className="text-sm text-stone-500">{lang === 'fr' ? 'Vérification du paiement...' : 'Verifying payment...'}</p>
          )}
        </div>
      </PageShell>
    )
  }

  if (error || !info) {
    return (
      <PageShell>
        <Card className="text-center">
          <Illustration tone="stone">
            <DoodleFace className="w-12 text-neutral-800/80" />
          </Illustration>
          <Title>{lang === 'fr' ? 'Rendez-vous introuvable' : 'Appointment not found'}</Title>
          <p className="text-stone-500">{lang === 'fr' ? "Ce lien n'est plus valide ou le rendez-vous n'existe pas." : "This link is no longer valid or the appointment doesn't exist."}</p>
        </Card>
      </PageShell>
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

  const recap = (
    <div className="rounded-2xl bg-[#f4f2f1] border border-stone-200/70 p-5 md:p-6 text-left">
      {info.title && <p className="font-bold text-[#111111] mb-3 leading-snug">{info.title}</p>}
      <div className="flex items-center gap-3 mb-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-stone-200">
          <Calendar className="h-4 w-4 text-emerald-600" />
        </span>
        <span className="font-semibold text-[#111111] capitalize">{dateFr}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-stone-200">
          <Clock className="h-4 w-4 text-emerald-600" />
        </span>
        <span className="font-semibold text-[#111111]">{timeHHMM} — {endTimeStr} <span className="text-stone-400 font-medium">({info.duration} min)</span></span>
      </div>
      {info.assignee_name && (
        <p className="text-sm text-stone-500 mt-4 pt-4 border-t border-stone-200/80">{lang === 'fr' ? 'Avec' : 'With'} <span className="font-semibold text-[#111111]">{info.assignee_name}</span></p>
      )}
    </div>
  )

  // Success states
  if (cancelled) {
    return (
      <PageShell>
        <Card className="text-center">
          <Illustration tone="stone">
            <DoodleBubble className="w-12 text-neutral-800/80" />
          </Illustration>
          <Title>{lang === 'fr' ? 'Rendez-vous annulé' : 'Appointment cancelled'}</Title>
          <p className="text-stone-600 mb-6">{lang === 'fr' ? `Votre rendez-vous du ${dateFr} à ${timeHHMM} a été annulé.` : `Your appointment on ${dateFr} at ${timeHHMM} has been cancelled.`}</p>
          <p className="text-sm text-stone-400">{lang === 'fr' ? "L'équipe a été notifiée de cette annulation." : 'The team has been notified of this cancellation.'}</p>
        </Card>
      </PageShell>
    )
  }

  if (rescheduled) {
    const newDateFr = selectedDate
      ? selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : null
    return (
      <PageShell>
        <Card className="text-center">
          <Illustration tone="emerald">
            <DoodleCheck className="w-11 text-emerald-600" />
          </Illustration>
          <Title squiggle>{lang === 'fr' ? 'Rendez-vous reprogrammé' : 'Appointment rescheduled'}</Title>
          {newDateFr && (
            <div className="rounded-2xl bg-[#f4f2f1] border border-stone-200/70 p-5 my-6">
              <p className="font-bold text-[#111111] capitalize">{newDateFr}</p>
              <p className="text-sm text-stone-500 mt-1">{selectedTime}</p>
            </div>
          )}
          <p className="text-sm text-stone-400">{lang === 'fr' ? 'Un email de confirmation vous a été envoyé.' : 'A confirmation email has been sent to you.'}</p>
        </Card>
      </PageShell>
    )
  }

  // Lien expiré : plus d'annulation ni de report 24 h après le rendez-vous
  if (expired) {
    return (
      <PageShell>
        <Card className="text-center">
          <Illustration tone="stone">
            <DoodleClock className="w-12 text-neutral-800/80" />
          </Illustration>
          <Title>{lang === 'fr' ? 'Ce lien a expiré' : 'This link has expired'}</Title>
          <p className="text-stone-600 mb-6">
            {lang === 'fr'
              ? "Ce rendez-vous est passé : il n'est plus possible de l'annuler ni de le reprogrammer."
              : 'This appointment is in the past: it can no longer be cancelled or rescheduled.'}
          </p>
          {recap}
          <p className="text-sm text-stone-400 mt-6">
            {lang === 'fr' ? 'Besoin d’un nouveau créneau ? Contactez directement votre interlocuteur.' : 'Need a new slot? Contact your representative directly.'}
          </p>
        </Card>
      </PageShell>
    )
  }

  const currencyOf = (c: string) => CURRENCY_SYMBOLS[c] || c.toUpperCase()

  // Cancel view
  if (view === 'cancel') {
    return (
      <PageShell>
        <Card>
          <div className="text-center">
            <Illustration tone="red">
              <DoodleCross className="w-8 text-[#ff2f2f] rotate-45" />
            </Illustration>
            <Title>{lang === 'fr' ? 'Annuler votre rendez-vous ?' : 'Cancel your appointment?'}</Title>
            <p className="text-stone-500 mb-8">{lang === 'fr' ? 'Cette action est irréversible.' : 'This action is irreversible.'}</p>
          </div>

          <div className="mb-8">{recap}</div>

          {/* Refund option */}
          {info.stripe_payment_status === 'paid' && info.refund_enabled && refundPercent > 0 && (
            <div className="rounded-2xl bg-[#635bff]/5 border border-[#635bff]/15 p-5 mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#635bff]" />
                  <span className="text-sm font-bold text-[#111111]">
                    {lang === 'fr' ? 'Demander un remboursement' : 'Request a refund'}
                  </span>
                </div>
                <button onClick={() => setRequestRefund(!requestRefund)} className="relative" aria-pressed={requestRefund}>
                  <div className={`w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors ${requestRefund ? 'bg-[#635bff]/20' : 'bg-stone-200'}`}>
                    <div className={`w-3 h-3 rounded-full absolute transition-all ${requestRefund ? 'bg-[#635bff] right-1' : 'bg-stone-500 left-1'}`} />
                  </div>
                </button>
              </div>
              {requestRefund && (
                <div className="text-xs text-stone-600 space-y-1">
                  <p>{lang === 'fr' ? `Remboursement de ${refundPercent}%` : `${refundPercent}% refund`} → <span className="font-bold text-[#635bff]">{(refundAmount / 100).toFixed(2)} {currencyOf(info.stripe_currency)}</span></p>
                  <p className="text-stone-400">{lang === 'fr' ? `sur ${(info.stripe_amount_paid / 100).toFixed(2)} ${currencyOf(info.stripe_currency)} payé` : `out of ${(info.stripe_amount_paid / 100).toFixed(2)} ${currencyOf(info.stripe_currency)} paid`}</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => (canOfferReschedule ? setShowRescheduleOffer(true) : handleCancel())}
            disabled={cancelling}
            className="w-full h-14 rounded-xl bg-white border-2 border-[#ff2f2f]/25 text-[#d91f1f] font-semibold hover:bg-red-50 hover:border-[#ff2f2f]/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            {lang === 'fr' ? 'Annuler le rendez-vous' : 'Cancel the appointment'}
          </button>
        </Card>

        {/* Pop-up « pourquoi pas reporter ? » */}
        {showRescheduleOffer && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[#111111]/40 backdrop-blur-sm appt-fade"
            onClick={() => !cancelling && setShowRescheduleOffer(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reschedule-offer-title"
          >
            <div
              className="relative w-full max-w-md bg-white rounded-[28px] p-8 shadow-2xl text-center appt-rise overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowRescheduleOffer(false)}
                disabled={cancelling}
                className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-[#111111] hover:bg-stone-100 transition-colors"
                aria-label={lang === 'fr' ? 'Fermer' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
              <DoodleSparkle className="pointer-events-none absolute left-6 top-8 w-5 text-emerald-500" />
              <DoodleStar5 className="pointer-events-none absolute right-12 top-20 w-4 text-emerald-500" />

              <Illustration tone="emerald">
                <DoodleClock className="w-12 text-emerald-600 appt-wiggle" />
              </Illustration>
              <h2 id="reschedule-offer-title" className="text-2xl font-extrabold text-[#111111] tracking-tight mb-2 leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {lang === 'fr' ? 'Pourquoi pas reporter le rendez-vous plutôt ?' : 'Why not reschedule instead?'}
              </h2>
              <p className="text-stone-500 mb-7">
                {lang === 'fr'
                  ? 'Un imprévu ? Choisissez un autre créneau en quelques secondes, sans tout reprendre à zéro.'
                  : 'Something came up? Pick another slot in seconds instead of starting over.'}
              </p>

              <button
                onClick={() => { window.location.href = `/appointment/${info.reschedule_token}?action=reschedule` }}
                disabled={cancelling}
                className="w-full h-14 rounded-xl bg-[#111111] text-white font-semibold shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {lang === 'fr' ? 'Reporter le rendez-vous' : 'Reschedule the appointment'}
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full mt-3 h-12 rounded-xl text-sm font-semibold text-stone-500 hover:text-[#d91f1f] hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === 'fr' ? 'Non, je veux l’annuler' : 'No, I want to cancel'}
              </button>
            </div>
          </div>
        )}
      </PageShell>
    )
  }

  // Reschedule view
  return (
    <PageShell wide>
      <Card>
        <div className="flex items-start gap-4 mb-6">
          <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100">
            <DoodleClock className="w-9 text-emerald-600" />
          </div>
          <div>
            <h1 className="relative inline-block text-2xl md:text-3xl font-extrabold text-[#111111] tracking-tight mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {lang === 'fr' ? 'Reprogrammer votre rendez-vous' : 'Reschedule your appointment'}
            </h1>
            <p className="text-stone-500">{lang === 'fr' ? 'Choisissez un nouveau créneau, on s’occupe du reste.' : 'Pick a new slot, we take care of the rest.'}</p>
          </div>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-2">{lang === 'fr' ? 'Rendez-vous actuel' : 'Current appointment'}</p>
        <div className="mb-8">{recap}</div>

        <h2 className="relative inline-block text-lg font-extrabold text-[#111111] mb-8" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {lang === 'fr' ? 'Choisissez un nouveau créneau' : 'Choose a new time slot'}
          <DoodleSquiggle className="pointer-events-none absolute left-0 -bottom-4 w-40 text-emerald-500" />
        </h2>

        {noSlotsSource ? (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-amber-800">{lang === 'fr' ? 'Reprogrammation indisponible' : 'Rescheduling unavailable'}</p>
            <p className="text-xs text-amber-600 mt-1">{lang === 'fr' ? 'Veuillez contacter directement votre interlocuteur pour reprogrammer ce rendez-vous.' : 'Please contact your representative directly to reschedule this appointment.'}</p>
          </div>
        ) : slotsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 text-[#111111] animate-spin" />
          </div>
        ) : (
          <div>
            {/* Calendar */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${selectedDate ? 'max-h-0 opacity-0' : 'max-h-[520px] opacity-100'}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-lg font-bold text-[#111111]">{MONTHS[calMonth]} {calYear}</span>
                <div className="flex gap-1">
                  <button onClick={prevMonth} className="p-2 hover:bg-[#f4f2f1] rounded-full transition-colors" aria-label={lang === 'fr' ? 'Mois précédent' : 'Previous month'}>
                    <ChevronLeft className="h-5 w-5 text-[#111111]" />
                  </button>
                  <button onClick={nextMonth} className="p-2 hover:bg-[#f4f2f1] rounded-full transition-colors" aria-label={lang === 'fr' ? 'Mois suivant' : 'Next month'}>
                    <ChevronRight className="h-5 w-5 text-[#111111]" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {DAYS.map((d, i) => (
                  <div key={i} className="py-1 text-[10px] font-bold text-stone-400 uppercase tracking-widest">{d}</div>
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
                      className={`relative aspect-square max-h-12 w-full rounded-xl text-sm font-semibold transition-all ${
                        disabled ? 'text-stone-300 cursor-not-allowed'
                          : isToday ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-[#f4f2f1] text-[#111111] hover:bg-[#111111] hover:text-white'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time slots */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${selectedDate ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {selectedDate && (
                <div>
                  <button
                    onClick={() => { setSelectedDate(null); setSelectedTime(null) }}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-5 px-4 py-2.5 rounded-xl bg-[#f4f2f1] border border-stone-200 hover:border-stone-300 transition-colors group text-left"
                  >
                    <ChevronLeft className="h-4 w-4 text-[#111111] group-hover:-translate-x-0.5 transition-transform" />
                    <Calendar className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-bold text-[#111111] capitalize">
                      {selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    <span className="text-xs text-stone-400 font-medium">— {lang === 'fr' ? 'Changer de date' : 'Change date'}</span>
                  </button>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">{lang === 'fr' ? 'Créneaux disponibles' : 'Available slots'}</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {availableTimesForDate.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`h-11 px-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                          selectedTime === slot.time
                            ? 'bg-[#111111] text-white shadow-lg -translate-y-0.5'
                            : 'bg-white border border-stone-200 text-[#111111] hover:border-[#111111]'
                        }`}
                      >
                        {slot.time}
                        {selectedTime === slot.time && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                  {availableTimesForDate.length === 0 && (
                    <p className="text-xs text-stone-400 mt-2">{lang === 'fr' ? 'Aucun créneau disponible ce jour.' : 'No slots available for this day.'}</p>
                  )}
                </div>
              )}
            </div>

            {/* Reschedule fee + Confirm button */}
            {selectedDate && selectedTime && (
              <div className="appt-rise">
                {info.reschedule_paid && info.reschedule_price > 0 && (
                  <div className="mt-6 rounded-2xl bg-[#635bff]/5 border border-[#635bff]/15 p-4 flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-[#635bff] shrink-0" />
                    <p className="text-xs text-stone-600">
                      {lang === 'fr' ? 'Frais de reprogrammation :' : 'Rescheduling fee:'}{' '}
                      <span className="font-bold text-[#635bff]">
                        {(info.reschedule_price / 100).toFixed(2)} {currencyOf(info.reschedule_currency)}
                      </span>
                    </p>
                  </div>
                )}
                <button
                  onClick={handleReschedule}
                  disabled={rescheduling}
                  className="w-full mt-6 h-14 rounded-xl bg-[#111111] text-white font-semibold shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {rescheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {lang === 'fr' ? 'Confirmer le nouveau créneau' : 'Confirm new time slot'}
                </button>
              </div>
            )}
          </div>
        )}
      </Card>
    </PageShell>
  )
}

/* ─── Habillage façon LP Business : fond crème, blobs flous, doodles ─── */

function PageShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f2f1] text-[#111111] font-sans selection:bg-[#8a43e1]/20">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[520px] opacity-25" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#ff2f2f] rounded-full filter blur-[100px] animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-[#ef7b16] rounded-full filter blur-[100px] animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/3 w-64 h-64 bg-[#8a43e1] rounded-full filter blur-[100px] animate-blob animation-delay-4000" />
      </div>

      <div className="pointer-events-none select-none absolute inset-0 hidden md:block" aria-hidden="true">
        <DoodleBubble className="absolute left-[7%] top-[18%] w-16 text-neutral-800/60 -rotate-6" />
        <DoodleSparkle className="absolute left-[14%] top-[9%] w-6 text-emerald-500" />
        <DoodleClock className="absolute left-[9%] top-[62%] w-14 text-emerald-500 -rotate-6" />
        <DoodleCross className="absolute left-[16%] top-[82%] w-4 text-emerald-500" />
        <DoodleFace className="absolute right-[8%] top-[22%] w-14 text-neutral-800/60 rotate-6" />
        <DoodleStar5 className="absolute right-[15%] top-[10%] w-5 text-emerald-500" />
        <DoodlePlane className="absolute right-[7%] top-[60%] w-24 text-emerald-500" />
        <DoodleZigzag className="absolute right-[14%] top-[84%] w-12 text-stone-300" />
      </div>

      <div className={`relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10 md:py-16 mx-auto w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        {children}
      </div>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`appt-rise w-full bg-white rounded-[28px] border border-stone-200/70 p-7 sm:p-10 shadow-[0_24px_60px_-24px_rgba(17,17,17,0.22)] ${className}`}>
      {children}
    </div>
  )
}

const ILLUSTRATION_TONES = {
  emerald: 'bg-emerald-50 border-emerald-100',
  red: 'bg-red-50 border-red-100',
  stone: 'bg-[#f4f2f1] border-stone-200',
} as const

function Illustration({ children, tone }: { children: React.ReactNode; tone: keyof typeof ILLUSTRATION_TONES }) {
  return (
    <div className="relative mx-auto mb-6 w-fit">
      <div className={`flex h-20 w-20 items-center justify-center rounded-[22px] border-2 -rotate-3 ${ILLUSTRATION_TONES[tone]}`}>
        {children}
      </div>
      <DoodleSparkle className="pointer-events-none absolute -right-4 -top-3 w-5 text-emerald-500" />
    </div>
  )
}

function Title({ children, squiggle = false }: { children: React.ReactNode; squiggle?: boolean }) {
  return (
    <h1 className="relative inline-block text-2xl md:text-3xl font-extrabold text-[#111111] tracking-tight mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
      {children}
      {squiggle && <DoodleSquiggle className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-3 w-40 text-emerald-500" />}
    </h1>
  )
}
