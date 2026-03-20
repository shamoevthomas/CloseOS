import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Clock, Calendar, ChevronLeft, ChevronRight, CheckCircle2, User, Mail, Phone, Globe } from 'lucide-react'
import { toUTC, getTimezoneLabel } from '../lib/timezone'

interface SlotData { date: string; time: string }
interface BookingInfo {
  label: string
  duration: number
  companyName: string | null
  logoUrl: string | null
  slots?: SlotData[]
  freeMode?: boolean
}

const API_URL = '/api/business'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

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

const HOURS_FREE = Array.from({ length: 18 }, (_, i) => {
  const h = 9 + Math.floor(i / 2)
  const m = (i % 2) * 30
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

export function PublicBooking() {
  const { slug } = useParams<{ slug: string }>()
  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState<'form' | 'calendar' | 'confirm'>('form')

  // Calendar
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  // Prospect timezone
  const prospectTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`${API_URL}?action=booking-info&slug=${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setInfo(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  // Available dates set (for calendar highlighting)
  const availableDates = useMemo(() => {
    if (!info?.slots) return new Set<string>()
    return new Set(info.slots.map(s => s.date))
  }, [info?.slots])

  // Slots for selected date
  const slotsForDate = useMemo(() => {
    if (!selectedDate) return []
    if (info?.freeMode) {
      const dur = info.duration || 30
      const slots: string[] = []
      for (let mins = 9 * 60; mins + dur <= 18 * 60; mins += dur) {
        const h = Math.floor(mins / 60)
        const m = mins % 60
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      }
      return slots
    }
    return (info?.slots || []).filter(s => s.date === selectedDate).map(s => s.time)
  }, [selectedDate, info])

  const handleContactSubmit = () => {
    if (!name.trim()) return
    setStep('calendar')
  }

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !slug) return
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}?action=booking-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, name, email, phone, date: selectedDate, time: selectedTime,
          datetime_utc: toUTC(selectedDate, selectedTime, prospectTimezone).toISOString(),
          prospect_timezone: prospectTimezone,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Erreur')
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      alert('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const monthDates = getMonthDates(calYear, calMonth)
  const today = formatDateKey(new Date())
  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

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
    if (info?.freeMode) return d.getDay() !== 0 && d.getDay() !== 6
    return availableDates.has(key)
  }

  const endTime = (time: string, duration: number) => {
    const [h, m] = time.split(':').map(Number)
    const end = h * 60 + m + duration
    return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  }

  // ─── States ───
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800 mb-2">Lien introuvable</h1>
          <p className="text-sm text-slate-500">Ce lien de réservation n'existe pas ou a été supprimé.</p>
        </div>
      </div>
    )
  }

  if (done) {
    const dateLabel = selectedDate
      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Réservation confirmée !</h2>
          <p className="text-sm text-slate-600 mb-4">
            Votre rendez-vous a été réservé avec succès.
          </p>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-slate-800 capitalize">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-slate-800">
                {selectedTime} - {endTime(selectedTime!, info.duration)} ({info.duration} min)
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-amber-600" />
              <span className="text-slate-600">{getTimezoneLabel(prospectTimezone)}</span>
            </div>
          </div>
          {info.companyName && (
            <p className="mt-4 text-xs text-slate-400">
              {info.companyName} vous contactera pour confirmer.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <div className="border-b border-amber-200/60 bg-white/70 backdrop-blur-sm py-4">
        <div className="mx-auto max-w-4xl px-6 flex items-center justify-center gap-3">
          {info.logoUrl && (
            <img src={info.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          )}
          <span className="text-lg font-bold text-slate-800">
            {info.companyName || 'CloseOS'}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-amber-100">
          <div className="md:flex">
            {/* Left panel — info */}
            <div className="md:w-80 bg-gradient-to-b from-amber-50 to-amber-100/50 p-6 md:p-8 border-b md:border-b-0 md:border-r border-amber-200/60">
              {info.logoUrl && (
                <img src={info.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover mb-4" />
              )}
              <h1 className="text-xl font-bold text-slate-900 mb-2">{info.label}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>{info.duration} minutes</span>
              </div>

              {step === 'calendar' && name && (
                <div className="mt-6 pt-4 border-t border-amber-200/60 space-y-1.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Vos informations</p>
                  <p className="text-sm text-slate-700 flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" />{name}</p>
                  {email && <p className="text-sm text-slate-700 flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" />{email}</p>}
                  {phone && <p className="text-sm text-slate-700 flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" />{phone}</p>}
                  <button onClick={() => setStep('form')} className="text-xs text-amber-600 hover:underline mt-1">Modifier</button>
                </div>
              )}

              {step === 'confirm' && selectedDate && selectedTime && (
                <div className="mt-6 pt-4 border-t border-amber-200/60 space-y-1.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Créneau sélectionné</p>
                  <p className="text-sm text-slate-700 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span className="capitalize">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </p>
                  <p className="text-sm text-slate-700 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {selectedTime} - {endTime(selectedTime, info.duration)}
                  </p>
                </div>
              )}

              <p className="mt-8 text-[10px] text-slate-400">
                Propulsé par CloseOS
              </p>
            </div>

            {/* Right panel — form / calendar */}
            <div className="flex-1 p-6 md:p-8">
              {/* Step 1: Contact info */}
              {step === 'form' && (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold text-slate-900">Vos coordonnées</h2>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom complet *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="jean@example.com"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleContactSubmit}
                    disabled={!name.trim()}
                    className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Choisir un créneau
                  </button>
                </div>
              )}

              {/* Step 2: Calendar + time slots */}
              {step === 'calendar' && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Choisissez une date</h2>

                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={goPrevMonth} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-sm font-semibold text-slate-800 capitalize">{monthLabel}</span>
                    <button onClick={goNextMonth} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 mb-1">
                    {DAY_NAMES.map(d => (
                      <div key={d} className="py-2 text-center text-xs font-medium text-slate-400">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-6">
                    {monthDates.map((d, i) => {
                      const key = formatDateKey(d)
                      const selectable = isDateSelectable(d)
                      const isSelected = key === selectedDate
                      const isCurrentMonth = d.getMonth() === calMonth
                      return (
                        <button
                          key={i}
                          disabled={!selectable}
                          onClick={() => { setSelectedDate(key); setSelectedTime(null) }}
                          className={`
                            h-10 rounded-lg text-sm font-medium transition-all
                            ${!isCurrentMonth ? 'text-slate-200' : ''}
                            ${selectable && !isSelected ? 'text-slate-800 hover:bg-amber-100 hover:text-amber-800' : ''}
                            ${selectable && isSelected ? 'bg-amber-600 text-white shadow-sm' : ''}
                            ${!selectable && isCurrentMonth ? 'text-slate-300 cursor-not-allowed' : ''}
                            ${key === today && !isSelected ? 'ring-1 ring-amber-400' : ''}
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
                      <h3 className="text-sm font-semibold text-slate-800 mb-3">
                        Créneaux disponibles — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </h3>
                      {slotsForDate.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">Aucun créneau disponible</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[240px] overflow-y-auto">
                          {slotsForDate.map(time => (
                            <button
                              key={time}
                              onClick={() => { setSelectedTime(time); setStep('confirm') }}
                              className={`
                                rounded-lg border px-3 py-2.5 text-sm font-medium transition-all
                                ${selectedTime === time
                                  ? 'border-amber-600 bg-amber-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50'
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
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-slate-900">Confirmer votre réservation</h2>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-amber-600" />
                      <span className="text-sm font-medium text-slate-800 capitalize">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-amber-600" />
                      <span className="text-sm font-medium text-slate-800">
                        {selectedTime} - {endTime(selectedTime, info.duration)} ({info.duration} min)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-amber-600" />
                      <span className="text-sm font-medium text-slate-800">{name}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('calendar')}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Réserver
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
