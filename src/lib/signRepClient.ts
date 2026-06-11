import { signSupabase } from './signSupabase';

/**
 * Client de l'espace closer (« rep ») — appelle l'Edge Function `sign-rep`.
 * L'accès repose sur le repToken (lien) + un appareil de confiance (deviceToken, 7 j)
 * obtenu après un code OTP envoyé à l'email du closer (renseigné par le propriétaire).
 */

const DEVICE_KEY = (repToken: string) => `closeos-sign-rep-dev-${repToken.slice(0, 16)}`;

export const getRepDeviceToken = (repToken: string): string | null => {
  try { return localStorage.getItem(DEVICE_KEY(repToken)); } catch { return null; }
};
export const setRepDeviceToken = (repToken: string, t: string) => {
  try { localStorage.setItem(DEVICE_KEY(repToken), t); } catch { /* noop */ }
};
export const clearRepDeviceToken = (repToken: string) => {
  try { localStorage.removeItem(DEVICE_KEY(repToken)); } catch { /* noop */ }
};

function fingerprint(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${navigator.userAgent}|${screen.width}x${screen.height}|${tz}`.slice(0, 200);
  } catch {
    return 'unknown';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callRep(action: string, repToken: string, payload: Record<string, unknown> = {}): Promise<any> {
  const { data, error } = await signSupabase.functions.invoke('sign-rep', { body: { action, repToken, ...payload } });
  if (error) throw error;
  return data;
}

export type RepDashboardInstance = {
  id: string;
  effectiveStatus: 'en_cours' | 'consulte' | 'signe' | 'paye' | 'expire' | 'refuse';
  createdAt: string;
  signedAt: string | null;
  expiresAt: string | null;
  signerName: string | null;
  signerEmail: string | null;
  signerToken: string | null;
  hasCertificate: boolean;
};
export type RepDashboard = {
  ok: boolean;
  label: string;
  templateTitle: string;
  verificationMethod: string;
  paymentEnabled: boolean;
  counts: { total: number; pending: number; signed: number; expired: number };
  instances: RepDashboardInstance[];
};

export async function repBootstrap(repToken: string): Promise<{ ok: boolean; trusted?: boolean; error?: string; maskedEmail?: string; label?: string; templateTitle?: string }> {
  return callRep('bootstrap', repToken, { deviceToken: getRepDeviceToken(repToken) });
}

export async function repVerifyCode(repToken: string, code: string): Promise<{ ok: boolean; error?: string; attemptsLeft?: number }> {
  const data = await callRep('verify-code', repToken, { code, deviceFingerprint: fingerprint(), deviceName: navigator.userAgent.slice(0, 120) });
  if (data?.ok && data.deviceToken) setRepDeviceToken(repToken, data.deviceToken);
  return data;
}

export async function repDashboard(repToken: string): Promise<RepDashboard> {
  return callRep('dashboard', repToken, { deviceToken: getRepDeviceToken(repToken) });
}

export async function repCreateLink(repToken: string, signer: { name?: string; email: string; phone?: string }): Promise<{ ok: boolean; error?: string; instanceId?: string; token?: string }> {
  return callRep('create-link', repToken, { deviceToken: getRepDeviceToken(repToken), signerName: signer.name ?? '', signerEmail: signer.email, signerPhone: signer.phone ?? '' });
}

export async function repRegenerate(repToken: string, instanceId: string): Promise<{ ok: boolean; error?: string; token?: string }> {
  return callRep('regenerate-link', repToken, { deviceToken: getRepDeviceToken(repToken), instanceId });
}

export const signerLinkFromToken = (token: string) =>
  `${typeof window !== 'undefined' ? window.location.origin : 'https://sign.closeos.fr'}/sign/s/${token}`;
