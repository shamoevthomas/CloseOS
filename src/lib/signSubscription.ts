/**
 * CloseOS Sign — abonnement propriétaire (côté client).
 * Flux carte intégrée (Stripe Elements) : SetupIntent → register (compte + abonnement essai 14 j).
 * Gating : exempt (Business) / actif / grâce 3 j / bloqué.
 */
import { signSupabase } from './signSupabase';

export type SignBillingCycle = 'monthly' | 'quarterly' | 'annual';

export type SignSubscription = {
  status: string | null; // trialing | active | past_due | canceled | unpaid | null
  cycle: string | null;
  currentPeriodEnd: string | null;
  exempt: boolean; // compte Business / test : jamais bloqué
};

export type SignAccess = 'ok' | 'grace' | 'blocked';

const GRACE_DAYS = 3;

export const isSubActive = (s: string | null | undefined) => s === 'active' || s === 'trialing';

/** État d'accès déduit de l'abonnement (fail-open : on ne bloque que sur un statut explicitement mauvais). */
export function subAccessState(sub: SignSubscription | null): SignAccess {
  if (!sub || sub.exempt) return 'ok';
  if (isSubActive(sub.status)) return 'ok';
  if (sub.status === 'past_due' && sub.currentPeriodEnd) {
    const deadline = new Date(sub.currentPeriodEnd).getTime() + GRACE_DAYS * 86400000;
    return Date.now() < deadline ? 'grace' : 'blocked';
  }
  if (sub.status === null) return 'ok'; // pas d'abonnement connu → on ne bloque pas par défaut
  return 'blocked'; // canceled / unpaid / incomplete_expired / past_due expiré
}

async function bearerHeaders(): Promise<Record<string, string>> {
  const { data } = await signSupabase.auth.getSession();
  const t = data.session?.access_token;
  return t
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
    : { 'Content-Type': 'application/json' };
}

/** Crée un SetupIntent (carte) — pour le PaymentElement. */
export async function createSignSetupIntent(): Promise<{ clientSecret?: string; error?: string }> {
  try {
    const res = await fetch('/api/sign-setup-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await res.json();
    if (!res.ok) return { error: d.error || 'setup_failed' };
    return { clientSecret: d.clientSecret };
  } catch (e: any) {
    return { error: e?.message || 'setup_failed' };
  }
}

/** Crée le compte Sign + l'abonnement (essai 14 j) côté serveur, après confirmation de la carte. */
export async function registerSign(p: {
  setup_intent_id: string;
  cycle: SignBillingCycle;
  email: string;
  name: string;
  phone: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/sign-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup_intent_id: p.setup_intent_id,
        cycle: p.cycle,
        user_email: p.email,
        user_name: p.name,
        user_phone: p.phone,
        user_password: p.password,
      }),
    });
    const d = await res.json();
    if (!res.ok) return { ok: false, error: d.error || 'register_failed' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'register_failed' };
  }
}

/** Ouvre le portail de facturation Stripe (gérer / régler) — redirige. */
export async function openSignBillingPortal(): Promise<{ error?: string }> {
  try {
    const res = await fetch('/api/sign-portal', {
      method: 'POST',
      headers: await bearerHeaders(),
      body: JSON.stringify({ origin: window.location.origin }),
    });
    const d = await res.json();
    if (!res.ok || !d.url) return { error: d.error || 'portal_failed' };
    window.location.href = d.url;
    return {};
  } catch (e: any) {
    return { error: e?.message || 'portal_failed' };
  }
}

/** Abonnement courant (lecture directe sign_users, autorisée au propriétaire). */
export async function getSignSubscription(): Promise<SignSubscription> {
  const { data: s } = await signSupabase.auth.getSession();
  const uid = s.session?.user?.id;
  if (!uid) return { status: null, cycle: null, currentPeriodEnd: null, exempt: false };
  const { data } = await signSupabase
    .from('sign_users')
    .select('subscription_status, subscription_cycle, current_period_end, subscription_exempt')
    .eq('id', uid)
    .maybeSingle();
  const r = (data ?? {}) as any;
  return {
    status: r.subscription_status ?? null,
    cycle: r.subscription_cycle ?? null,
    currentPeriodEnd: r.current_period_end ?? null,
    exempt: !!r.subscription_exempt,
  };
}
