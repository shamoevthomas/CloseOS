// CloseOS Sign — Certificat de preuve.
// Le journal sign_signature_events (append-only) est la SOURCE DE VÉRITÉ. Le certificat n'en est
// que la mise en page, généré UNE SEULE FOIS puis figé. Règle clé : le serveur calcule les
// empreintes sur les OCTETS REÇUS (jamais un hash fourni par le client) et gèle le fichier stocké
// dans le bucket privé (source unique). À la finalisation, le PDF final (doc+certificat) est envoyé
// automatiquement EN PIÈCE JOINTE à toutes les parties (émetteur + signataires) via Brevo.
// verify_jwt=false. Accès : token du signataire, ou contractId + session du propriétaire du contrat
// (régénération depuis l'éditeur). `verify` reste public : il ne renvoie que titre et empreintes.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bearerToken, certificateAccess, internalEmailHeaders } from "../_shared/sign-guards.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1?target=denonext";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const clientIp = (req: Request): string | null => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
const BUCKET = "sign-documents";
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

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64ToBytes(b64: string): Uint8Array {
  const clean = (b64 || "").includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
function maskEmail(e: string): string {
  const [l, d] = (e || "").split("@");
  if (!d || !l) return e || "";
  return `${l.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(l.length - 1, 5)))}@${d}`;
}
function maskPhone(p: string): string {
  const n = (p || "").replace(/[^\d+]/g, "");
  if (n.length < 5) return p || "";
  return `${n.slice(0, 3)}${"•".repeat(Math.max(2, n.length - 5))}${n.slice(-2)}`;
}
function deviceLabel(ua: string | null): string {
  if (!ua) return "—";
  const br = /Edg/.test(ua) ? "Edge" : /OPR|Opera/.test(ua) ? "Opera" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Navigateur";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${br} · ${os}` : br;
}
function safeName(title: string): string { return (title || "contrat").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60); }

function finalEmailHtml(title: string): string {
  return `<div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid #3A4242;border-radius:12px;overflow:hidden;"><tr><td style="padding:28px 32px 8px;"><span style="color:#F3F4F6;font-size:18px;font-weight:700;">CloseOS <span style="color:#CEFF8F;">Sign</span></span></td></tr><tr><td style="padding:8px 32px 0;"><h1 style="color:#ffffff;font-size:21px;margin:12px 0 8px;">Document signé — certificat de preuve</h1><p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 4px;">Le document <strong style="color:#F3F4F6;">${title}</strong> a été signé par toutes les parties.<br/>Vous trouverez en pièce jointe le PDF final : le document signé <strong style="color:#F3F4F6;">et</strong> son certificat de preuve (chronologie, empreintes, identités vérifiées).</p></td></tr><tr><td style="padding:18px 32px 28px;"><p style="color:#6b7280;font-size:11px;line-height:1.6;margin:0;">Conservez ce fichier : il atteste de la signature. Signature électronique — conformité RGPD.</p></td></tr></table></td></tr></table></div>`;
}

// Envoie le PDF final EN PIÈCE JOINTE à toutes les parties (émetteur + signataires), une seule fois.
// deno-lint-ignore no-explicit-any
async function emailFinalToParties(supabase: any, contract: any, finalBytes: Uint8Array) {
  const { data: signers } = await supabase.from("sign_contract_signers").select("email").eq("contract_id", contract.id);
  const recips = new Set<string>();
  if (contract.owner_email) recips.add(String(contract.owner_email).trim().toLowerCase());
  for (const s of signers ?? []) if (s.email) recips.add(String(s.email).trim().toLowerCase());
  if (recips.size === 0) return;
  const content = bytesToB64(finalBytes);
  const name = `${safeName(contract.title)}-certificat.pdf`;
  const html = finalEmailHtml(contract.title || "votre document");
  for (const to of recips) {
    await fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: emailHeaders(),
      body: JSON.stringify({
        sender: { email: "support@closeos.fr", name: "CloseOS Sign" },
        to: [{ email: to }],
        subject: `Document signé + certificat : ${contract.title || "votre contrat"}`,
        htmlContent: html,
        attachment: [{ content, name }],
      }),
    }).catch(() => {});
  }
}

// deno-lint-ignore no-explicit-any
async function contractIdFromToken(supabase: any, token: unknown): Promise<string | null> {
  if (!token) return null;
  const { data: s } = await supabase.from("sign_contract_signers").select("contract_id").eq("access_token", token).maybeSingle();
  if (s?.contract_id) return s.contract_id;
  const { data: c } = await supabase.from("sign_contracts").select("id").eq("access_token", token).maybeSingle();
  return c?.id ?? null;
}

// Signataire (token) ou propriétaire connecté (contractId + JWT) ; un contractId seul ne suffit plus.
// deno-lint-ignore no-explicit-any
async function resolveContractId(supabase: any, req: Request, body: any): Promise<{ contractId: string } | { error: string }> {
  const tokenContractId = await contractIdFromToken(supabase, body.token);
  const requestedContractId = body.contractId ? String(body.contractId) : null;
  let sessionUserId: string | null = null;
  let ownerOfRequested: string | null = null;
  if (!tokenContractId && requestedContractId) {
    const jwt = bearerToken(req.headers);
    if (jwt) sessionUserId = (await supabase.auth.getUser(jwt)).data?.user?.id ?? null;
    const { data: c } = await supabase.from("sign_contracts").select("user_id").eq("id", requestedContractId).maybeSingle();
    ownerOfRequested = c?.user_id ?? null;
  }
  return certificateAccess({ tokenContractId, requestedContractId, sessionUserId, ownerOfRequested });
}

// deno-lint-ignore no-explicit-any
async function buildCertData(supabase: any, contract: any) {
  const { data: signers } = await supabase.from("sign_contract_signers")
    .select("signer_index,name,email,phone,signed_at,paid_at,payment_required,payment_status,stripe_payment_intent_id,stripe_subscription_id")
    .eq("contract_id", contract.id).order("signer_index", { ascending: true });
  const { data: events } = await supabase.from("sign_signature_events")
    .select("event_type,email,ip_address,user_agent,metadata,created_at")
    .eq("contract_id", contract.id).order("created_at", { ascending: true });
  const method: string = contract.verification_method || "none";
  const methodLabel = method === "email" ? "Code par email" : method === "sms" ? "Code par SMS" : method === "email_sms" ? "Code email + SMS" : "Sans vérification";
  const signerList = (signers ?? []).map((s: any) => ({ index: s.signer_index, name: s.name || "—", email: s.email || "—", phone: method === "sms" || method === "email_sms" ? s.phone || "—" : null, method: methodLabel, signedAt: s.signed_at, paid: s.payment_status === "paid" }));
  const timeline: any[] = []; const security: any[] = []; const payments: any[] = [];
  for (const e of events ?? []) {
    const md = e.metadata || {};
    const base = { type: e.event_type, at: e.created_at, signerIndex: md.signer_index ?? null, ip: e.ip_address ?? null, device: deviceLabel(e.user_agent) };
    if (e.event_type === "security") {
      const attempted = md.channel === "sms" ? maskPhone(md.attempted || "") : maskEmail(md.attempted || "");
      security.push({ ...base, kind: md.kind || "security", step: md.step ?? null, attempt: md.attempt ?? null, attempted: md.attempted ? attempted : null, reason: md.reason ?? null });
      continue;
    }
    if (e.event_type === "paid") payments.push({ at: e.created_at, signerIndex: md.signer_index ?? null, amount: contract.payment_amount ?? null, currency: contract.currency ?? "eur", txn: md.txn || null, mode: md.mode || contract.payment_mode || null });
    if (["created", "sent", "opened", "email_access", "otp_sent", "otp_verified", "consent", "signed", "paid", "sealed", "completed"].includes(e.event_type)) timeline.push(base);
  }
  return { doc: { title: contract.title || "Document", originalHash: contract.document_hash || null, sealedHash: contract.sealed_hash || null }, method: methodLabel, signers: signerList, timeline, security, payments: contract.payment_enabled ? payments : [], certificateId: contract.certificate_id || null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await loadEmailHeaders(supabase);

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "verify") {
      if (!body.certificateId) return json({ ok: false, error: "params" }, 400);
      const { data: c } = await supabase.from("sign_contracts").select("title,document_hash,sealed_hash,certificate_hash,certified_at").eq("certificate_id", body.certificateId).maybeSingle();
      if (!c || !c.certified_at) return json({ ok: false, error: "not_found" });
      return json({ ok: true, title: c.title, originalHash: c.document_hash, sealedHash: c.sealed_hash, certificateHash: c.certificate_hash, certifiedAt: c.certified_at });
    }

    const access = await resolveContractId(supabase, req, body);
    if ("error" in access) return json({ ok: false, error: access.error }, access.error === "unauthorized" ? 401 : 200);
    const contractId = access.contractId;
    const { data: contract } = await supabase.from("sign_contracts")
      .select("id,title,owner_email,status,signing_order,verification_method,payment_enabled,payment_amount,payment_mode,currency,document_hash,sealed_hash,certificate_hash,certificate_path,certificate_id,certified_at")
      .eq("id", contractId).maybeSingle();
    if (!contract) return json({ ok: false, error: "contract" });

    if (action === "get") {
      if (!contract.certificate_path) return json({ ok: false, error: "not_certified" });
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(contract.certificate_path, 600);
      if (!signed?.signedUrl) return json({ ok: false, error: "url" }, 500);
      return json({ ok: true, url: signed.signedUrl, certificateId: contract.certificate_id });
    }

    const { count: pending } = await supabase.from("sign_contract_signers").select("*", { count: "exact", head: true }).eq("contract_id", contract.id).neq("status", "signed");
    const complete = (pending || 0) === 0;

    if (action === "seal") {
      if (!complete) return json({ ok: false, error: "not_complete" });
      if (contract.certified_at) { const data = await buildCertData(supabase, contract); return json({ ok: true, already: true, ...data }); }
      if (!body.sealedPdfB64) return json({ ok: false, error: "no_pdf" }, 400);
      const bytes = b64ToBytes(body.sealedPdfB64);
      const sealedHash = await sha256Hex(bytes); // ← hash sur les OCTETS REÇUS
      await supabase.storage.from(BUCKET).upload(`${contract.id}/sealed.pdf`, bytes, { contentType: "application/pdf", upsert: true });
      const certificateId = contract.certificate_id || crypto.randomUUID();
      await supabase.from("sign_contracts").update({ sealed_hash: sealedHash, certificate_id: certificateId }).eq("id", contract.id);
      await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "sealed", ip_address: clientIp(req), user_agent: req.headers.get("user-agent"), metadata: { sealed_hash: sealedHash } });
      const fresh = { ...contract, sealed_hash: sealedHash, certificate_id: certificateId };
      const data = await buildCertData(supabase, fresh);
      return json({ ok: true, ...data });
    }

    if (action === "finalize") {
      if (contract.certified_at) return json({ ok: true, already: true, certificateId: contract.certificate_id, certificateHash: contract.certificate_hash });
      if (!complete) return json({ ok: false, error: "not_complete" });
      if (!body.certPdfB64) return json({ ok: false, error: "no_pdf" }, 400);
      const { data: sealedFile } = await supabase.storage.from(BUCKET).download(`${contract.id}/sealed.pdf`);
      if (!sealedFile) return json({ ok: false, error: "no_sealed" }, 400);
      const docBytes = new Uint8Array(await sealedFile.arrayBuffer());
      const certBytes = b64ToBytes(body.certPdfB64);
      const merged = await PDFDocument.create();
      const docPdf = await PDFDocument.load(docBytes);
      const certPdf = await PDFDocument.load(certBytes);
      (await merged.copyPages(docPdf, docPdf.getPageIndices())).forEach((p) => merged.addPage(p));
      (await merged.copyPages(certPdf, certPdf.getPageIndices())).forEach((p) => merged.addPage(p));
      const finalBytes = await merged.save();
      const certificateHash = await sha256Hex(finalBytes); // ← hash du fichier fusionné produit serveur
      const path = `${contract.id}/certificat.pdf`;
      await supabase.storage.from(BUCKET).upload(path, finalBytes, { contentType: "application/pdf", upsert: true });
      await supabase.from("sign_contracts").update({ certificate_hash: certificateHash, certificate_path: path, certified_at: new Date().toISOString() }).eq("id", contract.id);
      await supabase.from("sign_signature_events").insert({ contract_id: contract.id, event_type: "certified", ip_address: clientIp(req), metadata: { certificate_id: contract.certificate_id, certificate_hash: certificateHash } });
      await emailFinalToParties(supabase, contract, finalBytes);
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
      return json({ ok: true, certificateId: contract.certificate_id, certificateHash, url: signed?.signedUrl ?? null });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e).slice(0, 250) }, 500);
  }
});
