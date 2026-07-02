import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Clock, Calendar, ChevronLeft, ChevronRight, CheckCircle2, User, Mail, Phone, Globe, ArrowRight, Hash, List, Type, ChevronDown, Lock, X, Plus, CalendarPlus } from 'lucide-react'
import { toUTC, fromUTC, getTimezoneLabel } from '../lib/timezone'
import { supabase } from '../lib/supabase'
import { InlineStripePaymentModal } from '../components/InlineStripePayment'
import { computeVisibleQuestionIds, type ConditionalRule } from '../lib/questionnaireConditions'

interface SlotData { date: string; time: string; datetime_utc?: string }
interface CustomField {
  label: string
  type: 'text' | 'email' | 'phone' | 'number' | 'select'
  required: boolean
  options?: string[]
}

interface BookingQuestion {
  client_id: string
  question_text: string
  question_type: 'text' | 'select' | 'multiple_choice' | 'number'
  is_required: boolean
  options: string[]
  sort_order: number
  conditional?: ConditionalRule | null
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
  questionnaireEnabled: boolean
  questionnaireRequired: boolean
  questionnaireQuestions: BookingQuestion[]
  multiBookingEnabled: boolean
  multiBookingMax: number
  multiBookingPeriod: 'week' | 'month'
  multiBookingMaxPerPeriod: number
  multiBookingGapDays: number
  slots?: SlotData[]
  stripe: { enabled: true; price: number; currency: string } | null
}

interface CreatorInfo {
  name: string
  avatarUrl: string | null
}

const API_URL = '/api/business'

const PHONE_FORMATS: Record<string, { maxDigits: number; groups: number[] }> = {
  '+33': { maxDigits: 9, groups: [1, 2, 2, 2, 2] },
  '+32': { maxDigits: 9, groups: [3, 2, 2, 2] },
  '+41': { maxDigits: 9, groups: [2, 3, 2, 2] },
  '+352': { maxDigits: 9, groups: [3, 3, 3] },
  '+377': { maxDigits: 8, groups: [2, 2, 2, 2] },
  '+1': { maxDigits: 10, groups: [3, 3, 4] },
  '+44': { maxDigits: 10, groups: [4, 3, 3] },
  '+49': { maxDigits: 11, groups: [3, 4, 4] },
  '+34': { maxDigits: 9, groups: [3, 3, 3] },
  '+39': { maxDigits: 10, groups: [3, 3, 4] },
  '+351': { maxDigits: 9, groups: [3, 3, 3] },
  '+31': { maxDigits: 9, groups: [1, 2, 2, 2, 2] },
  '+212': { maxDigits: 9, groups: [3, 3, 3] },
  '+216': { maxDigits: 8, groups: [2, 3, 3] },
  '+213': { maxDigits: 9, groups: [3, 3, 3] },
}

function formatPhoneByCountry(raw: string, code: string): string {
  const digits = raw.replace(/\D/g, '')
  const fmt = PHONE_FORMATS[code]
  if (!fmt) return digits.slice(0, 15)
  const limited = digits.slice(0, fmt.maxDigits)
  const parts: string[] = []
  let idx = 0
  for (const g of fmt.groups) {
    if (idx >= limited.length) break
    parts.push(limited.slice(idx, idx + g))
    idx += g
  }
  return parts.join(' ')
}

const COUNTRY_CODES = [
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: '+377', flag: '🇲🇨', name: 'Monaco' },
  { code: '+1', flag: '🇺🇸', name: 'États-Unis' },
  { code: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: '+49', flag: '🇩🇪', name: 'Allemagne' },
  { code: '+34', flag: '🇪🇸', name: 'Espagne' },
  { code: '+39', flag: '🇮🇹', name: 'Italie' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+31', flag: '🇳🇱', name: 'Pays-Bas' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: '+213', flag: '🇩🇿', name: 'Algérie' },
]

const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const getMonthDates = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1)
  const startDay = firstDay.getDay()
  // startOffset is relative to the 1st of the month (0 when the 1st is a Monday),
  // so the absolute day passed to Date must be 1 + startOffset (day is 1-based).
  const startOffset = startDay === 0 ? -6 : 1 - startDay
  const start = new Date(year, month, 1 + startOffset)
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
  const [searchParams] = useSearchParams()
  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+33')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const countryPickerRef = useRef<HTMLDivElement>(null)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string | string[]>>({})
  const [step, setStep] = useState<'form' | 'questionnaire' | 'calendar' | 'confirm'>('form')

  // Calendar
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  // Multi-booking: list of slots the prospect wants to reserve in one go
  const [selectedSlots, setSelectedSlots] = useState<SlotData[]>([])

  // Prospect timezone
  const prospectTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  // Creator info
  const [creator, setCreator] = useState<CreatorInfo | null>(null)

  // Link metadata for direct Supabase submit
  const [linkMeta, setLinkMeta] = useState<{ business_owner_id: string; team_member_id: string | null; duration: number } | null>(null)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [inlinePayment, setInlinePayment] = useState<{ client_secret: string; payment_intent_id: string } | null>(null)
  const [paidAppointment, setPaidAppointment] = useState<{ date: string; time: string; amount: number; currency: string } | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`${API_URL}?action=booking-info&slug=${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(async (d) => {
        // Compléter avec données Supabase (description, redirect, creator)
        const { data: link } = await supabase
          .from('business_booking_links')
          .select('description, redirect_url, business_owner_id, team_member_id, email_enabled, email_required, phone_enabled, phone_required, custom_fields, questionnaire_enabled, questionnaire_required, questionnaire_questions, stripe_enabled, stripe_price, stripe_currency, multi_booking_enabled, multi_booking_max, multi_booking_period, multi_booking_max_per_period, multi_booking_gap_days')
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
          d.questionnaireEnabled = link.questionnaire_enabled ?? false
          d.questionnaireRequired = link.questionnaire_required ?? false
          d.questionnaireQuestions = ((link.questionnaire_questions as BookingQuestion[]) || [])
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((q, i) => ({
              ...q,
              client_id: q.client_id || `legacy-${i}`,
              sort_order: i,
            }))
          d.stripe = (link.stripe_enabled && link.stripe_price > 0) ? {
            enabled: true,
            price: link.stripe_price,
            currency: link.stripe_currency || 'eur',
          } : (d.stripe || null)
          d.multiBookingEnabled = link.multi_booking_enabled ?? false
          d.multiBookingMax = link.multi_booking_max ?? 3
          d.multiBookingPeriod = (link.multi_booking_period as 'week' | 'month') ?? 'week'
          d.multiBookingMaxPerPeriod = link.multi_booking_max_per_period ?? 1
          d.multiBookingGapDays = link.multi_booking_gap_days ?? 0

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

  // Close country picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (countryPickerRef.current && !countryPickerRef.current.contains(e.target as Node)) {
        setShowCountryPicker(false)
        setCountrySearch('')
      }
    }
    if (showCountryPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCountryPicker])

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

  const hasQuestionnaire = !!(info?.questionnaireEnabled && info.questionnaireQuestions?.length > 0)

  // Multi-booking is only available on free links (incompatible with Stripe payment)
  const multiEnabled = !!info?.multiBookingEnabled && !info?.stripe
  const multiMax = info?.multiBookingMax || 3
  const multiPeriod: 'week' | 'month' = info?.multiBookingPeriod || 'week'
  const multiMaxPerPeriod = info?.multiBookingMaxPerPeriod || 1
  const multiGapDays = info?.multiBookingGapDays || 0

  const slotKey = (s: { date: string; time: string }) => `${s.date}T${s.time}`
  const isSlotSelected = (date: string, time: string) => selectedSlots.some(s => s.date === date && s.time === time)

  // Clé de période (semaine → lundi de la semaine ; mois → AAAA-MM) pour la limite « max par période ».
  const periodKeyOf = (dateStr: string) => {
    if (multiPeriod === 'month') return dateStr.slice(0, 7)
    const d = new Date(dateStr + 'T00:00:00')
    const offset = (d.getDay() + 6) % 7 // 0 = lundi
    d.setDate(d.getDate() - offset)
    return d.toISOString().slice(0, 10)
  }
  const dayDiff = (a: string, b: string) =>
    Math.abs(Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86400000))

  /** Le créneau (non encore sélectionné) respecte-t-il délai + max par période vis-à-vis de la sélection ? */
  const slotRespectsRules = (date: string): { ok: boolean; reason?: string } => {
    if (multiGapDays > 0) {
      const tooClose = selectedSlots.some(s => s.date !== date && dayDiff(s.date, date) < multiGapDays)
      if (tooClose) return { ok: false, reason: `Min. ${multiGapDays} jour${multiGapDays > 1 ? 's' : ''} entre 2 rendez-vous.` }
    }
    if (multiMaxPerPeriod > 0) {
      const pk = periodKeyOf(date)
      const countInPeriod = selectedSlots.filter(s => periodKeyOf(s.date) === pk).length
      if (countInPeriod >= multiMaxPerPeriod) {
        return { ok: false, reason: `Max. ${multiMaxPerPeriod} créneau${multiMaxPerPeriod > 1 ? 'x' : ''} par ${multiPeriod === 'month' ? 'mois' : 'semaine'}.` }
      }
    }
    return { ok: true }
  }

  const toggleSlot = (date: string, time: string) => {
    if (isSlotSelected(date, time)) {
      setSelectedSlots(prev => prev.filter(s => !(s.date === date && s.time === time)))
      return
    }
    if (selectedSlots.length >= multiMax) return
    if (!slotRespectsRules(date).ok) return
    const match = prospectSlots.find(s => s.date === date && s.time === time)
    setSelectedSlots(prev => [...prev, { date, time, datetime_utc: match?.datetime_utc }]
      .sort((a, b) => slotKey(a).localeCompare(slotKey(b))))
  }

  // Map client_id -> answer (answers state is keyed by question_text for backward compat with payload shape)
  const answersByClientId = useMemo(() => {
    const map: Record<string, unknown> = {}
    for (const q of info?.questionnaireQuestions || []) {
      if (q.client_id) map[q.client_id] = questionnaireAnswers[q.question_text]
    }
    return map
  }, [info?.questionnaireQuestions, questionnaireAnswers])

  const visibleQuestionIds = useMemo(() => {
    if (!info?.questionnaireQuestions) return new Set<string>()
    return computeVisibleQuestionIds(
      info.questionnaireQuestions.map((q, i) => ({
        client_id: q.client_id,
        question_type: q.question_type,
        sort_order: i,
        conditional: q.conditional ?? null,
      })),
      answersByClientId,
    )
  }, [info?.questionnaireQuestions, answersByClientId])

  // Clear answers for questions that became hidden (so reappearing starts fresh + nothing stale is submitted)
  useEffect(() => {
    if (!info?.questionnaireQuestions) return
    setQuestionnaireAnswers(prev => {
      let changed = false
      const next = { ...prev }
      for (const q of info.questionnaireQuestions) {
        if (!visibleQuestionIds.has(q.client_id) && next[q.question_text] !== undefined) {
          delete next[q.question_text]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [visibleQuestionIds, info?.questionnaireQuestions])

  const isQuestionnaireComplete = useMemo(() => {
    if (!info?.questionnaireQuestions) return true
    return info.questionnaireQuestions.every(q => {
      if (!visibleQuestionIds.has(q.client_id)) return true
      if (!q.is_required) return true
      const answer = questionnaireAnswers[q.question_text]
      if (!answer) return false
      if (Array.isArray(answer)) return answer.length > 0
      return answer.toString().trim() !== ''
    })
  }, [info?.questionnaireQuestions, questionnaireAnswers, visibleQuestionIds])

  const handleContactSubmit = () => {
    if (!name.trim()) return
    setStep(hasQuestionnaire ? 'questionnaire' : 'calendar')
  }

  // Handle 3DS redirect return from Stripe
  useEffect(() => {
    const piReturn = searchParams.get('payment_intent_return')
    const piParam = searchParams.get('payment_intent')
    const redirectStatus = searchParams.get('redirect_status')
    if (piReturn === 'true' && piParam && redirectStatus === 'succeeded') {
      const confirmWithRetry = async (attempts = 4): Promise<any> => {
        for (let i = 0; i < attempts; i++) {
          try {
            const r = await fetch(`${API_URL}?action=booking-confirm-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ payment_intent_id: piParam }),
            })
            const d = await r.json()
            if (d.success || d.already_completed) return d
          } catch { /* transient — retry */ }
          if (i < attempts - 1) await new Promise(res => setTimeout(res, (i + 1) * 1500))
        }
        return null
      }
      confirmWithRetry().then((data) => {
        if (data) {
          setDone(true)
          window.history.replaceState({}, '', window.location.pathname)
        }
      })
    }
  }, [searchParams])

  const handlePayAndBook = async () => {
    if (!selectedDate || !selectedTime || !slug || !linkMeta || !info?.stripe) return
    setSubmitting(true)
    try {
      const matchSlot = prospectSlots.find(s => s.date === selectedDate && s.time === selectedTime)
      const datetimeUtc = matchSlot?.datetime_utc || toUTC(selectedDate, selectedTime, prospectTimezone).toISOString()
      const fullPhone = phone.trim() ? `${countryCode} ${phone.trim()}` : ''
      const r = await fetch(`${API_URL}?action=booking-init-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, name, email, phone: fullPhone,
          custom_data: customFieldValues,
          date: selectedDate, time: selectedTime, datetime_utc: datetimeUtc,
          prospect_timezone: prospectTimezone,
          questionnaire_answers: hasQuestionnaire ? info.questionnaireQuestions.filter(q => visibleQuestionIds.has(q.client_id)).map(q => ({
            question_text: q.question_text,
            answer_value: questionnaireAnswers[q.question_text] || ''
          })).filter(a => Array.isArray(a.answer_value) ? a.answer_value.length > 0 : a.answer_value !== '') : null,
        }),
      })
      const data = await r.json()
      if (data.client_secret && data.payment_intent_id) {
        setInlinePayment({ client_secret: data.client_secret, payment_intent_id: data.payment_intent_id })
        setPaidAppointment({ date: selectedDate, time: selectedTime, amount: info.stripe.price, currency: info.stripe.currency })
      } else {
        alert(data.error || (lang === 'fr' ? 'Erreur lors du paiement' : 'Payment error'))
      }
    } catch {
      alert(lang === 'fr' ? 'Erreur réseau' : 'Network error')
    } finally {
      setSubmitting(false)
    }
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

      // Build full phone with country code
      const fullPhone = phone.trim() ? `${countryCode} ${phone.trim()}` : ''

      // Linking to an existing CRM prospect happens SERVER-SIDE (booking-gcal-email),
      // because this public page runs unauthenticated and RLS blocks it from reading
      // business_prospects. A booking links to an existing prospect if one matches by
      // email/name — it never creates a new prospect card.

      // Create appointment
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
          notes: `Booking: ${name}${email ? ` — ${email}` : ''}${fullPhone ? ` — ${fullPhone}` : ''}${Object.entries(customFieldValues).filter(([, v]) => v.trim()).map(([k, v]) => ` — ${k}: ${v}`).join('')}`,
          questionnaire_answers: hasQuestionnaire ? info.questionnaireQuestions.filter(q => visibleQuestionIds.has(q.client_id)).map(q => ({
            question_text: q.question_text,
            answer_value: questionnaireAnswers[q.question_text] || ''
          })).filter(a => {
            const val = a.answer_value
            return Array.isArray(val) ? val.length > 0 : val !== ''
          }) : null,
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
          slug, name, email, phone: fullPhone, date: selectedDate, time: selectedTime,
          datetime_utc: datetimeUtc,
          prospect_timezone: prospectTimezone,
          appointment_id: appointment.id,
          questionnaire_answers: hasQuestionnaire ? info.questionnaireQuestions.filter(q => visibleQuestionIds.has(q.client_id)).map(q => ({
            question_text: q.question_text,
            answer_value: questionnaireAnswers[q.question_text] || ''
          })).filter(a => {
            const val = a.answer_value
            return Array.isArray(val) ? val.length > 0 : val !== ''
          }) : null,
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

  const handleSubmitMulti = async () => {
    if (!slug || !linkMeta || selectedSlots.length === 0) return
    // Garde finale : la sélection respecte les règles (délai + max par période) — défense en profondeur.
    if (multiGapDays > 0 || multiMaxPerPeriod > 0) {
      const dates = selectedSlots.map(s => s.date)
      for (let i = 0; i < dates.length; i++) {
        for (let j = i + 1; j < dates.length; j++) {
          if (multiGapDays > 0 && dayDiff(dates[i], dates[j]) < multiGapDays) {
            alert(lang === 'fr' ? `Il faut au moins ${multiGapDays} jour(s) entre deux rendez-vous.` : `At least ${multiGapDays} day(s) required between two appointments.`)
            return
          }
        }
      }
      const byPeriod: Record<string, number> = {}
      for (const d of dates) { const k = periodKeyOf(d); byPeriod[k] = (byPeriod[k] || 0) + 1 }
      if (Object.values(byPeriod).some(n => n > multiMaxPerPeriod)) {
        alert(lang === 'fr' ? `Maximum ${multiMaxPerPeriod} créneau(x) par ${multiPeriod === 'month' ? 'mois' : 'semaine'}.` : `Maximum ${multiMaxPerPeriod} slot(s) per ${multiPeriod}.`)
        return
      }
    }
    setSubmitting(true)
    try {
      const fullPhone = phone.trim() ? `${countryCode} ${phone.trim()}` : ''
      const builtAnswers = hasQuestionnaire
        ? info!.questionnaireQuestions.filter(q => visibleQuestionIds.has(q.client_id)).map(q => ({
            question_text: q.question_text,
            answer_value: questionnaireAnswers[q.question_text] || '',
          })).filter(a => Array.isArray(a.answer_value) ? a.answer_value.length > 0 : a.answer_value !== '')
        : null

      // Fetch all conflicting appointments once (across the whole window)
      const conflictQuery = linkMeta.team_member_id
        ? supabase.from('business_appointments').select('date, time, duration').eq('assigned_to', linkMeta.team_member_id).in('status', ['upcoming', 'pending', 'confirmed'])
        : supabase.from('business_appointments').select('date, time, duration').eq('user_id', linkMeta.business_owner_id).is('assigned_to', null).in('status', ['upcoming', 'pending', 'confirmed'])
      const { data: existing } = await conflictQuery

      const created: { appointment_id: string; date: string; time: string; datetime_utc?: string }[] = []
      const conflicted: SlotData[] = []

      // Sort chronologically so emails/recap read in order
      const ordered = [...selectedSlots].sort((a, b) => slotKey(a).localeCompare(slotKey(b)))

      for (const slot of ordered) {
        const matchSlot = prospectSlots.find(s => s.date === slot.date && s.time === slot.time)
        const datetimeUtc = slot.datetime_utc || matchSlot?.datetime_utc || toUTC(slot.date, slot.time, prospectTimezone).toISOString()

        const [rH, rM] = slot.time.split(':').map(Number)
        const reqStart = rH * 60 + rM
        const reqEnd = reqStart + linkMeta.duration
        // Conflict against existing appointments AND already-created ones in this batch (same date)
        const dayBusy = [
          ...(existing || []).filter((a: any) => a.date === slot.date),
          ...created.filter(c => c.date === slot.date).map(c => ({ time: c.time, duration: linkMeta.duration })),
        ]
        const hasConflict = dayBusy.some((appt: any) => {
          const [aH, aM] = appt.time.split(':').map(Number)
          const apptStart = aH * 60 + aM
          const apptEnd = apptStart + (appt.duration || 30)
          return reqStart < apptEnd && reqEnd > apptStart
        })
        if (hasConflict) { conflicted.push(slot); continue }

        const cancelToken = crypto.randomUUID()
        const rescheduleToken = crypto.randomUUID()
        const { data: appointment, error: apptErr } = await supabase
          .from('business_appointments')
          .insert({
            user_id: linkMeta.business_owner_id,
            prospect_id: null,
            assigned_to: linkMeta.team_member_id || null,
            date: slot.date,
            time: slot.time,
            duration: linkMeta.duration,
            status: 'pending',
            datetime_utc: datetimeUtc,
            timezone: prospectTimezone,
            cancel_token: cancelToken,
            reschedule_token: rescheduleToken,
            notes: `Booking: ${name}${email ? ` — ${email}` : ''}${fullPhone ? ` — ${fullPhone}` : ''}${Object.entries(customFieldValues).filter(([, v]) => v.trim()).map(([k, v]) => ` — ${k}: ${v}`).join('')}`,
            questionnaire_answers: builtAnswers,
          })
          .select()
          .single()
        if (apptErr || !appointment) { conflicted.push(slot); continue }
        created.push({ appointment_id: appointment.id, date: slot.date, time: slot.time, datetime_utc: datetimeUtc })
      }

      if (created.length === 0) {
        alert(lang === 'fr' ? 'Ces créneaux viennent d\'être réservés. Veuillez en choisir d\'autres.' : 'These slots have just been booked. Please choose others.')
        setSubmitting(false)
        return
      }

      // Combined internal notification (owner + assigned member + HoS)
      const slotsLabel = created.map(c => `${new Date(c.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${c.time}`).join(', ')
      const notifTitle = `Nouveau rendez-vous : ${name} (${created.length} créneaux)`
      const notifDesc = `${name} a réservé ${created.length} créneaux : ${slotsLabel}${email ? ` — ${email}` : ''}`
      const reminderRows: { user_id: string; title: string; description: string; reminder_date: string; is_done: boolean; is_notification: boolean }[] = []
      reminderRows.push({ user_id: linkMeta.business_owner_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })
      if (linkMeta.team_member_id) {
        const { data: tmUser } = await supabase.from('business_team_members').select('user_id').eq('id', linkMeta.team_member_id).single()
        if (tmUser?.user_id && tmUser.user_id !== linkMeta.business_owner_id) {
          reminderRows.push({ user_id: tmUser.user_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })
        }
      }
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

      // One API call → 1 GCal event per slot, but a SINGLE combined email (prospect + internal)
      fetch(`${API_URL}?action=booking-gcal-email-multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, name, email, phone: fullPhone,
          prospect_timezone: prospectTimezone,
          slots: created,
          questionnaire_answers: builtAnswers,
        }),
      }).catch(() => {})

      // Keep only the successfully-booked slots for the confirmation screen
      setSelectedSlots(created.map(c => ({ date: c.date, time: c.time, datetime_utc: c.datetime_utc })))

      if (info?.redirectUrl) {
        const url = info.redirectUrl!.match(/^https?:\/\//) ? info.redirectUrl! : `https://${info.redirectUrl!}`
        setTimeout(() => { window.location.href = url }, 2500)
      }
      setDone(true)
    } catch (err) {
      console.error('Multi-booking error:', err)
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
          <h2 className="text-3xl font-extrabold text-[#1b1c1b] mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {multiEnabled && selectedSlots.length > 1 ? 'Réservations confirmées' : 'Réservation confirmée'}
          </h2>
          <p className="text-[#444748] mb-6">
            {multiEnabled && selectedSlots.length > 1
              ? `Vos ${selectedSlots.length} rendez-vous ont été réservés avec succès.`
              : 'Votre rendez-vous a été réservé avec succès.'}
          </p>
          {multiEnabled && selectedSlots.length > 0 ? (
            <div className="rounded-2xl bg-white p-6 space-y-3 text-left" style={{ boxShadow: 'inset 0 0 0 1px rgba(196,199,199,0.1), 0 20px 40px rgba(27,28,27,0.04)' }}>
              {selectedSlots.map(s => (
                <div key={slotKey(s)} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#f5f3f2] flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-[#006c49]" />
                  </div>
                  <span className="text-sm font-bold text-[#1b1c1b] capitalize">
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — {s.time} - {endTime(s.time, info.duration)}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <div className="w-9 h-9 rounded-xl bg-[#f5f3f2] flex items-center justify-center shrink-0">
                  <Globe className="h-4 w-4 text-[#444748]" />
                </div>
                <span className="text-sm text-[#444748]">{getTimezoneLabel(prospectTimezone)}</span>
              </div>
            </div>
          ) : (
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
          )}
          {email && (
            <>
              <p className="mt-6 text-xs text-[#444748]/60">Vous recevrez un email de confirmation contenant le lien de votre rendez-vous.</p>
              <p className="mt-1 text-xs text-[#444748]/45">Pas de mail ? Pensez à vérifier vos spams.</p>
            </>
          )}
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
                        <Phone className="h-3.5 w-3.5 text-[#444748]/50" />{countryCode} {phone}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setStep('form')} className="text-xs text-[#006c49] font-bold hover:underline">
                    Modifier
                  </button>
                </div>
              )}

              {/* Questionnaire recap */}
              {(step === 'calendar' || step === 'confirm') && hasQuestionnaire && Object.keys(questionnaireAnswers).length > 0 && (
                <div className="mt-4 pt-5 border-t border-[#c4c7c7]/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#006c49]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#006c49]">Questionnaire complété</span>
                  </div>
                  <button onClick={() => setStep('questionnaire')} className="text-xs text-[#006c49] font-bold hover:underline">
                    Modifier les réponses
                  </button>
                </div>
              )}

              {/* Selected slots recap (multi) */}
              {multiEnabled && (step === 'calendar' || step === 'confirm') && selectedSlots.length > 0 && (
                <div className="mt-4 pt-5 border-t border-[#c4c7c7]/20 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/50 flex items-center gap-2">
                    <CalendarPlus className="h-3.5 w-3.5" /> {selectedSlots.length} créneau{selectedSlots.length > 1 ? 'x' : ''} sélectionné{selectedSlots.length > 1 ? 's' : ''}
                  </p>
                  {selectedSlots.map(s => (
                    <p key={slotKey(s)} className="text-sm text-[#1b1c1b] flex items-center gap-2.5 font-medium capitalize">
                      <Calendar className="h-3.5 w-3.5 text-[#444748]/50" />
                      {new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {s.time}
                    </p>
                  ))}
                </div>
              )}

              {/* Selected slot recap */}
              {!multiEnabled && step === 'confirm' && selectedDate && selectedTime && (
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
                        <div className="relative flex gap-0 z-20" ref={countryPickerRef}>
                          <button
                            type="button"
                            onClick={() => { setShowCountryPicker(!showCountryPicker); setCountrySearch('') }}
                            className="flex items-center gap-1.5 border-b-2 border-[#c4c7c7]/30 py-3 pr-3 hover:border-[#006c49] transition-colors flex-shrink-0"
                          >
                            <span className="text-base">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag || '🌍'}</span>
                            <span className="text-sm text-[#1b1c1b] font-medium">{countryCode}</span>
                            <ChevronDown className="h-3 w-3 text-[#444748]/40" />
                          </button>
                          {showCountryPicker && (
                            <div className="fixed z-[9999] w-64 max-h-60 overflow-y-auto rounded-2xl border border-[#c4c7c7]/10 bg-white shadow-xl" style={{ top: (countryPickerRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: countryPickerRef.current?.getBoundingClientRect().left ?? 0 }}>
                              <div className="sticky top-0 bg-white border-b border-[#c4c7c7]/10 p-3">
                                <input
                                  type="text"
                                  value={countrySearch}
                                  onChange={(e) => setCountrySearch(e.target.value)}
                                  placeholder="Rechercher un pays..."
                                  className="w-full rounded-full border border-[#c4c7c7]/20 bg-[#f5f3f2] px-3.5 py-2 text-sm text-[#1b1c1b] placeholder:text-[#444748]/40 focus:outline-none focus:ring-1 focus:ring-[#006c49]"
                                  autoFocus
                                />
                              </div>
                              {COUNTRY_CODES
                                .filter(c => !countrySearch || c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch))
                                .map((c, i) => (
                                <button
                                  key={`${c.code}-${c.name}-${i}`}
                                  type="button"
                                  onClick={() => { setCountryCode(c.code); setPhone(''); setShowCountryPicker(false); setCountrySearch('') }}
                                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[#f5f3f2] transition-colors ${countryCode === c.code ? 'bg-[#006c49]/5 text-[#006c49]' : 'text-[#1b1c1b]'}`}
                                >
                                  <span className="text-base">{c.flag}</span>
                                  <span className="flex-1 truncate">{c.name}</span>
                                  <span className="text-xs text-[#444748]/40 font-medium">{c.code}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(formatPhoneByCountry(e.target.value, countryCode))}
                            placeholder={PHONE_FORMATS[countryCode] ? PHONE_FORMATS[countryCode].groups.map(g => '0'.repeat(g)).join(' ') : '6 12 34 56 78'}
                            className="flex-1 bg-transparent border-b-2 border-[#c4c7c7]/30 py-3 pl-3 text-sm text-[#1b1c1b] placeholder:text-[#444748]/40 focus:border-[#006c49] focus:ring-0 transition-colors outline-none font-medium"
                          />
                        </div>
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

              {/* Questionnaire step */}
              {step === 'questionnaire' && hasQuestionnaire && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-full bg-[#1b1c1b] flex items-center justify-center text-white text-sm font-bold shrink-0">2</div>
                    <h2 className="text-2xl font-extrabold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>Quelques questions</h2>
                  </div>
                  <div className="space-y-6">
                    {info!.questionnaireQuestions.filter(q => visibleQuestionIds.has(q.client_id)).map((q, idx) => (
                      <div key={q.client_id || idx} className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">
                          {q.question_text} {q.is_required ? '*' : ''}
                        </label>
                        {q.question_type === 'text' && (
                          <input
                            type="text"
                            value={(questionnaireAnswers[q.question_text] as string) || ''}
                            onChange={e => setQuestionnaireAnswers(prev => ({ ...prev, [q.question_text]: e.target.value }))}
                            placeholder="Votre réponse..."
                            className={inputCls}
                          />
                        )}
                        {q.question_type === 'number' && (
                          <input
                            type="number"
                            value={(questionnaireAnswers[q.question_text] as string) ?? ''}
                            onChange={e => setQuestionnaireAnswers(prev => ({ ...prev, [q.question_text]: e.target.value }))}
                            placeholder="0"
                            className={inputCls}
                          />
                        )}
                        {q.question_type === 'select' && (
                          <div className="flex flex-wrap gap-2">
                            {(q.options || []).map((opt, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setQuestionnaireAnswers(prev => ({ ...prev, [q.question_text]: opt }))}
                                className={`px-4 py-2.5 rounded-full text-sm font-bold transition-all ${questionnaireAnswers[q.question_text] === opt ? 'bg-[#1b1c1b] text-white scale-[1.02]' : 'bg-[#f5f3f2] text-[#444748] hover:bg-[#eae8e7]'}`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                        {q.question_type === 'multiple_choice' && (
                          <div className="flex flex-wrap gap-2">
                            {(q.options || []).map((opt, i) => {
                              const selected = Array.isArray(questionnaireAnswers[q.question_text]) ? (questionnaireAnswers[q.question_text] as string[]) : []
                              const isSelected = selected.includes(opt)
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    const newSel = isSelected ? selected.filter(s => s !== opt) : [...selected, opt]
                                    setQuestionnaireAnswers(prev => ({ ...prev, [q.question_text]: newSel }))
                                  }}
                                  className={`px-4 py-2.5 rounded-full text-sm font-bold transition-all ${isSelected ? 'bg-[#1b1c1b] text-white scale-[1.02]' : 'bg-[#f5f3f2] text-[#444748] hover:bg-[#eae8e7]'}`}
                                >
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setStep('calendar')}
                      disabled={info!.questionnaireRequired && !isQuestionnaireComplete}
                      className="w-full flex items-center justify-center gap-3 rounded-full bg-[#1b1c1b] py-4 text-base font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl mt-4"
                      style={{ fontFamily: 'Manrope, sans-serif' }}
                    >
                      <span>Choisir un créneau</span>
                      <ArrowRight className="h-5 w-5" />
                    </button>
                    {!info!.questionnaireRequired && (
                      <button
                        onClick={() => setStep('calendar')}
                        className="w-full text-center text-xs text-[#006c49] font-bold py-2 hover:underline"
                      >
                        Passer et choisir un créneau
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Calendar + time slots */}
              {step === 'calendar' && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-full bg-[#1b1c1b] flex items-center justify-center text-white text-sm font-bold shrink-0">{hasQuestionnaire ? 3 : 2}</div>
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
                          {slotsForDate.map(time => {
                            const active = multiEnabled ? isSlotSelected(selectedDate, time) : selectedTime === time
                            const atMax = multiEnabled && !active && selectedSlots.length >= multiMax
                            const ruleCheck = multiEnabled && !active && !atMax ? slotRespectsRules(selectedDate) : { ok: true as const }
                            const blocked = atMax || !ruleCheck.ok
                            return (
                              <button
                                key={time}
                                disabled={blocked}
                                title={!ruleCheck.ok ? ruleCheck.reason : undefined}
                                onClick={() => {
                                  if (multiEnabled) { toggleSlot(selectedDate, time) }
                                  else { setSelectedTime(time); setStep('confirm') }
                                }}
                                className={`
                                  py-3 px-4 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2
                                  ${active
                                    ? 'bg-[#1b1c1b] text-white shadow-lg'
                                    : 'border border-[#c4c7c7]/30 text-[#1b1c1b] hover:border-[#006c49] hover:text-[#006c49]'
                                  }
                                  ${blocked ? 'opacity-30 cursor-not-allowed hover:border-[#c4c7c7]/30 hover:text-[#1b1c1b]' : ''}
                                `}
                              >
                                {multiEnabled && active && <CheckCircle2 className="h-3.5 w-3.5" />}
                                {time}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Multi-booking: selected slots recap + continue */}
                  {multiEnabled && (
                    <div className="mt-8 border-t border-[#c4c7c7]/20 pt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 flex items-center gap-2">
                          <CalendarPlus className="h-3.5 w-3.5" /> Créneaux sélectionnés
                        </h3>
                        <span className="text-[10px] font-bold text-[#006c49]">{selectedSlots.length} / {multiMax}</span>
                      </div>
                      {selectedSlots.length === 0 ? (
                        <p className="text-sm text-[#444748]/40 text-center py-3">
                          Sélectionnez jusqu'à {multiMax} créneaux, puis confirmez-les tous en une fois.
                        </p>
                      ) : (
                        <div className="space-y-2 mb-5">
                          {selectedSlots.map(s => (
                            <div key={slotKey(s)} className="flex items-center justify-between rounded-xl bg-[#f5f3f2] px-4 py-2.5">
                              <span className="text-sm font-bold text-[#1b1c1b] capitalize flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-[#006c49]" />
                                {new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} — {s.time}
                              </span>
                              <button
                                onClick={() => setSelectedSlots(prev => prev.filter(x => !(x.date === s.date && x.time === s.time)))}
                                className="text-[#444748]/40 hover:text-[#ba1a1a] transition-colors"
                                aria-label="Retirer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => setStep('confirm')}
                        disabled={selectedSlots.length === 0}
                        className="w-full flex items-center justify-center gap-3 rounded-full bg-[#1b1c1b] py-4 text-base font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
                        style={{ fontFamily: 'Manrope, sans-serif' }}
                      >
                        <span>Voir le récapitulatif</span>
                        <ArrowRight className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Confirm (multi-booking) */}
              {step === 'confirm' && multiEnabled && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-full bg-[#006c49] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>Confirmer mes rendez-vous</h2>
                  </div>

                  <div className="rounded-2xl bg-[#f5f3f2] p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <CalendarPlus className="h-4 w-4 text-[#006c49]" />
                      <span className="text-sm font-bold text-[#1b1c1b]">{selectedSlots.length} créneau{selectedSlots.length > 1 ? 'x' : ''} — {info.duration} min chacun</span>
                    </div>
                    <div className="space-y-2.5">
                      {selectedSlots.map(s => (
                        <div key={slotKey(s)} className="flex items-center justify-between bg-white rounded-xl px-4 py-3">
                          <span className="text-sm font-bold text-[#1b1c1b] capitalize flex items-center gap-2.5">
                            <Calendar className="h-3.5 w-3.5 text-[#006c49]" />
                            {new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                          <span className="text-sm font-bold text-[#444748] flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-[#444748]/40" />
                            {s.time} - {endTime(s.time, info.duration)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#f5f3f2] p-6 space-y-4 mb-8">
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
                      <span className="flex items-center justify-center gap-2"><Plus className="h-4 w-4" /> Ajouter / modifier</span>
                    </button>
                    <button
                      onClick={handleSubmitMulti}
                      disabled={submitting || selectedSlots.length === 0}
                      className="flex-[1.5] flex items-center justify-center gap-2 rounded-full bg-[#1b1c1b] px-5 py-4 text-sm font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-xl"
                      style={{ fontFamily: 'Manrope, sans-serif' }}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          <span>Confirmer tous mes bookings</span>
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

              {/* Step 3: Confirm (single) */}
              {step === 'confirm' && !multiEnabled && selectedDate && selectedTime && (
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
                      onClick={info.stripe ? handlePayAndBook : handleSubmit}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#1b1c1b] px-5 py-4 text-sm font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-xl"
                      style={{ fontFamily: 'Manrope, sans-serif' }}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          {info.stripe ? <Lock className="h-4 w-4" /> : null}
                          <span>{info.stripe
                            ? `Payer ${(info.stripe.price / 100).toFixed(2).replace('.00', '')}${info.stripe.currency === 'eur' ? '€' : ' ' + info.stripe.currency.toUpperCase()}`
                            : 'Confirmer'}</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-center text-[10px] text-[#444748]/40 mt-6 font-medium leading-relaxed">
                    {info.stripe
                      ? 'Paiement sécurisé par Stripe — Apple Pay / Google Pay / CB.'
                      : "En confirmant, vous acceptez d'être recontacté(e) et que vos informations soient enregistrées."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inline Stripe payment overlay */}
      {inlinePayment && info?.stripe && (
        <InlineStripePaymentModal
          amount={info.stripe.price}
          currency={info.stripe.currency}
          lang={lang as 'fr' | 'en'}
          paymentIntentId={inlinePayment.payment_intent_id}
          clientSecret={inlinePayment.client_secret}
          confirmEndpoint={`${API_URL}?action=booking-confirm-payment`}
          cancelEndpoint={`${API_URL}?action=booking-cancel-payment`}
          returnUrl={`${window.location.origin}/book/${slug || ''}?payment_intent_return=true`}
          onSuccess={() => {
            setInlinePayment(null)
            setDone(true)
          }}
          onCancel={() => {
            setInlinePayment(null)
            setPaidAppointment(null)
          }}
        />
      )}
    </div>
  )
}
