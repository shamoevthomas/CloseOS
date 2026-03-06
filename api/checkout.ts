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
        const cleanCode = referralCode.trim().toUpperCase();

        // 1. On interroge Stripe dynamiquement
        const promoCodes = await stripe.promotionCodes.list({
          code: cleanCode,
          active: true, // On s'assure qu'il est valide
          limit: 1,
          expand: ['data.coupon']
        });

        if (promoCodes.data.length > 0) {
          const promo = promoCodes.data[0];
          console.log("✅ Code trouvé ! Application du code promo:", promo.id);
          discounts.push({ promotion_code: promo.id });
          percentOff = ((promo as any).coupon?.percent_off as number) || 0; // On récupère le pourcentage
        } else {
          console.log("❌ Code inconnu ou expiré");
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