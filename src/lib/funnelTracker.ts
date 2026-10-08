/* ────────────────────────────────────────────────────────────────
   Tracking du parcours d'une page de campagne (/capture/:slug).
   Une session par visite, gardée en sessionStorage pour survivre au retour
   3DS de Stripe. Les mises à jour sont regroupées et envoyées à
   /api/business?action=funnel-track (sendBeacon à la fermeture de l'onglet).
   ──────────────────────────────────────────────────────────────── */

export type FunnelMilestone =
  | 'view' | 'info_started' | 'info_done' | 'questionnaire_started' | 'questionnaire_done'
  | 'booking' | 'slot_selected' | 'payment' | 'done'

export interface FunnelVideoProgress {
  /** Secondes réellement regardées (cumul) */
  watched: number
  duration: number
  /** Position la plus avancée atteinte */
  max: number
}

export interface FunnelConfirmationPatch {
  viewed?: boolean
  videos?: Record<string, FunnelVideoProgress>
  pre_meeting?: { answered: string[]; stuck: string | null; submitted?: boolean }
}

interface Patch {
  reached?: FunnelMilestone[]
  answered_question_ids?: string[]
  stuck_question_id?: string | null
  completed?: boolean
  disqualified?: boolean
  confirmation?: FunnelConfirmationPatch
}

const ENDPOINT = '/api/business?action=funnel-track'

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export interface FunnelTracker {
  sessionId: string
  reach: (m: FunnelMilestone) => void
  update: (p: Omit<Patch, 'reached'>) => void
  confirmation: (p: FunnelConfirmationPatch) => void
  flush: (beacon?: boolean) => void
}

/**
 * @param resume true au retour d'un paiement Stripe : on reprend la session
 *               même si elle a été marquée terminée.
 */
export function createFunnelTracker(slug: string, resume = false): FunnelTracker {
  const storageKey = `closeos_funnel_${slug}`
  let sessionId = ''
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as { id: string; done?: boolean } | null
    if (saved?.id && (!saved.done || resume)) sessionId = saved.id
  } catch { /* stockage indisponible */ }
  if (!sessionId) sessionId = uuid()
  const persist = (done = false) => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ id: sessionId, done })) } catch { /* ignore */ }
  }
  persist()

  const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
  const sent = new Set<FunnelMilestone>()
  let pending: Patch = {}
  let timer: ReturnType<typeof setTimeout> | null = null

  const send = (beacon: boolean) => {
    if (timer) { clearTimeout(timer); timer = null }
    if (Object.keys(pending).length === 0) return
    const body = JSON.stringify({ slug, session_id: sessionId, device, ...pending })
    pending = {}
    try {
      if (beacon && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, body)
      else fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    } catch { /* ignore */ }
  }
  const schedule = (delay = 1200) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => send(false), delay)
  }

  const onHide = () => send(true)
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') onHide() })

  return {
    sessionId,
    reach(m) {
      if (sent.has(m)) return
      sent.add(m)
      pending.reached = [...(pending.reached || []), m]
      if (m === 'done') { pending.completed = true; persist(true) }
      schedule(m === 'view' ? 0 : 800)
    },
    update(p) {
      pending = { ...pending, ...p }
      if (p.completed) persist(true)
      schedule()
    },
    confirmation(p) {
      const prev = pending.confirmation || {}
      pending.confirmation = {
        ...prev,
        ...p,
        videos: p.videos ? { ...(prev.videos || {}), ...p.videos } : prev.videos,
      }
      schedule(4000)
    },
    flush(beacon = false) { send(beacon) },
  }
}
