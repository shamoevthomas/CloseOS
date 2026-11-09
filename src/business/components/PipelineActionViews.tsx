import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Bell, CalendarClock, MessageCircle, AlarmClock, ChevronDown, User } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { fromUTC } from '../../lib/timezone'
import type { BusinessProspect } from '../contexts/BusinessProspectsContext'
import { computeRelanceBadge, relanceLabel } from '../hooks/useContactedReminders'

// Vues « Agenda des actions » et « Calendrier » du pipeline : chaque prospect (déjà filtré par le pipeline)
// est placé à la date de sa prochaine action — relance « Contacté », suivi de discussion, RDV, rappel.

export type ActionKind = 'relance' | 'suivi' | 'rdv' | 'rappel'

interface ActionEvent {
  key: string
  prospect: BusinessProspect
  kind: ActionKind
  date: string          // AAAA-MM-JJ dans le fuseau de l'utilisateur
  time: string | null   // HH:mm (null = journée)
  ts: number
  label: string
}

interface CommonProps {
  prospects: BusinessProspect[]
  delays: number[]
  ownerId: string
  userId?: string
  teamMemberId?: string | null
  isTeamMember?: boolean
  timezone: string
  lang: string
  stageInfo: (stageId: string) => { name: string; dot: string }
  onOpen: (p: BusinessProspect) => void
}

const KIND_STYLE: Record<ActionKind, { chip: string; dot: string; icon: any }> = {
  relance: { chip: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300', dot: 'bg-sky-500', icon: Bell },
  suivi: { chip: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300', dot: 'bg-violet-500', icon: MessageCircle },
  rdv: { chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', dot: 'bg-emerald-500', icon: CalendarClock },
  rappel: { chip: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300', dot: 'bg-amber-500', icon: AlarmClock },
}

const ACTIVE_STAGES = new Set(['prospect', 'contacted', 'qualified', 'followup', 'partial'])

function kindLabel(kind: ActionKind, fr: boolean) {
  return { relance: fr ? 'Relance' : 'Follow-up', suivi: fr ? 'Suivi' : 'Check-in', rdv: fr ? 'RDV' : 'Meeting', rappel: fr ? 'Rappel' : 'Reminder' }[kind]
}

function prospectName(p: BusinessProspect, fr: boolean) {
  return (p.firstName || p.lastName) ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : (p.contact || p.email || (fr ? 'Sans nom' : 'No name'))
}

function addDays(dateKey: string, n: number) {
  const d = new Date(`${dateKey}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Charge RDV + rappels et calcule les actions de chaque prospect. */
function useActionEvents({ prospects, delays, ownerId, userId, teamMemberId, isTeamMember, timezone, lang }: CommonProps) {
  const fr = lang !== 'en'
  const [appointments, setAppointments] = useState<any[]>([])
  const [reminders, setReminders] = useState<any[]>([])

  useEffect(() => {
    if (!ownerId) return
    const from = new Date(Date.now() - 120 * 86400000).toISOString()
    supabase
      .from('business_appointments')
      .select('id, prospect_id, date, time, datetime_utc, status, title')
      .eq('user_id', ownerId)
      .neq('status', 'cancelled')
      .not('prospect_id', 'is', null)
      .or(`datetime_utc.gte.${from},datetime_utc.is.null`)
      .then(({ data }) => setAppointments(data || []))
  }, [ownerId])

  useEffect(() => {
    if (!userId) return
    let q = supabase.from('reminders').select('id, title, reminder_date, business_prospect_id, is_done').eq('is_done', false).not('business_prospect_id', 'is', null)
    q = isTeamMember && teamMemberId ? q.or(`assigned_to.eq.${teamMemberId},user_id.eq.${userId}`) : q.eq('user_id', userId)
    q.then(({ data }) => setReminders(data || []))
  }, [userId, teamMemberId, isTeamMember])

  return useMemo(() => {
    const byId = new Map(prospects.map((p) => [p.id, p]))
    const events: ActionEvent[] = []
    const local = (v: string | number | Date) => fromUTC(new Date(v), timezone)

    for (const p of prospects) {
      if (p.stage === 'contacted' && !p.responded_at) {
        const badge = computeRelanceBadge(p.contacted_at, p.last_relance_at, delays, p.relance_step)
        if (badge) {
          const l = local(badge.dueAt)
          events.push({ key: `r-${p.id}`, prospect: p, kind: 'relance', date: l.date, time: null, ts: badge.dueAt, label: relanceLabel(badge.number, fr) })
        }
      }
      if (p.stage === 'contacted' && p.responded_at && p.discussion_next_at) {
        const l = local(p.discussion_next_at)
        events.push({ key: `s-${p.id}`, prospect: p, kind: 'suivi', date: l.date, time: l.time, ts: new Date(p.discussion_next_at).getTime(), label: fr ? 'Suivi de discussion' : 'Discussion check-in' })
      }
    }
    for (const a of appointments) {
      const p = byId.get(a.prospect_id)
      if (!p) continue
      let date: string, time: string | null, ts: number
      if (a.datetime_utc) { const l = local(a.datetime_utc); date = l.date; time = l.time; ts = new Date(a.datetime_utc).getTime() }
      else { date = a.date; time = a.time ? String(a.time).slice(0, 5) : null; ts = new Date(`${a.date}T${time || '00:00'}:00`).getTime() }
      events.push({ key: `a-${a.id}`, prospect: p, kind: 'rdv', date, time, ts, label: a.title || (fr ? 'Rendez-vous' : 'Meeting') })
    }
    for (const r of reminders) {
      const p = byId.get(r.business_prospect_id)
      if (!p || !r.reminder_date) continue
      const l = local(r.reminder_date)
      events.push({ key: `m-${r.id}`, prospect: p, kind: 'rappel', date: l.date, time: l.time, ts: new Date(r.reminder_date).getTime(), label: r.title || (fr ? 'Rappel' : 'Reminder') })
    }
    events.sort((a, b) => a.ts - b.ts)
    return events
  }, [prospects, delays, appointments, reminders, timezone, fr])
}

function EventRow({ ev, fr, stageInfo, onOpen, showDate }: { ev: ActionEvent; fr: boolean; stageInfo: CommonProps['stageInfo']; onOpen: (p: BusinessProspect) => void; showDate?: boolean }) {
  const st = KIND_STYLE[ev.kind]
  const Icon = st.icon
  const stage = stageInfo(ev.prospect.stage)
  const dateLabel = showDate ? new Date(`${ev.date}T12:00:00`).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' }) : null
  return (
    <button onClick={() => onOpen(ev.prospect)} className="flex w-full items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-neutral-800/60 transition-colors">
      <div className="w-14 shrink-0 text-xs font-bold text-stone-500 dark:text-neutral-400 tabular-nums">
        {dateLabel ? <span className="block leading-tight">{dateLabel}</span> : null}
        {ev.time || (dateLabel ? '' : '—')}
      </div>
      <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold', st.chip)}>
        <Icon className="h-3 w-3" /> {kindLabel(ev.kind, fr)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-stone-900 dark:text-white">{prospectName(ev.prospect, fr)}</p>
        <p className="truncate text-xs text-stone-500 dark:text-neutral-400">{ev.label}{ev.prospect.phone ? ` · ${ev.prospect.phone}` : ''}</p>
      </div>
      <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-stone-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:text-neutral-300">
        <span className={cn('h-1.5 w-1.5 rounded-full', stage.dot)} />{stage.name}
      </span>
    </button>
  )
}

// ───────────────────────────────────────────────────────────── AGENDA
export function PipelineAgendaView(props: CommonProps) {
  const fr = props.lang !== 'en'
  const events = useActionEvents(props)
  const [showIdle, setShowIdle] = useState(false)
  const today = fromUTC(new Date(), props.timezone).date
  const tomorrow = addDays(today, 1)
  const weekEnd = addDays(today, 7)
  const now = Date.now()

  const groups = useMemo(() => {
    const g: Record<string, ActionEvent[]> = { overdue: [], today: [], tomorrow: [], week: [], later: [] }
    for (const ev of events) {
      if (ev.kind === 'rdv' && ev.ts < now) continue // RDV passés : ce n'est plus une action
      if (ev.date < today) g.overdue.push(ev)
      else if (ev.date === today) g.today.push(ev)
      else if (ev.date === tomorrow) g.tomorrow.push(ev)
      else if (ev.date <= weekEnd) g.week.push(ev)
      else g.later.push(ev)
    }
    return g
  }, [events, today, tomorrow, weekEnd, now])

  const withAction = useMemo(() => new Set(events.filter((e) => !(e.kind === 'rdv' && e.ts < now)).map((e) => e.prospect.id)), [events, now])
  const idle = useMemo(() => props.prospects.filter((p) => ACTIVE_STAGES.has(p.stage) && !withAction.has(p.id)), [props.prospects, withAction])

  const sections: { id: string; title: string; tone: string }[] = [
    { id: 'overdue', title: fr ? 'En retard' : 'Overdue', tone: 'text-red-600' },
    { id: 'today', title: fr ? "Aujourd'hui" : 'Today', tone: 'text-stone-900 dark:text-white' },
    { id: 'tomorrow', title: fr ? 'Demain' : 'Tomorrow', tone: 'text-stone-900 dark:text-white' },
    { id: 'week', title: fr ? 'Cette semaine' : 'This week', tone: 'text-stone-700 dark:text-neutral-200' },
    { id: 'later', title: fr ? 'Plus tard' : 'Later', tone: 'text-stone-500 dark:text-neutral-400' },
  ]

  const totalActions = sections.reduce((n, s) => n + groups[s.id].length, 0)

  return (
    <div className="space-y-4">
      {totalActions === 0 && (
        <p className="rounded-2xl bg-white dark:bg-neutral-900 ring-1 ring-stone-100 dark:ring-neutral-800 py-10 text-center text-sm text-stone-400">{fr ? 'Aucune action prévue pour les prospects affichés.' : 'No planned action for the shown prospects.'}</p>
      )}
      {sections.map((s) => groups[s.id].length > 0 && (
        <section key={s.id} className="rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)] ring-1 ring-stone-100 dark:ring-neutral-800 overflow-hidden">
          <h3 className={cn('flex items-center justify-between px-4 py-3 text-sm font-extrabold border-b border-stone-100 dark:border-neutral-800', s.tone)} style={{ fontFamily: 'Manrope, sans-serif' }}>
            {s.title}
            <span className="rounded-full bg-stone-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-bold text-stone-600 dark:text-neutral-300">{groups[s.id].length}</span>
          </h3>
          <div className="divide-y divide-stone-100 dark:divide-neutral-800">
            {groups[s.id].map((ev) => <EventRow key={ev.key} ev={ev} fr={fr} stageInfo={props.stageInfo} onOpen={props.onOpen} showDate={s.id !== 'today' && s.id !== 'tomorrow'} />)}
          </div>
        </section>
      ))}
      {idle.length > 0 && (
        <section className="rounded-2xl bg-white/70 dark:bg-neutral-900/70 ring-1 ring-dashed ring-stone-200 dark:ring-neutral-800 overflow-hidden">
          <button onClick={() => setShowIdle((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-stone-600 dark:text-neutral-300">
            <span>{fr ? 'Sans action prévue' : 'No planned action'} <span className="ml-1 rounded-full bg-stone-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">{idle.length}</span></span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', showIdle && 'rotate-180')} />
          </button>
          {showIdle && (
            <div className="divide-y divide-stone-100 dark:divide-neutral-800 border-t border-stone-100 dark:border-neutral-800">
              {idle.map((p) => {
                const st = props.stageInfo(p.stage)
                return (
                  <button key={p.id} onClick={() => props.onOpen(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50 dark:hover:bg-neutral-800/60">
                    <User className="h-4 w-4 shrink-0 text-stone-400" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800 dark:text-neutral-200">{prospectName(p, fr)}</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-stone-500"><span className={cn('h-1.5 w-1.5 rounded-full', st.dot)} />{st.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────── CALENDRIER
export function PipelineCalendarView(props: CommonProps) {
  const fr = props.lang !== 'en'
  const events = useActionEvents(props)
  const today = fromUTC(new Date(), props.timezone).date
  const [month, setMonth] = useState(today.slice(0, 7)) // AAAA-MM
  const [selectedDay, setSelectedDay] = useState<string>(today)

  const byDay = useMemo(() => {
    const m: Record<string, ActionEvent[]> = {}
    for (const ev of events) (m[ev.date] ||= []).push(ev)
    return m
  }, [events])

  const cells = useMemo(() => {
    const first = new Date(`${month}-01T12:00:00Z`)
    const offset = (first.getUTCDay() + 6) % 7 // lundi = 0
    const start = addDays(`${month}-01`, -offset)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [month])

  const shiftMonth = (n: number) => {
    const d = new Date(`${month}-01T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + n)
    setMonth(d.toISOString().slice(0, 7))
  }
  const monthTitle = new Date(`${month}-01T12:00:00`).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })
  const weekdays = fr ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayEvents = byDay[selectedDay] || []

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)] ring-1 ring-stone-100 dark:ring-neutral-800 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-stone-100 dark:border-neutral-800">
          <h3 className="text-base sm:text-lg font-extrabold capitalize text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{monthTitle}</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => { setMonth(today.slice(0, 7)); setSelectedDay(today) }} className="rounded-full border border-stone-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-semibold text-stone-600 dark:text-neutral-300">{fr ? "Aujourd'hui" : 'Today'}</button>
            <button onClick={() => shiftMonth(-1)} aria-label={fr ? 'Mois précédent' : 'Previous month'} className="rounded-full p-2 hover:bg-stone-100 dark:hover:bg-neutral-800"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => shiftMonth(1)} aria-label={fr ? 'Mois suivant' : 'Next month'} className="rounded-full p-2 hover:bg-stone-100 dark:hover:bg-neutral-800"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-stone-100 dark:border-neutral-800">
          {weekdays.map((w) => <div key={w} className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-stone-400">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d) => {
            const evs = byDay[d] || []
            const inMonth = d.startsWith(month)
            const isToday = d === today
            const isSel = d === selectedDay
            return (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={cn(
                  'relative min-h-[64px] sm:min-h-[104px] border-b border-r border-stone-100 dark:border-neutral-800 p-1 sm:p-1.5 text-left align-top transition-colors',
                  !inMonth && 'bg-stone-50/60 dark:bg-neutral-950/40',
                  isSel ? 'bg-emerald-50/70 dark:bg-emerald-900/20' : 'hover:bg-stone-50 dark:hover:bg-neutral-800/50',
                )}
              >
                <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', isToday ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : inMonth ? 'text-stone-700 dark:text-neutral-200' : 'text-stone-300 dark:text-neutral-600')}>{Number(d.slice(8))}</span>
                {/* Téléphone : pastilles ; écran large : noms */}
                <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                  {evs.slice(0, 4).map((ev) => <span key={ev.key} className={cn('h-1.5 w-1.5 rounded-full', KIND_STYLE[ev.kind].dot)} />)}
                </div>
                <div className="hidden sm:block mt-0.5 space-y-0.5">
                  {evs.slice(0, 3).map((ev) => (
                    <span key={ev.key} onClick={(e) => { e.stopPropagation(); props.onOpen(ev.prospect) }} className={cn('flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] font-semibold cursor-pointer', KIND_STYLE[ev.kind].chip)}>
                      {ev.time && <span className="tabular-nums opacity-70">{ev.time}</span>}
                      <span className="truncate">{prospectName(ev.prospect, fr)}</span>
                    </span>
                  ))}
                  {evs.length > 3 && <span className="block px-1 text-[11px] font-semibold text-stone-500">+{evs.length - 3}</span>}
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-3 px-4 py-2.5 text-[11px] text-stone-500 dark:text-neutral-400">
          {(['rdv', 'relance', 'suivi', 'rappel'] as ActionKind[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', KIND_STYLE[k].dot)} />{kindLabel(k, fr)}</span>
          ))}
        </div>
      </div>

      <section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)] ring-1 ring-stone-100 dark:ring-neutral-800 overflow-hidden">
        <h3 className="px-4 py-3 text-sm font-extrabold capitalize text-stone-900 dark:text-white border-b border-stone-100 dark:border-neutral-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          <span className="ml-2 rounded-full bg-stone-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-bold text-stone-600 dark:text-neutral-300">{dayEvents.length}</span>
        </h3>
        {dayEvents.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">{fr ? 'Rien de prévu ce jour-là.' : 'Nothing planned that day.'}</p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-neutral-800">
            {dayEvents.map((ev) => <EventRow key={ev.key} ev={ev} fr={fr} stageInfo={props.stageInfo} onOpen={props.onOpen} />)}
          </div>
        )}
      </section>
    </div>
  )
}
