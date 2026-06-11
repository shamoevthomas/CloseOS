/**
 * Auth CloseOS Sign — vraie auth Supabase (client dédié `signSupabase`, session isolée).
 * Le propriétaire est un utilisateur `auth.users` AVEC une ligne `sign_users` (id = auth.uid()),
 * SANS profil Sales (séparation des comptes préservée côté DB). Connexion email + mot de passe.
 */
import { useEffect, useRef, useState } from 'react';
import { signSupabase } from './signSupabase';

export type SignOwner = { id: string; email: string; name: string };

/** Vrai si l'utilisateur auth possède un compte Sign (ligne sign_users = propriétaire Sign). */
async function hasSignAccess(userId: string): Promise<boolean> {
  const { data } = await signSupabase.from('sign_users').select('id').eq('id', userId).maybeSingle();
  return !!data;
}

/** Connexion email + mot de passe. Refuse si pas de compte Sign (ex. compte Sales sans Business). */
export async function signInSign(email: string, password: string): Promise<{ ok: boolean; error?: string; userId?: string; email?: string }> {
  const { data, error } = await signSupabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return { ok: false, error: error?.message || 'invalid' };
  if (!(await hasSignAccess(data.user.id))) {
    await signSupabase.auth.signOut();
    return { ok: false, error: 'not_sign_owner' };
  }
  return { ok: true, userId: data.user.id, email: data.user.email ?? email.trim() };
}

/** Démarre la connexion Google (OAuth PKCE). Le retour est traité par completeOAuthRedirect() sur /sign/login. */
export async function signInWithGoogle(): Promise<{ error?: string }> {
  const { error } = await signSupabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/sign/login`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  return { error: error?.message };
}

/**
 * À l'ouverture de /sign/login : si on revient d'un OAuth (`?code=…`), échange le code contre une session,
 * vérifie l'accès Sign, et déconnecte si le compte n'a pas de Sign. `handled=false` si ce n'est pas un retour OAuth.
 */
export async function completeOAuthRedirect(): Promise<{ handled: boolean; ok: boolean; error?: string; userId?: string; email?: string }> {
  if (typeof window === 'undefined') return { handled: false, ok: false };
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const oauthErr = params.get('error_description') || params.get('error');
  if (!code && !oauthErr) return { handled: false, ok: false };

  window.history.replaceState({}, '', window.location.pathname); // retire code/state/error de l'URL
  if (oauthErr) return { handled: true, ok: false, error: oauthErr };

  const { data, error } = await signSupabase.auth.exchangeCodeForSession(code as string);
  if (error || !data.session?.user) return { handled: true, ok: false, error: error?.message || 'oauth' };
  if (!(await hasSignAccess(data.session.user.id))) {
    await signSupabase.auth.signOut();
    return { handled: true, ok: false, error: 'not_sign_owner' };
  }
  return { handled: true, ok: true, userId: data.session.user.id, email: data.session.user.email ?? undefined };
}

/** Détecte un lien de réinitialisation (`#type=recovery`) et ouvre la session de récupération. */
export async function consumeRecoveryLink(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (h.get('type') !== 'recovery') return false;
  const access_token = h.get('access_token');
  const refresh_token = h.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  window.history.replaceState({}, '', window.location.pathname);
  const { error } = await signSupabase.auth.setSession({ access_token, refresh_token });
  return !error;
}

/** Envoie l'email de réinitialisation du mot de passe (retour sur /sign/login). */
export async function sendPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await signSupabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/sign/login`,
  });
  return { ok: !error, error: error?.message };
}

/** Définit un nouveau mot de passe (en session de récupération) puis vérifie l'accès Sign. */
export async function updatePassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await signSupabase.auth.updateUser({ password });
  if (error || !data.user) return { ok: false, error: error?.message || 'update' };
  if (!(await hasSignAccess(data.user.id))) {
    await signSupabase.auth.signOut();
    return { ok: false, error: 'not_sign_owner' };
  }
  return { ok: true };
}

/** Change le mot de passe depuis les paramètres : ré-authentifie avec l'ancien, puis met à jour. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { data: sess } = await signSupabase.auth.getSession();
  const email = sess.session?.user?.email;
  if (!email) return { ok: false, error: 'not_authenticated' };
  const { error: reauth } = await signSupabase.auth.signInWithPassword({ email, password: currentPassword });
  if (reauth) return { ok: false, error: 'wrong_current' };
  const { error } = await signSupabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOutSign(): Promise<void> {
  await signSupabase.auth.signOut();
}

/** Id du propriétaire connecté (= auth.uid()), ou null. Utilisé par la couche données. */
export async function currentOwnerId(): Promise<string | null> {
  const { data } = await signSupabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Hook : propriétaire Sign courant (session + ligne sign_users). `loading` tant qu'indéterminé. */
export function useSignOwner(): { loading: boolean; owner: SignOwner | null } {
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState<SignOwner | null>(null);
  const loadedRef = useRef<string | null | undefined>(undefined); // dernier user id chargé (undefined = jamais)

  useEffect(() => {
    let active = true;
    const load = async (userId?: string, email?: string) => {
      loadedRef.current = userId ?? null;
      if (!userId) {
        if (active) {
          setOwner(null);
          setLoading(false);
        }
        return;
      }
      const { data: row } = await signSupabase.from('sign_users').select('id,email,full_name').eq('id', userId).maybeSingle();
      if (!active) return;
      setOwner(row ? { id: row.id, email: row.email ?? email ?? '', name: row.full_name || row.email || 'Propriétaire' } : null);
      setLoading(false);
    };
    signSupabase.auth.getSession().then(({ data }) => load(data.session?.user?.id, data.session?.user?.email));
    const { data: sub } = signSupabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      // Évite le « rechargement » au retour d'onglet : on ignore le refresh de token et les
      // événements pour le même utilisateur déjà chargé (sinon flicker de loading sur toute l'app).
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      if (loadedRef.current !== undefined && uid === loadedRef.current) return;
      setLoading(true);
      load(session?.user?.id, session?.user?.email);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, owner };
}
