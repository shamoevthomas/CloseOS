import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const BusinessAuthContext = createContext<any>(null);

export function BusinessAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamMember, setTeamMember] = useState<any>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchTeamMember = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('business_team_members')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data && isMountedRef.current) {
        setTeamMember(data);
        setIsTeamMember(true);
        setOwnerUserId(data.business_owner_id);

        // Fetch the owner's business_settings for company name/logo
        const { data: ownerSettings } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', data.business_owner_id)
          .single();

        if (isMountedRef.current && ownerSettings) {
          setBusinessSettings(ownerSettings);
        }
      }
    } catch (err) {
      console.error('Exception fetching team member:', err);
    }
  }, []);

  const fetchBusinessProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('business_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // User doesn't have a business profile yet — check if team member
        if (isMountedRef.current) {
          setBusinessProfile(null);
          await fetchTeamMember(userId);
        }
      } else if (isMountedRef.current) {
        setBusinessProfile(data);
      }
    } catch (err) {
      console.error('Exception fetching business profile:', err);
    }
  }, [fetchTeamMember]);

  const fetchBusinessSettings = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (isMountedRef.current) {
        setBusinessSettings(data || null);
      }
    } catch (err) {
      console.error('Exception fetching business settings:', err);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current) setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMountedRef.current) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          fetchBusinessProfile(currentUser.id);
          fetchBusinessSettings(currentUser.id);
        } else {
          setBusinessProfile(null);
          setBusinessSettings(null);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMountedRef.current) return;
      clearTimeout(safetyTimeout);

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await Promise.race([
          Promise.all([
            fetchBusinessProfile(currentUser.id),
            fetchBusinessSettings(currentUser.id),
          ]),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      } else {
        setBusinessProfile(null);
        setBusinessSettings(null);
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

  const register = useCallback(async (credentials: { email: string; password: string; full_name: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: { full_name: credentials.full_name }
      }
    });

    if (error) return { data, error };

    // Insert into business_users
    if (data.user) {
      const { error: insertError } = await supabase
        .from('business_users')
        .insert({
          id: data.user.id,
          full_name: credentials.full_name,
          email: credentials.email,
        });

      if (insertError) {
        console.error('Error inserting business_users:', insertError);
      }
    }

    return { data, error: null };
  }, []);

  const loginWithGoogle = useCallback(() => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/business/dashboard`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      }
    });
  }, []);

  const updateBusinessProfile = useCallback(async (updates: any) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('business_users')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      await fetchBusinessProfile(user.id);
    }

    return { error };
  }, [user, fetchBusinessProfile]);

  const updateBusinessSettings = useCallback(async (updates: any) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Upsert settings
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        user_id: user.id,
        ...updates,
      }, { onConflict: 'user_id' });

    if (!error) {
      await fetchBusinessSettings(user.id);
    }

    return { error };
  }, [user, fetchBusinessSettings]);

  const logout = useCallback(async () => {
    setUser(null);
    setBusinessProfile(null);
    setBusinessSettings(null);
    setTeamMember(null);
    setIsTeamMember(false);
    setOwnerUserId(null);
    await supabase.auth.signOut();
  }, []);

  return (
    <BusinessAuthContext.Provider value={{
      isAuthenticated: !!user,
      user,
      businessProfile,
      businessSettings,
      hasOnboarded: isTeamMember ? true : (businessProfile?.has_onboarded ?? false),
      loading,
      login,
      register,
      loginWithGoogle,
      updateBusinessProfile,
      updateBusinessSettings,
      logout,
      teamMember,
      isTeamMember,
      ownerUserId,
      refreshProfile: () => {
        if (user) {
          fetchBusinessProfile(user.id);
          fetchBusinessSettings(user.id);
        }
      }
    }}>
      {children}
    </BusinessAuthContext.Provider>
  );
}

export function useBusinessAuth() {
  const context = useContext(BusinessAuthContext);
  if (!context) throw new Error('useBusinessAuth must be used within BusinessAuthProvider');
  return context;
}
