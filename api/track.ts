import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const VISITOR_COOKIE = 'clos_tvid'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 an

// ─── Helpers ───

function getClientIp(req: VercelRequest): string {
  const fwd = (req.headers['x-forwarded-for'] as string) || ''
  return fwd.split(',')[0]?.trim() || (req.socket?.remoteAddress ?? '')
}

function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie || ''
  const out: Record<string, string> = {}
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=')
    if (idx === -1) return
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  })
  return out
}

// destination interne (page CloseOS) => temps sur page mesurable
function detectInternal(url: string): boolean {
  try {
    if (url.startsWith('/')) return url.startsWith('/capture') || url.startsWith('/book')
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    const isCloseos = host === 'closeos.fr' || host.endsWith('.closeos.fr') || host.includes('closeos')
    return isCloseos && (u.pathname.startsWith('/capture') || u.pathname.startsWith('/book'))
  } catch {
    return false
  }
}

function makeSlug(): string {
  return crypto.randomBytes(5).toString('hex').slice(0, 8)
}

// Bots d'aperçu de lien / crawlers / scanners (frappent l'URL depuis des datacenters,
// souvent géolocalisés US, sans cookie → fausseraient les stats). On les ignore.
const BOT_RE = /bot\b|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|twitter|linkedin|embedly|quora|pinterest|redditbot|applebot|bingpreview|preview|scanner|monitor|curl|wget|python-requests|python-urllib|axios|node-fetch|go-http|okhttp|java\/|headless|phantom|puppeteer|playwright|lighthouse|prerender|metainspector|vercel|ahrefs|semrush|petalbot|yandex|baiduspider|duckduckbot|gptbot|claudebot|ccbot|bytespider/i

function isBotOrPrefetch(req: VercelRequest): boolean {
  const ua = ((req.headers['user-agent'] as string) || '').toLowerCase()
  if (!ua || BOT_RE.test(ua)) return true
  const purpose = ((req.headers['purpose'] || req.headers['x-purpose'] || req.headers['sec-purpose']) as string) || ''
  if (/prefetch|preview|prerender/i.test(purpose)) return true
  if ((req.headers['x-moz'] as string) === 'prefetch') return true
  return false
}

// ─── Handler ───

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || ''

  try {
    // ══════════ REDIRECT (public) : /t/:slug ══════════
    if (action === 'redirect') {
      const slug = (req.query.slug as string) || ''
      const fallback = `https://${(req.headers.host as string) || 'closeos.fr'}/`
      if (!slug) return res.redirect(302, fallback)

      const { data: link } = await supabase
        .from('business_tracking_links')
        .select('id, destination_url, is_internal, is_active')
        .eq('slug', slug)
        .maybeSingle()

      if (!link || !link.is_active) return res.redirect(302, fallback)

      // Bot / aperçu de lien / prefetch : on redirige mais on n'enregistre RIEN (stats propres)
      if (isBotOrPrefetch(req)) {
        res.setHeader('Cache-Control', 'no-store')
        return res.redirect(302, link.destination_url)
      }

      // Visiteur (cookie 1st-party)
      const cookies = parseCookies(req)
      let visitorId = cookies[VISITOR_COOKIE]
      const isNewVisitor = !visitorId
      if (!visitorId) visitorId = crypto.randomBytes(12).toString('hex')

      // Récurrent = ce visiteur a déjà cliqué CE lien auparavant
      let isReturning = false
      if (!isNewVisitor) {
        const { data: prev } = await supabase
          .from('business_tracking_events')
          .select('id')
          .eq('link_id', link.id)
          .eq('visitor_id', visitorId)
          .limit(1)
          .maybeSingle()
        isReturning = !!prev
      }

      const country = (req.headers['x-vercel-ip-country'] as string) || null
      const city = (req.headers['x-vercel-ip-city'] as string)
        ? decodeURIComponent(req.headers['x-vercel-ip-city'] as string)
        : null
      const referrer = ((req.headers['referer'] as string) || '').slice(0, 500) || null
      const ua = ((req.headers['user-agent'] as string) || '').slice(0, 500) || null

      const { data: evt } = await supabase
        .from('business_tracking_events')
        .insert({
          link_id: link.id,
          visitor_id: visitorId,
          is_returning: isReturning,
          country,
          city,
          referrer,
          user_agent: ua,
        })
        .select('id')
        .maybeSingle()

      res.setHeader('Set-Cookie', [
        `${VISITOR_COOKIE}=${encodeURIComponent(visitorId)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax; Secure`,
      ])

      // Destination (+ beacon params si page CloseOS interne)
      let dest = link.destination_url
      if (link.is_internal && evt?.id) {
        const sep = dest.includes('?') ? '&' : '?'
        dest = `${dest}${sep}_tk=${evt.id}`
      }
      res.setHeader('Cache-Control', 'no-store')
      return res.redirect(302, dest)
    }

    // ══════════ BEACON (public) : temps sur page ══════════
    if (action === 'beacon' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const eventId = body.event_id
      const duration = Math.max(0, Math.min(60 * 60 * 4, Math.round(Number(body.duration) || 0)))
      if (!eventId) return res.status(400).json({ error: 'event_id required' })
      await supabase
        .from('business_tracking_events')
        .update({ duration_seconds: duration })
        .eq('id', eventId)
        .is('duration_seconds', null)
      return res.status(200).json({ ok: true })
    }

    // ══════════ CREATE ══════════
    if (action === 'create' && req.method === 'POST') {
      const { user_id, name, destination_url } = req.body || {}
      if (!user_id || !name || !destination_url) {
        return res.status(400).json({ error: 'user_id, name and destination_url required' })
      }
      let dest = String(destination_url).trim()
      if (!/^https?:\/\//i.test(dest) && !dest.startsWith('/')) dest = `https://${dest}`

      // slug unique
      let slug = makeSlug()
      for (let i = 0; i < 5; i++) {
        const { data: exists } = await supabase
          .from('business_tracking_links')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()
        if (!exists) break
        slug = makeSlug()
      }

      const { data: link, error } = await supabase
        .from('business_tracking_links')
        .insert({
          user_id,
          name: String(name).slice(0, 120),
          slug,
          destination_url: dest,
          is_internal: detectInternal(dest),
        })
        .select('id, name, slug, destination_url, is_internal, is_active, created_at')
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ link })
    }

    // ══════════ LIST (avec compteurs) ══════════
    if (action === 'list' && req.method === 'GET') {
      const userId = req.query.user_id as string
      if (!userId) return res.status(400).json({ error: 'user_id required' })

      const { data: links } = await supabase
        .from('business_tracking_links')
        .select('id, name, slug, destination_url, is_internal, is_active, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      const result = await Promise.all(
        (links || []).map(async (l) => {
          const { data: events } = await supabase
            .from('business_tracking_events')
            .select('visitor_id, is_returning')
            .eq('link_id', l.id)
          const evs = events || []
          const uniqueVisitors = new Set(evs.map((e) => e.visitor_id)).size
          const returningClicks = evs.filter((e) => e.is_returning).length
          return {
            ...l,
            clicks: evs.length,
            uniqueVisitors,
            returningClicks,
          }
        }),
      )
      return res.status(200).json({ links: result })
    }

    // ══════════ STATS (détail d'un lien) ══════════
    if (action === 'stats' && req.method === 'GET') {
      const userId = req.query.user_id as string
      const linkId = req.query.link_id as string
      if (!userId || !linkId) return res.status(400).json({ error: 'user_id and link_id required' })

      // ownership check
      const { data: link } = await supabase
        .from('business_tracking_links')
        .select('id, name, slug, destination_url, is_internal, is_active, created_at, user_id')
        .eq('id', linkId)
        .maybeSingle()
      if (!link || link.user_id !== userId) return res.status(404).json({ error: 'not found' })

      const { data: events } = await supabase
        .from('business_tracking_events')
        .select('visitor_id, is_returning, country, city, duration_seconds, created_at')
        .eq('link_id', linkId)
        .order('created_at', { ascending: true })
      const evs = events || []

      const clicks = evs.length

      // visiteurs : récurrents (plusieurs clics) vs nouveaux (1 clic)
      const perVisitor: Record<string, number> = {}
      evs.forEach((e) => {
        const k = e.visitor_id || 'anon'
        perVisitor[k] = (perVisitor[k] || 0) + 1
      })
      const uniqueVisitors = Object.keys(perVisitor).length
      const recurringVisitors = Object.values(perVisitor).filter((n) => n > 1).length
      const newVisitors = uniqueVisitors - recurringVisitors

      // temps sur page
      const durations = evs.map((e) => e.duration_seconds).filter((d): d is number => typeof d === 'number')
      const avgDuration = durations.length
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : null

      // par pays
      const countryMap: Record<string, number> = {}
      evs.forEach((e) => {
        const c = e.country || 'ZZ'
        countryMap[c] = (countryMap[c] || 0) + 1
      })
      const byCountry = Object.entries(countryMap)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)

      // timeseries (30 derniers jours)
      const dayMap: Record<string, number> = {}
      evs.forEach((e) => {
        const day = (e.created_at || '').slice(0, 10)
        if (day) dayMap[day] = (dayMap[day] || 0) + 1
      })
      const timeseries = Object.entries(dayMap)
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-30)

      return res.status(200).json({
        link,
        stats: {
          clicks,
          uniqueVisitors,
          recurringVisitors,
          newVisitors,
          returningClicks: evs.filter((e) => e.is_returning).length,
          avgDuration,
          hasDurationData: durations.length > 0,
          byCountry,
          timeseries,
        },
      })
    }

    // ══════════ TOGGLE / UPDATE ══════════
    if (action === 'update' && req.method === 'POST') {
      const { id, user_id, is_active, name } = req.body || {}
      if (!id || !user_id) return res.status(400).json({ error: 'id and user_id required' })
      const patch: Record<string, any> = {}
      if (typeof is_active === 'boolean') patch.is_active = is_active
      if (typeof name === 'string') patch.name = name.slice(0, 120)
      const { error } = await supabase
        .from('business_tracking_links')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user_id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    // ══════════ DELETE ══════════
    if (action === 'delete' && req.method === 'POST') {
      const { id, user_id } = req.body || {}
      if (!id || !user_id) return res.status(400).json({ error: 'id and user_id required' })
      const { error } = await supabase
        .from('business_tracking_links')
        .delete()
        .eq('id', id)
        .eq('user_id', user_id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'unknown action' })
  } catch (err: any) {
    console.error('[track] error', err)
    return res.status(500).json({ error: err?.message || 'internal error' })
  }
}
