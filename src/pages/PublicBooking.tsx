import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check, Calendar, Clock, User, Phone, Mail, ChevronRight as ChevronRightIcon, Calendar as CalendarIcon, Copy, Video, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, addHours, isAfter, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { sendBookingEmails } from '../services/emailService'
import { cn } from '../lib/utils'

type BookingStep = 'time' | 'form' | 'success'

interface BookingData {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export function PublicBooking() {
  const { slug } = useParams<{ slug: string }>()
  
  // Data
  const [bookingType, setBookingType] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [availability, setAvailability] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // UI States
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [step, setStep] = useState<BookingStep>('time')
  const [bookingData, setBookingData] = useState<BookingData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingMeetings, setExistingMeetings] = useState<any[]>([])

  // 1. CHARGEMENT HYBRIDE
  useEffect(() => {
    const fetchBookingData = async () => {
      try {
        setLoading(true)
        
        // A. Récupérer le TYPE d'événement via le slug
        let typeData = null;
        let settingsData = null;

        const { data: bookingTypeData } = await supabase
          .from('booking_types')
          .select('*')
          .eq('slug', slug)
          .single()

        if (bookingTypeData) {
           typeData = bookingTypeData;
           // B. Récupérer les paramètres globaux (dispos) via user_id
           const { data: globalSettings } = await supabase
            .from('booking_settings')
            .select('*')
            .eq('user_id', bookingTypeData.user_id)
            .single()
            
           settingsData = globalSettings;
        } else {
           // Fallback: Ancien système
           const { data: legacySettings, error: legacyError } = await supabase
            .from('booking_settings')
            .select('*')
            .eq('slug', slug)
            .single()
            
           if (legacyError || !legacySettings) throw new Error('Ce lien de réservation est invalide ou a expiré.')
           
           typeData = legacySettings;
           settingsData = legacySettings;
        }

        setBookingType(typeData)
        setSettings(settingsData)
        setAvailability(settingsData?.availability || {})

        // C. Récupérer les conflits
        const { data: meetingsData } = await supabase
          .from('meetings')
          .select('date, time')
          .eq('user_id', typeData.user_id)
          .neq('status', 'cancelled')
        
        if (meetingsData) setExistingMeetings(meetingsData)

      } catch (err: any) {
        console.error(err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (slug) fetchBookingData()
  }, [slug])

  // 2. Calcul des dates disponibles
  const availableDates = useMemo(() => {
    if (!settings || !settings.availability) return []
    const dates = []
    const now = new Date()
    const minLeadDate = addHours(now, settings.min_lead_time || 0)

    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setDate(now.getDate() + i)
      
      const dayNameEn = format(date, 'eeee', { locale: undefined }).toLowerCase()
      const dayConfig = settings.availability[dayNameEn]

      if (dayConfig?.enabled && dayConfig.slots?.[0]) {
        const [endH, endM] = dayConfig.slots[0].end.split(':').map(Number)
        const endOfWorkingDay = new Date(date)
        endOfWorkingDay.setHours(endH, endM, 0, 0)
        
        const isFutureDay = isAfter(startOfDay(date), startOfDay(minLeadDate))
        const isTodayWithAvailableSlots = format(date, 'yyyy-MM-dd') === format(minLeadDate, 'yyyy-MM-dd') && isAfter(endOfWorkingDay, minLeadDate)

        if (isFutureDay || isTodayWithAvailableSlots) dates.push(date)
      }
    }
    return dates
  }, [settings])

  // 3. Calcul des créneaux horaires
  const timeSlots = useMemo(() => {
    if (!selectedDate || !settings || !bookingType) return []
    
    const dayNameEn = format(selectedDate, 'eeee', { locale: undefined }).toLowerCase()
    const dayConfig = settings.availability?.[dayNameEn]
    
    if (!dayConfig || !dayConfig.slots || dayConfig.slots.length === 0) return []

    const slots = []
    const [startH, startM] = dayConfig.slots[0].start.split(':').map(Number)
    const [endH, endM] = dayConfig.slots[0].end.split(':').map(Number)
    const slotDuration = bookingType.duration || settings.duration || 30

    let current = startH * 60 + startM
    const totalEnd = endH * 60 + endM
    const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd')
    const now = new Date()
    const minTime = addHours(now, settings.min_lead_time || 0)

    while (current + slotDuration <= totalEnd) {
      const slotStart = current
      const slotEnd = current + slotDuration
      const h = Math.floor(current / 60)
      const m = current % 60
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      
      const slotDate = new Date(selectedDate)
      slotDate.setHours(h, m, 0, 0)

      const isBusy = existingMeetings.some(m => {
        if (m.date !== formattedSelectedDate || !m.time || typeof m.time !== 'string') return false
        const parts = m.time.split(' - ')
        if (parts.length < 2) return false
        const [mStart, mEnd] = parts
        const [mStartH, mStartM] = mStart.split(':').map(Number)
        const [mEndH, mEndM] = mEnd.split(':').map(Number)
        const existingStart = mStartH * 60 + mStartM
        const existingEnd = mEndH * 60 + mEndM
        return slotStart < existingEnd && slotEnd > existingStart
      })

      if (!isBusy && isAfter(slotDate, minTime)) {
        slots.push(timeStr)
      }
      current += slotDuration
    }
    return slots
  }, [selectedDate, settings, bookingType, existingMeetings])

  const handleSubmitBooking = async () => {
    if (!selectedDate || !selectedTime || !bookingType) return
    setIsSubmitting(true)

    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd')
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const duration = bookingType.duration || 30
      
      const endTotal = hours * 60 + minutes + duration
      const formattedEndTime = `${Math.floor(endTotal / 60).toString().padStart(2, '0')}:${(endTotal % 60).toString().padStart(2, '0')}`
      const fullTimeRange = `${selectedTime} - ${formattedEndTime}`

      // PAS DE DAILY - Message statique pour le lieu
      const locationText = "À définir avec le Closer"

      // IMPORTANT : Injection du "Type: ..." pour que RendezVous.tsx puisse lire la provenance
      const meetingDescription = `Type: ${bookingType.title}\nEmail: ${bookingData.email}\nTéléphone: ${bookingData.phone}`

      // Sauvegarde DB
      const { error: dbError } = await supabase
        .from('meetings')
        .insert([{
          user_id: bookingType.user_id,
          title: `${bookingType.title} - ${bookingData.firstName} ${bookingData.lastName}`,
          contact: `${bookingData.firstName} ${bookingData.lastName}`,
          date: formattedDate,
          time: fullTimeRange,
          type: 'phone', // On force le type téléphone car pas de vidéo auto
          status: 'scheduled',
          location: locationText,
          description: meetingDescription 
        }])

      if (dbError) throw dbError

      // Envoi Email
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', bookingType.user_id).single()
      const agentEmail = settings?.agentEmail || profile?.email || 'contact@closer-os.com'

      await sendBookingEmails({
        prospectEmail: bookingData.email,
        prospectName: bookingData.firstName,
        agentEmail: agentEmail,
        date: formattedDate,
        time: selectedTime,
        meetingLink: locationText,
        duration: duration
      })

      setStep('success')
    } catch (error) {
      console.error('Erreur:', error)
      alert('Une erreur est survenue lors de la réservation.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // URL Google Agenda Helper
  const getGoogleCalendarUrl = () => {
    if (!selectedDate || !selectedTime || !bookingType) return ''
    const dateStr = format(selectedDate, 'yyyyMMdd')
    const [h, m] = selectedTime.split(':').map(Number)
    
    const startIso = `${dateStr}T${h.toString().padStart(2, '0')}${m.toString().padStart(2, '0')}00Z`
    
    const endTotal = h * 60 + m + (bookingType.duration || 30)
    const endH = Math.floor(endTotal / 60).toString().padStart(2, '0')
    const endM = (endTotal % 60).toString().padStart(2, '0')
    const endIso = `${dateStr}T${endH}${endM}00Z`

    const locationText = "À définir avec le Closer"
    const detailsText = "Le Closer prendra contact avec vous au plus vite ou quelques temps avant le rendez-vous pour préciser les modalités."

    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(bookingType.title)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(detailsText)}&location=${encodeURIComponent(locationText)}`
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-4">
      <div className="text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-xl font-bold">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* INFO GAUCHE */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-600/20">
                <CalendarIcon className="text-white w-8 h-8" />
              </div>
              <h1 className="text-3xl font-black text-white mb-4 tracking-tight">
                {bookingType?.title || 'Réserver un appel'}
              </h1>
              <p className="text-slate-400 leading-relaxed text-lg">
                {bookingType?.description || 'Sélectionnez un créneau pour échanger avec notre expert.'}
              </p>

              <div className="mt-10 space-y-4">
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-semibold">{bookingType?.duration || 30} minutes</span>
                </div>
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                    <Phone className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-semibold">Appel Téléphonique</span>
                </div>
              </div>
            </div>
          </div>

          {/* PROCESSUS DROITE */}
          <div className="lg:col-span-8">
            <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">
              
              {/* 1. CALENDRIER */}
              {step === 'time' && (
                <div className="animate-in fade-in duration-500">
                  <div className="p-8 md:p-12">
                    <div className="grid md:grid-cols-2 gap-12">
                      <div>
                        <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                          <Calendar className="text-blue-500 w-6 h-6" />
                          Date
                        </h2>
                        <div className="grid grid-cols-4 gap-3">
                          {availableDates.map((date) => (
                            <button
                              key={date.toISOString()}
                              onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                              className={cn(
                                "flex flex-col items-center py-4 rounded-2xl border transition-all duration-300",
                                selectedDate && format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20 scale-105"
                                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 hover:bg-slate-900"
                              )}
                            >
                              <span className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">
                                {format(date, 'EEE', { locale: fr })}
                              </span>
                              <span className="text-xl font-black">{format(date, 'd')}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                          <Clock className="text-blue-500 w-6 h-6" />
                          Heure
                        </h2>
                        {selectedDate ? (
                          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {timeSlots.map((time) => (
                              <button
                                key={time}
                                onClick={() => setSelectedTime(time)}
                                className={cn(
                                  "py-4 rounded-2xl border font-bold transition-all duration-300",
                                  selectedTime === time
                                    ? "bg-white text-slate-950 border-white shadow-xl scale-105"
                                    : "bg-slate-950 border-slate-800 text-slate-300 hover:border-blue-500/50 hover:text-blue-400"
                                )}
                              >
                                {time}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl p-8">
                            <Calendar className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-center font-medium">Choisissez une date</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/50 border-t border-slate-800 p-8 flex items-center justify-between">
                    <div className="text-sm">
                      {selectedDate && selectedTime ? (
                        <p className="text-slate-400">
                          <span className="text-white font-bold">{format(selectedDate, 'd MMMM', { locale: fr })} à {selectedTime}</span>
                        </p>
                      ) : (
                        <p className="text-slate-500">Sélectionnez un créneau</p>
                      )}
                    </div>
                    <button
                      disabled={!selectedDate || !selectedTime}
                      onClick={() => setStep('form')}
                      className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-blue-500 transition-all disabled:opacity-30 disabled:grayscale flex items-center gap-2 group shadow-lg shadow-blue-600/20"
                    >
                      Suivant <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* 2. FORMULAIRE */}
              {step === 'form' && (
                <div className="p-8 md:p-12 animate-in slide-in-from-right duration-500">
                  <button onClick={() => setStep('time')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-10 font-bold">
                    <ChevronLeft className="w-5 h-5" /> Retour
                  </button>

                  <h2 className="text-3xl font-black text-white mb-8">Vos informations</h2>

                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-slate-500 ml-1">Prénom</label>
                        <input className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white focus:border-blue-500 outline-none" placeholder="Jean" value={bookingData.firstName} onChange={e => setBookingData({...bookingData, firstName: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-slate-500 ml-1">Nom</label>
                        <input className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white focus:border-blue-500 outline-none" placeholder="Dupont" value={bookingData.lastName} onChange={e => setBookingData({...bookingData, lastName: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 ml-1">Email</label>
                      <input type="email" className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white focus:border-blue-500 outline-none" placeholder="jean@exemple.com" value={bookingData.email} onChange={e => setBookingData({...bookingData, email: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 ml-1">Téléphone</label>
                      <input className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white focus:border-blue-500 outline-none" placeholder="06 12 34 56 78" value={bookingData.phone} onChange={e => setBookingData({...bookingData, phone: e.target.value})} />
                    </div>

                    <button disabled={isSubmitting || !bookingData.email} onClick={handleSubmitBooking} className="w-full bg-blue-600 py-6 rounded-2xl font-black text-white hover:bg-blue-500 transition-all mt-6 disabled:opacity-30 flex items-center justify-center gap-3">
                      {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirmer mon rendez-vous'}
                    </button>
                  </div>
                </div>
              )}

              {/* 3. SUCCÈS */}
              {step === 'success' && (
                <div className="p-12 text-center animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-500/20 rotate-12">
                    <Check className="text-white w-12 h-12 stroke-[4px]" />
                  </div>
                  <h2 className="text-4xl font-black text-white mb-6">C'est confirmé !</h2>
                  <p className="text-xl text-slate-400 mb-12">
                    Rendez-vous le <span className="text-white font-bold">{format(selectedDate!, 'd MMMM', { locale: fr })} à {selectedTime}</span>.
                  </p>
                  
                  <div className="space-y-6 max-w-md mx-auto mb-10">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex items-center gap-4 text-left">
                      <div className="bg-blue-500/10 p-3 rounded-xl"><Phone className="text-blue-500 w-6 h-6" /></div>
                      <div>
                        <p className="text-white font-bold text-lg mb-1">Prise de contact</p>
                        <p className="text-slate-400 text-sm">Le Closer prendra contact avec vous au plus vite ou quelques temps avant le rendez-vous pour préciser les modalités.</p>
                      </div>
                    </div>

                    <a href={getGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-3 bg-white text-slate-950 py-4 rounded-2xl font-black hover:bg-slate-100 transition-all shadow-xl">
                      <CalendarIcon className="h-5 w-5" /> Ajouter à mon agenda
                    </a>
                  </div>
                  <button onClick={() => window.location.reload()} className="text-blue-500 font-black hover:text-blue-400 uppercase tracking-widest text-sm">Nouveau créneau</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}