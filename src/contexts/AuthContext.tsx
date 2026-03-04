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
    let isMounted = true;

    // Safety timeout : si aucun événement auth n'arrive en 5s, on débloque l'UI
    const safetyTimeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 5000);

    // SOURCE UNIQUE DE VÉRITÉ : onAuthStateChange gère AUSSI la session initiale
    // (Supabase v2+ émet un événement INITIAL_SESSION automatiquement)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      clearTimeout(safetyTimeout);

      const currentUser = session?.user ?? null;

      // Mettre à jour le user immédiatement
      setUser(currentUser);

      // FirstPromoter
      if (currentUser && typeof window !== "undefined") {
        const pendingEmail = sessionStorage.getItem("fpr_pending_email");
        if (pendingEmail) {
          trackFirstPromoterReferral(pendingEmail).then(() => {
            sessionStorage.removeItem("fpr_pending_email");
          });
        }
      }

      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }

      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      isMountedRef.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = (credentials: any) => supabase.auth.signInWithPassword(credentials);
  const register = (credentials: any) => supabase.auth.signUp(credentials);
  const loginWithGoogle = () => {
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
  };

  const updateProfile = async (updates: any) => {
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
  };

  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { data, error };
  };

  const logout = async () => {
    setUser(null);
    setProfile(null);
    await supabase.auth.signOut();
  };

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
