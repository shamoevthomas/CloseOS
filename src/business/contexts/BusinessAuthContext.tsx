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
      .upsert({ id: user.id, email: user.email, ...updates }, { onConflict: 'id' });

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
      // Refresh in background — don't block the caller
      initUser(user.id);
    }

    return { error };
  }, [user, initUser]);

  // ─── Online presence tracking for team members ───
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTeamMemberIdRef = useRef<string | null>(null);

  const setOnlineStatus = useCallback(async (teamMemberId: string, online: boolean) => {
    await supabase
      .from('business_team_members')
      .update({ is_online: online })
      .eq('id', teamMemberId);
  }, []);

  const logConnectionEvent = useCallback(async (teamMemberId: string, businessOwnerId: string, eventType: 'connect' | 'disconnect') => {
    await supabase.from('business_connection_log').insert({
      team_member_id: teamMemberId,
      business_owner_id: businessOwnerId,
      event_type: eventType,
    });
  }, []);

  const startPresence = useCallback((teamMemberId: string, businessOwnerId: string) => {
    currentTeamMemberIdRef.current = teamMemberId;
    // Set online + log connect
    setOnlineStatus(teamMemberId, true);
    logConnectionEvent(teamMemberId, businessOwnerId, 'connect');

    // Heartbeat every 60s
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      setOnlineStatus(teamMemberId, true);
    }, 60000);

    // beforeunload handler
    const handleUnload = () => {
      // Use sendBeacon for reliability on page close
      const payload = JSON.stringify({ team_member_id: teamMemberId, is_online: false });
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL || ''}/rest/v1/business_team_members?id=eq.${teamMemberId}`,
        new Blob([JSON.stringify({ is_online: false })], { type: 'application/json' })
      );
      // Also try direct update
      setOnlineStatus(teamMemberId, false);
      logConnectionEvent(teamMemberId, businessOwnerId, 'disconnect');
    };
    window.addEventListener('beforeunload', handleUnload);
    // Store cleanup ref
    (window as any).__closeos_unload_handler = handleUnload;
  }, [setOnlineStatus, logConnectionEvent]);

  const stopPresence = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    const handler = (window as any).__closeos_unload_handler;
    if (handler) {
      window.removeEventListener('beforeunload', handler);
      delete (window as any).__closeos_unload_handler;
    }
  }, []);

  // Start presence when team member is detected
  useEffect(() => {
    if (isTeamMember && teamMember?.id && teamMember?.business_owner_id) {
      startPresence(teamMember.id, teamMember.business_owner_id);
    }
    return () => { stopPresence(); };
  }, [isTeamMember, teamMember?.id]);

  const logout = useCallback(async () => {
    // Set offline before signing out
    if (currentTeamMemberIdRef.current && teamMember?.business_owner_id) {
      await setOnlineStatus(currentTeamMemberIdRef.current, false);
      await logConnectionEvent(currentTeamMemberIdRef.current, teamMember.business_owner_id, 'disconnect');
      currentTeamMemberIdRef.current = null;
    }
    await stopPresence();
    setUser(null);
    clearUserData();
    await supabase.auth.signOut();
  }, [clearUserData, teamMember?.business_owner_id, setOnlineStatus, logConnectionEvent, stopPresence]);

  return (
    <BusinessAuthContext.Provider value={{
      isAuthenticated: !!user,
      user,
      businessProfile,
      businessSettings,
      hasOnboarded: isTeamMember ? !!teamMember?.has_onboarded : (businessProfile?.has_onboarded ?? false),
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
      refreshProfile: async () => {
        if (user) {
          await initUser(user.id);
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
