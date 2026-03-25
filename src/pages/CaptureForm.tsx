import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, Calendar, ChevronLeft, ChevronRight, Lock, ArrowRight, ChevronDown } from 'lucide-react'
import { toUTC, fromUTC } from '../lib/timezone'

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

const isValidEmail = (e: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)

// Phone formatting per country code
const PHONE_FORMATS: Record<string, { maxDigits: number; groups: number[] }> = {
  '+33': { maxDigits: 9, groups: [1, 2, 2, 2, 2] },     // France: 6 12 34 56 78
  '+32': { maxDigits: 9, groups: [3, 2, 2, 2] },          // Belgique: 456 12 34 56
  '+41': { maxDigits: 9, groups: [2, 3, 2, 2] },          // Suisse: 79 123 45 67
  '+352': { maxDigits: 9, groups: [3, 3, 3] },             // Luxembourg
  '+377': { maxDigits: 8, groups: [2, 2, 2, 2] },          // Monaco
  '+1': { maxDigits: 10, groups: [3, 3, 4] },              // US/CA: 555 123 4567
  '+44': { maxDigits: 10, groups: [4, 3, 3] },             // UK: 7911 123 456
  '+49': { maxDigits: 11, groups: [3, 4, 4] },             // Allemagne
  '+34': { maxDigits: 9, groups: [3, 3, 3] },              // Espagne: 612 345 678
  '+39': { maxDigits: 10, groups: [3, 3, 4] },             // Italie
  '+351': { maxDigits: 9, groups: [3, 3, 3] },             // Portugal
  '+31': { maxDigits: 9, groups: [1, 2, 2, 2, 2] },       // Pays-Bas
  '+212': { maxDigits: 9, groups: [3, 3, 3] },             // Maroc
  '+216': { maxDigits: 8, groups: [2, 3, 3] },             // Tunisie
  '+213': { maxDigits: 9, groups: [3, 3, 3] },             // Algérie
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
  const paramLayout = searchParams.get('layout')
  const isHorizontal = paramLayout === 'horizontal'

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

  // Override dark body background and remove min-height in embed mode
  useEffect(() => {
    if (isEmbed) {
      document.body.style.background = bgColor
      document.body.style.minHeight = '0'
      document.body.style.margin = '0'
      document.body.style.overflow = 'visible'
      document.body.style.height = 'auto'
      document.documentElement.style.minHeight = '0'
      document.documentElement.style.overflow = 'visible'
      document.documentElement.style.height = 'auto'
    }
    return () => { document.body.style.background = '' }
  }, [isEmbed, bgColor])

  const formRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  const [infoCollapsed, setInfoCollapsed] = useState(false)

  // Send height to parent iframe for dynamic resize
  useEffect(() => {
    if (!isEmbed) return
    let lastHeight = 0
    const sendHeight = () => {
      // Measure actual content height using multiple methods for reliability
      const docH = document.documentElement.scrollHeight
      const bodyH = document.body.scrollHeight
      const refH = formRef.current ? Math.max(formRef.current.scrollHeight, formRef.current.offsetHeight) : 0
      const h = Math.max(docH, bodyH, refH)
      if (h > 0 && h !== lastHeight) {
        lastHeight = h
        window.parent.postMessage({ type: 'closeos-capture-resize', height: h }, '*')
      }
    }
    // Poll frequently during CSS transitions (600ms), then slow poll
    const fast = setInterval(sendHeight, 20)
    const timeout = setTimeout(() => clearInterval(fast), 700)
    const slow = setInterval(sendHeight, 300)
    sendHeight()
    // ResizeObserver for layout changes (responsive breakpoints, content reflow)
    if (formRef.current) {
      const ro = new ResizeObserver(() => sendHeight())
      ro.observe(formRef.current)
      // Also recalculate on window resize
      window.addEventListener('resize', sendHeight)
      return () => { clearInterval(fast); clearInterval(slow); clearTimeout(timeout); ro.disconnect(); window.removeEventListener('resize', sendHeight) }
    }
    window.addEventListener('resize', sendHeight)
    return () => { clearInterval(fast); clearInterval(slow); clearTimeout(timeout); window.removeEventListener('resize', sendHeight) }
  }, [isEmbed, selectedDate, infoCollapsed])
  const prospectTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  // Real availability slots from API
  const [realSlots, setRealSlots] = useState<{ date: string; time: string; member_ids: string[]; datetime_utc?: string }[]>([])
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

  // Convert API slots (in member's timezone) to prospect's timezone for display
  const prospectSlots = useMemo(() => {
    if (freeMode || !realSlots.length) return realSlots
    return realSlots.map(slot => {
      if (!slot.datetime_utc) return slot
      const local = fromUTC(slot.datetime_utc, prospectTimezone)
      return { ...slot, date: local.date, time: local.time }
    })
  }, [realSlots, freeMode, prospectTimezone])

  // Available dates and time slots based on real availability
  const availableDates = useMemo(() => {
    if (freeMode) return null // null = all dates available
    return new Set(prospectSlots.map(s => s.date))
  }, [prospectSlots, freeMode])

  const availableTimesForDate = useMemo(() => {
    if (!selectedDate || freeMode) return null // null = all times available
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    return prospectSlots.filter(s => s.date === dateStr)
  }, [selectedDate, prospectSlots, freeMode])

  const isInfoComplete = useMemo(() => {
    if (!firstName.trim()) return false
    if (campaign?.email_required) {
      if (!email.trim() || !isValidEmail(email.trim())) return false
    } else if (email.trim() && !isValidEmail(email.trim())) {
      return false // If email is optional but entered, still validate format
    }
    if (campaign?.phone_required) {
      const digits = phone.replace(/\D/g, '')
      const fmt = PHONE_FORMATS[countryCode]
      const requiredDigits = fmt ? fmt.maxDigits : 7
      if (digits.length < requiredDigits) return false
    }
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
        payload.prospect_timezone = prospectTimezone

        // For real slots, use the original datetime_utc; for freeMode, compute from prospect TZ
        if (!freeMode) {
          const matchSlot = prospectSlots.find(s => s.date === dateStr && s.time === selectedTime)
          payload.datetime_utc = matchSlot?.datetime_utc || toUTC(dateStr, selectedTime, prospectTimezone).toISOString()

          // Assign to a team member based on availability
          if (matchSlot && matchSlot.member_ids.length > 0) {
            if (matchSlot.member_ids.length === 1) {
              payload.assigned_member_id = matchSlot.member_ids[0]
            } else if (distribution === 'random') {
              payload.assigned_member_id = matchSlot.member_ids[Math.floor(Math.random() * matchSlot.member_ids.length)]
            } else {
              // round_robin: pick based on time hash for deterministic distribution
              const hash = dateStr.replace(/-/g, '') + selectedTime.replace(/:/g, '')
              const idx = parseInt(hash, 10) % matchSlot.member_ids.length
              payload.assigned_member_id = matchSlot.member_ids[isNaN(idx) ? 0 : idx]
            }
          }
        } else {
          payload.datetime_utc = toUTC(dateStr, selectedTime, prospectTimezone).toISOString()
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
    return <div className={`min-h-screen flex items-center justify-center ${isEmbed ? 'bg-white' : 'bg-[#fbf9f8]'}`}><Loader2 className="h-8 w-8 text-[#006c49] animate-spin" /></div>
  }

  if (notFound) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isEmbed ? 'bg-white' : 'bg-[#fbf9f8]'}`}>
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[#f5f3f2] flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#444748]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1b1c1b] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Campagne introuvable</h1>
          <p className="text-[#444748]">Ce lien de capture n'est plus actif ou n'existe pas.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isEmbed ? 'bg-white' : 'bg-[#fbf9f8]'}`}>
        <div className="max-w-md mx-auto text-center p-8">
          <div className="flex justify-center mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#006c49]/10">
              <CheckCircle2 className="h-10 w-10 text-[#006c49]" />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-[#1b1c1b] mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>Merci !</h2>
          <p className="text-[#444748] mb-4">{isInscriptionMode ? 'Votre inscription a bien été enregistrée.' : 'Votre demande a bien été envoyée.'}</p>
          {!isInscriptionMode && selectedDate && selectedTime && (
            <div className="rounded-2xl bg-[#f5f3f2] p-5 mb-4">
              <p className="text-sm font-bold text-[#1b1c1b]">Rendez-vous confirmé</p>
              <p className="text-sm text-[#444748] mt-1">
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à {selectedTime}
              </p>
            </div>
          )}
          {redirectUrl ? (
            <p className="text-xs text-[#444748]/60 animate-pulse">Vous allez être redirigé...</p>
          ) : (
            <p className="text-xs text-[#444748]/60">Vous recevrez une confirmation par email.</p>
          )}
        </div>
      </div>
    )
  }

  const inputCls = "w-full bg-transparent border-b-2 border-[#c4c7c7]/30 py-3 text-sm text-[#1b1c1b] placeholder:text-[#444748]/40 focus:border-[#006c49] focus:ring-0 transition-colors outline-none font-medium"
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
    borderRadius: 0,
    color: textColor,
    borderColor: `${primaryColor}33`,
  } : {}

  const btnStyle: React.CSSProperties = hasCustomStyle ? {
    backgroundColor: primaryColor,
    borderRadius: '9999px',
    color: '#fff',
  } : {}

  return (
    <div ref={formRef} className={`${isEmbed ? '' : 'min-h-screen'} ${isEmbed ? 'bg-white' : 'bg-[#fbf9f8]'}`} style={{ ...customStyle, ...(isEmbed ? { overflow: 'visible', height: 'auto' } : {}) }}>
      <div className={`mx-auto flex flex-col lg:flex-row ${isEmbed ? '' : 'min-h-screen max-w-screen-2xl'}`}>

        {/* LEFT SIDE - Marketing */}
        {!isEmbed && (
          <div className="hidden lg:flex lg:w-[42%] flex-col justify-center px-10 xl:px-16 py-16">
            {campaign?.landing_subtitle && (
              <div className="mb-6">
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#eae8e7] text-[#444748] text-[10px] font-bold tracking-widest uppercase">
                  {campaign.landing_subtitle}
                </span>
              </div>
            )}

            <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tighter leading-[0.9] text-[#1b1c1b] mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {campaign?.landing_title || campaign?.name || 'Prenez rendez-vous'}
            </h1>

            {campaign?.landing_text && (
              <p className="text-lg text-[#444748] leading-relaxed mb-8 max-w-lg">
                {campaign.landing_text}
              </p>
            )}

            {videoEmbedUrl && (
              <div className="relative group aspect-video rounded-2xl overflow-hidden bg-[#f5f3f2] shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                <iframe
                  src={videoEmbedUrl}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}

            <div className="mt-auto pt-8">
              <p className="text-[10px] tracking-widest uppercase text-[#444748]/40 font-bold">
                Propulsé par <span className="text-[#444748]/60">CloseOS Business</span>
              </p>
            </div>
          </div>
        )}

        {/* RIGHT SIDE - Form + Calendar */}
        <div className={`flex-1 flex items-start justify-center ${isEmbed ? (isHorizontal ? 'p-2 sm:p-3' : 'p-4') : 'px-5 sm:px-8 lg:px-12 py-8 lg:py-12'}`}>
          <div className={`w-full ${isHorizontal ? 'max-w-full' : 'max-w-xl'} ${isEmbed ? '' : 'bg-white rounded-2xl p-8 md:p-12 shadow-[0_20px_40px_rgba(27,28,27,0.04)]'}`} style={{ boxShadow: isEmbed ? undefined : 'inset 0 0 0 1px rgba(196,199,199,0.1), 0 20px 40px rgba(27,28,27,0.04)' }}>

            {/* Mobile header */}
            {!isEmbed && (
              <div className="lg:hidden mb-6">
                {campaign?.landing_subtitle && (
                  <span className="inline-block px-4 py-1.5 rounded-full bg-[#eae8e7] text-[#444748] text-[10px] font-bold tracking-widest uppercase mb-3">
                    {campaign.landing_subtitle}
                  </span>
                )}
                <h1 className="text-2xl font-extrabold text-[#1b1c1b] mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {campaign?.landing_title || campaign?.name || 'Prenez rendez-vous'}
                </h1>
                {campaign?.landing_text && (
                  <p className="text-sm text-[#444748]">{campaign.landing_text}</p>
                )}
              </div>
            )}

            {/* Horizontal layout wrapper */}
            <div className={isHorizontal && !isInscriptionMode ? (isEmbed ? 'flex flex-row gap-6' : 'flex flex-col md:flex-row gap-6') : ''}>
            {/* Left column in horizontal mode */}
            <div className={isHorizontal && !isInscriptionMode ? 'flex-1 min-w-0 flex flex-col' : ''}>

            {/* INFO SECTION - collapsible */}
            <div className={`transition-all duration-500 ease-in-out ${!isHorizontal && infoCollapsed ? 'max-h-16 overflow-hidden' : 'max-h-[2000px]'}`}>
              {!isHorizontal && infoCollapsed && (
                <button
                  onClick={() => setInfoCollapsed(false)}
                  className="w-full flex items-center justify-between rounded-full border border-[#006c49]/20 bg-[#006c49]/5 px-5 py-3 mb-6 text-left transition-colors hover:bg-[#006c49]/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="h-5 w-5 text-[#006c49] flex-shrink-0" />
                    <span className="text-sm font-bold text-[#1b1c1b] truncate">{firstName} {lastName}</span>
                    {email && <span className="text-xs text-[#006c49] truncate hidden sm:inline">{email}</span>}
                  </div>
                  <span className="text-xs text-[#006c49] font-bold flex-shrink-0 ml-2 uppercase tracking-wider">Modifier</span>
                </button>
              )}

              {!infoCollapsed && (
                <div className={`${isHorizontal ? 'space-y-4 mb-4' : 'space-y-8 mb-8'}`}>
                  {/* Step 1 header */}
                  <div className="flex items-center gap-3">
                    <div className={`${isHorizontal ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} rounded-full bg-[#1b1c1b] flex items-center justify-center text-white font-bold flex-shrink-0`}>1</div>
                    <h2 className={`${isHorizontal ? 'text-lg' : 'text-2xl'} font-bold text-[#1b1c1b]`} style={{ fontFamily: 'Manrope, sans-serif' }}>Informations personnelles</h2>
                  </div>

                  {/* Prénom / Nom côte à côte */}
                  <div className={`flex gap-4 ${isHorizontal ? 'mb-2' : 'mb-0'}`}>
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">Prénom *</label>
                      <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className={inputCls} style={inputStyle} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">Nom</label>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" className={inputCls} style={inputStyle} />
                    </div>
                  </div>

                  {/* Email */}
                  <div className={`space-y-2 ${isHorizontal ? 'mb-2' : ''}`}>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">Email {campaign?.email_required ? '*' : ''}</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@example.com" className={`${inputCls} ${email.trim() && !isValidEmail(email.trim()) ? 'border-red-400 focus:border-red-400' : ''}`} style={inputStyle} />
                    {email.trim() && !isValidEmail(email.trim()) && (
                      <p className="text-xs text-red-500 mt-1">Veuillez entrer une adresse email valide</p>
                    )}
                  </div>

                  {/* Téléphone */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">Téléphone {campaign?.phone_required ? '*' : ''}</label>
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
                        <div className="absolute top-full left-0 z-50 mt-1 w-64 max-h-60 overflow-y-auto rounded-2xl border border-[#c4c7c7]/10 bg-white shadow-xl">
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
                        style={hasCustomStyle ? { color: textColor, borderColor: `${primaryColor}33` } : {}}
                      />
                    </div>
                  </div>

                  {(campaign?.custom_fields || []).map((field, idx) => (
                    <div key={idx} className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 ml-1">{field.label} {field.required ? '*' : ''}</label>
                      {field.type === 'select' ? (
                        <select value={customData[field.label] || ''} onChange={(e) => setCustomData({ ...customData, [field.label]: e.target.value })} className="w-full bg-transparent border-b-2 border-[#c4c7c7]/30 py-3 text-sm text-[#1b1c1b] focus:border-[#006c49] focus:ring-0 transition-colors outline-none font-medium appearance-none cursor-pointer" style={inputStyle}>
                          <option value="">Sélectionner...</option>
                          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input type={field.type} value={customData[field.label] || ''} onChange={(e) => setCustomData({ ...customData, [field.label]: e.target.value })} placeholder={field.label} className={inputCls} style={inputStyle} />
                      )}
                    </div>
                  ))}

                  {/* Manual continue button for RDV mode (hidden in horizontal layout) */}
                  {!isInscriptionMode && !isHorizontal && (
                    <button
                      onClick={() => setInfoCollapsed(true)}
                      disabled={!isInfoComplete}
                      className="w-full flex items-center justify-center gap-3 rounded-full bg-[#1b1c1b] py-5 text-base font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
                      style={{ ...btnStyle, fontFamily: 'Manrope, sans-serif' }}
                    >
                      <span>Continuer</span>
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* INSCRIPTION MODE - Submit button */}
            {isInscriptionMode && (
              <div className="pt-8 border-t border-[#c4c7c7]/10">
                <button
                  onClick={handleSubmit}
                  disabled={!isInfoComplete || submitting}
                  className="w-full flex items-center justify-center gap-3 rounded-full bg-[#1b1c1b] py-5 text-base font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
                  style={{ ...btnStyle, fontFamily: 'Manrope, sans-serif' }}
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>S'inscrire</span><ArrowRight className="h-5 w-5" /></>}
                </button>
                <p className="text-center text-[10px] text-[#444748]/40 mt-6 font-medium leading-relaxed">
                  En continuant, vous acceptez d'être recontacté(e) et que vos informations soient enregistrées dans notre base de données.
                </p>
              </div>
            )}

            {/* Powered by CloseOS - in left column */}
            {isEmbed && (
              <div className="mt-auto pt-6">
                <p className="text-[10px] tracking-widest uppercase text-[#444748]/40 font-bold">
                  Propulsé par <span className="text-[#444748]/60">CloseOS</span>
                </p>
              </div>
            )}

            </div>{/* End left column */}

            {/* CALENDAR SECTION - RDV mode only */}
            {!isInscriptionMode && <div className={`relative ${isHorizontal ? 'flex-1 min-w-0' : 'mt-4'}`}>
              {/* Overlay */}
              {!isInfoComplete && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] rounded-2xl flex items-center justify-center cursor-not-allowed">
                  <div className="bg-white p-5 rounded-2xl shadow-xl flex items-center gap-3 border border-[#c4c7c7]/10">
                    <Lock className="h-5 w-5 text-[#006c49]" />
                    <p className="text-sm font-bold text-[#444748]">Remplissez vos informations pour continuer</p>
                  </div>
                </div>
              )}

              <div className={`transition-opacity duration-300 ${isInfoComplete ? 'opacity-100' : 'opacity-30 grayscale pointer-events-none'}`}>
                {/* Step 2 header */}
                <div className={`flex items-center gap-3 ${isHorizontal ? 'mb-4' : 'mb-6'}`}>
                  <div className={`${isHorizontal ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${isInfoComplete ? 'bg-[#1b1c1b] text-white' : 'border-2 border-[#c4c7c7] text-[#c4c7c7]'}`}>2</div>
                  <h2 className={`${isHorizontal ? 'text-lg' : 'text-2xl'} font-bold ${isInfoComplete ? 'text-[#1b1c1b]' : 'text-[#1b1c1b]/40'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>Choisissez un créneau</h2>
                </div>

                {/* Compact horizontal layout: calendar swaps with time slots */}
                {isHorizontal ? (
                  <div>
                    {/* Calendar - collapses smoothly when date is selected */}
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${selectedDate ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
                      <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                          <span className="text-lg font-bold text-[#1b1c1b]">{MONTHS_FR[calMonth]} {calYear}</span>
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
                          {DAYS_FR.map((d, i) => (
                            <div key={i} className="py-1 text-[10px] font-bold text-[#444748]/40 uppercase tracking-widest">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
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
                                className={`p-2.5 rounded-full text-sm font-medium transition-all ${
                                  selected ? 'bg-[#006c49] text-white shadow-lg shadow-[#006c49]/20'
                                    : isToday && !disabled ? 'bg-[#006c49]/10 text-[#006c49] hover:bg-[#006c49]/20'
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
                    </div>

                    {/* Time slots - appears smoothly when date is selected */}
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${selectedDate ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      {selectedDate && (
                        <div>
                          {/* Back button with selected date */}
                          <button
                            onClick={() => { setSelectedDate(null); setSelectedTime(null) }}
                            className="flex items-center gap-3 mb-5 px-4 py-2.5 rounded-full bg-[#006c49]/8 hover:bg-[#006c49]/15 transition-colors group"
                          >
                            <ChevronLeft className="h-4 w-4 text-[#006c49] group-hover:-translate-x-0.5 transition-transform" />
                            <Calendar className="h-4 w-4 text-[#006c49]" />
                            <span className="text-sm font-bold text-[#006c49]">
                              {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                            <span className="text-xs text-[#006c49]/60 font-medium">— Changer de date</span>
                          </button>

                          {/* Time slots in wide grid */}
                          <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-3">Créneaux disponibles</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                              {(freeMode ? TIME_SLOTS : (availableTimesForDate || []).map(s => s.time)).map(slot => (
                                <button
                                  key={slot}
                                  onClick={() => setSelectedTime(slot)}
                                  className={`py-2.5 px-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    selectedTime === slot
                                      ? 'bg-[#1b1c1b] text-white shadow-lg'
                                      : 'border border-[#c4c7c7]/30 text-[#1b1c1b] hover:border-[#006c49]'
                                  }`}
                                >
                                  <span>{slot}</span>
                                  {selectedTime === slot && <CheckCircle2 className="h-3.5 w-3.5" />}
                                </button>
                              ))}
                            </div>
                            {!freeMode && availableTimesForDate && availableTimesForDate.length === 0 && (
                              <p className="text-xs text-[#444748]/40 mt-2">Aucun créneau disponible ce jour. Essayez une autre date.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Vertical layout: standard side-by-side grid */
                  <div className="grid gap-10 grid-cols-1 md:grid-cols-2">
                    {/* Calendar */}
                    <div>
                      <div className="flex items-center justify-between mb-4 px-1">
                        <span className="text-lg font-bold text-[#1b1c1b]">{MONTHS_FR[calMonth]} {calYear}</span>
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
                        {DAYS_FR.map((d, i) => (
                          <div key={i} className="py-1 text-[10px] font-bold text-[#444748]/40 uppercase tracking-widest">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
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
                              className={`p-2.5 rounded-full text-sm font-medium transition-all ${
                                selected ? 'bg-[#006c49] text-white shadow-lg shadow-[#006c49]/20'
                                  : isToday && !disabled ? 'bg-[#006c49]/10 text-[#006c49] hover:bg-[#006c49]/20'
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
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-4">Créneaux disponibles</h3>
                      {selectedDate ? (
                        <div className="max-h-72 overflow-y-auto pr-1">
                          <div className="grid grid-cols-2 gap-2">
                            {(freeMode ? TIME_SLOTS : (availableTimesForDate || []).map(s => s.time)).map(slot => (
                              <button
                                key={slot}
                                onClick={() => setSelectedTime(slot)}
                                className={`py-3 px-4 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                  selectedTime === slot
                                    ? 'bg-[#1b1c1b] text-white shadow-lg'
                                    : 'border border-[#c4c7c7]/30 text-[#1b1c1b] hover:border-[#006c49]'
                                }`}
                              >
                                <span>{slot}</span>
                                {selectedTime === slot && <CheckCircle2 className="h-4 w-4" />}
                              </button>
                            ))}
                          </div>
                          {!freeMode && availableTimesForDate && availableTimesForDate.length === 0 && (
                            <p className="text-xs text-[#444748]/40 mt-2">Aucun créneau disponible ce jour. Essayez une autre date.</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-[#444748]/40">Sélectionnez une date pour voir les créneaux.</p>
                      )}
                    </div>
                  </div>
                )}

                {slotsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 text-[#006c49] animate-spin" />
                    <span className="text-sm text-[#444748] ml-2">Chargement des disponibilités...</span>
                  </div>
                )}

                {/* Submit */}
                <div className={`${isHorizontal ? 'pt-4 mt-4' : 'pt-6 mt-6'} border-t border-[#c4c7c7]/10`}>
                  <button
                    onClick={handleSubmit}
                    disabled={!isInfoComplete || !selectedDate || !selectedTime || submitting}
                    className={`w-full flex items-center justify-center gap-3 rounded-full bg-[#1b1c1b] ${isHorizontal ? 'py-3.5 text-sm' : 'py-5 text-base'} font-extrabold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xl group`}
                    style={{ ...btnStyle, fontFamily: 'Manrope, sans-serif' }}
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>Confirmer le rendez-vous</span><ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" /></>}
                  </button>

                  <p className={`text-center text-[10px] text-[#444748]/40 ${isHorizontal ? 'mt-3' : 'mt-6'} font-medium leading-relaxed`}>
                    En continuant, vous acceptez d'être recontacté(e) et que vos informations soient enregistrées dans notre base de données.
                  </p>
                </div>
              </div>
            </div>}

            </div>{/* End horizontal layout wrapper */}

          </div>
        </div>
      </div>

      {/* Footer */}
      {!isEmbed && (
        <footer className="bg-[#fbf9f8] w-full py-10 px-8">
          <div className="flex flex-col md:flex-row justify-between items-center max-w-screen-2xl mx-auto w-full gap-6">
            <div className="font-bold text-[#1b1c1b] text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>CloseOS</div>
            <div className="text-[10px] tracking-widest uppercase text-[#444748]/40 font-bold">
              Propulsé par CloseOS Business
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
