import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Loader2, Calendar, ChevronLeft, ChevronRight, Check, ArrowRight, ChevronDown,
  XCircle, Mail, Phone, User, Building2, Sparkles, Send, AlertCircle, ShieldCheck, CheckCircle2,
} from 'lucide-react'
import { toUTC, fromUTC } from '../lib/timezone'
import { InlineStripePaymentModal } from '../components/InlineStripePayment'
import {
  filterCountries,
  flagForCode,
  formatPhoneByCountry,
  phonePlaceholder,
  PHONE_FORMATS,
} from '../lib/phone'

const API_URL = '/api/crm-capture'

interface CustomField {
  label: string
  type: 'text' | 'email' | 'phone' | 'number' | 'select'
  required: boolean
  options?: string[]
}

interface Campaign {
  id: string
  name: string
  slug: string
  description: string | null
  custom_fields: CustomField[]
  landing_title: string | null
  landing_subtitle: string | null
  landing_text: string | null
  landing_video_url: string | null
  email_required: boolean
  phone_required: boolean
  redirect_url: string | null
  capture_type: 'with_rdv' | 'without_rdv'
  stripe_enabled: boolean
  stripe_price: number
  stripe_currency: string
  booking_window_days: number
  booking_duration_minutes: number
}

interface Formula {
  id: string
  name: string
  price: number
  description: string | null
  billing_type: 'one_time' | 'subscription' | 'quote'
  billing_interval?: string | null
}

interface Owner {
  name: string | null
  avatar_url: string | null
  timezone: string | null
}

interface Slot {
  date: string
  time: string
  datetime_utc: string
  member_ids: string[]
}


function isValidEmail(e: string) { return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e) }

function generateTimeSlots() {
  const slots: string[] = []
  for (let h = 9; h < 18; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}
const TIME_SLOTS = generateTimeSlots()

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = (firstDay.getDay() + 6) % 7
  const days: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

function billingShort(t: string, i?: string | null) {
  if (t === 'quote') return ''
  if (t === 'one_time') return ''
  if (i === 'monthly') return '/mois'
  if (i === 'quarterly') return '/trim.'
  if (i === 'annual') return '/an'
  return ''
}

function toEmbedUrl(url: string): string {
  if (!url) return url
  if (url.includes('/embed/')) return url
  const watch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/)
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
  if (short) return `https://www.youtube.com/embed/${short[1]}`
  if (url.includes('loom.com/share/')) return url.replace('/share/', '/embed/')
  return url
}

export default function CRMCapture() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const isEmbed = searchParams.get('embed') === 'true'
  const prospectTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris', [])

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [formula, setFormula] = useState<Formula | null>(null)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [paymentFailed, setPaymentFailed] = useState(false)
  const [paymentPendingSync, setPaymentPendingSync] = useState(false)
  const [inlinePayment, setInlinePayment] = useState<{ client_secret: string; payment_intent_id: string } | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [countryCode, setCountryCode] = useState('+33')
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [customData, setCustomData] = useState<Record<string, string>>({})
  const countryPickerRef = useRef<HTMLDivElement>(null)

  // Calendar
  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [realSlots, setRealSlots] = useState<Slot[]>([])
  const [freeMode, setFreeMode] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (countryPickerRef.current && !countryPickerRef.current.contains(e.target as Node)) {
        setShowCountryPicker(false)
      }
    }
    if (showCountryPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCountryPicker])

  // Fetch campaign info
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}?action=info&slug=${encodeURIComponent(slug)}`)
        const data = await res.json()
        if (cancelled) return
        if (data.error) { setNotFound(true); return }
        setCampaign(data.campaign)
        setFormula(data.formula)
        setOwner(data.owner)
        // View tracking
        fetch(`${API_URL}?action=view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        }).catch(() => {})
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  // Fetch slots if booking
  useEffect(() => {
    if (!campaign || campaign.capture_type === 'without_rdv') return
    setSlotsLoading(true)
    fetch(`${API_URL}?action=slots&slug=${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.freeMode) {
          setFreeMode(true)
        } else {
          setFreeMode(false)
          setRealSlots(data.slots || [])
        }
      })
      .catch(() => setFreeMode(true))
      .finally(() => setSlotsLoading(false))
  }, [campaign, slug])

  // Handle 3DS payment return
  useEffect(() => {
    const piReturn = searchParams.get('payment_intent_return')
    const paymentIntentParam = searchParams.get('payment_intent')
    const redirectStatus = searchParams.get('redirect_status')
    const cancelled = searchParams.get('payment_cancelled')

    if (cancelled === 'true') { setPaymentFailed(true); return }
    if (piReturn === 'true' && paymentIntentParam && redirectStatus === 'succeeded') {
      setPaymentProcessing(true)
      const confirmRetry = async (attempts = 4): Promise<any> => {
        for (let i = 0; i < attempts; i++) {
          try {
            const r = await fetch(`${API_URL}?action=confirm-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ payment_intent_id: paymentIntentParam }),
            })
            const d = await r.json()
            if (d.success || d.already_completed) return d
          } catch {}
          if (i < attempts - 1) await new Promise(r => setTimeout(r, (i + 1) * 1500))
        }
        return null
      }
      confirmRetry()
        .then(data => {
          if (data) {
            setSubmitted(true)
            if (window.parent !== window) window.parent.postMessage('closeos-capture-done', '*')
            const rUrl = data.redirect_url || campaign?.redirect_url
            if (rUrl) setRedirectUrl(rUrl)
            window.history.replaceState({}, '', window.location.pathname)
          } else {
            setPaymentPendingSync(true)
            window.history.replaceState({}, '', window.location.pathname)
          }
        })
        .finally(() => setPaymentProcessing(false))
    }
  }, [searchParams, campaign])

  // Embed resize
  useEffect(() => {
    if (!isEmbed) return
    const sendSize = () => window.parent?.postMessage({ type: 'closeos-capture-resize', height: document.body.scrollHeight }, '*')
    sendSize()
    const obs = new ResizeObserver(sendSize)
    obs.observe(document.body)
    return () => obs.disconnect()
  }, [isEmbed])

  // Convert slots to prospect tz
  const prospectSlots = useMemo(() => {
    if (freeMode || !realSlots.length) return realSlots
    return realSlots.map(slot => {
      if (!slot.datetime_utc) return slot
      const local = fromUTC(slot.datetime_utc, prospectTimezone)
      return { ...slot, date: local.date, time: local.time }
    })
  }, [realSlots, freeMode, prospectTimezone])

  const availableDates = useMemo(() => {
    if (freeMode) return null
    return new Set(prospectSlots.map(s => s.date))
  }, [prospectSlots, freeMode])

  const availableTimesForDate = useMemo(() => {
    if (!selectedDate || freeMode) return null
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    return prospectSlots.filter(s => s.date === dateStr)
  }, [selectedDate, prospectSlots, freeMode])

  const isInfoComplete = useMemo(() => {
    if (!firstName.trim()) return false
    if (campaign?.email_required) {
      if (!email.trim() || !isValidEmail(email.trim())) return false
    } else if (email.trim() && !isValidEmail(email.trim())) {
      return false
    }
    if (campaign?.phone_required) {
      const digits = phone.replace(/\D/g, '')
      const fmt = PHONE_FORMATS[countryCode]
      const requiredDigits = fmt ? fmt.maxDigits : 7
      if (digits.length < requiredDigits) return false
    }
    for (const f of (campaign?.custom_fields || [])) {
      if (f.required && !customData[f.label]?.trim()) return false
    }
    return true
  }, [firstName, email, phone, countryCode, customData, campaign])

  const fullPhone = phone.trim() ? `${countryCode} ${phone.trim()}` : ''
  const isInscriptionMode = campaign?.capture_type === 'without_rdv'
  const stripeRequired = !!(campaign?.stripe_enabled && campaign?.stripe_price && campaign.stripe_price > 0)

  // Partial save
  const partialSavedRef = useRef(false)
  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePartialLead = useCallback(async () => {
    if (!slug || partialSavedRef.current) return
    if (!email.trim() && !phone.trim()) return
    partialSavedRef.current = true
    try {
      const name = `${firstName} ${lastName}`.trim()
      const pPhone = phone.trim() ? `${countryCode} ${phone.trim()}` : ''
      await fetch(`${API_URL}?action=partial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, email, phone: pPhone, custom_data: customData }),
      })
    } catch {}
  }, [slug, firstName, lastName, email, phone, countryCode, customData])

  useEffect(() => {
    if (submitted || partialSavedRef.current) return
    if (!email.trim() && !phone.trim()) return
    if (partialTimerRef.current) clearTimeout(partialTimerRef.current)
    partialTimerRef.current = setTimeout(() => savePartialLead(), 3000)
    return () => { if (partialTimerRef.current) clearTimeout(partialTimerRef.current) }
  }, [email, phone, submitted, savePartialLead])

  const buildSubmitPayload = () => {
    const name = `${firstName} ${lastName}`.trim()
    const payload: any = { slug, name, email, phone: fullPhone, custom_data: customData }
    if (!isInscriptionMode && selectedDate && selectedTime) {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
      payload.date = dateStr
      payload.time = selectedTime
      payload.prospect_timezone = prospectTimezone
      const matchSlot = !freeMode ? prospectSlots.find(s => s.date === dateStr && s.time === selectedTime) : null
      payload.datetime_utc = matchSlot?.datetime_utc || toUTC(dateStr, selectedTime, prospectTimezone).toISOString()
    }
    return payload
  }

  const handleSubmit = async () => {
    setError(null)
    if (!isInfoComplete) { setError('Veuillez remplir tous les champs requis'); return }
    if (!isInscriptionMode && (!selectedDate || !selectedTime)) { setError('Choisissez un créneau'); return }
    setSubmitting(true)
    try {
      const payload = buildSubmitPayload()
      if (stripeRequired) {
        const initRes = await fetch(`${API_URL}?action=init-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const initData = await initRes.json()
        if (initData.client_secret && initData.payment_intent_id) {
          setInlinePayment({ client_secret: initData.client_secret, payment_intent_id: initData.payment_intent_id })
        } else {
          setError(initData.error || 'Erreur de paiement')
        }
        return
      }
      const res = await fetch(`${API_URL}?action=submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
        if (window.parent !== window) window.parent.postMessage('closeos-capture-done', '*')
        const rUrl = data.redirect_url || campaign?.redirect_url
        if (rUrl) setRedirectUrl(rUrl)
      } else {
        setError(data.error || 'Erreur réseau')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  // Calendar helpers
  const calendarDays = getCalendarDays(calYear, calMonth)
  const isDatePast = (d: Date) => { const n = new Date(); n.setHours(0, 0, 0, 0); return d < n }
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1) }
  const dateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (loading || paymentProcessing) {
    return (
      <div className={`${isEmbed ? '' : 'min-h-screen'} flex items-center justify-center bg-white`}>
        <div className="text-center">
          <Loader2 className="size-7 text-blue-500 animate-spin mx-auto mb-3" />
          {paymentProcessing && <p className="text-sm text-stone-500">Validation du paiement…</p>}
        </div>
      </div>
    )
  }

  if (notFound || !campaign) {
    return (
      <div className={`${isEmbed ? '' : 'min-h-screen'} flex items-center justify-center bg-white px-6`}>
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 border border-red-100 mb-4">
            <XCircle className="size-6 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-[#0A0E27] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Campagne introuvable</h1>
          <p className="text-sm text-stone-500">Cette page de capture n'existe pas ou a été désactivée.</p>
        </div>
      </div>
    )
  }

  const titleDisplay = campaign.landing_title || campaign.name
  const subtitleDisplay = campaign.landing_subtitle
  const textDisplay = campaign.landing_text || campaign.description

  return (
    <div className={`${isEmbed ? '' : 'min-h-screen'} bg-white relative overflow-hidden`}>
      {/* Background mesh */}
      {!isEmbed && (
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-[radial-gradient(circle,_rgba(96,165,250,0.18),transparent_60%)] blur-2xl" />
          <div className="absolute top-1/3 -left-32 w-[500px] h-[500px] bg-[radial-gradient(circle,_rgba(59,130,246,0.12),transparent_60%)] blur-2xl" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'linear-gradient(to bottom, black 10%, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 10%, transparent 90%)',
          }} />
        </div>
      )}

      <div className={`${isEmbed ? 'p-6' : 'min-h-screen px-6 md:px-10 py-10 md:py-16'} max-w-5xl mx-auto`}>
        {/* Brand pill */}
        {!isEmbed && (
          <div className="flex items-center justify-center mb-6">
            <a href="/crm" className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-md border border-blue-100 px-3 py-1.5 shadow-sm hover:border-blue-200 transition-colors">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] text-white text-[10px] font-black">C</span>
              <span className="text-xs font-bold text-[#0A0E27]">
                Powered by <span className="bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent">CloseOS CRM</span>
              </span>
            </a>
          </div>
        )}

        {submitted ? (
          <SuccessCard formulaName={formula?.name} redirectUrl={redirectUrl} />
        ) : paymentPendingSync ? (
          <PendingSyncCard />
        ) : paymentFailed ? (
          <PaymentFailedCard onRetry={() => setPaymentFailed(false)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-start">
            {/* LEFT — Campaign info */}
            <div className="space-y-5">
              {owner?.name && (
                <div className="flex items-center gap-2.5">
                  {owner.avatar_url ? (
                    <img src={owner.avatar_url} alt={owner.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center text-white text-xs font-bold ring-2 ring-white shadow-sm">
                      {owner.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Présenté par</p>
                    <p className="text-sm font-bold text-[#0A0E27]">{owner.name}</p>
                  </div>
                </div>
              )}

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0A0E27] leading-[1.1] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {titleDisplay}
              </h1>
              {subtitleDisplay && (
                <p className="text-lg text-stone-600 font-medium">{subtitleDisplay}</p>
              )}

              {textDisplay && (
                <div className="text-stone-600 text-base leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: textDisplay }} />
              )}

              {campaign.landing_video_url && (
                <div className="rounded-2xl overflow-hidden border border-blue-100 shadow-md shadow-blue-500/10 aspect-video">
                  <iframe src={toEmbedUrl(campaign.landing_video_url)} className="w-full h-full" allowFullScreen frameBorder="0" />
                </div>
              )}

              {/* Formula */}
              {formula && (
                <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/40 to-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">Offre</p>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <h3 className="text-lg font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>{formula.name}</h3>
                    {formula.billing_type === 'quote' ? (
                      <span className="text-lg font-extrabold text-[#0A0E27]">Sur devis</span>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {formula.price.toLocaleString('fr-FR')}€
                        </span>
                        <span className="text-xs text-stone-500">{billingShort(formula.billing_type, formula.billing_interval)}</span>
                      </div>
                    )}
                  </div>
                  {formula.description && (
                    <p className="text-xs text-stone-500 leading-relaxed">{formula.description}</p>
                  )}
                </div>
              )}

              {/* Stripe price banner if no formula but stripe enabled */}
              {!formula && stripeRequired && (
                <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/40 to-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">Paiement requis</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {(campaign.stripe_price / 100).toLocaleString('fr-FR')}€
                    </span>
                    <span className="text-xs text-stone-500">{(campaign.stripe_currency || 'eur').toUpperCase()}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-stone-500 font-medium pt-2">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-emerald-500" /> Données chiffrées</span>
                <span className="w-px h-3 bg-stone-200" />
                <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-500" /> RGPD</span>
                {campaign.capture_type === 'with_rdv' && (
                  <>
                    <span className="w-px h-3 bg-stone-200" />
                    <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 text-blue-500" /> {campaign.booking_duration_minutes}min</span>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT — Form */}
            <div ref={formRef}>
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-[2rem] blur-2xl -z-10" />
                <div className="relative rounded-3xl bg-white border border-blue-100 shadow-2xl shadow-blue-500/10 p-6 md:p-7">
                  <div className="mb-5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 mb-3">
                      <Sparkles className="size-3 text-blue-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">
                        {campaign.capture_type === 'with_rdv' ? 'Réserver un créneau' : 'Inscription'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Vos coordonnées
                    </h2>
                    <p className="text-xs text-stone-500 mt-1">Remplissez le formulaire pour continuer</p>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <CRMField label="Prénom *" icon={<User className="size-3.5" />}>
                        <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" className={inputCls} />
                      </CRMField>
                      <CRMField label="Nom" icon={<User className="size-3.5" />}>
                        <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" className={inputCls} />
                      </CRMField>
                    </div>
                    <CRMField label={`Email${campaign.email_required ? ' *' : ''}`} icon={<Mail className="size-3.5" />}>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@example.com" className={inputCls} />
                    </CRMField>
                    <CRMField label={`Téléphone${campaign.phone_required ? ' *' : ''}`} icon={<Phone className="size-3.5" />}>
                      <div className="relative flex" ref={countryPickerRef}>
                        <button
                          type="button"
                          onClick={() => { setShowCountryPicker(o => !o); setCountrySearch('') }}
                          className="pl-9 pr-2 py-2.5 rounded-l-xl bg-blue-50/40 border border-r-0 border-blue-100 text-sm text-[#0A0E27] hover:bg-blue-50 transition-colors inline-flex items-center gap-1"
                        >
                          {flagForCode(countryCode)}
                          <span className="font-mono text-xs">{countryCode}</span>
                          <ChevronDown className="size-3" />
                        </button>
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(formatPhoneByCountry(e.target.value, countryCode))}
                          placeholder={phonePlaceholder(countryCode)}
                          className="flex-1 px-3 py-2.5 rounded-r-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all placeholder:text-stone-400"
                        />
                        {showCountryPicker && (
                          <div className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto rounded-xl bg-white border border-blue-100 shadow-xl shadow-blue-500/10 py-1 z-30">
                            <div className="sticky top-0 bg-white border-b border-blue-50 p-2">
                              <input
                                type="text"
                                value={countrySearch}
                                onChange={e => setCountrySearch(e.target.value)}
                                placeholder="Rechercher un pays..."
                                className="w-full rounded-lg bg-blue-50/40 border border-blue-100 px-3 py-1.5 text-xs text-[#0A0E27] placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                                autoFocus
                              />
                            </div>
                            {filterCountries(countrySearch).map((c, i) => (
                              <button
                                key={`${c.code}-${c.iso}-${i}`}
                                type="button"
                                onClick={() => { setCountryCode(c.code); setPhone(''); setShowCountryPicker(false); setCountrySearch('') }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-blue-50"
                              >
                                <span className="text-base">{c.flag}</span>
                                <span className="font-mono text-stone-500">{c.code}</span>
                                <span className="font-semibold text-[#0A0E27] truncate">{c.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </CRMField>
                    <CRMField label="Société (optionnel)" icon={<Building2 className="size-3.5" />}>
                      <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc." className={inputCls} />
                    </CRMField>

                    {/* Custom fields */}
                    {campaign.custom_fields?.map((field, i) => (
                      <CRMField key={i} label={`${field.label}${field.required ? ' *' : ''}`}>
                        {field.type === 'select' ? (
                          <select
                            value={customData[field.label] || ''}
                            onChange={e => setCustomData({ ...customData, [field.label]: e.target.value })}
                            className="w-full pl-3 pr-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all"
                          >
                            <option value="">— Sélectionner —</option>
                            {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                            value={customData[field.label] || ''}
                            onChange={e => setCustomData({ ...customData, [field.label]: e.target.value })}
                            placeholder={field.label}
                            className="w-full pl-3 pr-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all"
                          />
                        )}
                      </CRMField>
                    ))}
                  </div>

                  {/* Booking calendar */}
                  {!isInscriptionMode && (
                    <div className="mt-5 pt-5 border-t border-blue-50">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="size-4 text-blue-600" />
                        <h3 className="text-sm font-bold text-[#0A0E27]">Choisissez un créneau</h3>
                      </div>
                      {slotsLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="size-5 text-blue-500 animate-spin" /></div>
                      ) : (
                        <BookingCalendar
                          calendarDays={calendarDays}
                          calMonth={calMonth}
                          calYear={calYear}
                          prevMonth={prevMonth}
                          nextMonth={nextMonth}
                          selectedDate={selectedDate}
                          setSelectedDate={d => { setSelectedDate(d); setSelectedTime(null) }}
                          isDatePast={isDatePast}
                          isWeekend={isWeekend}
                          isSameDay={isSameDay}
                          dateStr={dateStr}
                          availableDates={availableDates}
                          selectedTime={selectedTime}
                          setSelectedTime={setSelectedTime}
                          freeMode={freeMode}
                          availableTimesForDate={availableTimesForDate}
                          allTimeSlots={TIME_SLOTS}
                        />
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-700">
                      <AlertCircle className="size-3.5" />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting || (!isInscriptionMode && (!selectedDate || !selectedTime))}
                    className="group mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full h-12 px-6 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="size-4" />
                        {stripeRequired ? `Payer ${(campaign.stripe_price / 100).toLocaleString('fr-FR')}€` : 'Valider mon inscription'}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[10px] text-stone-400 mt-3">
                    En continuant, vous acceptez d'être contacté par {owner?.name || "l'organisateur"}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stripe inline modal */}
      {inlinePayment && (
        <InlineStripePaymentModal
          clientSecret={inlinePayment.client_secret}
          paymentIntentId={inlinePayment.payment_intent_id}
          amount={campaign.stripe_price}
          currency={campaign.stripe_currency || 'eur'}
          lang="fr"
          confirmEndpoint={`${API_URL}?action=confirm-payment`}
          cancelEndpoint={`${API_URL}?action=cancel-payment`}
          returnUrl={`${window.location.origin}${window.location.pathname}?payment_intent_return=true`}
          onCancel={() => {
            setInlinePayment(null)
            setSubmitting(false)
          }}
          onSuccess={(data) => {
            setInlinePayment(null)
            setSubmitted(true)
            if (window.parent !== window) window.parent.postMessage('closeos-capture-done', '*')
            const rUrl = data?.redirect_url || campaign.redirect_url
            if (rUrl) setRedirectUrl(rUrl)
          }}
        />
      )}
    </div>
  )
}

const inputCls = "w-full pl-9 pr-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all placeholder:text-stone-400"

function CRMField({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">{label}</span>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none z-10">{icon}</span>}
        {children}
      </div>
    </label>
  )
}

function BookingCalendar({
  calendarDays, calMonth, calYear, prevMonth, nextMonth, selectedDate, setSelectedDate,
  isDatePast, isWeekend, isSameDay, dateStr, availableDates,
  selectedTime, setSelectedTime, freeMode, availableTimesForDate, allTimeSlots,
}: any) {
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-blue-50 text-stone-500 hover:text-blue-600 transition-colors">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-bold text-[#0A0E27]">{monthNames[calMonth]} {calYear}</p>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-blue-50 text-stone-500 hover:text-blue-600 transition-colors">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((d, i) => <div key={i} className="text-center text-[10px] font-bold text-stone-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {calendarDays.map((d: Date | null, i: number) => {
          if (!d) return <div key={i} />
          const past = isDatePast(d)
          const weekend = isWeekend(d)
          const dateString = dateStr(d)
          const available = freeMode ? !past && !weekend : (availableDates?.has(dateString) ?? false)
          const isSelected = selectedDate && isSameDay(selectedDate, d)
          return (
            <button
              key={i}
              onClick={() => available && setSelectedDate(d)}
              disabled={!available}
              className={`aspect-square rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] text-white shadow-md shadow-blue-500/30'
                  : available
                  ? 'bg-blue-50/40 hover:bg-blue-100 text-[#0A0E27]'
                  : 'text-stone-300 cursor-not-allowed'
              }`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Créneau</p>
          <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
            {(freeMode ? allTimeSlots : (availableTimesForDate || []).map((s: any) => s.time)).map((time: string) => {
              const isActive = selectedTime === time
              return (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white shadow-md shadow-blue-500/30'
                      : 'bg-blue-50/40 hover:bg-blue-100 text-[#0A0E27] border border-blue-100'
                  }`}
                >
                  {time}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SuccessCard({ formulaName, redirectUrl }: { formulaName?: string; redirectUrl: string | null }) {
  useEffect(() => {
    if (redirectUrl) {
      const t = setTimeout(() => { window.location.href = redirectUrl }, 2000)
      return () => clearTimeout(t)
    }
  }, [redirectUrl])
  return (
    <div className="max-w-lg mx-auto">
      <div className="relative">
        <div className="absolute -inset-3 bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-[2rem] blur-2xl -z-10" />
        <div className="relative rounded-3xl bg-white border border-blue-100 shadow-2xl shadow-blue-500/10 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/30 mb-4">
            <CheckCircle2 className="size-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#0A0E27] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Inscription validée !
          </h2>
          <p className="text-sm text-stone-500 max-w-sm mx-auto">
            Merci, vous serez recontacté très prochainement{formulaName ? ` au sujet de ${formulaName}` : ''}.
          </p>
          <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">
              {redirectUrl ? 'Redirection en cours…' : 'Confirmé'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PendingSyncCard() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-3xl bg-white border border-amber-200 shadow-2xl p-8 text-center">
        <Loader2 className="size-8 text-amber-500 animate-spin mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[#0A0E27] mb-2">Validation en cours…</h2>
        <p className="text-sm text-stone-500">Votre paiement est confirmé, nous finalisons votre inscription.</p>
      </div>
    </div>
  )
}

function PaymentFailedCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-3xl bg-white border border-red-200 shadow-2xl p-8 text-center">
        <XCircle className="size-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[#0A0E27] mb-2">Paiement annulé</h2>
        <p className="text-sm text-stone-500 mb-4">Le paiement n'a pas été finalisé. Vous pouvez réessayer.</p>
        <button onClick={onRetry} className="px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all">
          Réessayer
        </button>
      </div>
    </div>
  )
}
