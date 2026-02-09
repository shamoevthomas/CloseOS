import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      // 👇 AJOUT : On récupère "plan" en plus de "lineItems"
      const { lineItems, plan } = req.body;
      
      console.log("Création session pour:", plan, lineItems);

      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        line_items: lineItems,
        mode: 'subscription',
        payment_method_collection: 'if_required', 
        
        // 👇 MODIFICATION CRUCIALE : On ajoute le paramètre plan dans l'URL
        // Si aucun plan n'est reçu, on met 'founder' par défaut
        return_url: `${req.headers.origin}/return?session_id={CHECKOUT_SESSION_ID}&plan=${plan || 'founder'}`,
        
        subscription_data: {
          trial_period_days: 7,
        },
      });

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