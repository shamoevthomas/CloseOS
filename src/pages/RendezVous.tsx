import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Calendar, Clock, Check, Phone, User, ArrowRight, Smartphone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, addDays, startOfToday, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'

// Créneaux horaires statiques (à dynamiser plus tard si besoin)
const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'
]

export function BookingPage() {
  const { slug } = useParams()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(true)
  const [hostData, setHostData] = useState<any>(null)
  
  // Selection States
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  
  // Form States
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  })

  // Chargement des infos du Closer via le slug
  useEffect(() => {
    async function loadHost() {
      if (!slug) return
      
      const { data } = await supabase
        .from('booking_settings')
        .select('user_id, slug')
        .eq('slug', slug)
        .single()

      if (data) {
        setHostData(data)
      }
      setLoading(false)
    }
    loadHost()
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !selectedTime || !hostData) return

    setLoading(true)

    try {
      const meetingDate = format(selectedDate, 'yyyy-MM-dd')
      
      const { error } = await supabase.from('meetings').insert([
        {
          user_id: hostData.user_id,
          contact: formData.name,
          date: meetingDate,
          time: selectedTime,
          duration: 45,
          type: 'phone', // On force le type téléphone
          status: 'upcoming',
          location: 'Contact par le Closer', // Lieu explicite pour le tableau de bord
          description: `Email: ${formData.email}\nTéléphone: ${formData.phone}\nNote: ${formData.notes}`
        }
      ])

      if (error) throw error

      setStep(3) // Succès
    } catch (err) {
      console.error(err)
      alert("Une erreur est survenue lors de la réservation.")
    } finally {
      setLoading(false)
    }
  }

  // Génération des 14 prochains jours
  const dates = Array.from({ length: 14 }).map((_, i) => addDays(startOfToday(), i))

  if (loading && !hostData) {
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-white">Chargement...</div>
  }

  if (!hostData && !loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-white">Lien de réservation invalide.</div>
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col md:flex-row min-h-[600px]">
        
        {/* COLONNE GAUCHE : RECAPITULATIF */}
        <div className="w-full md:w-1/3 bg-slate-950 p-8 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col">
          <div className="mb-8">
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
              <Phone className="text-white h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Session Stratégique</h2>
            <p className="text-slate-400">Bilan personnalisé & Plan d'action</p>
          </div>

          <div className="space-y-4 text-sm text-slate-300 flex-1">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>45 minutes</span>
            </div>
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-slate-500" />
              <span>Appel Téléphonique</span>
            </div>
            
            {selectedDate && (
              <div className="mt-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-in fade-in slide-in-from-left-4">
                <p className="font-semibold text-blue-400 mb-1">Votre sélection :</p>
                <p className="text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(selectedDate, 'eeee d MMMM', { locale: fr })}
                </p>
                {selectedTime && (
                  <p className="text-white flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4" />
                    {selectedTime}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* COLONNE DROITE : CONTENU DYNAMIQUE */}
        <div className="w-full md:w-2/3 p-8 bg-slate-900">
          
          {/* ETAPE 1 : CHOIX DATE & HEURE */}
          {step === 1 && (
            <div className="h-full flex flex-col animate-in fade-in">
              <h3 className="text-xl font-bold text-white mb-6">Sélectionnez un créneau</h3>
              
              <div className="flex flex-col md:flex-row gap-8 h-full">
                {/* Calendrier simplifié */}
                <div className="flex-1 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {dates.map((date) => (
                    <button
                      key={date.toString()}
                      onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${
                        selectedDate && isSameDay(date, selectedDate)
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-medium capitalize">{format(date, 'eeee d MMMM', { locale: fr })}</span>
                      <ArrowRight className={`h-4 w-4 transition-opacity ${selectedDate && isSameDay(date, selectedDate) ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                    </button>
                  ))}
                </div>

                {/* Heures */}
                <div className="w-full md:w-40 space-y-2">
                  {selectedDate ? (
                    <div className="animate-in slide-in-from-right-4 fade-in">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-3 text-center">Heures dispo</p>
                      {TIME_SLOTS.map(time => (
                        <button
                          key={time}
                          onClick={() => { setSelectedTime(time); setStep(2); }}
                          className="w-full py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all text-sm font-medium"
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-600 text-sm text-center px-4 border-l border-slate-800">
                      <p>Choisissez une date pour voir les horaires</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ETAPE 2 : FORMULAIRE */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto animate-in fade-in slide-in-from-right-8">
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="text-sm text-slate-500 hover:text-white mb-6 flex items-center gap-1"
              >
                ← Retour au calendrier
              </button>

              <h3 className="text-xl font-bold text-white mb-6">Vos informations</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Nom complet</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Email professionnel</label>
                  <input 
                    required
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="john@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Téléphone (Mobile)</label>
                  <input 
                    required
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Notes (Optionnel)</label>
                  <textarea 
                    rows={3}
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    placeholder="Contexte du projet..."
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? 'Validation...' : 'Confirmer le rendez-vous'}
                </button>
              </div>
            </form>
          )}

          {/* ETAPE 3 : CONFIRMATION (NOUVELLE VERSION) */}
          {step === 3 && (
            <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
              <div className="h-20 w-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                <Check className="h-10 w-10 text-white" />
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-2">C'est confirmé !</h2>
              <p className="text-slate-400 mb-8 max-w-md">
                Votre créneau du <span className="text-white font-semibold">{format(selectedDate!, 'd MMMM', { locale: fr })}</span> à <span className="text-white font-semibold">{selectedTime}</span> a bien été réservé.
              </p>

              <div className="w-full max-w-md bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 mb-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-blue-500/20 p-3 rounded-full">
                    <Phone className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-100 mb-1">Prochaine étape</h3>
                    <p className="text-sm text-blue-200/80 leading-relaxed">
                      Notre expert (le Closer) va prendre contact avec vous directement via le numéro que vous avez fourni.
                    </p>
                    <p className="text-xs text-blue-300 mt-2 font-medium">
                      Merci de garder votre téléphone à portée de main à l'heure du rendez-vous.
                    </p>
                  </div>
                </div>
              </div>

              <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors">
                Ajouter à mon agenda
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}