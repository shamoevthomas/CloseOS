import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// 👇 ICI : TA LISTE DE CODES (Tu en ajoutes autant que tu veux)
// Format : "CODE_CLIENT": "ID_PROMO_STRIPE"
const PARTNER_CODES: Record<string, string> = {
  'TEKA15': 'promo_1SzEOZ33xpuYLywqw0ns1FaJ', // Code Teka
  // 'NEXTCODE': 'promo_xyz...',              // Tu pourras ajouter le suivant ici
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      const { lineItems, plan, referralCode } = req.body;
      
      console.log("Session pour:", plan, "| Code saisi:", referralCode);

      // 👇 LOGIQUE SIMPLIFIÉE
      const discounts = [];
      
      if (referralCode) {
        // On nettoie le code (en majuscule + sans espaces)
        const cleanCode = referralCode.trim().toUpperCase();
        
        // On vérifie si le code existe dans ta liste
        const couponId = PARTNER_CODES[cleanCode];

        if (couponId) {
           console.log("✅ Code trouvé ! Application de:", couponId);
           discounts.push({ coupon: couponId });
        } else {
           console.log("❌ Code inconnu");
        }
      }

      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        line_items: lineItems,
        mode: 'subscription',
        payment_method_collection: 'if_required', 
        
        // On applique la réduction si trouvée
        discounts: discounts.length > 0 ? discounts : undefined,

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