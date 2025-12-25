import { useState, useEffect } from 'react'
import { Save, Link, Clock, FileText, Calendar, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase' // Assure-toi que le chemin vers ton client supabase est correct
import { cn } from '../lib/utils'

interface AvailabilityDay {
  enabled: boolean
  slots: { start: string; end: string }[]
}

interface Availability {
  [key: string]: AvailabilityDay
}

const DAYS = [
  { id: 'monday', label: 'Lundi' },
  { id: 'tuesday', label: 'Mardi' },
  { id: 'wednesday', label: 'Mercredi' },
  { id: 'thursday', label: 'Jeudi' },
  { id: 'friday', label: 'Vendredi' },
  { id: 'saturday', label: 'Samedi' },
  { id: 'sunday', label: 'Dimanche' },
]

export function BookingSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // États du formulaire
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [minLeadTime, setMinLeadTime] = useState(0)
  const [availability, setAvailability] = useState<Availability>({})

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setSlug(data.slug)
        setTitle(data.title)
        setDescription(data.description)
        setMinLeadTime(data.min_lead_time)
        setAvailability(data.availability || {})
      }
    } catch (error) {
      console.error('Erreur chargement réglages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté')

      const { error } = await supabase
        .from('booking_settings')
        .upsert({
          user_id: user.id,
          slug: slug.toLowerCase().trim().replace(/\s+/g, '-'),
          title,
          description,
          min_lead_time: minLeadTime,
          availability,
          updated_at: new Date().toISOString(),
        })

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ce lien (slug) est déjà utilisé. Veuillez en choisir un autre.')
        }
        throw error
      }

      setMessage({ type: 'success', text: 'Réglages enregistrés avec succès !' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Une erreur est survenue.' })
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (dayId: string) => {
    setAvailability(prev => {
      // Sécurité : si le jour n'existe pas encore dans l'état, on crée une valeur par défaut
      const current = prev[dayId] || { enabled: false, slots: [{ start: '09:00', end: '18:00' }] };
      return {
        ...prev,
        [dayId]: { ...current, enabled: !current.enabled }
      };
    });
  }

  const updateTime = (dayId: string, type: 'start' | 'end', value: string) => {
    setAvailability(prev => {
      // Sécurité : si le jour ou les créneaux n'existent pas, on crée une valeur par défaut
      const current = prev[dayId] || { enabled: true, slots: [{ start: '09:00', end: '18:00' }] };
      const slots = [...(current.slots || [{ start: '09:00', end: '18:00' }])];
      
      slots[0] = { ...slots[0], [type]: value };
      
      return {
        ...prev,
        [dayId]: { ...current, slots }
      };
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Réglages de Réservation</h1>
          <p className="text-slate-400">Personnalisez votre page publique et vos disponibilités.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-2.5 font-semibold text-white transition-all hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </button>
      </div>

      {message && (
        <div className={cn(
          "mb-6 flex items-center gap-3 rounded-lg p-4",
          message.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        )}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="grid gap-6">
        {/* LIEN PERSONNALISÉ */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Link className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Lien de réservation</h2>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-950 p-3 border border-slate-800">
            <span className="text-slate-500">close-os.com/book/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1 bg-transparent text-white outline-none placeholder:text-slate-700"
              placeholder="votre-nom"
            />
          </div>
        </section>

        {/* APPARENCE */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Apparence de la page</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-400">Titre de la page</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-400">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        {/* DÉLAI MINIMUM */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-400" />
            <h2 className="text-lg font-semibold text-white">Délai de réservation</h2>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={minLeadTime}
              onChange={(e) => setMinLeadTime(parseInt(e.target.value) || 0)}
              className="w-24 rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white outline-none focus:border-blue-500"
            />
            <span className="text-slate-400 text-sm">heures de délai minimum avant un rendez-vous (ex: 24 pour interdire le jour même).</span>
          </div>
        </section>

        {/* DISPONIBILITÉS */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Horaires de travail</h2>
          </div>
          <div className="space-y-4">
            {DAYS.map((day) => {
              const config = availability[day.id] || { enabled: false, slots: [{ start: '09:00', end: '18:00' }] }
              return (
                <div key={day.id} className="flex items-center justify-between border-b border-slate-800/50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-4 w-32">
                    <button
                      onClick={() => toggleDay(day.id)}
                      className={cn(
                        "h-5 w-10 rounded-full transition-colors relative",
                        config.enabled ? "bg-blue-500" : "bg-slate-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 h-3 w-3 rounded-full bg-white transition-all",
                        config.enabled ? "left-6" : "left-1"
                      )} />
                    </button>
                    <span className={cn("font-medium", config.enabled ? "text-white" : "text-slate-500")}>{day.label}</span>
                  </div>

                  {config.enabled ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={config.slots[0]?.start || '09:00'}
                        onChange={(e) => updateTime(day.id, 'start', e.target.value)}
                        className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-white outline-none"
                      />
                      <span className="text-slate-600">—</span>
                      <input
                        type="time"
                        value={config.slots[0]?.end || '18:00'}
                        onChange={(e) => updateTime(day.id, 'end', e.target.value)}
                        className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-white outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-sm italic text-slate-600">Indisponible</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}