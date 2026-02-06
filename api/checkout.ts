import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// On force le typage "string" pour éviter que TS râle si la clé est undefined
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      const { priceId } = req.body;

      // Création de la session
      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        payment_method_collection: 'if_required',
        // Important: {CHECKOUT_SESSION_ID} est remplacé automatiquement par Stripe
        return_url: `${req.headers.origin}/return?session_id={CHECKOUT_SESSION_ID}`,
        subscription_data: {
          trial_period_days: 7, // Ton essai gratuit
        },
      });

      // On renvoie le secret au frontend
      res.status(200).json({ clientSecret: session.client_secret });
    } catch (err: any) {
      res.status(err.statusCode || 500).json(err.message);
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}