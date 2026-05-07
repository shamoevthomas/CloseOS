import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { type BillingCycle } from '../_lib/referral-rewards.js';

export const config = {
    runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;
const MANUAL_PAYOUT_RECIPIENT = 'shamoevthomas@gmail.com';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-01-27.acacia' as any,
    httpClient: Stripe.createFetchHttpClient(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, htmlContent: string) {
    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                to: [{ email: to }],
                subject,
                htmlContent
            })
        });
        return res.ok;
    } catch (e) {
        console.error('Email error:', e);
        return false;
    }
}

function manualPayoutEmail(amountEur: number, parrain: ProfileInfo, filleul: ProfileInfo, refId: string) {
    return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f8fafc; margin:0; padding:32px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:auto; background:#ffffff; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.06); overflow:hidden;">
  <tr><td style="padding:32px; background:linear-gradient(135deg,#0f172a,#1e293b); color:#ffffff;">
    <h1 style="margin:0 0 8px 0; font-size:22px;">🤝 Virement parrainage à effectuer</h1>
    <p style="margin:0; opacity:0.85; font-size:14px;">Montant : <strong style="color:#34d399;">${amountEur}€</strong></p>
  </td></tr>
  <tr><td style="padding:32px; color:#1e293b;">
    <h2 style="margin:0 0 12px 0; font-size:16px; color:#475569; text-transform:uppercase; letter-spacing:0.05em;">Parrain (à créditer)</h2>
    <table width="100%" style="background:#f1f5f9; border-radius:12px; padding:16px; margin-bottom:24px;">
      <tr><td style="padding:8px 12px;"><strong>Nom :</strong> ${parrain.full_name || '—'}</td></tr>
      <tr><td style="padding:8px 12px;"><strong>Email :</strong> <a href="mailto:${parrain.email}" style="color:#3b82f6;">${parrain.email}</a></td></tr>
      <tr><td style="padding:8px 12px;"><strong>Téléphone :</strong> ${parrain.phone || '—'}</td></tr>
    </table>
    <h2 style="margin:0 0 12px 0; font-size:16px; color:#475569; text-transform:uppercase; letter-spacing:0.05em;">Filleul (déclencheur)</h2>
    <table width="100%" style="background:#f1f5f9; border-radius:12px; padding:16px; margin-bottom:24px;">
      <tr><td style="padding:8px 12px;"><strong>Nom :</strong> ${filleul.full_name || '—'}</td></tr>
      <tr><td style="padding:8px 12px;"><strong>Email :</strong> <a href="mailto:${filleul.email}" style="color:#3b82f6;">${filleul.email}</a></td></tr>
      <tr><td style="padding:8px 12px;"><strong>Téléphone :</strong> ${filleul.phone || '—'}</td></tr>
    </table>
    <p style="font-size:12px; color:#94a3b8; margin:16px 0 0 0;">Référence : <code>${refId}</code></p>
  </td></tr>
</table>
</body></html>`;
}

interface ProfileInfo {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    stripe_subscription_id?: string | null;
    subscription_status?: string | null;
    billing_cycle?: BillingCycle | null;
}

interface ReferralRow {
    id: string;
    referrer_id: string;
    referee_id: string;
    referee_billing_cycle: string;
    referrer_billing_cycle: string | null;
    coupon_id: string | null;
    manual_payout_amount_cents: number | null;
    scheduled_at: string;
    status: string;
}

async function fetchProfile(id: string): Promise<ProfileInfo | null> {
    const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, phone, stripe_subscription_id, subscription_status, billing_cycle')
        .eq('id', id)
        .single();
    return data;
}

// Calcule la durée d'une récompense en jours selon les cycles
function rewardDurationDays(parrainCycle: BillingCycle, filleulCycle: BillingCycle): number {
    if (parrainCycle === 'monthly') return 60;       // coupon repeating 2 mois
    if (parrainCycle === 'quarterly') return 90;     // 1 trimestre
    // Annuel : si coupon (filleul mensuel) → 365j, sinon récompense instantanée (virement)
    if (filleulCycle === 'monthly') return 365;
    return 0;
}

async function activateReferral(ref: ReferralRow): Promise<{ ok: boolean; reason?: string }> {
    const referrer = await fetchProfile(ref.referrer_id);
    const referee = await fetchProfile(ref.referee_id);

    if (!referrer) return { ok: false, reason: 'referrer not found' };
    if (!referee) return { ok: false, reason: 'referee not found' };

    const parrainCycle = (ref.referrer_billing_cycle as BillingCycle) || 'monthly';
    const filleulCycle = (ref.referee_billing_cycle as BillingCycle) || 'monthly';
    const durationDays = rewardDurationDays(parrainCycle, filleulCycle);
    const rewardEndsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // Cas 1 : coupon Stripe à appliquer sur la subscription du parrain
    if (ref.coupon_id) {
        if (!referrer.stripe_subscription_id) {
            return { ok: false, reason: 'parrain sans subscription Stripe' };
        }
        try {
            // Stripe Subscriptions: appliquer un coupon via l'API "discounts"
            await stripe.subscriptions.update(referrer.stripe_subscription_id, {
                coupon: ref.coupon_id,
            } as any);

            await supabaseAdmin.from('referrals').update({
                status: 'active',
                activated_at: new Date().toISOString(),
                coupon_applied_at: new Date().toISOString(),
                reward_ends_at: rewardEndsAt,
            }).eq('id', ref.id);

            console.log(`🎁 Coupon ${ref.coupon_id} appliqué au parrain ${referrer.id} (sub ${referrer.stripe_subscription_id}). Fin: ${rewardEndsAt}`);
            return { ok: true };
        } catch (e: any) {
            console.error(`⚠️ Erreur Stripe sur application coupon ${ref.coupon_id}:`, e.message);
            return { ok: false, reason: e.message };
        }
    }

    // Cas 2 : virement manuel — envoyer email à l'admin
    if (ref.manual_payout_amount_cents) {
        const amountEur = ref.manual_payout_amount_cents / 100;
        const sent = await sendEmail(
            MANUAL_PAYOUT_RECIPIENT,
            `🤝 Virement parrainage à effectuer — ${amountEur}€`,
            manualPayoutEmail(amountEur, referrer, referee, ref.id)
        );

        if (sent) {
            await supabaseAdmin.from('referrals').update({
                status: 'active',
                activated_at: new Date().toISOString(),
                manual_email_sent_at: new Date().toISOString(),
                reward_ends_at: new Date().toISOString(), // récompense instantanée → libère la queue
            }).eq('id', ref.id);
            console.log(`📧 Email virement ${amountEur}€ envoyé pour parrainage ${ref.id}`);
            return { ok: true };
        }
        return { ok: false, reason: 'email send failed' };
    }

    return { ok: false, reason: 'aucun coupon ni virement défini' };
}

// ─── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const now = new Date().toISOString();
    const results: string[] = [];

    try {
        // ─── ÉTAPE 1 : clore les récompenses arrivées à terme (active → completed) ───
        const { data: endedRefs } = await supabaseAdmin
            .from('referrals')
            .select('id, referrer_id')
            .eq('status', 'active')
            .lte('reward_ends_at', now);

        for (const ref of (endedRefs || []) as { id: string; referrer_id: string }[]) {
            await supabaseAdmin.from('referrals').update({ status: 'completed' }).eq('id', ref.id);
            results.push(`completed → ${ref.id}`);

            // Activer la suivante en file d'attente pour ce parrain (FIFO)
            const { data: nextQueued } = await supabaseAdmin
                .from('referrals')
                .select('*')
                .eq('referrer_id', ref.referrer_id)
                .eq('status', 'queued')
                .order('scheduled_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (nextQueued) {
                const r = await activateReferral(nextQueued as ReferralRow);
                results.push(`queue→active ${nextQueued.id}: ${r.ok ? 'OK' : 'FAIL ' + r.reason}`);
            }
        }

        // ─── ÉTAPE 2 : traiter les pending arrivés à échéance (J+14) ───
        const { data: dueRefs } = await supabaseAdmin
            .from('referrals')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_at', now);

        for (const ref of (dueRefs || []) as ReferralRow[]) {
            // Anti-fraude : le filleul a-t-il toujours une subscription active ?
            const referee = await fetchProfile(ref.referee_id);
            const refereeSubActive = referee?.subscription_status === 'active' || referee?.subscription_status === 'trialing';

            if (!refereeSubActive) {
                await supabaseAdmin.from('referrals').update({
                    status: 'canceled',
                    canceled_reason: 'subscription_canceled',
                }).eq('id', ref.id);
                results.push(`canceled (filleul inactif) → ${ref.id}`);
                continue;
            }

            // Vérifier la file : une autre récompense déjà active pour ce parrain ?
            const { data: alreadyActive } = await supabaseAdmin
                .from('referrals')
                .select('id')
                .eq('referrer_id', ref.referrer_id)
                .eq('status', 'active')
                .limit(1);

            if (alreadyActive && alreadyActive.length > 0) {
                await supabaseAdmin.from('referrals').update({ status: 'queued' }).eq('id', ref.id);
                results.push(`queued → ${ref.id}`);
                continue;
            }

            // Activer maintenant
            const r = await activateReferral(ref);
            results.push(`activate ${ref.id}: ${r.ok ? 'OK' : 'FAIL ' + r.reason}`);
        }

    } catch (e: any) {
        console.error('process-referrals error:', e);
        results.push(`ERROR: ${e.message}`);
    }

    console.log('process-referrals results:', results);
    return new Response(JSON.stringify({ results }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
