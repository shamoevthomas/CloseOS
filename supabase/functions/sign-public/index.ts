// CloseOS Sign — Accès SIGNATAIRE côté serveur (service_role), autorisé par le TOKEN du signataire.
// Remplace les lectures/écritures directes anon du navigateur signataire. Ne renvoie JAMAIS les
// listes blanches (verification_emails/phones/pairs) ni les access_token des autres signataires.
// verify_jwt=false : signataire anonyme ; autorisation = le token (secret porteur).
//
// POST { action: 'get'|'save-fields'|'save-inline'|'contact', token, ... }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { linkExpired } from "../_shared/sign-guards.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Résout le signataire par son token (fallback legacy : token directement sur le contrat).
// deno-lint-ignore no-explicit-any
async function resolveSigner(supabase: any, token: string): Promise<{ contractId: string; signer: any | null } | null> {
  const { data: signer } = await supabase
    .from("sign_contract_signers")
    .select("id,contract_id,signer_index,contact_id,status,verification_locked,verification_lock_reason,verification_lock_step,payment_required,payment_status,link_expires_at")
    .eq("access_token", token).maybeSingle();
  if (signer?.contract_id) return { contractId: signer.contract_id, signer };
  const { data: legacy } = await supabase.from("sign_contracts").select("id").eq("access_token", token).maybeSingle();
  if (legacy?.id) return { contractId: legacy.id, signer: null };
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { action, token } = body;
    if (!token || !action) return json({ ok: false, error: "params" }, 400);
    const resolved = await resolveSigner(supabase, token);
    if (!resolved) return json({ ok: false, error: "contract" });
    const { contractId, signer } = resolved;
    if (linkExpired(signer)) return json({ ok: false, error: "expired" });

    // ── GET : payload sûr pour la page signataire (assemblé côté client) ──
    if (action === "get") {
      const { data: contract } = await supabase
        .from("sign_contracts")
        .select("id,title,content_html,status,source_type,pdf_data,pdf_path,owner_email,theme,images,inline_values,contact_id,signing_order,verification_method,payment_mode,payment_amount,payment_interval,payment_duration_months,payment_trial_days,payment_tva_rate,payment_status")
        .eq("id", contractId).maybeSingle();
      if (!contract) return json({ ok: false, error: "contract" });
      // PDF rangé dans Storage (contrats créés par l'API) : renvoyé comme avant, en data URL.
      if (!contract.pdf_data && contract.pdf_path) {
        const { data: file } = await supabase.storage.from("sign-documents").download(contract.pdf_path);
        if (file) contract.pdf_data = `data:application/pdf;base64,${encodeBase64(new Uint8Array(await file.arrayBuffer()))}`;
      }
      delete contract.pdf_path;

      const { data: signers } = await supabase
        .from("sign_contract_signers")
        .select("id,signer_index,contact_id,status,signed_at,inline_values")
        .eq("contract_id", contractId).order("signer_index", { ascending: true });

      const me = signer ?? null;
      const myContactId = me?.contact_id ?? contract.contact_id ?? null;
      let contact = null;
      if (myContactId) {
        const { data: ct } = await supabase
          .from("sign_contacts").select("name,email,phone,address,siret,siren,tva,company_id,ape")
          .eq("id", myContactId).maybeSingle();
        contact = ct ?? null;
      }

      const { data: fields } = await supabase
        .from("sign_contract_fields")
        .select("id,field_type,pos_x,pos_y,width,height,page,assignee,signer_index,value,label,required")
        .eq("contract_id", contractId).eq("placement", "free").order("sort_order", { ascending: true });

      return json({ ok: true, contract, me, signers: signers ?? [], contact, fields: fields ?? [] });
    }

    // ── SAVE-FIELDS : valeurs des champs libres remplis (validées : champ du contrat, signataire non signé) ──
    if (action === "save-fields") {
      if (signer && signer.status === "signed") return json({ ok: false, error: "already_signed" });
      const updates: { id: string; value: string }[] = Array.isArray(body.updates) ? body.updates : [];
      const tzOffset = typeof body.tzOffset === "number" ? body.tzOffset : null;
      const nowIso = new Date().toISOString();
      for (const u of updates) {
        if (!u?.id) continue;
        await supabase.from("sign_contract_fields")
          .update({ value: u.value ?? "", filled_at: nowIso, tz_offset: tzOffset })
          .eq("id", u.id).eq("contract_id", contractId); // ← garde : le champ doit appartenir au contrat
      }
      return json({ ok: true });
    }

    // ── SAVE-INLINE : valeurs inline DU signataire du token ──
    if (action === "save-inline") {
      if (!signer) return json({ ok: false, error: "no_signer" }); // legacy mono : pas de ligne signataire
      if (signer.status === "signed") return json({ ok: false, error: "already_signed" });
      const values = body.values && typeof body.values === "object" ? body.values : {};
      await supabase.from("sign_contract_signers").update({ inline_values: values }).eq("id", signer.id);
      return json({ ok: true });
    }

    // ── CONTACT : upsert dans le carnet du PROPRIÉTAIRE du contrat (user_id dérivé serveur) ──
    if (action === "contact") {
      const email = String(body.email || "").trim();
      if (!email) return json({ ok: false, error: "email" });
      const { data: c } = await supabase.from("sign_contracts").select("user_id").eq("id", contractId).maybeSingle();
      const ownerId = c?.user_id;
      if (!ownerId) return json({ ok: false, error: "owner" });
      // deno-lint-ignore no-explicit-any
      const patch: Record<string, any> = {};
      for (const k of ["name", "phone", "address", "city", "siret", "siren", "tva", "company_id", "ape"]) {
        const v = String(body[k] ?? "").trim();
        if (v) patch[k] = v;
      }
      const details = body.details && typeof body.details === "object" ? body.details : null;
      const { data: existing } = await supabase
        .from("sign_contacts").select("id,details").eq("user_id", ownerId).ilike("email", email).limit(1);
      if (existing && existing.length > 0) {
        const merged = details ? { ...(existing[0].details || {}), ...details } : existing[0].details;
        await supabase.from("sign_contacts").update({ ...patch, ...(details ? { details: merged } : {}) }).eq("id", existing[0].id);
      } else {
        await supabase.from("sign_contacts").insert({ user_id: ownerId, email, name: patch.name || email, ...patch, ...(details ? { details } : {}) });
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
});
