/**
 * CloseOS Sign — vérification d'appareil (2FA) côté client.
 * Empreinte stable par navigateur + token d'appareil de confiance (7 jours, géré serveur).
 * Endpoints serveur : /api/sign-send-verification-code, /api/sign-verify-code, /api/sign-check-device.
 */
import { useCallback, useEffect, useState } from 'react';
import { signSupabase } from './signSupabase';

const FP_KEY = 'closeos_sign_device_id';
const TOKEN_KEY = 'closeos_sign_device_token';

/** Empreinte d'appareil persistante (par navigateur). */
export function getSignDeviceFingerprint(): string {
  let id = localStorage.getItem(FP_KEY);
  if (!id) {
    const rand = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    id = `${rand}-${navigator.userAgent.slice(0, 50).replace(/\s/g, '_')}`;
    localStorage.setItem(FP_KEY, id);
  }
  return id;
}

/** L'appareil est-il déjà de confiance (token valide < 7 j) ? */
export async function isDeviceTrusted(userId: string): Promise<boolean> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return false;
  try {
    const res = await fetch('/api/sign-check-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, device_fingerprint: getSignDeviceFingerprint(), token }),
    });
    const data = await res.json();
    return !!data.verified;
  } catch {
    return false;
  }
}

/** Envoie le code de vérification par email. */
export async function sendDeviceCode(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/sign-send-verification-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'send_failed' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'send_failed' };
  }
}

/** Vérifie le code ; en cas de succès, mémorise l'appareil (token 7 j en localStorage). */
export async function verifyDeviceCode(userId: string, code: string, authMethod: 'google' | 'classic'): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/sign-verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, code, device_fingerprint: getSignDeviceFingerprint(), auth_method: authMethod }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'invalid' };
    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'invalid' };
  }
}

async function bearerHeaders(): Promise<Record<string, string>> {
  const { data } = await signSupabase.auth.getSession();
  const t = data.session?.access_token;
  return t
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
    : { 'Content-Type': 'application/json' };
}

export type TrustedDevice = {
  id: string;
  device_name: string | null;
  location: string | null;
  last_ip: string | null;
  created_at: string;
  expires_at: string;
  current: boolean;
};

/** Liste les appareils de confiance du propriétaire (Paramètres > Sécurité). */
export async function listTrustedDevices(): Promise<TrustedDevice[]> {
  try {
    const res = await fetch('/api/sign-list-devices', {
      method: 'POST',
      headers: await bearerHeaders(),
      body: JSON.stringify({ device_fingerprint: getSignDeviceFingerprint() }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.devices ?? []) as TrustedDevice[];
  } catch {
    return [];
  }
}

/** Révoque un appareil de confiance par id. */
export async function revokeTrustedDevice(id: string): Promise<boolean> {
  try {
    const res = await fetch('/api/sign-revoke-device-id', {
      method: 'POST',
      headers: await bearerHeaders(),
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Révoque TOUS les appareils (déconnexion partout) + oublie l'appareil courant. */
export async function revokeAllTrustedDevices(): Promise<boolean> {
  try {
    const res = await fetch('/api/sign-revoke-all-devices', {
      method: 'POST',
      headers: await bearerHeaders(),
      body: JSON.stringify({}),
    });
    if (res.ok) localStorage.removeItem(TOKEN_KEY);
    return res.ok;
  } catch {
    return false;
  }
}

export type DeviceTrustState = 'checking' | 'trusted' | 'untrusted';

/**
 * Suit l'état de confiance de l'appareil pour un propriétaire.
 * 'checking' tant que l'owner est absent ou que la vérification est en cours.
 * `recheck()` relance la vérification (après une validation de code réussie).
 */
export function useDeviceTrust(ownerId: string | null | undefined): { state: DeviceTrustState; recheck: () => void } {
  const [state, setState] = useState<DeviceTrustState>('checking');
  const [nonce, setNonce] = useState(0);
  const recheck = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    if (!ownerId) {
      setState('checking');
      return;
    }
    setState('checking');
    isDeviceTrusted(ownerId).then((ok) => {
      if (active) setState(ok ? 'trusted' : 'untrusted');
    });
    return () => {
      active = false;
    };
  }, [ownerId, nonce]);
  return { state, recheck };
}
