import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock, Copy, Check, Save, ArrowLeft, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'

interface BookingType {
  id: number
  slug: string
  title: string
  duration: number
  description: string
  is_active: boolean
}

// Configuration des jours par défaut
const DEFAULT_AVAILABILITY = {
  monday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
  tuesday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
  wednesday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
  thursday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
  friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  saturday: { enabled: false, slots: [{ start: '10:00', end: '12:00' }] },
  sunday: { enabled: false, slots: [] },
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
  const [activeTab, setActiveTab] = useState<'types' | 'availability'>('types')


  // Data
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>([])
  const [availability, setAvailability] = useState<any>(DEFAULT_AVAILABILITY)
  const [minLeadTime, setMinLeadTime] = useState(2)

  // UI States
  const [isEditingType, setIsEditingType] = useState(false)
  const [currentType, setCurrentType] = useState<Partial<BookingType>>({
    title: '',
    slug: '',
    duration: 30,
    description: ''
  })
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Charger les types d'événements
      const { data: types } = await supabase
        .from('booking_types')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (types) setBookingTypes(types)

      // 2. Charger les disponibilités globales
      const { data: settings } = await supabase
        .from('booking_settings')
        .select('availability, min_lead_time')
        .eq('user_id', user.id)
        .single()

      if (settings) {
        setAvailability(settings.availability || DEFAULT_AVAILABILITY)
        setMinLeadTime(settings.min_lead_time || 2)
      }
    } catch (error) {
      console.error('Erreur chargement:', error)
    }
  }

  const handleSaveType = async () => {
    if (!currentType.title || !currentType.slug || !currentType.duration) {
      alert("Veuillez remplir le titre, l'URL et la durée.")
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Nettoyage du slug
      const cleanSlug = currentType.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-')

      const payload = {
        title: currentType.title,
        slug: cleanSlug,
        duration: currentType.duration,
        description: currentType.description,
        user_id: user.id
      }

      if (currentType.id) {
        // Update
        const { error } = await supabase
          .from('booking_types')
          .update(payload)
          .eq('id', currentType.id)
        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('booking_types')
          .insert([payload])
        if (error) throw error
      }

      await loadData()
      setIsEditingType(false)
      setCurrentType({ title: '', slug: '', duration: 30, description: '' })
    } catch (error: any) {
      if (error.code === '23505') {
        alert("Ce lien (URL) existe déjà. Veuillez en choisir un autre.")
      } else {
        alert("Erreur lors de la sauvegarde.")
        console.error(error)
      }
    }
  }

  const handleDeleteType = async (id: number) => {
    if (!confirm('Supprimer définitivement ce type de rendez-vous ?')) return
    await supabase.from('booking_types').delete().eq('id', id)
    loadData()
  }

  const handleSaveAvailability = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('booking_settings')
        .upsert({
          user_id: user.id,
          availability: availability,
          min_lead_time: minLeadTime,
          updated_at: new Date()
        }, { onConflict: 'user_id' })

      if (error) throw error
      alert('Disponibilités mises à jour !')
    } catch (err) {
      console.error(err)
      alert('Erreur sauvegarde disponibilités')
    }
  }

  const copyToClipboard = (slug: string) => {
    const url = `${window.location.origin}/book/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  // Helpers pour l'édition de dispo
  const toggleDay = (dayId: string) => {
    setAvailability((prev: any) => {
      const current = prev[dayId] || { enabled: false, slots: [{ start: '09:00', end: '18:00' }] };
      return { ...prev, [dayId]: { ...current, enabled: !current.enabled } };
    });
  }

  const updateTime = (dayId: string, type: 'start' | 'end', value: string) => {
    setAvailability((prev: any) => {
      const current = prev[dayId] || { enabled: true, slots: [{ start: '09:00', end: '18:00' }] };
      const slots = [...(current.slots || [{ start: '09:00', end: '18:00' }])];
      slots[0] = { ...slots[0], [type]: value };
      return { ...prev, [dayId]: { ...current, slots } };
    });
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">Réglages de Réservation</h1>
        <p className="mb-8 text-slate-500 dark:text-slate-400">Gérez vos différents types de rendez-vous et vos horaires globaux.</p>

        {/* TABS */}
        <div className="mb-8 flex border-b border-gray-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('types')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'types' ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
          >
            Types d'événements
          </button>
          <button
            onClick={() => setActiveTab('availability')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'availability' ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
          >
            Disponibilités & Horaires
          </button>
        </div>

        {/* TAB 1: TYPES D'ÉVÉNEMENTS */}
        {activeTab === 'types' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {!isEditingType ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* CARTE 1 : BOUTON CRÉER (LE PLUS) */}
                <button
                  onClick={() => {
                    setCurrentType({ title: '', slug: '', duration: 30, description: '' })
                    setIsEditingType(true)
                  }}
                  className="group flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white transition-all hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900/30 dark:hover:bg-slate-900"
                >
                  <div className="mb-4 rounded-full bg-blue-100 p-4 transition-transform group-hover:scale-110 dark:bg-blue-500/10">
                    <Plus className="h-8 w-8 text-blue-600 dark:text-blue-500" />
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">Nouveau Type de RDV</span>
                  <span className="mt-1 text-sm text-slate-500">Créer un lien de booking</span>
                </button>

                {/* LISTE DES TYPES */}
                {bookingTypes.map((type) => (
                  <div key={type.id} className="relative flex h-64 flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600">
                    <div>
                      <div className="mb-2 flex items-start justify-between">
                        <h3 className="line-clamp-1 text-xl font-bold text-slate-900 dark:text-white" title={type.title}>{type.title}</h3>
                      </div>
                      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Clock className="h-4 w-4" />
                        <span>{type.duration} min</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>Tel / Visio</span>
                      </div>
                      <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-500">
                        {type.description || "Pas de description."}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4 dark:border-slate-800">
                      <button
                        onClick={() => copyToClipboard(type.slug)}
                        className={`flex items-center gap-2 text-xs font-bold transition-colors ${copiedSlug === type.slug ? 'text-emerald-500 dark:text-emerald-400' : 'text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300'}`}
                      >
                        {copiedSlug === type.slug ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedSlug === type.slug ? 'Lien copié !' : 'Copier le lien'}
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setCurrentType(type); setIsEditingType(true); }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                          title="Modifier"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteType(type.id)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // FORMULAIRE D'ÉDITION
              <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <button
                  onClick={() => setIsEditingType(false)}
                  className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" /> Retour à la liste
                </button>

                <h3 className="mb-8 text-2xl font-bold text-slate-900 dark:text-white">
                  {currentType.id ? 'Modifier le type de RDV' : 'Créer un nouveau type'}
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-400">Titre (ex: Appel Découverte)</label>
                    <input
                      type="text"
                      value={currentType.title}
                      onChange={(e) => setCurrentType({ ...currentType, title: e.target.value })}
                      placeholder="Session Stratégique"
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-400">URL du lien (Slug)</label>
                      <div className="flex items-center overflow-hidden rounded-xl border border-gray-300 bg-gray-50 px-3 dark:border-slate-700 dark:bg-slate-950">
                        <span className="whitespace-nowrap text-xs text-slate-500">/book/</span>
                        <input
                          type="text"
                          value={currentType.slug}
                          onChange={(e) => setCurrentType({ ...currentType, slug: e.target.value })}
                          placeholder="session-strategique"
                          className="w-full bg-transparent py-3 pl-1 text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-700"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-400">Durée (minutes)</label>
                      <input
                        type="number"
                        value={currentType.duration}
                        onChange={(e) => setCurrentType({ ...currentType, duration: parseInt(e.target.value) })}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-400">Description (Optionnel)</label>
                    <textarea
                      value={currentType.description || ''}
                      onChange={(e) => setCurrentType({ ...currentType, description: e.target.value })}
                      rows={4}
                      placeholder="Ce que nous allons voir durant cet appel..."
                      className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>

                  <div className="flex gap-4 border-t border-gray-200 pt-4 dark:border-slate-800">
                    <button
                      onClick={handleSaveType}
                      className="flex-1 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-500"
                    >
                      Enregistrer le type
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DISPONIBILITÉS */}
        {activeTab === 'availability' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Semaine type</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Ces horaires s'appliquent à tous vos types de rendez-vous.</p>
                </div>
                <button
                  onClick={handleSaveAvailability}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500"
                >
                  <Save className="h-4 w-4" /> Sauvegarder
                </button>
              </div>

              {/* DÉLAI DE RÉSERVATION */}
              <div className="mb-8 flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <label className="text-sm font-bold text-slate-900 dark:text-white">Délai minimum avant réservation</label>
                  <p className="text-xs text-slate-500">Empêche les réservations de dernière minute</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={minLeadTime}
                    onChange={(e) => setMinLeadTime(parseInt(e.target.value))}
                    className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-center font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">heures</span>
                </div>
              </div>

              <div className="space-y-1">
                {DAYS.map((day) => {
                  const config = availability[day.id] || { enabled: false, slots: [{ start: '09:00', end: '18:00' }] }
                  return (
                    <div key={day.id} className="flex items-center justify-between rounded-lg border-b border-gray-100 px-4 py-4 transition-colors last:border-0 hover:bg-gray-50 dark:border-slate-800/50 dark:hover:bg-slate-800/30">
                      <div className="flex w-40 items-center gap-4">
                        <button
                          onClick={() => toggleDay(day.id)}
                          className={cn(
                            "relative flex-shrink-0 h-6 w-11 rounded-full transition-colors",
                            config.enabled ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-200 dark:bg-slate-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-sm",
                            config.enabled ? "left-6" : "left-1"
                          )} />
                        </button>
                        <span className={cn("font-bold", config.enabled ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500")}>{day.label}</span>
                      </div>

                      {config.enabled ? (
                        <div className="flex items-center gap-3">
                          <input
                            type="time"
                            value={config.slots[0]?.start || '09:00'}
                            onChange={(e) => updateTime(day.id, 'start', e.target.value)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                          <span className="font-bold text-slate-400 dark:text-slate-600">-</span>
                          <input
                            type="time"
                            value={config.slots[0]?.end || '18:00'}
                            onChange={(e) => updateTime(day.id, 'end', e.target.value)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>
                      ) : (
                        <span className="px-3 text-sm font-medium italic text-slate-400 dark:text-slate-600">Indisponible</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}