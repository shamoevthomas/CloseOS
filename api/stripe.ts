import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Action: checkout ───────────────────────────────────────────────────────────

async function handleCheckout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { lineItems, plan, referralCode, isVoip, promotekitReferral, userId, referral_code: frontendReferralCode, customerEmail, existingUser, internalReferral } = req.body;

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
    let percentOff = 0;
    let internalReferrerId: string | null = null;
    let isInternalCodeUsed = false;

    // ─── 1. Vérifier si le code saisi est un code de parrainage interne ───
    if (referralCode) {
      const cleanCode = referralCode.trim().toUpperCase();

      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('own_referral_code', cleanCode)
        .single();

      if (referrer && referrer.id !== userId) {
        // Code interne trouvé → appliquer coupon filleul
        internalReferrerId = referrer.id;
        isInternalCodeUsed = true;
        const isYearly = lineItems[0]?.price === 'price_1TBh2Y33xpuYLywqZaoPaqth';
        discounts.push({ coupon: isYearly ? 'aEg3N6xK' : '7Dt4fsPe' });
        console.log('🤝 Code parrainage interne:', cleanCode, '| Parrain:', referrer.id, '| Annuel:', isYearly);
      } else if (!referrer) {
        // Pas un code interne → chercher dans Stripe
        let promoCodes = await stripe.promotionCodes.list({
          code: referralCode.trim(),
          active: true,
          limit: 1,
        });

        if (promoCodes.data.length === 0 && referralCode.trim() !== cleanCode) {
          promoCodes = await stripe.promotionCodes.list({
            code: cleanCode,
            active: true,
            limit: 1,
          });
        }

        if (promoCodes.data.length > 0) {
          const promo = promoCodes.data[0];
          const coupon = typeof promo.coupon === 'string'
            ? await stripe.coupons.retrieve(promo.coupon)
            : promo.coupon;
          console.log("✅ Code Stripe trouvé:", promo.id, "| percent_off:", coupon?.percent_off);
          discounts.push({ promotion_code: promo.id });
          percentOff = coupon?.percent_off || 0;
        } else {
          console.log("❌ Code inconnu:", cleanCode);
        }
      }
    }

    // ─── 2. Vérifier le parrainage via cookie (lien de parrainage) ───
    if (!internalReferrerId && internalReferral) {
      const cleanRef = internalReferral.trim().toUpperCase();
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('own_referral_code', cleanRef)
        .single();

      if (referrer && referrer.id !== userId) {
        internalReferrerId = referrer.id;
        console.log('🔗 Parrainage via lien (cookie):', cleanRef, '| Parrain:', referrer.id);
      }
    }

    // ─── 3. Vérifier referred_by sur le profil ───
    if (!internalReferrerId && userId) {
      try {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('referred_by')
          .eq('id', userId)
          .single();
        if (userProfile?.referred_by) {
          internalReferrerId = userProfile.referred_by;
          console.log('🔗 Parrainage via referred_by:', internalReferrerId);
        }
      } catch {}
    }

    // Grandfathering: users registered before March 16, 2026 get 5€ off first month
    if (existingUser && userId && discounts.length === 0) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        if (authUser?.user?.created_at) {
          const createdAt = new Date(authUser.user.created_at);
          const cutoffDate = new Date('2026-03-16T00:00:00Z');
          if (createdAt < cutoffDate) {
            console.log('🎁 Legacy user detected, applying 5€ off forever coupon');
            discounts.push({ coupon: 'jV2tsVKM' });
          }
        }
      } catch (e) {
        console.error('Could not check user creation date for grandfathering:', e);
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
        : { return_url: `${req.headers.origin}/return?session_id={CHECKOUT_SESSION_ID}&plan=${plan || 'pro'}` }),

      // On applique la réduction
      discounts: discounts.length > 0 ? discounts : undefined,

      metadata: {
        plan: plan || 'pro',
        voip: isVoip ? 'true' : 'false',
        ...(finalReferral ? { referral_code: String(finalReferral) } : {}),
        ...(promotekitReferral ? { promotekit_referral: String(promotekitReferral) } : {}),
        ...(internalReferrerId ? { internal_referrer_id: internalReferrerId } : {}),
        ...(isInternalCodeUsed ? { internal_code_used: 'true' } : {}),
      },

      subscription_data: {
        metadata: {
          plan: plan || 'pro',
          voip: isVoip ? 'true' : 'false',
          ...(finalReferral ? { referral_code: String(finalReferral) } : {}),
          ...(promotekitReferral ? { promotekit_referral: String(promotekitReferral) } : {}),
          ...(internalReferrerId ? { internal_referrer_id: internalReferrerId } : {}),
        },
      },
    });

    res.status(200).json({ clientSecret: session.client_secret, percentOff, promoApplied: discounts.length > 0, internalReferralApplied: isInternalCodeUsed });
  } catch (err: any) {
    console.error("ERREUR STRIPE:", err.message);
    // On renvoie l'erreur exacte pour le débug
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

// ─── Action: connect ────────────────────────────────────────────────────────────

async function handleConnect(req: VercelRequest, res: VercelResponse) {
  // Sécurité : On n'accepte que les POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, email, returnPath } = req.body;

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
    const origin = req.headers.origin || 'https://closeos.fr';
    const redirectPath = returnPath || '/factures';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}${redirectPath}`,
      return_url: `${origin}${redirectPath}?stripe_connected=true`,
      type: 'account_onboarding',
    });

    // 4. On renvoie l'URL au Frontend
    res.status(200).json({ url: accountLink.url });

  } catch (error: any) {
    console.error('Stripe Connect Error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ─── Action: invoice-session ────────────────────────────────────────────────────

async function handleInvoiceSession(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency, title, connectedAccountId, clientEmail } = req.body;

    if (!amount || !connectedAccountId) {
      throw new Error('Missing required parameters');
    }

    // Création de la session de paiement Checkout
    // L'option clé ici est "stripeAccount", qui crée la session AU NOM du closer
    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency || 'eur',
              product_data: {
                name: title || 'Facture de Commission',
              },
              unit_amount: Math.round(amount * 100), // Stripe attend des centimes
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: clientEmail, // Pré-remplir l'email du client s'il est dispo
        success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/factures`,
      },
      {
        stripeAccount: connectedAccountId, // C'est ici que la magie Connect opère
      }
    );

    res.status(200).json({ url: session.url });

  } catch (error: any) {
    console.error('Stripe Session Error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ─── Action: portal-session ─────────────────────────────────────────────────────

async function handlePortalSession(req: VercelRequest, res: VercelResponse) {
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

// ─── Action: session-status ─────────────────────────────────────────────────────

async function handleSessionStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { session_id } = req.query;

    // On demande à Stripe les détails de cette session précise
    const session = await stripe.checkout.sessions.retrieve(session_id as string);

    // On renvoie le statut et l'email du client à ta page React
    res.status(200).json({
      status: session.status,
      customer_email: session.customer_details?.email
    });
  } catch (err: any) {
    res.status(err.statusCode || 500).json(err.message);
  }
}

// ─── Main Router ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  switch (action) {
    case 'checkout':
      return handleCheckout(req, res);
    case 'connect':
      return handleConnect(req, res);
    case 'invoice-session':
      return handleInvoiceSession(req, res);
    case 'portal-session':
      return handlePortalSession(req, res);
    case 'session-status':
      return handleSessionStatus(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
