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

async function loadBookingData(slug: string): Promise<OGData | null> {
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
    title: creatorName ? `Réserver avec ${creatorName}` : 'Réserver un créneau',
    subtitle: link.label || 'Rendez-vous',
    avatarUrl,
    fallbackInitials: initials,
    priceLabel,
    duration: link.duration || null,
    hostUrl: 'closeos.fr',
    ctaLabel: priceLabel ? `Payer & réserver` : 'Réserver',
  }
}

async function loadCaptureData(slug: string): Promise<OGData | null> {
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

  const title = (campaign.landing_title || campaign.name || 'Inscription').slice(0, 90)
  const subtitle = (campaign.landing_subtitle || settings?.company_name || '').slice(0, 90)
  const companyName = settings?.company_name || ''
  const initials = (companyName || title)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() || '')
    .join('') || 'CO'

  return {
    title,
    subtitle,
    avatarUrl: settings?.logo_url || null,
    fallbackInitials: initials,
    priceLabel,
    duration: null,
    hostUrl: 'closeos.fr',
    ctaLabel: priceLabel
      ? `Payer & ${campaign.capture_type === 'with_rdv' ? 'réserver' : 's\'inscrire'}`
      : (campaign.capture_type === 'with_rdv' ? 'Réserver' : 'S\'inscrire'),
  }
}

export default async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const slug = searchParams.get('slug')

    if (!type || !slug || (type !== 'booking' && type !== 'capture')) {
      return new Response('Missing or invalid type/slug', { status: 400 })
    }

    const data = type === 'booking'
      ? await loadBookingData(slug)
      : await loadCaptureData(slug)

    if (!data) return new Response('Not found', { status: 404 })

    const titleClipped = data.title.length > 70 ? data.title.slice(0, 67) + '…' : data.title
    const subtitleClipped = data.subtitle.length > 80 ? data.subtitle.slice(0, 77) + '…' : data.subtitle

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
              <img
                src="https://www.closeos.fr/closeos-business-logo-ecrit.png"
                width={240}
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
                {type === 'booking' ? 'Lien de réservation' : 'Inscription'}
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
                    borderRadius: type === 'booking' ? '50%' : 16,
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
                    borderRadius: type === 'booking' ? '50%' : 16,
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
