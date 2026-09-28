// CloseOS Sign — Espace closer (« rep ») d'un contrat-modèle (template).
// Autorisation par le repToken (lien vérificateur) ; verify_jwt=false. 2FA : OTP email + appareil de confiance.
// Cloisonnement strict : un closer ne voit QUE les instances qu'il a générées (rep_id = son id).
// Aucune table touchée en direct côté client : tout passe par cette fonction (service_role).
//
// POST { action, repToken, deviceToken?, ... }
//   bootstrap     -> { trusted } | envoie un OTP à l'email du rep (renseigné par le propriétaire)
//   verify-code   -> crée un appareil de confiance (deviceToken, 7 j)
//   dashboard     -> périmètre du rep (instances + compteurs)
//   create-link   -> clone le template en une instance + lien signataire
//   regenerate-link -> recycle une instance non signée (nouveau lien)
//   template-doc  -> document du modèle (lecture seule, champs propriétaire remplis)
//   instance-doc  -> document d'une instance (lecture seule, valeurs/signatures)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { internalEmailHeaders } from "../_shared/sign-guards.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clientIp = (req: Request): string | null => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

const CODE_TTL_MIN = 10;
const DEVICE_TTL_DAYS = 7;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;
const SEND_EMAIL_URL = "https://close-os.vercel.app/api/send-email";

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

function genToken(): string { return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""); }
function maskEmail(email: string): string {
  const [l, d] = (email || "").split("@");
  if (!d || !l) return email;
  return `${l.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(l.length - 1, 5)))}@${d}`;
}
async function postEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
  try {
    const res = await fetch(SEND_EMAIL_URL, { method: "POST", headers: emailHeaders(),
      body: JSON.stringify({ sender: { email: "support@closeos.fr", name: "CloseOS Sign" }, to: [{ email: to }], subject, htmlContent }) });
    return res.ok;
  } catch { return false; }
}
function otpEmailHtml(code: string, repLabel: string, tplTitle: string): string {
  const spaced = code.slice(0, 3) + " " + code.slice(3);
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#191E1E;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#191E1E;padding:40px 0;"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#222828;border:1px solid #3A4242;border-radius:16px;">
        <tr><td style="padding:32px 36px;">
          <div style="font-size:18px;font-weight:700;color:#F3F4F6;">CloseOS <span style="color:#CEFF8F;">Sign</span></div>
          <h1 style="color:#ffffff;font-size:22px;margin:18px 0 8px;">Votre code d'accès</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 24px;">Bonjour ${repLabel || ""}, saisissez ce code pour accéder à votre espace de signature${tplTitle ? ` (${tplTitle})` : ""}.</p>
          <div style="background:#191E1E;border:1px solid #3A4242;border-radius:12px;padding:22px;text-align:center;margin-bottom:24px;">
            <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#CEFF8F;">${spaced}</div>
          </div>
          <p style="color:#A1A9A9;font-size:13px;line-height:1.6;margin:0;">Ce code expire dans <strong style="color:#F3F4F6;">10 minutes</strong>. Ne le partagez avec personne.</p>
        </td></tr>
      </table>
      <div style="color:#6b7373;font-size:11px;margin-top:18px;">© CloseOS Sign — Signature électronique sécurisée</div>
    </td></tr></table>
  </body></html>`;
}

function effectiveStatus(status: string, expiresAt: string | null): string {
  if (status === "paid") return "paye";
  if (status === "signed") return "signe";
  if (status === "declined" || status === "cancelled") return "refuse";
  const expired = !!expiresAt && new Date(expiresAt).getTime() < Date.now();
  if (expired || status === "expired") return "expire";
  if (status === "viewed") return "consulte";
  return "en_cours";
}

// deno-lint-ignore no-explicit-any
async function resolveRep(supabase: any, token: string) {
  if (!token) return null;
  const { data } = await supabase.from("sign_template_reps").select("*").eq("access_token", token).maybeSingle();
  return data ?? null;
}
// deno-lint-ignore no-explicit-any
async function deviceValid(supabase: any, repId: string, deviceToken: string | null | undefined): Promise<boolean> {
  if (!deviceToken) return false;
  const { data } = await supabase.from("sign_rep_devices").select("id,expires_at").eq("rep_id", repId).eq("token", deviceToken).maybeSingle();
  if (!data) return false;
  return new Date(data.expires_at).getTime() > Date.now();
}

// Assemble le payload d'affichage lecture seule d'un contrat (modèle ou instance).
// deno-lint-ignore no-explicit-any
async function buildDoc(supabase: any, row: any) {
  const { data: fields } = await supabase.from("sign_contract_fields")
    .select("id,field_type,placement,page,pos_x,pos_y,width,height,assignee,signer_index,value,label")
    .eq("contract_id", row.id).eq("placement", "free").order("sort_order", { ascending: true });
  const inlineValues: Record<string, unknown> =
    (row.inline_values && typeof row.inline_values === "object") ? { ...row.inline_values } : {};
  // Valeurs inline saisies par le(s) signataire(s) (fusion anti-race, comme la vue signataire)
  const { data: signers } = await supabase.from("sign_contract_signers").select("inline_values").eq("contract_id", row.id);
  // deno-lint-ignore no-explicit-any
  (signers ?? []).forEach((s: any) => { if (s.inline_values && typeof s.inline_values === "object") Object.assign(inlineValues, s.inline_values); });
  return {
    title: row.title,
    status: row.status,
    sourceType: row.source_type ?? "text",
    contentHtml: row.content_html ?? "",
    theme: row.theme ?? "blank",
    pdfData: row.pdf_data ?? null,
    images: Array.isArray(row.images) ? row.images : [],
    inlineValues,
    fields: fields ?? [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await loadEmailHeaders(supabase);
  try {
    const body = await req.json();
    const { action, repToken, deviceToken } = body;
    const rep = await resolveRep(supabase, repToken);
    if (!rep) return json({ ok: false, error: "rep_introuvable" });

    if (action === "bootstrap") {
      if (rep.status !== "active") return json({ ok: false, error: "revoked" });
      const { data: tpl } = await supabase.from("sign_contracts").select("title").eq("id", rep.template_id).maybeSingle();
      if (await deviceValid(supabase, rep.id, deviceToken)) {
        return json({ ok: true, trusted: true, label: rep.label, templateTitle: tpl?.title ?? "" });
      }
      const { data: last } = await supabase.from("sign_rep_codes").select("created_at").eq("rep_id", rep.id).eq("used", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last && Date.now() - new Date(last.created_at).getTime() < RESEND_COOLDOWN_MS) {
        return json({ ok: true, trusted: false, maskedEmail: maskEmail(rep.email), throttled: true });
      }
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await supabase.from("sign_rep_codes").update({ used: true }).eq("rep_id", rep.id).eq("used", false);
      await supabase.from("sign_rep_codes").insert({ rep_id: rep.id, code, expires_at: new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString() });
      await postEmail(rep.email, "Votre code d'accès — CloseOS Sign", otpEmailHtml(code, rep.label, tpl?.title ?? ""));
      return json({ ok: true, trusted: false, maskedEmail: maskEmail(rep.email) });
    }

    if (action === "verify-code") {
      if (rep.status !== "active") return json({ ok: false, error: "revoked" });
      const code = String(body.code || "").trim();
      if (!code) return json({ ok: false, error: "code_requis" });
      const { data: row } = await supabase.from("sign_rep_codes").select("*").eq("rep_id", rep.id).eq("used", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!row) return json({ ok: false, error: "no_code" });
      if (new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: "expired" });
      if ((row.attempts ?? 0) >= MAX_CODE_ATTEMPTS) return json({ ok: false, error: "too_many" });
      if (String(row.code) !== code) {
        await supabase.from("sign_rep_codes").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
        return json({ ok: false, error: "invalid", attemptsLeft: Math.max(0, MAX_CODE_ATTEMPTS - (row.attempts ?? 0) - 1) });
      }
      await supabase.from("sign_rep_codes").update({ used: true }).eq("id", row.id);
      const newToken = genToken();
      await supabase.from("sign_rep_devices").insert({
        rep_id: rep.id, device_fingerprint: String(body.deviceFingerprint || "").slice(0, 200) || "unknown",
        token: newToken, device_name: String(body.deviceName || "").slice(0, 120) || null,
        last_ip: clientIp(req), expires_at: new Date(Date.now() + DEVICE_TTL_DAYS * 86400000).toISOString(),
      });
      return json({ ok: true, trusted: true, deviceToken: newToken });
    }

    // ---- Actions protégées (appareil de confiance requis) ----
    if (!(await deviceValid(supabase, rep.id, deviceToken))) return json({ ok: false, error: "device_untrusted" });

    if (action === "dashboard") {
      const { data: tpl } = await supabase.from("sign_contracts").select("title,verification_method,payment_enabled").eq("id", rep.template_id).maybeSingle();
      const { data: insts } = await supabase.from("sign_contracts")
        .select("id,status,created_at,signed_at,expires_at,certificate_id,certified_at")
        .eq("template_id", rep.template_id).eq("rep_id", rep.id).order("created_at", { ascending: false });
      const rows = insts ?? [];
      const ids = rows.map((r: any) => r.id);
      const signerByContract: Record<string, any> = {};
      if (ids.length) {
        const { data: signers } = await supabase.from("sign_contract_signers").select("contract_id,name,email,access_token,status").in("contract_id", ids).eq("signer_index", 1);
        (signers ?? []).forEach((s: any) => { signerByContract[s.contract_id] = s; });
      }
      let pending = 0, signed = 0, expired = 0;
      const instances = rows.map((r: any) => {
        const eff = effectiveStatus(r.status, r.expires_at);
        if (eff === "signe" || eff === "paye") signed++;
        else if (eff === "expire") expired++;
        else if (eff === "en_cours" || eff === "consulte") pending++;
        const s = signerByContract[r.id];
        const active = eff === "en_cours" || eff === "consulte";
        return {
          id: r.id, effectiveStatus: eff, createdAt: r.created_at, signedAt: r.signed_at ?? null, expiresAt: r.expires_at ?? null,
          signerName: s?.name ?? null, signerEmail: s?.email ?? null, signerToken: active ? s?.access_token ?? null : null,
          hasCertificate: !!r.certificate_id || !!r.certified_at,
        };
      });
      return json({ ok: true, label: rep.label, templateTitle: tpl?.title ?? "", verificationMethod: tpl?.verification_method ?? "none", paymentEnabled: !!tpl?.payment_enabled, counts: { total: rows.length, pending, signed, expired }, instances });
    }

    if (action === "template-doc") {
      const { data: tpl } = await supabase.from("sign_contracts")
        .select("id,title,status,source_type,content_html,theme,pdf_data,images,inline_values")
        .eq("id", rep.template_id).eq("is_template", true).maybeSingle();
      if (!tpl) return json({ ok: false, error: "template_introuvable" });
      return json({ ok: true, doc: await buildDoc(supabase, tpl) });
    }

    if (action === "instance-doc") {
      const instanceId = String(body.instanceId || "");
      const { data: inst } = await supabase.from("sign_contracts")
        .select("id,rep_id,template_id,title,status,source_type,content_html,theme,pdf_data,images,inline_values")
        .eq("id", instanceId).maybeSingle();
      if (!inst || inst.rep_id !== rep.id || inst.template_id !== rep.template_id) return json({ ok: false, error: "instance_invalide" });
      return json({ ok: true, doc: await buildDoc(supabase, inst) });
    }

    if (action === "create-link") {
      if (rep.status !== "active") return json({ ok: false, error: "revoked" });
      const name = String(body.signerName || "").trim();
      if (!name) return json({ ok: false, error: "nom_requis" });
      // Email facultatif : requis seulement si la vérification l'exige (géré côté UI selon la méthode).
      const email = String(body.signerEmail || "").trim();
      const { data, error } = await supabase.rpc("sign_clone_template_to_instance", {
        p_template_id: rep.template_id, p_rep_id: rep.id,
        p_signer_name: name, p_signer_email: email, p_signer_phone: String(body.signerPhone || ""), p_expires_days: 7,
      });
      if (error) return json({ ok: false, error: error.message }, 500);
      const row = Array.isArray(data) ? data[0] : data;
      return json({ ok: true, instanceId: row.instance_id, token: row.signer_token });
    }

    if (action === "regenerate-link") {
      if (rep.status !== "active") return json({ ok: false, error: "revoked" });
      const instanceId = String(body.instanceId || "");
      const { data: inst } = await supabase.from("sign_contracts").select("id,rep_id,template_id").eq("id", instanceId).maybeSingle();
      if (!inst || inst.rep_id !== rep.id || inst.template_id !== rep.template_id) return json({ ok: false, error: "instance_invalide" });
      const { data, error } = await supabase.rpc("sign_regenerate_instance_internal", { p_instance_id: instanceId });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, token: String(data) });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
});
