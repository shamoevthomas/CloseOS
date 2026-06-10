// CloseOS Sign — Edge Function paiement « Payé + signé » (Stripe Connect, destination charges).
// L'argent va sur le compte Stripe du proprio (transfer_data) ; commission CloseOS 2 %.
// Actions : connect | connect-status | create-payment | confirm.
// Clé secrète Stripe lue dans public.sign_secrets (jamais exposée au client). verify_jwt=false.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const FEE_PCT = 2; // commission CloseOS

// deno-lint-ignore no-explicit-any
async function getStripe(supabase: any): Promise<Stripe | null> {
  const { data } = await supabase.from("sign_secrets").select("value").eq("name", "stripe_secret_key").maybeSingle();
  const key = (data?.value || "").trim();
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-01-27.acacia" as any, httpClient: Stripe.createFetchHttpClient() });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripe = await getStripe(supabase);
  if (!stripe) return json({ ok: false, error: "stripe_not_configured" }, 503);

  try {
    const body = await req.json();
    const action = body.action;

    // ───────── Connexion du compte Stripe du proprio ─────────
    if (action === "connect") {
      const { ownerId, email, origin } = body;
      if (!ownerId) return json({ ok: false, error: "ownerId" }, 400);
      const { data: u } = await supabase.from("sign_users").select("stripe_account_id").eq("id", ownerId).maybeSingle();
      let accountId = u?.stripe_account_id as string | undefined;
      if (!accountId) {
        const account = await stripe.accounts.create({ type: "standard", email: email || undefined });
        accountId = account.id;
        await supabase.from("sign_users").update({ stripe_account_id: accountId }).eq("id", ownerId);
      }
      const base = (origin || "https://sign.closeos.fr").replace(/\/$/, "");
      const link = await stripe.accountLinks.create({
        account: accountId,
        return_url: `${base}/sign/app/profil?tab=parametres&stripe_connected=1`,
        refresh_url: `${base}/sign/app/profil?tab=parametres`,
        type: "account_onboarding",
      });
      return json({ ok: true, url: link.url });
    }

    // ───────── Statut de connexion ─────────
    if (action === "connect-status") {
      const { ownerId } = body;
      if (!ownerId) return json({ ok: false, error: "ownerId" }, 400);
      const { data: u } = await supabase.from("sign_users").select("stripe_account_id").eq("id", ownerId).maybeSingle();
      if (!u?.stripe_account_id) return json({ ok: true, connected: false });
      const acct = await stripe.accounts.retrieve(u.stripe_account_id);
      const connected = !!acct.charges_enabled && !!acct.details_submitted;
      await supabase.from("sign_users").update({ stripe_connected: connected }).eq("id", ownerId);
      return json({ ok: true, connected });
    }

    // ───────── Création du paiement (signataire) ─────────
    if (action === "create-payment") {
      const { token } = body;
      if (!token) return json({ ok: false, error: "token" }, 400);
      const { data: c } = await supabase
        .from("sign_contracts")
        .select("id,user_id,title,status,currency,verification_method,payment_mode,payment_amount,payment_interval,payment_duration_months,payment_trial_days,payment_status,contact_id")
        .eq("access_token", token)
        .maybeSingle();
      if (!c) return json({ ok: false, error: "contract" });
      if (c.verification_method !== "pay" || !c.payment_mode || !c.payment_amount || c.payment_amount <= 0)
        return json({ ok: false, error: "no_payment" });
      if (c.status === "signed" || c.status === "paid" || c.payment_status === "paid")
        return json({ ok: false, error: "already_paid" });

      const { data: owner } = await supabase.from("sign_users").select("stripe_account_id,stripe_connected").eq("id", c.user_id).maybeSingle();
      if (!owner?.stripe_account_id || !owner.stripe_connected) return json({ ok: false, error: "owner_not_connected" });
      const destination = owner.stripe_account_id as string;
      const currency = (c.currency || "eur").toLowerCase();
      const amount = c.payment_amount as number;

      // email du payeur (contact relié) pour le reçu
      let payerEmail = "";
      if (c.contact_id) {
        const { data: ct } = await supabase.from("sign_contacts").select("email").eq("id", c.contact_id).maybeSingle();
        payerEmail = (ct?.email || "").trim();
      }

      if (c.payment_mode === "one_shot") {
        const params: any = {
          amount,
          currency,
          automatic_payment_methods: { enabled: true },
          application_fee_amount: Math.round(amount * (FEE_PCT / 100)),
          transfer_data: { destination },
          metadata: { contract_id: c.id, payment_type: "sign" },
          ...(payerEmail ? { receipt_email: payerEmail } : {}),
        };
        let pi;
        try {
          pi = await stripe.paymentIntents.create(params);
        } catch (e: any) {
          if (String(e?.message || "").includes("your own account")) {
            delete params.application_fee_amount;
            delete params.transfer_data;
            pi = await stripe.paymentIntents.create(params);
          } else throw e;
        }
        await supabase.from("sign_contracts").update({ stripe_payment_intent_id: pi.id, payment_status: "pending" }).eq("id", c.id);
        return json({ ok: true, type: "payment", client_secret: pi.client_secret, amount, currency });
      }

      // ── abonnement (destination charge) ──
      const map: Record<string, [string, number]> = { month: ["month", 1], quarter: ["month", 3], year: ["year", 1] };
      const [interval, interval_count] = map[c.payment_interval || "month"] || ["month", 1];
      let cancel_at: number | undefined;
      if (c.payment_duration_months && c.payment_duration_months > 0) {
        const d = new Date();
        d.setMonth(d.getMonth() + c.payment_duration_months);
        cancel_at = Math.floor(d.getTime() / 1000);
      }
      const customer = await stripe.customers.create(payerEmail ? { email: payerEmail } : {});
      const sub: any = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price_data: { currency, product_data: { name: c.title || "Contrat" }, unit_amount: amount, recurring: { interval: interval as any, interval_count } } }],
        application_fee_percent: FEE_PCT,
        transfer_data: { destination },
        ...(c.payment_trial_days && c.payment_trial_days > 0 ? { trial_period_days: c.payment_trial_days } : {}),
        ...(cancel_at ? { cancel_at } : {}),
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
        metadata: { contract_id: c.id, payment_type: "sign" },
      });

      let type = "", client_secret = "";
      const psi = sub.pending_setup_intent;
      if (psi && typeof psi !== "string" && psi.client_secret) {
        type = "setup";
        client_secret = psi.client_secret;
      } else {
        const inv = sub.latest_invoice;
        const pi = inv && typeof inv !== "string" ? inv.payment_intent : null;
        if (pi && typeof pi !== "string" && pi.client_secret) {
          type = "payment";
          client_secret = pi.client_secret;
        }
      }
      if (!client_secret) return json({ ok: false, error: "no_client_secret" }, 500);
      await supabase.from("sign_contracts").update({ stripe_subscription_id: sub.id, payment_status: "pending" }).eq("id", c.id);
      return json({ ok: true, type, client_secret, amount, currency });
    }

    // ───────── Confirmation (après succès inline) ─────────
    if (action === "confirm") {
      const { token } = body;
      if (!token) return json({ ok: false, error: "token" }, 400);
      const { data: c } = await supabase
        .from("sign_contracts")
        .select("id,payment_mode,payment_status,stripe_payment_intent_id,stripe_subscription_id")
        .eq("access_token", token)
        .maybeSingle();
      if (!c) return json({ ok: false, error: "contract" });
      if (c.payment_status === "paid") return json({ ok: true, already: true });

      let paid = false;
      if (c.payment_mode === "one_shot" && c.stripe_payment_intent_id) {
        const pi = await stripe.paymentIntents.retrieve(c.stripe_payment_intent_id);
        paid = pi.status === "succeeded";
      } else if (c.payment_mode === "subscription" && c.stripe_subscription_id) {
        const sub = await stripe.subscriptions.retrieve(c.stripe_subscription_id);
        paid = sub.status === "active" || sub.status === "trialing";
      }
      if (!paid) return json({ ok: false, error: "not_paid" });

      const now = new Date().toISOString();
      await supabase.from("sign_contracts").update({ status: "signed", signed_at: now, paid_at: now, payment_status: "paid" }).eq("id", c.id);
      await supabase.from("sign_signature_events").insert([
        { contract_id: c.id, event_type: "paid", metadata: { channel: "stripe", mode: c.payment_mode } },
        { contract_id: c.id, event_type: "signed", metadata: { via: "pay" } },
      ]);
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e).slice(0, 250) }, 500);
  }
});
