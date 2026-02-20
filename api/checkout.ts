import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// 

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      const { lineItems, plan, referralCode, isVoip, promotekitReferral } = req.body; // 👇 Ajout de isVoip et Promotekit

      console.log("Session pour:", plan, "| Code saisi:", referralCode, "| VoIP:", isVoip);

      let discounts: any[] = [];
      let percentOff = 0; // On stocke la réduction pour l'envoyer au frontend

      if (referralCode) {
        const cleanCode = referralCode.trim().toUpperCase();

        // 1. On interroge Stripe dynamiquement
        const promoCodes = await stripe.promotionCodes.list({
          code: cleanCode,
          active: true, // On s'assure qu'il est valide
          limit: 1,
          expand: ['data.promotion.coupon']
        });

        if (promoCodes.data.length > 0) {
          const promo = promoCodes.data[0];
          console.log("✅ Code trouvé ! Application du code promo:", promo.id);
          discounts.push({ promotion_code: promo.id });
          percentOff = (promo.promotion.coupon as Stripe.Coupon).percent_off || 0; // On récupère le pourcentage
        } else {
          console.log("❌ Code inconnu ou expiré");
        }
      }

      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        line_items: lineItems,
        mode: 'subscription',
        payment_method_collection: 'always',

        // On applique la réduction
        discounts: discounts.length > 0 ? discounts : undefined,

        metadata: {
          plan: plan || 'founder', // 👇 Stockage du plan dans les métadonnées de la session
          voip: isVoip ? 'true' : 'false', // 👇 Stockage de l'option VoIP
          ...(promotekitReferral ? { promotekit_referral: String(promotekitReferral) } : {}),
        },

        return_url: `${req.headers.origin}/return?session_id={CHECKOUT_SESSION_ID}&plan=${plan || 'founder'}`,

        subscription_data: {
          // 👇 Stockage du plan dans les métadonnées de l'abonnement (pour sync-subscription)
          metadata: {
            plan: plan || 'founder',
            voip: isVoip ? 'true' : 'false', // 👇 Stockage de l'option VoIP
            ...(promotekitReferral ? { promotekit_referral: String(promotekitReferral) } : {}),
          },
          // MODE LANCEMENT : Si on est avant le 1er Mars, l'essai va jusqu'au 8 Mars
          trial_end: new Date() < new Date('2026-03-01T00:00:00Z')
            ? Math.floor(new Date('2026-03-08T00:00:00Z').getTime() / 1000)
            : undefined,
          trial_period_days: new Date() < new Date('2026-03-01T00:00:00Z')
            ? undefined
            : 7,
        },
      });

      res.status(200).json({ clientSecret: session.client_secret, percentOff });
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