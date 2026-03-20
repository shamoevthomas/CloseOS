import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import {
  Calendar, Clock, Plus, Trash2, Loader2, X, CalendarOff, Copy, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

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

  // Show onboarding popup if no slots exist yet (first time setup)
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

  const handleCopySlots = async (fromDay: number, toDay: number) => {
    if (!teamMember?.id || !ownerUserId) return
    const sourceSlots = slots.filter(s => s.day_of_week === fromDay)
    if (sourceSlots.length === 0) { toast.error('Aucun créneau à copier'); return }
    for (const slot of sourceSlots) {
      await supabase.from('business_availability_slots').insert([{
        team_member_id: teamMember.id,
        business_owner_id: ownerUserId,
        day_of_week: toDay,
        start_time: slot.start_time,
        end_time: slot.end_time,
      }])
    }
    toast.success(`Créneaux copiés vers ${DAYS[toDay]}`)
    setCopyingDay(null)
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
        <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Calendar className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Disponibilité</h2>
            <p className="text-xs text-slate-500">Gérez vos créneaux et absences</p>
          </div>
        </div>
      </div>

      {/* Weekly Slots Grid */}
      <div className="rounded-xl border border-amber-200 bg-white p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" /> Créneaux hebdomadaires
        </h3>
        <div className="space-y-4">
          {DAYS.map((day, idx) => {
            const daySlots = slots.filter(s => s.day_of_week === idx)
            return (
              <div key={idx} className="flex items-start gap-4 border-b border-slate-100 pb-3 last:border-0">
                <div className="w-24 shrink-0">
                  <span className="text-sm font-semibold text-slate-700">{day}</span>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
                        <span className="text-xs font-medium text-amber-800">
                          {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        </span>
                        <button onClick={() => handleDeleteSlot(slot.id)} className="text-amber-400 hover:text-red-500 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {daySlots.length === 0 && <span className="text-xs text-slate-400 italic">Aucun créneau</span>}
                    {daySlots.length > 0 && (
                      <div className="relative inline-block">
                        <button
                          onClick={() => setCopyingDay(copyingDay === idx ? null : idx)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:text-amber-600 hover:border-amber-300 transition-colors"
                        >
                          <Copy className="h-3 w-3" /> Copier <ChevronDown className="h-3 w-3" />
                        </button>
                        {copyingDay === idx && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setCopyingDay(null)} />
                            <div className="absolute top-full left-0 mt-1 z-20 rounded-xl border border-amber-200 bg-white shadow-xl py-1 min-w-[140px]">
                              {DAYS.map((targetDay, targetIdx) => {
                                if (targetIdx === idx) return null
                                return (
                                  <button
                                    key={targetIdx}
                                    onClick={() => handleCopySlots(idx, targetIdx)}
                                    className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                                  >
                                    {targetDay}
                                  </button>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {addingDay === idx ? (
                    <div className="flex items-center gap-2">
                      <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                      <span className="text-xs text-slate-400">à</span>
                      <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                      <button onClick={() => handleAddSlot(idx)} className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500">Ajouter</button>
                      <button onClick={() => setAddingDay(null)} className="text-xs text-slate-400 hover:text-slate-600">Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingDay(idx)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
                      <Plus className="h-3 w-3" /> Ajouter un créneau
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Onboarding Popup */}
      {showOnboardingPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismissOnboarding} />
          <div className="relative w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-2xl p-6 animate-in zoom-in-95">
            <button onClick={dismissOnboarding} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
            <div className="text-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 mx-auto mb-4">
                <Calendar className="h-8 w-8 text-amber-700" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Configurez vos disponibilites</h2>
              <p className="text-sm text-slate-500 mt-2">
                Avant de commencer, indiquez vos creneaux de disponibilite hebdomadaires.
                Cela permettra a votre manager de vous assigner des rendez-vous aux bons moments.
              </p>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-700 font-medium">1. Ajoutez vos creneaux pour chaque jour de la semaine</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-700 font-medium">2. Indiquez vos periodes d'absence si necessaire</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-700 font-medium">3. Vous pourrez modifier ces informations a tout moment</p>
              </div>
            </div>
            <button
              onClick={dismissOnboarding}
              className="w-full mt-6 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-500 transition-all"
            >
              C'est parti !
            </button>
          </div>
        </div>
      )}

      {/* Absences */}
      <div className="rounded-xl border border-amber-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-red-500" /> Absences
          </h3>
          <button onClick={() => setShowAbsenceForm(true)} className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors">
            <Plus className="h-3 w-3" /> Nouvelle absence
          </button>
        </div>

        {showAbsenceForm && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date début</label>
                <input type="date" value={absStartDate} onChange={e => setAbsStartDate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date fin</label>
                <input type="date" value={absEndDate} onChange={e => setAbsEndDate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Motif (optionnel)</label>
              <input type="text" value={absReason} onChange={e => setAbsReason(e.target.value)} placeholder="Ex: Vacances, Maladie..." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddAbsence} disabled={!absStartDate || !absEndDate} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">Confirmer</button>
              <button onClick={() => setShowAbsenceForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
            </div>
          </div>
        )}

        {absences.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Aucune absence programmée</p>
        ) : (
          <div className="space-y-2">
            {absences.map(abs => (
              <div key={abs.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {new Date(abs.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {new Date(abs.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {abs.reason && <p className="text-xs text-slate-500 mt-0.5">{abs.reason}</p>}
                </div>
                <button onClick={() => handleDeleteAbsence(abs.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
