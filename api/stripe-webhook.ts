import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = {
    runtime: 'edge', // Using Edge Runtime for better performance on Vercel
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!; // Needed for verification

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

// ─── Email wrapper (même DA que tous les mails CloseOS) ─────────────────────

function emailWrap(badge: string, badgeColor: string, borderColor: string, title: string, body: string, ctaText: string, ctaUrl: string) {
    return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
    <style>
        :root { color-scheme: dark; }
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    </style>
</head>
<body style="margin: 0; padding: 0; -webkit-font-smoothing: antialiased; background-color: #020617;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #020617; background-image: linear-gradient(#020617, #020617);">
        <tr><td align="center" style="padding-bottom: 60px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                <tr><td align="center" style="padding: 40px 20px 20px 20px;">
                    <img src="https://closeos.fr/logo.PNG" alt="CloseOS" width="140" style="display: block;">
                </td></tr>
                <tr><td align="center" style="padding: 0 20px; font-family: 'Segoe UI', Arial, sans-serif;">
                    <span style="background-color: ${badgeColor}; background-image: linear-gradient(${badgeColor}, ${badgeColor}); border: 1px solid ${borderColor}; color: ${borderColor}; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: bold; text-transform: uppercase; display: inline-block;">${badge}</span>
                    <h1 style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent); font-size: 28px; margin-top: 20px; margin-bottom: 16px;">${title}</h1>
                    ${body}
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 25px;">
                        <tr><td align="center">
                            <a href="${ctaUrl}" style="background-color: #3b82f6; background-image: linear-gradient(#3b82f6, #3b82f6); color: #fdfdfd; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: bold; display: block; font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px;">${ctaText}</a>
                        </td></tr>
                    </table>
                </td></tr>
                <tr><td align="center" style="padding: 40px 20px 0 20px; font-family: 'Segoe UI', Arial, sans-serif;">
                    <p style="color: #475569; font-size: 12px; margin-bottom: 4px;">&copy; 2026 CloseOS.fr &mdash; Le Syst&egrave;me d'Exploitation des Closers</p>
                    <p style="color: #475569; font-size: 12px;"><a href="https://closeos.fr/cgu" style="color: #475569; text-decoration: none;">CGU</a> &middot; <a href="https://closeos.fr/cgv" style="color: #475569; text-decoration: none;">CGV</a> &middot; <a href="https://closeos.fr/confidentialite" style="color: #475569; text-decoration: none;">Confidentialit&eacute;</a></p>
                    <p style="color: #475569; font-size: 11px; margin-top: 30px;">Vous recevez cet email car vous &ecirc;tes inscrit sur CloseOS.</p>
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
                htmlContent: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <h1>C'est vraiment la fin ?</h1>
                    <p>Bonjour ${name},</p>
                    <p>Je viens de voir que vous avez demandé l'annulation de votre abonnement.</p>
                    <p>Je respecte totalement votre décision, mais j'aimerais beaucoup comprendre ce qui n'a pas fonctionné pour vous. Votre feedback est précieux.</p>
                    <p>Si vous acceptez d'en discuter 5 minutes avec moi, je vous propose de <strong>suspendre cette annulation</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${retentionLink}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Je prends rendez-vous avant de partir</a>
                    </div>
                     <p style="text-align: center; margin-top: 10px;">
                        <a href="https://closeos.app" style="color: #999; text-decoration: none; font-size: 14px;">Non merci, je confirme mon départ</a>
                    </p>
                    <p>Merci pour la confiance que vous nous avez accordée jusque là.</p>
                    <p>Thomas<br/>Fondateur CloseOS</p>
                </div>
                `
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
            event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
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

            const customerId = session.customer as string;
            const customerEmail = session.customer_details?.email;
            const subscriptionId = session.subscription as string;

            if (!customerEmail) {
                console.error('❌ No email found in session');
                break;
            }

            // Récupérer les infos de la subscription pour avoir le vrai statut et le cycle
            let realStatus = 'active';
            let billingCycle: string | null = null;
            if (subscriptionId) {
                try {
                    const sub = await stripe.subscriptions.retrieve(subscriptionId);
                    realStatus = sub.status; // 'active' ou 'trialing'
                    // Déterminer le cycle depuis l'intervalle du prix
                    const interval = (sub as any).items?.data?.[0]?.price?.recurring?.interval;
                    billingCycle = interval === 'year' ? 'yearly' : 'monthly';
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

                // ─── Enregistrer le parrainage interne ───
                const internalReferrerId = session.metadata?.internal_referrer_id;
                if (internalReferrerId) {
                    const isYearly = billingCycle === 'yearly';

                    // Vérifier qu'il n'existe pas déjà un parrainage pour ce filleul
                    const { data: existingRef } = await supabaseAdmin
                        .from('referrals')
                        .select('id')
                        .eq('referee_id', profile.id)
                        .limit(1);

                    if (!existingRef || existingRef.length === 0) {
                        await supabaseAdmin.from('referrals').insert({
                            referrer_id: internalReferrerId,
                            referee_id: profile.id,
                            referee_billing_cycle: billingCycle || 'monthly',
                            referrer_reward_type: isYearly ? 'free_month' : 'monthly_discount',
                            referrer_months_remaining: isYearly ? 1 : 2,
                            status: 'active',
                            activated_at: new Date().toISOString(),
                        });

                        await supabaseAdmin
                            .from('profiles')
                            .update({ referred_by: internalReferrerId })
                            .eq('id', profile.id);

                        console.log(`🤝 Parrainage enregistré: ${internalReferrerId} → ${profile.id} (${isYearly ? 'annuel' : 'mensuel'})`);
                        // Les crédits seront appliqués automatiquement via invoice.created
                    }
                }
                // ─── Email de confirmation de paiement ───
                const userName = session.customer_details?.name || customerEmail?.split('@')[0] || 'Closer';
                const priceLabel = billingCycle === 'yearly' ? '25,50€/mois (annuel)' : '34€/mois';
                await sendBrevoEmail(customerEmail!, 'Bienvenue dans l\'aventure CloseOS 🚀', emailWrap(
                    'Confirmation', '#042f2e', '#14b8a6',
                    'Bienvenue dans l\'aventure CloseOS \u{1F680}',
                    `<p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 20px;">
                        Bonjour ${userName},<br><br>
                        Votre paiement a bien \u00e9t\u00e9 confirm\u00e9. Vous faites maintenant partie de la communaut\u00e9 des closers qui ont d\u00e9cid\u00e9 de <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">professionnaliser leur activit\u00e9</strong>.
                    </p>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #14b8a6; border-radius: 20px; margin-bottom: 20px;">
                        <tr><td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                            <h3 style="color: #2dd4bf; background-image: linear-gradient(transparent, transparent); font-size: 20px; margin-top: 0; margin-bottom: 16px;">\u2705 R\u00e9capitulatif</h3>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.8; margin: 0;">
                                \u2022 <strong style="color: #fdfdfd;">Plan :</strong> Pro<br>
                                \u2022 <strong style="color: #fdfdfd;">Tarif :</strong> ${priceLabel}<br>
                                \u2022 <strong style="color: #fdfdfd;">Acc\u00e8s :</strong> CRM, Pipeline, Agenda, Factures, KPI, Call Room
                            </p>
                        </td></tr>
                    </table>
                    <p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; text-align: left; margin-bottom: 10px;">
                        Vous avez acc\u00e8s \u00e0 <strong style="color: #fdfdfd;">toutes les fonctionnalit\u00e9s</strong> de l'outil. C'est le moment de centraliser votre activit\u00e9 et de closer comme un pro.
                    </p>`,
                    '\u{1F4BB} Acc\u00e9der \u00e0 mon espace',
                    'https://closeos.fr/dashboard'
                ));

            } else {
                console.log(`⚠️ User not found for email ${customerEmail}. They might register later.`);
            }
            break;
        }

        // 2. FACTURE CRÉÉE (avant paiement) — Appliquer les crédits parrainage
        case 'invoice.created': {
            const invoice = event.data.object as any;
            const customerId = invoice.customer as string;
            const subscriptionId = invoice.subscription as string;

            // Ne pas traiter la première facture (c'est le checkout) ni les factures manuelles
            if (!subscriptionId || invoice.billing_reason === 'subscription_create') {
                console.log(`📄 Invoice created (initial/manual) ${invoice.id} — skip referral credits`);
                break;
            }

            console.log(`📄 Invoice created ${invoice.id} for customer ${customerId}`);

            try {
                const { data: payer } = await supabaseAdmin
                    .from('profiles')
                    .select('id, stripe_subscription_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (payer) {
                    const { data: activeRefs } = await supabaseAdmin
                        .from('referrals')
                        .select('*')
                        .eq('referrer_id', payer.id)
                        .eq('status', 'active')
                        .gt('referrer_months_remaining', 0);

                    if (activeRefs && activeRefs.length > 0) {
                        // Calculer le prix mensuel du parrain
                        let parrainMonthlyCents = 3400;
                        if (payer.stripe_subscription_id) {
                            const sub = await stripe.subscriptions.retrieve(payer.stripe_subscription_id);
                            const priceAmount = (sub as any).items?.data?.[0]?.price?.unit_amount || 3400;
                            const interval = (sub as any).items?.data?.[0]?.price?.recurring?.interval;
                            parrainMonthlyCents = interval === 'year' ? Math.round(priceAmount / 12) : priceAmount;
                        }

                        // Calculer le crédit total
                        let totalCredit = 0;
                        for (const ref of activeRefs) {
                            totalCredit += ref.referrer_reward_type === 'free_month' ? parrainMonthlyCents : 700;
                        }

                        // Plancher 18€ : le parrain ne paie jamais moins de 18€/mois
                        const maxDiscount = Math.max(0, parrainMonthlyCents - 1800);
                        const applied = Math.min(totalCredit, maxDiscount);

                        if (applied > 0) {
                            await stripe.invoiceItems.create({
                                customer: customerId,
                                amount: -applied,
                                currency: 'eur',
                                invoice: invoice.id,
                                description: `Parrainage : réduction (${activeRefs.length} filleul${activeRefs.length > 1 ? 's' : ''})`,
                            });
                            console.log(`🎁 Crédit parrain ${payer.id}: -${applied / 100}€ appliqué sur facture ${invoice.id}`);
                        }

                        // Décrémenter les mois restants
                        for (const ref of activeRefs) {
                            const newMonths = ref.referrer_months_remaining - 1;
                            await supabaseAdmin
                                .from('referrals')
                                .update({
                                    referrer_months_remaining: newMonths,
                                    status: newMonths <= 0 ? 'expired' : 'active',
                                })
                                .eq('id', ref.id);
                        }
                    }
                }
            } catch (e) {
                console.error('⚠️ Erreur crédits parrainage sur invoice.created:', e);
            }
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

            // Clear seat grace period if payment succeeded (Business side)
            const { data: bizUser } = await supabaseAdmin
                .from('business_users')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .maybeSingle();
            if (bizUser) {
                await supabaseAdmin
                    .from('business_settings')
                    .update({ seat_grace_deadline: null })
                    .eq('user_id', bizUser.id)
                    .not('seat_grace_deadline', 'is', null);
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

                await sendBrevoEmail(failedProfile.email, subject, emailWrap(
                    'Action requise', '#451a03', '#f97316',
                    title,
                    `<p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 20px;">
                        ${bodyText}
                    </p>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #f97316; border-radius: 20px; margin-bottom: 20px;">
                        <tr><td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                            <h3 style="color: #fb923c; background-image: linear-gradient(transparent, transparent); font-size: 20px; margin-top: 0; margin-bottom: 16px;">\u26A0\uFE0F Ce qu'il se passe</h3>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                                \u2022 Votre acc\u00e8s \u00e0 CloseOS est <strong style="color: #fdfdfd;">temporairement suspendu</strong>.
                            </p>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                                \u2022 Vos donn\u00e9es sont <strong style="color: #fdfdfd;">en s\u00e9curit\u00e9</strong> et ne seront pas supprim\u00e9es.
                            </p>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0;">
                                \u2022 Mettez \u00e0 jour votre moyen de paiement pour <strong style="color: #fdfdfd;">r\u00e9activer votre acc\u00e8s imm\u00e9diatement</strong>.
                            </p>
                        </td></tr>
                    </table>
                    <p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; text-align: left; margin-bottom: 10px;">
                        Si vous pensez qu'il s'agit d'une erreur, contactez-nous \u00e0 <a href="mailto:support@closeos.fr" style="color: #60a5fa; text-decoration: none;">support@closeos.fr</a>.
                    </p>`,
                    '\u{1F4B3} Mettre \u00e0 jour mon paiement',
                    'https://closeos.fr/dashboard'
                ));
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

            break;
        }

        // 3. MISE À JOUR ABONNEMENT (Annulation, Pause, Changement de plan...)
        case 'customer.subscription.updated': {
            const subscription = event.data.object as any;
            const customerId = subscription.customer as string;

            console.log(`🔄 Subscription updated: ${subscription.status}`);

            // Récupérer le plan et le cycle depuis les metadata et l'intervalle
            const updatedPlan = subscription.metadata?.plan;
            const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
            const updatedCycle = interval === 'year' ? 'yearly' : 'monthly';

            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: subscription.status,
                    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
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
            }
            break;
        }

        // 4. ABONNEMENT SUPPRIMÉ (Fin définitive)
        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;

            console.log(`🚫 Subscription deleted for customer ${customerId}`);

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

                const deleteTasks: Promise<any>[] = [];

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
            break;
        }
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
