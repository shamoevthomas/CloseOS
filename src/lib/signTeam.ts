import { signSupabase as supabase } from './signSupabase';

/* ─────────── Types ─────────── */
export type SignTeamMember = {
  id: string;
  owner_id: string;
  user_id: string | null;
  business_team_member_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: 'invited' | 'active' | 'revoked';
  source: string;
  created_at: string;
  joined_at: string | null;
};

export type SignTeamInvite = {
  id: string;
  token: string;
  email: string | null;
  first_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type MemberInstanceStatus = 'en_cours' | 'consulte' | 'signe' | 'paye' | 'expire' | 'refuse';
export type MemberInstance = {
  id: string;
  title: string;
  templateId: string | null;
  effectiveStatus: MemberInstanceStatus;
  createdAt: string;
  signedAt: string | null;
  expiresAt: string | null;
  signerName: string | null;
  signerEmail: string | null;
  signerToken: string | null;
  hasCertificate: boolean;
};

export type MemberBootstrap = {
  member_id: string;
  owner_id: string;
  owner_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  templates: { id: string; title: string }[];
};

const REP_LINK_BASE = () => (typeof window !== 'undefined' ? window.location.origin : 'https://sign.closeos.fr');
export const signerLink = (token: string) => `${REP_LINK_BASE()}/sign/s/${token}`;

function effectiveStatus(status: string, expiresAt: string | null): MemberInstanceStatus {
  if (status === 'paid') return 'paye';
  if (status === 'signed') return 'signe';
  if (status === 'declined' || status === 'cancelled') return 'refuse';
  const expired = !!expiresAt && new Date(expiresAt).getTime() < Date.now();
  if (expired || status === 'expired') return 'expire';
  if (status === 'viewed') return 'consulte';
  return 'en_cours';
}

/* ─────────── Côté ÉQUIPIER ─────────── */

/** Contexte de l'équipier connecté (null s'il n'est pas un membre actif). */
export async function memberBootstrap(): Promise<MemberBootstrap | null> {
  const { data, error } = await supabase.rpc('sign_member_bootstrap');
  if (error || !data) return null;
  return data as MemberBootstrap;
}

/** Toutes les instances générées par l'équipier connecté (via RPC SECURITY DEFINER). */
export async function memberListInstances(): Promise<MemberInstance[]> {
  const { data, error } = await supabase.rpc('sign_member_list_instances');
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    title: r.title || 'Contrat',
    templateId: r.template_id ?? null,
    effectiveStatus: effectiveStatus(r.status, r.expires_at),
    createdAt: r.created_at,
    signedAt: r.signed_at ?? null,
    expiresAt: r.expires_at ?? null,
    signerName: r.signer_name ?? null,
    signerEmail: r.signer_email ?? null,
    signerToken: r.signer_token ?? null,
    hasCertificate: !!r.certificate_id,
  }));
}

/** Génère une instance signable à partir d'un template assigné. */
export async function memberGenerateLink(
  templateId: string,
  signer: { name?: string; email: string; phone?: string },
): Promise<{ instanceId: string; token: string; link: string }> {
  const { data, error } = await supabase.rpc('sign_member_generate_link', {
    p_template_id: templateId,
    p_signer_name: signer.name ?? '',
    p_signer_email: signer.email,
    p_signer_phone: signer.phone ?? '',
  });
  if (error) throw error;
  const row: any = Array.isArray(data) ? data[0] : data;
  return { instanceId: row.instance_id, token: row.signer_token, link: signerLink(row.signer_token) };
}

export async function memberRegenerate(instanceId: string): Promise<{ token: string; link: string }> {
  const { data, error } = await supabase.rpc('sign_member_regenerate_instance', { p_instance_id: instanceId });
  if (error) throw error;
  const token = String(data);
  return { token, link: signerLink(token) };
}

/* ─────────── Connecteur MCP (côté owner) ─────────── */

export const mcpConnectorUrl = (key: string) => `https://sign.closeos.fr/api/mcp/${key}`;

export async function getMcpKey(): Promise<string | null> {
  const { data } = await supabase.rpc('sign_get_mcp_key');
  return (data as string) || null;
}

export async function generateMcpKey(): Promise<string> {
  const { data, error } = await supabase.rpc('sign_generate_mcp_key');
  if (error) throw error;
  return data as string;
}

export async function revokeMcpKey(): Promise<void> {
  const { error } = await supabase.rpc('sign_revoke_mcp_key');
  if (error) throw error;
}

/* ─────────── Invitations (côté invité) ─────────── */

export async function getInviteInfo(token: string): Promise<{ valid: boolean; reason?: string; owner_name?: string; email?: string | null; first_name?: string | null }> {
  const { data } = await supabase.rpc('sign_invite_info', { p_token: token });
  return (data as any) ?? { valid: false };
}

export async function acceptInvite(token: string): Promise<{ owner_id: string; member_id: string }> {
  const { data, error } = await supabase.rpc('sign_accept_team_invite', { p_token: token });
  if (error) throw error;
  return data as any;
}

/* ─────────── Côté OWNER ─────────── */

export async function listTeamMembers(): Promise<SignTeamMember[]> {
  const { data } = await supabase.from('sign_team_members').select('*').order('created_at', { ascending: true });
  return (data as SignTeamMember[]) ?? [];
}

export async function setMemberStatus(id: string, status: 'active' | 'revoked'): Promise<void> {
  const { error } = await supabase.from('sign_team_members').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('sign_team_members').delete().eq('id', id);
  if (error) throw error;
}

export async function listInvites(): Promise<SignTeamInvite[]> {
  const { data } = await supabase.from('sign_team_invites').select('*').is('accepted_at', null).order('created_at', { ascending: false });
  return (data as SignTeamInvite[]) ?? [];
}

export async function createInvite(email?: string, firstName?: string): Promise<{ token: string; link: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const ownerId = sess.session?.user?.id;
  if (!ownerId) throw new Error('non_connecte');
  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');
  const { error } = await supabase.from('sign_team_invites').insert({
    owner_id: ownerId, token, email: email?.trim() || null, first_name: firstName?.trim() || null,
  });
  if (error) throw error;
  return { token, link: `${REP_LINK_BASE()}/sign/join/${token}` };
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await supabase.from('sign_team_invites').delete().eq('id', id);
  if (error) throw error;
}

/** Provisionne les équipiers Sign depuis l'équipe Business de l'owner. Renvoie le nb traité. */
export async function syncBusinessTeam(): Promise<number> {
  const { data, error } = await supabase.rpc('sign_sync_business_team');
  if (error) throw error;
  return Number(data) || 0;
}

/* ─── Assignation de templates aux équipiers ─── */

export async function listOwnerTemplates(): Promise<{ id: string; title: string }[]> {
  const { data } = await supabase.from('sign_contracts').select('id,title').eq('is_template', true).order('title');
  return (data as { id: string; title: string }[]) ?? [];
}

export async function listMemberTemplateIds(memberId: string): Promise<string[]> {
  const { data } = await supabase.from('sign_template_members').select('template_id').eq('team_member_id', memberId);
  return (data ?? []).map((r: any) => r.template_id);
}

/** Membres d'équipe assignés à un template donné. */
export async function listTemplateMemberIds(templateId: string): Promise<string[]> {
  const { data } = await supabase.from('sign_template_members').select('team_member_id').eq('template_id', templateId);
  return (data ?? []).map((r: any) => r.team_member_id);
}

export async function assignTemplate(templateId: string, memberId: string): Promise<void> {
  const { error } = await supabase.from('sign_template_members').insert({ template_id: templateId, team_member_id: memberId });
  if (error && error.code !== '23505') throw error; // ignore doublon
}

export async function unassignTemplate(templateId: string, memberId: string): Promise<void> {
  const { error } = await supabase.from('sign_template_members').delete().eq('template_id', templateId).eq('team_member_id', memberId);
  if (error) throw error;
}
