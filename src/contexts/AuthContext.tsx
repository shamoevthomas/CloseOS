import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { trackFirstPromoterReferral } from '../lib/firstpromoter';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  // Role admin simple : base uniquement sur l'email
  const isAdmin = user?.email === 'shamoovthomas@gmail.com';

  // Founder : base sur le statut d'abonnement
  const subscriptionStatus = profile?.subscription_status;
  const isFounder = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else if (isMountedRef.current) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Exception fetching profile:', err);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Safety timeout absolu : si rien ne se passe en 5s, on débloque le UI
    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current) setLoading(false);
    }, 5000);

    // 1. Écouter les changements d'auth (login, logout, token refresh)
    //    Ceci gère aussi INITIAL_SESSION dans Supabase v2+
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMountedRef.current) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }

        // FirstPromoter tracking
        if (currentUser && typeof window !== "undefined") {
          const pendingEmail = sessionStorage.getItem("fpr_pending_email");
          if (pendingEmail) {
            trackFirstPromoterReferral(pendingEmail).then(() => {
              sessionStorage.removeItem("fpr_pending_email");
            });
          }
        }
      }
    );

    // 2. Charger la session initiale via getSession()
    //    On ATTEND le profil avant de débloquer le UI (max 3s)
    //    Cela force le Supabase client à rafraîchir un token expiré,
    //    garantissant que les contextes enfants auront un token valide
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMountedRef.current) return;
      clearTimeout(safetyTimeout);

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // Charger le profil AVEC un timeout de 3s pour ne jamais bloquer
        await Promise.race([
          fetchProfile(currentUser.id),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      } else {
        setProfile(null);
      }

      if (isMountedRef.current) setLoading(false);
    }).catch(() => {
      if (isMountedRef.current) {
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((credentials: any) => supabase.auth.signInWithPassword(credentials), []);
  const register = useCallback((credentials: any) => supabase.auth.signUp(credentials), []);
  const loginWithGoogle = useCallback(() => {
    const redirectTo = window.location.origin;

    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      }
    });
  }, []);

  const updateProfile = useCallback(async (updates: any) => {
    const { data: authData, error: authError } = await supabase.auth.updateUser({
      data: updates
    });

    if (authError) return { data: authData, error: authError };

    if (user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (!profileError) {
        await fetchProfile(user.id);
      }
    }

    return { data: authData, error: authError };
  }, [user, fetchProfile]);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { data, error };
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setProfile(null);
    await supabase.auth.signOut();
  }, []);

  // --- GESTION DÉCONNEXION AUTO 4H DU MATIN ---
  useEffect(() => {
    if (!user) return;

    const check4amReset = () => {
      try {
        const now = new Date();
        const resetTime = new Date();
        resetTime.setHours(4, 0, 0, 0);

        // Si on est avant 4h du matin, le dernier reset "valide" était hier à 4h
        if (now < resetTime) {
          resetTime.setDate(resetTime.getDate() - 1);
        }

        const lastReset = localStorage.getItem('last_4am_reset');
        const resetTimestamp = resetTime.getTime().toString();

        if (lastReset !== resetTimestamp) {
          // Si on a un ancien reset et qu'il est antérieur au reset "actuel" (4h passées)
          if (lastReset && parseInt(lastReset) < resetTime.getTime()) {
            console.log("Auto-logout at 4am triggered");
            logout();
          }
          // On met à jour le flag soit après logout, soit si c'est une nouvelle session post-4h
          localStorage.setItem('last_4am_reset', resetTimestamp);
        }
      } catch (e) {
        console.error("Error in 4am reset check:", e);
      }
    };

    // Vérification initiale
    check4amReset();

    // Vérification toutes les minutes pour ne pas rater le créneau si l'app est ouverte
    const interval = setInterval(check4amReset, 60000);
    return () => clearInterval(interval);
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!user,
      user,
      profile,
      isAdmin,
      isFounder,
      subscriptionStatus,
      loading,
      login,
      register,
      loginWithGoogle,
      updateProfile,
      updatePassword,
      logout,
      refreshProfile: () => user && fetchProfile(user.id)
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
