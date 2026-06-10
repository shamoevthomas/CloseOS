// CloseOS Sign — Edge Function de vérification d'identité du signataire (code à 6 chiffres).
// Canaux : EMAIL (Brevo) et/ou SMS (ClickSend). Anti-brute-force : 3 essais étape 1 (saisie
// destination), 3 essais étape 2 (code), 3 renvois max (90 s d'écart). Au 3e échec → blocage du
// contrat + email au propriétaire (lien de déblocage). Code généré/stocké(haché)/vérifié serveur.
//
// POST { token, action: 'send'|'verify', channel:'email'|'sms', destination?, code? }
// verify_jwt = false : signataire anonyme ; autorisation via le token de contrat.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_ATTEMPTS = 3; // essais étape 1 ET étape 2
const MAX_RESENDS = 3; // renvois après l'envoi initial
const RESEND_COOLDOWN_MS = 90_000; // 90 s
const UNLOCK_BASE = "https://sign.closeos.fr"; // domaine fixe (sécurité : pas d'origine fournie par le signataire)

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

const SEND_EMAIL_URL = "https://close-os.vercel.app/api/send-email";

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
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 18px;">
            Trop de tentatives échouées sur la vérification d'identité du document <strong style="color:#F3F4F6;">${title}</strong>.<br/>
            Raison : <strong style="color:#F3F4F6;">${reasonLabel}</strong>. L'accès du signataire est suspendu.
          </p>
          <a href="${unlockUrl}" style="display:inline-block;background:#CEFF8F;color:#191E1E;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:10px;">Débloquer l'accès</a>
          <p style="color:#6b7373;font-size:12px;line-height:1.6;margin:20px 0 0;">Ou copiez ce lien : <a href="${unlockUrl}" style="color:#CEFF8F;">${unlockUrl}</a></p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

async function sendEmailCode(dest: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { email: "support@closeos.fr", name: "CloseOS Sign" },
      to: [{ email: dest }],
      subject: "Votre code de signature CloseOS Sign",
      htmlContent: codeEmailHtml(code),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `email_failed ${t}`.slice(0, 160) };
  }
  return { ok: true };
}

// deno-lint-ignore no-explicit-any
async function sendSmsCode(supabase: any, dest: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const { data: rows } = await supabase.from("sign_secrets").select("name,value").in("name", ["clicksend_username", "clicksend_api_key", "clicksend_from"]);
  const map: Record<string, string> = Object.fromEntries((rows ?? []).map((r: any) => [r.name, r.value]));
  const user = map.clicksend_username;
  const key = map.clicksend_api_key;
  const from = (map.clicksend_from || "").trim();
  if (!user || !key) return { ok: false, error: "sms_not_configured" };
  const message: Record<string, string> = { source: "closeos", to: normPhone(dest), body: `CloseOS Sign : votre code de signature est ${code}. Valable 10 minutes.` };
  if (from) message.from = from;
  const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${user}:${key}`)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [message] }),
  });
  const j = await res.json().catch(() => null);
  const msgStatus = j?.data?.messages?.[0]?.status;
  if (!res.ok || (j?.response_code && j.response_code !== "SUCCESS") || (msgStatus && msgStatus !== "SUCCESS")) {
    return { ok: false, error: `sms_failed ${j?.response_code ?? res.status} ${msgStatus ?? ""}`.slice(0, 160) };
  }
  return { ok: true };
}

// deno-lint-ignore no-explicit-any
async function lockAndNotify(supabase: any, contract: any, reason: "destination" | "code", step: number) {
  await supabase
    .from("sign_contracts")
    .update({ verification_locked: true, verification_lock_reason: reason, verification_lock_step: step, verification_locked_at: new Date().toISOString() })
    .eq("id", contract.id);
  await supabase
    .from("sign_signature_events")
    .insert({ contract_id: contract.id, event_type: "declined", metadata: { kind: "verification_locked", reason, step } });
  if (contract.owner_email) {
    const reasonLabel = reason === "destination" ? "saisie de la destination (étape 1)" : "saisie du code (étape 2)";
    const unlockUrl = `${UNLOCK_BASE}/sign/app/contrat/${contract.id}`;
    await fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: "support@closeos.fr", name: "CloseOS Sign" },
        to: [{ email: contract.owner_email }],
        subject: "🔒 Accès signataire bloqué — CloseOS Sign",
        htmlContent: lockEmailHtml(contract.title || "votre document", reasonLabel, unlockUrl),
      }),
    }).catch(() => {});
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { token, action, code } = body;
    const claimedRaw: string = (body.destination ?? body.email ?? body.phone ?? "").toString();
    if (!token || !action) return json({ ok: false, error: "params" }, 400);

    const { data: contract } = await supabase
      .from("sign_contracts")
      .select("id,title,owner_email,status,verification_method,verification_email,verification_emails,verification_phones,verification_pairs,verification_locked,verification_lock_reason,verification_lock_step,verification_dest_attempts,verification_code_attempts")
      .eq("access_token", token)
      .maybeSingle();

    if (!contract) return json({ ok: false, error: "contract" });

    // ── Finalisation serveur de la signature (seul moyen de passer un contrat vérifié à "signed") ──
    if (action === "finalize") {
      if (contract.status === "signed" || contract.status === "paid") return json({ ok: true, already: true });
      if (contract.verification_locked) return json({ ok: false, error: "locked" });
      const m = contract.verification_method;
      if (m === "pay") return json({ ok: false, error: "use_pay" });
      if (m !== "none") {
        // Exige une vérification RÉUSSIE (otp_verified) pour chaque canal requis.
        const need = m === "email_sms" ? ["email", "sms"] : m === "sms" ? ["sms"] : ["email"];
        const { data: evs } = await supabase
          .from("sign_signature_events")
          .select("metadata")
          .eq("contract_id", contract.id)
          .eq("event_type", "otp_verified");
        // deno-lint-ignore no-explicit-any
        const done = new Set((evs ?? []).map((e: any) => e?.metadata?.channel).filter(Boolean));
        if (!need.every((ch) => done.has(ch))) return json({ ok: false, error: "not_verified" });
      }
      const nowIso = new Date().toISOString();
      await supabase.from("sign_contracts").update({ status: "signed", signed_at: nowIso }).eq("id", contract.id);
      await supabase.from("sign_signature_events").insert({
        contract_id: contract.id,
        event_type: "signed",
        email: body.email || null,
        user_agent: req.headers.get("user-agent"),
        metadata: { via: m, tz_offset: body.tzOffset ?? null },
      });
      return json({ ok: true });
    }

    if (contract.status === "signed" || contract.status === "paid") return json({ ok: false, error: "already_signed" });
    // Contrat bloqué → aucun envoi/vérif possible
    if (contract.verification_locked)
      return json({ ok: false, error: "locked", reason: contract.verification_lock_reason, step: contract.verification_lock_step });

    const method: string = contract.verification_method;
    const allowedChannels = method === "email_sms" ? ["email", "sms"] : method === "sms" ? ["sms"] : method === "email" ? ["email"] : [];
    const channel: "email" | "sms" = body.channel === "sms" || body.channel === "email" ? body.channel : (method === "sms" ? "sms" : "email");
    if (!allowedChannels.includes(channel)) return json({ ok: false, error: "no_verification" });

    // deno-lint-ignore no-explicit-any
    const pairs: { email: string; phone: string }[] = Array.isArray(contract.verification_pairs) ? contract.verification_pairs : [];
    const norm = channel === "sms" ? normPhone : normEmail;

    // ---- Envoi du code ----
    if (action === "send") {
      const claimed = claimedRaw.trim();
      if (!claimed) return json({ ok: false, error: "destination_required" });

      let allow: string[] = [];
      if (channel === "email") {
        allow = method === "email_sms"
          ? pairs.map((p) => p.email)
          : Array.isArray(contract.verification_emails) && contract.verification_emails.length
            ? contract.verification_emails
            : contract.verification_email ? [contract.verification_email] : [];
      } else if (method === "email_sms") {
        const { data: ev } = await supabase
          .from("sign_verification_codes")
          .select("email").eq("contract_id", contract.id).eq("channel", "email").eq("consumed", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const verifiedEmail = ev?.email || "";
        if (!verifiedEmail) return json({ ok: false, error: "email_first" });
        const pair = pairs.find((p) => normEmail(p.email) === normEmail(verifiedEmail));
        allow = pair && pair.phone ? [pair.phone] : [];
      } else {
        allow = Array.isArray(contract.verification_phones) ? contract.verification_phones : [];
      }
      allow = allow.map((e) => (e || "").trim()).filter(Boolean);
      if (allow.length === 0) return json({ ok: false, error: "no_verification" });

      const match = allow.find((a) => norm(a) === norm(claimed));
      if (!match) {
        // Étape 1 échouée → compteur + blocage au 3e
        const n = (contract.verification_dest_attempts || 0) + 1;
        await supabase.from("sign_contracts").update({ verification_dest_attempts: n }).eq("id", contract.id);
        if (n >= MAX_ATTEMPTS) {
          await lockAndNotify(supabase, contract, "destination", 1);
          return json({ ok: false, error: "locked", reason: "destination", step: 1 });
        }
        return json({ ok: false, error: "not_authorized", attemptsLeft: MAX_ATTEMPTS - n });
      }

      // Limite de renvois (codes déjà créés pour ce canal) : 1 initial + 3 renvois
      const { count } = await supabase
        .from("sign_verification_codes")
        .select("*", { count: "exact", head: true })
        .eq("contract_id", contract.id)
        .eq("channel", channel);
      const sentCount = count || 0;
      if (sentCount >= MAX_RESENDS + 1) return json({ ok: false, error: "resend_limit" });

      // Délai de 90 s entre 2 envois
      const { data: last } = await supabase
        .from("sign_verification_codes")
        .select("created_at").eq("contract_id", contract.id).eq("channel", channel)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last && Date.now() - new Date(last.created_at).getTime() < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(last.created_at).getTime())) / 1000);
        return json({ ok: false, error: "rate_limit", wait });
      }

      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const code_hash = await sha256Hex(newCode);
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from("sign_verification_codes").update({ consumed: true }).eq("contract_id", contract.id).eq("channel", channel).eq("consumed", false);
      const { error: insErr } = await supabase.from("sign_verification_codes").insert({ contract_id: contract.id, channel, email: match, code_hash, expires_at });
      if (insErr) return json({ ok: false, error: insErr.message }, 500);

      const sent = channel === "sms" ? await sendSmsCode(supabase, match, newCode) : await sendEmailCode(match, newCode);
      if (!sent.ok) return json({ ok: false, error: sent.error || "send_failed" }, 502);

      await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "otp_sent", email: match, metadata: { channel } });
      return json({ ok: true, masked: maskFor(channel, match), channel, resendsLeft: Math.max(0, MAX_RESENDS - sentCount) });
    }

    // ---- Vérification du code ----
    if (action === "verify") {
      if (!code) return json({ ok: false, error: "code" }, 400);
      const { data: row } = await supabase
        .from("sign_verification_codes")
        .select("id,code_hash,expires_at,consumed,email")
        .eq("contract_id", contract.id).eq("channel", channel).eq("consumed", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!row) return json({ ok: false, error: "no_code" });
      if (new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: "expired" });

      const valid = (await sha256Hex(String(code))) === row.code_hash;
      if (!valid) {
        // Étape 2 échouée → compteur + blocage au 3e
        const n = (contract.verification_code_attempts || 0) + 1;
        await supabase.from("sign_contracts").update({ verification_code_attempts: n }).eq("id", contract.id);
        if (n >= MAX_ATTEMPTS) {
          await lockAndNotify(supabase, contract, "code", 2);
          return json({ ok: false, error: "locked", reason: "code", step: 2 });
        }
        return json({ ok: false, error: "invalid", attemptsLeft: MAX_ATTEMPTS - n });
      }
      await supabase.from("sign_verification_codes").update({ consumed: true }).eq("id", row.id);
      await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "otp_verified", email: row.email, metadata: { channel } });
      return json({ ok: true, masked: maskFor(channel, row.email || ""), channel });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
});
