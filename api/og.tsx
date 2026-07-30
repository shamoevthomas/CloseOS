import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRIMARY_DARK = '#1b1c1b'
const PRIMARY_BG = '#fbf9f8'
const ACCENT = '#006c49'
const PURPLE = '#635bff'
const MUTED = '#444748'
const SOFT = '#eae8e7'
/** Violet Business — accent de la maquette formulaire validée. */
const FORM_ACCENT = '#635BFF'

interface OGData {
  title: string
  subtitle: string
  avatarUrl: string | null
  fallbackInitials: string
  priceLabel: string | null
  duration: number | null
  hostUrl: string
  ctaLabel: string
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function priceFormat(price: number, currency: string): string {
  const v = (price / 100).toFixed(2).replace('.00', '')
  return currency === 'eur' ? `${v}€` : `${v} ${currency.toUpperCase()}`
}

async function loadBookingData(slug: string, lang: 'fr' | 'en'): Promise<OGData | null> {
  const { data: link } = await supabase
    .from('business_booking_links')
    .select('label, duration, business_owner_id, team_member_id, stripe_enabled, stripe_price, stripe_currency')
    .eq('slug', slug)
    .maybeSingle()
  if (!link) return null

  let avatarUrl: string | null = null
  let creatorName = ''
  if (link.team_member_id) {
    const { data: tm } = await supabase
      .from('business_team_members')
      .select('first_name, last_name, avatar_url')
      .eq('id', link.team_member_id)
      .maybeSingle()
    if (tm) {
      avatarUrl = tm.avatar_url || null
      creatorName = `${tm.first_name || ''} ${tm.last_name || ''}`.trim()
    }
  }
  if (!creatorName) {
    const { data: ow } = await supabase
      .from('business_users')
      .select('full_name, avatar_url')
      .eq('id', link.business_owner_id)
      .maybeSingle()
    if (ow) {
      avatarUrl = avatarUrl || ow.avatar_url || null
      creatorName = ow.full_name || ''
    }
  }

  const priceLabel = link.stripe_enabled && link.stripe_price > 0
    ? priceFormat(link.stripe_price, link.stripe_currency || 'eur')
    : null

  const initials = creatorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() || '')
    .join('') || 'CO'

  return {
    title: creatorName
      ? (lang === 'en' ? `Book with ${creatorName}` : `Réserver avec ${creatorName}`)
      : (lang === 'en' ? 'Book a slot' : 'Réserver un créneau'),
    subtitle: link.label || (lang === 'en' ? 'Appointment' : 'Rendez-vous'),
    avatarUrl,
    fallbackInitials: initials,
    priceLabel,
    duration: link.duration || null,
    hostUrl: 'closeos.fr',
    ctaLabel: priceLabel ? (lang === 'en' ? 'Pay & book' : 'Payer & réserver') : (lang === 'en' ? 'Book' : 'Réserver'),
  }
}

async function loadCaptureData(slug: string, lang: 'fr' | 'en'): Promise<OGData | null> {
  const { data: campaign } = await supabase
    .from('business_campaigns')
    .select('name, landing_title, landing_subtitle, user_id, stripe_enabled, stripe_price, stripe_currency, capture_type')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!campaign) return null

  // Logo entreprise
  const { data: settings } = await supabase
    .from('business_settings')
    .select('company_name, logo_url')
    .eq('user_id', campaign.user_id)
    .maybeSingle()

  const priceLabel = campaign.stripe_enabled && campaign.stripe_price > 0
    ? priceFormat(campaign.stripe_price, campaign.stripe_currency || 'eur')
    : null

  const title = (campaign.landing_title || campaign.name || (lang === 'en' ? 'Sign up' : 'Inscription')).slice(0, 90)
  const subtitle = (campaign.landing_subtitle || settings?.company_name || '').slice(0, 90)
  const companyName = settings?.company_name || ''
  const initials = (companyName || title)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() || '')
    .join('') || 'CO'

  const rdv = campaign.capture_type === 'with_rdv'
  const ctaLabel = priceLabel
    ? (lang === 'en' ? `Pay & ${rdv ? 'book' : 'sign up'}` : `Payer & ${rdv ? 'réserver' : 's\'inscrire'}`)
    : (lang === 'en' ? (rdv ? 'Book' : 'Sign up') : (rdv ? 'Réserver' : 'S\'inscrire'))

  return {
    title,
    subtitle,
    avatarUrl: settings?.logo_url || null,
    fallbackInitials: initials,
    priceLabel,
    duration: null,
    hostUrl: 'closeos.fr',
    ctaLabel,
  }
}

/**
 * Page de réservation Sales (/c/:slug, table crm_campaigns).
 * Symétrique de loadCaptureData côté Business : le prospect voit le titre de la campagne,
 * la photo du closer et le prix — pas une carte générique.
 */
async function loadCrmCaptureData(slug: string, lang: 'fr' | 'en'): Promise<OGData | null> {
  const { data: campaign } = await supabase
    .from('crm_campaigns')
    .select('name, landing_title, landing_subtitle, user_id, formula_id, stripe_enabled, stripe_price, stripe_currency, capture_type, booking_duration_minutes, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (!campaign || !campaign.is_active) return null

  const { data: owner } = await supabase
    .from('crm_users')
    .select('full_name, avatar_url')
    .eq('id', campaign.user_id)
    .maybeSingle()

  // Prix : Stripe d'abord, sinon celui de la formule rattachée.
  let priceLabel: string | null = campaign.stripe_enabled && campaign.stripe_price > 0
    ? priceFormat(campaign.stripe_price, campaign.stripe_currency || 'eur')
    : null
  if (!priceLabel && campaign.formula_id) {
    const { data: f } = await supabase
      .from('crm_formulas')
      .select('price')
      .eq('id', campaign.formula_id)
      .maybeSingle()
    if (f?.price > 0) priceLabel = priceFormat(f.price * 100, 'eur')
  }

  const rdv = campaign.capture_type === 'with_rdv'
  const ownerName = owner?.full_name || ''
  const title = (campaign.landing_title || campaign.name || (lang === 'en' ? 'Book your call' : 'Réservez votre appel')).slice(0, 90)
  const subtitle = (campaign.landing_subtitle || ownerName || '').slice(0, 90)
  const initials = (ownerName || title)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() || '')
    .join('') || 'CO'

  return {
    title,
    subtitle,
    avatarUrl: owner?.avatar_url || null,
    fallbackInitials: initials,
    priceLabel,
    duration: rdv ? (campaign.booking_duration_minutes || null) : null,
    hostUrl: 'closeos.fr',
    ctaLabel: priceLabel
      ? (lang === 'en' ? `Pay & ${rdv ? 'book' : 'sign up'}` : `Payer & ${rdv ? 'réserver' : "s'inscrire"}`)
      : (lang === 'en' ? (rdv ? 'Book' : 'Sign up') : (rdv ? 'Réserver' : "S'inscrire")),
  }
}

/**
 * Formulaire public : le nom du formulaire EST l'accroche, on le peint donc en grand.
 * La DA reprend la maquette validée : fond chaud, violet Business, mockup de formulaire.
 */
async function loadFormData(slug: string, lang: 'fr' | 'en'): Promise<OGData | null> {
  const { data: form } = await supabase
    .from('business_forms')
    .select('name, description, user_id, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (!form || !form.is_active) return null

  const { data: settings } = await supabase
    .from('business_settings')
    .select('company_name')
    .eq('user_id', form.user_id)
    .maybeSingle()

  // La maquette formulaire n'affiche que le titre et le sous-titre : le reste de OGData
  // n'est pas peint pour ce type.
  return {
    title: (form.name || (lang === 'en' ? 'Form' : 'Formulaire')).slice(0, 90),
    subtitle: (form.description || settings?.company_name || '').slice(0, 90),
    avatarUrl: null,
    fallbackInitials: 'CO',
    priceLabel: null,
    duration: null,
    hostUrl: 'closeos.fr',
    ctaLabel: lang === 'en' ? 'Answer' : 'Répondre',
  }
}

/* ─────────────────────────────────────────────────────────────
   Cartes OG des pages marketing (générées à la volée, FR + EN).
   But : donner à chaque page produit / tarifs / comparatif un visuel dédié
   ET une version anglaise, sans dépendre d'un fichier image statique par langue.
   ───────────────────────────────────────────────────────────── */
type PageCard = {
  accent: string
  dark?: boolean
  label: { fr: string; en: string }
  title: { fr: string; en: string }
  subtitle: { fr: string; en: string }
}

const PAGE_CARDS: Record<string, PageCard> = {
  eco: {
    accent: ACCENT, dark: true,
    label: { fr: 'Écosystème', en: 'Ecosystem' },
    title: { fr: "L'écosystème de la vente digitale", en: 'The digital sales ecosystem' },
    subtitle: { fr: 'Sales pour les closers, Business pour les équipes, Sign pour signer et encaisser.', en: 'Sales for closers, Business for teams, Sign to sign and get paid.' },
  },
  sales: {
    accent: '#0ea5e9',
    label: { fr: 'Sales', en: 'Sales' },
    title: { fr: 'Le cockpit du closer indépendant', en: "The independent closer's cockpit" },
    subtitle: { fr: 'CRM, pipeline, Call Room, relances automatiques, booking et facturation.', en: 'CRM, pipeline, Call Room, automatic follow-ups, booking and invoicing.' },
  },
  business: {
    accent: '#006c49',
    label: { fr: 'Business', en: 'Business' },
    title: { fr: 'Pilotez votre équipe de closing', en: 'Run your closing team' },
    subtitle: { fr: "Management d'équipe, acquisition, KPIs, commissions et CloseOS Sign inclus.", en: 'Team management, acquisition, KPIs, commissions and CloseOS Sign included.' },
  },
  sign: {
    accent: '#CEFF8F', dark: true,
    label: { fr: 'Sign', en: 'Sign' },
    title: { fr: 'Signez le contrat, encaissez le paiement', en: 'Sign the contract, collect the payment' },
    subtitle: { fr: "Signature électronique avec paiement intégré, multi-signataire et certificat de preuve.", en: 'E-signature with built-in payment, multi-signer and proof certificate.' },
  },
  tarifs: {
    accent: '#006c49',
    label: { fr: 'Tarifs', en: 'Pricing' },
    title: { fr: 'Des offres claires, sans surprise', en: 'Clear plans, no surprises' },
    subtitle: { fr: 'Pour les closers et les équipes. Essai gratuit, sans engagement.', en: 'For closers and teams. Free trial, no commitment.' },
  },
  fonctionnalites: {
    accent: '#635bff',
    label: { fr: 'Fonctionnalités', en: 'Features' },
    title: { fr: 'Tout, réuni en un seul écosystème', en: 'Everything, in one ecosystem' },
    subtitle: { fr: "Tout ce qu'un closer et une équipe de vente attendent d'un outil.", en: 'Everything a closer and a sales team expect from a tool.' },
  },
  'crm-closer': {
    accent: '#0ea5e9',
    label: { fr: 'CRM Closer', en: 'Closer CRM' },
    title: { fr: 'Le pipeline de vente des closers', en: "The closers' sales pipeline" },
    subtitle: { fr: "Pipeline visuel, suivi des prospects, historique d'appels et KPIs de closing.", en: 'Visual pipeline, prospect tracking, call history and closing KPIs.' },
  },
  comparatif: {
    accent: '#006c49',
    label: { fr: 'Comparatif', en: 'Comparison' },
    title: { fr: 'CloseOS vs iClosed', en: 'CloseOS vs iClosed' },
    subtitle: { fr: "L'alternative française : CRM, acquisition, management d'équipe, sync bidirectionnelle. 100% RGPD.", en: 'The French alternative: CRM, acquisition, team management, two-way sync. 100% GDPR.' },
  },
}

function renderPageCard(slug: string, lang: 'fr' | 'en'): ImageResponse {
  const card = PAGE_CARDS[slug] || PAGE_CARDS.eco
  const dark = !!card.dark
  const bg = dark ? '#141a1a' : PRIMARY_BG
  const ink = dark ? '#ffffff' : PRIMARY_DARK
  const muted = dark ? '#9aa3a3' : MUTED
  const accent = card.accent
  const label = card.label[lang]
  const title = card.title[lang]
  const subtitle = card.subtitle[lang]
  const titleSize = title.length > 34 ? 66 : 82
  // Pastille : texte foncé seulement sur le lime clair, blanc partout ailleurs.
  const pillText = card.accent === '#CEFF8F' ? '#141a1a' : '#ffffff'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: bg, padding: '64px 72px', position: 'relative',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ position: 'absolute', top: -120, right: -120, width: 420, height: 420, borderRadius: '50%', background: `${accent}22`, display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -160, left: -90, width: 340, height: 340, borderRadius: '50%', background: `${accent}14`, display: 'flex' }} />

        {/* Top: wordmark + product pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1 }}>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, color: ink }}>
            close<span style={{ color: accent }}>OS</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', background: accent, color: pillText, padding: '8px 16px', borderRadius: 999, fontSize: 15, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {label}
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, zIndex: 1 }}>
          <h1 style={{ fontSize: titleSize, lineHeight: 1.04, fontWeight: 800, color: ink, margin: 0, letterSpacing: -1.8, maxWidth: 1000 }}>
            {title}
          </h1>
          <p style={{ fontSize: 30, color: muted, margin: 0, fontWeight: 500, maxWidth: 1000, lineHeight: 1.3 }}>
            {subtitle}
          </p>
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
          <span style={{ fontSize: 20, color: muted, fontWeight: 600 }}>closeos.fr</span>
          <div style={{ display: 'flex', height: 8, gap: 8 }}>
            {['#0ea5e9', '#006c49', '#CEFF8F'].map((c) => (
              <div key={c} style={{ display: 'flex', width: 40, height: 8, borderRadius: 4, background: c }} />
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800' } }
  )
}

export default async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const slug = searchParams.get('slug')
    const lang: 'fr' | 'en' = searchParams.get('lang') === 'en' ? 'en' : 'fr'

    if (type === 'page' && slug) {
      return renderPageCard(slug, lang)
    }

    if (!type || !slug || (type !== 'booking' && type !== 'capture' && type !== 'capture-crm' && type !== 'form')) {
      return new Response('Missing or invalid type/slug', { status: 400 })
    }

    const data = type === 'booking'
      ? await loadBookingData(slug, lang)
      : type === 'capture'
        ? await loadCaptureData(slug, lang)
        : type === 'capture-crm'
          ? await loadCrmCaptureData(slug, lang)
          : await loadFormData(slug, lang)

    if (!data) return new Response('Not found', { status: 404 })

    const titleClipped = data.title.length > 70 ? data.title.slice(0, 67) + '…' : data.title
    const subtitleClipped = data.subtitle.length > 80 ? data.subtitle.slice(0, 77) + '…' : data.subtitle

    /* ── Formulaires : maquette dédiée (fond chaud + violet Business + mockup),
          avec le nom du formulaire en accroche à la place du texte générique. ── */
    if (type === 'form') {
      const t = data.title.length > 60 ? data.title.slice(0, 57) + '…' : data.title
      const titleSize = t.length <= 22 ? 52 : t.length <= 44 ? 42 : 34
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              backgroundImage: 'linear-gradient(158deg, #FDFBF9 0%, #F4F2F1 50%, #EFE9E2 100%)',
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            }}
          >
            {/* Colonne gauche */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '58px 36px 58px 60px',
              }}
            >
              <img
                src="https://www.closeos.fr/closeos-business-logo-ecrit.png"
                width={190}
                height={51}
                style={{ objectFit: 'contain' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: FORM_ACCENT, fontSize: 15, fontWeight: 800, letterSpacing: 1.6 }}>
                  {lang === 'en' ? 'FORM' : 'FORMULAIRE'}
                </span>
                <span
                  style={{
                    fontSize: titleSize,
                    lineHeight: 1.12,
                    fontWeight: 800,
                    color: '#111111',
                    letterSpacing: -1.2,
                    marginTop: 12,
                    maxWidth: 470,
                  }}
                >
                  {t}
                </span>
                {subtitleClipped && (
                  <span
                    style={{
                      fontSize: 19,
                      color: '#6B6B6B',
                      fontWeight: 500,
                      marginTop: 12,
                      maxWidth: 430,
                      lineHeight: 1.4,
                    }}
                  >
                    {subtitleClipped}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 9 }}>
                {(lang === 'en' ? ['No sign-up', 'Mobile too'] : ['Sans inscription', 'Sur mobile aussi']).map(p => (
                  <div
                    key={p}
                    style={{
                      display: 'flex',
                      background: 'white',
                      border: '1px solid #E4E0DC',
                      borderRadius: 999,
                      padding: '9px 16px',
                      color: '#3A3A3A',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
            </div>

            {/* Colonne droite : mockup du formulaire */}
            <div style={{ width: 560, display: 'flex', alignItems: 'center', padding: '52px 60px 52px 0' }}>
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'white',
                  border: '1px solid #E6E2DE',
                  borderRadius: 22,
                  padding: '26px 28px',
                  boxShadow: '0 22px 50px rgba(17,17,17,0.10)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flex: 1, height: 7, borderRadius: 4, background: '#EDEAE6' }}>
                    <div style={{ display: 'flex', width: '40%', height: 7, borderRadius: 4, background: FORM_ACCENT }} />
                  </div>
                  <span style={{ color: '#8A8A8A', fontSize: 13, fontWeight: 800 }}>2 / 5</span>
                </div>

                <span style={{ color: '#111111', fontSize: 25, fontWeight: 800, letterSpacing: -0.7, marginTop: 20 }}>
                  {lang === 'en' ? 'What is your main goal?' : 'Quel est votre objectif principal ?'}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  {(lang === 'en'
                    ? [
                        { label: 'Find more clients', on: false },
                        { label: 'Structure my sales team', on: true },
                        { label: 'Automate my follow-up', on: false },
                      ]
                    : [
                        { label: 'Trouver plus de clients', on: false },
                        { label: 'Structurer mon équipe de vente', on: true },
                        { label: 'Automatiser mon suivi', on: false },
                      ]
                  ).map(o => (
                    <div
                      key={o.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        border: `1.5px solid ${o.on ? FORM_ACCENT : '#E6E2DE'}`,
                        background: o.on ? '#F5F3FE' : 'white',
                        borderRadius: 13,
                        padding: '13px 16px',
                        color: o.on ? '#111111' : '#3A3A3A',
                        fontSize: 17,
                        fontWeight: o.on ? 700 : 600,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          border: `2px solid ${o.on ? FORM_ACCENT : '#D5D0CA'}`,
                          background: o.on ? FORM_ACCENT : 'white',
                          boxShadow: o.on ? 'inset 0 0 0 3px white' : 'none',
                        }}
                      />
                      {o.label}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
                  <span style={{ color: '#9A9691', fontSize: 13, fontWeight: 600 }}>{lang === 'en' ? 'Enter ↵ to submit' : 'Entrée ↵ pour valider'}</span>
                  <div
                    style={{
                      display: 'flex',
                      background: FORM_ACCENT,
                      color: 'white',
                      fontSize: 16,
                      fontWeight: 800,
                      padding: '12px 24px',
                      borderRadius: 11,
                    }}
                  >
                    {lang === 'en' ? 'Next →' : 'Suivant →'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
          },
        }
      )
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: PRIMARY_BG,
            padding: '64px 72px',
            position: 'relative',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          }}
        >
          {/* Decorative bg shapes */}
          <div
            style={{
              position: 'absolute',
              top: -120,
              right: -120,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: type === 'booking' ? `${PURPLE}11` : `${ACCENT}11`,
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -160,
              left: -80,
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: type === 'booking' ? `${ACCENT}0d` : `${PURPLE}0d`,
              display: 'flex',
            }}
          />

          {/* Top bar: brand + type */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* /c/:slug est une page Sales : on n'y affiche pas le lockup Business, juste le monogramme. */}
              <img
                src={type === 'capture-crm'
                  ? 'https://www.closeos.fr/closeos-business-logo.png'
                  : 'https://www.closeos.fr/closeos-business-logo-ecrit.png'}
                width={type === 'capture-crm' ? 94 : 240}
                height={60}
                style={{ objectFit: 'contain' }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: SOFT,
                  color: MUTED,
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                {type === 'booking'
                  ? (lang === 'en' ? 'Booking link' : 'Lien de réservation')
                  : (lang === 'en' ? 'Sign-up' : 'Inscription')}
              </div>
            </div>
            {data.priceLabel && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: PRIMARY_DARK,
                  color: 'white',
                  padding: '14px 22px',
                  borderRadius: 999,
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: -0.5,
                }}
              >
                {data.priceLabel}
              </div>
            )}
          </div>

          {/* Main content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 22,
              zIndex: 1,
              marginTop: 20,
            }}
          >
            <h1
              style={{
                fontSize: titleClipped.length > 40 ? 64 : 78,
                lineHeight: 1.05,
                fontWeight: 800,
                color: PRIMARY_DARK,
                margin: 0,
                letterSpacing: -1.5,
                maxWidth: 980,
              }}
            >
              {titleClipped}
            </h1>
            {subtitleClipped && (
              <p
                style={{
                  fontSize: 30,
                  color: MUTED,
                  margin: 0,
                  fontWeight: 500,
                  maxWidth: 980,
                  lineHeight: 1.3,
                }}
              >
                {subtitleClipped}
              </p>
            )}
          </div>

          {/* Bottom bar: avatar + cta */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  width={72}
                  height={72}
                  style={{
                    borderRadius: type === 'booking' || type === 'capture-crm' ? '50%' : 16,
                    objectFit: 'cover',
                    border: `3px solid white`,
                    boxShadow: `0 0 0 3px ${SOFT}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: type === 'booking' || type === 'capture-crm' ? '50%' : 16,
                    background: type === 'booking' ? PURPLE : ACCENT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: 28,
                    letterSpacing: -0.5,
                    border: `3px solid white`,
                    boxShadow: `0 0 0 3px ${SOFT}`,
                  }}
                >
                  {data.fallbackInitials}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.duration && (
                  <span style={{ fontSize: 18, color: MUTED, fontWeight: 700 }}>{data.duration} min</span>
                )}
                <span style={{ fontSize: 18, color: MUTED, fontWeight: 600 }}>{data.hostUrl}</span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: PRIMARY_DARK,
                color: 'white',
                padding: '18px 30px',
                borderRadius: 999,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: -0.4,
              }}
            >
              {data.ctaLabel}
              <span style={{ fontSize: 22, marginLeft: 4 }}>→</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (err: any) {
    console.error('[og] error:', err?.message)
    return new Response('OG generation failed', { status: 500 })
  }
}

// Suppress unused-import warning for type-only checking
void escapeHtml
