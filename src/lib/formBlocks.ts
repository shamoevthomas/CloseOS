// Modèle de blocs des Formulaires Business (éditeur type Notion).
// Pur — aucun React, aucun fetch. Utilisable côté serveur.
// ⚠️ Miroir : api/_lib/formBlocks.ts — garder les deux fichiers synchronisés.

// ─── Types de blocs ───

/** Blocs de contenu : affichés au visiteur, ne collectent aucune réponse. */
export const CONTENT_BLOCK_TYPES = [
  'heading',
  'subheading',
  'paragraph',
  'divider',
  'image',
  'page_break',
] as const

/** Blocs de saisie : produisent une réponse stockée. */
export const INPUT_BLOCK_TYPES = [
  'short_text',
  'long_text',
  'email',
  'phone',
  'number',
  'url',
  'date',
  'select',
  'single_choice',
  'multiple_choice',
  'rating',
  'linear_scale',
  'yes_no',
  'hidden',
  // La vidéo est un bloc de saisie : sa « réponse » est le nombre de secondes
  // visionnées, ce qui permet d'exiger un visionnage minimum et de le consigner.
  'video',
] as const

export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number]
export type InputBlockType = (typeof INPUT_BLOCK_TYPES)[number]
export type FormBlockType = ContentBlockType | InputBlockType

const INPUT_SET: Set<string> = new Set(INPUT_BLOCK_TYPES)
const CONTENT_SET: Set<string> = new Set(CONTENT_BLOCK_TYPES)

export function isInputBlock(type: FormBlockType | string): boolean {
  return INPUT_SET.has(type)
}

export function isContentBlock(type: FormBlockType | string): boolean {
  return CONTENT_SET.has(type)
}

/** Blocs qui proposent une liste d'options éditable. */
export function hasOptions(type: FormBlockType | string): boolean {
  return type === 'select' || type === 'single_choice' || type === 'multiple_choice'
}

// ─── Logique conditionnelle ───

export type FormConditionalOperator = 'in' | 'not_in' | 'gte' | 'lte' | 'between' | 'answered'

export type FormConditionalRule = {
  enabled: boolean
  /** id du bloc source dont dépend l'affichage */
  source_id: string
  operator: FormConditionalOperator
  values: (string | number)[]
}

/** Types pouvant servir de source à une règle conditionnelle. */
export const ELIGIBLE_SOURCE_TYPES: FormBlockType[] = [
  'select',
  'single_choice',
  'multiple_choice',
  'number',
  'rating',
  'linear_scale',
  'yes_no',
  // secondes visionnées → « afficher si la vidéo a été vue au moins N secondes »
  'video',
]

export function isEligibleSourceType(type: FormBlockType | string | null | undefined): boolean {
  return !!type && (ELIGIBLE_SOURCE_TYPES as string[]).includes(type)
}

/** Types dont la valeur est numérique (opérateurs gte/lte/between). */
function isNumericType(type: FormBlockType | string): boolean {
  return type === 'number' || type === 'rating' || type === 'linear_scale' || type === 'video'
}

/** Types dont la valeur est un choix (opérateurs in/not_in). */
function isChoiceType(type: FormBlockType | string): boolean {
  return hasOptions(type) || type === 'yes_no'
}

// ─── Bloc ───

export interface FormBlock {
  id: string
  type: FormBlockType
  /** Libellé de la question (blocs de saisie) ou texte affiché (blocs de contenu). */
  text: string
  /** Sous-texte optionnel affiché sous le libellé. */
  description?: string
  placeholder?: string
  required?: boolean
  /** select / single_choice / multiple_choice */
  options?: string[]
  /** rating : nombre d'icônes ; linear_scale : borne haute */
  max?: number
  /** linear_scale : borne basse */
  min?: number
  /** linear_scale : légendes des extrémités */
  min_label?: string
  max_label?: string
  /** image / video : URL affichée */
  url?: string
  /** video : secondes de visionnage exigées quand `required` est actif */
  min_watch?: number
  /** hidden : clé lue dans la query string de la page publique */
  key?: string
  conditional?: FormConditionalRule | null
}

export function newBlockId(): string {
  const c: any = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `blk_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`
}

/** Valeurs par défaut d'un bloc fraîchement inséré. */
export function createBlock(type: FormBlockType, overrides: Partial<FormBlock> = {}): FormBlock {
  const base: FormBlock = {
    id: newBlockId(),
    type,
    text: '',
    conditional: null,
  }

  if (isInputBlock(type) && type !== 'hidden') base.required = false
  if (hasOptions(type)) base.options = ['Option 1', 'Option 2']
  if (type === 'rating') base.max = 5
  if (type === 'linear_scale') {
    base.min = 1
    base.max = 10
  }
  if (type === 'hidden') base.key = ''
  if (type === 'video') base.min_watch = 30

  return { ...base, ...overrides }
}

// ─── Pagination (sauts de page) ───

/**
 * Découpe les blocs en pages sur les blocs `page_break`.
 * Les séparateurs eux-mêmes ne sont pas inclus dans les pages.
 * Renvoie toujours au moins une page (éventuellement vide).
 */
export function splitIntoPages(blocks: FormBlock[]): FormBlock[][] {
  const pages: FormBlock[][] = [[]]
  for (const block of blocks) {
    if (block.type === 'page_break') {
      pages.push([])
      continue
    }
    pages[pages.length - 1].push(block)
  }
  // Une page vide en fin de formulaire (saut de page final) n'a pas de sens à l'affichage
  while (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop()
  return pages
}

// ─── Évaluation conditionnelle ───

export function isRuleValid(
  rule: FormConditionalRule | null | undefined,
  blocksById: Record<string, FormBlock>,
): boolean {
  if (!rule || !rule.enabled || !rule.source_id) return false
  const src = blocksById[rule.source_id]
  if (!src || !isEligibleSourceType(src.type)) return false

  if (rule.operator === 'answered') return true

  if (isChoiceType(src.type)) {
    return (
      (rule.operator === 'in' || rule.operator === 'not_in') &&
      Array.isArray(rule.values) &&
      rule.values.length > 0
    )
  }

  if (isNumericType(src.type)) {
    if (rule.operator === 'gte' || rule.operator === 'lte') {
      return Array.isArray(rule.values) && Number.isFinite(Number(rule.values[0]))
    }
    if (rule.operator === 'between') {
      return (
        Array.isArray(rule.values) &&
        rule.values.length >= 2 &&
        Number.isFinite(Number(rule.values[0])) &&
        Number.isFinite(Number(rule.values[1]))
      )
    }
  }

  return false
}

function isAnswered(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  return false
}

/** true = le bloc doit être affiché. Une règle absente ou invalide affiche toujours le bloc. */
export function evaluateConditional(
  rule: FormConditionalRule | null | undefined,
  answers: Record<string, unknown>,
  blocksById: Record<string, FormBlock>,
): boolean {
  if (!isRuleValid(rule, blocksById)) return true
  const r = rule as FormConditionalRule
  const src = blocksById[r.source_id]
  const answer = answers[r.source_id]

  if (r.operator === 'answered') return isAnswered(answer)

  if (isChoiceType(src.type)) {
    const wanted = r.values.map(String)
    // multiple_choice : la réponse est un tableau
    if (Array.isArray(answer)) {
      const hit = (answer as unknown[]).some(a => wanted.includes(String(a)))
      return r.operator === 'in' ? hit : !hit
    }
    if (!isAnswered(answer)) return false
    const hit = wanted.includes(String(answer))
    return r.operator === 'in' ? hit : !hit
  }

  // Numérique
  const n = typeof answer === 'number' ? answer : Number(answer)
  if (!Number.isFinite(n)) return false
  if (r.operator === 'gte') return n >= Number(r.values[0])
  if (r.operator === 'lte') return n <= Number(r.values[0])
  if (r.operator === 'between') return n >= Number(r.values[0]) && n <= Number(r.values[1])
  return false
}

/**
 * Ids des blocs visibles compte tenu des réponses.
 * Les règles ne s'évaluent que sur des sources situées AVANT le bloc (garanti côté éditeur),
 * on ne fait donc qu'une seule passe.
 */
export function computeVisibleBlockIds(
  blocks: FormBlock[],
  answers: Record<string, unknown>,
): Set<string> {
  const byId: Record<string, FormBlock> = {}
  for (const b of blocks) byId[b.id] = b

  const visible = new Set<string>()
  for (const b of blocks) {
    const rule = b.conditional
    // Un bloc dont la source est elle-même masquée est masqué à son tour.
    // La source précède toujours le bloc, sa visibilité est donc déjà connue.
    if (isRuleValid(rule, byId) && !visible.has((rule as FormConditionalRule).source_id)) continue
    if (evaluateConditional(rule, answers, byId)) visible.add(b.id)
  }
  return visible
}

// ─── Vidéo ───

export type VideoProvider = 'youtube' | 'vimeo' | 'drive' | 'loom' | 'file' | 'unknown'

export interface ParsedVideo {
  provider: VideoProvider
  /** URL à placer dans l'iframe, ou dans <video> quand provider === 'file' */
  src: string
}

const VIDEO_FILE_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i

/**
 * Traduit un lien collé en URL intégrable.
 * Accepte YouTube (watch, youtu.be, shorts, embed), Vimeo, Google Drive, Loom,
 * un fichier vidéo direct, et retombe sur l'URL telle quelle sinon.
 */
export function parseVideoUrl(raw: string | undefined | null): ParsedVideo | null {
  const url = (raw || '').trim()
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  const host = parsed.hostname.replace(/^www\./, '')
  const path = parsed.pathname

  // YouTube
  if (host === 'youtu.be') {
    const id = path.slice(1).split('/')[0]
    if (id) return { provider: 'youtube', src: `https://www.youtube.com/embed/${id}` }
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const watchId = parsed.searchParams.get('v')
    if (watchId) return { provider: 'youtube', src: `https://www.youtube.com/embed/${watchId}` }
    const match = path.match(/^\/(embed|shorts|v|live)\/([^/?]+)/)
    if (match) return { provider: 'youtube', src: `https://www.youtube.com/embed/${match[2]}` }
  }

  // Vimeo
  if (host === 'vimeo.com') {
    const match = path.match(/\/(?:video\/)?(\d+)/)
    if (match) return { provider: 'vimeo', src: `https://player.vimeo.com/video/${match[1]}` }
  }
  if (host === 'player.vimeo.com') {
    return { provider: 'vimeo', src: url }
  }

  // Google Drive
  if (host === 'drive.google.com') {
    const match = path.match(/\/file\/d\/([^/]+)/)
    const id = match ? match[1] : parsed.searchParams.get('id')
    if (id) return { provider: 'drive', src: `https://drive.google.com/file/d/${id}/preview` }
  }

  // Loom
  if (host === 'loom.com' || host === 'www.loom.com') {
    const match = path.match(/\/(?:share|embed)\/([^/?]+)/)
    if (match) return { provider: 'loom', src: `https://www.loom.com/embed/${match[1]}` }
  }

  // Fichier vidéo direct
  if (VIDEO_FILE_RE.test(path)) return { provider: 'file', src: url }

  // Lien inconnu : tenté tel quel dans une iframe
  return { provider: 'unknown', src: url }
}

/** Ajoute le paramètre de lecture automatique propre au fournisseur. */
export function videoSrcWithAutoplay(video: ParsedVideo): string {
  const separator = video.src.includes('?') ? '&' : '?'
  switch (video.provider) {
    case 'youtube':
      return `${video.src}${separator}autoplay=1&rel=0&modestbranding=1`
    case 'vimeo':
      return `${video.src}${separator}autoplay=1`
    case 'loom':
      return `${video.src}${separator}autoplay=1`
    default:
      // Google Drive et les lecteurs inconnus ignorent l'autoplay : le visiteur
      // lance la lecture dans le lecteur, notre bouton ayant déjà armé le compteur.
      return video.src
  }
}

/** Secondes de visionnage exigées pour un bloc vidéo (0 = aucune contrainte). */
export function requiredWatchSeconds(block: FormBlock): number {
  if (block.type !== 'video' || !block.required) return 0
  const n = Number(block.min_watch)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

// ─── Validation ───

export type ValidationCode =
  | 'required'
  | 'invalid_email'
  | 'invalid_phone'
  | 'invalid_number'
  | 'invalid_url'
  | 'watch_required'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i
/** Au moins 6 chiffres, autorise +, espaces, points, tirets, parenthèses. */
const PHONE_RE = /^\+?[\d\s.\-()]{6,}$/

/** Renvoie un code d'erreur, ou null si la valeur est acceptable. */
export function validateAnswer(block: FormBlock, value: unknown): ValidationCode | null {
  if (!isInputBlock(block.type) || block.type === 'hidden') return null

  // La vidéo se juge sur les secondes visionnées, pas sur le remplissage d'un champ
  if (block.type === 'video') {
    const needed = requiredWatchSeconds(block)
    if (needed === 0) return null
    const watched = Number(value)
    return Number.isFinite(watched) && watched >= needed ? null : 'watch_required'
  }

  const empty = !isAnswered(value)
  if (empty) return block.required ? 'required' : null

  const str = typeof value === 'string' ? value.trim() : String(value)

  switch (block.type) {
    case 'email':
      return EMAIL_RE.test(str) ? null : 'invalid_email'
    case 'phone':
      return PHONE_RE.test(str) && (str.match(/\d/g) || []).length >= 6 ? null : 'invalid_phone'
    case 'url':
      return URL_RE.test(str) ? null : 'invalid_url'
    case 'number':
    case 'rating':
    case 'linear_scale':
      return Number.isFinite(Number(str)) ? null : 'invalid_number'
    default:
      return null
  }
}

/** Valide un formulaire complet. Renvoie { blockId: code } pour les blocs visibles en erreur. */
export function validateAnswers(
  blocks: FormBlock[],
  answers: Record<string, unknown>,
): Record<string, ValidationCode> {
  const visible = computeVisibleBlockIds(blocks, answers)
  const errors: Record<string, ValidationCode> = {}
  for (const b of blocks) {
    if (!visible.has(b.id)) continue
    const code = validateAnswer(b, answers[b.id])
    if (code) errors[b.id] = code
  }
  return errors
}

// ─── Affichage des réponses (tableau, CSV, email) ───

/** Rend une réponse sous forme de texte simple. */
export function answerToText(block: FormBlock, value: unknown): string {
  if (block.type === 'video') {
    const watched = Number(value)
    return Number.isFinite(watched) && watched > 0 ? `${Math.floor(watched)} s visionnées` : 'Non visionnée'
  }
  if (value == null || value === '') return ''
  if (block.type === 'yes_no') {
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
    return String(value) === 'true' || String(value) === 'Oui' ? 'Oui' : 'Non'
  }
  if (Array.isArray(value)) return value.map(v => String(v)).join(', ')
  return String(value)
}

/** Libellé de colonne pour un bloc de saisie (fallback si le libellé est vide). */
export function blockLabel(block: FormBlock, index: number): string {
  const t = (block.text || '').trim()
  if (t) return t
  if (block.type === 'hidden' && block.key) return block.key
  return `Question ${index + 1}`
}

// ─── Mapping CRM ───

export type CrmMapping = {
  name: string | null
  email: string | null
  phone: string | null
}

export const EMPTY_CRM_MAPPING: CrmMapping = { name: null, email: null, phone: null }

/**
 * Devine le mapping CRM à partir des blocs : premier bloc email, premier bloc téléphone,
 * et premier bloc texte dont le libellé évoque un nom.
 */
export function guessCrmMapping(blocks: FormBlock[]): CrmMapping {
  const mapping: CrmMapping = { ...EMPTY_CRM_MAPPING }
  const NAME_HINTS = ['nom', 'name', 'prénom', 'prenom', 'first', 'last', 'appel']

  for (const b of blocks) {
    if (!isInputBlock(b.type)) continue
    const label = (b.text || '').toLowerCase()

    if (!mapping.email && b.type === 'email') mapping.email = b.id
    if (!mapping.phone && b.type === 'phone') mapping.phone = b.id
    if (
      !mapping.name &&
      (b.type === 'short_text' || b.type === 'long_text') &&
      NAME_HINTS.some(h => label.includes(h))
    ) {
      mapping.name = b.id
    }
  }

  // Repli : le premier champ texte devient le nom si rien n'a matché
  if (!mapping.name) {
    const firstText = blocks.find(b => b.type === 'short_text')
    if (firstText) mapping.name = firstText.id
  }

  return mapping
}

// ─── Réglages du formulaire ───

export interface FormSettings {
  submit_label: string
  /** Page de remerciement */
  thankyou_title: string
  thankyou_text: string
  /** Redirection après envoi (prioritaire sur la page de remerciement si renseignée) */
  redirect_url: string | null
  /** Affiche une barre de progression sur les formulaires multi-pages */
  show_progress: boolean
  /** Couleur d'accent de la page publique */
  accent_color: string
  /** Une question à la fois plutôt que la page entière */
  one_at_a_time: boolean
}

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  submit_label: 'Envoyer',
  thankyou_title: 'Merci !',
  thankyou_text: 'Votre réponse a bien été enregistrée.',
  redirect_url: null,
  show_progress: true,
  accent_color: '#006c49',
  one_at_a_time: false,
}

/** Complète des réglages partiels venus de la base. */
export function normalizeSettings(raw: unknown): FormSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<FormSettings>
  return { ...DEFAULT_FORM_SETTINGS, ...s }
}

/** Normalise des blocs venus de la base (tolère un JSON partiel ou corrompu). */
export function normalizeBlocks(raw: unknown): FormBlock[] {
  if (!Array.isArray(raw)) return []
  const out: FormBlock[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const b = item as Partial<FormBlock>
    if (!b.type || (!isInputBlock(b.type) && !isContentBlock(b.type))) continue
    out.push({
      id: b.id || newBlockId(),
      type: b.type as FormBlockType,
      text: typeof b.text === 'string' ? b.text : '',
      description: typeof b.description === 'string' ? b.description : undefined,
      placeholder: typeof b.placeholder === 'string' ? b.placeholder : undefined,
      required: !!b.required,
      options: Array.isArray(b.options) ? b.options.map(String) : undefined,
      max: typeof b.max === 'number' ? b.max : undefined,
      min: typeof b.min === 'number' ? b.min : undefined,
      min_label: typeof b.min_label === 'string' ? b.min_label : undefined,
      max_label: typeof b.max_label === 'string' ? b.max_label : undefined,
      url: typeof b.url === 'string' ? b.url : undefined,
      min_watch: typeof b.min_watch === 'number' ? b.min_watch : undefined,
      key: typeof b.key === 'string' ? b.key : undefined,
      conditional: b.conditional && typeof b.conditional === 'object' ? (b.conditional as FormConditionalRule) : null,
    })
  }
  return out
}
