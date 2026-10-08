// Import de prospects depuis Google Agenda (CloseOS Sales).
// L'utilisateur décrit ses formats de titre de RDV avec des balises :
//   « Diagnostic Closing 1:1 — [Nom complet] × Thomas »
// Balises reconnues (insensibles à la casse / aux accents) :
//   [Nom complet] (ou [Nom complet Prospect])  → prénom + nom
//   [Prénom]                                   → prénom
//   [Nom]                                      → nom
//   [*] (ou toute autre balise)                → n'importe quel texte, ignoré

export interface GcalImportRule {
  id: string
  template: string
  offer_id: number | null
}

export interface GcalImportSettings {
  rules: GcalImportRule[]
  use_invitees: boolean
  import_all_invitees: boolean
  ignored_emails: string[]
  processed_keys: string[]
}

export const DEFAULT_GCAL_IMPORT_SETTINGS: GcalImportSettings = {
  rules: [],
  use_invitees: true,
  import_all_invitees: false,
  ignored_emails: [],
  processed_keys: [],
}

export interface GcalAttendee {
  email?: string
  displayName?: string
  self?: boolean
  organizer?: boolean
  resource?: boolean
  responseStatus?: string
}

export interface GcalRawEvent {
  id: string
  rawTitle: string
  start: Date
  allDay?: boolean
  status?: string
  attendees?: GcalAttendee[]
  organizerEmail?: string
}

export interface GcalCandidate {
  key: string
  eventId: string
  eventTitle: string
  eventStart: Date
  firstName: string
  lastName: string
  fullName: string
  email: string
  offerId: number | null
  via: 'title' | 'invitee'
}

/** Minuscules, sans accents, espaces normalisés : pour comparer des noms. */
export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9@.]+/g, ' ').trim()

/** Uniformise tirets, croix et espaces pour comparer titres et modèles. */
const normalizeTitle = (s: string) =>
  s.replace(/[‒–—―−]/g, '-')
    .replace(/[×✕✖]/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

type Slot = 'full' | 'first' | 'last' | 'any'

const classifyTag = (inner: string): Slot => {
  const n = normalizeName(inner)
  if (n.includes('complet') || n.includes('full')) return 'full'
  if (n.includes('prenom') || n.includes('first')) return 'first'
  if (/\bnom\b/.test(n) || n.includes('last') || n === 'name') return 'last'
  return 'any'
}

export interface CompiledTemplate {
  regex: RegExp
  slots: Slot[]
  hasName: boolean
}

export function compileTemplate(template: string): CompiledTemplate | null {
  const t = normalizeTitle(template)
  if (!t) return null
  const slots: Slot[] = []
  let pattern = ''
  let last = 0
  const tagRe = /\[([^\]]*)\]/g
  let m: RegExpExecArray | null
  // Texte fixe : espaces tolérants ; un séparateur fait uniquement d'espaces
  // entre deux balises (« [Prénom] [Nom] ») doit en contenir au moins un.
  const literal = (s: string, betweenTags: boolean) =>
    betweenTags && s.length > 0 && !s.trim() ? '\\s+' : escapeRegex(s).replace(/ /g, '\\s*')
  while ((m = tagRe.exec(t))) {
    pattern += literal(t.slice(last, m.index), slots.length > 0)
    const slot = classifyTag(m[1])
    slots.push(slot)
    pattern += slot === 'first' ? '(\\S+)' : '(.+?)'
    last = m.index + m[0].length
  }
  pattern += escapeRegex(t.slice(last)).replace(/ /g, '\\s*')
  // Un modèle sans aucun texte fixe matcherait tous les RDV : refusé.
  if (!t.replace(/\[[^\]]*\]/g, '').trim()) return null
  return {
    regex: new RegExp(`^\\s*${pattern}\\s*$`, 'i'),
    slots,
    hasName: slots.some(s => s !== 'any'),
  }
}

const cleanNamePart = (s: string) =>
  s.replace(/\S+@\S+/g, '').replace(/[()[\]<>"«»]/g, ' ').replace(/^[\s\-–—:,|·•]+|[\s\-–—:,|·•]+$/g, '').replace(/\s+/g, ' ').trim()

const capitalize = (s: string) => s.replace(/(^|[\s'-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase())

const isPlausibleName = (s: string) => s.length >= 2 && s.length <= 80 && /\p{L}/u.test(s)

/** Renvoie le nom extrait si le titre correspond au modèle, sinon null. */
export function matchTitle(compiled: CompiledTemplate, title: string): { firstName: string; lastName: string } | null {
  const m = compiled.regex.exec(normalizeTitle(title))
  if (!m) return null
  let first = ''
  let lastName = ''
  compiled.slots.forEach((slot, i) => {
    const v = cleanNamePart(m[i + 1] || '')
    if (slot === 'full') {
      const parts = v.split(' ')
      first = parts[0] || ''
      lastName = parts.slice(1).join(' ')
    } else if (slot === 'first') first = v
    else if (slot === 'last') lastName = v
  })
  return { firstName: first, lastName }
}

const nameFromEmail = (email: string) => {
  const local = email.split('@')[0].replace(/[0-9]+/g, ' ')
  const parts = local.split(/[._\-+]+/).filter(Boolean).map(p => capitalize(p.toLowerCase()))
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

const splitDisplayName = (name: string) => {
  const parts = cleanNamePart(name).split(' ').filter(Boolean)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

/**
 * Liste les personnes à créer à partir des événements Google.
 * Ne consulte pas le CRM : le dédoublonnage est fait par l'appelant.
 */
export function extractCandidates(
  events: GcalRawEvent[],
  settings: GcalImportSettings,
  selfEmail: string | null | undefined,
  since: Date,
): GcalCandidate[] {
  const compiled = settings.rules
    .map(r => ({ rule: r, c: compileTemplate(r.template) }))
    .filter((x): x is { rule: GcalImportRule; c: CompiledTemplate } => !!x.c)
  if (compiled.length === 0 && !settings.import_all_invitees) return []

  const ignored = new Set([...(settings.ignored_emails || []), selfEmail || ''].map(e => e.trim().toLowerCase()).filter(Boolean))
  const out: GcalCandidate[] = []

  for (const ev of events) {
    if (ev.allDay || ev.status === 'cancelled' || ev.start < since) continue
    const me = ev.attendees?.find(a => a.self)
    if (me?.responseStatus === 'declined') continue

    // Invités pouvant être le prospect : ni moi, ni l'organisateur (souvent le setter),
    // ni une salle, ni un email ignoré.
    const organizer = (ev.organizerEmail || '').toLowerCase()
    const externals = (ev.attendees || []).filter(a => {
      const e = (a.email || '').toLowerCase()
      return e && !a.self && !a.resource && !a.organizer && e !== organizer && !ignored.has(e)
    })

    const push = (first: string, lastName: string, email: string, offerId: number | null, via: 'title' | 'invitee') => {
      const firstName = capitalize(cleanNamePart(first))
      const ln = capitalize(cleanNamePart(lastName))
      const fullName = [firstName, ln].filter(Boolean).join(' ')
      if (!isPlausibleName(fullName) && !email) return
      const identity = email ? email.toLowerCase() : normalizeName(fullName)
      out.push({
        key: `${ev.id}|${identity}`,
        eventId: ev.id,
        eventTitle: ev.rawTitle,
        eventStart: ev.start,
        firstName,
        lastName: ln,
        fullName: fullName || email,
        email: email.toLowerCase(),
        offerId,
        via,
      })
    }

    const hit = compiled.map(x => ({ x, m: matchTitle(x.c, ev.rawTitle) })).find(h => h.m)
    if (hit && hit.m) {
      const titleName = [hit.m.firstName, hit.m.lastName].filter(Boolean).join(' ')
      let email = ''
      let invitee: GcalAttendee | undefined
      if (settings.use_invitees && externals.length > 0) {
        const target = normalizeName(titleName)
        invitee = externals.find(a => {
          const dn = normalizeName(a.displayName || '')
          const local = normalizeName((a.email || '').split('@')[0].replace(/[._\-+]/g, ' '))
          return !!target && (dn === target || local === target || (dn && target.includes(dn)) || target.split(' ').every(p => p && (dn.includes(p) || local.includes(p))))
        }) || (externals.length === 1 ? externals[0] : undefined)
        email = invitee?.email || ''
      }
      if (titleName) {
        push(hit.m.firstName, hit.m.lastName, email, hit.x.rule.offer_id, 'title')
      } else if (invitee) {
        const n = invitee.displayName ? splitDisplayName(invitee.displayName) : nameFromEmail(invitee.email || '')
        push(n.firstName, n.lastName, email, hit.x.rule.offer_id, 'invitee')
      }
      continue
    }

    if (settings.import_all_invitees) {
      for (const a of externals) {
        const n = a.displayName ? splitDisplayName(a.displayName) : nameFromEmail(a.email || '')
        push(n.firstName, n.lastName, a.email || '', null, 'invitee')
      }
    }
  }
  return out
}
