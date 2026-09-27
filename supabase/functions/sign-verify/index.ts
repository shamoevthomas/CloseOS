// CloseOS Sign — Edge Function de vérification d'identité du signataire (code à 6 chiffres).
// MULTI-SIGNATAIRE : tout est résolu PAR SIGNATAIRE via son access_token (table sign_contract_signers).
// Journalise aussi (faisceau de preuves, append-only) : otp_sent/otp_verified, email_access, consent,
// signed, completed, et 'security' sur chaque échec (IP capturée serveur). La coordonnée tentée hors
// liste blanche est stockée EN CLAIR dans metadata (plateforme uniquement) — le certificat la masque.
//
// POST { token, action: 'send'|'verify'|'finalize', channel?, destination?, code?, email?, tzOffset?, consent? }
// verify_jwt = false : signataire anonyme ; autorisation via le token du signataire.

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

const MAX_ATTEMPTS = 3;
const MAX_RESENDS = 3;
const RESEND_COOLDOWN_MS = 90_000;
const UNLOCK_BASE = "https://sign.closeos.fr";
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

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const normEmail = (s: string) => (s || "").trim().toLowerCase();
const normPhone = (s: string) => (s || "").replace(/[^\d+]/g, "");
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return email;
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(local.length - 1, 5)))}@${domain}`;
}
function maskPhone(p: string): string {
  const n = normPhone(p);
  if (n.length < 5) return p;
  return `${n.slice(0, 3)}${"•".repeat(Math.max(2, n.length - 5))}${n.slice(-2)}`;
}
const maskFor = (channel: string, d: string) => (channel === "sms" ? maskPhone(d) : maskEmail(d));
const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x || "").trim()).filter(Boolean) : []);

function codeEmailHtml(code: string): string {
  const spaced = code.slice(0, 3) + " " + code.slice(3);
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#191E1E;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#191E1E;padding:40px 0;"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#222828;border:1px solid #3A4242;border-radius:16px;">
        <tr><td style="padding:32px 36px;">
          <div style="font-size:18px;font-weight:700;color:#F3F4F6;">CloseOS <span style="color:#CEFF8F;">Sign</span></div>
          <h1 style="color:#ffffff;font-size:22px;margin:18px 0 8px;">Code de signature</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 24px;">Saisissez ce code pour vérifier votre identité et signer le document.</p>
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

function lockEmailHtml(title: string, reasonLabel: string, unlockUrl: string): string {
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#191E1E;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#191E1E;padding:40px 0;"><tr><td align="center">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#222828;border:1px solid #3A4242;border-radius:16px;">
        <tr><td style="padding:32px 36px;">
          <div style="font-size:18px;font-weight:700;color:#F3F4F6;">CloseOS <span style="color:#CEFF8F;">Sign</span></div>
          <h1 style="color:#ffffff;font-size:21px;margin:18px 0 8px;">Accès signataire bloqué 🔒</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 18px;">Trop de tentatives échouées sur la vérification d'identité du document <strong style="color:#F3F4F6;">${title}</strong>.<br/>Raison : <strong style="color:#F3F4F6;">${reasonLabel}</strong>. L'accès du signataire est suspendu.</p>
          <a href="${unlockUrl}" style="display:inline-block;background:#CEFF8F;color:#191E1E;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:10px;">Débloquer l'accès</a>
          <p style="color:#6b7373;font-size:12px;line-height:1.6;margin:20px 0 0;">Ou copiez ce lien : <a href="${unlockUrl}" style="color:#CEFF8F;">${unlockUrl}</a></p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

async function postEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
  try {
    const res = await fetch(SEND_EMAIL_URL, { method: "POST", headers: emailHeaders(),
      body: JSON.stringify({ sender: { email: "support@closeos.fr", name: "CloseOS Sign" }, to: [{ email: to }], subject, htmlContent }) });
    return res.ok;
  } catch { return false; }
}

function signInviteHtml(title: string, link: string, name: string): string {
  return `<div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid #3A4242;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;"><span style="color:#F3F4F6;font-size:18px;font-weight:700;">CloseOS <span style="color:#CEFF8F;">Sign</span></span></td></tr>
        <tr><td style="padding:8px 32px 0;"><h1 style="color:#ffffff;font-size:22px;margin:12px 0 8px;">Vous avez un document à signer</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 4px;">Bonjour ${name || ""},<br/>Vous êtes invité(e) à signer : <strong style="color:#F3F4F6;">${title}</strong>.</p></td></tr>
        <tr><td style="padding:24px 32px;"><a href="${link}" style="display:inline-block;background:#CEFF8F;color:#191E1E;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;">Consulter &amp; signer</a></td></tr>
      </table>
    </td></tr></table>
  </div>`;
}

// deno-lint-ignore no-explicit-any
async function sendSmsCode(supabase: any, dest: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const { data: rows } = await supabase.from("sign_secrets").select("name,value").in("name", ["clicksend_username", "clicksend_api_key", "clicksend_from"]);
  const map: Record<string, string> = Object.fromEntries((rows ?? []).map((r: any) => [r.name, r.value]));
  const user = map.clicksend_username; const key = map.clicksend_api_key; const from = (map.clicksend_from || "").trim();
  if (!user || !key) return { ok: false, error: "sms_not_configured" };
  const message: Record<string, string> = { source: "closeos", to: normPhone(dest), body: `CloseOS Sign : votre code de signature est ${code}. Valable 10 minutes.` };
  if (from) message.from = from;
  const res = await fetch("https://rest.clicksend.com/v3/sms/send", { method: "POST",
    headers: { Authorization: `Basic ${btoa(`${user}:${key}`)}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [message] }) });
  const j = await res.json().catch(() => null);
  const msgStatus = j?.data?.messages?.[0]?.status;
  if (!res.ok || (j?.response_code && j.response_code !== "SUCCESS") || (msgStatus && msgStatus !== "SUCCESS")) return { ok: false, error: `sms_failed ${j?.response_code ?? res.status} ${msgStatus ?? ""}`.slice(0, 160) };
  return { ok: true };
}

function requiredChannels(method: string): string[] {
  return method === "email_sms" ? ["email", "sms"] : method === "sms" ? ["sms"] : method === "email" ? ["email"] : [];
}
function genToken(): string { return crypto.randomUUID().replace(/-/g, ""); }

// deno-lint-ignore no-explicit-any
async function resolveSigner(supabase: any, token: string): Promise<{ contract: any; signer: any } | null> {
  const { data: signer } = await supabase.from("sign_contract_signers").select("*").eq("access_token", token).maybeSingle();
  let contractId = signer?.contract_id ?? null;
  if (!contractId) { const { data: legacy } = await supabase.from("sign_contracts").select("id").eq("access_token", token).maybeSingle(); contractId = legacy?.id ?? null; }
  if (!contractId) return null;
  const { data: contract } = await supabase.from("sign_contracts").select("id,title,owner_email,status,signing_order,verification_method,signer_count").eq("id", contractId).maybeSingle();
  if (!contract) return null;
  let s = signer;
  if (!s) { const { data: s1 } = await supabase.from("sign_contract_signers").select("*").eq("contract_id", contractId).eq("signer_index", 1).maybeSingle(); s = s1; }
  if (!s) return null;
  return { contract, signer: s };
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

// deno-lint-ignore no-explicit-any
async function advanceAfterSignerDone(supabase: any, contract: any, signer: any, via: string, tzOffset: number | null, ip: string | null, ua: string | null) {
  const nowIso = new Date().toISOString();
  if (signer.status !== "signed") {
    await supabase.from("sign_contract_signers").update({ status: "signed", signed_at: nowIso }).eq("id", signer.id);
    await supabase.from("sign_signature_events").insert({ contract_id: contract.id, contact_id: signer.contact_id ?? null, event_type: "signed", email: signer.email || null, ip_address: ip, user_agent: ua, metadata: { via, signer_index: signer.signer_index, tz_offset: tzOffset } });
  }
  if (contract.signing_order === "sequential") {
    const { data: next } = await supabase.from("sign_contract_signers").select("id,signer_index,email,name,access_token,status").eq("contract_id", contract.id).eq("status", "pending").order("signer_index", { ascending: true }).limit(1).maybeSingle();
    if (next) {
      const token = next.access_token || genToken();
      await supabase.from("sign_contract_signers").update({ access_token: token, status: "sent", sent_at: nowIso }).eq("id", next.id);
      if (next.email) {
        const link = `${UNLOCK_BASE}/sign/s/${token}`;
        await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "sent", email: next.email, metadata: { signer_index: next.signer_index } });
        await postEmail(next.email, `À signer : ${contract.title || "Votre contrat"}`, signInviteHtml(contract.title || "Votre contrat", link, next.name || ""));
      }
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

// deno-lint-ignore no-explicit-any
async function lockAndNotify(supabase: any, contract: any, signer: any, reason: "destination" | "code", step: number, ip: string | null) {
  await supabase.from("sign_contract_signers").update({ verification_locked: true, verification_lock_reason: reason, verification_lock_step: step }).eq("id", signer.id);
  await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "security", ip_address: ip, metadata: { kind: "verification_locked", reason, step, signer_index: signer.signer_index } });
  if (contract.owner_email) {
    const reasonLabel = reason === "destination" ? "saisie de la destination (étape 1)" : "saisie du code (étape 2)";
    await postEmail(contract.owner_email, "🔒 Accès signataire bloqué — CloseOS Sign", lockEmailHtml(contract.title || "votre document", reasonLabel, `${UNLOCK_BASE}/sign/app/contrat/${contract.id}`));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await loadEmailHeaders(supabase);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  try {
    const body = await req.json();
    const { token, action, code } = body;
    const claimedRaw: string = (body.destination ?? body.email ?? body.phone ?? "").toString();
    if (!token || !action) return json({ ok: false, error: "params" }, 400);

    const resolved = await resolveSigner(supabase, token);
    if (!resolved) return json({ ok: false, error: "contract" });
    const { contract, signer } = resolved;
    const method: string = contract.verification_method;

    if (action === "finalize") {
      if (signer.status === "signed") return json({ ok: true, already: true });
      if (signer.verification_locked) return json({ ok: false, error: "locked" });
      if (signer.payment_required) return json({ ok: false, error: "use_pay" });
      if (!(await isSignerTurn(supabase, contract, signer))) return json({ ok: false, error: "not_your_turn" });
      if (!(await verificationSatisfied(supabase, contract, signer))) return json({ ok: false, error: "not_verified" });
      if (body.consent) await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "consent", email: signer.email || null, ip_address: ip, user_agent: ua, metadata: { signer_index: signer.signer_index, text: typeof body.consent === "string" ? body.consent : "J'ai lu et j'accepte ce document" } });
      const allSigned = await advanceAfterSignerDone(supabase, contract, signer, method, body.tzOffset ?? null, ip, ua);
      return json({ ok: true, allSigned });
    }

    if (signer.status === "signed") return json({ ok: false, error: "already_signed" });
    if (signer.verification_locked) return json({ ok: false, error: "locked", reason: signer.verification_lock_reason, step: signer.verification_lock_step });

    const allowedChannels = requiredChannels(method);
    const channel: "email" | "sms" = body.channel === "sms" || body.channel === "email" ? body.channel : method === "sms" ? "sms" : "email";
    if (!allowedChannels.includes(channel)) return json({ ok: false, error: "no_verification" });
    const pairs: { email: string; phone: string }[] = Array.isArray(signer.verification_pairs) ? signer.verification_pairs : [];
    const norm = channel === "sms" ? normPhone : normEmail;

    if (action === "send") {
      const claimed = claimedRaw.trim();
      if (!claimed) return json({ ok: false, error: "destination_required" });
      let allow: string[] = [];
      if (channel === "email") allow = method === "email_sms" ? pairs.map((p) => p.email) : asArr(signer.verification_emails);
      else if (method === "email_sms") {
        const { data: ev } = await supabase.from("sign_verification_codes").select("email").eq("contract_id", contract.id).eq("signer_index", signer.signer_index).eq("channel", "email").eq("consumed", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const verifiedEmail = ev?.email || "";
        if (!verifiedEmail) return json({ ok: false, error: "email_first" });
        const pair = pairs.find((p) => normEmail(p.email) === normEmail(verifiedEmail));
        allow = pair && pair.phone ? [pair.phone] : [];
      } else allow = asArr(signer.verification_phones);
      allow = allow.map((e) => (e || "").trim()).filter(Boolean);
      if (allow.length === 0) return json({ ok: false, error: "no_verification" });

      const match = allow.find((a) => norm(a) === norm(claimed));
      if (!match) {
        const n = (signer.verification_dest_attempts || 0) + 1;
        await supabase.from("sign_contract_signers").update({ verification_dest_attempts: n }).eq("id", signer.id);
        // événement sécurité : coordonnée tentée EN CLAIR (plateforme uniquement) ; le certificat la masque
        await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "security", ip_address: ip, user_agent: ua, metadata: { kind: "verification_failed", step: 1, attempt: n, channel, attempted: claimed, signer_index: signer.signer_index } });
        if (n >= MAX_ATTEMPTS) { await lockAndNotify(supabase, contract, signer, "destination", 1, ip); return json({ ok: false, error: "locked", reason: "destination", step: 1 }); }
        return json({ ok: false, error: "not_authorized", attemptsLeft: MAX_ATTEMPTS - n });
      }
      const { count } = await supabase.from("sign_verification_codes").select("*", { count: "exact", head: true }).eq("contract_id", contract.id).eq("signer_index", signer.signer_index).eq("channel", channel);
      const sentCount = count || 0;
      if (sentCount >= MAX_RESENDS + 1) return json({ ok: false, error: "resend_limit" });
      const { data: last } = await supabase.from("sign_verification_codes").select("created_at").eq("contract_id", contract.id).eq("signer_index", signer.signer_index).eq("channel", channel).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last && Date.now() - new Date(last.created_at).getTime() < RESEND_COOLDOWN_MS) { const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(last.created_at).getTime())) / 1000); return json({ ok: false, error: "rate_limit", wait }); }
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const code_hash = await sha256Hex(newCode);
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from("sign_verification_codes").update({ consumed: true }).eq("contract_id", contract.id).eq("signer_index", signer.signer_index).eq("channel", channel).eq("consumed", false);
      const { error: insErr } = await supabase.from("sign_verification_codes").insert({ contract_id: contract.id, signer_index: signer.signer_index, channel, email: match, code_hash, expires_at });
      if (insErr) return json({ ok: false, error: insErr.message }, 500);
      const sent = channel === "sms" ? await sendSmsCode(supabase, match, newCode) : (await postEmail(match, "Votre code de signature CloseOS Sign", codeEmailHtml(newCode))) ? { ok: true } : { ok: false, error: "email_failed" };
      if (!sent.ok) return json({ ok: false, error: sent.error || "send_failed" }, 502);
      await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "otp_sent", email: match, ip_address: ip, user_agent: ua, metadata: { channel, signer_index: signer.signer_index } });
      return json({ ok: true, masked: maskFor(channel, match), channel, resendsLeft: Math.max(0, MAX_RESENDS - sentCount) });
    }

    if (action === "verify") {
      if (!code) return json({ ok: false, error: "code" }, 400);
      const { data: row } = await supabase.from("sign_verification_codes").select("id,code_hash,expires_at,consumed,email").eq("contract_id", contract.id).eq("signer_index", signer.signer_index).eq("channel", channel).eq("consumed", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!row) return json({ ok: false, error: "no_code" });
      if (new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: "expired" });
      const valid = (await sha256Hex(String(code))) === row.code_hash;
      if (!valid) {
        const n = (signer.verification_code_attempts || 0) + 1;
        await supabase.from("sign_contract_signers").update({ verification_code_attempts: n }).eq("id", signer.id);
        await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "security", ip_address: ip, user_agent: ua, metadata: { kind: "verification_failed", step: 2, attempt: n, channel, signer_index: signer.signer_index } });
        if (n >= MAX_ATTEMPTS) { await lockAndNotify(supabase, contract, signer, "code", 2, ip); return json({ ok: false, error: "locked", reason: "code", step: 2 }); }
        return json({ ok: false, error: "invalid", attemptsLeft: MAX_ATTEMPTS - n });
      }
      await supabase.from("sign_verification_codes").update({ consumed: true }).eq("id", row.id);
      await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "otp_verified", email: row.email, ip_address: ip, user_agent: ua, metadata: { channel, signer_index: signer.signer_index } });
      // Preuve d'accès à la boîte mail = code email validé
      if (channel === "email") await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "email_access", email: row.email, ip_address: ip, user_agent: ua, metadata: { signer_index: signer.signer_index } });
      return json({ ok: true, masked: maskFor(channel, row.email || ""), channel });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
});
