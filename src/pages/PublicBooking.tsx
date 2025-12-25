import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check, Calendar, Clock, User, Phone, Mail, ChevronRight as ChevronRightIcon, Calendar as CalendarIcon, Copy, Video } from 'lucide-react'
import { createDailyRoom } from '../services/dailyService'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { sendBookingEmails } from '../services/emailService'

type BookingStep = 'time' | 'form' | 'success'

interface BookingData {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export function PublicBooking() {
  const { slug } = useParams<{ slug: string }>()
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [agentEmail, setAgentEmail] = useState<string | null>(null)
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

  // RÉCUPÉRATION DU PROFIL
  useEffect(() => {
    async function getUserBySlug() {
      if (!slug || slug === 'undefined') return;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('booking_slug', slug)
          .maybeSingle()

        if (profile) {
          setTargetUserId(profile.id)
          setAgentEmail(profile.email || profile.Email || null)
        } else {
          console.error("Profil introuvable pour le slug:", slug);
        }
        
        if (error) throw error
      } catch (err) {
        console.error("Erreur récupération profil:", err)
      }
    }
    getUserBySlug()
  }, [slug])

  const baseTimeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
  ]

  const availableTimeSlots = useMemo(() => {
    if (!selectedDate) return []
    const now = new Date()
    const isToday = selectedDate.toDateString() === now.toDateString()
    
    if (isToday) {
      const currentHour = now.getHours()
      const currentMinutes = now.getMinutes()
      return baseTimeSlots.filter(time => {
        const [hour, minutes] = time.split(':').map(Number)
        return hour > currentHour || (hour === currentHour && minutes > currentMinutes)
      })
    }
    return baseTimeSlots
  }, [selectedDate])

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
    setStep('form')
  }

  const handleSubmitBooking = async () => {
    if (!targetUserId) {
      return alert("Erreur de configuration : Impossible de lier la réservation à votre compte.");
    }

    setIsSubmitting(true)

    try {
      const videoLink = await createDailyRoom()
      setMeetingLink(videoLink)
      
      const fullName = `${bookingData.firstName} ${bookingData.lastName}`.trim()
      const rawDate = format(selectedDate!, 'yyyy-MM-dd') 
      
      const { error } = await supabase.from('meetings').insert([{
        user_id: targetUserId,
        contact: fullName,
        date: rawDate,
        time: selectedTime,
        type: 'video',
        status: 'upcoming',
        location: videoLink,
        description: `Email: ${bookingData.email}\nTél: ${bookingData.phone}`
      }])

      if (error) throw error

      const success = await sendBookingEmails({
        prospectEmail: bookingData.email,
        prospectName: fullName,
        date: rawDate,
        time: selectedTime!,
        meetingLink: videoLink,
        agentEmail: agentEmail || "noreply@closeros.com"
      });

      if (!success) {
        console.warn("La réservation est faite mais l'envoi de l'email a échoué.");
      }

      setStep('success')
    } catch (error) {
      alert("Erreur technique lors de la réservation.");
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderCalendar = () => {
    const days = []
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const lastDay = new Date(year, month + 1, 0).getDate()

    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month, day)
      const isPast = date < now
      const isSelected = selectedDate?.toDateString() === date.toDateString()

      days.push(
        <button
          key={day}
          disabled={isPast}
          type="button"
          onClick={() => {
            setSelectedDate(date)
            setSelectedTime(null)
          }}
          className={`aspect-square rounded-lg font-medium transition-all ${
            isPast ? 'text-slate-700 cursor-not-allowed' : 
            isSelected ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'
          }`}
        >
          {day}
        </button>
      )
    }
    return days
  }

  if (step === 'success') {
    const dateStr = selectedDate ? format(selectedDate, "yyyyMMdd") : ""
    const timeStr = selectedTime ? selectedTime.replace(':', '') : ""
    const googleCalendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=Entretien+Vidéo&dates=${dateStr}T${timeStr}00Z/${dateStr}T${timeStr}00Z&details=Lien+de+la+réunion+:+${encodeURIComponent(meetingLink)}&location=${encodeURIComponent(meetingLink)}`;

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8 text-left">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="mb-6 flex justify-center">
            <div className="bg-emerald-500/20 p-3 rounded-full">
              <Check className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-2 text-center">C'est confirmé !</h2>
          <div className="bg-slate-800/50 p-4 rounded-xl mb-8 text-center">
            <p className="font-bold text-center text-lg capitalize">
              {selectedDate && format(selectedDate, 'eeee d MMMM', { locale: fr })} à {selectedTime}
            </p>
          </div>
          <div className="space-y-6">
            <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl">
              <label className="text-xs font-bold text-blue-400 uppercase block mb-2 flex items-center gap-2">
                <Video size={14} /> Votre lien d'accès
              </label>
              <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <code className="text-sm text-blue-300 break-all flex-1 font-mono">{meetingLink}</code>
                <button onClick={() => { navigator.clipboard.writeText(meetingLink); alert("Lien copié !"); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><Copy size={16} /></button>
              </div>
              <p className="text-[11px] text-orange-400 mt-3 font-bold italic text-center">⚠️ Très important : Conservez bien ce lien, l'appel se déroulera ici. Il vous sera également envoyé par mail. Consulté vos spams.</p>
            </div>
            <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-white text-slate-950 py-4 rounded-xl font-extrabold hover:bg-slate-100 transition-all shadow-lg text-center"><CalendarIcon className="h-5 w-5" />Ajouter à mon agenda</a>
            <div className="p-4 border border-slate-800 rounded-2xl bg-slate-800/20 text-sm text-slate-400 text-center">
              <p className="mb-3">Un empêchement ? Merci de nous prévenir par email :</p>
              <div className="flex items-center justify-center gap-2 text-white font-bold bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/50">
                <Mail className="h-4 w-4 text-blue-400" />
                <span className="truncate">{agentEmail || "Contact technique"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-4 md:p-8">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
        {step === 'time' ? (
          <>
            <div className="text-left animate-in fade-in slide-in-from-left-4 duration-500">
              <h1 className="text-4xl font-extrabold mb-4">Réserver un appel</h1>
              <p className="text-slate-400 mb-8">Choisissez une date sur le calendrier pour votre session.</p>
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-bold text-lg capitalize">{currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><ChevronLeft /></button>
                    <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><ChevronRight /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 mb-2">
                  {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">{renderCalendar()}</div>
              </div>
            </div>
            <div className="text-left animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Clock className="text-blue-500" />
                {selectedDate ? format(selectedDate, 'dd MMMM', { locale: fr }) : "Choisir une date"}
              </h2>
              <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {!selectedDate ? (
                  <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">Veuillez d'abord sélectionner un jour</div>
                ) : availableTimeSlots.length > 0 ? (
                  availableTimeSlots.map(time => (
                    <button key={time} type="button" onClick={() => handleTimeSelect(time)} className="p-4 rounded-2xl border border-slate-800 bg-slate-900 hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left font-bold flex items-center justify-between group">
                      {time} <ChevronRightIcon className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                    </button>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-500 italic">Aucun créneau disponible.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="lg:col-span-2 max-w-xl mx-auto w-full text-left animate-in zoom-in-95 duration-300">
            <button type="button" onClick={() => setStep('time')} className="text-slate-500 hover:text-white mb-8 flex items-center gap-2 font-bold transition-colors">
              <ChevronLeft size={20}/> Revenir au calendrier
            </button>
            <h2 className="text-3xl font-bold mb-2">Dernière étape</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white focus:border-blue-500 outline-none transition-all" placeholder="Prénom" value={bookingData.firstName} onChange={e => setBookingData({...bookingData, firstName: e.target.value})} />
                <input className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white focus:border-blue-500 outline-none transition-all" placeholder="Nom" value={bookingData.lastName} onChange={e => setBookingData({...bookingData, lastName: e.target.value})} />
              </div>
              <input type="email" className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white focus:border-blue-500 outline-none transition-all" placeholder="Email" value={bookingData.email} onChange={e => setBookingData({...bookingData, email: e.target.value})} />
              <input className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white focus:border-blue-500 outline-none transition-all" placeholder="Téléphone" value={bookingData.phone} onChange={e => setBookingData({...bookingData, phone: e.target.value})} />
              <button type="button" disabled={isSubmitting} onClick={handleSubmitBooking} className="w-full bg-blue-600 py-5 rounded-2xl font-extrabold hover:bg-blue-500 transition-all mt-6 disabled:opacity-50 shadow-lg shadow-blue-600/20">
                {isSubmitting ? "Enregistrement en cours..." : "Confirmer ma réservation"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}