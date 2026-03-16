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

                        // Mettre à jour referred_by sur le profil du filleul
                        await supabaseAdmin
                            .from('profiles')
                            .update({ referred_by: internalReferrerId })
                            .eq('id', profile.id);

                        console.log(`🤝 Parrainage enregistré: ${internalReferrerId} → ${profile.id} (${isYearly ? 'annuel' : 'mensuel'})`);
                    }
                }
            } else {
                console.log(`⚠️ User not found for email ${customerEmail}. They might register later.`);
            }
            break;
        }

        // 1b. CRÉDITS PARRAINAGE SUR FACTURE (avant paiement)
        case 'invoice.created': {
            const invoice = event.data.object as any;
            const customerId = invoice.customer as string;
            const subscriptionId = invoice.subscription as string;

            // Ne traiter que les factures d'abonnement récurrentes (pas la première)
            if (!subscriptionId || invoice.billing_reason === 'subscription_create') break;

            // Trouver le parrain
            const { data: parrain } = await supabaseAdmin
                .from('profiles')
                .select('id, stripe_customer_id, billing_cycle')
                .eq('stripe_customer_id', customerId)
                .single();

            if (!parrain) break;

            // Trouver les parrainages actifs avec des mois restants
            const { data: activeReferrals } = await supabaseAdmin
                .from('referrals')
                .select('*')
                .eq('referrer_id', parrain.id)
                .eq('status', 'active')
                .gt('referrer_months_remaining', 0);

            if (!activeReferrals || activeReferrals.length === 0) break;

            // Calculer le crédit total
            let totalDiscountCents = 0;
            for (const ref of activeReferrals) {
                if (ref.referrer_reward_type === 'free_month') {
                    // 1 mois offert = prix mensuel du parrain
                    // Pour annuel: on prend le prix mensuel équivalent
                    const sub = await stripe.subscriptions.retrieve(subscriptionId);
                    const priceAmount = (sub as any).items?.data?.[0]?.price?.unit_amount || 3400;
                    const interval = (sub as any).items?.data?.[0]?.price?.recurring?.interval;
                    const monthlyEquiv = interval === 'year' ? Math.round(priceAmount / 12) : priceAmount;
                    totalDiscountCents += monthlyEquiv;
                } else {
                    // -7€ par mois
                    totalDiscountCents += 700;
                }
            }

            // Plancher 18€/mois : calculer le max déductible
            const invoiceSubtotal = invoice.subtotal || 0; // en centimes
            const isYearlyInvoice = invoiceSubtotal > 10000; // > 100€ = annuel
            const floorCents = isYearlyInvoice ? 1800 * 12 : 1800; // 18€/mois ou 216€/an
            const maxDiscount = Math.max(0, invoiceSubtotal - floorCents);
            const appliedDiscount = Math.min(totalDiscountCents, maxDiscount);

            if (appliedDiscount > 0) {
                // Ajouter un item négatif sur la facture
                await stripe.invoiceItems.create({
                    customer: customerId,
                    amount: -appliedDiscount,
                    currency: 'eur',
                    description: `Réduction parrainage (${activeReferrals.length} filleul${activeReferrals.length > 1 ? 's' : ''})`,
                    invoice: invoice.id,
                });

                console.log(`🎁 Parrain ${parrain.id}: -${appliedDiscount / 100}€ appliqué (${activeReferrals.length} parrainages)`);
            }

            // Décrémenter les mois restants
            for (const ref of activeReferrals) {
                const newMonths = ref.referrer_months_remaining - 1;
                await supabaseAdmin
                    .from('referrals')
                    .update({
                        referrer_months_remaining: newMonths,
                        status: newMonths <= 0 ? 'expired' : 'active',
                    })
                    .eq('id', ref.id);
            }
            break;
        }

        // 2. PAIEMENT RÉCURRENT RÉUSSI
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object as any;
            const subscriptionId = invoice.subscription as string;
            const customerId = invoice.customer as string;

            console.log(`💸 Payment succeeded for invoice ${invoice.id}`);

            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: 'active',
                    current_period_end: new Date((invoice.lines.data[0].period.end * 1000)).toISOString()
                })
                .eq('stripe_customer_id', customerId);
            break;
        }

        // 2b. PAIEMENT RÉCURRENT ÉCHOUÉ
        case 'invoice.payment_failed': {
            const invoice = event.data.object as any;
            const customerId = invoice.customer as string;

            console.log(`❌ Payment failed for invoice ${invoice.id}`);

            await supabaseAdmin
                .from('profiles')
                .update({ subscription_status: 'past_due' })
                .eq('stripe_customer_id', customerId);
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
