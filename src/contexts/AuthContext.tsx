import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null); // Stocke les données de la table profiles
  const [loading, setLoading] = useState(true);



  // ADMIN BYPASS LOGIC (uniquement via le paramètre d'URL courant, sans persistance)
  const [adminBypass] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('admin') === 'thomas';
    } catch {
      return false;
    }
  });

  // ADMIN BYPASS : shamoovthomas@gmail.com OR local bypass
  const isAdmin = user?.email === 'shamoovthomas@gmail.com' || adminBypass;

  // LOGIQUE D'ACCÈS : 
  // - Admin : Accès total
  // - Founder : Accès total (subscription_status = 'active' ou 'trialing')
  // - Autres : Accès restreint
  const subscriptionStatus = profile?.subscription_status;
  const isFounder = isAdmin || (subscriptionStatus === 'active' || subscriptionStatus === 'trialing');

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Exception fetching profile:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        // Force un état "déconnecté" à chaque nouveau chargement (retour sur le site),
        // sauf pendant un callback OAuth (sinon on annule le login).
        const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
        const hasOAuthCallback =
          !!url &&
          (url.searchParams.has('code') ||
            url.searchParams.has('error') ||
            url.hash.includes('access_token=') ||
            url.hash.includes('refresh_token='));

        if (!hasOAuthCallback) {
          await supabase.auth.signOut({ scope: 'local' });
        }

        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;

        if (!isMounted) return;
        setUser(currentUser);

        if (currentUser) {
          fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Erreur init auth:', err);
        if (!isMounted) return;
        setUser(null);
        setProfile(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    // Écoute des changements d'état (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // En cas de LOGIN ou TOKEN REFRESH, on recharge le profil pour avoir le statut à jour
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = (credentials: any) => supabase.auth.signInWithPassword(credentials);
  const register = (credentials: any) => supabase.auth.signUp(credentials);
  const loginWithGoogle = () => {
    // 👇 LOGIQUE DE REDIRECTION FORCÉE
    // Si on n'est pas en local, on force la redirection vers le domaine officiel
    const redirectTo = window.location.hostname === 'localhost'
      ? 'http://localhost:5173'
      : 'https://closeos.fr';

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
    // Met à jour auth.users
    const { data: authData, error: authError } = await supabase.auth.updateUser({
      data: updates
    });

    if (authError) return { data: authData, error: authError };

    // Met à jour la table profiles aussi si nécessaire
    if (user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      // On recharge le profil local
      if (!profileError) await fetchProfile(user.id);
    }

    return { data: authData, error: authError };
  };

  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { data, error };
  };

  const logout = () => {
    setProfile(null);
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!user,
      user,
      profile,           // Expose le profil complet (avec subscription_status)
      isAdmin,           // Expose le flag admin
      isFounder,         // Expose le flag "a payé"
      subscriptionStatus,// Expose le statut brut
      loading,
      login,
      register,
      loginWithGoogle,
      updateProfile,
      updatePassword,
      logout,
      refreshProfile: () => user && fetchProfile(user.id) // Helper pour forcer le rafraîchissement
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// C'est cet export qui manque et cause l'erreur dans ta console
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}