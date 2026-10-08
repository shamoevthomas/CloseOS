import { useEffect, useState } from 'react'
import { X, Loader2, Users, CheckCircle2, Smartphone, Ban, TrendingDown, PlayCircle, ClipboardList, Lightbulb } from 'lucide-react'

const API_URL = '/api/business'

interface FunnelStats {
  campaign: { id: string; name: string; capture_type: 'with_rdv' | 'without_rdv' }
  total: number
  mobile: number
  disqualified: number
  steps: { key: string; reached: number; stopped: number }[]
  questionnaire: { started: number; questions: { id: string; index: number; text: string; answered: number; stopped: number }[] }
  confirmation: {
    enabled: boolean
    viewed: number
    videos: { key: string; title: string; measurable: boolean; viewers: number; started: number; avg_watched: number; avg_pct: number; completed: number }[]
    pre_meeting: { enabled: boolean; shown: number; started: number; submitted: number; questions: { id: string; index: number; text: string; answered: number; stopped: number }[] }
  }
}

export function funnelStepLabel(key: string, lang: 'fr' | 'en', inscription: boolean): string {
  const fr: Record<string, string> = {
    view: 'Visite la page', info_started: 'Commence le formulaire', info_done: 'Coordonnées remplies',
    questionnaire_started: 'Commence le questionnaire', questionnaire_done: 'Termine le questionnaire',
    booking: 'Arrive au calendrier', slot_selected: 'Choisit un créneau', payment: 'Ouvre le paiement',
    done: inscription ? 'Inscription validée' : 'Rendez-vous réservé',
  }
  const en: Record<string, string> = {
    view: 'Visits the page', info_started: 'Starts the form', info_done: 'Contact details filled',
    questionnaire_started: 'Starts the questionnaire', questionnaire_done: 'Finishes the questionnaire',
    booking: 'Reaches the calendar', slot_selected: 'Picks a slot', payment: 'Opens payment',
    done: inscription ? 'Sign-up completed' : 'Appointment booked',
  }
  return (lang === 'fr' ? fr : en)[key] || key
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return m ? `${m} min ${String(s % 60).padStart(2, '0')}` : `${s} s`
}

const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0)
const fmtPct = (v: number) => `${v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)}%`

/** Modale « Parcours » d'une campagne : entonnoir, décrochage par question, vidéos et questionnaire pré-RDV. */
export function CampaignFunnelModal({ campaignId, campaignName, userId, lang, onClose }: {
  campaignId: string; campaignName: string; userId: string; lang: 'fr' | 'en'; onClose: () => void
}) {
  const fr = lang === 'fr'
  const [days, setDays] = useState(30)
  const [data, setData] = useState<FunnelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true); setError(false)
    fetch(`${API_URL}?action=funnel-stats&campaign_id=${campaignId}&user_id=${userId}&days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(true); else setData(d) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [campaignId, userId, days])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inscription = data?.campaign.capture_type === 'without_rdv'
  const total = data?.total || 0
  const done = data?.steps.find(s => s.key === 'done')?.reached || 0

  // Phrase clé : l'étape où l'on perd le plus de monde
  let insight: string | null = null
  if (data && total >= 1) {
    const worst = data.steps.filter(s => s.key !== 'done').sort((a, b) => b.stopped - a.stopped)[0]
    if (worst && worst.stopped > 0) {
      const share = fmtPct(pct(worst.stopped, total))
      if (worst.key === 'questionnaire_started') {
        const q = [...data.questionnaire.questions].sort((a, b) => b.stopped - a.stopped)[0]
        insight = fr
          ? `${share} des visiteurs s'arrêtent pendant le questionnaire${q && q.stopped ? `, plus précisément à la question ${q.index} « ${q.text} »` : ''}.`
          : `${share} of visitors stop during the questionnaire${q && q.stopped ? `, precisely at question ${q.index} “${q.text}”` : ''}.`
      } else {
        const next = data.steps[data.steps.findIndex(s => s.key === worst.key) + 1]
        insight = fr
          ? `${share} des visiteurs s'arrêtent entre « ${funnelStepLabel(worst.key, lang, inscription)} » et « ${funnelStepLabel(next.key, lang, inscription)} ».`
          : `${share} of visitors drop off between “${funnelStepLabel(worst.key, lang, inscription)}” and “${funnelStepLabel(next.key, lang, inscription)}”.`
      }
    }
  }

  const cardCls = 'rounded-2xl border border-stone-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 p-6'
  const h4Cls = 'text-base font-extrabold text-stone-900 dark:text-white flex items-center gap-2'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#f8f7f6] dark:bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-4 px-7 py-5 border-b border-stone-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-neutral-500">{fr ? 'Parcours de la campagne' : 'Campaign funnel'}</p>
            <h3 className="text-xl font-extrabold text-stone-900 dark:text-white truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>{campaignName}</h3>
          </div>
          <div className="flex rounded-xl bg-stone-100 dark:bg-neutral-800 p-1">
            {[{ v: 7, l: fr ? '7 j' : '7d' }, { v: 30, l: fr ? '30 j' : '30d' }, { v: 90, l: fr ? '90 j' : '90d' }, { v: 0, l: fr ? 'Tout' : 'All' }].map(o => (
              <button
                key={o.v}
                onClick={() => setDays(o.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${days === o.v ? 'bg-white dark:bg-neutral-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white'}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors" aria-label={fr ? 'Fermer' : 'Close'}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-7 space-y-6">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>
          ) : error || !data ? (
            <p className="text-center text-sm text-red-500 py-20">{fr ? 'Impossible de charger le parcours.' : 'Unable to load the funnel.'}</p>
          ) : total === 0 ? (
            <div className="text-center py-16">
              <TrendingDown className="h-8 w-8 text-stone-300 mx-auto mb-3" />
              <p className="font-bold text-stone-700 dark:text-neutral-200">{fr ? 'Pas encore de données sur cette période' : 'No data for this period yet'}</p>
              <p className="text-sm text-stone-500 dark:text-neutral-400 mt-1">{fr ? 'Le suivi démarre dès la prochaine visite de la page de campagne.' : 'Tracking starts with the next visit to the campaign page.'}</p>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Users, label: fr ? 'Visites' : 'Visits', value: total.toLocaleString() },
                  { icon: CheckCircle2, label: inscription ? (fr ? 'Inscriptions' : 'Sign-ups') : (fr ? 'RDV réservés' : 'Booked'), value: `${done} · ${fmtPct(pct(done, total))}` },
                  { icon: Smartphone, label: fr ? 'Sur mobile' : 'On mobile', value: fmtPct(pct(data.mobile, total)) },
                  { icon: Ban, label: fr ? 'Disqualifiés' : 'Disqualified', value: data.disqualified.toLocaleString() },
                ].map(k => (
                  <div key={k.label} className="rounded-2xl bg-white dark:bg-neutral-900 border border-stone-200/60 dark:border-neutral-700/60 p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400"><k.icon className="h-3.5 w-3.5" />{k.label}</p>
                    <p className="text-xl font-extrabold text-stone-900 dark:text-white mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {insight && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 p-4 flex gap-3">
                  <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{insight}</p>
                </div>
              )}

              {/* Entonnoir */}
              <div className={cardCls}>
                <h4 className={h4Cls}><TrendingDown className="h-4 w-4" /> {fr ? 'Entonnoir' : 'Funnel'}</h4>
                <div className="mt-5 space-y-3">
                  {data.steps.map(s => {
                    const share = pct(s.reached, total)
                    return (
                      <div key={s.key}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-semibold text-stone-800 dark:text-neutral-200">{funnelStepLabel(s.key, lang, inscription)}</span>
                          <span className="text-stone-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                            <span className="font-bold text-stone-900 dark:text-white">{s.reached}</span> · {fmtPct(share)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2.5 rounded-full bg-stone-100 dark:bg-neutral-800 overflow-hidden">
                          <div className={`h-full rounded-full ${s.key === 'done' ? 'bg-emerald-500' : 'bg-stone-900 dark:bg-white'}`} style={{ width: `${Math.max(share, s.reached ? 1.5 : 0)}%` }} />
                        </div>
                        {s.stopped > 0 && (
                          <p className="text-[11px] font-semibold text-red-500 mt-1">
                            ↳ {s.stopped} {fr ? `s'arrêtent ici` : 'stop here'} ({fmtPct(pct(s.stopped, total))} {fr ? 'des visites' : 'of visits'})
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Questions de qualification */}
              {data.questionnaire.questions.length > 0 && (
                <div className={cardCls}>
                  <h4 className={h4Cls}><ClipboardList className="h-4 w-4" /> {fr ? 'Questionnaire de qualification' : 'Qualification questionnaire'}</h4>
                  <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1">
                    {fr ? `${data.questionnaire.started} visiteurs ont commencé le questionnaire.` : `${data.questionnaire.started} visitors started the questionnaire.`}
                  </p>
                  <QuestionTable rows={data.questionnaire.questions} base={data.questionnaire.started} total={total} fr={fr} />
                </div>
              )}

              {/* Page de confirmation */}
              {data.confirmation.enabled && (
                <div className={cardCls}>
                  <h4 className={h4Cls}><PlayCircle className="h-4 w-4" /> {fr ? 'Page de confirmation' : 'Confirmation page'}</h4>
                  <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1">
                    {fr ? `Vue par ${data.confirmation.viewed} personne${data.confirmation.viewed > 1 ? 's' : ''}.` : `Seen by ${data.confirmation.viewed} people.`}
                  </p>

                  {data.confirmation.videos.length > 0 && (
                    <div className="mt-5 space-y-4">
                      {data.confirmation.videos.map(v => (
                        <div key={v.key} className="rounded-xl bg-stone-50 dark:bg-neutral-800/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-bold text-stone-900 dark:text-white">{v.title}</p>
                            {!v.measurable && (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-stone-200 dark:bg-neutral-700 text-stone-500 dark:text-neutral-300">
                                {fr ? 'Non mesurable' : 'Not measurable'}
                              </span>
                            )}
                          </div>
                          {v.measurable ? (
                            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                              <Metric label={fr ? 'Ont lancé' : 'Started'} value={`${v.started}/${v.viewers}`} sub={fmtPct(pct(v.started, v.viewers))} />
                              <Metric label={fr ? 'Durée moyenne' : 'Avg watch time'} value={formatDuration(v.avg_watched)} sub={`${fmtPct(v.avg_pct)} ${fr ? 'de la vidéo' : 'of video'}`} />
                              <Metric label={fr ? 'Vue en entier' : 'Watched fully'} value={`${v.completed}`} sub={fmtPct(pct(v.completed, v.viewers))} />
                            </div>
                          ) : (
                            <p className="text-xs text-stone-500 dark:text-neutral-400 mt-2">{fr ? 'Le temps de visionnage est mesuré uniquement pour YouTube et Vimeo.' : 'Watch time is only measured for YouTube and Vimeo.'}</p>
                          )}
                          {v.measurable && (
                            <div className="mt-3 h-1.5 rounded-full bg-stone-200 dark:bg-neutral-700 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, v.avg_pct)}%` }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {data.confirmation.pre_meeting.enabled && (
                    <div className="mt-6">
                      <p className="text-sm font-bold text-stone-900 dark:text-white">{inscription ? (fr ? 'Questionnaire complémentaire' : 'Follow-up questionnaire') : (fr ? 'Questionnaire avant rendez-vous' : 'Pre-meeting questionnaire')}</p>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                        <Metric label={fr ? 'Affiché' : 'Shown'} value={`${data.confirmation.pre_meeting.shown}`} />
                        <Metric label={fr ? 'Commencé' : 'Started'} value={`${data.confirmation.pre_meeting.started}`} sub={fmtPct(pct(data.confirmation.pre_meeting.started, data.confirmation.pre_meeting.shown))} />
                        <Metric label={fr ? 'Envoyé' : 'Submitted'} value={`${data.confirmation.pre_meeting.submitted}`} sub={fmtPct(pct(data.confirmation.pre_meeting.submitted, data.confirmation.pre_meeting.shown))} />
                      </div>
                      <QuestionTable rows={data.confirmation.pre_meeting.questions} base={data.confirmation.pre_meeting.shown} total={data.confirmation.pre_meeting.shown} fr={fr} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white dark:bg-neutral-900 border border-stone-200/60 dark:border-neutral-700/60 px-2 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-neutral-500">{label}</p>
      <p className="text-sm font-extrabold text-stone-900 dark:text-white mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-stone-500 dark:text-neutral-400">{sub}</p>}
    </div>
  )
}

function QuestionTable({ rows, base, total, fr }: {
  rows: { id: string; index: number; text: string; answered: number; stopped: number }[]; base: number; total: number; fr: boolean
}) {
  const maxStopped = Math.max(0, ...rows.map(r => r.stopped))
  return (
    <div className="mt-4 divide-y divide-stone-100 dark:divide-neutral-800">
      {rows.map(r => (
        <div key={r.id} className="py-3 flex items-start gap-3">
          <span className="mt-0.5 flex h-6 min-w-6 px-1.5 items-center justify-center rounded-md bg-stone-100 dark:bg-neutral-800 text-[11px] font-black text-stone-600 dark:text-neutral-300">{r.index}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-stone-800 dark:text-neutral-200">{r.text}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-stone-100 dark:bg-neutral-800 overflow-hidden">
                <div className="h-full rounded-full bg-stone-900 dark:bg-white" style={{ width: `${pct(r.answered, base)}%` }} />
              </div>
              <span className="text-[11px] text-stone-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">{fmtPct(pct(r.answered, base))} {fr ? 'répondent' : 'answer'}</span>
            </div>
          </div>
          <div className="text-right shrink-0 w-28">
            {r.stopped > 0 ? (
              <p className={`text-xs font-bold ${r.stopped === maxStopped ? 'text-red-500' : 'text-stone-500 dark:text-neutral-400'}`}>
                {r.stopped} {fr ? 'abandon' : 'drop-off'}{r.stopped > 1 ? 's' : ''}
                <span className="block font-medium text-[11px]">{fmtPct(pct(r.stopped, total))} {fr ? 'des visites' : 'of visits'}</span>
              </p>
            ) : (
              <p className="text-xs text-stone-300 dark:text-neutral-600">—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
