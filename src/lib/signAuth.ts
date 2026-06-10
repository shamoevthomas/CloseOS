/**
 * Auth CloseOS Sign — vraie auth Supabase (client dédié `signSupabase`, session isolée).
 * Le propriétaire est un utilisateur `auth.users` AVEC une ligne `sign_users` (id = auth.uid()),
 * SANS profil Sales (séparation des comptes préservée côté DB). Connexion email + mot de passe.
 */
import { useEffect, useState } from 'react';
import { signSupabase } from './signSupabase';

export type SignOwner = { id: string; email: string; name: string };

/** Connexion. Refuse si l'utilisateur n'a pas de ligne sign_users (= pas un propriétaire Sign). */
export async function signInSign(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await signSupabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return { ok: false, error: error?.message || 'invalid' };
  const { data: row } = await signSupabase.from('sign_users').select('id').eq('id', data.user.id).maybeSingle();
  if (!row) {
    await signSupabase.auth.signOut();
    return { ok: false, error: 'not_sign_owner' };
  }
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

  useEffect(() => {
    let active = true;
    const load = async (userId?: string, email?: string) => {
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
    const { data: sub } = signSupabase.auth.onAuthStateChange((_e, session) => {
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
