import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Récupération de la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Écoute des changements d'état (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (credentials: any) => supabase.auth.signInWithPassword(credentials);
  const register = (credentials: any) => supabase.auth.signUp(credentials);
  const loginWithGoogle = () => supabase.auth.signInWithOAuth({ 
    provider: 'google', 
    options: { redirectTo: window.location.origin } 
  });
  
  const updateProfile = async (updates: any) => {
    const { data, error } = await supabase.auth.updateUser({
      data: updates
    });
    return { data, error };
  };

  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { data, error };
  };

  const logout = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: !!user, 
      user, 
      loading, 
      login, 
      register, 
      loginWithGoogle, 
      updateProfile,
      updatePassword,
      logout 
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