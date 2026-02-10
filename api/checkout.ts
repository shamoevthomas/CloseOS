import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// 👇 ICI : TA LISTE DE CODES
// L'ID commence par 'promo_', c'est donc un Promotion Code.
const PARTNER_CODES: Record<string, string> = {
  'TEKA15': 'promo_1SzEOZ33xpuYLywqw0ns1FaJ', 
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      const { lineItems, plan, referralCode } = req.body;
      
      console.log("Session pour:", plan, "| Code saisi:", referralCode);

      // 👇 LOGIQUE CORRIGÉE
      const discounts = [];
      
      if (referralCode) {
        const cleanCode = referralCode.trim().toUpperCase();
        const promoId = PARTNER_CODES[cleanCode];

        if (promoId) {
           console.log("✅ Code trouvé ! Application du code promo:", promoId);
           // ⚠️ CHANGEMENT ICI : on utilise 'promotion_code' au lieu de 'coupon'
           discounts.push({ promotion_code: promoId });
        } else {
           console.log("❌ Code inconnu");
        }
      }

      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        line_items: lineItems,
        mode: 'subscription',
        payment_method_collection: 'if_required', 
        
        // On applique la réduction
        discounts: discounts.length > 0 ? discounts : undefined,

        return_url: `${req.headers.origin}/return?session_id={CHECKOUT_SESSION_ID}&plan=${plan || 'founder'}`,
        
        subscription_data: {
          trial_period_days: 7,
        },
      });

      res.status(200).json({ clientSecret: session.client_secret });
    } catch (err: any) {
      console.error("ERREUR STRIPE:", err.message);
      // On renvoie l'erreur exacte pour le débug
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}