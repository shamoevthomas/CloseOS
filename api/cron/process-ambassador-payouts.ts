import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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
  auth: { autoRefreshToken: false, persistSession: false },
});

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-01-27.acacia' as any,
  httpClient: Stripe.createFetchHttpClient(),
});

async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'support@closeos.fr', name: 'CloseOS' },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function offlinePayoutEmail(ambName: string, ambSlug: string, ambEmail: string | null, totalEur: number, count: number): string {
  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:32px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:auto;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.06);overflow:hidden;">
  <tr><td style="padding:32px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;">
    <h1 style="margin:0 0 8px 0;font-size:22px;">💸 Versement ambassadeur à effectuer</h1>
    <p style="margin:0;opacity:0.85;font-size:14px;">Montant : <strong style="color:#34d399;">${totalEur.toFixed(2)} €</strong> · ${count} commission${count > 1 ? 's' : ''}</p>
  </td></tr>
  <tr><td style="padding:32px;color:#1e293b;">
    <h2 style="margin:0 0 12px 0;font-size:16px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Ambassadeur</h2>
    <table width="100%" style="background:#f1f5f9;border-radius:12px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;"><strong>Nom :</strong> ${ambName}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Slug :</strong> ${ambSlug}</td></tr>
      <tr><td style="padding:6px 0;"><strong>Email :</strong> ${ambEmail || '—'}</td></tr>
    </table>
    <p style="font-size:14px;color:#475569;margin:16px 0;">Méthode : virement bancaire offline (mode <code>offline</code>).<br/>
    Une fois le virement fait, les commissions sont déjà marquées comme <code>paid</code> en base — pas d'action nécessaire après le virement.</p>
  </td></tr>
</table>
</body></html>`;
}

export default async function handler(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = new Date().getUTCDate();
  const results: string[] = [];

  try {
    // ─── 1. Find ambassadors whose payout day is today ───
    const { data: ambs, error: ambErr } = await supabaseAdmin
      .from('sales_ambassadors')
      .select('id, name, slug, email, stripe_account_id, stripe_account_status, payout_method, payout_threshold_cents')
      .eq('payout_day_of_month', today);

    if (ambErr) {
      console.error('cron amb-payouts: list error', ambErr.message);
      return new Response(JSON.stringify({ error: ambErr.message }), { status: 500 });
    }

    if (!ambs || ambs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, results: [`No ambassadors with payout_day=${today}`] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    for (const amb of ambs) {
      // 2. Atomic claim: flip pending → 'processing' for this ambassador (avoids concurrent retries)
      const { data: claimed, error: claimErr } = await supabaseAdmin
        .from('sales_amb_commissions')
        .update({ status: 'processing' })
        .eq('ambassador_id', amb.id)
        .eq('status', 'pending')
        .select('id, commission_cents, stripe_invoice_id');

      if (claimErr) {
        results.push(`❌ ${amb.slug}: claim error ${claimErr.message}`);
        continue;
      }

      if (!claimed || claimed.length === 0) {
        results.push(`— ${amb.slug}: no pending`);
        continue;
      }

      const total = claimed.reduce((s, c) => s + Number(c.commission_cents || 0), 0);
      const ids = claimed.map(c => c.id);

      // 3. Threshold check
      const threshold = Number(amb.payout_threshold_cents || 0);
      if (total < threshold) {
        // Roll back to pending — try next month
        await supabaseAdmin.from('sales_amb_commissions').update({ status: 'pending' }).in('id', ids);
        results.push(`⏸ ${amb.slug}: ${total}c < threshold ${threshold}c — postponed`);
        continue;
      }

      // 4. Pay out based on method
      if (amb.payout_method === 'offline') {
        // Mark all as paid, send admin email
        const totalEur = total / 100;
        await supabaseAdmin
          .from('sales_amb_commissions')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            payout_method: 'offline',
            error_message: null,
          })
          .in('id', ids);
        await sendEmail(
          MANUAL_PAYOUT_RECIPIENT,
          `💸 Versement ambassadeur à effectuer — ${amb.name} (${totalEur.toFixed(2)} €)`,
          offlinePayoutEmail(amb.name, amb.slug, amb.email, totalEur, claimed.length)
        );
        results.push(`✉️ ${amb.slug}: offline ${totalEur.toFixed(2)}€ (${claimed.length} commissions, email envoyé)`);
        continue;
      }

      // payout_method === 'stripe'
      if (!amb.stripe_account_id || amb.stripe_account_status !== 'onboarded') {
        // Roll back to pending — wait for ambassador to onboard
        await supabaseAdmin.from('sales_amb_commissions').update({ status: 'pending' }).in('id', ids);
        results.push(`🚧 ${amb.slug}: Stripe Connect not ready (status=${amb.stripe_account_status || 'none'}) — postponed`);
        continue;
      }

      try {
        const transfer = await stripe.transfers.create({
          amount: total,
          currency: 'eur',
          destination: amb.stripe_account_id,
          description: `Versement ambassadeur ${amb.slug} (${claimed.length} commissions)`,
          metadata: {
            ambassador_id: amb.id,
            ambassador_slug: amb.slug,
            commission_count: String(claimed.length),
            payout_day: String(today),
            kind: 'scheduled_payout',
          },
        });

        await supabaseAdmin
          .from('sales_amb_commissions')
          .update({
            status: 'paid',
            stripe_transfer_id: transfer.id,
            paid_at: new Date().toISOString(),
            payout_method: 'stripe',
            error_message: null,
          })
          .in('id', ids);

        results.push(`✅ ${amb.slug}: stripe ${(total / 100).toFixed(2)}€ → ${transfer.id} (${claimed.length} commissions)`);
      } catch (e: any) {
        // Roll back to pending so it retries next time
        await supabaseAdmin
          .from('sales_amb_commissions')
          .update({ status: 'pending', error_message: e?.message || 'transfer failed' })
          .in('id', ids);
        results.push(`❌ ${amb.slug}: stripe transfer error — ${e?.message || 'unknown'}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: ambs.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('cron amb-payouts fatal:', e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || 'fatal' }), { status: 500 });
  }
}
