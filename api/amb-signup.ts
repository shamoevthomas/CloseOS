import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug, user_id, email } = req.body || {};
  if (!slug || !email) return res.status(400).json({ error: 'slug and email required' });

  const { data: amb } = await supabase
    .from('sales_ambassadors')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!amb) return res.json({ ok: true }); // unknown slug — no-op

  // Idempotent: skip if a conversion already exists for this email/user under this ambassador
  const { data: existing } = await supabase
    .from('sales_amb_conversions')
    .select('id')
    .eq('ambassador_id', amb.id)
    .eq('email', email)
    .maybeSingle();

  if (existing) return res.json({ ok: true });

  await supabase.from('sales_amb_conversions').insert({
    ambassador_id: amb.id,
    user_id: user_id || null,
    email,
    status: 'signup',
  });

  return res.json({ ok: true });
}
