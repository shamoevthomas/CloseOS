import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      const { lineItems, plan, referralCode, isVoip, promotekitReferral, userId, referral_code: frontendReferralCode, customerEmail, existingUser } = req.body;

      // Cascade de priorité pour le code affilié : Supabase > localStorage > Promotekit
      let supabaseReferral = null;
      if (userId) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('referral_code')
            .eq('id', userId)
            .single();
          supabaseReferral = profile?.referral_code ?? null;
        } catch {
          // Si Supabase échoue on continue avec le fallback
        }
      }
      const finalReferral = supabaseReferral || frontendReferralCode || promotekitReferral || '';

      console.log("Session pour:", plan, "| Code saisi:", referralCode, "| VoIP:", isVoip, "| Referral:", finalReferral);

      let discounts: any[] = [];
      let percentOff = 0; // On stocke la réduction pour l'envoyer au frontend

      if (referralCode) {
        const cleanCode = referralCode.trim();

        // Essayer avec le code tel quel, puis en majuscules si pas trouvé
        let promoCodes = await stripe.promotionCodes.list({
          code: cleanCode,
          active: true,
          limit: 1,
        });

        // Fallback: essayer en majuscules si pas trouvé
        if (promoCodes.data.length === 0 && cleanCode !== cleanCode.toUpperCase()) {
          promoCodes = await stripe.promotionCodes.list({
            code: cleanCode.toUpperCase(),
            active: true,
            limit: 1,
          });
        }

        if (promoCodes.data.length > 0) {
          const promo = promoCodes.data[0];
          // Récupérer le coupon associé
          const coupon = typeof promo.coupon === 'string'
            ? await stripe.coupons.retrieve(promo.coupon)
            : promo.coupon;
          console.log("✅ Code trouvé:", promo.id, "| Coupon:", coupon?.id, "| percent_off:", coupon?.percent_off, "| amount_off:", coupon?.amount_off);
          discounts.push({ promotion_code: promo.id });
          percentOff = coupon?.percent_off || 0;
        } else {
          console.log("❌ Code inconnu ou expiré:", cleanCode);
        }
      }

      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        line_items: lineItems,
        mode: 'subscription',
        payment_method_collection: 'always',

        // Pré-remplir l'email pour les utilisateurs existants (TrialExpired)
        ...(customerEmail ? { customer_email: customerEmail } : {}),

        // Utilisateur existant → pas de redirect, onComplete gère côté client
        // Nouvel utilisateur → redirect vers /return pour créer le compte
        ...(existingUser
          ? { redirect_on_completion: 'never' as const }
          : { return_url: `${req.headers.origin}/return?session_id={CHECKOUT_SESSION_ID}&plan=${plan || 'founder'}` }),

        // On applique la réduction
        discounts: discounts.length > 0 ? discounts : undefined,

        metadata: {
          plan: plan || 'founder',
          voip: isVoip ? 'true' : 'false',
          ...(finalReferral ? { referral_code: String(finalReferral) } : {}),
          ...(promotekitReferral ? { promotekit_referral: String(promotekitReferral) } : {}),
        },

        subscription_data: {
          metadata: {
            plan: plan || 'founder',
            voip: isVoip ? 'true' : 'false',
            ...(finalReferral ? { referral_code: String(finalReferral) } : {}),
            ...(promotekitReferral ? { promotekit_referral: String(promotekitReferral) } : {}),
          },
          trial_period_days: 2,
        },
      });

      res.status(200).json({ clientSecret: session.client_secret, percentOff, promoApplied: discounts.length > 0 });
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