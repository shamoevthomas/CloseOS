import { useMemo } from 'react'
import { X, TrendingUp, TrendingDown, Minus, DollarSign, Trophy, CalendarCheck, Percent, UserPlus, CalendarX, BarChart3 } from 'lucide-react'
import { cn } from '../lib/utils'
import { useLanguage } from '../contexts/LanguageContext'
import { useMeetings } from '../contexts/MeetingsContext'
import { useProspects } from '../contexts/ProspectsContext'

/* Semaine ISO (lundi → dimanche) */
function weekRange(offsetWeeks = 0): { start: Date; end: Date } {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - offsetWeeks * 7
  const start = new Date(d); start.setDate(diff)
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999)
  return { start, end }
}
const inRange = (val: string | null | undefined, start: Date, end: Date): boolean => {
  if (!val) return false
  const t = new Date(val).getTime()
  return !isNaN(t) && t >= start.getTime() && t <= end.getTime()
}

interface WeekStats {
  revenue: number
  won: number
  done: number
  scheduled: number
  cancelled: number
  newProspects: number
  closingRate: number
}

export function WeeklyReportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useLanguage()
  const fr = lang !== 'en'
  const { meetings } = useMeetings()
  const { prospects } = useProspects()

  const { cur, prev, range } = useMemo(() => {
    const compute = (offset: number): WeekStats => {
      const { start, end } = weekRange(offset)
      const wonList = prospects.filter(p => p.stage === 'won' && inRange(p.updated_at || p.lastContact || p.dateAdded, start, end))
      const revenue = wonList.reduce((s, p) => s + (Number(p.value) || 0), 0)
      const weekMeetings = meetings.filter(m => inRange(m.date, start, end))
      const done = weekMeetings.filter(m => m.status === 'completed').length
      const cancelled = weekMeetings.filter(m => m.status === 'cancelled').length
      const scheduled = weekMeetings.filter(m => m.status !== 'cancelled').length
      const newProspects = prospects.filter(p => inRange(p.created_at || p.dateAdded, start, end)).length
      return { revenue, won: wonList.length, done, scheduled, cancelled, newProspects, closingRate: done > 0 ? (wonList.length / done) * 100 : 0 }
    }
    return { cur: compute(0), prev: compute(1), range: weekRange(0) }
  }, [meetings, prospects])

  if (!isOpen) return null

  const locale = fr ? 'fr-FR' : 'en-US'
  const rangeLabel = `${range.start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${range.end.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`

  const Delta = ({ cur, prev, suffix = '' }: { cur: number; prev: number; suffix?: string }) => {
    const diff = cur - prev
    const pct = prev > 0 ? Math.round((diff / prev) * 100) : (cur > 0 ? 100 : 0)
    const up = diff > 0, flat = diff === 0
    const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold', flat ? 'text-slate-400 dark:text-neutral-500' : up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
        <Icon className="h-3 w-3" />
        {flat ? (fr ? 'stable' : 'flat') : `${up ? '+' : ''}${pct}%${suffix}`}
        <span className="text-slate-400 dark:text-neutral-600 font-medium">{fr ? 'vs S-1' : 'vs prev'}</span>
      </span>
    )
  }

  const bigCards = [
    { icon: DollarSign, label: fr ? 'CA gagné' : 'Revenue won', value: `${cur.revenue.toLocaleString(locale)}€`, cur: cur.revenue, prev: prev.revenue, accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: Trophy, label: fr ? 'Deals gagnés' : 'Deals won', value: `${cur.won}`, cur: cur.won, prev: prev.won, accent: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
    { icon: CalendarCheck, label: fr ? 'RDV réalisés' : 'Calls done', value: `${cur.done}`, cur: cur.done, prev: prev.done, accent: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
    { icon: Percent, label: fr ? 'Taux de closing' : 'Closing rate', value: `${Math.round(cur.closingRate)}%`, cur: cur.closingRate, prev: prev.closingRate, accent: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  ]
  const smallStats = [
    { icon: CalendarCheck, label: fr ? 'RDV programmés' : 'Scheduled', value: cur.scheduled },
    { icon: UserPlus, label: fr ? 'Nouveaux prospects' : 'New prospects', value: cur.newProspects },
    { icon: CalendarX, label: fr ? 'RDV annulés' : 'Cancelled', value: cur.cancelled },
  ]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-2xl border border-slate-200 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20">
              <BarChart3 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{fr ? 'Rapport de la semaine' : 'Weekly report'}</h3>
              <p className="text-[11px] text-slate-400 dark:text-neutral-500">{rangeLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Cartes principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bigCards.map((c, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', c.bg)}>
                    <c.icon className={cn('h-5 w-5', c.accent)} />
                  </div>
                  <Delta cur={c.cur} prev={c.prev} />
                </div>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{c.value}</p>
                <p className="text-xs font-medium text-slate-400 dark:text-neutral-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Stats secondaires */}
          <div className="grid grid-cols-3 gap-3">
            {smallStats.map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 text-center">
                <s.icon className="h-4 w-4 text-slate-400 dark:text-neutral-500 mx-auto mb-2" />
                <p className="text-xl font-extrabold text-slate-900 dark:text-white">{s.value}</p>
                <p className="text-[10px] font-medium text-slate-400 dark:text-neutral-500 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-slate-400 dark:text-neutral-500">
            {fr ? 'Calculé en direct depuis vos RDV et prospects gagnés cette semaine.' : 'Computed live from your calls and deals won this week.'}
          </p>
        </div>
      </div>
    </div>
  )
}
