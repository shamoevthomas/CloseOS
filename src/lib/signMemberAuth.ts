import { useEffect, useRef, useState } from 'react';
import { signSupabase } from './signSupabase';
import { memberBootstrap, type MemberBootstrap } from './signTeam';

/** Hook : contexte de l'équipier Sign connecté (null s'il n'est pas un membre actif). */
export function useSignMember(): { loading: boolean; member: MemberBootstrap | null } {
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<MemberBootstrap | null>(null);
  const loadedRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const load = async (userId?: string) => {
      loadedRef.current = userId ?? null;
      if (!userId) { if (active) { setMember(null); setLoading(false); } return; }
      const m = await memberBootstrap();
      if (!active) return;
      setMember(m);
      setLoading(false);
    };
    signSupabase.auth.getSession().then(({ data }) => load(data.session?.user?.id));
    const { data: sub } = signSupabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      if (loadedRef.current !== undefined && uid === loadedRef.current) return;
      setLoading(true);
      load(session?.user?.id);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  return { loading, member };
}
