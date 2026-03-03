import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { trackFirstPromoterReferral } from '../lib/firstpromoter';
import toast from 'react-hot-toast';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const initDoneRef = useRef(false);

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
        // Si erreur d'auth, tenter un refresh silencieux
        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError) {
            // Reessayer apres refresh
            const { data: retryData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();
            if (retryData && isMountedRef.current) {
              setProfile(retryData);
              return;
            }
          }
        }
      } else if (isMountedRef.current) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Exception fetching profile:', err);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    const SAFETY_TIMEOUT_MS = 5000;
    // Track if init() successfully resolved a user
    let initResolvedUser = false;

    const init = async () => {
      timeoutId = setTimeout(() => {
        if (isMountedRef.current && !initDoneRef.current) {
          initDoneRef.current = true;
          setLoading(false);
        }
      }, SAFETY_TIMEOUT_MS);

      try {
        // Try getUser() first (server-validated, ensures fresh token)
        // Falls back to getSession() on AbortError (navigator.locks issue)
        // If getUser() returns an error, DON'T wipe user state —
        // let onAuthStateChange/INITIAL_SESSION handle it from cache
        let resolvedUser: any = null;
        let getUserSucceeded = false;

        try {
          const { data: { user: validatedUser }, error: getUserError } = await supabase.auth.getUser();
          if (!getUserError) {
            resolvedUser = validatedUser;
            getUserSucceeded = true;
          } else {
            // getUser returned an error (expired token, network, etc.)
            // Don't force null — INITIAL_SESSION already set user from cache
            console.warn('getUser() error, deferring to onAuthStateChange:', getUserError.message);
          }
        } catch (getUserErr: any) {
          // AbortError from navigator.locks - fall back to getSession()
          if (getUserErr?.name === 'AbortError' || getUserErr?.message?.includes('AbortError')) {
            console.warn('getUser() AbortError, falling back to getSession()');
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              resolvedUser = session.user;
              getUserSucceeded = true;
              // Force token refresh so other contexts get a valid token
              supabase.auth.refreshSession().catch(() => {});
            }
          }
          // For any other throw, don't touch state — let INITIAL_SESSION recover
        }

        clearTimeout(timeoutId);
        if (!isMountedRef.current) return;

        if (getUserSucceeded) {
          if (resolvedUser) {
            setUser(resolvedUser);
            initResolvedUser = true;
            await fetchProfile(resolvedUser.id);
          } else {
            // getUser succeeded but no user = genuinely not logged in
            setUser(null);
            setProfile(null);
          }
        }
        // If !getUserSucceeded: don't touch user/profile state
        // INITIAL_SESSION has already (or will) set them from the cached session
      } catch (err) {
        console.error('Erreur init auth:', err);
        clearTimeout(timeoutId);
        if (!isMountedRef.current) return;
        // Don't set user to null on error - let onAuthStateChange recover
      } finally {
        if (isMountedRef.current) {
          initDoneRef.current = true;
          setLoading(false);
        }
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMountedRef.current) return;

      const currentUser = session?.user ?? null;

      // Gestion explicite des evenements
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        if (currentUser) {
          setUser(currentUser);
        }
        return;
      }

      // Pour INITIAL_SESSION : ignorer seulement si init() a deja trouve un user
      // Si init() a echoue ou n'a pas trouve de user, laisser INITIAL_SESSION recuperer
      if (event === 'INITIAL_SESSION' && initDoneRef.current && initResolvedUser) {
        return;
      }

      setUser(currentUser);

      // FirstPromoter : suivi parrainage apres connexion Google
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

      if (isMountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = (credentials: any) => supabase.auth.signInWithPassword(credentials);
  const register = (credentials: any) => supabase.auth.signUp(credentials);
  const loginWithGoogle = () => {
    // Use window.location.origin to always match the current domain (www or non-www)
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
    // Met a jour auth.users
    const { data: authData, error: authError } = await supabase.auth.updateUser({
      data: updates
    });

    if (authError) return { data: authData, error: authError };

    // Met a jour la table profiles aussi si necessaire
    if (user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (profileError) {
        console.error('Erreur update profile:', profileError);
      } else {
        // Recharger le profil local
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
    // Met a jour l'etat local immediatement
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
