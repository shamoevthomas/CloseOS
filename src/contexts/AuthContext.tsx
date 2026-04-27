import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { trackFirstPromoterReferral } from '../lib/firstpromoter';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBusinessUser, setIsBusinessUser] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const isMountedRef = useRef(true);

  // Role admin simple : base uniquement sur l'email
  const isAdmin = user?.email === 'shamoovthomas@gmail.com';

  // Pro : base sur le statut d'abonnement (accepte aussi 'founder' pour rétrocompat)
  const subscriptionStatus = profile?.subscription_status;
  const isPaying = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const isPaymentFailed = subscriptionStatus === 'past_due' || subscriptionStatus === 'unpaid';
  const isPro = isPaying && (profile?.plan === 'pro' || profile?.plan === 'founder');
  const isFounder = isPro; // Alias rétrocompat

  // Trial: user exists, no active subscription, account < 10 days old
  const hasSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const created = user?.created_at ? new Date(user.created_at) : null;
  const trialEnd = created ? new Date(created.getTime() + 10 * 24 * 60 * 60 * 1000) : null;
  const isInTrial = trialEnd ? new Date() < trialEnd && !hasSubscription : false;

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // Check if user is a Business user (owner or team member)
      const [businessOwner, businessTeam] = await Promise.all([
        supabase.from('business_users').select('id').eq('id', userId).maybeSingle(),
        supabase.from('business_team_members').select('id').eq('user_id', userId).maybeSingle(),
      ]);

      const isBusiness = !!(businessOwner.data || businessTeam.data);
      if (isBusiness && isMountedRef.current) {
        setIsBusinessUser(true);
      }

      // Always try to load Sales profile (supports dual-access users)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data && isMountedRef.current) {
        setProfile(data);
      }

      // Only set localStorage to business if user is Business-only (no Sales profile)
      if (isBusiness && !data) {
        localStorage.setItem('closeos_product', 'business');
      }

      if (isMountedRef.current) setProfileReady(true);
    } catch (err) {
      console.error('Exception fetching profile:', err);
      if (isMountedRef.current) setProfileReady(true);
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
          setProfileReady(false);
          fetchProfile(currentUser.id);
        } else {
          setProfile(null);
          setProfileReady(true);
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
        setProfileReady(true);
        setLoading(false);
      }
    });

    // Tab-visibility handling is delegated to Supabase (startAutoRefresh in
    // src/lib/supabase.ts + onAuthStateChange above). A manual handler here
    // caused unnecessary refetches and race conditions on tab switch.

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
    setIsBusinessUser(false);
    await supabase.auth.signOut();
  }, []);

  // --- GESTION DÉCONNEXION AUTO 4H DU MATIN ---
  // Déconnecte l'utilisateur s'il ne s'est pas connecté depuis le dernier 4h du matin
  // ET que le tab est resté caché >= 5 min en continu (vraie inactivité, pas un changement d'onglet rapide).
  useEffect(() => {
    if (!user) return;

    let hiddenSince: number | null = document.visibilityState === 'hidden' ? Date.now() : null;
    const HIDDEN_THRESHOLD_MS = 5 * 60 * 1000; // 5 min cachée avant de considérer "inactif"

    const check4amReset = () => {
      try {
        const now = new Date();
        const resetTime = new Date();
        resetTime.setHours(4, 0, 0, 0);

        if (now < resetTime) {
          resetTime.setDate(resetTime.getDate() - 1);
        }

        const lastReset = localStorage.getItem('last_4am_reset');
        const currentResetTimestamp = resetTime.getTime().toString();

        if (lastReset && parseInt(lastReset) < resetTime.getTime()) {
          // 4h passé non encore traité — uniquement si tab caché en continu depuis HIDDEN_THRESHOLD_MS
          const hiddenLongEnough = hiddenSince !== null && Date.now() - hiddenSince >= HIDDEN_THRESHOLD_MS;
          if (hiddenLongEnough) {
            console.log("Auto-logout at 4am triggered (tab hidden ≥5 min)");
            logout();
            localStorage.setItem('last_4am_reset', currentResetTimestamp);
          }
        } else if (!lastReset) {
          localStorage.setItem('last_4am_reset', currentResetTimestamp);
        }
      } catch (e) {
        console.error("Error in 4am reset check:", e);
      }
    };

    const handleVisibilityChange = () => {
      hiddenSince = document.visibilityState === 'hidden' ? Date.now() : null;
    };

    check4amReset();

    // Vérification toutes les minutes (la condition hiddenSince filtre les changements rapides)
    const interval = setInterval(check4amReset, 60000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, logout]);

  // User role (Sales) — drives sidebar, KPI page, dashboard widgets, available stages
  const rawRole = (user?.user_metadata?.role || profile?.role || '') as string;
  const role: 'Closer' | 'Setter' | 'Setter-Closer' =
    rawRole === 'Setter' || rawRole === 'Setter-Closer' ? rawRole : 'Closer';
  const isCloserRole = role === 'Closer';
  const isSetterRole = role === 'Setter';
  const isSetterCloserRole = role === 'Setter-Closer';
  const showsSetterFeatures = isSetterRole || isSetterCloserRole;
  const showsCloserFeatures = isCloserRole || isSetterCloserRole;

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!user,
      user,
      profile,
      isAdmin,
      isPro,
      isFounder, // Alias rétrocompat
      isPaymentFailed,
      isInTrial,
      isPaying,
      subscriptionStatus,
      loading,
      isBusinessUser,
      profileReady,
      role,
      isCloserRole,
      isSetterRole,
      isSetterCloserRole,
      showsSetterFeatures,
      showsCloserFeatures,
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
