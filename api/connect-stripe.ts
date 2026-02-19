import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialisation sécurisée
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16', // Version de l'API Stripe (facultatif mais recommandé)
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export default async function handler(req: any, res: any) {
  // Sécurité : On n'accepte que les POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      throw new Error('User ID and Email are required');
    }

    // 1. On regarde si l'utilisateur a déjà un ID Stripe dans ta DB
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .single();

    let accountId = profile?.stripe_account_id;

    // 2. S'il n'en a pas, on crée un compte "Standard" pour lui chez Stripe
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email: email,
      });
      accountId = account.id;

      // On sauvegarde cet ID tout de suite dans ta base
      await supabase
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', userId);
    }

    // 3. On génère le lien magique "Onboarding" de Stripe
    // ⚠️ Assure-toi que ta page factures est bien sur l'URL /invoices ou change le chemin ci-dessous
    const origin = req.headers.origin || 'https://closeos.fr';
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/invoices`, // S'il annule
      return_url: `${origin}/invoices?stripe_connected=true`, // S'il réussit
      type: 'account_onboarding',
    });

    // 4. On renvoie l'URL au Frontend
    res.status(200).json({ url: accountLink.url });

  } catch (error: any) {
    console.error('Stripe Connect Error:', error);
    res.status(500).json({ error: error.message });
  }
}