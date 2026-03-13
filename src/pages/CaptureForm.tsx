import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

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
}

const API_URL = '/api/business'

// Generate time slots (9:00 to 18:00, 30min intervals)
function generateTimeSlots() {
  const slots: string[] = []
  for (let h = 9; h < 18; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

// Generate calendar days for a month
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = (firstDay.getDay() + 6) % 7 // Monday start
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
  const [step, setStep] = useState(1) // 1: info, 2: rdv, 3: confirmation
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [customData, setCustomData] = useState<Record<string, string>>({})

  // Calendar state
  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        // Use capture-submit endpoint with GET to fetch campaign info
        // Actually, we need a public endpoint. Let's fetch via the slug
        const res = await fetch(`${API_URL}?action=capture-info&slug=${slug}`)
        if (!res.ok) {
          setNotFound(true)
          return
        }
        const data = await res.json()
        if (data.campaign) {
          setCampaign(data.campaign)
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchCampaign()
  }, [slug])

  const handleSubmitInfo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setStep(2)
  }

  const handleSubmitAppointment = async () => {
    setSubmitting(true)
    try {
      const payload: any = { slug, name, email, phone, custom_data: customData }
      if (selectedDate && selectedTime) {
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
        payload.date = dateStr
        payload.time = selectedTime
      }
      const res = await fetch(`${API_URL}?action=capture-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.prospect) {
        setStep(3)
      } else {
        alert(data.error || 'Une erreur est survenue')
      }
    } catch {
      alert('Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  const calendarDays = getCalendarDays(calYear, calMonth)

  const isDatePast = (date: Date) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return date < now
  }

  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) }
    else setCalMonth(calMonth - 1)
  }

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) }
    else setCalMonth(calMonth + 1)
  }

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isEmbed ? '' : 'bg-[#FDF6EE]'}`}>
        <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isEmbed ? '' : 'bg-[#FDF6EE]'}`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Campagne introuvable</h1>
          <p className="text-slate-500">Ce lien de capture n'est plus actif ou n'existe pas.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isEmbed ? '' : 'bg-[#FDF6EE] py-8 px-4'}`}>
      <div className={`mx-auto w-full ${isEmbed ? 'max-w-full' : 'max-w-lg'}`}>
        {/* Header */}
        {!isEmbed && (
          <div className="text-center mb-6">
            <img src="/logo.PNG" alt="CloseOS" className="h-10 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900">{campaign?.name}</h1>
            {campaign?.description && (
              <p className="text-sm text-slate-500 mt-1">{campaign.description}</p>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-amber-500' : 'bg-slate-200'
            }`} />
          ))}
        </div>

        {/* Step 1: Info */}
        {step === 1 && (
          <form onSubmit={handleSubmitInfo} className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Vos informations</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet *</label>
                <input
                  type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                <input
                  type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Custom fields */}
              {(campaign?.custom_fields || []).map((field, idx) => (
                <div key={idx}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      required={field.required}
                      value={customData[field.label] || ''}
                      onChange={(e) => setCustomData({ ...customData, [field.label]: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">Sélectionner...</option>
                      {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      required={field.required}
                      value={customData[field.label] || ''}
                      onChange={(e) => setCustomData({ ...customData, [field.label]: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-xl bg-amber-600 py-3 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
            >
              Continuer
            </button>
          </form>
        )}

        {/* Step 2: Appointment */}
        {step === 2 && (
          <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-bold text-slate-900">Prendre rendez-vous</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Sélectionnez un créneau qui vous convient (optionnel)</p>

            {/* Calendar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
                <span className="text-sm font-semibold text-slate-800">
                  {MONTHS_FR[calMonth]} {calYear}
                </span>
                <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {DAYS_FR.map(d => (
                  <div key={d} className="py-1 font-medium text-slate-400">{d}</div>
                ))}
                {calendarDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />
                  const past = isDatePast(day)
                  const weekend = isWeekend(day)
                  const disabled = past || weekend
                  const selected = selectedDate && isSameDay(day, selectedDate)
                  const isToday = isSameDay(day, today)

                  return (
                    <button
                      key={i}
                      disabled={disabled}
                      onClick={() => setSelectedDate(day)}
                      className={`py-1.5 rounded-lg text-sm transition-colors ${
                        selected
                          ? 'bg-amber-600 text-white font-medium'
                          : isToday
                            ? 'bg-amber-50 text-amber-700 font-medium'
                            : disabled
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-700 hover:bg-amber-50'
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
                <p className="text-sm font-medium text-slate-700 mb-2">Créneaux disponibles</p>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                        selectedTime === slot
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-200 text-slate-600 hover:border-amber-200 hover:bg-amber-50/50'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Retour
              </button>
              <button
                onClick={handleSubmitAppointment}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {selectedDate && selectedTime ? 'Confirmer le RDV' : 'Envoyer sans RDV'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Merci !</h2>
            <p className="text-sm text-slate-500 mb-2">
              Votre demande a bien été envoyée.
            </p>
            {selectedDate && selectedTime && (
              <p className="text-sm text-amber-700 font-medium">
                Rendez-vous le {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {selectedTime}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-4">Vous recevrez une confirmation par email.</p>
          </div>
        )}

        {/* Footer */}
        {!isEmbed && (
          <p className="text-center text-xs text-slate-400 mt-6">
            Propulsé par <span className="font-medium text-amber-600">CloseOS Business</span>
          </p>
        )}
      </div>
    </div>
  )
}
