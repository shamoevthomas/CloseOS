/* ────────────────────────────────────────────────────────────────
   Page de confirmation personnalisable des campagnes Business
   (affichée après une prise de RDV ou une inscription sur /capture/:slug).
   Stockée telle quelle dans business_campaigns.confirmation_page (jsonb).
   ──────────────────────────────────────────────────────────────── */

export interface ConfirmationButton {
  id: string
  label: string
  url: string
  bg_color: string
  text_color: string
  new_tab: boolean
}

export interface ConfirmationVideo {
  id: string
  url: string
  title: string
}

/** Section de vidéos supplémentaire (ex. « Éducation »), affichée sous la vidéo principale. */
export interface ConfirmationVideoSection {
  id: string
  title: string
  videos: ConfirmationVideo[]
}

/** Blocs réordonnables de la page (le haut — titre, récap, vidéo — reste fixe). */
export type ConfirmationBlockKey = 'sections' | 'buttons' | 'questionnaire'
export const DEFAULT_BLOCK_ORDER: ConfirmationBlockKey[] = ['sections', 'questionnaire', 'buttons']

export type ConfirmationQuestionType = 'text' | 'textarea' | 'select' | 'multiple_choice' | 'yes_no'

export interface ConfirmationQuestion {
  id: string
  label: string
  type: ConfirmationQuestionType
  options: string[]
  required: boolean
}

export interface ConfirmationPageConfig {
  enabled: boolean
  bg_color: string
  accent_color: string
  title: string
  message: string
  show_recap: boolean
  video_url: string
  video_title: string
  sections: ConfirmationVideoSection[]
  buttons: ConfirmationButton[]
  block_order: ConfirmationBlockKey[]
  questionnaire: {
    enabled: boolean
    title: string
    intro: string
    questions: ConfirmationQuestion[]
  }
}

export interface PreMeetingAnswer {
  question: string
  answer: string
}

export const CONFIRMATION_BG_PRESETS = ['#f4f2f1', '#ffffff', '#f0fdf4', '#eff6ff', '#fdf4ff', '#fff7ed', '#111111', '#0f172a']
export const CONFIRMATION_ACCENT_PRESETS = ['#111111', '#10b981', '#2563eb', '#8a43e1', '#ef7b16', '#ff2f2f', '#d511fd', '#0ea5e9']

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function defaultConfirmationPage(): ConfirmationPageConfig {
  return {
    enabled: false,
    bg_color: '#f4f2f1',
    accent_color: '#111111',
    title: '',
    message: '',
    show_recap: true,
    video_url: '',
    video_title: '',
    sections: [],
    buttons: [],
    block_order: [...DEFAULT_BLOCK_ORDER],
    questionnaire: { enabled: false, title: '', intro: '', questions: [] },
  }
}

/** Complète une config partielle venant de la base (champs ajoutés plus tard, null…). */
export function normalizeConfirmationPage(raw: unknown): ConfirmationPageConfig {
  const base = defaultConfirmationPage()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<ConfirmationPageConfig>
  return {
    ...base,
    ...r,
    buttons: Array.isArray(r.buttons) ? r.buttons : [],
    sections: Array.isArray(r.sections)
      ? r.sections.map(sec => ({ ...sec, videos: Array.isArray(sec?.videos) ? sec.videos : [] }))
      : [],
    block_order: normalizeBlockOrder(r.block_order),
    questionnaire: {
      ...base.questionnaire,
      ...(r.questionnaire || {}),
      questions: Array.isArray(r.questionnaire?.questions) ? r.questionnaire!.questions : [],
    },
  }
}

/** Garde chaque bloc connu une seule fois, complète avec ceux qui manquent. */
function normalizeBlockOrder(raw: unknown): ConfirmationBlockKey[] {
  const seen = (Array.isArray(raw) ? raw : []).filter(
    (k, i, arr): k is ConfirmationBlockKey => DEFAULT_BLOCK_ORDER.includes(k as ConfirmationBlockKey) && arr.indexOf(k) === i,
  )
  return [...seen, ...DEFAULT_BLOCK_ORDER.filter(k => !seen.includes(k))]
}

/** YouTube / Loom / Vimeo / Wistia → URL d'iframe. */
export function toEmbedUrl(url: string): string {
  if (!url) return url
  if (url.includes('/embed/')) return url
  const watch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/)
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
  if (short) return `https://www.youtube.com/embed/${short[1]}`
  const shorts = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/)
  if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`
  if (url.includes('loom.com/share/')) return url.replace('/share/', '/embed/')
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo && !url.includes('player.vimeo.com')) return `https://player.vimeo.com/video/${vimeo[1]}`
  const wistia = url.match(/wistia\.com\/medias\/([a-zA-Z0-9]+)/)
  if (wistia) return `https://fast.wistia.net/embed/iframe/${wistia[1]}`
  return url
}

/** Vrai si la couleur est sombre (pour choisir un texte clair ou foncé). */
export function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140
}

/** N'accepte que http(s), mailto et tel : un bouton ne doit jamais exécuter de javascript:. */
export function safeHref(url: string): string | null {
  const u = (url || '').trim()
  if (!u) return null
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(u)) return `https://${u}`
  return null
}
