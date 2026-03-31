import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOrganization } from '../../contexts/OrganizationContext'
import { supabase } from '../../lib/supabase'
import {
  Loader2, Calendar, Clock, User, Phone, Video, ChevronLeft, ChevronRight, MapPin,
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface Appointment {
  id: string
  date: string
  time: string
  duration: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  notes: string | null
  assigned_to: string | null
  prospect: { id: number; contact: string; email: string; phone: string; company?: string } | null
  type?: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-400', label: 'En attente' },
  confirmed: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'Confirmé' },
  cancelled: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', label: 'Annulé' },
  done: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'Terminé' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0]
}

export function OrgAgenda() {
  const { organization } = useOrganization()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDates = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset + weekOffset * 7)
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      dates.push(d.toISOString().split('T')[0])
    }
    return dates
  }, [weekOffset])

  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  const fetchAppointments = useCallback(async () => {
    if (!organization?.owner_id || !organization?.member_id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('business_appointments')
        .select('id, date, time, duration, status, notes, assigned_to, type, prospect:business_prospects!prospect_id(id, contact, email, phone, company)')
        .eq('user_id', organization.owner_id)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      // Filter by assigned_to = my member_id
      const filtered = (data || []).filter((a: any) => a.assigned_to === organization.member_id)
      setAppointments(filtered.map((a: any) => ({ ...a, prospect: a.prospect?.[0] || a.prospect || null })))
    } catch (err) {
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }, [organization?.owner_id, organization?.member_id, weekStart, weekEnd])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const getAppointmentsForDate = (date: string) => appointments.filter(a => a.date === date)

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-slate-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-1">{organization?.org_name}</p>
          <h1 className="text-2xl font-extrabold text-white">Agenda Équipe</h1>
          <p className="text-xs text-slate-500 mt-1">{appointments.length} rendez-vous cette semaine</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setWeekOffset(0)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-300 transition-colors">
            Aujourd'hui
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map(date => {
          const dayAppts = getAppointmentsForDate(date)
          const today = isToday(date)
          const dayName = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })
          const dayNum = new Date(date + 'T00:00:00').getDate()

          return (
            <div key={date} className={cn(
              'rounded-xl border p-3 min-h-[120px]',
              today ? 'border-blue-500/30 bg-blue-500/5' : 'border-slate-700/50 bg-slate-800/30'
            )}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn(
                  'text-xs font-bold uppercase',
                  today ? 'text-blue-400' : 'text-slate-500'
                )}>{dayName}</span>
                <span className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
                  today ? 'bg-blue-600 text-white' : 'text-slate-300'
                )}>{dayNum}</span>
              </div>

              {dayAppts.length === 0 ? (
                <p className="text-[10px] text-slate-600">Aucun RDV</p>
              ) : (
                <div className="space-y-2">
                  {dayAppts.map(appt => {
                    const status = STATUS_STYLES[appt.status] || STATUS_STYLES.pending
                    return (
                      <div key={appt.id} className={cn('rounded-lg border p-2.5', status.bg)}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Clock className={cn('h-3 w-3', status.text)} />
                          <span className={cn('text-xs font-bold', status.text)}>{appt.time?.slice(0, 5)}</span>
                          <span className="text-[10px] text-slate-500">{appt.duration}min</span>
                        </div>
                        {appt.prospect && (
                          <p className="text-xs text-slate-300 font-medium truncate">
                            {appt.prospect.contact || appt.prospect.company || 'Prospect'}
                          </p>
                        )}
                        <span className={cn('text-[10px] font-bold mt-1 inline-block', status.text)}>{status.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* No appointments */}
      {appointments.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700/50 bg-slate-800/30 py-12">
          <Calendar className="h-10 w-10 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-300 mb-1">Aucun rendez-vous cette semaine</h3>
          <p className="text-sm text-slate-500">Les rendez-vous assignés par votre manager apparaîtront ici.</p>
        </div>
      )}
    </div>
  )
}
