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
  // Guard: tracks the latest initUser call to discard stale results
  const initVersionRef = useRef(0);

  const applyUserData = useCallback((version: number, data: {
    teamMember: any;
    isTeamMember: boolean;
    ownerUserId: string | null;
    businessProfile: any;
    businessSettings: any;
  }) => {
    // Only apply if this is still the latest call and component is mounted
    if (!isMountedRef.current || initVersionRef.current !== version) return;
    setTeamMember(data.teamMember);
    setIsTeamMember(data.isTeamMember);
    setOwnerUserId(data.ownerUserId);
    setBusinessProfile(data.businessProfile);
    setBusinessSettings(data.businessSettings);
  }, []);

  const initUser = useCallback(async (userId: string) => {
    const version = ++initVersionRef.current;

    try {
      // Fetch business_users AND team_members in parallel
      const [profileRes, teamRes] = await Promise.all([
        supabase.from('business_users').select('*').eq('id', userId).single(),
        supabase.from('business_team_members').select('*').eq('user_id', userId).single(),
      ]);

      if (!isMountedRef.current || initVersionRef.current !== version) return;

      // Team member takes priority
      if (!teamRes.error && teamRes.data) {
        const { data: ownerSettings } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', teamRes.data.business_owner_id)
          .single();

        applyUserData(version, {
          teamMember: teamRes.data,
          isTeamMember: true,
          ownerUserId: teamRes.data.business_owner_id,
          businessProfile: null,
          businessSettings: ownerSettings || null,
        });
        return;
      }

      // Not a team member — regular owner flow
      const profile = (!profileRes.error && profileRes.data) ? profileRes.data : null;

      const { data: settings } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      applyUserData(version, {
        teamMember: null,
        isTeamMember: false,
        ownerUserId: null,
        businessProfile: profile,
        businessSettings: settings || null,
      });
    } catch (err) {
      console.error('Exception in initUser:', err);
    }
  }, [applyUserData]);

  const clearUserData = useCallback(() => {
    initVersionRef.current++;
    setBusinessProfile(null);
    setBusinessSettings(null);
    setTeamMember(null);
    setIsTeamMember(false);
    setOwnerUserId(null);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let initialSessionHandled = false;

    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current) setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMountedRef.current) return;

        // Skip INITIAL_SESSION — let getSession handle first load to avoid double-call
        if (!initialSessionHandled) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await initUser(currentUser.id);
        } else {
          clearUserData();
        }
      }
    );

    // Primary init: getSession
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMountedRef.current) return;
      clearTimeout(safetyTimeout);
      initialSessionHandled = true;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await Promise.race([
          initUser(currentUser.id),
          new Promise(resolve => setTimeout(resolve, 4000))
        ]);
      } else {
        clearUserData();
      }

      if (isMountedRef.current) setLoading(false);
    }).catch(() => {
      if (isMountedRef.current) {
        initialSessionHandled = true;
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
      await initUser(user.id);
    }

    return { error };
  }, [user, initUser]);

  const updateBusinessSettings = useCallback(async (updates: any) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('business_settings')
      .upsert({
        user_id: user.id,
        ...updates,
      }, { onConflict: 'user_id' });

    if (!error) {
      await initUser(user.id);
    }

    return { error };
  }, [user, initUser]);

  const logout = useCallback(async () => {
    setUser(null);
    clearUserData();
    await supabase.auth.signOut();
  }, [clearUserData]);

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
          initUser(user.id);
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
