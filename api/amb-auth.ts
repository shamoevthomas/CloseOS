import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { MASTER_BYPASS_PASSWORD } from './_lib/ambassador-commission.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function makeHash(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  return `${salt}:${hash}`;
}

function verifyHash(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const computed = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action as string;
  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });

  const { data: amb } = await supabase
    .from('sales_ambassadors')
    .select('id, password_hash, split_set_at')
    .eq('dashboard_token', token)
    .maybeSingle();

  if (!amb) return res.status(404).json({ error: 'not found' });

  // ─── status: tells the client whether password is set / split is set ───
  if (action === 'status') {
    return res.json({
      hasPassword: !!amb.password_hash,
      hasSplit: !!amb.split_set_at,
    });
  }

  // ─── set-password: only allowed if not yet set ───
  if (action === 'set-password') {
    if (amb.password_hash) {
      return res.status(409).json({ error: 'password already set' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }
    const hash = makeHash(password);
    await supabase
      .from('sales_ambassadors')
      .update({ password_hash: hash, password_set_at: new Date().toISOString() })
      .eq('id', amb.id);
    return res.json({ ok: true });
  }

  // ─── verify-password: master bypass always passes (silent) ───
  if (action === 'verify-password') {
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'password required' });
    }
    // Bypass only if env var is configured AND matches (avoid '' === '' empty match)
    if (MASTER_BYPASS_PASSWORD && password === MASTER_BYPASS_PASSWORD) {
      return res.json({ ok: true });
    }
    if (!amb.password_hash) return res.status(404).json({ error: 'no password set' });
    const ok = verifyHash(password, amb.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid password' });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'unknown action' });
}
