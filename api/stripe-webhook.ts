import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { subPeriodEndIso } from './_lib/stripePeriod.js';
import {
    detectBillingCycleFromInterval,
    mapReferralReward,
    type BillingCycle,
} from './_lib/referral-rewards.js';

export const config = {
    runtime: 'edge', // Using Edge Runtime for better performance on Vercel
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!; // Platform events
const webhookSecretConnect = process.env.STRIPE_WEBHOOK_SECRET_CONNECT || ''; // Connect events (optional, for ambassador account.updated)

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-01-27.acacia' as any,
    httpClient: Stripe.createFetchHttpClient(), // Required for Edge
});

// ─── Charte CloseOS Sales (fond crème, carte blanche, accent sky, logo-sales.png) ───
// même gabarit que api/email.ts / api/cron/sales-weekly-report.ts. Remplace emailWrap
// (ancien thème sombre #020617) pour les emails Sales de ce fichier.

function wrapEmailHtml(bodyContent: string): string {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f4f2f1;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f2f1;padding:64px 20px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:40px;text-align:left;padding-left:24px;">
        <img src="https://closeos.fr/logo-sales.png" alt="CloseOS" width="150" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:32px;padding:48px 40px;box-shadow:0 20px 40px rgba(15,23,42,0.05);border:1px solid rgba(2,132,199,0.08);">
        ${bodyContent}
      </td></tr>
      <tr><td style="padding-top:40px;text-align:left;padding-left:24px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">
          Cet e-mail a été envoyé automatiquement par <a href="https://closeos.fr" style="color:#0284c7;text-decoration:none;font-weight:500;">CloseOS</a>, merci de ne pas y répondre.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── Business email wrapper (light theme DA) ────────────────────────────────

function businessEmailWrap(badge: string, heading: string, bodyHtml: string, ctaText: string, ctaUrl: string) {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td align="center" style="padding-bottom:32px;">
<span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;color:#111;letter-spacing:-0.04em;">Close</span><span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;background:linear-gradient(135deg,#ff4b72,#a03cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">OS</span>
</td></tr>
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
<tr><td style="padding:64px 48px;">
<span style="display:inline-block;background-color:#fff0f0;color:#dc2626;padding:6px 16px;border-radius:50px;font-size:12px;font-weight:800;text-transform:uppercase;font-family:'Manrope',Arial,sans-serif;letter-spacing:0.05em;">${badge}</span>
<h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:26px;color:#111;letter-spacing:-0.04em;line-height:1.1;margin:24px 0 16px;">${heading}</h1>
<div style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;font-size:15px;line-height:1.6;">${bodyHtml}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
<tr><td align="center">
<a href="${ctaUrl}" style="display:inline-block;background-color:#111;color:#fff;text-decoration:none;padding:16px 32px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;">${ctaText}</a>
</td></tr></table>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding-top:32px;">
<p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;opacity:0.5;font-size:12px;margin:0 0 4px;">&copy; 2026 CloseOS.fr</p>
<p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;opacity:0.5;font-size:12px;margin:0;">
<a href="https://closeos.fr/cgu" style="color:#1b1c1b;text-decoration:none;">CGU</a> &middot; <a href="https://closeos.fr/cgv" style="color:#1b1c1b;text-decoration:none;">CGV</a> &middot; <a href="https://closeos.fr/confidentialite" style="color:#1b1c1b;text-decoration:none;">Confidentialit&eacute;</a>
</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

async function sendBrevoEmail(to: string, subject: string, html: string) {
    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                to: [{ email: to }],
                subject, htmlContent: html
            })
        });
        console.log(`📧 Email "${subject}" → ${to}: ${res.ok ? 'OK' : 'FAIL'}`);
        return res.ok;
    } catch (e) { console.error('Email error:', e); return false; }
}

async function sendRetentionEmail(to: string, userId: string, name: string) {
    // Generate a quick link. Ideally use a signed token, but for MVP, userId might suffice if we secure the endpoint.
    // Better: verification token?
    // Let's use userId for now, but in a real app, we should sign it.
    // To keep it simple and stateless for this MVP without extra DB tables:
    // We'll trust the email link. The reactivate page will require the user to be logged in OR we just validte the ID.
    // Actually, simple URL parameter is fine if the reactivation action checks auth or is idempotent.

    // NOTE: The user might not be logged in when clicking the email. 
    // If they are not logged in, we should probably ask them to log in? 
    // Or we provide a magic link?
    // For now, let's point to the app. If they are logged in, great. If not, they log in then go there?
    // The "retention" page will handle the "I want to stay" logic.

    const retentionLink = `https://closeos.app/retention?uid=${userId}`;

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'thomas@closeos.fr', name: 'Thomas de CloseOS' },
                to: [{ email: to }],
                subject: 'Avant de partir... 👋',
                htmlContent: wrapEmailHtml(`
                <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:30px;color:#111111;line-height:1.2;letter-spacing:-0.04em;">C'est vraiment la fin ?</h1>
                <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 20px;font-size:16px;color:#1b1c1b;line-height:1.6;">
                    Bonjour ${name}, je viens de voir que vous avez demandé l'annulation de votre abonnement.
                </p>
                <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 20px;font-size:16px;color:#1b1c1b;line-height:1.6;">
                    Je respecte totalement votre décision, mais j'aimerais beaucoup comprendre ce qui n'a pas fonctionné pour vous — votre retour est précieux. Si vous acceptez d'en discuter 5 minutes avec moi, je vous propose de <strong style="color:#111111;">suspendre cette annulation</strong>.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                    <tr><td align="center">
                        <a href="${retentionLink}" style="display:inline-block;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;background-color:#111111;border-radius:9999px;padding:16px 32px;text-decoration:none;">Je prends rendez-vous avant de partir</a>
                    </td></tr>
                </table>
                <p style="text-align:center;margin:0 0 24px;">
                    <a href="https://closeos.app" style="font-family:'Inter',Helvetica,sans-serif;color:#94a3b8;text-decoration:none;font-size:13px;">Non merci, je confirme mon départ</a>
                </p>
                <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:16px;color:#1b1c1b;line-height:1.6;">
                    Merci pour la confiance que vous nous avez accordée jusque-là.<br>Thomas — Fondateur CloseOS
                </p>
                `)
            })
        });
        return response.ok;
    } catch (error) {
        console.error('Email send error', error);
        return false;
    }
}

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature && webhookSecret) {
        return new Response('Missing signature', { status: 400 });
    }

    let event: Stripe.Event;

    try {
        const body = await req.text();
        if (webhookSecret) {
            // Try platform secret first; if it fails AND a Connect secret is configured, try that.
            // This lets the same endpoint URL serve both the platform webhook and a separate
            // Connect webhook (for events like account.updated on connected ambassador accounts).
            try {
                event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
            } catch (platformErr) {
                if (!webhookSecretConnect) throw platformErr;
                event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecretConnect);
            }
        } else {
            // Fallback for dev without secret verification (not recommended for prod)
            event = JSON.parse(body);
        }
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle the event
    switch (event.type) {

        // 1. PAIEMENT RÉUSSI (Première fois)
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`💰 Checkout completed for session ${session.id}`);

            // ─── Extra org join payment ───
            if (session.metadata?.action === 'join-extra-org') {
                const { token, user_id } = session.metadata;
                if (!token || !user_id) {
                    console.error('❌ Missing token or user_id in org join metadata');
                    break;
                }
                console.log(`🏢 Processing extra org join for user ${user_id}`);
                try {
                    // Validate invitation
                    const { data: invitation, error: invErr } = await supabaseAdmin
                        .from('business_invitations')
                        .select('*')
                        .eq('token', token)
                        .single();
                    if (invErr || !invitation || invitation.used) {
                        console.error('❌ Invalid or used invitation:', token);
                        break;
                    }
                    // Mark invitation as used
                    await supabaseAdmin.from('business_invitations').update({ used: true, used_by: user_id }).eq('id', invitation.id);
                    // Get user info
                    const { data: userProfile } = await supabaseAdmin.from('profiles').select('full_name, avatar_url').eq('id', user_id).single();
                    const firstName = userProfile?.full_name?.split(' ')[0] || '';
                    const lastName = userProfile?.full_name?.split(' ').slice(1).join(' ') || '';
                    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
                    const email = authUser?.user?.email || '';
                    // Check existing membership for this specific org
                    const { data: existing } = await supabaseAdmin.from('business_team_members').select('id').eq('user_id', user_id).eq('business_owner_id', invitation.inviter_id).maybeSingle();
                    let memberId: string;
                    if (existing) {
                        await supabaseAdmin.from('business_team_members').update({
                            role: invitation.role, can_manage_campaigns: !!invitation.can_manage_campaigns,
                            setter_scope: invitation.setter_scope || null, custom_permissions: invitation.custom_permissions || null,
                            first_name: firstName, last_name: lastName, email,
                            avatar_url: userProfile?.avatar_url || null, has_onboarded: true, onboarding_acknowledged: true,
                        }).eq('id', existing.id);
                        memberId = existing.id;
                    } else {
                        const { data: member, error: memberError } = await supabaseAdmin.from('business_team_members').insert({
                            business_owner_id: invitation.inviter_id, user_id,
                            role: invitation.role, can_manage_campaigns: !!invitation.can_manage_campaigns,
                            setter_scope: invitation.setter_scope || null, custom_permissions: invitation.custom_permissions || null,
                            first_name: firstName, last_name: lastName, email,
                            avatar_url: userProfile?.avatar_url || null, has_onboarded: true, onboarding_acknowledged: true,
                        }).select('id').single();
                        if (memberError) { console.error('❌ Error creating team member:', memberError); break; }
                        memberId = member.id;
                    }
                    // Update profiles to point to new org
                    await supabaseAdmin.from('profiles').update({ business_member_id: memberId, business_owner_id: invitation.inviter_id }).eq('id', user_id);
                    console.log(`✅ Extra org join completed: user ${user_id} → org ${invitation.inviter_id}`);
                } catch (err: any) {
                    console.error('❌ Error processing extra org join:', err.message);
                }
                break;
            }

            // ─── Business reactivation (trial expired, no card) ───
            if (session.metadata?.reactivation === 'true' && session.metadata?.user_id) {
                const reactivateUserId = session.metadata.user_id;
                const reactivateCustomerId = session.customer as string;
                const reactivateSubId = session.subscription as string;

                await supabaseAdmin
                    .from('business_users')
                    .update({ stripe_customer_id: reactivateCustomerId })
                    .eq('id', reactivateUserId);

                console.log(`✅ Business reactivation: user ${reactivateUserId} → customer ${reactivateCustomerId}, subscription ${reactivateSubId}`);
                break;
            }

            const customerId = session.customer as string;
            const customerEmail = session.customer_details?.email;
            const subscriptionId = session.subscription as string;

            if (!customerEmail) {
                console.error('❌ No email found in session');
                break;
            }

            // Récupérer les infos de la subscription pour avoir le vrai statut et le cycle (3-cycles)
            let realStatus = 'active';
            let billingCycle: BillingCycle | null = null;
            if (subscriptionId) {
                try {
                    const sub = await stripe.subscriptions.retrieve(subscriptionId);
                    realStatus = sub.status; // 'active' ou 'trialing'
                    const recurring = (sub as any).items?.data?.[0]?.price?.recurring;
                    billingCycle = detectBillingCycleFromInterval(recurring?.interval, recurring?.interval_count);
                } catch (e) {
                    console.error('⚠️ Could not retrieve subscription details:', e);
                }
            }

            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('id, subscribed_at')
                .eq('email', customerEmail)
                .single();

            if (profile) {
                console.log(`✅ User found: ${profile.id}. Linking Stripe Customer...`);
                await supabaseAdmin
                    .from('profiles')
                    .update({
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        subscription_status: realStatus,
                        plan: session.metadata?.plan || 'pro',
                        has_voip: session.metadata?.voip === 'true',
                        billing_cycle: billingCycle,
                        ...(!profile.subscribed_at ? { subscribed_at: new Date().toISOString() } : {}),
                    })
                    .eq('id', profile.id);

                // ─── Enregistrer le parrainage interne (V2 : pending + J+14) ───
                const internalReferrerId = session.metadata?.internal_referrer_id;
                if (internalReferrerId) {
                    // Vérifier qu'il n'existe pas déjà un parrainage pour ce filleul
                    const { data: existingRef } = await supabaseAdmin
                        .from('referrals')
                        .select('id')
                        .eq('referee_id', profile.id)
                        .limit(1);

                    if (!existingRef || existingRef.length === 0) {
                        // Récupérer le cycle de facturation du parrain pour calculer la récompense
                        const { data: referrerProfile } = await supabaseAdmin
                            .from('profiles')
                            .select('billing_cycle')
                            .eq('id', internalReferrerId)
                            .single();

                        const referrerBillingCycle: BillingCycle =
                            (referrerProfile?.billing_cycle as BillingCycle) || 'monthly';
                        const refereeBillingCycle: BillingCycle = billingCycle || 'monthly';

                        const reward = mapReferralReward(referrerBillingCycle, refereeBillingCycle);

                        // J+14 anti-fraude : récompense activée 14 jours après checkout
                        const scheduledAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

                        await supabaseAdmin.from('referrals').insert({
                            referrer_id: internalReferrerId,
                            referee_id: profile.id,
                            referee_billing_cycle: refereeBillingCycle,
                            referrer_billing_cycle: referrerBillingCycle,
                            coupon_id: reward.couponId,
                            manual_payout_amount_cents: reward.manualPayoutCents,
                            scheduled_at: scheduledAt,
                            status: 'pending',
                        });

                        await supabaseAdmin
                            .from('profiles')
                            .update({ referred_by: internalReferrerId })
                            .eq('id', profile.id);

                        console.log(`🤝 Parrainage en attente: ${internalReferrerId} (${referrerBillingCycle}) → ${profile.id} (${refereeBillingCycle}) | Activation prévue: ${scheduledAt}`);
                    }
                }
                // ─── Email de confirmation de paiement ───
                const userName = session.customer_details?.name || customerEmail?.split('@')[0] || 'Closer';
                const priceLabel =
                    billingCycle === 'yearly' ? '18€/mois (216€/an)' :
                    billingCycle === 'quarterly' ? '20€/mois (60€/trimestre)' :
                    '24€/mois';
                await sendBrevoEmail(customerEmail!, 'Bienvenue dans l\'aventure CloseOS 🚀', wrapEmailHtml(`
                    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#0284c7;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">✅ Confirmation</p>
                    <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:32px;color:#111111;line-height:1.15;letter-spacing:-0.04em;">Bienvenue dans l'aventure CloseOS 🚀</h1>
                    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
                        Bonjour ${userName},<br><br>
                        Votre paiement a bien été confirmé. Vous faites maintenant partie de la communauté des closers qui ont décidé de <strong style="color:#111111;">professionnaliser leur activité</strong>.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                        <tr><td style="padding:20px;background-color:#f5f9ff;border-radius:16px;">
                            <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 10px;font-size:15px;color:#0284c7;">✅ Récapitulatif</p>
                            <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;line-height:1.8;">
                                • <strong>Plan :</strong> Pro<br>
                                • <strong>Tarif :</strong> ${priceLabel}<br>
                                • <strong>Accès :</strong> CRM, Pipeline, Agenda, Factures, KPI, Call Room
                            </p>
                        </td></tr>
                    </table>
                    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
                        Vous avez accès à <strong style="color:#111111;">toutes les fonctionnalités</strong> de l'outil. C'est le moment de centraliser votre activité et de closer comme un pro.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center">
                            <a href="https://closeos.fr/dashboard" style="display:inline-block;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;background-color:#111111;border-radius:9999px;padding:16px 32px;text-decoration:none;">💻 Accéder à mon espace</a>
                        </td></tr>
                    </table>
                `));

            } else {
                console.log(`⚠️ User not found for email ${customerEmail}. They might register later.`);
            }
            break;
        }

        // 2. FACTURE CRÉÉE — Plus aucune action côté parrainage (V2)
        // Les coupons parrains sont désormais appliqués sur la subscription par le cron
        // process-referrals (voir api/cron/process-referrals.ts)
        case 'invoice.created': {
            const invoice = event.data.object as any;
            console.log(`📄 Invoice created ${invoice.id} (V2: aucune action parrainage ici)`);
            break;
        }

        // 2b. PAIEMENT RÉCURRENT RÉUSSI
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object as any;
            const customerId = invoice.customer as string;

            console.log(`💸 Payment succeeded for invoice ${invoice.id}`);

            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: 'active',
                    current_period_end: new Date((invoice.lines.data[0].period.end * 1000)).toISOString()
                })
                .eq('stripe_customer_id', customerId);

            // Clear ALL grace periods if payment succeeded (Business side)
            const { data: bizUser } = await supabaseAdmin
                .from('business_users')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .maybeSingle();
            if (bizUser) {
                await supabaseAdmin
                    .from('business_settings')
                    .update({
                        seat_grace_deadline: null,
                        subscription_grace_deadline: null,
                        subscription_deletion_deadline: null,
                    })
                    .eq('user_id', bizUser.id);

                // ─── Referral: track payment ───
                const { data: refConversion } = await supabaseAdmin
                    .from('business_referral_conversions')
                    .select('id, status')
                    .eq('stripe_customer_id', customerId)
                    .maybeSingle();

                if (refConversion) {
                    const amount = (invoice as any).amount_paid ? Number((invoice as any).amount_paid) / 100 : 0;
                    if (amount > 0) {
                        await supabaseAdmin.rpc('increment_referral_total_paid', {
                            conversion_id: refConversion.id,
                            amount,
                        });
                    }
                    // Trial → Active on first real payment
                    if (refConversion.status === 'trial') {
                        await supabaseAdmin
                            .from('business_referral_conversions')
                            .update({ status: 'active', last_payment_at: new Date().toISOString() })
                            .eq('id', refConversion.id);
                    } else {
                        await supabaseAdmin
                            .from('business_referral_conversions')
                            .update({ last_payment_at: new Date().toISOString() })
                            .eq('id', refConversion.id);
                    }
                }
            }

            // ─── Sales Ambassador: track paid conversion + create commission ledger + transfer ───
            try {
                const subscriptionId = (invoice as any).subscription as string | undefined;
                const invoiceId = (invoice as any).id as string;
                const amountPaidCents = (invoice as any).amount_paid ? Number((invoice as any).amount_paid) : 0;

                // Try to resolve ambassador from subscription metadata first (most reliable)
                let ambMeta: Record<string, string> | null = null;
                let subInterval: 'day' | 'week' | 'month' | 'year' | undefined;
                let subIntervalCount: number | undefined;
                if (subscriptionId) {
                    try {
                        const sub = await stripe.subscriptions.retrieve(subscriptionId);
                        ambMeta = (sub.metadata || {}) as Record<string, string>;
                        subInterval = sub.items.data[0]?.price.recurring?.interval;
                        subIntervalCount = sub.items.data[0]?.price.recurring?.interval_count;
                    } catch (e) {
                        console.error('amb: cannot retrieve subscription', subscriptionId, (e as any)?.message);
                    }
                }

                // Resolve conversion: prefer customer_id match, fallback to email
                let conversion: any = null;
                {
                    const { data: byCustomer } = await supabaseAdmin
                        .from('sales_amb_conversions')
                        .select('*')
                        .eq('stripe_customer_id', customerId)
                        .maybeSingle();
                    conversion = byCustomer || null;
                }
                if (!conversion) {
                    const { data: salesProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('id, email')
                        .eq('stripe_customer_id', customerId)
                        .maybeSingle();
                    if (salesProfile?.email) {
                        const { data: byEmail } = await supabaseAdmin
                            .from('sales_amb_conversions')
                            .select('*')
                            .eq('email', salesProfile.email)
                            .maybeSingle();
                        conversion = byEmail || null;
                    }
                }
                // Last-resort: if metadata has ambassador_id and no conversion exists yet, create one
                if (!conversion && ambMeta?.ambassador_id) {
                    const { data: salesProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('id, email')
                        .eq('stripe_customer_id', customerId)
                        .maybeSingle();
                    if (salesProfile?.email) {
                        const { data: created } = await supabaseAdmin
                            .from('sales_amb_conversions')
                            .insert({
                                ambassador_id: ambMeta.ambassador_id,
                                user_id: salesProfile.id,
                                email: salesProfile.email,
                                status: 'signup',
                                stripe_customer_id: customerId,
                            })
                            .select()
                            .single();
                        conversion = created || null;
                    }
                }

                if (conversion) {
                    // Lock rates on conversion if not yet set (first payment defines lifetime rates)
                    const cycle = (() => {
                        if (subInterval) {
                            if (subInterval === 'year') return 'yearly';
                            if (subInterval === 'month' && subIntervalCount === 3) return 'quarterly';
                            return 'monthly';
                        }
                        return conversion.billing_cycle || 'monthly';
                    })();

                    const update: Record<string, any> = {
                        total_paid_cents: (conversion.total_paid_cents || 0) + amountPaidCents,
                        stripe_customer_id: customerId,
                    };
                    if (subscriptionId) update.stripe_subscription_id = subscriptionId;
                    if (conversion.status === 'signup') {
                        update.status = 'paid';
                        update.paid_at = new Date().toISOString();
                    }
                    if (!conversion.billing_cycle) update.billing_cycle = cycle;

                    // Lock pool/discount/commission on conversion if not set yet
                    if (conversion.commission_pct == null && ambMeta?.ambassador_commission_pct != null) {
                        update.pool_pct = Number(ambMeta.ambassador_pool_pct || 0);
                        update.discount_pct = Number(ambMeta.ambassador_discount_pct || 0);
                        update.commission_pct = Number(ambMeta.ambassador_commission_pct || 0);
                        if (ambMeta.ambassador_coupon_id) update.coupon_id_used = ambMeta.ambassador_coupon_id;
                        if (ambMeta.ambassador_promo_code) update.promo_code_used = ambMeta.ambassador_promo_code;
                    }

                    await supabaseAdmin
                        .from('sales_amb_conversions')
                        .update(update)
                        .eq('id', conversion.id);

                    // ─── Commission ledger (pending only — transfers handled by cron/manual) ───
                    // A4: We never call stripe.transfers.create here. Commissions are always
                    // created as 'pending' and paid out by api/cron/process-ambassador-payouts.ts
                    // (scheduled by ambassador.payout_day_of_month) or manual admin action.
                    const lockedCommissionPct =
                        conversion.commission_pct != null
                            ? Number(conversion.commission_pct)
                            : Number(update.commission_pct || 0);

                    // A9: explicit warn if cycle fallback used
                    if (!subInterval && !conversion.billing_cycle) {
                        console.warn(`⚠️ amb cycle fallback to monthly for invoice ${invoiceId} (no subscription metadata)`);
                    }

                    if (lockedCommissionPct > 0 && amountPaidCents > 0) {
                        const commissionCents = Math.round((amountPaidCents * lockedCommissionPct) / 100);

                        // Idempotency via unique index on stripe_invoice_id — INSERT may conflict harmlessly
                        const { error: insertErr } = await supabaseAdmin
                            .from('sales_amb_commissions')
                            .insert({
                                ambassador_id: conversion.ambassador_id,
                                conversion_id: conversion.id,
                                stripe_invoice_id: invoiceId,
                                stripe_subscription_id: subscriptionId || null,
                                stripe_customer_id: customerId,
                                invoice_amount_cents: amountPaidCents,
                                commission_pct: lockedCommissionPct,
                                commission_cents: commissionCents,
                                status: 'pending',
                            });

                        if (insertErr && !/duplicate|unique/i.test(insertErr.message)) {
                            console.error('amb commission insert error:', insertErr.message);
                        } else if (!insertErr) {
                            console.log(`📝 Commission pending: ${commissionCents}c → ambassadeur ${conversion.ambassador_id} (invoice ${invoiceId})`);
                        }
                    }
                }
            } catch (e: any) {
                console.error('sales-amb paid hook error:', e?.message || e);
            }
            break;
        }

        // 2c. PAIEMENT RÉCURRENT ÉCHOUÉ
        case 'invoice.payment_failed': {
            const invoice = event.data.object as any;
            const customerId = invoice.customer as string;
            const isRenewal = invoice.billing_reason === 'subscription_cycle';

            console.log(`❌ Payment failed for invoice ${invoice.id} (${isRenewal ? 'renewal' : 'other'})`);

            const { data: failedProfile } = await supabaseAdmin
                .from('profiles')
                .select('id, email, full_name')
                .eq('stripe_customer_id', customerId)
                .single();

            await supabaseAdmin
                .from('profiles')
                .update({ subscription_status: 'past_due' })
                .eq('stripe_customer_id', customerId);

            // Envoyer le mail d'échec de paiement
            if (failedProfile?.email) {
                const failName = failedProfile.full_name || 'Closer';
                const subject = isRenewal
                    ? 'Votre renouvellement n\'a pas abouti \u26A0\uFE0F'
                    : 'Votre paiement a \u00e9chou\u00e9 \u26A0\uFE0F';
                const title = isRenewal
                    ? 'Votre renouvellement n\'a pas abouti \u26A0\uFE0F'
                    : 'Votre paiement a \u00e9chou\u00e9 \u26A0\uFE0F';
                const bodyText = isRenewal
                    ? `Bonjour ${failName},<br><br>Le renouvellement de votre abonnement CloseOS n'a pas pu \u00eatre effectu\u00e9. Votre moyen de paiement a \u00e9t\u00e9 refus\u00e9 ou est expir\u00e9.`
                    : `Bonjour ${failName},<br><br>Nous n'avons pas pu proc\u00e9der au paiement de votre abonnement CloseOS. Votre moyen de paiement semble avoir \u00e9t\u00e9 refus\u00e9.`;

                await sendBrevoEmail(failedProfile.email, subject, wrapEmailHtml(`
                    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#ea580c;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">⚠️ Action requise</p>
                    <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:32px;color:#111111;line-height:1.15;letter-spacing:-0.04em;">${title}</h1>
                    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
                        ${bodyText}
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                        <tr><td style="padding:20px;background-color:#fff7ed;border-radius:16px;">
                            <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 10px;font-size:15px;color:#ea580c;">⚠️ Ce qu'il se passe</p>
                            <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 6px;font-size:14px;color:#1b1c1b;line-height:1.6;">
                                • Votre accès à CloseOS est <strong>temporairement suspendu</strong>.
                            </p>
                            <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 6px;font-size:14px;color:#1b1c1b;line-height:1.6;">
                                • Vos données sont <strong>en sécurité</strong> et ne seront pas supprimées.
                            </p>
                            <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;line-height:1.6;">
                                • Mettez à jour votre moyen de paiement pour <strong>réactiver votre accès immédiatement</strong>.
                            </p>
                        </td></tr>
                    </table>
                    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:15px;color:#1b1c1b;line-height:1.6;">
                        Si vous pensez qu'il s'agit d'une erreur, contactez-nous à <a href="mailto:support@closeos.fr" style="color:#0284c7;text-decoration:none;font-weight:500;">support@closeos.fr</a>.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center">
                            <a href="https://closeos.fr/dashboard" style="display:inline-block;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;background-color:#111111;border-radius:9999px;padding:16px 32px;text-decoration:none;">💳 Mettre à jour mon paiement</a>
                        </td></tr>
                    </table>
                `));
            }

            // ─── Business seat payment failed → Start grace period ───
            const ALL_SEAT_PRICE_IDS = [
                'price_1TKhn633xpuYLywq4DdHTZbL', 'price_1TKhn733xpuYLywqpQE2jpBR', 'price_1TKhn733xpuYLywq2e7YpB2O',
                'price_1TKhn833xpuYLywqSChhELST', 'price_1TKhnA33xpuYLywqDSCaLXSm', 'price_1TKhnB33xpuYLywqzvpFxImH',
                'price_1TKhnC33xpuYLywqM09DxTtd', 'price_1TKhnD33xpuYLywqIVBStxhu', 'price_1TKhnD33xpuYLywq6lwoiAOV',
            ];
            const hasSeatItems = invoice.lines?.data?.some((line: any) => ALL_SEAT_PRICE_IDS.includes(line.price?.id));

            if (hasSeatItems) {
                const { data: bizOwner } = await supabaseAdmin
                    .from('business_users')
                    .select('id, full_name')
                    .eq('stripe_customer_id', customerId)
                    .maybeSingle();

                if (bizOwner) {
                    const { data: bizSettings } = await supabaseAdmin
                        .from('business_settings')
                        .select('seat_grace_deadline')
                        .eq('user_id', bizOwner.id)
                        .single();

                    if (!bizSettings?.seat_grace_deadline) {
                        const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
                        await supabaseAdmin
                            .from('business_settings')
                            .update({ seat_grace_deadline: deadline })
                            .eq('user_id', bizOwner.id);

                        console.log(`⏳ Seat grace period set for ${bizOwner.id} until ${deadline}`);

                        const { data: { user: bizAuthUser } } = await supabaseAdmin.auth.admin.getUserById(bizOwner.id);
                        if (bizAuthUser?.email) {
                            const ownerName = bizOwner.full_name?.split(' ')[0] || 'Bonjour';
                            await sendBrevoEmail(bizAuthUser.email, '\u00c9chec de paiement \u2014 Action requise', businessEmailWrap(
                                'Action requise',
                                `${ownerName}, le paiement de vos si\u00e8ges a \u00e9chou\u00e9.`,
                                `<p>Le renouvellement du paiement de vos si\u00e8ges suppl\u00e9mentaires n'a pas pu \u00eatre effectu\u00e9.</p>
                                <p>Vous avez <strong>5 jours</strong> pour mettre \u00e0 jour votre moyen de paiement. Pass\u00e9 ce d\u00e9lai, les membres ajout\u00e9s en suppl\u00e9ment seront automatiquement supprim\u00e9s de votre organisation, ainsi que toutes leurs donn\u00e9es.</p>
                                <div style="background-color:#f5f3f2;border-radius:24px;padding:24px 20px;margin-top:20px;">
                                    <p style="margin:0 0 8px;font-weight:600;color:#111;">\u26a0\ufe0f Ce qu'il se passe :</p>
                                    <p style="margin:0 0 4px;">\u2022 Vos membres suppl\u00e9mentaires restent actifs pendant 5 jours</p>
                                    <p style="margin:0 0 4px;">\u2022 Sans paiement, ils seront supprim\u00e9s automatiquement</p>
                                    <p style="margin:0;">\u2022 Mettez \u00e0 jour votre paiement pour \u00e9viter toute interruption</p>
                                </div>`,
                                'Mettre \u00e0 jour le paiement',
                                'https://closeos.app/business/organisation'
                            ));
                        }
                    }
                }
            }

            // ─── Business subscription payment failed → Start subscription grace period ───
            {
                const { data: subBizOwner } = await supabaseAdmin
                    .from('business_users')
                    .select('id, full_name, is_lifetime_free')
                    .eq('stripe_customer_id', customerId)
                    .maybeSingle();

                if (subBizOwner && !subBizOwner.is_lifetime_free) {
                    const { data: subBizSettings } = await supabaseAdmin
                        .from('business_settings')
                        .select('subscription_grace_deadline')
                        .eq('user_id', subBizOwner.id)
                        .single();

                    if (!subBizSettings?.subscription_grace_deadline) {
                        const subDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
                        await supabaseAdmin
                            .from('business_settings')
                            .update({ subscription_grace_deadline: subDeadline })
                            .eq('user_id', subBizOwner.id);

                        console.log(`⏳ Subscription grace period set for ${subBizOwner.id} until ${subDeadline}`);

                        const { data: { user: subAuthUser } } = await supabaseAdmin.auth.admin.getUserById(subBizOwner.id);
                        if (subAuthUser?.email) {
                            const subName = subBizOwner.full_name?.split(' ')[0] || 'Bonjour';
                            await sendBrevoEmail(subAuthUser.email, '\u00c9chec de paiement \u2014 Action requise', businessEmailWrap(
                                'Action requise',
                                `${subName}, le paiement de votre abonnement a \u00e9chou\u00e9.`,
                                `<p>Le renouvellement de votre abonnement CloseOS Business n'a pas pu \u00eatre effectu\u00e9.</p>
                                <p>Vous avez <strong>5 jours</strong> pour mettre \u00e0 jour votre moyen de paiement. Pass\u00e9 ce d\u00e9lai, l'acc\u00e8s \u00e0 CloseOS sera bloqu\u00e9 pour vous et toute votre \u00e9quipe.</p>
                                <div style="background-color:#f5f3f2;border-radius:24px;padding:24px 20px;margin-top:20px;">
                                    <p style="margin:0 0 8px;font-weight:600;color:#111;">\u26a0\ufe0f Ce qu'il va se passer :</p>
                                    <p style="margin:0 0 4px;">\u2022 Apr\u00e8s 5 jours : acc\u00e8s bloqu\u00e9 pour toute l'\u00e9quipe</p>
                                    <p style="margin:0 0 4px;">\u2022 Apr\u00e8s 19 jours : suppression d\u00e9finitive de l'organisation</p>
                                    <p style="margin:0;">\u2022 Mettez \u00e0 jour votre paiement pour \u00e9viter toute interruption</p>
                                </div>`,
                                'Mettre \u00e0 jour le paiement',
                                'https://closeos.app/business/organisation'
                            ));
                        }
                    }
                }
            }

            break;
        }

        // 3. MISE À JOUR ABONNEMENT (Annulation, Pause, Changement de plan...)
        case 'customer.subscription.updated': {
            const subscription = event.data.object as any;
            const customerId = subscription.customer as string;

            console.log(`🔄 Subscription updated: ${subscription.status}`);

            // Récupérer le plan et le cycle depuis les metadata et l'intervalle (3-cycles)
            const updatedPlan = subscription.metadata?.plan;
            const recurring = subscription.items?.data?.[0]?.price?.recurring;
            const updatedCycle = detectBillingCycleFromInterval(recurring?.interval, recurring?.interval_count);

            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: subscription.status,
                    current_period_end: subPeriodEndIso(subscription),
                    stripe_subscription_id: subscription.id,
                    ...(updatedPlan ? { plan: updatedPlan } : {}),
                    billing_cycle: updatedCycle,
                })
                .eq('stripe_customer_id', customerId);

            // Logique de Rétention (Email si annulation demandée)
            const previousAttributes = (event.data as any).previous_attributes;
            const wasNotCanceled = previousAttributes?.cancel_at_period_end === false;
            const isNowCanceled = subscription.cancel_at_period_end === true;

            if (wasNotCanceled && isNowCanceled) {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('id, full_name, email')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (profile?.email) {
                    await sendRetentionEmail(profile.email, profile.id, profile.full_name || 'utilisateur');
                }

                // Anti-fraude parrainage : annuler les récompenses pending dont ce user est le filleul
                if (profile?.id) {
                    const { data: canceledRefs } = await supabaseAdmin
                        .from('referrals')
                        .update({ status: 'canceled', canceled_reason: 'subscription_canceled' })
                        .eq('referee_id', profile.id)
                        .eq('status', 'pending')
                        .select('id');
                    if (canceledRefs && canceledRefs.length > 0) {
                        console.log(`🚫 ${canceledRefs.length} parrainage(s) pending annulé(s) (filleul ${profile.id} a annulé)`);
                    }
                }
            }
            break;
        }

        // 4. ABONNEMENT SUPPRIMÉ (Fin définitive)
        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;

            console.log(`🚫 Subscription deleted for customer ${customerId}`);

            // ─── Sales Ambassador: mark paid conversion as canceled ───
            try {
                const { data: ambCanceled } = await supabaseAdmin
                    .from('sales_amb_conversions')
                    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
                    .eq('stripe_customer_id', customerId)
                    .eq('status', 'paid')
                    .select('id');
                if (ambCanceled && ambCanceled.length > 0) {
                    console.log(`📉 ${ambCanceled.length} conversion(s) ambassadeur marquée(s) canceled`);
                }
            } catch (e: any) {
                console.error('sales-amb cancel hook error:', e?.message || e);
            }

            // Anti-fraude parrainage : annuler les pendings dont ce user est filleul
            const { data: subDeletedProfile } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .single();
            if (subDeletedProfile?.id) {
                const { data: canceledRefs } = await supabaseAdmin
                    .from('referrals')
                    .update({ status: 'canceled', canceled_reason: 'subscription_canceled' })
                    .eq('referee_id', subDeletedProfile.id)
                    .eq('status', 'pending')
                    .select('id');
                if (canceledRefs && canceledRefs.length > 0) {
                    console.log(`🚫 ${canceledRefs.length} parrainage(s) pending annulé(s) (filleul ${subDeletedProfile.id} subscription deleted)`);
                }
            }

            // Check if user has a pending deletion request
            const { data: deletionProfile } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email, deletion_scheduled_at, deletion_scope')
                .eq('stripe_customer_id', customerId)
                .single();

            if (deletionProfile?.deletion_scheduled_at && deletionProfile?.deletion_scope) {
                // User requested account deletion — execute it now
                console.log(`🗑️ Executing deferred deletion for user ${deletionProfile.id}`);

                const scope = deletionProfile.deletion_scope as string[];
                const deleteAll = scope.includes('all');
                const deleteBilling = deleteAll || scope.includes('billing');
                const deleteInternal = deleteAll || scope.includes('internal');
                const deleteExternal = deleteAll || scope.includes('external');
                const deletePersonal = deleteAll || scope.includes('personal');

                const deleteTasks: PromiseLike<any>[] = [];

                if (deleteBilling) {
                    deleteTasks.push(
                        supabaseAdmin.from('invoices').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('issuer_profiles').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('payment_methods').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('auto_invoice_configs').delete().eq('user_id', deletionProfile.id),
                    );
                }
                if (deleteInternal) {
                    deleteTasks.push(
                        supabaseAdmin.from('internal_contacts').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('offers').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('user_scripts').delete().eq('user_id', deletionProfile.id),
                    );
                }
                if (deleteExternal) {
                    deleteTasks.push(
                        supabaseAdmin.from('prospects').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('calls').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('call_history').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('meetings').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('reminders').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('share_links').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('spectator_leads').delete().eq('user_id', deletionProfile.id),
                    );
                }
                if (deletePersonal) {
                    deleteTasks.push(
                        supabaseAdmin.from('notifications').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('kpi_config').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('booking_settings').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('booking_types').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('cal_credentials').delete().eq('user_id', deletionProfile.id),
                        supabaseAdmin.from('pipedrive_stage_mapping').delete().eq('user_id', deletionProfile.id),
                    );
                }

                await Promise.all(deleteTasks);

                // Delete profile
                await supabaseAdmin.from('profiles').delete().eq('id', deletionProfile.id);

                // Send farewell email
                if (deletionProfile.email) {
                    try {
                        await fetch('https://api.brevo.com/v3/smtp/email', {
                            method: 'POST',
                            headers: {
                                'accept': 'application/json',
                                'api-key': brevoApiKey,
                                'content-type': 'application/json'
                            },
                            body: JSON.stringify({
                                sender: { email: 'support@closeos.fr', name: 'CloseOS Support' },
                                to: [{ email: deletionProfile.email }],
                                subject: 'Votre compte CloseOS a été supprimé',
                                htmlContent: `
                                    <div style="font-family: sans-serif; color: #333;">
                                        <h1>Compte supprimé</h1>
                                        <p>Bonjour${deletionProfile.full_name ? ` ${deletionProfile.full_name}` : ''},</p>
                                        <p>Votre abonnement est arrivé à terme et votre compte a été supprimé comme demandé.</p>
                                        <p>Vous pouvez toujours créer un nouveau compte si vous changez d'avis.</p>
                                        <p>Cordialement,<br/>L'équipe CloseOS</p>
                                    </div>
                                `
                            })
                        });
                    } catch (emailErr) {
                        console.error('Farewell email error:', emailErr);
                    }
                }

                // Delete auth user
                await supabaseAdmin.auth.admin.deleteUser(deletionProfile.id);
                console.log(`✅ Deferred deletion completed for user ${deletionProfile.id}`);
            } else {
                // No deletion request — just mark as canceled
                await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: 'canceled',
                        plan: null
                    })
                    .eq('stripe_customer_id', customerId);
            }

            // ─── Referral: mark as churned ───
            await supabaseAdmin
                .from('business_referral_conversions')
                .update({ status: 'churned' })
                .eq('stripe_customer_id', customerId);

            break;
        }

        // ─── Stripe Connect: ambassador account status changes ───
        case 'account.updated': {
            const account = event.data.object as Stripe.Account;
            try {
                const { data: amb } = await supabaseAdmin
                    .from('sales_ambassadors')
                    .select('id, stripe_account_status')
                    .eq('stripe_account_id', account.id)
                    .maybeSingle();

                if (!amb) break;

                let newStatus = amb.stripe_account_status as string;
                if (account.payouts_enabled && account.charges_enabled) newStatus = 'onboarded';
                else if (account.details_submitted) newStatus = 'restricted';
                else newStatus = 'onboarding';

                if (newStatus !== amb.stripe_account_status) {
                    await supabaseAdmin
                        .from('sales_ambassadors')
                        .update({ stripe_account_status: newStatus })
                        .eq('id', amb.id);
                    if (newStatus === 'onboarded') {
                        console.log(`✅ Ambassadeur ${amb.id} onboardé sur Stripe Connect — pending commissions seront versées au prochain payout day`);
                    }
                }
                // Note: pending commissions are paid by api/cron/process-ambassador-payouts.ts
                // on each ambassador's payout_day_of_month, or via the admin "manual payout" button.
                // We no longer retry transfers here to avoid race conditions (audit A4, A8).
            } catch (e: any) {
                console.error('account.updated handler error:', e?.message || e);
            }
            break;
        }
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
