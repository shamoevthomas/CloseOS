import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// On force le typage "string" pour éviter que TS râle
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      // 👇 MODIFICATION : On récupère "lineItems" (la liste) au lieu de "priceId"
      const { lineItems } = req.body;
      
      console.log("Tentative de création de session pour les items:", lineItems);

      // Création de la session
      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        // 👇 MODIFICATION : On passe directement le tableau reçu du frontend
        line_items: lineItems,
        mode: 'subscription',
        // 'always' oblige le client à rentrer sa CB même pour un essai gratuit.
        payment_method_collection: 'if_required', 
        
        // Important: {CHECKOUT_SESSION_ID} est remplacé automatiquement par Stripe
        return_url: `${req.headers.origin}/return?session_id={CHECKOUT_SESSION_ID}`,
        subscription_data: {
          trial_period_days: 7, // Ton essai gratuit s'applique à tout le panier
        },
      });

      // On renvoie le secret au frontend
      res.status(200).json({ clientSecret: session.client_secret });
    } catch (err: any) {
      console.error("ERREUR STRIPE:", err.message);
      res.status(err.statusCode || 500).json(err.message);
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}