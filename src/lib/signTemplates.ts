import { signSupabase as supabase } from './signSupabase';

/**
 * CloseOS Sign — Contrats réutilisables (templates) côté PROPRIÉTAIRE.
 * Tout passe par des RPC SECURITY DEFINER qui valident auth.uid() = propriétaire du template.
 * Une « instance » est un contrat normal cloné (template_id non null) ; le flux de signature/
 * certificat existant s'applique tel quel. L'espace closer (« rep ») a son propre lien + 2FA.
 */

export type SignTemplateRep = {
  id: string;
  label: string;
  email: string;
  token: string;
  status: 'active' | 'revoked';
  revokedAt: string | null;
  createdAt: string;
  link: string; // /sign/rep/:token
};

export type SignInstanceRow = {
  id: string;
  status: string; // statut brut en base
  effectiveStatus: 'en_cours' | 'consulte' | 'signe' | 'paye' | 'expire' | 'refuse';
  createdAt: string;
  signedAt: string | null;
  expiresAt: string | null;
  repId: string | null;
  repLabel: string | null; // null = généré par le propriétaire
  signerName: string | null;
  signerEmail: string | null;
  signerToken: string | null;
  signLink: string | null; // lien signataire si encore en cours
  hasCertificate: boolean;
  certifiedAt: string | null;
};

const origin = () => (typeof window !== 'undefined' ? window.location.origin : 'https://sign.closeos.fr');
export const repLinkUrl = (token: string) => `${origin()}/sign/rep/${token}`;
export const signerLinkUrl = (token: string) => `${origin()}/sign/s/${token}`;

// ---------- Reps (espace closer) ----------
export async function listTemplateReps(templateId: string): Promise<SignTemplateRep[]> {
  const { data, error } = await supabase
    .from('sign_template_reps')
    .select('id,label,email,access_token,status,revoked_at,created_at')
    .eq('template_id', templateId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    label: r.label,
    email: r.email,
    token: r.access_token,
    status: r.status,
    revokedAt: r.revoked_at ?? null,
    createdAt: r.created_at,
    link: repLinkUrl(r.access_token),
  }));
}

export async function createTemplateRep(templateId: string, label: string, email: string): Promise<SignTemplateRep> {
  const { data, error } = await supabase.rpc('sign_create_template_rep', {
    p_template_id: templateId,
    p_label: label,
    p_email: email,
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = Array.isArray(data) ? data[0] : data;
  return {
    id: r.id,
    label: r.label,
    email: r.email,
    token: r.access_token,
    status: r.status,
    revokedAt: r.revoked_at ?? null,
    createdAt: r.created_at,
    link: repLinkUrl(r.access_token),
  };
}

export async function revokeTemplateRep(repId: string): Promise<void> {
  const { error } = await supabase.rpc('sign_revoke_template_rep', { p_rep_id: repId });
  if (error) throw error;
}

// ---------- Génération / recyclage de liens (propriétaire) ----------
export async function generateOwnerLink(
  templateId: string,
  signer: { name?: string; email: string; phone?: string },
): Promise<{ instanceId: string; token: string; link: string }> {
  const { data, error } = await supabase.rpc('sign_owner_generate_link', {
    p_template_id: templateId,
    p_signer_name: signer.name ?? '',
    p_signer_email: signer.email,
    p_signer_phone: signer.phone ?? '',
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = Array.isArray(data) ? data[0] : data;
  return { instanceId: row.instance_id, token: row.signer_token, link: signerLinkUrl(row.signer_token) };
}

export async function regenerateInstance(instanceId: string): Promise<{ token: string; link: string }> {
  const { data, error } = await supabase.rpc('sign_owner_regenerate_instance', { p_instance_id: instanceId });
  if (error) throw error;
  const token = String(data);
  return { token, link: signerLinkUrl(token) };
}

// ---------- Instances d'un template ----------
function effectiveStatus(status: string, expiresAt: string | null): SignInstanceRow['effectiveStatus'] {
  if (status === 'paid') return 'paye';
  if (status === 'signed') return 'signe';
  if (status === 'declined' || status === 'cancelled') return 'refuse';
  const expired = !!expiresAt && new Date(expiresAt).getTime() < Date.now();
  if (expired || status === 'expired') return 'expire';
  if (status === 'viewed') return 'consulte';
  return 'en_cours';
}

export async function listTemplateInstances(templateId: string): Promise<SignInstanceRow[]> {
  const { data: instances, error } = await supabase
    .from('sign_contracts')
    .select('id,status,created_at,signed_at,expires_at,rep_id,certificate_id,certified_at')
    .eq('template_id', templateId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = instances ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r: any) => r.id);
  const { data: signers } = await supabase
    .from('sign_contract_signers')
    .select('contract_id,name,email,access_token,status')
    .in('contract_id', ids)
    .eq('signer_index', 1);
  const signerByContract: Record<string, any> = {};
  (signers ?? []).forEach((s: any) => {
    signerByContract[s.contract_id] = s;
  });

  const repIds = [...new Set(rows.map((r: any) => r.rep_id).filter(Boolean))];
  const repLabels: Record<string, string> = {};
  if (repIds.length) {
    const { data: reps } = await supabase.from('sign_template_reps').select('id,label').in('id', repIds);
    (reps ?? []).forEach((r: any) => {
      repLabels[r.id] = r.label;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((r: any) => {
    const s = signerByContract[r.id];
    const eff = effectiveStatus(r.status, r.expires_at);
    const active = eff === 'en_cours' || eff === 'consulte';
    return {
      id: r.id,
      status: r.status,
      effectiveStatus: eff,
      createdAt: r.created_at,
      signedAt: r.signed_at ?? null,
      expiresAt: r.expires_at ?? null,
      repId: r.rep_id ?? null,
      repLabel: r.rep_id ? repLabels[r.rep_id] ?? null : null,
      signerName: s?.name ?? null,
      signerEmail: s?.email ?? null,
      signerToken: s?.access_token ?? null,
      signLink: active && s?.access_token ? signerLinkUrl(s.access_token) : null,
      hasCertificate: !!r.certificate_id || !!r.certified_at,
      certifiedAt: r.certified_at ?? null,
    };
  });
}
