import { signSupabase as supabase } from './signSupabase';
import { buildCertificatePdf, type CertData } from './signCertificatePdf';

export type { CertData } from './signCertificatePdf';

/**
 * Scellement serveur (lot 3) : le PDF d'origine est signé et certifié côté serveur. Renvoie true si
 * le contrat est certifié (maintenant ou avant) ; false pour un contrat texte ou en cas d'échec, où
 * la page retombe sur generateCertificate (chemin navigateur).
 */
export async function tryServerCertificate(args: { token?: string; contractId?: string }): Promise<boolean> {
  const key = args.token ? { token: args.token } : { contractId: args.contractId };
  const { data, error } = await supabase.functions.invoke('sign-certificate', { body: { action: 'server-seal', ...key } });
  return !error && !!data?.ok;
}

/**
 * Génère le certificat : seal (hash serveur du doc) → rendu des pages → finalize (merge + scellement).
 * `signedPdfDataUri` = le PDF du document signé (rendu fidèle, via buildSignedPdfBlob).
 * Idempotent côté serveur : si déjà certifié, ne régénère pas.
 */
export async function generateCertificate(args: { token?: string; contractId?: string; signedPdfDataUri: string }): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  const key = args.token ? { token: args.token } : { contractId: args.contractId };
  const { data: sealed, error: e1 } = await supabase.functions.invoke('sign-certificate', { body: { action: 'seal', ...key, sealedPdfB64: args.signedPdfDataUri } });
  if (e1 || !sealed?.ok) return { ok: false, error: sealed?.error || 'seal_failed' };
  if (sealed.already) return { ok: true, already: true };
  const certUri = (await buildCertificatePdf(sealed as CertData)) as string;
  const { data: fin, error: e2 } = await supabase.functions.invoke('sign-certificate', { body: { action: 'finalize', ...key, certPdfB64: certUri } });
  if (e2 || !fin?.ok) return { ok: false, error: fin?.error || 'finalize_failed' };
  return { ok: true };
}

/** URL signée (temporaire) du certificat final stocké (source unique). */
export async function getCertificateUrl(args: { token?: string; contractId?: string }): Promise<string | null> {
  const key = args.token ? { token: args.token } : { contractId: args.contractId };
  const { data } = await supabase.functions.invoke('sign-certificate', { body: { action: 'get', ...key } });
  return data?.ok ? (data.url as string) : null;
}
