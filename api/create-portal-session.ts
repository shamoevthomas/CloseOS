import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
// Utilise la clé SERVICE_ROLE pour être sûr de pouvoir lire le stripe_customer_id
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID manquant' });
    }

    // 1. Récupérer l'ID Client Stripe depuis Supabase
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (error || !profile?.stripe_customer_id) {
      console.error('Erreur profil ou pas de customer ID:', error);
      return res.status(404).json({ error: "Aucun abonnement actif associé à ce compte." });
    }

    // 2. Générer le lien du portail Stripe
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${req.headers.origin}/dashboard`, // Retour au site après gestion
    });

    return res.status(200).json({ url: session.url });

  } catch (err: any) {
    console.error("ERREUR PORTAIL:", err.message);
    return res.status(500).json({ error: err.message });
  }
}