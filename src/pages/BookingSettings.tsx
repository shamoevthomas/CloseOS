import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock, Calendar, Link2, Copy, Check, ExternalLink, Save, ArrowLeft, Edit2 } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  
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
      setLoading(true)
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
    } finally {
      setLoading(false)
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
    <div className="h-full overflow-y-auto bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-bold text-white">Réglages de Réservation</h1>
        <p className="mb-8 text-slate-400">Gérez vos différents types de rendez-vous et vos horaires globaux.</p>

        {/* TABS */}
        <div className="mb-8 flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('types')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'types' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Types d'événements
          </button>
          <button
            onClick={() => setActiveTab('availability')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'availability' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
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
                  className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/30 transition-all hover:border-blue-500 hover:bg-slate-900 group"
                >
                  <div className="mb-4 rounded-full bg-blue-500/10 p-4 transition-transform group-hover:scale-110">
                    <Plus className="h-8 w-8 text-blue-500" />
                  </div>
                  <span className="font-bold text-white">Nouveau Type de RDV</span>
                  <span className="text-sm text-slate-500 mt-1">Créer un lien de booking</span>
                </button>

                {/* LISTE DES TYPES */}
                {bookingTypes.map((type) => (
                  <div key={type.id} className="relative flex h-64 flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-slate-600 hover:shadow-lg">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-xl text-white line-clamp-1" title={type.title}>{type.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                        <Clock className="h-4 w-4" />
                        <span>{type.duration} min</span>
                        <span className="text-slate-600">•</span>
                        <span>Tel / Visio</span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-3">
                        {type.description || "Pas de description."}
                      </p>
                    </div>
                    
                    <div className="pt-4 mt-auto border-t border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => copyToClipboard(type.slug)}
                        className={`flex items-center gap-2 text-xs font-bold transition-colors ${copiedSlug === type.slug ? 'text-emerald-400' : 'text-blue-400 hover:text-blue-300'}`}
                      >
                        {copiedSlug === type.slug ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedSlug === type.slug ? 'Lien copié !' : 'Copier le lien'}
                      </button>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => { setCurrentType(type); setIsEditingType(true); }}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteType(type.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
              <div className="max-w-2xl mx-auto rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
                <button 
                  onClick={() => setIsEditingType(false)}
                  className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Retour à la liste
                </button>

                <h3 className="mb-8 text-2xl font-bold text-white">
                  {currentType.id ? 'Modifier le type de RDV' : 'Créer un nouveau type'}
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">Titre (ex: Appel Découverte)</label>
                    <input
                      type="text"
                      value={currentType.title}
                      onChange={(e) => setCurrentType({ ...currentType, title: e.target.value })}
                      placeholder="Session Stratégique"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">URL du lien (Slug)</label>
                      <div className="flex items-center rounded-xl border border-slate-700 bg-slate-950 px-3 overflow-hidden">
                        <span className="text-slate-500 text-xs whitespace-nowrap">/book/</span>
                        <input
                          type="text"
                          value={currentType.slug}
                          onChange={(e) => setCurrentType({ ...currentType, slug: e.target.value })}
                          placeholder="session-strategique"
                          className="w-full bg-transparent py-3 pl-1 text-white focus:outline-none placeholder:text-slate-700"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">Durée (minutes)</label>
                      <input
                        type="number"
                        value={currentType.duration}
                        onChange={(e) => setCurrentType({ ...currentType, duration: parseInt(e.target.value) })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">Description (Optionnel)</label>
                    <textarea
                      value={currentType.description || ''}
                      onChange={(e) => setCurrentType({ ...currentType, description: e.target.value })}
                      rows={4}
                      placeholder="Ce que nous allons voir durant cet appel..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-blue-500 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-slate-800">
                    <button
                      onClick={handleSaveType}
                      className="flex-1 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Semaine type</h3>
                  <p className="text-sm text-slate-400">Ces horaires s'appliquent à tous vos types de rendez-vous.</p>
                </div>
                <button
                  onClick={handleSaveAvailability}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
                >
                  <Save className="h-4 w-4" /> Sauvegarder
                </button>
              </div>

              {/* DÉLAI DE RÉSERVATION */}
              <div className="mb-8 p-4 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center gap-4">
                <Clock className="h-5 w-5 text-blue-400" />
                <div className="flex-1">
                  <label className="text-sm font-bold text-white">Délai minimum avant réservation</label>
                  <p className="text-xs text-slate-500">Empêche les réservations de dernière minute</p>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="0"
                    value={minLeadTime}
                    onChange={(e) => setMinLeadTime(parseInt(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center text-white font-bold focus:border-blue-500 outline-none"
                  />
                  <span className="text-sm text-slate-400">heures</span>
                </div>
              </div>
              
              <div className="space-y-1">
                {DAYS.map((day) => {
                  const config = availability[day.id] || { enabled: false, slots: [{ start: '09:00', end: '18:00' }] }
                  return (
                    <div key={day.id} className="flex items-center justify-between border-b border-slate-800/50 py-4 last:border-0 hover:bg-slate-800/30 px-4 rounded-lg transition-colors">
                      <div className="flex items-center gap-4 w-40">
                        <button
                          onClick={() => toggleDay(day.id)}
                          className={cn(
                            "h-6 w-11 rounded-full transition-colors relative flex-shrink-0",
                            config.enabled ? "bg-blue-500" : "bg-slate-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-sm",
                            config.enabled ? "left-6" : "left-1"
                          )} />
                        </button>
                        <span className={cn("font-bold", config.enabled ? "text-white" : "text-slate-500")}>{day.label}</span>
                      </div>

                      {config.enabled ? (
                        <div className="flex items-center gap-3">
                          <input
                            type="time"
                            value={config.slots[0]?.start || '09:00'}
                            onChange={(e) => updateTime(day.id, 'start', e.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                          />
                          <span className="text-slate-600 font-bold">-</span>
                          <input
                            type="time"
                            value={config.slots[0]?.end || '18:00'}
                            onChange={(e) => updateTime(day.id, 'end', e.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-slate-600 italic px-3">Indisponible</span>
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