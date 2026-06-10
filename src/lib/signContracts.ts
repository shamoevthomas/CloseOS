import { signSupabase as supabase } from './signSupabase';

/**
 * Accès Supabase aux contrats CloseOS Sign (tables sign_*).
 * MVP : rattaché au compte bypass (TEKA) tant que la vraie auth Sign n'est pas branchée.
 * Les champs "inline" vivent dans content_html ; les champs "libres" (overlay)
 * sont stockés dans sign_contract_fields (placement = 'free').
 */

export const BYPASS_SIGN_USER_ID = '00000000-0000-0000-0000-0000000000aa'; // legacy (plus utilisé : vraie auth)
export const BYPASS_OWNER_EMAIL = 'demo@sign.closeos.fr'; // fallback email propriétaire

/** Id du propriétaire connecté (session Supabase, client dédié Sign). Lève si non authentifié. */
async function sessionUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error('not_authenticated');
  return id;
}
/** Email du propriétaire connecté (pour owner_email). */
async function sessionEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

export type OverlayImage = { id: string; page: number; x: number; y: number; w: number; h: number; src: string };
export type SignRole = 'owner' | 'signer';
// signerIndex : 1..N pour un champ de signataire ; null/undefined pour un champ du propriétaire.
export type SignFreeField = { id: string; type: string; x: number; y: number; w: number; h: number; page: number; role: SignRole; signerIndex?: number | null; value?: string; label?: string };

export type SignSignerStatus = 'pending' | 'sent' | 'opened' | 'signed' | 'declined';
export type SignSigner = {
  id: string;
  signerIndex: number; // 1..N (le propriétaire n'est PAS un signataire)
  contactId: string | null;
  name: string;
  email: string;
  phone: string;
  accessToken: string | null;
  status: SignSignerStatus;
  sentAt: string | null;
  signedAt: string | null;
  paidAt: string | null;
  paymentRequired: boolean;
  paymentStatus: 'none' | 'pending' | 'paid';
  // État abonnement (suivi webhook, observation) — affichage propriétaire
  subscriptionStatus: string | null;
  lastPaymentAt: string | null;
  lastPaymentStatus: string | null;
  inlineValues: Record<string, string>;
  // Whitelists de vérif — réservées à l'éditeur (jamais exposées côté signataire public).
  verificationEmails: string[];
  verificationPhones: string[];
  verificationPairs: { email: string; phone: string }[];
  verificationLocked: boolean;
  verificationLockReason: string | null;
  verificationLockStep: number | null;
};

// Tailles par défaut par type (px)
export const FIELD_DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  signature: { w: 200, h: 64 },
  initials: { w: 110, h: 56 },
  name: { w: 200, h: 38 },
  date: { w: 150, h: 34 },
  time: { w: 120, h: 34 },
  email: { w: 220, h: 38 },
  tel: { w: 230, h: 38 },
  address: { w: 300, h: 38 },
  city: { w: 240, h: 38 },
  siret: { w: 200, h: 38 },
  siren: { w: 160, h: 38 },
  tva: { w: 200, h: 38 },
  company_id: { w: 200, h: 38 },
  ape: { w: 150, h: 38 },
  checkbox: { w: 360, h: 44 },
  text: { w: 200, h: 38 },
};
export const fieldDefaultSize = (type: string) => FIELD_DEFAULT_SIZE[type] ?? { w: 180, h: 40 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFieldRow(f: any): SignFreeField {
  const role = (f.assignee as SignRole) ?? 'signer';
  return {
    id: f.id,
    type: f.field_type,
    x: Number(f.pos_x) || 0,
    y: Number(f.pos_y) || 0,
    w: Number(f.width) || fieldDefaultSize(f.field_type).w,
    h: Number(f.height) || fieldDefaultSize(f.field_type).h,
    page: Number(f.page) || 1,
    role,
    signerIndex: f.signer_index != null ? Number(f.signer_index) : role === 'owner' ? null : 1,
    value: f.value ?? '',
    label: f.label ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSignerRow(r: any): SignSigner {
  return {
    id: r.id,
    signerIndex: Number(r.signer_index) || 1,
    contactId: r.contact_id ?? null,
    name: r.name ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    accessToken: r.access_token ?? null,
    status: (r.status as SignSignerStatus) ?? 'pending',
    sentAt: r.sent_at ?? null,
    signedAt: r.signed_at ?? null,
    paidAt: r.paid_at ?? null,
    paymentRequired: !!r.payment_required,
    paymentStatus: (r.payment_status as SignSigner['paymentStatus']) ?? 'none',
    subscriptionStatus: r.subscription_status ?? null,
    lastPaymentAt: r.last_payment_at ?? null,
    lastPaymentStatus: r.last_payment_status ?? null,
    inlineValues: r.inline_values && typeof r.inline_values === 'object' ? r.inline_values : {},
    verificationEmails: Array.isArray(r.verification_emails) ? r.verification_emails : [],
    verificationPhones: Array.isArray(r.verification_phones) ? r.verification_phones : [],
    verificationPairs: Array.isArray(r.verification_pairs) ? r.verification_pairs : [],
    verificationLocked: !!r.verification_locked,
    verificationLockReason: r.verification_lock_reason ?? null,
    verificationLockStep: r.verification_lock_step ?? null,
  };
}

/** Fusionne les valeurs inline du propriétaire (contrat) + celles de chaque signataire (anti-race). */
export function mergedInlineValues(
  contractInline: Record<string, string> | null | undefined,
  signers: SignSigner[],
): Record<string, string> {
  const out: Record<string, string> = { ...(contractInline || {}) };
  for (const s of signers) if (s.inlineValues) Object.assign(out, s.inlineValues);
  return out;
}

export type SignContractRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  fields: number; // total champs (inline + libres)
  contactId: string | null;
  contactName: string | null;
  hasPayment: boolean; // contrat configuré « Payé + signé »
  subscriptionStatus: string | null; // état abonnement agrégé (active/past_due/canceled…) ou null
};

function countInlineFields(html: string | null): number {
  if (!html) return 0;
  return (html.match(/class="sign-field"/g) ?? []).length;
}

export async function createContract(init: { title: string; content_html: string; theme?: string }): Promise<string> {
  const { data, error } = await supabase
    .from('sign_contracts')
    .insert({
      user_id: await sessionUserId(),
      title: init.title,
      content_html: init.content_html,
      theme: init.theme ?? 'blank',
      status: 'draft',
      owner_email: (await sessionEmail()) ?? BYPASS_OWNER_EMAIL,
    })
    .select('id')
    .single();
  if (error) throw error;
  const newId = data.id as string;
  // Crée le signataire 1 par défaut (multi-signataire).
  await supabase.from('sign_contract_signers').insert({ contract_id: newId, signer_index: 1, status: 'pending' });
  return newId;
}

/**
 * Duplique un contrat (tout : contenu, champs, vérif, paiement) en un NOUVEAU brouillon.
 * Exceptions : le contact assigné n'est PAS dupliqué (contact_id=null), et l'état runtime est
 * remis à zéro (statut brouillon, valeurs des champs vidées, token/signatures/paiement effacés).
 * Le titre reçoit « (copie) » à la fin. Retourne l'id du nouveau contrat.
 */
export async function duplicateContract(id: string): Promise<string> {
  const { data: src, error } = await supabase
    .from('sign_contracts')
    .select(
      'title,content_html,source_type,pdf_data,page_count,theme,images,signer_count,signing_order,payment_enabled,verification_method,verification_email,verification_emails,verification_phones,verification_pairs,payment_mode,payment_amount,payment_interval,payment_duration_months,payment_trial_days,payment_tva_rate',
    )
    .eq('id', id)
    .single();
  if (error) throw error;

  const { data: created, error: insErr } = await supabase
    .from('sign_contracts')
    .insert({
      user_id: await sessionUserId(),
      owner_email: (await sessionEmail()) ?? BYPASS_OWNER_EMAIL,
      title: `${src.title ?? 'Contrat'} (copie)`,
      content_html: src.content_html,
      source_type: src.source_type ?? 'text',
      pdf_data: src.pdf_data ?? null,
      page_count: src.page_count ?? 1,
      theme: src.theme ?? 'blank',
      images: src.images ?? [],
      status: 'draft',
      inline_values: {},
      contact_id: null, // ⚠️ l'assignation au contact n'est PAS dupliquée
      verification_method: src.verification_method ?? 'none',
      verification_email: src.verification_email ?? null,
      verification_emails: src.verification_emails ?? [],
      verification_phones: src.verification_phones ?? [],
      verification_pairs: src.verification_pairs ?? [],
      payment_mode: src.payment_mode ?? null,
      payment_amount: src.payment_amount ?? null,
      payment_interval: src.payment_interval ?? null,
      payment_duration_months: src.payment_duration_months ?? null,
      payment_trial_days: src.payment_trial_days ?? 0,
      payment_tva_rate: src.payment_tva_rate ?? null,
      signer_count: src.signer_count ?? 1,
      signing_order: src.signing_order ?? 'parallel',
      payment_enabled: src.payment_enabled ?? false,
    })
    .select('id')
    .single();
  if (insErr) throw insErr;
  const newId = created.id as string;

  // Copie des champs libres (définitions) — valeurs réinitialisées, signer_index conservé
  const { data: fields } = await supabase
    .from('sign_contract_fields')
    .select('field_type,pos_x,pos_y,width,height,page,assignee,signer_index,label,placement,sort_order')
    .eq('contract_id', id);
  if (fields && fields.length) {
    const copies = fields.map((f: any) => ({ ...f, contract_id: newId, value: '' }));
    await supabase.from('sign_contract_fields').insert(copies);
  }

  // Recrée les signataires (config conservée : index, paiement requis, whitelists) — sans contact ni token.
  const { data: srcSigners } = await supabase
    .from('sign_contract_signers')
    .select('signer_index,payment_required,verification_emails,verification_phones,verification_pairs')
    .eq('contract_id', id)
    .order('signer_index', { ascending: true });
  if (srcSigners && srcSigners.length) {
    const sCopies = srcSigners.map((s: any) => ({
      contract_id: newId,
      signer_index: s.signer_index,
      payment_required: !!s.payment_required,
      verification_emails: s.verification_emails ?? [],
      verification_phones: s.verification_phones ?? [],
      verification_pairs: s.verification_pairs ?? [],
      status: 'pending',
    }));
    await supabase.from('sign_contract_signers').insert(sCopies);
  } else {
    await supabase.from('sign_contract_signers').insert({ contract_id: newId, signer_index: 1, status: 'pending' });
  }
  return newId;
}

// ---- Config paiement « Payé + signé » ----
export type SignPaymentMode = 'one_shot' | 'subscription';
export type SignPaymentInterval = 'month' | 'quarter' | 'year';
export type SignPaymentConfig = {
  mode: SignPaymentMode | null;
  amount: number | null; // centimes
  interval: SignPaymentInterval | null;
  durationMonths: number | null; // null = à vie
  trialDays: number;
  tvaRate: number | null; // null = non assujetti
  status: 'none' | 'pending' | 'paid';
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePayment(d: any): SignPaymentConfig {
  return {
    mode: (d.payment_mode as SignPaymentMode) ?? null,
    amount: d.payment_amount ?? null,
    interval: (d.payment_interval as SignPaymentInterval) ?? null,
    durationMonths: d.payment_duration_months ?? null,
    trialDays: d.payment_trial_days ?? 0,
    tvaRate: d.payment_tva_rate ?? null,
    status: (d.payment_status as SignPaymentConfig['status']) ?? 'none',
  };
}

/** Statut Stripe Connect du propriétaire (lecture rapide depuis sign_users). */
export async function getOwnerStripeStatus(ownerId?: string): Promise<{ accountId: string | null; connected: boolean }> {
  const oid = ownerId ?? (await sessionUserId());
  const { data } = await supabase.from('sign_users').select('stripe_account_id,stripe_connected').eq('id', oid).maybeSingle();
  return { accountId: data?.stripe_account_id ?? null, connected: !!data?.stripe_connected };
}

export async function getContract(id: string): Promise<{
  id: string;
  title: string;
  content_html: string;
  status: string;
  source_type: 'text' | 'pdf';
  pdf_data: string | null;
  locked: boolean;
  contact_id: string | null;
  theme: string;
  images: OverlayImage[];
  inline_values: Record<string, string>;
  signer_count: number;
  signing_order: 'parallel' | 'sequential';
  payment_enabled: boolean;
  signers: SignSigner[];
  verification_method: 'none' | 'email' | 'sms' | 'email_sms' | 'pay';
  verification_email: string | null;
  verification_emails: string[];
  verification_phones: string[];
  verification_pairs: { email: string; phone: string }[];
  verification_locked: boolean;
  verification_lock_reason: string | null;
  verification_lock_step: number | null;
  payment: SignPaymentConfig;
  fields: SignFreeField[];
} | null> {
  const { data, error } = await supabase
    .from('sign_contracts')
    .select('id,title,content_html,status,source_type,pdf_data,locked,contact_id,theme,images,inline_values,signer_count,signing_order,payment_enabled,verification_method,verification_email,verification_emails,verification_phones,verification_pairs,verification_locked,verification_lock_reason,verification_lock_step,payment_mode,payment_amount,payment_interval,payment_duration_months,payment_trial_days,payment_tva_rate,payment_status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: fieldRows } = await supabase
    .from('sign_contract_fields')
    .select('id,field_type,pos_x,pos_y,width,height,page,assignee,signer_index,value,label')
    .eq('contract_id', id)
    .eq('placement', 'free')
    .order('sort_order', { ascending: true });

  const fields: SignFreeField[] = (fieldRows ?? []).map(mapFieldRow);

  const { data: signerRows } = await supabase
    .from('sign_contract_signers')
    .select('*')
    .eq('contract_id', id)
    .order('signer_index', { ascending: true });
  const signers: SignSigner[] = (signerRows ?? []).map(mapSignerRow);

  return {
    id: data.id,
    title: data.title,
    content_html: data.content_html ?? '',
    status: data.status,
    source_type: (data.source_type as 'text' | 'pdf') ?? 'text',
    pdf_data: data.pdf_data ?? null,
    locked: !!data.locked,
    contact_id: data.contact_id ?? null,
    theme: data.theme ?? 'blank',
    images: Array.isArray(data.images) ? data.images : [],
    inline_values: (data.inline_values && typeof data.inline_values === 'object' ? data.inline_values : {}) as Record<string, string>,
    signer_count: Number(data.signer_count) || 1,
    signing_order: (data.signing_order as 'parallel' | 'sequential') ?? 'parallel',
    payment_enabled: !!data.payment_enabled,
    signers,
    verification_method: (data.verification_method as 'none' | 'email' | 'sms' | 'email_sms' | 'pay') ?? 'none',
    verification_email: data.verification_email ?? null,
    verification_emails: Array.isArray(data.verification_emails) ? data.verification_emails : [],
    verification_phones: Array.isArray(data.verification_phones) ? data.verification_phones : [],
    verification_pairs: Array.isArray(data.verification_pairs) ? data.verification_pairs : [],
    verification_locked: !!data.verification_locked,
    verification_lock_reason: data.verification_lock_reason ?? null,
    verification_lock_step: data.verification_lock_step ?? null,
    payment: parsePayment(data),
    fields,
  };
}

export async function updateContract(
  id: string,
  patch: {
    title?: string;
    content_html?: string | null;
    source_type?: 'text' | 'pdf';
    pdf_data?: string | null;
    page_count?: number;
    locked?: boolean;
    contact_id?: string | null;
    images?: OverlayImage[];
    status?: string;
    inline_values?: Record<string, string>;
    signer_count?: number;
    signing_order?: 'parallel' | 'sequential';
    payment_enabled?: boolean;
    verification_method?: 'none' | 'email' | 'sms' | 'email_sms' | 'pay';
    verification_email?: string | null;
    verification_emails?: string[];
    verification_phones?: string[];
    verification_pairs?: { email: string; phone: string }[];
    verification_locked?: boolean;
    verification_lock_reason?: string | null;
    verification_lock_step?: number | null;
    verification_dest_attempts?: number;
    verification_code_attempts?: number;
    payment_mode?: string | null;
    payment_amount?: number | null;
    payment_interval?: string | null;
    payment_duration_months?: number | null;
    payment_trial_days?: number;
    payment_tva_rate?: number | null;
  },
): Promise<void> {
  const { error } = await supabase.from('sign_contracts').update(patch).eq('id', id);
  if (error) throw error;
}

/** Remplace l'ensemble des champs libres du contrat (delete + insert). */
export async function saveFreeFields(id: string, fields: SignFreeField[]): Promise<void> {
  const del = await supabase.from('sign_contract_fields').delete().eq('contract_id', id).eq('placement', 'free');
  if (del.error) throw del.error;
  if (fields.length === 0) return;
  const rows = fields.map((f, i) => ({
    contract_id: id,
    field_type: f.type,
    placement: 'free',
    pos_x: f.x,
    pos_y: f.y,
    width: f.w,
    height: f.h,
    page: f.page ?? 1,
    assignee: f.role ?? 'signer',
    signer_index: (f.role ?? 'signer') === 'signer' ? f.signerIndex ?? 1 : null,
    label: f.label ?? null,
    value: f.value ?? null,
    sort_order: i,
  }));
  const ins = await supabase.from('sign_contract_fields').insert(rows);
  if (ins.error) throw ins.error;
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('sign_contracts').delete().eq('id', id);
  if (error) throw error;
}

function genToken(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  } catch {
    /* ignore */
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/** SHA-256 hex d'une chaîne (empreinte du document présenté). */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Journalise l'ouverture du document AVEC capture d'IP serveur (Edge Function sign-event). */
export async function logOpened(token: string, visitor?: string): Promise<void> {
  try {
    await supabase.functions.invoke('sign-event', { body: { token, type: 'opened', visitor } });
  } catch {
    /* best-effort */
  }
}

/**
 * Envoi pour signature : génère un lien (token), passe le contrat en "sent",
 * crée/lie le contact signataire, journalise l'événement et envoie l'email.
 */
export async function sendForSignature(
  contractId: string,
  signer: { name: string; email: string },
  opts?: { copyTo?: string },
): Promise<{ token: string; link: string }> {
  const token = genToken();
  const link = `${window.location.origin}/sign/s/${token}`;
  const nowIso = new Date().toISOString();

  // Contact signataire — dédupliqué par email (identifiant du contact).
  // S'il existe déjà, on le réutilise et on rafraîchit son nom avec le plus récent.
  let contactId: string | null = null;
  const signerEmail = signer.email.trim();
  const { data: existing } = await supabase
    .from('sign_contacts')
    .select('id')
    .eq('user_id', await sessionUserId())
    .ilike('email', signerEmail)
    .limit(1);
  if (existing && existing.length > 0) {
    contactId = existing[0].id as string;
    if (signer.name?.trim()) {
      await supabase.from('sign_contacts').update({ name: signer.name.trim() }).eq('id', contactId);
    }
  } else {
    const { data: contact } = await supabase
      .from('sign_contacts')
      .insert({ user_id: await sessionUserId(), name: signer.name?.trim() || signerEmail, email: signerEmail })
      .select('id')
      .single();
    contactId = contact?.id ?? null;
  }

  // Contrat → envoyé
  const { error: upErr } = await supabase
    .from('sign_contracts')
    .update({ access_token: token, status: 'sent', sent_at: nowIso, contact_id: contactId })
    .eq('id', contractId);
  if (upErr) throw upErr;

  // Faisceau de preuves : événement "sent"
  await supabase.from('sign_signature_events').insert({
    contract_id: contractId,
    contact_id: contactId,
    event_type: 'sent',
    email: signer.email,
  });

  // Récupère le titre pour l'email
  const { data: c } = await supabase.from('sign_contracts').select('title').eq('id', contractId).maybeSingle();
  const title = c?.title || 'Votre contrat';

  await sendSignatureEmail({ to: signer.email, name: signer.name, title, link, cc: opts?.copyTo });

  return { token, link };
}

async function sendSignatureEmail(opts: { to: string; name: string; title: string; link: string; cc?: string }) {
  const html = `
  <div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid #3A4242;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <span style="color:#F3F4F6;font-size:18px;font-weight:700;">CloseOS <span style="color:#CEFF8F;">Sign</span></span>
        </td></tr>
        <tr><td style="padding:8px 32px 0;">
          <h1 style="color:#ffffff;font-size:22px;margin:12px 0 8px;">Vous avez un document à signer</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 4px;">
            Bonjour ${opts.name || ''},<br/>
            Vous êtes invité(e) à signer le document : <strong style="color:#F3F4F6;">${opts.title}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <a href="${opts.link}" style="display:inline-block;background:#CEFF8F;color:#191E1E;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;">
            Consulter &amp; signer
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="color:#6b7280;font-size:11px;line-height:1.6;margin:0;">
            Ou copiez ce lien : <a href="${opts.link}" style="color:#CEFF8F;">${opts.link}</a><br/>
            Signature sécurisée — conformité RGPD.
          </p>
        </td></tr>
      </table>
    </td></tr></table>
  </div>`;

  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: 'support@closeos.fr', name: 'CloseOS Sign' },
      to: [{ email: opts.to }],
      ...(opts.cc ? { cc: [{ email: opts.cc }] } : {}),
      subject: `À signer : ${opts.title}`,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Email non envoyé (${res.status}) ${txt}`);
  }
}

/** Renvoie le lien de signature, en générant le token s'il n'existe pas encore. */
export async function getOrCreateSignLink(contractId: string): Promise<string> {
  const { data } = await supabase.from('sign_contracts').select('access_token').eq('id', contractId).maybeSingle();
  let token = data?.access_token as string | null | undefined;
  if (!token) {
    token = genToken();
    const { error } = await supabase.from('sign_contracts').update({ access_token: token }).eq('id', contractId);
    if (error) throw error;
  }
  return `${window.location.origin}/sign/s/${token}`;
}

// ───────────────────────── Signataires (multi-signataire) ─────────────────────────

/** Liste les signataires d'un contrat (avec whitelists — usage éditeur uniquement). */
export async function listSigners(contractId: string): Promise<SignSigner[]> {
  const { data, error } = await supabase
    .from('sign_contract_signers')
    .select('*')
    .eq('contract_id', contractId)
    .order('signer_index', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSignerRow);
}

/**
 * Fixe le nombre de signataires (1..10) : crée les lignes manquantes, supprime celles
 * au-delà (+ leurs champs libres ; les champs inline sont nettoyés par l'éditeur via data-signer).
 */
export async function setSignerCount(contractId: string, count: number): Promise<SignSigner[]> {
  const n = Math.max(1, Math.min(10, Math.floor(count)));
  const existing = await listSigners(contractId);
  const have = new Set(existing.map((s) => s.signerIndex));
  const toCreate: { contract_id: string; signer_index: number }[] = [];
  for (let i = 1; i <= n; i++) if (!have.has(i)) toCreate.push({ contract_id: contractId, signer_index: i });
  if (toCreate.length) {
    const { error } = await supabase.from('sign_contract_signers').insert(toCreate);
    if (error) throw error;
  }
  const removeIdx = existing.filter((s) => s.signerIndex > n).map((s) => s.signerIndex);
  if (removeIdx.length) {
    await supabase.from('sign_contract_fields').delete().eq('contract_id', contractId).in('signer_index', removeIdx);
    await supabase.from('sign_contract_signers').delete().eq('contract_id', contractId).in('signer_index', removeIdx);
  }
  await supabase.from('sign_contracts').update({ signer_count: n }).eq('id', contractId);
  return listSigners(contractId);
}

/** Met à jour un signataire (identité, whitelists, paiement requis, contact). */
export async function updateSigner(
  signerId: string,
  patch: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    contactId?: string | null;
    verificationEmails?: string[];
    verificationPhones?: string[];
    verificationPairs?: { email: string; phone: string }[];
    paymentRequired?: boolean;
  },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clean: Record<string, any> = {};
  if ('name' in patch) clean.name = (patch.name ?? '') || null;
  if ('email' in patch) clean.email = (patch.email ?? '') || null;
  if ('phone' in patch) clean.phone = (patch.phone ?? '') || null;
  if ('contactId' in patch) clean.contact_id = patch.contactId ?? null;
  if (patch.verificationEmails) clean.verification_emails = patch.verificationEmails;
  if (patch.verificationPhones) clean.verification_phones = patch.verificationPhones;
  if (patch.verificationPairs) clean.verification_pairs = patch.verificationPairs;
  if ('paymentRequired' in patch) clean.payment_required = !!patch.paymentRequired;
  if (!Object.keys(clean).length) return;
  const { error } = await supabase.from('sign_contract_signers').update(clean).eq('id', signerId);
  if (error) throw error;
}

/** Assigne un contact à un signataire + reprend son identité (préremplissage). */
export async function setSignerContact(
  signerId: string,
  contact: { id: string | null; name?: string; email?: string; phone?: string },
): Promise<void> {
  const { error } = await supabase
    .from('sign_contract_signers')
    .update({
      contact_id: contact.id ?? null,
      name: contact.name?.trim() || null,
      email: contact.email?.trim() || null,
      phone: contact.phone?.trim() || null,
    })
    .eq('id', signerId);
  if (error) throw error;
}

/** Lien de signature d'un signataire (génère le token si absent). */
export async function getOrCreateSignLinkForSigner(signerId: string): Promise<string> {
  const { data } = await supabase.from('sign_contract_signers').select('access_token').eq('id', signerId).maybeSingle();
  let token = data?.access_token as string | null | undefined;
  if (!token) {
    token = genToken();
    const { error } = await supabase.from('sign_contract_signers').update({ access_token: token }).eq('id', signerId);
    if (error) throw error;
  }
  return `${window.location.origin}/sign/s/${token}`;
}

/** Enregistre les valeurs des champs INLINE du signataire (résolu serveur par le token, anti-race). */
export async function setSignerInlineValues(token: string, values: Record<string, string>): Promise<void> {
  const { data, error } = await supabase.functions.invoke('sign-public', { body: { action: 'save-inline', token, values } });
  if (error || !data?.ok) throw new Error(data?.error || 'save_inline_failed');
}

/** Enregistre les valeurs des champs LIBRES remplis par le signataire (via Edge, validé serveur). */
export async function saveSignerFields(token: string, updates: { id: string; value: string }[], tzOffset: number): Promise<void> {
  const { data, error } = await supabase.functions.invoke('sign-public', { body: { action: 'save-fields', token, updates, tzOffset } });
  if (error || !data?.ok) throw new Error(data?.error || 'save_fields_failed');
}

/** Crée/maj un contact dans le carnet du PROPRIÉTAIRE du contrat (côté signataire, via Edge). */
export async function saveSignerContact(
  token: string,
  input: { name?: string; email: string; phone?: string; address?: string; city?: string; siret?: string; siren?: string; tva?: string; company_id?: string; ape?: string; details?: Record<string, string> },
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('sign-public', { body: { action: 'contact', token, ...input } });
  if (error || !data?.ok) throw new Error(data?.error || 'contact_failed');
}

/** Journalise un téléchargement du document signé (IP serveur via sign-event). */
export async function logDownloaded(token: string, email?: string, visitor?: string): Promise<void> {
  try {
    await supabase.functions.invoke('sign-event', { body: { token, type: 'downloaded', email, visitor } });
  } catch {
    /* best-effort */
  }
}

/**
 * Envoi multi-signataire. Parallèle : chacun reçoit son lien tout de suite. Séquentiel : seul
 * le 1er reçoit son mail maintenant (les suivants sont déclenchés côté serveur à chaque signature).
 * Réutilise le token existant d'un signataire s'il y en a un (cohérence avec « Copier le lien »).
 */
export async function sendForSignatureMulti(
  contractId: string,
  signers: { signerId: string; signerIndex: number; name: string; email: string }[],
  order: 'parallel' | 'sequential',
): Promise<{ links: { signerIndex: number; link: string }[] }> {
  const nowIso = new Date().toISOString();
  const { data: c } = await supabase.from('sign_contracts').select('title,source_type,content_html,pdf_data,document_hash').eq('id', contractId).maybeSingle();
  const title = c?.title || 'Votre contrat';
  // Empreinte du document ORIGINAL (ce qui est présenté au signataire) — figée une fois.
  if (c && !c.document_hash) {
    const presented = c.source_type === 'pdf' ? c.pdf_data || '' : c.content_html || '';
    if (presented) {
      try {
        await supabase.from('sign_contracts').update({ document_hash: await sha256Hex(presented) }).eq('id', contractId);
      } catch {
        /* non bloquant */
      }
    }
  }
  const sorted = [...signers].sort((a, b) => a.signerIndex - b.signerIndex);
  const firstIndex = sorted.length ? sorted[0].signerIndex : 1;
  const links: { signerIndex: number; link: string }[] = [];

  for (const s of sorted) {
    const email = (s.email || '').trim();
    const name = (s.name || '').trim();

    // Contact signataire (dédup par email)
    let contactId: string | null = null;
    if (email) {
      const { data: existing } = await supabase
        .from('sign_contacts')
        .select('id')
        .eq('user_id', await sessionUserId())
        .ilike('email', email)
        .limit(1);
      if (existing && existing.length > 0) {
        contactId = existing[0].id as string;
        if (name) await supabase.from('sign_contacts').update({ name }).eq('id', contactId);
      } else {
        const { data: ct } = await supabase
          .from('sign_contacts')
          .insert({ user_id: await sessionUserId(), name: name || email, email })
          .select('id')
          .single();
        contactId = ct?.id ?? null;
      }
    }

    // Token (réutilise l'existant pour ne pas casser un lien déjà copié)
    const { data: cur } = await supabase.from('sign_contract_signers').select('access_token').eq('id', s.signerId).maybeSingle();
    const token = (cur?.access_token as string | null) || genToken();
    const link = `${window.location.origin}/sign/s/${token}`;
    links.push({ signerIndex: s.signerIndex, link });

    const willSend = order === 'parallel' || s.signerIndex === firstIndex;
    await supabase
      .from('sign_contract_signers')
      .update({
        access_token: token,
        name: name || null,
        email: email || null,
        contact_id: contactId,
        status: willSend ? 'sent' : 'pending',
        sent_at: willSend ? nowIso : null,
      })
      .eq('id', s.signerId);

    if (willSend && email) {
      await supabase.from('sign_signature_events').insert({ contract_id: contractId, contact_id: contactId, event_type: 'sent', email });
      await sendSignatureEmail({ to: email, name, title, link });
    }
  }

  await supabase.from('sign_contracts').update({ status: 'sent', sent_at: nowIso }).eq('id', contractId);
  return { links };
}

/** Enregistre les valeurs saisies dans les champs + fuseau horaire du signataire. */
export async function saveFilledFields(updates: { id: string; value: string }[], tzOffset: number): Promise<void> {
  const nowIso = new Date().toISOString();
  for (const u of updates) {
    await supabase
      .from('sign_contract_fields')
      .update({ value: u.value, filled_at: nowIso, tz_offset: tzOffset })
      .eq('id', u.id);
  }
}

/** Marque le contrat signé + journalise l'événement (faisceau de preuves). */
export async function markContractSigned(contractId: string, email?: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await supabase.from('sign_contracts').update({ status: 'signed', signed_at: nowIso }).eq('id', contractId);
  await supabase.from('sign_signature_events').insert({
    contract_id: contractId,
    event_type: 'signed',
    email: email ?? null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    metadata: { tz_offset: new Date().getTimezoneOffset() },
  });
}

export type SignAnalytics = {
  signedAt: string | null;
  signedBy: string | null;
  pre: { views: number; uniques: number; lastAt: string | null };
  post: { views: number; uniques: number; downloads: number; lastAt: string | null };
};

/**
 * Suivi du lien de signature : vues + nombre de personnes différentes,
 * réparties pré-signature / post-signature.
 * "Personne différente" ≈ identifiant visiteur (localStorage, dans metadata.visitor),
 * à défaut le user_agent.
 */
export async function getContractAnalytics(contractId: string): Promise<SignAnalytics> {
  const { data: c } = await supabase
    .from('sign_contracts')
    .select('signed_at')
    .eq('id', contractId)
    .maybeSingle();
  const signedAt: string | null = (c as any)?.signed_at ?? null;

  const { data: events } = await supabase
    .from('sign_signature_events')
    .select('event_type,email,user_agent,metadata,created_at')
    .eq('contract_id', contractId)
    .in('event_type', ['opened', 'downloaded', 'signed'])
    .order('created_at', { ascending: true });

  const rows = (events ?? []) as any[];
  const signedTs = signedAt ? new Date(signedAt).getTime() : null;
  const visitorKey = (e: any): string => e?.metadata?.visitor || e?.user_agent || e?.id || 'inconnu';

  const pre = { views: 0, uniques: 0, lastAt: null as string | null };
  const post = { views: 0, uniques: 0, downloads: 0, lastAt: null as string | null };
  const preSet = new Set<string>();
  const postSet = new Set<string>();
  let signedBy: string | null = null;

  for (const e of rows) {
    if (e.event_type === 'signed') {
      signedBy = e.email ?? signedBy;
      continue;
    }
    const ts = e.created_at ? new Date(e.created_at).getTime() : 0;
    const isPost = signedTs != null && ts >= signedTs;
    const target = isPost ? post : pre;
    const set = isPost ? postSet : preSet;
    if (e.event_type === 'opened') {
      target.views++;
      set.add(visitorKey(e));
      target.lastAt = e.created_at;
    } else if (e.event_type === 'downloaded') {
      post.downloads++;
      post.lastAt = e.created_at;
    }
  }
  pre.uniques = preSet.size;
  post.uniques = postSet.size;
  return { signedAt, signedBy, pre, post };
}

/** Chargement public d'un contrat via le token d'UN signataire (page signataire). */
export async function getContractByToken(token: string): Promise<{
  id: string;
  title: string;
  content_html: string;
  status: string;
  source_type: 'text' | 'pdf';
  pdf_data: string | null;
  owner_email: string | null;
  theme: string;
  images: OverlayImage[];
  inline_values: Record<string, string>;
  verification_method: 'none' | 'email' | 'sms' | 'email_sms' | 'pay';
  verification_locked: boolean;
  verification_lock_reason: string | null;
  verification_lock_step: number | null;
  payment: SignPaymentConfig;
  fields: SignFreeField[];
  contact: Partial<SignContact> | null;
  // ── multi-signataire ──
  signing_order: 'parallel' | 'sequential';
  signerId: string | null;
  signerIndex: number;
  signerStatus: string;
  paymentRequired: boolean;
  paymentStatus: 'none' | 'pending' | 'paid';
  signers: { signerIndex: number; status: string; signedAt: string | null }[];
} | null> {
  // Lecture via l'Edge Function service_role (sign-public) : aucun accès direct anon aux tables.
  // L'assemblage du payload reste côté client (mapFieldRow/parsePayment), identique à avant.
  const { data: res, error } = await supabase.functions.invoke('sign-public', { body: { action: 'get', token } });
  if (error || !res?.ok || !res.contract) return null;
  const data = res.contract;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSigners = (res.signers ?? []) as any[];
  const sg = res.me;
  const meIndex = Number(sg?.signer_index) || 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const me: any =
    sg ??
    allSigners.find((s: any) => Number(s.signer_index) === meIndex) ?? {
      id: null,
      signer_index: 1,
      contact_id: data.contact_id ?? null,
      status: data.status,
      verification_locked: false,
      verification_lock_reason: null,
      verification_lock_step: null,
      payment_required: false,
      payment_status: 'none',
    };
  const contact: Partial<SignContact> | null = (res.contact ?? null) as Partial<SignContact> | null;
  const fields: SignFreeField[] = (res.fields ?? []).map(mapFieldRow);
  const inline_values: Record<string, string> = {
    ...((data.inline_values && typeof data.inline_values === 'object' ? data.inline_values : {}) as Record<string, string>),
  };
  for (const s of allSigners) if (s.inline_values && typeof s.inline_values === 'object') Object.assign(inline_values, s.inline_values);

  return {
    id: data.id,
    title: data.title,
    content_html: data.content_html ?? '',
    status: data.status,
    source_type: (data.source_type as 'text' | 'pdf') ?? 'text',
    pdf_data: data.pdf_data ?? null,
    owner_email: data.owner_email ?? null,
    theme: data.theme ?? 'blank',
    images: Array.isArray(data.images) ? data.images : [],
    inline_values,
    verification_method: (data.verification_method as 'none' | 'email' | 'sms' | 'email_sms' | 'pay') ?? 'none',
    verification_locked: !!me.verification_locked,
    verification_lock_reason: me.verification_lock_reason ?? null,
    verification_lock_step: me.verification_lock_step ?? null,
    payment: parsePayment(data),
    fields,
    contact,
    signing_order: (data.signing_order as 'parallel' | 'sequential') ?? 'parallel',
    signerId: me.id ?? null,
    signerIndex: meIndex,
    signerStatus: me.status ?? data.status,
    paymentRequired: !!me.payment_required,
    paymentStatus: (me.payment_status as 'none' | 'pending' | 'paid') ?? 'none',
    signers: (allSigners as any[]).map((s) => ({ signerIndex: Number(s.signer_index) || 1, status: s.status, signedAt: s.signed_at ?? null })),
  };
}

// ---------- Profil propriétaire (compte sign_users) ----------
export type OwnerProfile = {
  full_name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  siret: string;
  siren: string;
  tva: string;
  company_id: string;
  ape: string;
};

export async function getOwnerProfile(): Promise<OwnerProfile> {
  const { data } = await supabase
    .from('sign_users')
    .select('full_name,email,phone,company,address,city,siret,siren,tva,company_id,ape')
    .eq('id', await sessionUserId())
    .maybeSingle();
  const c = (data ?? {}) as any;
  return {
    full_name: c.full_name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    company: c.company ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    siret: c.siret ?? '',
    siren: c.siren ?? '',
    tva: c.tva ?? '',
    company_id: c.company_id ?? '',
    ape: c.ape ?? '',
  };
}

export async function updateOwnerProfile(patch: Partial<OwnerProfile>): Promise<void> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'email') continue; // email du compte non modifiable ici
    clean[k] = (v ?? '').toString().trim() || null;
  }
  const { error } = await supabase.from('sign_users').update(clean).eq('id', await sessionUserId());
  if (error) throw error;
}

// ---------- Contacts ----------
export type SignContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  siret: string;
  siren: string;
  tva: string;
  company_id: string;
  ape: string;
  details: Record<string, string>;
  created_at: string;
};

export async function listContacts(): Promise<SignContact[]> {
  const { data, error } = await supabase
    .from('sign_contacts')
    .select('id,name,email,phone,company,address,city,siret,siren,tva,company_id,ape,details,created_at')
    .eq('user_id', await sessionUserId())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    company: c.company ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    siret: c.siret ?? '',
    siren: c.siren ?? '',
    tva: c.tva ?? '',
    company_id: c.company_id ?? '',
    ape: c.ape ?? '',
    details: c.details ?? {},
    created_at: c.created_at,
  }));
}

/**
 * Relie au contact (par email) les valeurs des champs remplis par le signataire :
 * nom → name, email → email, tel → phone, adresse → address, ville → city,
 * et les autres (texte…) dans `details`. Crée le contact si l'email n'existe pas.
 * (Signature / date / heure ne sont pas reliés.)
 */
export async function upsertSignerContact(input: {
  name?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  siret?: string;
  siren?: string;
  tva?: string;
  company_id?: string;
  ape?: string;
  details?: Record<string, string>;
}): Promise<void> {
  const email = input.email.trim();
  if (!email) return;
  const patch: Record<string, any> = {};
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.phone?.trim()) patch.phone = input.phone.trim();
  if (input.address?.trim()) patch.address = input.address.trim();
  if (input.siret?.trim()) patch.siret = input.siret.trim();
  if (input.siren?.trim()) patch.siren = input.siren.trim();
  if (input.tva?.trim()) patch.tva = input.tva.trim();
  if (input.company_id?.trim()) patch.company_id = input.company_id.trim();
  if (input.ape?.trim()) patch.ape = input.ape.trim();

  const { data: existing } = await supabase
    .from('sign_contacts')
    .select('id,details')
    .eq('user_id', await sessionUserId())
    .ilike('email', email)
    .limit(1);

  if (existing && existing.length > 0) {
    const mergedDetails = { ...(existing[0].details || {}), ...(input.details || {}) };
    await supabase.from('sign_contacts').update({ ...patch, details: mergedDetails }).eq('id', existing[0].id);
  } else {
    const { error } = await supabase.from('sign_contacts').insert({
      user_id: await sessionUserId(),
      email,
      name: input.name?.trim() || email,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      siret: input.siret?.trim() || null,
      siren: input.siren?.trim() || null,
      tva: input.tva?.trim() || null,
      company_id: input.company_id?.trim() || null,
      ape: input.ape?.trim() || null,
      details: input.details || {},
    });
    if (error) throw error;
  }
}

/** Ajoute (ou met à jour si l'email existe déjà) un contact du propriétaire. */
export async function addContact(c: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  siret?: string;
  siren?: string;
  tva?: string;
  company_id?: string;
  ape?: string;
}): Promise<void> {
  const { data: existing } = await supabase
    .from('sign_contacts')
    .select('id')
    .eq('user_id', await sessionUserId())
    .ilike('email', c.email.trim())
    .limit(1);
  if (existing && existing.length > 0) {
    const patch: Record<string, any> = {};
    if (c.name?.trim()) patch.name = c.name.trim();
    if (c.phone?.trim()) patch.phone = c.phone.trim();
    if (c.address?.trim()) patch.address = c.address.trim();
    if (c.siret?.trim()) patch.siret = c.siret.trim();
    if (c.siren?.trim()) patch.siren = c.siren.trim();
    if (c.tva?.trim()) patch.tva = c.tva.trim();
    if (c.company_id?.trim()) patch.company_id = c.company_id.trim();
    if (c.ape?.trim()) patch.ape = c.ape.trim();
    if (Object.keys(patch).length) await supabase.from('sign_contacts').update(patch).eq('id', existing[0].id);
    return;
  }
  const { error } = await supabase.from('sign_contacts').insert({
    user_id: await sessionUserId(),
    name: c.name.trim() || c.email.trim(),
    email: c.email.trim(),
    phone: c.phone?.trim() || null,
    company: c.company?.trim() || null,
    address: c.address?.trim() || null,
    siret: c.siret?.trim() || null,
    siren: c.siren?.trim() || null,
    tva: c.tva?.trim() || null,
    company_id: c.company_id?.trim() || null,
    ape: c.ape?.trim() || null,
  });
  if (error) throw error;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('sign_contacts').delete().eq('id', id);
  if (error) throw error;
}

/** Récupère un contact par son id. */
export async function getContactById(id: string): Promise<SignContact | null> {
  const { data, error } = await supabase
    .from('sign_contacts')
    .select('id,name,email,phone,company,address,city,siret,siren,tva,company_id,ape,details,created_at')
    .eq('id', id)
    .eq('user_id', await sessionUserId())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const c = data as any;
  return {
    id: c.id,
    name: c.name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    company: c.company ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    siret: c.siret ?? '',
    siren: c.siren ?? '',
    tva: c.tva ?? '',
    company_id: c.company_id ?? '',
    ape: c.ape ?? '',
    details: c.details ?? {},
    created_at: c.created_at,
  };
}

/**
 * Met à jour un contact (fiche). Les chaînes vides sont stockées en NULL ;
 * `details` est remplacé tel quel (sert aussi à supprimer une clé enregistrée).
 */
export async function updateSignContact(
  id: string,
  patch: Partial<Pick<SignContact, 'name' | 'email' | 'phone' | 'address' | 'siret' | 'siren' | 'tva' | 'company_id' | 'ape' | 'details'>>,
): Promise<void> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'details') {
      clean.details = v ?? {};
      continue;
    }
    clean[k] = (v ?? '').toString().trim() || null;
  }
  const { error } = await supabase
    .from('sign_contacts')
    .update(clean)
    .eq('id', id)
    .eq('user_id', await sessionUserId());
  if (error) throw error;
}

export type ContactContract = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  sent_at: string | null;
  signed_at: string | null;
};

export type ContactActivity = {
  id: string;
  contractId: string;
  contractTitle: string;
  type: 'sent' | 'opened' | 'downloaded' | 'signed' | string;
  at: string;
};

/**
 * Dossier complet d'un contact pour sa fiche :
 * - les contrats qui lui sont assignés (sign_contracts.contact_id)
 * - son historique d'activité reconstruit depuis sign_signature_events
 *   (envoyé / ouvert / téléchargé / signé), tous contrats confondus.
 */
export async function getContactDossier(
  contactId: string,
): Promise<{ contracts: ContactContract[]; activity: ContactActivity[] }> {
  const { data: cData, error: cErr } = await supabase
    .from('sign_contracts')
    .select('id,title,status,updated_at,sent_at,signed_at')
    .eq('contact_id', contactId)
    .order('updated_at', { ascending: false });
  if (cErr) throw cErr;

  const contracts: ContactContract[] = (cData ?? []).map((c: any) => ({
    id: c.id,
    title: c.title ?? 'Sans titre',
    status: c.status ?? 'draft',
    updated_at: c.updated_at,
    sent_at: c.sent_at ?? null,
    signed_at: c.signed_at ?? null,
  }));

  if (contracts.length === 0) return { contracts, activity: [] };

  const titleById: Record<string, string> = {};
  contracts.forEach((c) => (titleById[c.id] = c.title));
  const ids = contracts.map((c) => c.id);

  const { data: eData, error: eErr } = await supabase
    .from('sign_signature_events')
    .select('id,contract_id,event_type,created_at')
    .in('contract_id', ids)
    .order('created_at', { ascending: false });
  if (eErr) throw eErr;

  const activity: ContactActivity[] = (eData ?? []).map((e: any) => ({
    id: e.id,
    contractId: e.contract_id,
    contractTitle: titleById[e.contract_id] ?? 'Contrat',
    type: e.event_type,
    at: e.created_at,
  }));

  return { contracts, activity };
}

/**
 * Retourne l'id d'un contact pour un email donné (le crée si besoin).
 * Utilisé par la vérification email : l'email autorisé crée/relie automatiquement un contact.
 */
export async function getOrCreateContactByEmail(email: string, name?: string): Promise<string> {
  const clean = email.trim();
  const { data: existing } = await supabase
    .from('sign_contacts')
    .select('id')
    .eq('user_id', await sessionUserId())
    .ilike('email', clean)
    .limit(1);
  if (existing && existing.length > 0) return existing[0].id as string;
  const { data, error } = await supabase
    .from('sign_contacts')
    .insert({ user_id: await sessionUserId(), name: name?.trim() || clean, email: clean })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Statistiques de l'accueil (basées sur les vrais contrats). */
export async function getSignStats(): Promise<{ signed: number; pending: number; depositCents: number }> {
  const { data, error } = await supabase
    .from('sign_contracts')
    .select('status,signed_at,paid_at,deposit_amount')
    .eq('user_id', await sessionUserId());
  if (error) throw error;
  const rows = data ?? [];
  const now = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let signed = 0;
  let pending = 0;
  let depositCents = 0;
  for (const r of rows as any[]) {
    if ((r.status === 'signed' || r.status === 'paid') && r.signed_at && new Date(r.signed_at).getTime() >= mStart) signed++;
    if (r.status === 'pending' || r.status === 'sent' || r.status === 'viewed') pending++;
    if (r.status === 'paid' && r.paid_at && new Date(r.paid_at).getTime() >= mStart) depositCents += r.deposit_amount || 0;
  }
  return { signed, pending, depositCents };
}

export async function listContractsWithCounts(): Promise<SignContractRow[]> {
  const { data, error } = await supabase
    .from('sign_contracts')
    .select('id,title,status,updated_at,content_html,contact_id,verification_method,payment_enabled,payment_status')
    .eq('user_id', await sessionUserId())
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const contracts = data ?? [];
  if (contracts.length === 0) return [];

  // Compte des champs libres par contrat
  const ids = contracts.map((c: any) => c.id);
  const { data: fieldRows } = await supabase
    .from('sign_contract_fields')
    .select('contract_id')
    .in('contract_id', ids)
    .eq('placement', 'free');
  const freeByContract: Record<string, number> = {};
  (fieldRows ?? []).forEach((r: any) => {
    freeByContract[r.contract_id] = (freeByContract[r.contract_id] ?? 0) + 1;
  });

  // Noms des contacts rattachés
  const contactIds = [...new Set(contracts.map((c: any) => c.contact_id).filter(Boolean))];
  const contactNames: Record<string, string> = {};
  if (contactIds.length) {
    const { data: cts } = await supabase.from('sign_contacts').select('id,name,email').in('id', contactIds);
    (cts ?? []).forEach((c: any) => {
      contactNames[c.id] = (c.name || c.email || '').trim();
    });
  }

  // État d'abonnement agrégé par contrat (l'état le plus « alertant » l'emporte : échec/annulé > actif)
  const subByContract: Record<string, string> = {};
  const { data: subRows } = await supabase
    .from('sign_contract_signers')
    .select('contract_id,subscription_status')
    .in('contract_id', ids)
    .not('subscription_status', 'is', null);
  const sevRank: Record<string, number> = { active: 1, trialing: 1, canceled: 3, unpaid: 4, past_due: 4, incomplete: 2 };
  (subRows ?? []).forEach((r: any) => {
    const cur = subByContract[r.contract_id];
    if (!cur || (sevRank[r.subscription_status] ?? 2) > (sevRank[cur] ?? 2)) subByContract[r.contract_id] = r.subscription_status;
  });

  return contracts.map((c: any) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    updated_at: c.updated_at,
    fields: countInlineFields(c.content_html) + (freeByContract[c.id] ?? 0),
    contactId: c.contact_id ?? null,
    contactName: c.contact_id ? contactNames[c.contact_id] ?? null : null,
    hasPayment: !!c.payment_enabled || (c.payment_status && c.payment_status !== 'none'),
    subscriptionStatus: subByContract[c.id] ?? null,
  }));
}

// ───────────────────────── Suivi des abonnements (observation, lecture proprio) ─────────────────────────
export type SignSubscriptionEvent = {
  id: string;
  signerId: string | null;
  type: string; // paid | failed | canceled
  billingReason: string | null;
  amountCents: number | null;
  currency: string | null;
  commissionCents: number | null;
  occurredAt: string;
};

/** Historique des événements d'abonnement/paiement d'un contrat (scopé proprio par RLS). */
export async function listSubscriptionEvents(contractId: string): Promise<SignSubscriptionEvent[]> {
  const { data, error } = await supabase
    .from('sign_subscription_events')
    .select('id,signer_id,type,billing_reason,amount_cents,currency,commission_cents,occurred_at')
    .eq('contract_id', contractId)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    signerId: r.signer_id ?? null,
    type: r.type,
    billingReason: r.billing_reason ?? null,
    amountCents: r.amount_cents ?? null,
    currency: r.currency ?? null,
    commissionCents: r.commission_cents ?? null,
    occurredAt: r.occurred_at,
  }));
}
