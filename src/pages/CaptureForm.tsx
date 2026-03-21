import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, Calendar, ChevronLeft, ChevronRight, Lock, ArrowRight, ChevronDown } from 'lucide-react'
import { toUTC } from '../lib/timezone'

interface CustomField {
  label: string
  type: 'text' | 'email' | 'phone' | 'number' | 'select'
  required: boolean
  options?: string[]
}

interface Campaign {
  id: string
  name: string
  description: string | null
  custom_fields: CustomField[]
  slug: string
  landing_title: string | null
  landing_subtitle: string | null
  landing_text: string | null
  landing_video_url: string | null
  email_required: boolean
  phone_required: boolean
  redirect_url: string | null
  capture_type: 'with_rdv' | 'without_rdv'
}

const API_URL = '/api/business'

// Convert any YouTube URL to embed format
function toEmbedUrl(url: string): string {
  if (!url) return url
  // Already an embed URL
  if (url.includes('/embed/')) return url
  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/)
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`
  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`
  // youtube.com/VIDEO_ID (rare)
  const directMatch = url.match(/youtube\.com\/([a-zA-Z0-9_-]{11})$/)
  if (directMatch) return `https://www.youtube.com/embed/${directMatch[1]}`
  // Loom
  if (url.includes('loom.com/share/')) return url.replace('/share/', '/embed/')
  return url
}

function generateTimeSlots() {
  const slots: string[] = []
  for (let h = 9; h < 18; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = (firstDay.getDay() + 6) % 7
  const days: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const TIME_SLOTS = generateTimeSlots()

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

const COUNTRY_CODES = [
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: '+377', flag: '🇲🇨', name: 'Monaco' },
  { code: '+1', flag: '🇺🇸', name: 'États-Unis' },
  { code: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: '+49', flag: '🇩🇪', name: 'Allemagne' },
  { code: '+34', flag: '🇪🇸', name: 'Espagne' },
  { code: '+39', flag: '🇮🇹', name: 'Italie' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+31', flag: '🇳🇱', name: 'Pays-Bas' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire' },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: '+243', flag: '🇨🇩', name: 'RD Congo' },
  { code: '+261', flag: '🇲🇬', name: 'Madagascar' },
  { code: '+242', flag: '🇨🇬', name: 'Congo' },
  { code: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: '+229', flag: '🇧🇯', name: 'Bénin' },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: '+224', flag: '🇬🇳', name: 'Guinée' },
  { code: '+222', flag: '🇲🇷', name: 'Mauritanie' },
  { code: '+235', flag: '🇹🇩', name: 'Tchad' },
  { code: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '+257', flag: '🇧🇮', name: 'Burundi' },
  { code: '+262', flag: '🇷🇪', name: 'La Réunion' },
  { code: '+596', flag: '🇲🇶', name: 'Martinique' },
  { code: '+590', flag: '🇬🇵', name: 'Guadeloupe' },
  { code: '+594', flag: '🇬🇫', name: 'Guyane' },
  { code: '+687', flag: '🇳🇨', name: 'Nouvelle-Calédonie' },
  { code: '+689', flag: '🇵🇫', name: 'Polynésie française' },
  { code: '+55', flag: '🇧🇷', name: 'Brésil' },
  { code: '+52', flag: '🇲🇽', name: 'Mexique' },
  { code: '+81', flag: '🇯🇵', name: 'Japon' },
  { code: '+86', flag: '🇨🇳', name: 'Chine' },
  { code: '+91', flag: '🇮🇳', name: 'Inde' },
  { code: '+971', flag: '🇦🇪', name: 'Émirats arabes unis' },
  { code: '+966', flag: '🇸🇦', name: 'Arabie saoudite' },
  { code: '+90', flag: '🇹🇷', name: 'Turquie' },
  { code: '+7', flag: '🇷🇺', name: 'Russie' },
  { code: '+48', flag: '🇵🇱', name: 'Pologne' },
  { code: '+46', flag: '🇸🇪', name: 'Suède' },
  { code: '+47', flag: '🇳🇴', name: 'Norvège' },
  { code: '+45', flag: '🇩🇰', name: 'Danemark' },
  { code: '+358', flag: '🇫🇮', name: 'Finlande' },
  { code: '+43', flag: '🇦🇹', name: 'Autriche' },
  { code: '+30', flag: '🇬🇷', name: 'Grèce' },
  { code: '+353', flag: '🇮🇪', name: 'Irlande' },
  { code: '+420', flag: '🇨🇿', name: 'Tchéquie' },
  { code: '+40', flag: '🇷🇴', name: 'Roumanie' },
  { code: '+36', flag: '🇭🇺', name: 'Hongrie' },
  { code: '+380', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+972', flag: '🇮🇱', name: 'Israël' },
  { code: '+20', flag: '🇪🇬', name: 'Égypte' },
  { code: '+27', flag: '🇿🇦', name: 'Afrique du Sud' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzanie' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+251', flag: '🇪🇹', name: 'Éthiopie' },
  { code: '+256', flag: '🇺🇬', name: 'Ouganda' },
  { code: '+61', flag: '🇦🇺', name: 'Australie' },
  { code: '+64', flag: '🇳🇿', name: 'Nouvelle-Zélande' },
  { code: '+82', flag: '🇰🇷', name: 'Corée du Sud' },
  { code: '+65', flag: '🇸🇬', name: 'Singapour' },
  { code: '+60', flag: '🇲🇾', name: 'Malaisie' },
  { code: '+66', flag: '🇹🇭', name: 'Thaïlande' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+62', flag: '🇮🇩', name: 'Indonésie' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+57', flag: '🇨🇴', name: 'Colombie' },
  { code: '+56', flag: '🇨🇱', name: 'Chili' },
  { code: '+54', flag: '🇦🇷', name: 'Argentine' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+51', flag: '🇵🇪', name: 'Pérou' },
  { code: '+593', flag: '🇪🇨', name: 'Équateur' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+53', flag: '🇨🇺', name: 'Cuba' },
  { code: '+509', flag: '🇭🇹', name: 'Haïti' },
  { code: '+1', flag: '🇩🇴', name: 'République dominicaine' },
]

export function CaptureForm() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const isEmbed = searchParams.get('embed') === 'true'

  // Style customization from URL params
  const paramPc = searchParams.get('pc')
  const paramBg = searchParams.get('bg')
  const paramTc = searchParams.get('tc')
  const paramBr = searchParams.get('br')
  const paramFont = searchParams.get('font')

  const primaryColor = paramPc ? `#${paramPc}` : '#2563eb'
  const bgColor = paramBg ? `#${paramBg}` : '#ffffff'
  const textColor = paramTc ? `#${paramTc}` : '#0f172a'
  const borderRadius = paramBr ? `${paramBr}px` : '12px'
  const fontFamily = paramFont ? `${paramFont}, system-ui, sans-serif` : undefined

  const hasCustomStyle = !!(paramPc || paramBg || paramTc || paramBr || paramFont)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+33')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const countryPickerRef = useRef<HTMLDivElement>(null)
  const [customData, setCustomData] = useState<Record<string, string>>({})

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

  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  const [infoCollapsed, setInfoCollapsed] = useState(false)
  const prospectTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  // Real availability slots from API
  const [realSlots, setRealSlots] = useState<{ date: string; time: string; member_ids: string[] }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [freeMode, setFreeMode] = useState(true)
  const [distribution, setDistribution] = useState<string>('round_robin')

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const res = await fetch(`${API_URL}?action=capture-info&slug=${slug}`)
        if (!res.ok) { setNotFound(true); return }
        const data = await res.json()
        if (data.campaign) {
          setCampaign(data.campaign)
          // Track page view (fire-and-forget)
          fetch(`${API_URL}?action=capture-view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
          }).catch(() => {})
        }
        else setNotFound(true)
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    fetchCampaign()
  }, [slug])

  // Fetch real availability slots
  useEffect(() => {
    if (!campaign || campaign.capture_type === 'without_rdv') return
    setSlotsLoading(true)
    fetch(`${API_URL}?action=capture-slots&slug=${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.freeMode) {
          setFreeMode(true)
        } else {
          setFreeMode(false)
          setRealSlots(data.slots || [])
          setDistribution(data.distribution || 'round_robin')
        }
      })
      .catch(() => setFreeMode(true))
      .finally(() => setSlotsLoading(false))
  }, [campaign, slug])

  // Available dates and time slots based on real availability
  const availableDates = useMemo(() => {
    if (freeMode) return null // null = all dates available
    return new Set(realSlots.map(s => s.date))
  }, [realSlots, freeMode])

  const availableTimesForDate = useMemo(() => {
    if (!selectedDate || freeMode) return null // null = all times available
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    return realSlots.filter(s => s.date === dateStr)
  }, [selectedDate, realSlots, freeMode])

  const isInfoComplete = useMemo(() => {
    if (!firstName.trim()) return false
    if (campaign?.email_required) {
      if (!email.trim() || !isValidEmail(email.trim())) return false
    } else if (email.trim() && !isValidEmail(email.trim())) {
      return false // If email is optional but entered, still validate format
    }
    if (campaign?.phone_required && !phone.trim()) return false
    for (const field of (campaign?.custom_fields || [])) {
      if (field.required && !customData[field.label]?.trim()) return false
    }
    return true
  }, [firstName, email, phone, customData, campaign])

  const fullPhone = phone.trim() ? `${countryCode} ${phone.trim()}` : ''

  // Re-expand form if user deletes required fields while collapsed
  useEffect(() => {
    if (!isInfoComplete && infoCollapsed) setInfoCollapsed(false)
  }, [isInfoComplete, infoCollapsed])

  // Passive lead tracking: save partial prospect when email or phone is entered
  const partialSavedRef = useRef(false)
  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const savePartialLead = useCallback(async () => {
    if (!slug || partialSavedRef.current) return
    if (!email.trim() && !phone.trim()) return
    partialSavedRef.current = true
    try {
      const name = `${firstName} ${lastName}`.trim()
      const pPhone = phone.trim() ? `${countryCode} ${phone.trim()}` : ''
      await fetch(`${API_URL}?action=capture-partial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, email, phone: pPhone, custom_data: customData }),
      })
    } catch { /* fire-and-forget */ }
  }, [slug, firstName, lastName, email, phone, countryCode, customData])

  useEffect(() => {
    if (submitted || partialSavedRef.current) return
    if (!email.trim() && !phone.trim()) return
    if (partialTimerRef.current) clearTimeout(partialTimerRef.current)
    partialTimerRef.current = setTimeout(() => savePartialLead(), 3000)
    return () => { if (partialTimerRef.current) clearTimeout(partialTimerRef.current) }
  }, [email, phone, submitted, savePartialLead])

  const isInscriptionMode = campaign?.capture_type === 'without_rdv'

  const handleSubmit = async () => {
    if (!isInfoComplete) return
    if (!isInscriptionMode && (!selectedDate || !selectedTime)) return
    setSubmitting(true)
    try {
      const name = `${firstName} ${lastName}`.trim()
      const payload: any = { slug, name, email, phone: fullPhone, custom_data: customData }
      if (!isInscriptionMode && selectedDate && selectedTime) {
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
        payload.date = dateStr
        payload.time = selectedTime
        payload.datetime_utc = toUTC(dateStr, selectedTime, prospectTimezone).toISOString()
        payload.prospect_timezone = prospectTimezone

        // Assign to a team member based on availability
        if (!freeMode) {
          const slotMatch = realSlots.find(s => s.date === dateStr && s.time === selectedTime)
          if (slotMatch && slotMatch.member_ids.length > 0) {
            if (slotMatch.member_ids.length === 1) {
              payload.assigned_member_id = slotMatch.member_ids[0]
            } else if (distribution === 'random') {
              payload.assigned_member_id = slotMatch.member_ids[Math.floor(Math.random() * slotMatch.member_ids.length)]
            } else {
              // round_robin: pick based on time hash for deterministic distribution
              const hash = dateStr.replace(/-/g, '') + selectedTime.replace(/:/g, '')
              const idx = parseInt(hash, 10) % slotMatch.member_ids.length
              payload.assigned_member_id = slotMatch.member_ids[isNaN(idx) ? 0 : idx]
            }
          }
        }
      }
      const res = await fetch(`${API_URL}?action=capture-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.prospect) {
        setSubmitted(true)
        // Notify parent window (for popup mode)
        if (window.parent !== window) {
          window.parent.postMessage('closeos-capture-done', '*')
        }
        const rUrl = data.redirect_url || campaign?.redirect_url
        if (rUrl) {
          setRedirectUrl(rUrl)
          setTimeout(() => { window.location.href = rUrl }, 2000)
        }
      } else alert(data.error || 'Une erreur est survenue')
    } catch { alert('Erreur réseau') }
    finally { setSubmitting(false) }
  }

  const calendarDays = getCalendarDays(calYear, calMonth)
  const isDatePast = (date: Date) => { const now = new Date(); now.setHours(0, 0, 0, 0); return date < now }
  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1) }

  if (loading) {
    return <div className={`min-h-screen flex items-center justify-center ${isEmbed ? '' : 'bg-slate-50'}`}><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div>
  }

  if (notFound) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isEmbed ? '' : 'bg-slate-50'}`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Campagne introuvable</h1>
          <p className="text-slate-500">Ce lien de capture n'est plus actif ou n'existe pas.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isEmbed ? '' : 'bg-slate-50'}`}>
        <div className="max-w-md mx-auto text-center p-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Merci !</h2>
          <p className="text-slate-500 mb-3">{isInscriptionMode ? 'Votre inscription a bien été enregistrée.' : 'Votre demande a bien été envoyée.'}</p>
          {!isInscriptionMode && selectedDate && selectedTime && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-3">
              <p className="text-sm font-semibold text-blue-800">Rendez-vous confirmé</p>
              <p className="text-sm text-blue-700 mt-1">
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à {selectedTime}
              </p>
            </div>
          )}
          {redirectUrl ? (
            <p className="text-xs text-slate-500 animate-pulse">Vous allez être redirigé...</p>
          ) : (
            <p className="text-xs text-slate-400">Vous recevrez une confirmation par email.</p>
          )}
        </div>
      </div>
    )
  }

  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 transition-colors"
  const videoEmbedUrl = campaign?.landing_video_url ? toEmbedUrl(campaign.landing_video_url) : null

  const customStyle: React.CSSProperties = hasCustomStyle ? {
    '--co-primary': primaryColor,
    '--co-bg': bgColor,
    '--co-text': textColor,
    '--co-radius': borderRadius,
    fontFamily,
    backgroundColor: bgColor,
    color: textColor,
  } as React.CSSProperties : {}

  const inputStyle: React.CSSProperties = hasCustomStyle ? {
    borderRadius,
    color: textColor,
    borderColor: `${primaryColor}33`,
  } : {}

  const btnStyle: React.CSSProperties = hasCustomStyle ? {
    backgroundColor: primaryColor,
    borderRadius,
    color: '#fff',
  } : {}

  return (
    <div className={`min-h-screen ${isEmbed ? '' : 'bg-slate-50'}`} style={customStyle}>
      <div className={`mx-auto flex min-h-screen ${isEmbed ? '' : 'max-w-6xl'}`}>

        {/* LEFT SIDE - Marketing */}
        {!isEmbed && (
          <div className="hidden lg:flex lg:w-[45%] flex-col justify-center px-10 xl:px-14 py-10">
            {campaign?.landing_subtitle && (
              <div className="mb-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3.5 py-1 text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  {campaign.landing_subtitle}
                </span>
              </div>
            )}

            <h1 className="text-3xl xl:text-4xl font-bold text-slate-900 leading-tight mb-4">
              {campaign?.landing_title || campaign?.name || 'Prenez rendez-vous'}
            </h1>

            {campaign?.landing_text && (
              <p className="text-base text-slate-500 leading-relaxed mb-6">
                {campaign.landing_text}
              </p>
            )}

            {videoEmbedUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <iframe
                  src={videoEmbedUrl}
                  className="w-full aspect-video"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}

            <div className="mt-auto pt-6">
              <p className="text-xs text-slate-400">
                Propulsé par <span className="font-semibold text-slate-500">CloseOS Business</span>
              </p>
            </div>
          </div>
        )}

        {/* RIGHT SIDE - Form + Calendar */}
        <div className={`flex-1 flex items-start justify-center ${isEmbed ? 'p-4' : 'bg-white lg:border-l border-slate-200 px-5 sm:px-8 lg:px-10 py-6 lg:py-8'}`}>
          <div className="w-full max-w-md">

            {/* Mobile header */}
            {!isEmbed && (
              <div className="lg:hidden mb-4">
                {campaign?.landing_subtitle && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
                    {campaign.landing_subtitle}
                  </span>
                )}
                <h1 className="text-xl font-bold text-slate-900 mb-1">
                  {campaign?.landing_title || campaign?.name || 'Prenez rendez-vous'}
                </h1>
                {campaign?.landing_text && (
                  <p className="text-sm text-slate-500">{campaign.landing_text}</p>
                )}
              </div>
            )}

            {/* Form header */}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-black">{campaign?.name || (isInscriptionMode ? 'Inscrivez-vous' : 'Réservez votre créneau')}</h2>
              <p className="text-sm text-black/60 mt-0.5">
                {isInscriptionMode ? 'Remplissez vos informations pour vous inscrire.' : 'Remplissez vos informations puis choisissez un créneau.'}
              </p>
            </div>

            {/* Progress */}
            {!isInscriptionMode && (
              <div className="flex items-center gap-2 mb-5">
                <div className={`h-1 flex-1 rounded-full transition-all duration-500 bg-blue-600`} />
                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${selectedDate && selectedTime ? 'bg-blue-600' : 'bg-slate-200'}`} />
              </div>
            )}

            {/* INFO SECTION - collapsible */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${infoCollapsed ? 'max-h-14' : 'max-h-[600px]'}`}>
              {infoCollapsed && (
                <button
                  onClick={() => setInfoCollapsed(false)}
                  className="w-full flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 mb-4 text-left transition-colors hover:bg-green-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-green-800 truncate">{firstName} {lastName}</span>
                    {email && <span className="text-xs text-green-600 truncate hidden sm:inline">{email}</span>}
                  </div>
                  <span className="text-xs text-green-600 font-medium flex-shrink-0 ml-2">Modifier</span>
                </button>
              )}

              {!infoCollapsed && (
                <div className="space-y-3 mb-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-black mb-1">Prénom *</label>
                      <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-black mb-1">Nom</label>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" className={inputCls} style={inputStyle} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Email {campaign?.email_required ? '*' : ''}</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@example.com" className={inputCls} style={inputStyle} />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Téléphone {campaign?.phone_required ? '*' : ''}</label>
                    <div className="relative flex gap-0" ref={countryPickerRef}>
                      <button
                        type="button"
                        onClick={() => { setShowCountryPicker(!showCountryPicker); setCountrySearch('') }}
                        className="flex items-center gap-1 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-2.5 py-2.5 text-sm hover:bg-slate-100 transition-colors flex-shrink-0"
                        style={hasCustomStyle ? { borderRadius: `${borderRadius} 0 0 ${borderRadius}`, borderColor: `${primaryColor}33` } : {}}
                      >
                        <span className="text-base">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag || '🌍'}</span>
                        <span className="text-xs text-black font-medium">{countryCode}</span>
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      </button>
                      {showCountryPicker && (
                        <div className="absolute top-full left-0 z-50 mt-1 w-64 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          <div className="sticky top-0 bg-white border-b border-slate-100 p-2">
                            <input
                              type="text"
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              placeholder="Rechercher un pays..."
                              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                            />
                          </div>
                          {COUNTRY_CODES
                            .filter(c => !countrySearch || c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch))
                            .map((c, i) => (
                            <button
                              key={`${c.code}-${c.name}-${i}`}
                              type="button"
                              onClick={() => { setCountryCode(c.code); setShowCountryPicker(false); setCountrySearch('') }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-blue-50 transition-colors ${countryCode === c.code ? 'bg-blue-50 text-blue-700' : 'text-black'}`}
                            >
                              <span className="text-base">{c.flag}</span>
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="text-xs text-slate-400 font-medium">{c.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="6 12 34 56 78"
                        className={`flex-1 rounded-r-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 transition-colors`}
                        style={hasCustomStyle ? { borderRadius: `0 ${borderRadius} ${borderRadius} 0`, color: textColor, borderColor: `${primaryColor}33` } : {}}
                      />
                    </div>
                  </div>

                  {(campaign?.custom_fields || []).map((field, idx) => (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-black mb-1">{field.label} {field.required ? '*' : ''}</label>
                      {field.type === 'select' ? (
                        <select value={customData[field.label] || ''} onChange={(e) => setCustomData({ ...customData, [field.label]: e.target.value })} className={inputCls} style={inputStyle}>
                          <option value="">Sélectionner...</option>
                          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input type={field.type} value={customData[field.label] || ''} onChange={(e) => setCustomData({ ...customData, [field.label]: e.target.value })} placeholder={field.label} className={inputCls} style={inputStyle} />
                      )}
                    </div>
                  ))}

                  {/* Manual continue button for RDV mode */}
                  {!isInscriptionMode && (
                    <button
                      onClick={() => setInfoCollapsed(true)}
                      disabled={!isInfoComplete}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      style={btnStyle}
                    >
                      <span>Continuer</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* INSCRIPTION MODE - Submit button */}
            {isInscriptionMode && (
              <div className="mt-4">
                <button
                  onClick={handleSubmit}
                  disabled={!isInfoComplete || submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={btnStyle}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>S'inscrire</span><ArrowRight className="h-4 w-4" /></>}
                </button>
                {!isEmbed && (
                  <p className="text-center text-xs text-slate-400 mt-3">
                    En vous inscrivant, vous acceptez nos conditions d'utilisation.
                  </p>
                )}
              </div>
            )}

            {/* CALENDAR SECTION - RDV mode only */}
            {!isInscriptionMode && <div className="relative">
              {/* Overlay - semi transparent, NO blur */}
              {!isInfoComplete && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 cursor-not-allowed">
                  <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2.5 shadow-sm">
                    <Lock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500 font-medium">Remplissez d'abord vos informations</span>
                  </div>
                </div>
              )}

              <div className={`transition-opacity duration-300 ${isInfoComplete ? 'opacity-100' : 'opacity-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Choisissez un créneau</h3>
                </div>

                {/* Calendar */}
                <div className="rounded-lg border border-slate-200 p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-800">{MONTHS_FR[calMonth]} {calYear}</span>
                    <div className="flex gap-1">
                      <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded transition-colors">
                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                      </button>
                      <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded transition-colors">
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 text-center">
                    {DAYS_FR.map((d, i) => (
                      <div key={i} className="py-1 text-xs font-medium text-slate-400">{d}</div>
                    ))}
                    {calendarDays.map((day, i) => {
                      if (!day) return <div key={`empty-${i}`} />
                      const past = isDatePast(day)
                      const weekend = freeMode ? isWeekend(day) : false
                      const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                      const noAvailability = !freeMode && availableDates && !availableDates.has(dayStr)
                      const disabled = past || weekend || noAvailability || !isInfoComplete
                      const selected = selectedDate && isSameDay(day, selectedDate)
                      const isToday = isSameDay(day, today)

                      return (
                        <button
                          key={i}
                          disabled={disabled}
                          onClick={() => { setSelectedDate(day); setSelectedTime(null) }}
                          className={`py-1.5 rounded text-sm font-medium transition-all ${
                            selected
                              ? 'bg-blue-600 text-white'
                              : isToday && !disabled
                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : disabled
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Time slots */}
                {selectedDate && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Créneaux disponibles</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(freeMode ? TIME_SLOTS : (availableTimesForDate || []).map(s => s.time)).map(slot => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`rounded border py-2 text-xs font-semibold transition-all ${
                            selectedTime === slot
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                    {!freeMode && availableTimesForDate && availableTimesForDate.length === 0 && (
                      <p className="text-xs text-slate-400 mt-2">Aucun créneau disponible ce jour. Essayez une autre date.</p>
                    )}
                  </div>
                )}

                {slotsLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    <span className="text-sm text-slate-500 ml-2">Chargement des disponibilités...</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!isInfoComplete || !selectedDate || !selectedTime || submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={btnStyle}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Réserver mon créneau</span><ArrowRight className="h-4 w-4" /></>}
                </button>

                {!isEmbed && (
                  <p className="text-center text-xs text-slate-400 mt-3">
                    En réservant, vous acceptez nos conditions d'utilisation.
                  </p>
                )}
              </div>
            </div>}
          </div>
        </div>
      </div>
    </div>
  )
}
