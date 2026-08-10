import { useState, useEffect } from 'react'
import { X, Plus, Loader2, CalendarRange, Copy, Eraser } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { periodsOverlap, hhmm, type TempPeriod, type TempSlot } from '../../lib/temporaryAvailability'

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface WeeklySlot {
  day_of_week: number
  start_time: string
  end_time: string
}

interface Props {
  open: boolean
  onClose: () => void
  ownerId: string
  teamMemberId: string | null
  baseSlots: WeeklySlot[]
  periods: TempPeriod[]
  editing: TempPeriod | null
  onSaved: (summary: string) => void
}

/** Décale une heure "HH:MM" de N heures (borné 00:00–23:00) */
const shiftTime = (time: string, hours: number) => {
  const [h, m] = time.split(':').map(Number)
  const nh = Math.max(0, Math.min(h + hours, 23))
  return `${String(nh).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function TemporaryAvailabilityModal({
  open, onClose, ownerId, teamMemberId, baseSlots, periods, editing, onSaved,
}: Props) {
  const { t, lang } = useBusinessLang()
  const DAYS = lang === 'en' ? DAYS_EN : DAYS_FR

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [label, setLabel] = useState('')
  const [slots, setSlots] = useState<TempSlot[]>([])
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('12:00')
  const [saving, setSaving] = useState(false)

  // (Ré)initialise le formulaire à chaque ouverture
  useEffect(() => {
    if (!open) return
    setStartDate(editing?.start_date || '')
    setEndDate(editing?.end_date || '')
    setLabel(editing?.label || '')
    setSlots((editing?.slots || []).map(s => ({
      day_of_week: s.day_of_week,
      start_time: hhmm(s.start_time),
      end_time: hhmm(s.end_time),
    })))
    setAddingDay(null)
  }, [open, editing])

  if (!open) return null

  const handleStartAdding = (dayIdx: number) => {
    const daySlots = slots.filter(s => s.day_of_week === dayIdx).sort((a, b) => a.end_time.localeCompare(b.end_time))
    if (daySlots.length > 0) {
      const start = shiftTime(daySlots[daySlots.length - 1].end_time, 1)
      setNewStart(start)
      setNewEnd(shiftTime(start, 3))
    } else {
      setNewStart('09:00')
      setNewEnd('12:00')
    }
    setAddingDay(dayIdx)
  }

  const handleStartChange = (val: string) => {
    setNewStart(val)
    if (val >= newEnd) setNewEnd(shiftTime(val, 1))
  }
  const handleEndChange = (val: string) => {
    setNewEnd(val)
    if (val <= newStart) setNewStart(shiftTime(val, -1))
  }

  const addSlot = (dayIdx: number) => {
    setSlots(prev => [...prev, { day_of_week: dayIdx, start_time: newStart, end_time: newEnd }])
    setAddingDay(null)
  }

  const removeSlot = (dayIdx: number, index: number) => {
    setSlots(prev => {
      let seen = -1
      return prev.filter(s => {
        if (s.day_of_week !== dayIdx) return true
        seen++
        return seen !== index
      })
    })
  }

  const copyFromBase = () => {
    setSlots(baseSlots.map(s => ({
      day_of_week: s.day_of_week,
      start_time: hhmm(s.start_time),
      end_time: hhmm(s.end_time),
    })))
  }

  const handleSave = async () => {
    if (!startDate || !endDate) return
    if (endDate < startDate) { toast.error(t.temp_avail_invalid_dates); return }

    // Une seule période active par date : on bloque les chevauchements
    const conflict = periods.some(p =>
      p.id !== editing?.id && periodsOverlap(startDate, endDate, p.start_date, p.end_date)
    )
    if (conflict) { toast.error(t.temp_avail_overlap_error); return }

    setSaving(true)
    try {
      const sorted = [...slots].sort((a, b) =>
        a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
      const payload = {
        business_owner_id: ownerId,
        team_member_id: teamMemberId,
        label: label.trim() || null,
        start_date: startDate,
        end_date: endDate,
        slots: sorted,
        updated_at: new Date().toISOString(),
      }

      const { error } = editing
        ? await supabase.from('business_temporary_availability').update(payload).eq('id', editing.id)
        : await supabase.from('business_temporary_availability').insert([payload])

      if (error) { toast.error(t.common_error); return }

      const fmt = (d: string) => new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')
      toast.success(t.temp_avail_saved)
      onSaved(`${t.temp_avail_title} : ${fmt(startDate)} → ${fmt(endDate)} (${sorted.length})`)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 px-6 md:px-8 pt-7 pb-5 border-b border-stone-100 dark:border-white/10">
          <button onClick={onClose} className="absolute top-6 right-6 text-stone-300 dark:text-neutral-600 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#006c49]/10 shrink-0">
              <CalendarRange className="h-5 w-5 text-[#006c49]" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">
                {editing ? t.temp_avail_modal_edit_title : t.temp_avail_modal_new_title}
              </h2>
              <p className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">{t.temp_avail_override_note}</p>
            </div>
          </div>
        </div>

        <div className="px-6 md:px-8 py-6 space-y-6">
          {/* Dates + label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">{t.availability_start_date}</label>
              <input
                type="date" value={startDate}
                onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(e.target.value) }}
                className="w-full rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">{t.availability_end_date}</label>
              <input
                type="date" value={endDate} min={startDate || undefined}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-4 py-2.5 text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold mb-2">{t.temp_avail_name}</label>
            <input
              type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder={t.temp_avail_name_placeholder}
              className="w-full rounded-full bg-stone-50 dark:bg-neutral-800 border-none px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
            />
          </div>

          {/* Actions rapides */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copyFromBase}
              disabled={baseSlots.length === 0}
              className="flex items-center gap-2 rounded-full bg-stone-100 dark:bg-white/5 px-4 py-2 text-xs font-bold text-stone-700 dark:text-neutral-200 hover:bg-stone-200 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t.temp_avail_copy_base}
            </button>
            <button
              onClick={() => setSlots([])}
              disabled={slots.length === 0}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-stone-500 dark:text-neutral-400 hover:text-[#ba1a1a] transition-colors disabled:opacity-40"
            >
              <Eraser className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t.temp_avail_clear_all}
            </button>
          </div>

          {/* Créneaux par jour */}
          <div className="space-y-2">
            {DAYS.map((day, idx) => {
              const daySlots = slots.filter(s => s.day_of_week === idx)
              return (
                <div key={idx} className="rounded-2xl bg-[#f5f3f2] dark:bg-white/5 p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-3 md:w-32 shrink-0">
                    <div className={cn('h-2 w-2 rounded-full', daySlots.length > 0 ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/40 dark:bg-neutral-600')} />
                    <span className={cn(
                      'text-sm font-bold',
                      daySlots.length > 0 ? 'text-stone-900 dark:text-white' : 'text-stone-400 dark:text-neutral-500'
                    )}>{day}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 flex-grow">
                    {daySlots.map((slot, i) => (
                      <div key={`${idx}-${i}`} className="flex items-center gap-2 bg-[#ffddb8] dark:bg-amber-900/30 text-[#2a1700] dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-semibold">
                        {slot.start_time} - {slot.end_time}
                        <button onClick={() => removeSlot(idx, i)} className="hover:text-[#ba1a1a] dark:hover:text-red-400 transition-colors">
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                    {daySlots.length === 0 && addingDay !== idx && (
                      <span className="text-xs text-stone-400/70 dark:text-neutral-500/70 italic">{t.temp_avail_no_slot_day}</span>
                    )}

                    {addingDay === idx ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="time" value={newStart} onChange={e => handleStartChange(e.target.value)} className="rounded-full bg-white dark:bg-neutral-800 border-none px-3 py-1.5 text-xs font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                        <span className="text-xs text-stone-400 dark:text-neutral-500">{t.availability_to_time}</span>
                        <input type="time" value={newEnd} onChange={e => handleEndChange(e.target.value)} className="rounded-full bg-white dark:bg-neutral-800 border-none px-3 py-1.5 text-xs font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20" />
                        <button onClick={() => addSlot(idx)} className="rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">OK</button>
                        <button onClick={() => setAddingDay(null)} className="text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-200">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartAdding(idx)}
                        className="flex items-center gap-1.5 border border-dashed border-[#c4c7c7] dark:border-neutral-700/50 px-3 py-1.5 rounded-full text-xs text-stone-500 dark:text-neutral-400 hover:bg-white dark:hover:bg-white/5 hover:border-stone-400 transition-all"
                      >
                        <Plus className="h-3 w-3" strokeWidth={1.5} />
                        {t.availability_add_short}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-neutral-900 px-6 md:px-8 py-5 border-t border-stone-100 dark:border-white/10 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !startDate || !endDate}
            className="flex-1 rounded-full bg-stone-900 dark:bg-white dark:text-neutral-900 py-3.5 text-sm font-business-display font-extrabold text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.temp_avail_save}
          </button>
          <button onClick={onClose} className="px-6 py-3.5 text-sm font-bold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors">
            {t.availability_cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
