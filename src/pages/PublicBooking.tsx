import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check, Calendar, Clock, User, Phone, Mail, ChevronRight as ChevronRightIcon, Calendar as CalendarIcon, Copy, Video, AlertCircle, Loader2 } from 'lucide-react'
import { createDailyRoom } from '../services/dailyService'
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
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [step, setStep] = useState<BookingStep>('time')
  const [bookingData, setBookingData] = useState<BookingData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  })
  const [meetingLink, setMeetingLink] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 1. Chargement des réglages personnalisés selon le slug
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('booking_settings')
          .select('*, user_id')
          .eq('slug', slug)
          .single()

        if (error || !data) throw new Error('Page de réservation introuvable')
        setSettings(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (slug) fetchSettings()
  }, [slug])

  // 2. Calcul des dates disponibles (Respect du délai min et des jours activés)
  const availableDates = useMemo(() => {
    if (!settings) return []
    const dates = []
    const now = new Date()
    const minLeadDate = addHours(now, settings.min_lead_time || 0)

    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setDate(now.getDate() + i)
      
      const dayNameEn = format(date, 'eeee', { locale: undefined }).toLowerCase()
      const dayConfig = settings.availability[dayNameEn]

      if (dayConfig?.enabled) {
        if (isAfter(startOfDay(date), startOfDay(minLeadDate)) || (format(date, 'yyyy-MM-dd') === format(minLeadDate, 'yyyy-MM-dd') && isAfter(date, minLeadDate))) {
          dates.push(date)
        }
      }
      if (dates.length >= 12) break
    }
    return dates
  }, [settings])

  // 3. Calcul des créneaux horaires (Respect des plages horaires définies)
  const timeSlots = useMemo(() => {
    if (!selectedDate || !settings) return []
    
    const dayNameEn = format(selectedDate, 'eeee', { locale: undefined }).toLowerCase()
    const dayConfig = settings.availability[dayNameEn]
    
    if (!dayConfig || !dayConfig.slots || dayConfig.slots.length === 0) return []

    const slots = []
    const { start, end } = dayConfig.slots[0]
    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)

    let current = startH * 60 + startM
    const totalEnd = endH * 60 + endM

    while (current + 30 <= totalEnd) {
      const h = Math.floor(current / 60)
      const m = current % 60
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      
      const slotDate = new Date(selectedDate)
      slotDate.setHours(h, m, 0, 0)
      if (isAfter(slotDate, addHours(new Date(), settings.min_lead_time || 0))) {
        slots.push(timeStr)
      }
      
      current += 30
    }
    return slots
  }, [selectedDate, settings])

  const handleSubmitBooking = async () => {
    if (!selectedDate || !selectedTime || !settings) return
    setIsSubmitting(true)

    try {
      const room = await createDailyRoom()
      setMeetingLink(room.url)

      const formattedDate = format(selectedDate, 'yyyy-MM-dd')
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const endTotal = hours * 60 + minutes + 30
      const formattedEndTime = `${Math.floor(endTotal / 60).toString().padStart(2, '0')}:${(endTotal % 60).toString().padStart(2, '0')}`
      const fullTimeRange = `${selectedTime} - ${formattedEndTime}`

      const { error: dbError } = await supabase
        .from('meetings')
        .insert([{
          user_id: settings.user_id,
          title: `Appel - ${bookingData.firstName} ${bookingData.lastName}`,
          contact: `${bookingData.firstName} ${bookingData.lastName}`,
          date: formattedDate,
          time: fullTimeRange,
          type: 'video',
          status: 'scheduled',
          location: room.url,
          description: `Email: ${bookingData.email}\nTéléphone: ${bookingData.phone}`
        }])

      if (dbError) throw dbError

      await sendBookingEmails({
        prospectEmail: bookingData.email,
        prospectName: bookingData.firstName,
        agentEmail: 'contact@closer-os.com',
        date: format(selectedDate, 'dd MMMM yyyy', { locale: fr }),
        time: selectedTime,
        meetingLink: room.url
      })

      setStep('success')
    } catch (error) {
      console.error('Erreur lors de la réservation:', error)
      alert('Une erreur est survenue lors de la réservation.')
    } finally {
      setIsSubmitting(false)
    }
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
          
          {/* COLONNE GAUCHE : INFO (Titre et Description pilotés par la DB) */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-600/20">
                <Video className="text-white w-8 h-8" />
              </div>
              <h1 className="text-3xl font-black text-white mb-4 tracking-tight">
                {settings?.title || 'Réserver un appel'}
              </h1>
              <p className="text-slate-400 leading-relaxed text-lg">
                {settings?.description || 'Choisissez une date sur le calendrier pour votre session.'}
              </p>

              <div className="mt-10 space-y-4">
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-semibold">30 minutes</span>
                </div>
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                    <Video className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-semibold">Visioconférence</span>
                </div>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : PROCESSUS DE RÉSERVATION */}
          <div className="lg:col-span-8">
            <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">
              
              {/* ÉTAPE : SÉLECTION DE L'HEURE */}
              {step === 'time' && (
                <div className="animate-in fade-in duration-500">
                  <div className="p-8 md:p-12">
                    <div className="grid md:grid-cols-2 gap-12">
                      {/* Partie Calendrier */}
                      <div>
                        <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                          <Calendar className="text-blue-500 w-6 h-6" />
                          Sélectionnez la date
                        </h2>
                        <div className="grid grid-cols-4 gap-3">
                          {availableDates.map((date) => (
                            <button
                              key={date.toISOString()}
                              onClick={() => {
                                setSelectedDate(date)
                                setSelectedTime(null)
                              }}
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

                      {/* Partie Créneaux Horaires */}
                      <div>
                        <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                          <Clock className="text-blue-500 w-6 h-6" />
                          Heure de début
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
                            <p className="text-center font-medium">Choisissez une date pour voir les créneaux</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Barre de pied de page */}
                  <div className="bg-slate-950/50 border-t border-slate-800 p-8 flex items-center justify-between">
                    <div className="text-sm">
                      {selectedDate && selectedTime ? (
                        <p className="text-slate-400">
                          Sélectionné : <span className="text-white font-bold">{format(selectedDate, 'd MMMM', { locale: fr })} à {selectedTime}</span>
                        </p>
                      ) : (
                        <p className="text-slate-500">Veuillez choisir un créneau</p>
                      )}
                    </div>
                    <button
                      disabled={!selectedDate || !selectedTime}
                      onClick={() => setStep('form')}
                      className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-blue-500 transition-all disabled:opacity-30 disabled:grayscale flex items-center gap-2 group shadow-lg shadow-blue-600/20"
                    >
                      Suivant
                      <ChevronRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE : FORMULAIRE */}
              {step === 'form' && (
                <div className="p-8 md:p-12 animate-in slide-in-from-right duration-500">
                  <button 
                    onClick={() => setStep('time')}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 font-bold"
                  >
                    <ChevronLeft className="w-5 h-5" /> Retour
                  </button>

                  <h2 className="text-3xl font-black text-white mb-2">Dernière étape</h2>
                  <p className="text-slate-400 mb-10">Complétez vos informations pour confirmer le rendez-vous.</p>

                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Prénom</label>
                        <input 
                          className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white focus:border-blue-500 outline-none transition-all font-medium" 
                          placeholder="Ex: Jean"
                          value={bookingData.firstName}
                          onChange={e => setBookingData({...bookingData, firstName: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Nom</label>
                        <input 
                          className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white focus:border-blue-500 outline-none transition-all font-medium" 
                          placeholder="Ex: Dupont"
                          value={bookingData.lastName}
                          onChange={e => setBookingData({...bookingData, lastName: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Email professionnel</label>
                      <input 
                        type="email"
                        className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white focus:border-blue-500 outline-none transition-all font-medium" 
                        placeholder="jean@entreprise.com"
                        value={bookingData.email}
                        onChange={e => setBookingData({...bookingData, email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Téléphone</label>
                      <input 
                        className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white focus:border-blue-500 outline-none transition-all font-medium" 
                        placeholder="+33 6 00 00 00 00"
                        value={bookingData.phone}
                        onChange={e => setBookingData({...bookingData, phone: e.target.value})}
                      />
                    </div>

                    <button 
                      disabled={isSubmitting || !bookingData.firstName || !bookingData.lastName || !bookingData.email}
                      onClick={handleSubmitBooking}
                      className="w-full bg-blue-600 py-6 rounded-2xl font-black text-white hover:bg-blue-500 transition-all mt-6 disabled:opacity-30 flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          Confirmation en cours...
                        </>
                      ) : (
                        'Confirmer mon rendez-vous'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE : SUCCÈS */}
              {step === 'success' && (
                <div className="p-12 md:p-20 text-center animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-500/20 rotate-12">
                    <Check className="text-white w-12 h-12 stroke-[4px]" />
                  </div>
                  <h2 className="text-4xl font-black text-white mb-6">C'est confirmé !</h2>
                  <p className="text-xl text-slate-400 mb-12 max-w-md mx-auto">
                    Votre rendez-vous est programmé pour le <span className="text-white font-bold">{format(selectedDate!, 'd MMMM', { locale: fr })} à {selectedTime}</span>.
                  </p>
                  
                  <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 mb-10 text-left space-y-4 max-w-md mx-auto">
                    <div className="flex items-center gap-4">
                      <Video className="text-blue-500 w-5 h-5" />
                      <span className="text-sm font-bold truncate">Lien de la réunion : {meetingLink}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed italic">
                      Un e-mail de confirmation avec toutes les informations vous a été envoyé.
                    </p>
                  </div>

                  <button 
                    onClick={() => window.location.reload()}
                    className="text-blue-500 font-black hover:text-blue-400 transition-colors uppercase tracking-widest text-sm"
                  >
                    Réserver un autre créneau
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}