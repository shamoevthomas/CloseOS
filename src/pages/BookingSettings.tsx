import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock, Calendar, Link2, Copy, Check, ExternalLink, Save, ArrowLeft, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
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
  const { user } = useAuth()
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
    let isMounted = true

    async function loadData() {
      try {
        setLoading(true)
        if (!user) return

        // 1. Charger les types d'événements
        const { data: types } = await supabase
          .from('booking_types')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (!isMounted) return
        if (types) setBookingTypes(types)

        // 2. Charger les disponibilités globales
        const { data: settings } = await supabase
          .from('booking_settings')
          .select('availability, min_lead_time')
          .eq('user_id', user.id)
          .single()

        if (!isMounted) return
        if (settings) {
          setAvailability(settings.availability || DEFAULT_AVAILABILITY)
          setMinLeadTime(settings.min_lead_time || 2)
        }
      } catch (error) {
        console.error('Erreur chargement:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => { isMounted = false }
  }, [user?.id])

  const handleSaveType = async () => {
    if (!currentType.title || !currentType.slug || !currentType.duration) {
      alert("Veuillez remplir le titre, l'URL et la durée.")
      return
    }

    try {
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
    <div className="h-full overflow-y-auto bg-[#111111] p-8 md:p-12 text-white/80">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl md:text-5xl font-extrabold tracking-tighter text-white">Réglages de Réservation</h1>
        <p className="mb-10 text-white/40 text-sm font-medium">Gérez vos différents types de rendez-vous et vos horaires globaux.</p>

        {/* TABS */}
        <div className="mb-10 inline-flex bg-white/[0.03] backdrop-blur-[16px] border border-white/[0.08] rounded-full p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
          <button
            onClick={() => setActiveTab('types')}
            className={`px-8 py-3 text-sm font-bold transition-all rounded-full ${activeTab === 'types' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
              }`}
          >
            Types d'événements
          </button>
          <button
            onClick={() => setActiveTab('availability')}
            className={`px-8 py-3 text-sm font-bold transition-all rounded-full ${activeTab === 'availability' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
              }`}
          >
            Disponibilités & Horaires
          </button>
        </div>

        {/* TAB 1: TYPES D'ÉVÉNEMENTS */}
        {activeTab === 'types' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {!isEditingType ? (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {/* CARTE 1 : BOUTON CRÉER (LE PLUS) */}
                <button
                  onClick={() => {
                    setCurrentType({ title: '', slug: '', duration: 30, description: '' })
                    setIsEditingType(true)
                  }}
                  className="flex h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] transition-all hover:border-emerald-500/50 hover:bg-white/[0.05] hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] group"
                >
                  <div className="mb-4 rounded-full bg-emerald-500/10 p-5 transition-transform group-hover:scale-110 group-hover:bg-emerald-500/20">
                    <Plus className="h-8 w-8 text-emerald-500" />
                  </div>
                  <span className="font-bold text-white text-lg">Nouveau Type de RDV</span>
                  <span className="text-sm text-white/40 mt-1">Créer un lien de booking</span>
                </button>

                {/* LISTE DES TYPES */}
                {bookingTypes.map((type) => (
                  <div key={type.id} className="group relative flex h-72 flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] p-8 transition-all hover:border-emerald-500/30 hover:bg-white/[0.05] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-extrabold text-xl text-white line-clamp-1" title={type.title}>{type.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-white/40 text-sm mb-4">
                        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/10">
                          <Clock className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                        <span className="font-medium">{type.duration} min</span>
                        <span className="text-white/20">|</span>
                        <span className="font-medium">Tel / Visio</span>
                      </div>
                      <p className="text-sm text-white/40 line-clamp-3 leading-relaxed">
                        {type.description || "Pas de description."}
                      </p>
                    </div>

                    <div className="pt-4 mt-auto flex items-center justify-between">
                      <button
                        onClick={() => copyToClipboard(type.slug)}
                        className={`flex items-center gap-2 text-xs font-bold transition-colors ${copiedSlug === type.slug ? 'text-emerald-400' : 'text-emerald-400 hover:text-emerald-300'}`}
                      >
                        {copiedSlug === type.slug ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedSlug === type.slug ? 'Lien copié !' : 'Copier le lien'}
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setCurrentType(type); setIsEditingType(true); }}
                          className="p-2.5 text-white/40 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteType(type.id)}
                          className="p-2.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
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
              <div className="max-w-2xl mx-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] p-10 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                <button
                  onClick={() => setIsEditingType(false)}
                  className="mb-8 flex items-center gap-2 text-sm font-bold text-white/40 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Retour à la liste
                </button>

                <div className="flex items-start justify-between mb-10">
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">
                      {currentType.id ? 'Modifier le type de RDV' : 'Créer un nouveau type'}
                    </h3>
                    <p className="text-white/40 text-sm mt-1">Remplissez les détails de ce type de rendez-vous.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Titre (ex: Appel Découverte)</label>
                    <input
                      type="text"
                      value={currentType.title}
                      onChange={(e) => setCurrentType({ ...currentType, title: e.target.value })}
                      placeholder="Session Stratégique"
                      className="w-full bg-transparent border-b border-white/10 focus:border-emerald-500 transition-colors py-3 text-white font-medium focus:ring-0 focus:outline-none placeholder:text-white/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">URL du lien (Slug)</label>
                      <div className="flex items-center border-b border-white/10 focus-within:border-emerald-500 transition-colors">
                        <span className="text-white/40 text-xs whitespace-nowrap">/book/</span>
                        <input
                          type="text"
                          value={currentType.slug}
                          onChange={(e) => setCurrentType({ ...currentType, slug: e.target.value })}
                          placeholder="session-strategique"
                          className="w-full bg-transparent py-3 pl-1 text-white font-medium focus:outline-none focus:ring-0 placeholder:text-white/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Durée (minutes)</label>
                      <input
                        type="number"
                        value={currentType.duration}
                        onChange={(e) => setCurrentType({ ...currentType, duration: parseInt(e.target.value) })}
                        className="w-full bg-transparent border-b border-white/10 focus:border-emerald-500 transition-colors py-3 text-white font-medium focus:ring-0 focus:outline-none placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Description (Optionnel)</label>
                    <textarea
                      value={currentType.description || ''}
                      onChange={(e) => setCurrentType({ ...currentType, description: e.target.value })}
                      rows={4}
                      placeholder="Ce que nous allons voir durant cet appel..."
                      className="w-full bg-transparent border-b border-white/10 focus:border-emerald-500 transition-colors py-3 text-white font-medium focus:ring-0 focus:outline-none resize-none placeholder:text-white/20"
                    />
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={handleSaveType}
                      className="w-full rounded-full bg-emerald-500 px-8 py-3.5 font-bold text-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] p-10 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
              <div className="flex items-start justify-between mb-10">
                <div>
                  <h3 className="text-2xl font-extrabold text-white">Semaine type</h3>
                  <p className="text-white/40 text-sm mt-1">Ces horaires s'appliquent à tous vos types de rendez-vous.</p>
                </div>
                <button
                  onClick={handleSaveAvailability}
                  className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:bg-white/90 transition-colors shadow-lg"
                >
                  <Save className="h-4 w-4" /> Sauvegarder
                </button>
              </div>

              {/* DÉLAI DE RÉSERVATION */}
              <div className="mb-10 flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-4">
                  <Clock className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-white font-bold text-sm">Délai minimum avant réservation</p>
                    <p className="text-white/40 text-xs mt-0.5">Empêche les réservations de dernière minute</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={minLeadTime}
                    onChange={(e) => setMinLeadTime(parseInt(e.target.value))}
                    className="w-16 bg-transparent border-b border-white/10 focus:border-emerald-500 px-2 py-1 text-center text-white font-bold outline-none transition-colors"
                  />
                  <span className="text-sm text-white/40">heures</span>
                </div>
              </div>

              <div className="space-y-2">
                {DAYS.map((day) => {
                  const config = availability[day.id] || { enabled: false, slots: [{ start: '09:00', end: '18:00' }] }
                  return (
                    <div key={day.id} className={cn(
                      "flex items-center justify-between py-4 px-5 rounded-2xl transition-all",
                      config.enabled ? "bg-white/[0.03] hover:bg-white/[0.05]" : "hover:bg-white/[0.02]"
                    )}>
                      <div className="flex items-center gap-4 w-40">
                        <button
                          onClick={() => toggleDay(day.id)}
                          className={cn(
                            "h-6 w-11 rounded-full transition-colors relative flex-shrink-0",
                            config.enabled ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-sm",
                            config.enabled ? "left-6" : "left-1"
                          )} />
                        </button>
                        <span className={cn("font-bold text-sm", config.enabled ? "text-white" : "text-white/40")}>{day.label}</span>
                      </div>

                      {config.enabled ? (
                        <div className="flex items-center gap-3">
                          <input
                            type="time"
                            value={config.slots[0]?.start || '09:00'}
                            onChange={(e) => updateTime(day.id, 'start', e.target.value)}
                            className="rounded-xl bg-white/5 border border-white/[0.08] px-4 py-2 text-sm text-white font-medium outline-none focus:border-emerald-500 transition-colors"
                          />
                          <span className="text-white/20 font-bold">-</span>
                          <input
                            type="time"
                            value={config.slots[0]?.end || '18:00'}
                            onChange={(e) => updateTime(day.id, 'end', e.target.value)}
                            className="rounded-xl bg-white/5 border border-white/[0.08] px-4 py-2 text-sm text-white font-medium outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-white/20 italic px-3">Indisponible</span>
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