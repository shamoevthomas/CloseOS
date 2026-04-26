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
}

function escapeAttr(s: string): string {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function priceFormat(price: number, currency: string): string {
  const v = (price / 100).toFixed(2).replace('.00', '')
  return currency === 'eur' ? `${v}€` : `${v} ${currency.toUpperCase()}`
}

async function buildBookingMeta(slug: string, baseUrl: string, ogImageUrl: string): Promise<MetaData | null> {
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

  const title = creatorName ? `Réserver avec ${creatorName}` : 'Réserver un créneau'
  const desc = `${link.label || 'Rendez-vous'}${link.duration ? ` — ${link.duration} min` : ''}${priceLabel ? ` — ${priceLabel}` : ''}`

  return {
    title: `${title} · CloseOS`,
    description: link.description || desc,
    ogTitle: title,
    ogDescription: desc,
    ogImageUrl,
    url: `${baseUrl}/book/${slug}`,
  }
}

async function buildCaptureMeta(slug: string, baseUrl: string, ogImageUrl: string): Promise<MetaData | null> {
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

  const title = (campaign.landing_title || campaign.name || 'Inscription').slice(0, 110)
  const subtitle = campaign.landing_subtitle || settings?.company_name || ''
  const desc = (campaign.description || subtitle || `${campaign.capture_type === 'with_rdv' ? 'Réservation' : 'Inscription'}${priceLabel ? ` — ${priceLabel}` : ''}`).slice(0, 200)

  return {
    title: `${title} · CloseOS`,
    description: desc,
    ogTitle: title,
    ogDescription: desc,
    ogImageUrl,
    url: `${baseUrl}/capture/${slug}`,
  }
}

let cachedShell: string | null = null
let cachedShellTs = 0
async function fetchIndexShell(baseUrl: string): Promise<string> {
  const now = Date.now()
  if (cachedShell && now - cachedShellTs < 5 * 60 * 1000) return cachedShell
  // Fetch the deployed index.html from the root path. The query param avoids any rewrite loops
  // (only /book/* and /capture/* match the social rewrites).
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
  // Twitter
  out = out.replace(/<meta property="twitter:url"[^>]*id="tw-url"[^>]*>/, `<meta property="twitter:url" content="${T(meta.url)}" id="tw-url">`)
  out = out.replace(/<meta property="twitter:title"[^>]*id="tw-title"[^>]*>/, `<meta property="twitter:title" content="${T(meta.ogTitle)}" id="tw-title">`)
  out = out.replace(/<meta property="twitter:description"[\s\S]*?id="tw-description"[^>]*>/, `<meta property="twitter:description" content="${T(meta.ogDescription)}" id="tw-description">`)
  out = out.replace(/<meta property="twitter:image"[^>]*id="tw-image"[^>]*>/, `<meta property="twitter:image" content="${T(meta.ogImageUrl)}" id="tw-image">`)
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const type = req.query.type as string
    const slug = req.query.slug as string

    if (!type || !slug || (type !== 'booking' && type !== 'capture')) {
      res.status(400).send('Missing or invalid type/slug')
      return
    }

    const host = req.headers.host || 'www.closeos.fr'
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    const baseUrl = `${proto}://${host}`
    const ogImageUrl = `${baseUrl}/api/og?type=${type}&slug=${encodeURIComponent(slug)}`

    const meta = type === 'booking'
      ? await buildBookingMeta(slug, baseUrl, ogImageUrl)
      : await buildCaptureMeta(slug, baseUrl, ogImageUrl)

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
