import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MetaData {
  title: string
  description: string
  ogTitle: string
  ogDescription: string
  ogImageUrl: string
  url: string
  imageAlt?: string
  /** fr_FR / en_US — swap la balise og:locale. */
  locale?: string
  /** Lien privé : on demande aux moteurs de ne pas l'indexer (les scrapers sociaux, eux, lisent quand même l'OG). */
  noindex?: boolean
}

function escapeAttr(s: string): string {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function priceFormat(price: number, currency: string): string {
  const v = (price / 100).toFixed(2).replace('.00', '')
  return currency === 'eur' ? `${v}€` : `${v} ${currency.toUpperCase()}`
}

async function buildBookingMeta(slug: string, baseUrl: string, ogImageUrl: string, lang: Lang): Promise<MetaData | null> {
  const { data: link } = await supabase
    .from('business_booking_links')
    .select('label, duration, business_owner_id, team_member_id, stripe_enabled, stripe_price, stripe_currency, description')
    .eq('slug', slug)
    .maybeSingle()
  if (!link) return null

  let creatorName = ''
  if (link.team_member_id) {
    const { data: tm } = await supabase
      .from('business_team_members')
      .select('first_name, last_name')
      .eq('id', link.team_member_id)
      .maybeSingle()
    if (tm) creatorName = `${tm.first_name || ''} ${tm.last_name || ''}`.trim()
  }
  if (!creatorName) {
    const { data: ow } = await supabase
      .from('business_users')
      .select('full_name')
      .eq('id', link.business_owner_id)
      .maybeSingle()
    if (ow) creatorName = ow.full_name || ''
  }

  const priceLabel = link.stripe_enabled && link.stripe_price > 0
    ? priceFormat(link.stripe_price, link.stripe_currency || 'eur')
    : null

  const title = creatorName
    ? (lang === 'en' ? `Book with ${creatorName}` : `Réserver avec ${creatorName}`)
    : (lang === 'en' ? 'Book a slot' : 'Réserver un créneau')
  const minLabel = lang === 'en' ? 'min' : 'min'
  const desc = `${link.label || (lang === 'en' ? 'Appointment' : 'Rendez-vous')}${link.duration ? ` — ${link.duration} ${minLabel}` : ''}${priceLabel ? ` — ${priceLabel}` : ''}`

  return {
    title: `${title} · CloseOS`,
    description: link.description || desc,
    ogTitle: title,
    ogDescription: desc,
    ogImageUrl,
    locale: lang === 'en' ? 'en_US' : 'fr_FR',
    url: `${baseUrl}/book/${slug}`,
  }
}

async function buildCaptureMeta(slug: string, baseUrl: string, ogImageUrl: string, lang: Lang): Promise<MetaData | null> {
  const { data: campaign } = await supabase
    .from('business_campaigns')
    .select('name, landing_title, landing_subtitle, user_id, description, stripe_enabled, stripe_price, stripe_currency, capture_type')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!campaign) return null

  const { data: settings } = await supabase
    .from('business_settings')
    .select('company_name')
    .eq('user_id', campaign.user_id)
    .maybeSingle()

  const priceLabel = campaign.stripe_enabled && campaign.stripe_price > 0
    ? priceFormat(campaign.stripe_price, campaign.stripe_currency || 'eur')
    : null

  const fallbackAction = campaign.capture_type === 'with_rdv'
    ? (lang === 'en' ? 'Booking' : 'Réservation')
    : (lang === 'en' ? 'Sign-up' : 'Inscription')
  const title = (campaign.landing_title || campaign.name || (lang === 'en' ? 'Sign up' : 'Inscription')).slice(0, 110)
  const subtitle = campaign.landing_subtitle || settings?.company_name || ''
  const desc = (campaign.description || subtitle || `${fallbackAction}${priceLabel ? ` — ${priceLabel}` : ''}`).slice(0, 200)

  return {
    title: `${title} · CloseOS`,
    description: desc,
    ogTitle: title,
    ogDescription: desc,
    ogImageUrl,
    locale: lang === 'en' ? 'en_US' : 'fr_FR',
    url: `${baseUrl}/capture/${slug}`,
  }
}

/**
 * Formulaires publics Business (/f/:slug).
 *
 * À l'inverse des liens à token, un formulaire est un actif de diffusion : son intitulé EST le
 * message, donc on le lit en base et on l'injecte. L'image est donc GÉNÉRÉE à la volée par api/og
 * (type=form) avec le nom peint en grand et la couleur d'accent choisie par l'owner.
 */
async function buildFormMeta(slug: string, baseUrl: string, ogImageUrl: string, lang: Lang): Promise<MetaData | null> {
  const { data: form } = await supabase
    .from('business_forms')
    .select('name, description, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (!form || !form.is_active) return null

  const title = (form.name || (lang === 'en' ? 'Form' : 'Formulaire')).slice(0, 110)
  const fallbackDesc = lang === 'en'
    ? 'A few questions, one minute. Your answers go straight to the team.'
    : "Quelques questions, une minute. Vos réponses partent directement à l'équipe."
  const desc = (form.description || fallbackDesc).slice(0, 200)

  return {
    title: `${title} · CloseOS`,
    description: desc,
    ogTitle: title,
    ogDescription: desc,
    ogImageUrl,
    imageAlt: lang === 'en' ? 'CloseOS Business — online form' : 'CloseOS Business — formulaire en ligne',
    locale: lang === 'en' ? 'en_US' : 'fr_FR',
    url: `${baseUrl}/f/${slug}`,
  }
}

/**
 * Page de réservation Sales (/c/:slug, table crm_campaigns).
 * Symétrique de buildCaptureMeta côté Business : c'est une page d'acquisition publique, donc son
 * intitulé est le message et on le lit en base. Si la campagne est inconnue ou inactive, on
 * retombe sur la carte statique « Réservez votre appel » plutôt que sur le visuel de l'écosystème.
 */
async function buildCrmCaptureMeta(slug: string, baseUrl: string, ogImageUrl: string, lang: Lang): Promise<MetaData> {
  const { data: campaign } = await supabase
    .from('crm_campaigns')
    .select('name, landing_title, landing_subtitle, description, user_id, stripe_enabled, stripe_price, stripe_currency, capture_type, is_active')
    .eq('slug', slug)
    .maybeSingle()

  if (!campaign || !campaign.is_active) {
    return buildStaticLinkMeta('capture-crm', baseUrl, slug, lang)
  }

  const { data: owner } = await supabase
    .from('crm_users')
    .select('full_name')
    .eq('id', campaign.user_id)
    .maybeSingle()

  const priceLabel = campaign.stripe_enabled && campaign.stripe_price > 0
    ? priceFormat(campaign.stripe_price, campaign.stripe_currency || 'eur')
    : null
  const rdv = campaign.capture_type === 'with_rdv'
  const fallbackTitle = lang === 'en' ? 'Book your call' : 'Réservez votre appel'
  const title = (campaign.landing_title || campaign.name || fallbackTitle).slice(0, 110)
  const withName = owner?.full_name
    ? (lang === 'en' ? `with ${owner.full_name}` : `avec ${owner.full_name}`)
    : ''
  const fallbackDesc = lang === 'en'
    ? `${rdv ? 'Pick your slot' : 'Sign up'} in seconds ${withName}.${priceLabel ? ` — ${priceLabel}` : ''}`
    : `${rdv ? 'Choisissez votre créneau' : 'Inscrivez-vous'} en quelques secondes ${withName}.${priceLabel ? ` — ${priceLabel}` : ''}`
  const desc = (campaign.description || campaign.landing_subtitle || fallbackDesc).slice(0, 200)

  return {
    title: `${title} · CloseOS`,
    description: desc,
    ogTitle: title,
    ogDescription: desc,
    ogImageUrl,
    imageAlt: lang === 'en' ? 'CloseOS — booking page' : 'CloseOS — page de réservation',
    locale: lang === 'en' ? 'en_US' : 'fr_FR',
    url: `${baseUrl}/c/${slug}`,
  }
}

/**
 * Liens privés porteurs d'un token : signature Sign, invitation d'équipe Sign, partage de
 * performances Sales.
 *
 * Volontairement STATIQUES — aucune lecture en base. Ces URLs circulent par mail, WhatsApp ou
 * Slack, où l'aperçu s'affiche pour toute la conversation : la carte ne doit révéler ni le nom
 * du client, ni l'objet du contrat, ni le moindre chiffre. Le token n'est jamais résolu ici,
 * donc rien à fuiter et aucune latence ajoutée.
 */
type StaticCopy = { ogTitle: string; ogDescription: string; imageAlt: string }
const STATIC_LINKS: Record<string, { suffix: string; image: string; path: (t: string) => string; fr: StaticCopy; en: StaticCopy }> = {
  'sign-doc': {
    suffix: 'CloseOS Sign', image: 'og-sign-doc', path: (t) => `/sign/s/${t}`,
    fr: { ogTitle: 'Un document vous attend', ogDescription: "Signature électronique sécurisée : vérification d'identité, horodatage et certificat de preuve remis à la fin.", imageAlt: 'CloseOS Sign — document en attente de signature' },
    en: { ogTitle: 'A document is waiting for you', ogDescription: 'Secure e-signature: identity verification, timestamping and a proof certificate at the end.', imageAlt: 'CloseOS Sign — document awaiting signature' },
  },
  'sign-invite': {
    suffix: 'CloseOS Sign', image: 'og-sign-invite', path: (t) => `/sign/join/${t}`,
    fr: { ogTitle: "Vous êtes invité à rejoindre l'équipe", ogDescription: "Créez votre accès CloseOS Sign : vos contrats prêts à l'emploi, vos liens de signature et le suivi de vos signatures.", imageAlt: "CloseOS Sign — invitation à rejoindre une équipe" },
    en: { ogTitle: "You're invited to join the team", ogDescription: 'Set up your CloseOS Sign access: ready-to-use contracts, your signing links and signature tracking.', imageAlt: 'CloseOS Sign — invitation to join a team' },
  },
  'share-perf': {
    suffix: 'CloseOS Sales', image: 'og-share', path: (t) => `/view/${t}`,
    fr: { ogTitle: 'Performances de closing, en direct', ogDescription: "Pipeline et KPIs à jour, partagés en lecture seule. Les chiffres s'affichent une fois le lien ouvert.", imageAlt: 'CloseOS Sales — partage de performances en lecture seule' },
    en: { ogTitle: 'Closing performance, live', ogDescription: 'Live pipeline and KPIs, shared read-only. The numbers appear once the link is opened.', imageAlt: 'CloseOS Sales — read-only performance sharing' },
  },
  'sign-verify': {
    suffix: 'CloseOS Sign', image: 'og-sign-doc', path: (t) => `/sign/verify/${t}`,
    fr: { ogTitle: 'Certificat de preuve vérifiable', ogDescription: "Vérifiez l'authenticité d'un contrat signé : signataires, horodatage, méthode de vérification et empreinte du document.", imageAlt: 'CloseOS Sign — vérification de certificat de preuve' },
    en: { ogTitle: 'Verifiable proof certificate', ogDescription: 'Verify the authenticity of a signed contract: signers, timestamp, verification method and document fingerprint.', imageAlt: 'CloseOS Sign — proof certificate verification' },
  },
  'appointment': {
    suffix: 'CloseOS', image: 'og-appointment', path: (t) => `/appointment/${t}`,
    fr: { ogTitle: 'Votre rendez-vous', ogDescription: 'Confirmez, reprogrammez ou annulez votre rendez-vous. Les détails et le lien de visio vous attendent.', imageAlt: 'CloseOS — gestion de rendez-vous' },
    en: { ogTitle: 'Your appointment', ogDescription: 'Confirm, reschedule or cancel your appointment. The details and video link are waiting for you.', imageAlt: 'CloseOS — appointment management' },
  },
  'appointment-reschedule': {
    suffix: 'CloseOS', image: 'og-appointment-reschedule', path: (t) => `/appointment/${t}?action=reschedule`,
    fr: { ogTitle: 'Reprogrammer votre rendez-vous', ogDescription: "Choisissez une nouvelle date en deux clics. L'ancien créneau se libère automatiquement et tout le monde est prévenu.", imageAlt: 'CloseOS — reprogrammation de rendez-vous' },
    en: { ogTitle: 'Reschedule your appointment', ogDescription: 'Pick a new date in two clicks. The old slot is freed automatically and everyone is notified.', imageAlt: 'CloseOS — appointment rescheduling' },
  },
  'appointment-cancel': {
    suffix: 'CloseOS', image: 'og-appointment-cancel', path: (t) => `/appointment/${t}?action=cancel`,
    fr: { ogTitle: 'Annuler votre rendez-vous', ogDescription: 'Un empêchement ? Libérez le créneau en un clic — et reprogrammez quand vous voulez, le lien reste valable.', imageAlt: "CloseOS — annulation de rendez-vous" },
    en: { ogTitle: 'Cancel your appointment', ogDescription: 'Something came up? Free the slot in one click — and rebook whenever you want, the link stays valid.', imageAlt: 'CloseOS — appointment cancellation' },
  },
  'capture-crm': {
    suffix: 'CloseOS', image: 'og-booking-call', path: (t) => `/c/${t}`,
    fr: { ogTitle: 'Réservez votre appel', ogDescription: 'Choisissez votre créneau en quelques secondes. Confirmation immédiate et rappel automatique.', imageAlt: 'CloseOS — page de réservation' },
    en: { ogTitle: 'Book your call', ogDescription: 'Pick your slot in seconds. Instant confirmation and automatic reminder.', imageAlt: 'CloseOS — booking page' },
  },
}

function buildStaticLinkMeta(kind: keyof typeof STATIC_LINKS, baseUrl: string, token: string, lang: Lang): MetaData {
  const c = STATIC_LINKS[kind]
  const l = c[lang]
  return {
    title: `${l.ogTitle} · ${c.suffix}`,
    description: l.ogDescription,
    ogTitle: l.ogTitle,
    ogDescription: l.ogDescription,
    ogImageUrl: `${baseUrl}/${c.image}.jpg`,
    imageAlt: l.imageAlt,
    locale: lang === 'en' ? 'en_US' : 'fr_FR',
    url: `${baseUrl}${c.path(token)}`,
    noindex: true,
  }
}

/**
 * Pages marketing publiques (/, /sales, /business, /sign, /tarifs, /fonctionnalites, /comparatifs/*).
 * Bilingues (fr/en via ?lang= ou Accept-Language).
 *
 * ⚠️ DORMANT — aucun rewrite ne pointe plus ici. Sur Vercel « precedence is given to the filesystem
 * prior to rewrites being applied » : ces routes ont toutes un fichier généré par
 * scripts/prerender.mjs, qui gagne toujours. Le prerender est volontairement conservé — il donne aux
 * moteurs le contenu réel de la page, là où cette fonction ne servirait que la coquille.
 * Ce bloc reste en place comme base du chantier « URLs /en/… » : le jour où les pages anglaises
 * auront leur propre chemin (donc aucun fichier prérendu en face), il suffira de rebrancher un
 * rewrite. En attendant, chaque page pose son og:image en JS vers /api/og?type=page&slug=… — une
 * URL d'image traverse le prerender sans problème, contrairement à l'injection de métas.
 */
type Lang = 'fr' | 'en'
type PageCopy = { title: string; desc: string; alt: string }
type PageEntry = { path: string; ogKey: string; staticFr?: string; fr: PageCopy; en: PageCopy }

const PAGES: Record<string, PageEntry> = {
  eco: {
    path: '/', ogKey: 'eco', staticFr: 'og-eco',
    fr: { title: "CloseOS — l'écosystème de la vente digitale", desc: 'Sales pour les closers, Business pour les équipes, Sign pour signer et encaisser. Un seul écosystème.', alt: 'CloseOS — écosystème Sales, Business et Sign' },
    en: { title: 'CloseOS — the digital sales ecosystem', desc: 'Sales for closers, Business for teams, Sign to sign and get paid. One ecosystem.', alt: 'CloseOS — Sales, Business and Sign ecosystem' },
  },
  sales: {
    path: '/sales', ogKey: 'sales', staticFr: 'og-sales',
    fr: { title: 'CloseOS Sales — le cockpit du closer indépendant', desc: 'CRM, pipeline, Call Room, relances automatiques, booking et facturation. Le tout-en-un des closers.', alt: 'CloseOS Sales' },
    en: { title: "CloseOS Sales — the independent closer's cockpit", desc: 'CRM, pipeline, Call Room, automatic follow-ups, booking and invoicing. The all-in-one for closers.', alt: 'CloseOS Sales' },
  },
  business: {
    path: '/business', ogKey: 'business', staticFr: 'og-business',
    fr: { title: 'CloseOS Business — pilotez votre équipe de closing', desc: "Management d'équipe, acquisition, KPIs, commissions et CloseOS Sign inclus. L'alternative française à iClosed.", alt: 'CloseOS Business' },
    en: { title: 'CloseOS Business — run your closing team', desc: 'Team management, acquisition, KPIs, commissions and CloseOS Sign included. The French alternative to iClosed.', alt: 'CloseOS Business' },
  },
  sign: {
    path: '/sign', ogKey: 'sign', staticFr: 'og-sign',
    fr: { title: 'CloseOS Sign — signez le contrat, encaissez le paiement', desc: "Signature électronique avec paiement intégré, multi-signataire, vérification d'identité et certificat de preuve.", alt: 'CloseOS Sign' },
    en: { title: 'CloseOS Sign — sign the contract, collect the payment', desc: 'E-signature with built-in payment, multi-signer, identity verification and proof certificate.', alt: 'CloseOS Sign' },
  },
  tarifs: {
    path: '/tarifs', ogKey: 'tarifs',
    fr: { title: 'CloseOS — Tarifs : des offres claires, sans surprise', desc: 'Des offres claires pour les closers et les équipes. Essai gratuit, sans engagement.', alt: 'CloseOS — Tarifs' },
    en: { title: 'CloseOS — Pricing: clear plans, no surprises', desc: 'Clear plans for closers and teams. Free trial, no commitment.', alt: 'CloseOS — Pricing' },
  },
  fonctionnalites: {
    path: '/fonctionnalites', ogKey: 'fonctionnalites',
    fr: { title: 'CloseOS — Fonctionnalités : tout, réuni en un seul écosystème', desc: "Tout ce qu'un closer et une équipe de vente attendent, réuni en un seul écosystème.", alt: 'CloseOS — Fonctionnalités' },
    en: { title: 'CloseOS — Features: everything, in one ecosystem', desc: 'Everything a closer and a sales team need, in one ecosystem.', alt: 'CloseOS — Features' },
  },
  comparatif: {
    path: '/comparatifs/closeos-vs-iclosed', ogKey: 'comparatif',
    fr: { title: "CloseOS vs iClosed — l'alternative française", desc: "CRM, acquisition, management d'équipe et synchronisation bidirectionnelle avec iClosed. 100% RGPD, hébergé en UE.", alt: 'CloseOS vs iClosed' },
    en: { title: 'CloseOS vs iClosed — the French alternative', desc: 'CRM, acquisition, team management and two-way sync with iClosed. 100% GDPR, EU-hosted.', alt: 'CloseOS vs iClosed' },
  },
}

function buildPageMeta(slug: string, lang: Lang, baseUrl: string): MetaData | null {
  const entry = PAGES[slug]
  if (!entry) return null
  const c = entry[lang]
  const ogImageUrl = entry.staticFr && lang === 'fr'
    ? `${baseUrl}/${entry.staticFr}.jpg`
    : `${baseUrl}/api/og?type=page&slug=${entry.ogKey}&lang=${lang}`
  const url = `${baseUrl}${entry.path}${lang === 'en' ? '?lang=en' : ''}`
  return {
    title: c.title,
    description: c.desc,
    ogTitle: c.title,
    ogDescription: c.desc,
    ogImageUrl,
    imageAlt: c.alt,
    locale: lang === 'en' ? 'en_US' : 'fr_FR',
    url,
  }
}

let cachedShell: string | null = null
let cachedShellTs = 0
async function fetchIndexShell(baseUrl: string): Promise<string> {
  const now = Date.now()
  if (cachedShell && now - cachedShellTs < 5 * 60 * 1000) return cachedShell
  // Fetch the deployed index.html from the root path. The query param avoids any rewrite loops
  // (seuls /book/*, /capture/*, /sign/s/*, /sign/join/* et /view/* matchent les rewrites — pas "/").
  const r = await fetch(`${baseUrl}/?_=shell`, { headers: { 'User-Agent': 'CloseOS-SocialMeta/1.0' } })
  const text = await r.text()
  cachedShell = text
  cachedShellTs = now
  return text
}

function injectMeta(html: string, meta: MetaData): string {
  const T = (s: string) => escapeAttr(s)
  // Replace title
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${T(meta.title)}</title>`)
  // Replace canonical
  out = out.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${T(meta.url)}" id="canonical" />`)
  // Replace description meta
  out = out.replace(/<meta name="description"[\s\S]*?>/, `<meta name="description" content="${T(meta.description)}">`)
  // Replace OG meta tags by id
  out = out.replace(/<meta property="og:url"[^>]*id="og-url"[^>]*>/, `<meta property="og:url" content="${T(meta.url)}" id="og-url">`)
  out = out.replace(/<meta property="og:title"[^>]*id="og-title"[^>]*>/, `<meta property="og:title" content="${T(meta.ogTitle)}" id="og-title">`)
  out = out.replace(/<meta property="og:description"[\s\S]*?id="og-description"[^>]*>/, `<meta property="og:description" content="${T(meta.ogDescription)}" id="og-description">`)
  out = out.replace(/<meta property="og:image"[^>]*id="og-image"[^>]*>/, `<meta property="og:image" content="${T(meta.ogImageUrl)}" id="og-image">`)
  // Les images générées par api/og sont en PNG ; les visuels statiques en JPEG.
  const imgType = meta.ogImageUrl.includes('/api/og') ? 'image/png' : 'image/jpeg'
  out = out.replace(/<meta property="og:image:type"[^>]*id="og-image-type"[^>]*>/, `<meta property="og:image:type" content="${imgType}" id="og-image-type">`)
  if (meta.imageAlt) {
    out = out.replace(/<meta property="og:image:alt"[^>]*id="og-image-alt"[^>]*>/, `<meta property="og:image:alt" content="${T(meta.imageAlt)}" id="og-image-alt">`)
  }
  if (meta.locale) {
    out = out.replace(/<meta property="og:locale"[^>]*id="og-locale"[^>]*>/, `<meta property="og:locale" content="${T(meta.locale)}" id="og-locale">`)
  }
  if (meta.noindex) {
    out = out.replace(/<title>/, '<meta name="robots" content="noindex, nofollow">\n  <title>')
  }
  // Twitter (balises en name= — conforme à la spec, lues par Slack/Notion et les agrégateurs stricts)
  out = out.replace(/<meta name="twitter:url"[^>]*id="tw-url"[^>]*>/, `<meta name="twitter:url" content="${T(meta.url)}" id="tw-url">`)
  out = out.replace(/<meta name="twitter:title"[^>]*id="tw-title"[^>]*>/, `<meta name="twitter:title" content="${T(meta.ogTitle)}" id="tw-title">`)
  out = out.replace(/<meta name="twitter:description"[\s\S]*?id="tw-description"[^>]*>/, `<meta name="twitter:description" content="${T(meta.ogDescription)}" id="tw-description">`)
  out = out.replace(/<meta name="twitter:image"[^>]*id="tw-image"[^>]*>/, `<meta name="twitter:image" content="${T(meta.ogImageUrl)}" id="tw-image">`)
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const type = req.query.type as string
    const slug = req.query.slug as string

    const KNOWN = ['booking', 'capture', 'form', 'sign-doc', 'sign-invite', 'share-perf', 'page', 'sign-verify', 'appointment', 'appointment-reschedule', 'appointment-cancel', 'capture-crm']
    if (!type || !slug || !KNOWN.includes(type)) {
      res.status(400).send('Missing or invalid type/slug')
      return
    }

    const host = req.headers.host || 'www.closeos.fr'
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    const baseUrl = `${proto}://${host}`

    // Langue : ?lang= explicite prioritaire, sinon Accept-Language en repli souple.
    const langParam = (req.query.lang as string) || ''
    const acceptEn = /^en/i.test((req.headers['accept-language'] as string) || '')
    const lang: Lang = langParam === 'en' ? 'en' : langParam === 'fr' ? 'fr' : (acceptEn ? 'en' : 'fr')

    const ogImageUrl = `${baseUrl}/api/og?type=${type}&slug=${encodeURIComponent(slug)}&lang=${lang}`

    const meta = type === 'page'
      ? buildPageMeta(slug, lang, baseUrl)
      : type === 'booking'
        ? await buildBookingMeta(slug, baseUrl, ogImageUrl, lang)
        : type === 'capture'
          ? await buildCaptureMeta(slug, baseUrl, ogImageUrl, lang)
          : type === 'form'
            ? await buildFormMeta(slug, baseUrl, ogImageUrl, lang)
            : type === 'capture-crm'
              ? await buildCrmCaptureMeta(slug, baseUrl, ogImageUrl, lang)
            : buildStaticLinkMeta(type as keyof typeof STATIC_LINKS, baseUrl, slug, lang)

    const shell = await fetchIndexShell(baseUrl)

    if (!meta) {
      // Slug not found: serve the original shell (the SPA will show its own "not found" screen)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')
      res.status(200).send(shell)
      return
    }

    const html = injectMeta(shell, meta)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
    res.status(200).send(html)
  } catch (err: any) {
    console.error('[social-meta] error:', err?.message)
    res.status(500).send('Failed to render social meta')
  }
}
