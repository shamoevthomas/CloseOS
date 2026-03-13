import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, Calendar, ChevronLeft, ChevronRight, Lock, ArrowRight } from 'lucide-react'

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
}

const API_URL = '/api/business'

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
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const TIME_SLOTS = generateTimeSlots()

export function CaptureForm() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const isEmbed = searchParams.get('embed') === 'true'

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [customData, setCustomData] = useState<Record<string, string>>({})

  // Calendar
  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  // Info section collapse
  const [infoCollapsed, setInfoCollapsed] = useState(false)

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const res = await fetch(`${API_URL}?action=capture-info&slug=${slug}`)
        if (!res.ok) { setNotFound(true); return }
        const data = await res.json()
        if (data.campaign) setCampaign(data.campaign)
        else setNotFound(true)
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    fetchCampaign()
  }, [slug])

  // Check if form info is complete
  const isInfoComplete = useMemo(() => {
    if (!firstName.trim()) return false
    if (campaign?.email_required && !email.trim()) return false
    if (campaign?.phone_required && !phone.trim()) return false
    // Check required custom fields
    for (const field of (campaign?.custom_fields || [])) {
      if (field.required && !customData[field.label]?.trim()) return false
    }
    return true
  }, [firstName, email, phone, customData, campaign])

  // Auto-collapse info section when complete
  useEffect(() => {
    if (isInfoComplete && !infoCollapsed) {
      const timer = setTimeout(() => setInfoCollapsed(true), 600)
      return () => clearTimeout(timer)
    }
    if (!isInfoComplete && infoCollapsed) {
      setInfoCollapsed(false)
    }
  }, [isInfoComplete])

  const handleSubmit = async () => {
    if (!isInfoComplete) return
    if (!selectedDate || !selectedTime) return
    setSubmitting(true)
    try {
      const name = `${firstName} ${lastName}`.trim()
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
      const res = await fetch(`${API_URL}?action=capture-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, name, email, phone,
          custom_data: customData,
          date: dateStr,
          time: selectedTime,
        }),
      })
      const data = await res.json()
      if (data.prospect) setSubmitted(true)
      else alert(data.error || 'Une erreur est survenue')
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
          <div className="flex justify-center mb-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Merci !</h2>
          <p className="text-slate-500 mb-3">Votre demande a bien été envoyée.</p>
          {selectedDate && selectedTime && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-4">
              <p className="text-sm font-semibold text-blue-800">
                Rendez-vous confirmé
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à {selectedTime}
              </p>
            </div>
          )}
          <p className="text-xs text-slate-400">Vous recevrez une confirmation par email.</p>
        </div>
      </div>
    )
  }

  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"

  return (
    <div className={`min-h-screen ${isEmbed ? '' : 'bg-slate-50'}`}>
      <div className={`mx-auto flex min-h-screen ${isEmbed ? '' : 'max-w-6xl'}`}>

        {/* LEFT SIDE - Marketing content */}
        {!isEmbed && (
          <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-16 py-12">
            {/* Subtitle badge */}
            {campaign?.landing_subtitle && (
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  {campaign.landing_subtitle}
                </span>
              </div>
            )}

            {/* Title */}
            <h1 className="text-4xl xl:text-5xl font-bold text-slate-900 leading-tight mb-6">
              {campaign?.landing_title || campaign?.name || 'Prenez rendez-vous'}
            </h1>

            {/* Text */}
            {campaign?.landing_text && (
              <p className="text-lg text-slate-500 leading-relaxed mb-8">
                {campaign.landing_text}
              </p>
            )}

            {/* Video */}
            {campaign?.landing_video_url && (
              <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <iframe
                  src={campaign.landing_video_url}
                  className="w-full aspect-video"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}

            {/* Footer powered by */}
            <div className="mt-auto pt-8">
              <p className="text-xs text-slate-400">
                Propulsé par <span className="font-semibold text-slate-500">CloseOS Business</span>
              </p>
            </div>
          </div>
        )}

        {/* RIGHT SIDE - Form + Calendar */}
        <div className={`flex-1 flex items-start justify-center ${isEmbed ? 'p-4' : 'bg-white lg:border-l border-slate-200 px-6 sm:px-10 lg:px-12 py-8 lg:py-12'}`}>
          <div className="w-full max-w-md">

            {/* Mobile header (shows landing info on mobile) */}
            {!isEmbed && (
              <div className="lg:hidden mb-6">
                {campaign?.landing_subtitle && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">
                    {campaign.landing_subtitle}
                  </span>
                )}
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  {campaign?.landing_title || campaign?.name || 'Prenez rendez-vous'}
                </h1>
                {campaign?.landing_text && (
                  <p className="text-sm text-slate-500">{campaign.landing_text}</p>
                )}
              </div>
            )}

            {/* Form header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {campaign?.name || 'Réservez votre créneau'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Remplissez vos informations puis choisissez un créneau.
              </p>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${isInfoComplete ? 'bg-blue-600' : 'bg-blue-600'}`} />
              <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${selectedDate && selectedTime ? 'bg-blue-600' : 'bg-slate-200'}`} />
            </div>

            {/* INFO SECTION - collapsible */}
            <div
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                infoCollapsed ? 'max-h-16 opacity-80' : 'max-h-[800px] opacity-100'
              }`}
            >
              {/* Collapsed summary */}
              {infoCollapsed && (
                <button
                  onClick={() => setInfoCollapsed(false)}
                  className="w-full flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 mb-4 text-left transition-colors hover:bg-green-100"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">{firstName} {lastName}</span>
                    <span className="text-xs text-green-600">{email}</span>
                  </div>
                  <span className="text-xs text-green-600 font-medium">Modifier</span>
                </button>
              )}

              {/* Form fields */}
              {!infoCollapsed && (
                <div className="space-y-4 mb-6">
                  {/* Name row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom *</label>
                      <input
                        type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Jean" className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom</label>
                      <input
                        type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                        placeholder="Dupont" className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Email {campaign?.email_required ? '*' : ''}
                    </label>
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="jean@example.com" className={inputCls}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Téléphone {campaign?.phone_required ? '*' : ''}
                    </label>
                    <input
                      type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="+33 6 12 34 56 78" className={inputCls}
                    />
                  </div>

                  {/* Custom fields */}
                  {(campaign?.custom_fields || []).map((field, idx) => (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={customData[field.label] || ''}
                          onChange={(e) => setCustomData({ ...customData, [field.label]: e.target.value })}
                          className={inputCls}
                        >
                          <option value="">Sélectionner...</option>
                          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={customData[field.label] || ''}
                          onChange={(e) => setCustomData({ ...customData, [field.label]: e.target.value })}
                          placeholder={field.label}
                          className={inputCls}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CALENDAR SECTION */}
            <div className="relative">
              {/* Overlay when info not complete */}
              {!isInfoComplete && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-50/80 backdrop-blur-[1px] cursor-not-allowed group">
                  <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2.5 shadow-sm">
                    <Lock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500 font-medium">Remplissez d'abord vos informations</span>
                  </div>
                </div>
              )}

              <div className={`transition-opacity duration-300 ${isInfoComplete ? 'opacity-100' : 'opacity-40'}`}>
                {/* Calendar header */}
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Choisissez un créneau</h3>
                </div>

                {/* Calendar */}
                <div className="rounded-xl border border-slate-200 p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-800">
                      {MONTHS_FR[calMonth]} {calYear}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" disabled={!isInfoComplete}>
                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                      </button>
                      <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" disabled={!isInfoComplete}>
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {DAYS_FR.map(d => (
                      <div key={d} className="py-1 text-xs font-medium text-slate-400 uppercase">{d.charAt(0)}</div>
                    ))}
                    {calendarDays.map((day, i) => {
                      if (!day) return <div key={`empty-${i}`} />
                      const past = isDatePast(day)
                      const weekend = isWeekend(day)
                      const disabled = past || weekend || !isInfoComplete
                      const selected = selectedDate && isSameDay(day, selectedDate)
                      const isToday = isSameDay(day, today)

                      return (
                        <button
                          key={i}
                          disabled={disabled}
                          onClick={() => { setSelectedDate(day); setSelectedTime(null) }}
                          className={`py-2 rounded-lg text-sm font-medium transition-all ${
                            selected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : isToday
                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : disabled
                                  ? 'text-slate-200 cursor-not-allowed'
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
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Créneaux disponibles</p>
                    <div className="grid grid-cols-4 gap-2">
                      {TIME_SLOTS.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`rounded-lg border py-2.5 text-xs font-semibold transition-all ${
                            selectedTime === slot
                              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                              : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={!isInfoComplete || !selectedDate || !selectedTime || submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Réserver mon créneau
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {!isEmbed && (
                  <p className="text-center text-xs text-slate-400 mt-4">
                    En réservant, vous acceptez nos conditions d'utilisation.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
