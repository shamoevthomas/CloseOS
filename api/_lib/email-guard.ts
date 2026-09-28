// Contrôle d'accès du relais email (/api/send-email → api/email.ts?action=send).
// Avant : n'importe qui pouvait envoyer n'importe quel email depuis support@closeos.fr.
// Désormais il faut être soit un utilisateur connecté (JWT Supabase), soit un serveur CloseOS
// (Edge Functions Sign) qui présente le secret partagé INTERNAL_EMAIL_SECRET.

import { timingSafeEqual } from 'node:crypto';

/** Expéditeurs utilisables via le relais : les seuls que l'application emploie. */
export const ALLOWED_SENDERS = ['support@closeos.fr', 'noreplycloseos@gmail.com'];
export const MAX_RECIPIENTS = 10;

export type EmailCaller = { kind: 'internal' } | { kind: 'user'; userId: string };

export interface EmailGuardDeps {
  internalSecret?: string;
  /** Vérifie un JWT Supabase et renvoie l'id utilisateur, ou null. */
  getUserId: (jwt: string) => Promise<string | null>;
}

function sameSecret(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Appel serveur à serveur CloseOS (Edge Functions) : en-tête x-closeos-internal = secret partagé. */
export function isInternalCall(headers: Record<string, any>, secret: string | undefined): boolean {
  const got = String(headers['x-closeos-internal'] || '');
  return !!(got && secret && secret.length >= 32 && sameSecret(got, secret));
}

export async function authorizeEmailCaller(headers: Record<string, any>, deps: EmailGuardDeps): Promise<EmailCaller | null> {
  const internal = String(headers['x-closeos-internal'] || '');
  if (internal && deps.internalSecret && deps.internalSecret.length >= 32 && sameSecret(internal, deps.internalSecret)) {
    return { kind: 'internal' };
  }
  const m = String(headers.authorization || '').match(/^Bearer\s+(\S+)$/i);
  if (m) {
    const userId = await deps.getUserId(m[1]).catch(() => null);
    if (userId) return { kind: 'user', userId };
  }
  return null;
}

/** Valide un corps Brevo : expéditeur autorisé, destinataires bornés. Renvoie un message d'erreur ou null. */
export function validateSendPayload(body: any): string | null {
  if (!body || typeof body !== 'object') return 'Corps de requête invalide.';
  const sender = String(body.sender?.email || '').trim().toLowerCase();
  if (!ALLOWED_SENDERS.includes(sender)) return 'Expéditeur non autorisé.';
  const count = ['to', 'cc', 'bcc'].reduce((n, k) => n + (Array.isArray(body[k]) ? body[k].length : 0), 0);
  if (count === 0) return 'Aucun destinataire.';
  if (count > MAX_RECIPIENTS) return `Trop de destinataires (max ${MAX_RECIPIENTS}).`;
  if (body.replyTo && typeof body.replyTo !== 'object') return 'replyTo invalide.';
  return null;
}

// ───────── Copie signée envoyée par le signataire (sans compte) ─────────

export const COPY_MAX_PER_DAY = 5;
export const COPY_MAX_BYTES = 4 * 1024 * 1024;

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/**
 * Valide la demande de copie : email du destinataire, PDF base64 réel et de taille bornée.
 * Le contenu de l'email est construit côté serveur : le signataire ne choisit que le destinataire.
 */
export function validateSignCopy(body: any): { error: string } | { to: string; pdf: Buffer; recipientName: string } {
  const to = String(body?.to || '').trim();
  if (!EMAIL_RE.test(to) || to.length > 254) return { error: 'Adresse email invalide.' };
  const raw = String(body?.pdfB64 || '');
  const b64 = raw.includes(',') ? raw.split(',')[1] : raw;
  const pdf = Buffer.from(b64, 'base64');
  if (pdf.byteLength === 0) return { error: 'PDF manquant.' };
  if (pdf.byteLength > COPY_MAX_BYTES) return { error: 'PDF trop volumineux.' };
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return { error: "Le fichier n'est pas un PDF." };
  const recipientName = String(body?.recipientName || '').trim().slice(0, 80);
  return { to, pdf, recipientName };
}

export function signCopyEmailHtml(title: string, recipientName: string): string {
  const greeting = recipientName ? `Bonjour ${escapeHtml(recipientName)},<br/>` : '';
  return `
  <div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid #3A4242;border-radius:12px;">
        <tr><td style="padding:28px 32px;">
          <img src="https://sign.closeos.fr/CLOSEOS-SIGN-LOGO.png" alt="CloseOS Sign" height="30" style="height:30px;width:auto;display:block;" />
          <h1 style="color:#fff;font-size:20px;margin:14px 0 8px;">Votre copie signée</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0;">
            ${greeting}Veuillez trouver ci-joint la copie PDF du document signé : <strong style="color:#F3F4F6;">${escapeHtml(title)}</strong>.<br/>
            Signature sécurisée — conformité RGPD.
          </p>
        </td></tr>
      </table>
    </td></tr></table>
  </div>`;
}

export function safePdfName(title: string): string {
  return (title || 'contrat').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60);
}
