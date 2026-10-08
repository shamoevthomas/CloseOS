import { Fragment, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Calendar, ArrowRight, Loader2, Send, ClipboardList } from 'lucide-react'
import {
  type ConfirmationPageConfig, type PreMeetingAnswer,
  toEmbedUrl, isDarkColor, safeHref,
} from '../lib/confirmationPage'
import type { FunnelConfirmationPatch, FunnelVideoProgress } from '../lib/funnelTracker'

interface Props {
  config: ConfirmationPageConfig
  lang: 'fr' | 'en'
  inscription: boolean
  /** Titre / message par défaut quand la campagne n'en définit pas */
  defaultTitle: string
  defaultMessage: string
  recap?: { label: string; detail: string; extra?: string } | null
  footnotes?: string[]
  /** Absent en aperçu : le questionnaire est alors affiché mais non envoyable */
  onSubmitAnswers?: (answers: PreMeetingAnswer[]) => Promise<boolean>
  /** Aperçu dans l'éditeur : pas de min-h-screen */
  preview?: boolean
  embed?: boolean
  /** Tracking (page publique uniquement) : affichage, visionnage, questionnaire */
  onTrack?: (patch: FunnelConfirmationPatch) => void
}

/**
 * Page de confirmation personnalisée d'une campagne (RDV ou inscription).
 * Utilisée à la fois sur /capture/:slug et dans l'aperçu de l'éditeur.
 */
export function CampaignConfirmationPage({
  config, lang, inscription, defaultTitle, defaultMessage, recap, footnotes = [],
  onSubmitAnswers, preview = false, embed = false, onTrack,
}: Props) {
  const fr = lang === 'fr'
  const bg = embed ? '#ffffff' : (config.bg_color || '#f4f2f1')
  const accent = config.accent_color || '#111111'
  const videoUrl = config.video_url ? toEmbedUrl(config.video_url) : ''
  const q = config.questionnaire
  // Hors aperçu, sans jeton d'envoi (cas rare de reprise après paiement) on masque le questionnaire
  const questions = q.enabled && (preview || onSubmitAnswers) ? q.questions.filter(x => x.label.trim()) : []
  const buttons = config.buttons.filter(b => b.label.trim())
  const sections = (config.sections || [])
    .map(sec => ({ ...sec, videos: sec.videos.filter(v => v.url.trim()) }))
    .filter(sec => sec.videos.length > 0)

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [sendError, setSendError] = useState(false)

  const setAnswer = (id: string, v: string | string[]) => {
    setAnswers(prev => ({ ...prev, [id]: v }))
    if (missing.has(id)) setMissing(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const submit = async () => {
    if (!onSubmitAnswers || sending) return
    const miss = new Set(questions.filter(x => {
      if (!x.required) return false
      const v = answers[x.id]
      return Array.isArray(v) ? v.length === 0 : !String(v || '').trim()
    }).map(x => x.id))
    setMissing(miss)
    if (miss.size) return
    setSending(true); setSendError(false)
    const payload: PreMeetingAnswer[] = questions
      .map(x => {
        const v = answers[x.id]
        return { question: x.label.trim(), answer: Array.isArray(v) ? v.join(', ') : String(v || '').trim() }
      })
      .filter(a => a.answer)
    const ok = await onSubmitAnswers(payload).catch(() => false)
    setSending(false)
    if (ok) setSent(true)
    else setSendError(true)
  }

  // ─── Tracking ───
  const onTrackRef = useRef(onTrack)
  onTrackRef.current = onTrack
  useEffect(() => { onTrackRef.current?.({ viewed: true }) }, [])
  useEffect(() => {
    if (!onTrackRef.current || questions.length === 0) return
    const answered = questions.filter(x => { const v = answers[x.id]; return Array.isArray(v) ? v.length > 0 : !!String(v || '').trim() }).map(x => x.id)
    if (answered.length === 0 && !sent) return
    const stuck = questions.find(x => !answered.includes(x.id))
    onTrackRef.current({ pre_meeting: { answered, stuck: stuck?.id ?? null, submitted: sent } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, sent])
  const trackVideo = onTrack ? (key: string, p: FunnelVideoProgress) => onTrackRef.current?.({ videos: { [key]: p } }) : undefined

  const fieldCls = 'w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-[#111111] placeholder:text-stone-400 outline-none focus:border-stone-400 transition-colors'

  return (
    <div
      className={`${preview ? 'min-h-full' : 'min-h-screen'} w-full flex items-center justify-center px-4 py-10 transition-colors`}
      style={{ backgroundColor: bg }}
    >
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-[28px] border border-stone-200/70 p-7 sm:p-9 shadow-[0_24px_60px_-24px_rgba(17,17,17,0.22)] text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: `${accent}14` }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: accent }} />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight mb-3 break-words" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {config.title.trim() || defaultTitle}
          </h1>
          <p className="text-stone-600 leading-relaxed whitespace-pre-line break-words">
            {config.message.trim() || defaultMessage}
          </p>

          {config.show_recap && recap && !inscription && (
            <div className="mt-6 rounded-2xl bg-[#f4f2f1] border border-stone-200/70 p-5 flex items-center gap-4 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-stone-200">
                <Calendar className="h-5 w-5" style={{ color: accent }} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#111111]">{recap.label}</p>
                <p className="text-sm text-stone-500 first-letter:uppercase">{recap.detail}</p>
                {recap.extra && <p className="text-xs font-bold mt-1" style={{ color: accent }}>{recap.extra}</p>}
              </div>
            </div>
          )}

          {videoUrl && (
            <div className="mt-7 text-left">
              {config.video_title.trim() && (
                <p className="text-sm font-bold text-[#111111] mb-3">{config.video_title}</p>
              )}
              <VideoFrame url={config.video_url} title={config.video_title} onProgress={trackVideo && (p => trackVideo('main', p))} />
            </div>
          )}

          {(config.block_order || []).map(key => (
            <Fragment key={key}>
              {key === 'sections' && (<>{sections.map(sec => (
            <div key={sec.id} className="mt-9 text-left">
              <div className="flex items-center gap-3 mb-4">
                <span className="h-px flex-1 bg-stone-200" />
                <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-500">{sec.title.trim() || (fr ? 'Éducation' : 'Education')}</p>
                <span className="h-px flex-1 bg-stone-200" />
              </div>
              <div className="space-y-6">
                {sec.videos.map((v, i) => (
                  <div key={v.id}>
                    <p className="text-sm font-bold text-[#111111] mb-2.5 flex items-start gap-2">
                      <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-md text-[11px] font-black" style={{ backgroundColor: `${accent}14`, color: accent }}>{i + 1}</span>
                      <span>{v.title.trim() || (fr ? `Vidéo ${i + 1}` : `Video ${i + 1}`)}</span>
                    </p>
                    <VideoFrame url={v.url} title={v.title} onProgress={trackVideo && (p => trackVideo(v.id, p))} />
                  </div>
                ))}
              </div>
            </div>
          ))}</>)}
              {key === 'questionnaire' && (questions.length > 0 && (
            <div className="mt-7 text-left rounded-2xl border border-stone-200 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-4 w-4" style={{ color: accent }} />
                <p className="text-base font-extrabold text-[#111111]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {q.title.trim() || (fr ? 'Avant notre rendez-vous' : 'Before our meeting')}
                </p>
              </div>
              {q.intro.trim() && <p className="text-sm text-stone-500 mb-4 whitespace-pre-line">{q.intro}</p>}

              {sent ? (
                <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm font-semibold text-emerald-800">{fr ? 'Merci, vos réponses ont bien été envoyées !' : 'Thanks, your answers have been sent!'}</p>
                </div>
              ) : (
                <div className="space-y-5 mt-4">
                  {questions.map(x => {
                    const v = answers[x.id]
                    const err = missing.has(x.id)
                    return (
                      <div key={x.id}>
                        <label className="block text-sm font-semibold text-[#111111] mb-2">
                          {x.label}{x.required && <span className="text-red-500"> *</span>}
                        </label>
                        {x.type === 'text' && (
                          <input className={fieldCls} value={(v as string) || ''} onChange={e => setAnswer(x.id, e.target.value)} />
                        )}
                        {x.type === 'textarea' && (
                          <textarea rows={3} className={`${fieldCls} resize-y`} value={(v as string) || ''} onChange={e => setAnswer(x.id, e.target.value)} />
                        )}
                        {(x.type === 'select' || x.type === 'yes_no') && (
                          <div className="flex flex-wrap gap-2">
                            {(x.type === 'yes_no' ? (fr ? ['Oui', 'Non'] : ['Yes', 'No']) : x.options.filter(Boolean)).map(opt => {
                              const on = v === opt
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setAnswer(x.id, opt)}
                                  className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
                                  style={on ? { backgroundColor: accent, borderColor: accent, color: isDarkColor(accent) ? '#fff' : '#111' } : { borderColor: '#e7e5e4', color: '#111111' }}
                                >
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {x.type === 'multiple_choice' && (
                          <div className="flex flex-wrap gap-2">
                            {x.options.filter(Boolean).map(opt => {
                              const arr = Array.isArray(v) ? v : []
                              const on = arr.includes(opt)
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setAnswer(x.id, on ? arr.filter(o => o !== opt) : [...arr, opt])}
                                  className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
                                  style={on ? { backgroundColor: accent, borderColor: accent, color: isDarkColor(accent) ? '#fff' : '#111' } : { borderColor: '#e7e5e4', color: '#111111' }}
                                >
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {err && <p className="text-xs text-red-500 mt-1.5">{fr ? 'Réponse requise' : 'Answer required'}</p>}
                      </div>
                    )
                  })}

                  {sendError && <p className="text-xs text-red-500">{fr ? "L'envoi a échoué, réessayez." : 'Sending failed, please try again.'}</p>}
                  <button
                    type="button"
                    onClick={submit}
                    disabled={sending || !onSubmitAnswers}
                    className="w-full h-12 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:opacity-60"
                    style={{ backgroundColor: accent, color: isDarkColor(accent) ? '#ffffff' : '#111111' }}
                    title={!onSubmitAnswers ? (fr ? 'Aperçu : envoi désactivé' : 'Preview: sending disabled') : undefined}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {fr ? 'Envoyer mes réponses' : 'Send my answers'}
                  </button>
                </div>
              )}
            </div>
          ))}
              {key === 'buttons' && (buttons.length > 0 && (
            <div className="mt-7 flex flex-col gap-3">
              {buttons.map(b => {
                const href = safeHref(b.url)
                const cls = 'w-full min-h-14 px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-all hover:-translate-y-0.5 break-words'
                const style = { backgroundColor: b.bg_color || accent, color: b.text_color || '#ffffff' }
                return href ? (
                  <a key={b.id} href={href} target={b.new_tab ? '_blank' : '_top'} rel="noopener noreferrer" className={cls} style={style}>
                    <span>{b.label}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </a>
                ) : (
                  <span key={b.id} className={`${cls} opacity-60 cursor-not-allowed`} style={style}>{b.label}</span>
                )
              })}
            </div>
          ))}
            </Fragment>
          ))}

          {footnotes.length > 0 && (
            <div className="mt-7 space-y-1">
              {footnotes.map((f, i) => <p key={i} className="text-xs text-stone-400">{f}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Lecteur vidéo. Avec onProgress, mesure le visionnage réel via l'API
 * postMessage de YouTube (enablejsapi) ou de Vimeo ; Loom/Wistia ne sont pas
 * mesurés. Seul le temps de lecture effectif est compté (pas les sauts).
 */
function VideoFrame({ url, title, onProgress }: { url: string; title: string; onProgress?: (p: FunnelVideoProgress) => void }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const isYouTube = /youtube\.com|youtu\.be/i.test(url)
  const isVimeo = /vimeo\.com/i.test(url)
  let src = toEmbedUrl(url)
  if (onProgress && isYouTube) {
    src += `${src.includes('?') ? '&' : '?'}enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
  }

  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  useEffect(() => {
    if (!onProgressRef.current || (!isYouTube && !isVimeo)) return
    const progress: FunnelVideoProgress = { watched: 0, duration: 0, max: 0 }
    let last: number | null = null
    let playing = false
    let lastReport = 0

    const report = (force = false) => {
      const now = Date.now()
      if (!force && now - lastReport < 5000) return
      lastReport = now
      onProgressRef.current?.({ ...progress, watched: Math.round(progress.watched), max: Math.round(progress.max), duration: Math.round(progress.duration) })
    }
    const tick = (time: number, duration?: number) => {
      if (duration && duration > 0) progress.duration = duration
      if (playing && last !== null) {
        const delta = time - last
        if (delta > 0 && delta < 3) progress.watched += delta // un saut n'est pas du visionnage
      }
      last = time
      if (time > progress.max) progress.max = time
      report()
    }

    const post = (msg: unknown) => {
      try { ref.current?.contentWindow?.postMessage(typeof msg === 'string' ? msg : JSON.stringify(msg), '*') } catch { /* ignore */ }
    }
    const subscribe = () => {
      if (isYouTube) post({ event: 'listening', id: 'closeos', channel: 'widget' })
      if (isVimeo) {
        post({ method: 'addEventListener', value: 'timeupdate' })
        post({ method: 'addEventListener', value: 'play' })
        post({ method: 'addEventListener', value: 'pause' })
        post({ method: 'addEventListener', value: 'ended' })
      }
    }

    const onMessage = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return
      let data: any = e.data
      if (typeof data === 'string') { try { data = JSON.parse(data) } catch { return } }
      if (!data || typeof data !== 'object') return
      if (isYouTube && data.event === 'infoDelivery' && data.info) {
        const info = data.info
        if (typeof info.playerState === 'number') {
          const wasPlaying = playing
          playing = info.playerState === 1
          if (!playing && wasPlaying) report(true)
        }
        if (typeof info.currentTime === 'number') tick(info.currentTime, info.duration)
        else if (typeof info.duration === 'number' && info.duration > 0) progress.duration = info.duration
      }
      if (isVimeo) {
        if (data.event === 'ready') subscribe()
        if (data.event === 'play') playing = true
        if (data.event === 'pause' || data.event === 'ended') { playing = false; report(true) }
        if (data.event === 'timeupdate' && data.data) { playing = true; tick(data.data.seconds, data.data.duration) }
      }
    }

    window.addEventListener('message', onMessage)
    const frame = ref.current
    frame?.addEventListener('load', subscribe)
    // YouTube ne répond qu'une fois le lecteur prêt : on relance l'abonnement quelques fois
    const retries = [500, 1500, 3000, 6000].map(ms => setTimeout(subscribe, ms))
    // visibilitychange part avant pagehide : le traceur envoie ensuite le tout en beacon
    const onHide = () => report(true)
    const onVisibility = () => { if (document.visibilityState === 'hidden') onHide() }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      report(true)
      window.removeEventListener('message', onMessage)
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      frame?.removeEventListener('load', subscribe)
      retries.forEach(clearTimeout)
    }
  }, [src, isYouTube, isVimeo])

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-video">
      <iframe
        ref={ref}
        src={src}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        title={title || 'Video'}
      />
    </div>
  )
}
