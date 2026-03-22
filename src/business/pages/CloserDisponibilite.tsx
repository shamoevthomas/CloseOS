import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import {
  Calendar, Clock, Plus, Trash2, Loader2, X, CalendarOff, Copy, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'

interface Slot {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
}

interface Absence {
  id: number
  start_date: string
  end_date: string
  reason: string | null
  created_at: string
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_SHORT = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']

const GLASS_PANEL = 'bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/5 dark:ring-neutral-700 shadow-sm'

export function CloserDisponibilite() {
  const { teamMember, ownerUserId } = useBusinessAuth()
  const [slots, setSlots] = useState<Slot[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(false)

  // Add slot form
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('12:00')

  // Copy slots
  const [copyingDay, setCopyingDay] = useState<number | null>(null)
  const [selectedCopyTargets, setSelectedCopyTargets] = useState<number[]>([])

  // Add absence form
  const [showAbsenceForm, setShowAbsenceForm] = useState(false)
  const [absStartDate, setAbsStartDate] = useState('')
  const [absEndDate, setAbsEndDate] = useState('')
  const [absReason, setAbsReason] = useState('')

  const fetchData = useCallback(async () => {
    if (!teamMember?.id) return
    setLoading(true)
    try {
      const [slotsRes, absRes] = await Promise.all([
        supabase.from('business_availability_slots').select('*').eq('team_member_id', teamMember.id).order('day_of_week').order('start_time'),
        supabase.from('business_absences').select('*').eq('team_member_id', teamMember.id).order('start_date', { ascending: false }),
      ])
      setSlots(slotsRes.data || [])
      setAbsences(absRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [teamMember?.id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!loading && slots.length === 0 && teamMember?.id) {
      const dismissed = localStorage.getItem(`dispo-onboarding-${teamMember.id}`)
      if (!dismissed) {
        setShowOnboardingPopup(true)
      }
    }
  }, [loading, slots.length, teamMember?.id])

  const dismissOnboarding = () => {
    if (teamMember?.id) {
      localStorage.setItem(`dispo-onboarding-${teamMember.id}`, 'true')
    }
    setShowOnboardingPopup(false)
  }

  const handleAddSlot = async (dayOfWeek: number) => {
    if (!teamMember?.id || !ownerUserId) return
    const { error } = await supabase.from('business_availability_slots').insert([{
      team_member_id: teamMember.id,
      business_owner_id: ownerUserId,
      day_of_week: dayOfWeek,
      start_time: newStart,
      end_time: newEnd,
    }])
    if (error) { toast.error('Erreur'); return }
    toast.success('Créneau ajouté')
    setAddingDay(null)
    setNewStart('09:00')
    setNewEnd('12:00')
    fetchData()
  }

  const handleDeleteSlot = async (id: number) => {
    const { error } = await supabase.from('business_availability_slots').delete().eq('id', id)
    if (error) { toast.error('Erreur'); return }
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  const handleCopySlots = async (fromDay: number, targetDays: number[]) => {
    if (!teamMember?.id || !ownerUserId || targetDays.length === 0) return
    const sourceSlots = slots.filter(s => s.day_of_week === fromDay)
    if (sourceSlots.length === 0) { toast.error('Aucun créneau à copier'); return }
    for (const toDay of targetDays) {
      for (const slot of sourceSlots) {
        await supabase.from('business_availability_slots').insert([{
          team_member_id: teamMember.id,
          business_owner_id: ownerUserId,
          day_of_week: toDay,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }])
      }
    }
    const names = targetDays.map(d => DAYS[d]).join(', ')
    toast.success(`Créneaux copiés vers ${names}`)
    setCopyingDay(null)
    setSelectedCopyTargets([])
    fetchData()
  }

  const handleAddAbsence = async () => {
    if (!teamMember?.id || !ownerUserId || !absStartDate || !absEndDate) return
    const { error } = await supabase.from('business_absences').insert([{
      team_member_id: teamMember.id,
      business_owner_id: ownerUserId,
      start_date: absStartDate,
      end_date: absEndDate,
      reason: absReason || null,
    }])
    if (error) { toast.error('Erreur'); return }
    toast.success('Absence ajoutée')
    setShowAbsenceForm(false)
    setAbsStartDate(''); setAbsEndDate(''); setAbsReason('')
    fetchData()
  }

  const handleDeleteAbsence = async (id: number) => {
    const { error } = await supabase.from('business_absences').delete().eq('id', id)
    if (error) { toast.error('Erreur'); return }
    setAbsences(prev => prev.filter(a => a.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-stone-300 dark:text-neutral-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-4 text-[#006c49] mb-2">
          <Clock className="h-6 w-6" strokeWidth={1.5} />
          <span className="h-px w-10 bg-[#c4c7c7]/30" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Workspace</span>
        </div>
        <h1 className="text-4xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">Disponibilité</h1>
        <p className="text-stone-500 dark:text-neutral-400 text-base max-w-2xl font-light italic opacity-80">Gérez vos créneaux et absences pour optimiser votre tunnel de vente.</p>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* ─── Left: Weekly Slots ─── */}
        <section className="col-span-12 xl:col-span-8 space-y-6">
          <h3 className="font-business-display font-extrabold text-2xl tracking-tight flex items-center gap-3 text-stone-900">
            Créneaux hebdomadaires
          </h3>

          <div className="space-y-4">
            {/* Weekdays (Mon-Fri) */}
            {DAYS.slice(0, 5).map((day, idx) => {
              const daySlots = slots.filter(s => s.day_of_week === idx)
              const hasSlots = daySlots.length > 0
              return (
                <div
                  key={idx}
                  className={cn(
                    GLASS_PANEL,
                    'rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow'
                  )}
                >
                  <div className="flex items-center gap-6 min-w-[140px]">
                    <span className={cn(
                      'font-business-display font-extrabold text-xl w-12',
                      hasSlots ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-neutral-600'
                    )}>
                      {DAYS_SHORT[idx]}
                    </span>
                    <div className={cn('h-2 w-2 rounded-full', hasSlots ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/30')} />
                  </div>

                  <div className="flex flex-wrap gap-2 flex-grow items-center">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="flex items-center gap-2 bg-[#ffddb8] text-[#2a1700] px-4 py-2 rounded-full text-sm font-semibold">
                        {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        <button onClick={() => handleDeleteSlot(slot.id)} className="hover:text-[#ba1a1a] transition-colors">
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                    {!hasSlots && !addingDay && (
                      <span className="text-sm text-stone-400/50 dark:text-neutral-500/50 italic py-2">Indisponible</span>
                    )}

                    {addingDay === idx ? (
                      <div className="flex items-center gap-2">
                        <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-3 py-2 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                        <span className="text-xs text-stone-400 dark:text-neutral-500">à</span>
                        <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-3 py-2 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                        <button onClick={() => handleAddSlot(idx)} className="rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition-all">OK</button>
                        <button onClick={() => setAddingDay(null)} className="text-xs text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300">Annuler</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingDay(idx)}
                        className="flex items-center gap-2 border border-dashed border-[#c4c7c7] dark:border-neutral-700 px-4 py-2 rounded-full text-sm text-stone-500 dark:text-neutral-400 hover:bg-stone-50 dark:hover:bg-neutral-800 hover:border-stone-400 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Ajouter un créneau
                      </button>
                    )}
                  </div>

                  {/* Copy button */}
                  {hasSlots && (
                    <div className="relative">
                      <button
                        onClick={() => { setCopyingDay(copyingDay === idx ? null : idx); setSelectedCopyTargets([]) }}
                        className="text-stone-400 hover:text-[#006c49] p-2 transition-colors"
                      >
                        <Copy className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                      {copyingDay === idx && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => { setCopyingDay(null); setSelectedCopyTargets([]) }} />
                          <div className="absolute top-full right-0 mt-1 z-20 rounded-2xl bg-white dark:bg-neutral-800 shadow-xl ring-1 ring-black/5 dark:ring-neutral-700 py-2 min-w-[180px]">
                            {DAYS.map((targetDay, targetIdx) => {
                              if (targetIdx === idx) return null
                              const isSelected = selectedCopyTargets.includes(targetIdx)
                              return (
                                <button
                                  key={targetIdx}
                                  onClick={() => setSelectedCopyTargets(prev => isSelected ? prev.filter(d => d !== targetIdx) : [...prev, targetIdx])}
                                  className={cn(
                                    'w-full text-left px-4 py-2 text-sm font-medium flex items-center gap-3 transition-colors',
                                    isSelected ? 'bg-[#006c49]/5 text-[#006c49]' : 'text-stone-700 dark:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800'
                                  )}
                                >
                                  <span className={cn(
                                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                    isSelected ? 'border-[#006c49] bg-[#006c49] text-white' : 'border-stone-300 dark:border-neutral-600'
                                  )}>
                                    {isSelected && <span className="text-[10px]">✓</span>}
                                  </span>
                                  {targetDay}
                                </button>
                              )
                            })}
                            {selectedCopyTargets.length > 0 && (
                              <div className="px-3 pt-2 mt-1 border-t border-stone-100 dark:border-neutral-800">
                                <button
                                  onClick={() => handleCopySlots(idx, selectedCopyTargets)}
                                  className="w-full rounded-full bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 transition-all"
                                >
                                  Copier vers {selectedCopyTargets.length} jour{selectedCopyTargets.length > 1 ? 's' : ''}
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Weekend separator */}
            <div className="flex items-center gap-4 py-2 text-stone-300 dark:text-neutral-600">
              <div className="h-px flex-grow bg-[#c4c7c7]/20" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Weekend</span>
              <div className="h-px flex-grow bg-[#c4c7c7]/20" />
            </div>

            {/* Weekend (Sat-Sun) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DAYS.slice(5).map((day, i) => {
                const idx = i + 5
                const daySlots = slots.filter(s => s.day_of_week === idx)
                const hasSlots = daySlots.length > 0
                return (
                  <div
                    key={idx}
                    className={cn(
                      GLASS_PANEL,
                      'rounded-2xl p-5',
                      !hasSlots && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-business-display font-extrabold text-lg text-stone-900 dark:text-white">{DAYS_SHORT[idx]}</span>
                      <div className={cn('h-2 w-2 rounded-full', hasSlots ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/30')} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-2 bg-[#ffddb8] text-[#2a1700] px-3 py-1.5 rounded-full text-xs font-bold">
                          {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                          <button onClick={() => handleDeleteSlot(slot.id)} className="hover:text-[#ba1a1a] transition-colors">
                            <X className="h-3 w-3" strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                      {!hasSlots && (
                        <span className="text-[10px] italic text-stone-400 dark:text-neutral-500">Indisponible</span>
                      )}
                    </div>
                    {addingDay === idx ? (
                      <div className="flex items-center gap-2 mt-3">
                        <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-3 py-1.5 text-xs font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                        <span className="text-xs text-stone-400 dark:text-neutral-500">à</span>
                        <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-3 py-1.5 text-xs font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                        <button onClick={() => handleAddSlot(idx)} className="rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">OK</button>
                        <button onClick={() => setAddingDay(null)} className="text-xs text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingDay(idx)}
                        className="mt-3 flex items-center gap-1.5 text-xs text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300 transition-colors"
                      >
                        <Plus className="h-3 w-3" strokeWidth={1.5} />
                        Ajouter
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── Right: Absences ─── */}
        <aside className="col-span-12 xl:col-span-4 space-y-8">
          {/* Absences Card */}
          <div className={cn(GLASS_PANEL, 'rounded-2xl p-8 shadow-lg relative overflow-hidden')}>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#006c49]/5 rounded-full blur-3xl" />
            <h3 className="font-business-display font-extrabold text-2xl mb-6 relative z-10 text-stone-900">Absences</h3>

            <div className="space-y-4 mb-6 relative z-10">
              {absences.length === 0 ? (
                <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-6">Aucune absence programmée</p>
              ) : (
                absences.map(abs => (
                  <div key={abs.id} className="flex items-center justify-between p-4 bg-[#efedec] dark:bg-neutral-800 rounded-2xl ring-1 ring-[#c4c7c7]/10 dark:ring-neutral-700">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#006c49]/10 rounded-xl">
                        <Calendar className="h-4 w-4 text-[#006c49]" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-stone-900 dark:text-white">
                          {new Date(abs.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {new Date(abs.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                        {abs.reason && (
                          <p className="text-[10px] text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{abs.reason}</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteAbsence(abs.id)} className="text-stone-300 dark:text-neutral-600 hover:text-[#ba1a1a] transition-colors">
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Absence Form */}
            {showAbsenceForm && (
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-neutral-900 p-5 mb-4 space-y-4 relative z-10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">Date début</label>
                    <input type="date" value={absStartDate} onChange={e => setAbsStartDate(e.target.value)} className="w-full rounded-full bg-white dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">Date fin</label>
                    <input type="date" value={absEndDate} onChange={e => setAbsEndDate(e.target.value)} className="w-full rounded-full bg-white dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-2">Motif (optionnel)</label>
                  <input type="text" value={absReason} onChange={e => setAbsReason(e.target.value)} placeholder="Ex: Vacances, Formation..." className="w-full rounded-full bg-white dark:bg-neutral-800 border-none px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAddAbsence} disabled={!absStartDate || !absEndDate} className="flex-1 rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-4 py-3 text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-50">Confirmer</button>
                  <button onClick={() => setShowAbsenceForm(false)} className="px-4 py-3 text-sm font-bold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors">Annuler</button>
                </div>
              </div>
            )}

            {/* New absence button */}
            {!showAbsenceForm && (
              <button
                onClick={() => setShowAbsenceForm(true)}
                className="w-full py-4 border-2 border-dashed border-[#c4c7c7] dark:border-neutral-700 hover:border-[#006c49] hover:text-[#006c49] hover:bg-[#006c49]/5 rounded-2xl transition-all flex items-center justify-center gap-2 text-stone-500 dark:text-neutral-400 relative z-10"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-sm font-bold">Nouvelle absence</span>
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Onboarding Popup */}
      {showOnboardingPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={dismissOnboarding} />
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl p-8">
            <button onClick={dismissOnboarding} className="absolute top-5 right-5 text-stone-300 dark:text-neutral-600 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="text-center mb-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#006c49]/10 mx-auto mb-5">
                <Calendar className="h-8 w-8 text-[#006c49]" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">Configurez vos disponibilités</h2>
              <p className="text-sm text-stone-500 dark:text-neutral-400 mt-3 leading-relaxed">
                Avant de commencer, indiquez vos créneaux de disponibilité hebdomadaires.
                Cela permettra à votre manager de vous assigner des rendez-vous aux bons moments.
              </p>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-neutral-900 p-4">
                <p className="text-sm text-stone-700 dark:text-neutral-200 font-medium">1. Ajoutez vos créneaux pour chaque jour</p>
              </div>
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-neutral-900 p-4">
                <p className="text-sm text-stone-700 dark:text-neutral-200 font-medium">2. Indiquez vos périodes d'absence si nécessaire</p>
              </div>
              <div className="rounded-2xl bg-[#f5f3f2] dark:bg-neutral-900 p-4">
                <p className="text-sm text-stone-700 dark:text-neutral-200 font-medium">3. Modifiez ces informations à tout moment</p>
              </div>
            </div>
            <button
              onClick={dismissOnboarding}
              className="w-full mt-8 rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 py-4 text-sm font-business-display font-extrabold text-white hover:opacity-90 transition-all"
            >
              C'est parti !
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
