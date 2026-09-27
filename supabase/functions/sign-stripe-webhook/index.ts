// CloseOS Sign — Webhook Stripe : SUIVI DES ABONNEMENTS (observation pure).
// Ne modifie JAMAIS la validité d'un contrat, le statut 'signed', ni le certificat. Il ENREGISTRE
// seulement les paiements récurrents (+ one-shot) pour : (a) la commission 2% de CloseOS dans le temps,
// (b) l'état d'abonnement affiché au propriétaire. Sécurité : signature Stripe vérifiée (whsec) ;
// idempotence par event.id ; service_role ; rien d'exposé à anon.
//
// Destination charges → abonnements/factures sur le compte PLATEFORME → endpoint webhook plateforme.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";

const FEE_PCT = 2;
const sid = (x: any): string | null => (typeof x === "string" ? x : x?.id ?? null);
const toIso = (unix?: number | null): string | null => (unix ? new Date(unix * 1000).toISOString() : null);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Secrets : clé Stripe (init) + secret webhook (vérification de signature)
  const { data: secrets } = await supabase.from("sign_secrets").select("name,value").in("name", ["stripe_secret_key", "stripe_webhook_secret"]);
  const map: Record<string, string> = Object.fromEntries((secrets ?? []).map((r: any) => [r.name, (r.value || "").trim()]));
  if (!map.stripe_secret_key || !map.stripe_webhook_secret) return new Response(JSON.stringify({ ok: false, error: "webhook_not_configured" }), { status: 503 });

  const stripe = new Stripe(map.stripe_secret_key, { apiVersion: "2025-01-27.acacia" as any, httpClient: Stripe.createFetchHttpClient() });

  // 1) Vérifier la signature Stripe sur le CORPS BRUT (rejet si non signé / invalide)
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    if (!sig) throw new Error("no_signature");
    event = await stripe.webhooks.constructEventAsync(body, sig, map.stripe_webhook_secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "bad_signature", detail: String((e as any)?.message || e).slice(0, 120) }), { status: 400 });
  }

  // 2) Idempotence : on « pose » l'event.id ; si déjà vu → 200 sans retraiter
  const { data: gate } = await supabase.from("sign_webhook_events").upsert({ stripe_event_id: event.id, type: event.type }, { onConflict: "stripe_event_id", ignoreDuplicates: true }).select();
  if (!gate || gate.length === 0) return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });

  // helpers
  const finish = async (matched: boolean, note: string | null, objectId: string | null, payload?: unknown) => {
    await supabase.from("sign_webhook_events").update({ matched, note, object_id: objectId, payload: payload ?? null }).eq("stripe_event_id", event.id);
    return new Response(JSON.stringify({ ok: true, matched, note }), { status: 200 });
  };
  // deno-lint-ignore no-explicit-any
  const signerBySub = async (subId: string | null): Promise<any | null> => {
    if (!subId) return null;
    const { data } = await supabase.from("sign_contract_signers").select("id,contract_id").eq("stripe_subscription_id", subId).maybeSingle();
    return data ?? null;
  };
  // deno-lint-ignore no-explicit-any
  const signerByPI = async (piId: string | null): Promise<any | null> => {
    if (!piId) return null;
    const { data } = await supabase.from("sign_contract_signers").select("id,contract_id").eq("stripe_payment_intent_id", piId).maybeSingle();
    return data ?? null;
  };
  // deno-lint-ignore no-explicit-any
  const ledger = async (signer: any, fields: Record<string, any>) =>
    supabase.from("sign_subscription_events").upsert(
      { stripe_event_id: event.id, contract_id: signer.contract_id, signer_id: signer.id, occurred_at: toIso(event.created), ...fields },
      { onConflict: "stripe_event_id", ignoreDuplicates: true },
    );
  // deno-lint-ignore no-explicit-any
  const setSignerState = async (signerId: string, patch: Record<string, any>) => supabase.from("sign_contract_signers").update(patch).eq("id", signerId);

  try {
    // deno-lint-ignore no-explicit-any
    const obj = event.data.object as any;

    if (event.type === "invoice.paid") {
      const subId = sid(obj.subscription);
      const signer = await signerBySub(subId);
      if (!signer) return finish(false, "unmatched", subId, { kind: "invoice.paid", subscription: subId });
      const amount = obj.amount_paid ?? 0;
      const commission = obj.application_fee_amount ?? Math.round(amount * (FEE_PCT / 100));
      const line = obj.lines?.data?.[0]?.period;
      await ledger(signer, {
        subscription_id: subId, invoice_id: obj.id, payment_intent_id: sid(obj.payment_intent),
        type: "paid", billing_reason: obj.billing_reason ?? null,
        amount_cents: amount, currency: obj.currency ?? "eur", commission_cents: commission,
        period_start: toIso(line?.start ?? obj.period_start), period_end: toIso(line?.end ?? obj.period_end),
      });
      await setSignerState(signer.id, { subscription_status: "active", last_payment_at: toIso(event.created), last_payment_status: "paid" });
      return finish(true, obj.billing_reason ?? "paid", subId);
    }

    if (event.type === "invoice.payment_failed") {
      const subId = sid(obj.subscription);
      const signer = await signerBySub(subId);
      if (!signer) return finish(false, "unmatched", subId, { kind: "invoice.payment_failed", subscription: subId });
      await ledger(signer, {
        subscription_id: subId, invoice_id: obj.id, payment_intent_id: sid(obj.payment_intent),
        type: "failed", billing_reason: obj.billing_reason ?? null,
        amount_cents: obj.amount_due ?? 0, currency: obj.currency ?? "eur", commission_cents: 0,
      });
      await setSignerState(signer.id, { subscription_status: "past_due", last_payment_at: toIso(event.created), last_payment_status: "failed" });
      return finish(true, "failed", subId);
    }

    if (event.type === "customer.subscription.deleted") {
      const subId = obj.id;
      const signer = await signerBySub(subId);
      if (!signer) return finish(false, "unmatched", subId, { kind: "subscription.deleted", subscription: subId });
      await ledger(signer, { subscription_id: subId, type: "canceled", currency: obj.currency ?? "eur" });
      await setSignerState(signer.id, { subscription_status: "canceled" });
      return finish(true, "canceled", subId);
    }

    if (event.type === "customer.subscription.updated") {
      const subId = obj.id;
      const signer = await signerBySub(subId);
      if (!signer) return finish(false, "unmatched", subId, { kind: "subscription.updated", subscription: subId });
      await setSignerState(signer.id, { subscription_status: obj.status ?? null }); // état courant seulement (pas de ligne registre)
      return finish(true, `status:${obj.status}`, subId);
    }

    if (event.type === "payment_intent.succeeded") {
      // Les PI rattachés à une facture d'abonnement sont déjà couverts par invoice.paid → on ignore.
      if (sid(obj.invoice)) return finish(false, "ignored_invoice_pi", sid(obj.invoice));
      // One-shot : uniquement nos paiements (metadata payment_type='sign')
      if (obj.metadata?.payment_type !== "sign") return finish(false, "unmatched_other_product", obj.id, { kind: "payment_intent.succeeded" });
      const signer = (await signerByPI(obj.id)) ?? (obj.metadata?.signer_id ? { id: obj.metadata.signer_id, contract_id: obj.metadata.contract_id } : null);
      if (!signer) return finish(false, "unmatched", obj.id, { kind: "payment_intent.succeeded", pi: obj.id, metadata: obj.metadata });
      const amount = obj.amount_received ?? obj.amount ?? 0;
      const commission = obj.application_fee_amount ?? Math.round(amount * (FEE_PCT / 100));
      await ledger(signer, {
        payment_intent_id: obj.id, type: "paid", billing_reason: "one_shot",
        amount_cents: amount, currency: obj.currency ?? "eur", commission_cents: commission,
      });
      await setSignerState(signer.id, { last_payment_at: toIso(event.created), last_payment_status: "paid" });
      return finish(true, "one_shot", obj.id);
    }

    return finish(false, "ignored_type", null); // type non géré → 200, pas de retry
  } catch (e) {
    // On marque l'event comme traité (idempotence déjà posée) mais on signale l'erreur côté log technique.
    await supabase.from("sign_webhook_events").update({ matched: false, note: `error:${String((e as any)?.message || e).slice(0, 120)}` }).eq("stripe_event_id", event.id);
    return new Response(JSON.stringify({ ok: false, error: "handler_error" }), { status: 200 });
  }
});
