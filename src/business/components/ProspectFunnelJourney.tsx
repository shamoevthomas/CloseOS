import { useEffect, useState } from 'react'
import { Route, Check, X as XIcon, PlayCircle, Smartphone, Monitor } from 'lucide-react'
import { funnelStepLabel, formatDuration } from './CampaignFunnelModal'

interface JourneySession {
  id: string
  campaign_name: string | null
  capture_type: 'with_rdv' | 'without_rdv'
  has_payment: boolean
  device: string | null
  reached: string[]
  answered_question_ids: string[]
  stuck_question_id: string | null
  completed: boolean
  disqualified: boolean
  created_at: string
  confirmation: {
    viewed?: string
    videos?: Record<string, { watched: number; duration: number; max: number }>
    pre_meeting?: { answered: string[]; stuck: string | null; submitted: boolean }
  }
  questions: { id: string; index: number; text: string }[]
  video_titles: Record<string, string>
  pre_meeting_questions: { id: string; index: number; text: string }[]
}

/** Parcours d'un prospect sur la page de campagne (fiche prospect). */
export function ProspectFunnelJourney({ prospectId, userId, lang, labelClassName }: {
  prospectId: number | string; userId: string; lang: 'fr' | 'en'; labelClassName: string
}) {
  const fr = lang === 'fr'
  const [sessions, setSessions] = useState<JourneySession[]>([])

  useEffect(() => {
    if (!prospectId || !userId) return
    fetch(`/api/business?action=funnel-prospect&prospect_id=${prospectId}&user_id=${userId}`)
      .then(r => r.json())
      .then(d => setSessions(d.sessions || []))
      .catch(() => {})
  }, [prospectId, userId])

  if (sessions.length === 0) return null

  return (
    <div>
      <label className={labelClassName}>
        <Route className="h-3.5 w-3.5" strokeWidth={1.5} /> {fr ? 'Parcours sur la page de campagne' : 'Campaign page journey'}
      </label>
      <div className="space-y-3">
        {sessions.map(s => {
          const inscription = s.capture_type === 'without_rdv'
          const steps = ['view', 'info_started', 'info_done']
          if (s.questions.length) steps.push('questionnaire_started', 'questionnaire_done')
          if (!inscription) steps.push('booking', 'slot_selected')
          if (s.has_payment) steps.push('payment')
          steps.push('done')
          const reached = (k: string) => k === 'view' || s.completed || s.reached.includes(k)
          const stuck = s.questions.find(q => q.id === s.stuck_question_id)
          const videos = Object.entries(s.confirmation?.videos || {})
          const pm = s.confirmation?.pre_meeting
          const pmStuck = s.pre_meeting_questions.find(q => q.id === pm?.stuck)

          return (
            <div key={s.id} className="rounded-xl bg-white dark:bg-neutral-800 p-5 border border-[#c4c7c7]/10 dark:border-neutral-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-stone-900 dark:text-white truncate">{s.campaign_name || (fr ? 'Campagne' : 'Campaign')}</p>
                <span className="flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-neutral-500 shrink-0">
                  {s.device === 'mobile' ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                  {new Date(s.created_at).toLocaleString(fr ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {steps.map(k => {
                  const ok = reached(k)
                  return (
                    <span key={k} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ${ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-stone-100 text-stone-400 dark:bg-neutral-700/60 dark:text-neutral-500'}`}>
                      {ok ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
                      {funnelStepLabel(k, lang, inscription)}
                    </span>
                  )
                })}
              </div>

              {s.disqualified && (
                <p className="text-xs font-semibold text-red-500">{fr ? 'Disqualifié par le questionnaire.' : 'Disqualified by the questionnaire.'}</p>
              )}

              {s.questions.length > 0 && s.reached.includes('questionnaire_started') && (
                <p className="text-xs text-stone-600 dark:text-neutral-300">
                  {fr ? 'Questionnaire : ' : 'Questionnaire: '}
                  <span className="font-bold">{s.answered_question_ids.length}/{s.questions.length}</span> {fr ? 'questions répondues' : 'questions answered'}
                  {!s.completed && !s.reached.includes('questionnaire_done') && stuck && (
                    <span className="text-red-500 font-semibold"> · {fr ? `arrêt à la question ${stuck.index} « ${stuck.text} »` : `stopped at question ${stuck.index} “${stuck.text}”`}</span>
                  )}
                </p>
              )}

              {s.confirmation?.viewed && (videos.length > 0 || pm) && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-neutral-500">{fr ? 'Page de confirmation' : 'Confirmation page'}</p>
                  {videos.map(([key, v]) => {
                    const p = v.duration ? Math.min(100, (Math.max(v.max, v.watched) / v.duration) * 100) : 0
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <PlayCircle className="h-4 w-4 text-stone-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-stone-800 dark:text-neutral-200 truncate">{s.video_titles[key] || (fr ? 'Vidéo' : 'Video')}</p>
                          <div className="mt-1 h-1.5 rounded-full bg-stone-100 dark:bg-neutral-700 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p}%` }} />
                          </div>
                        </div>
                        <span className="text-[11px] text-stone-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                          {formatDuration(v.watched)}{v.duration ? ` / ${formatDuration(v.duration)}` : ''} · {Math.round(p)}%
                        </span>
                      </div>
                    )
                  })}
                  {pm && s.pre_meeting_questions.length > 0 && (
                    <p className="text-xs text-stone-600 dark:text-neutral-300">
                      {inscription ? (fr ? 'Questionnaire complémentaire : ' : 'Follow-up questionnaire: ') : (fr ? 'Questionnaire avant RDV : ' : 'Pre-meeting questionnaire: ')}
                      {pm.submitted
                        ? <span className="font-bold text-emerald-600">{fr ? 'envoyé' : 'submitted'}</span>
                        : <span className="font-bold">{pm.answered.length}/{s.pre_meeting_questions.length} {fr ? 'répondues, non envoyé' : 'answered, not submitted'}</span>}
                      {!pm.submitted && pmStuck && <span className="text-red-500 font-semibold"> · {fr ? `arrêt à la question ${pmStuck.index}` : `stopped at question ${pmStuck.index}`}</span>}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
