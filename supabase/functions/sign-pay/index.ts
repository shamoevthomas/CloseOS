// CloseOS Sign — Edge Function paiement « Payé + signé » (Stripe Connect, destination charges).
// MULTI-SIGNATAIRE : paiement résolu PAR SIGNATAIRE (token). Paiement DÉCOUPLÉ de la vérif.
// Journalise (append-only, IP serveur) : paid, consent, signed, completed. Commission CloseOS 2 %.
// Actions : connect | connect-status | create-payment | confirm.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bearerToken, internalEmailHeaders, safeOrigin } from "../_shared/sign-guards.ts";
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clientIp = (req: Request): string | null => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
const FEE_PCT = 2;
const UNLOCK_BASE = "https://sign.closeos.fr";
// Moyens de paiement proposés (one-shot). « card » embarque Apple Pay + Google Pay automatiquement.
const PAY_METHODS = ["card", "link", "amazon_pay", "klarna"];
const OPTIONAL_METHODS = ["link", "amazon_pay", "klarna"]; // retirables si non activés sur le compte
// Abonnement (récurrent) : seules card + link gèrent le prélèvement répété.
const SUB_METHODS = ["card", "link"];

// Secret partagé avec le relais email (api/email.ts) : variable d'environnement, sinon sign_secrets.
let EMAIL_HEADERS: Record<string, string> | null = null;
// deno-lint-ignore no-explicit-any
async function loadEmailHeaders(supabase: any): Promise<void> {
  if (EMAIL_HEADERS) return;
  let secret = Deno.env.get("INTERNAL_EMAIL_SECRET") || "";
  if (!secret) {
    const { data } = await supabase.from("sign_secrets").select("value").eq("name", "internal_email_secret").maybeSingle();
    secret = (data?.value || "").trim();
  }
  EMAIL_HEADERS = internalEmailHeaders(secret || null);
}
const emailHeaders = () => EMAIL_HEADERS ?? internalEmailHeaders(null);

// deno-lint-ignore no-explicit-any
async function getStripe(supabase: any): Promise<Stripe | null> {
  const { data } = await supabase.from("sign_secrets").select("value").eq("name", "stripe_secret_key").maybeSingle();
  const key = (data?.value || "").trim();
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-01-27.acacia" as any, httpClient: Stripe.createFetchHttpClient() });
}
function requiredChannels(method: string): string[] { return method === "email_sms" ? ["email", "sms"] : method === "sms" ? ["sms"] : method === "email" ? ["email"] : []; }
function genToken(): string { return crypto.randomUUID().replace(/-/g, ""); }

// deno-lint-ignore no-explicit-any
async function resolveSigner(supabase: any, token: string): Promise<{ contract: any; signer: any } | null> {
  const { data: signer } = await supabase.from("sign_contract_signers").select("*").eq("access_token", token).maybeSingle();
  let contractId = signer?.contract_id ?? null;
  if (!contractId) { const { data: legacy } = await supabase.from("sign_contracts").select("id").eq("access_token", token).maybeSingle(); contractId = legacy?.id ?? null; }
  if (!contractId) return null;
  const { data: contract } = await supabase.from("sign_contracts").select("id,user_id,title,status,signing_order,currency,verification_method,payment_enabled,payment_mode,payment_amount,payment_interval,payment_duration_months,payment_trial_days").eq("id", contractId).maybeSingle();
  if (!contract) return null;
  let s = signer;
  if (!s) { const { data: s1 } = await supabase.from("sign_contract_signers").select("*").eq("contract_id", contractId).eq("signer_index", 1).maybeSingle(); s = s1; }
  if (!s) return null;
  return { contract, signer: s };
}

// Crée un PaymentIntent en retirant automatiquement toute méthode optionnelle non activée sur
// le compte (sinon Stripe rejette TOUT le paiement). Gère aussi le repli « your own account ».
// deno-lint-ignore no-explicit-any
async function createPaymentIntentResilient(stripe: Stripe, baseParams: any, destination: string | null): Promise<any> {
  let methods = [...PAY_METHODS];
  let useConnect = !!destination;
  const build = (): any => {
    const p: any = { ...baseParams, payment_method_types: methods };
    if (useConnect && destination) { p.application_fee_amount = Math.round((baseParams.amount as number) * (FEE_PCT / 100)); p.transfer_data = { destination }; }
    return p;
  };
  let pi: any = null; let lastErr: any = null;
  for (let i = 0; i < 6 && !pi; i++) {
    try { pi = await stripe.paymentIntents.create(build()); }
    catch (e: any) {
      lastErr = e; const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("your own account")) { useConnect = false; continue; }
      const bad = OPTIONAL_METHODS.find((m) => methods.includes(m) && msg.includes(m) && /(invalid|activate|not activated|unsupported)/.test(msg));
      if (bad) { methods = methods.filter((m) => m !== bad); continue; }
      throw e;
    }
  }
  if (!pi) throw lastErr;
  return pi;
}

// deno-lint-ignore no-explicit-any
async function verificationSatisfied(supabase: any, contract: any, signer: any): Promise<boolean> {
  const need = requiredChannels(contract.verification_method);
  if (need.length === 0) return true;
  const { data: evs } = await supabase.from("sign_signature_events").select("metadata").eq("contract_id", contract.id).eq("event_type", "otp_verified");
  const done = new Set((evs ?? []).filter((e: any) => (e?.metadata?.signer_index ?? 1) === signer.signer_index).map((e: any) => e?.metadata?.channel).filter(Boolean));
  return need.every((ch) => done.has(ch));
}
// deno-lint-ignore no-explicit-any
async function isSignerTurn(supabase: any, contract: any, signer: any): Promise<boolean> {
  if (contract.signing_order !== "sequential") return true;
  const { count } = await supabase.from("sign_contract_signers").select("*", { count: "exact", head: true }).eq("contract_id", contract.id).lt("signer_index", signer.signer_index).neq("status", "signed");
  return (count || 0) === 0;
}

function signInviteHtml(title: string, link: string, name: string): string {
  return `<div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid #3A4242;border-radius:12px;overflow:hidden;"><tr><td style="padding:28px 32px 8px;"><span style="color:#F3F4F6;font-size:18px;font-weight:700;">CloseOS <span style="color:#CEFF8F;">Sign</span></span></td></tr><tr><td style="padding:8px 32px 0;"><h1 style="color:#ffffff;font-size:22px;margin:12px 0 8px;">Vous avez un document à signer</h1><p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 4px;">Bonjour ${name || ""},<br/>Vous êtes invité(e) à signer : <strong style="color:#F3F4F6;">${title}</strong>.</p></td></tr><tr><td style="padding:24px 32px;"><a href="${link}" style="display:inline-block;background:#CEFF8F;color:#191E1E;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;">Consulter &amp; signer</a></td></tr></table></td></tr></table></div>`;
}
async function postEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
  try { const res = await fetch("https://close-os.vercel.app/api/send-email", { method: "POST", headers: emailHeaders(), body: JSON.stringify({ sender: { email: "support@closeos.fr", name: "CloseOS Sign" }, to: [{ email: to }], subject, htmlContent }) }); return res.ok; } catch { return false; }
}

// deno-lint-ignore no-explicit-any
async function advanceAfterSignerDone(supabase: any, contract: any, signer: any, ip: string | null) {
  const nowIso = new Date().toISOString();
  await supabase.from("sign_contract_signers").update({ status: "signed", signed_at: nowIso, paid_at: nowIso, payment_status: "paid" }).eq("id", signer.id);
  await supabase.from("sign_signature_events").insert([
    { contract_id: contract.id, event_type: "paid", email: signer.email || null, ip_address: ip, metadata: { channel: "stripe", signer_index: signer.signer_index, txn: signer.stripe_payment_intent_id || signer.stripe_subscription_id || null, mode: contract.payment_mode } },
    { contract_id: contract.id, event_type: "signed", email: signer.email || null, ip_address: ip, metadata: { via: "pay", signer_index: signer.signer_index } },
  ]);
  if (contract.signing_order === "sequential") {
    const { data: next } = await supabase.from("sign_contract_signers").select("id,signer_index,email,name,access_token").eq("contract_id", contract.id).eq("status", "pending").order("signer_index", { ascending: true }).limit(1).maybeSingle();
    if (next) {
      const token = next.access_token || genToken();
      await supabase.from("sign_contract_signers").update({ access_token: token, status: "sent", sent_at: nowIso }).eq("id", next.id);
      if (next.email) { const link = `${UNLOCK_BASE}/sign/s/${token}`; await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "sent", email: next.email, metadata: { signer_index: next.signer_index } }); await postEmail(next.email, `À signer : ${contract.title || "Votre contrat"}`, signInviteHtml(contract.title || "Votre contrat", link, next.name || "")); }
    }
  }
  const { data: all } = await supabase.from("sign_contract_signers").select("status,payment_required,payment_status").eq("contract_id", contract.id);
  const rows = all ?? [];
  const allSigned = rows.length > 0 && rows.every((r: any) => r.status === "signed");
  if (allSigned && contract.status !== "signed" && contract.status !== "paid") {
    const payers = rows.filter((r: any) => r.payment_required);
    const allPaid = payers.length > 0 && payers.every((r: any) => r.payment_status === "paid");
    const patch: any = { status: "signed", signed_at: nowIso };
    if (allPaid) { patch.payment_status = "paid"; patch.paid_at = nowIso; }
    await supabase.from("sign_contracts").update(patch).eq("id", contract.id);
    await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "completed", ip_address: ip, metadata: { signers: rows.length } });
  }
  return allSigned;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripe = await getStripe(supabase);
  if (!stripe) return json({ ok: false, error: "stripe_not_configured" }, 503);
  await loadEmailHeaders(supabase);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  try {
    const body = await req.json();
    const action = body.action;

    // Connexion Stripe : réservée au propriétaire connecté. L'ownerId du corps n'est plus pris en
    // compte (n'importe qui pouvait lier un compte Stripe au compte d'un autre).
    if (action === "connect" || action === "connect-status") {
      const jwt = bearerToken(req.headers);
      const { data: auth } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
      const sessionUser = auth?.user?.id ?? null;
      if (!sessionUser) return json({ ok: false, error: "unauthorized" }, 401);
      const { data: isOwner } = await supabase.from("sign_users").select("id").eq("id", sessionUser).maybeSingle();
      if (!isOwner) return json({ ok: false, error: "unauthorized" }, 403);
      body.ownerId = sessionUser;
    }

    if (action === "connect") {
      const { ownerId, email, origin } = body;
      const { data: u } = await supabase.from("sign_users").select("stripe_account_id").eq("id", ownerId).maybeSingle();
      let accountId = u?.stripe_account_id as string | undefined;
      if (!accountId) { const account = await stripe.accounts.create({ type: "standard", email: email || undefined }); accountId = account.id; await supabase.from("sign_users").update({ stripe_account_id: accountId }).eq("id", ownerId); }
      const base = safeOrigin(origin);
      const link = await stripe.accountLinks.create({ account: accountId, return_url: `${base}/sign/app/profil?tab=parametres&stripe_connected=1`, refresh_url: `${base}/sign/app/profil?tab=parametres`, type: "account_onboarding" });
      return json({ ok: true, url: link.url });
    }
    if (action === "connect-status") {
      const { ownerId } = body;
      const { data: u } = await supabase.from("sign_users").select("stripe_account_id").eq("id", ownerId).maybeSingle();
      if (!u?.stripe_account_id) return json({ ok: true, connected: false });
      const acct = await stripe.accounts.retrieve(u.stripe_account_id);
      const connected = !!acct.charges_enabled && !!acct.details_submitted;
      await supabase.from("sign_users").update({ stripe_connected: connected }).eq("id", ownerId);
      return json({ ok: true, connected });
    }

    if (action === "create-payment") {
      const { token } = body;
      if (!token) return json({ ok: false, error: "token" }, 400);
      const resolved = await resolveSigner(supabase, token);
      if (!resolved) return json({ ok: false, error: "contract" });
      const { contract: c, signer } = resolved;
      if (!c.payment_enabled || !signer.payment_required) return json({ ok: false, error: "no_payment" });
      if (!c.payment_mode || !c.payment_amount || c.payment_amount <= 0) return json({ ok: false, error: "no_payment" });
      if (signer.status === "signed" || signer.payment_status === "paid") return json({ ok: false, error: "already_paid" });
      if (!(await isSignerTurn(supabase, c, signer))) return json({ ok: false, error: "not_your_turn" });
      const { data: owner } = await supabase.from("sign_users").select("stripe_account_id,stripe_connected").eq("id", c.user_id).maybeSingle();
      if (!owner?.stripe_account_id || !owner.stripe_connected) return json({ ok: false, error: "owner_not_connected" });
      const destination = owner.stripe_account_id as string;
      const currency = (c.currency || "eur").toLowerCase();
      const amount = c.payment_amount as number;
      let payerEmail = (signer.email || "").trim();
      if (!payerEmail && signer.contact_id) { const { data: ct } = await supabase.from("sign_contacts").select("email").eq("id", signer.contact_id).maybeSingle(); payerEmail = (ct?.email || "").trim(); }
      if (c.payment_mode === "one_shot") {
        const baseParams: any = { amount, currency, metadata: { contract_id: c.id, signer_id: signer.id, signer_index: signer.signer_index, payment_type: "sign" }, ...(payerEmail ? { receipt_email: payerEmail } : {}) };
        const pi = await createPaymentIntentResilient(stripe, baseParams, destination);
        await supabase.from("sign_contract_signers").update({ stripe_payment_intent_id: pi.id, payment_status: "pending" }).eq("id", signer.id);
        return json({ ok: true, type: "payment", client_secret: pi.client_secret, amount, currency });
      }
      const map: Record<string, [string, number]> = { month: ["month", 1], quarter: ["month", 3], year: ["year", 1] };
      const [interval, interval_count] = map[c.payment_interval || "month"] || ["month", 1];
      let cancel_at: number | undefined;
      if (c.payment_duration_months && c.payment_duration_months > 0) { const d = new Date(); d.setMonth(d.getMonth() + c.payment_duration_months); cancel_at = Math.floor(d.getTime() / 1000); }
      const customer = await stripe.customers.create(payerEmail ? { email: payerEmail } : {});
      const sub: any = await stripe.subscriptions.create({ customer: customer.id, items: [{ price_data: { currency, product_data: { name: c.title || "Contrat" }, unit_amount: amount, recurring: { interval: interval as any, interval_count } } }], application_fee_percent: FEE_PCT, transfer_data: { destination }, ...(c.payment_trial_days && c.payment_trial_days > 0 ? { trial_period_days: c.payment_trial_days } : {}), ...(cancel_at ? { cancel_at } : {}), payment_behavior: "default_incomplete", payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: SUB_METHODS }, expand: ["latest_invoice.payment_intent", "pending_setup_intent"], metadata: { contract_id: c.id, signer_id: signer.id, signer_index: signer.signer_index, payment_type: "sign" } });
      let type = "", client_secret = "";
      const psi = sub.pending_setup_intent;
      if (psi && typeof psi !== "string" && psi.client_secret) { type = "setup"; client_secret = psi.client_secret; } else { const inv = sub.latest_invoice; const pi = inv && typeof inv !== "string" ? inv.payment_intent : null; if (pi && typeof pi !== "string" && pi.client_secret) { type = "payment"; client_secret = pi.client_secret; } }
      if (!client_secret) return json({ ok: false, error: "no_client_secret" }, 500);
      await supabase.from("sign_contract_signers").update({ stripe_subscription_id: sub.id, payment_status: "pending" }).eq("id", signer.id);
      return json({ ok: true, type, client_secret, amount, currency });
    }

    if (action === "confirm") {
      const { token } = body;
      if (!token) return json({ ok: false, error: "token" }, 400);
      const resolved = await resolveSigner(supabase, token);
      if (!resolved) return json({ ok: false, error: "contract" });
      const { contract, signer } = resolved;
      if (signer.payment_status === "paid" && signer.status === "signed") return json({ ok: true, already: true });
      let paid = false;
      if (contract.payment_mode === "one_shot" && signer.stripe_payment_intent_id) { const pi = await stripe.paymentIntents.retrieve(signer.stripe_payment_intent_id); paid = pi.status === "succeeded"; }
      else if (contract.payment_mode === "subscription" && signer.stripe_subscription_id) { const sub = await stripe.subscriptions.retrieve(signer.stripe_subscription_id); paid = sub.status === "active" || sub.status === "trialing"; }
      if (!paid) return json({ ok: false, error: "not_paid" });
      if (!(await verificationSatisfied(supabase, contract, signer))) return json({ ok: false, error: "not_verified" });
      if (body.consent) await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "consent", email: signer.email || null, ip_address: ip, user_agent: ua, metadata: { signer_index: signer.signer_index, text: typeof body.consent === "string" ? body.consent : "J'ai lu et j'accepte ce document" } });
      const allSigned = await advanceAfterSignerDone(supabase, contract, signer, ip);
      return json({ ok: true, allSigned });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e).slice(0, 250) }, 500);
  }
});
