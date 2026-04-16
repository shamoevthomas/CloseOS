import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-04-10' as any });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, email, returnPath } = req.body;

    if (!userId || !email) {
      throw new Error('User ID and Email are required');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .maybeSingle();

    let accountId = profile?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email,
      });
      accountId = account.id;

      await supabase
        .from('profiles')
        .upsert({ id: userId, stripe_account_id: accountId }, { onConflict: 'id' });
    }

    const origin = req.headers.origin || 'https://closeos.fr';
    const redirectPath = returnPath || '/factures';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}${redirectPath}`,
      return_url: `${origin}${redirectPath}?stripe_connected=true`,
      type: 'account_onboarding',
    });

    res.status(200).json({ url: accountLink.url });
  } catch (error: any) {
    console.error('Stripe Connect Error:', error);
    res.status(500).json({ error: error.message });
  }
}
