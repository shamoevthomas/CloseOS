import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DEDUP_WINDOW_MINUTES = 30;                  // skip duplicate clicks from same IP within this window

function hashIp(ip: string): string {
  const salt = process.env.AMB_IP_SALT || 'closeos-amb';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

function getClientIp(req: VercelRequest): string {
  const fwd = (req.headers['x-forwarded-for'] as string) || '';
  return fwd.split(',')[0]?.trim() || (req.socket?.remoteAddress ?? '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = (req.body?.slug as string) || (req.query.slug as string) || '';
  if (!slug) return res.status(400).json({ error: 'slug required' });
  const tierRaw = (req.body?.tier as string) || (req.query.tier as string) || 'a';
  const tier = tierRaw === 'b' ? 'b' : 'a';

  const { data: amb } = await supabase
    .from('sales_ambassadors')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!amb) {
    // Unknown slug — don't error loudly, just no-op (avoid leaking which slugs exist)
    return res.json({ ok: true });
  }

  const ip = getClientIp(req);
  const ua = (req.headers['user-agent'] as string) || '';
  const referer = (req.headers['referer'] as string) || '';
  const ipHash = ip ? hashIp(ip) : null;

  // A3: dedup — skip insert if same ambassador+ip clicked in last 30 minutes
  let alreadyClicked = false;
  if (ipHash) {
    const cutoff = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('sales_amb_clicks')
      .select('id')
      .eq('ambassador_id', amb.id)
      .eq('ip_hash', ipHash)
      .gte('ts', cutoff)
      .limit(1)
      .maybeSingle();
    alreadyClicked = !!recent;
  }

  if (!alreadyClicked) {
    await supabase.from('sales_amb_clicks').insert({
      ambassador_id: amb.id,
      ip_hash: ipHash,
      user_agent: ua.slice(0, 500),
      referer: referer.slice(0, 500),
    });
  }

  // Always (re)set the cookie even on dedup — attribution must work for repeat visitors
  res.setHeader('Set-Cookie', [
    `closeos_amb=${encodeURIComponent(amb.slug)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax; Secure`,
    `closeos_amb_tier=${tier}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax; Secure`,
  ]);

  return res.json({ ok: true });
}
