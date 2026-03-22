import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getBrowserTimezone } from '../../lib/timezone';

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
        supabase.from('business_users').select('*').eq('id', userId).maybeSingle(),
        supabase.from('business_team_members').select('*').eq('user_id', userId).maybeSingle(),
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
      let profile = (!profileRes.error && profileRes.data) ? profileRes.data : null;

      // Auto-create business_users row if missing (Google OAuth, race condition, etc.)
      if (!profile) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: inserted } = await supabase
            .from('business_users')
            .upsert({
              id: authData.user.id,
              full_name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || '',
              email: authData.user.email || '',
            }, { onConflict: 'id' })
            .select()
            .single();
          if (inserted) profile = inserted;
        }
      }

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
        await initUser(currentUser.id);
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
      .update({ is_online: online, last_heartbeat_at: new Date().toISOString() })
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

    // beforeunload + visibilitychange handlers for reliable disconnect
    const handleDisconnect = () => {
      // Use sendBeacon to our API route — works reliably on page close
      const payload = JSON.stringify({ team_member_id: teamMemberId, business_owner_id: businessOwnerId, action: 'disconnect' });
      navigator.sendBeacon?.('/api/presence', new Blob([payload], { type: 'application/json' }));
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleDisconnect();
      } else if (document.visibilityState === 'visible') {
        // User came back — re-establish presence
        setOnlineStatus(teamMemberId, true);
        logConnectionEvent(teamMemberId, businessOwnerId, 'connect');
      }
    };
    window.addEventListener('beforeunload', handleDisconnect);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Store cleanup refs
    (window as any).__closeos_unload_handler = handleDisconnect;
    (window as any).__closeos_visibility_handler = handleVisibilityChange;
  }, [setOnlineStatus, logConnectionEvent]);

  const stopPresence = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    const unloadHandler = (window as any).__closeos_unload_handler;
    if (unloadHandler) {
      window.removeEventListener('beforeunload', unloadHandler);
      delete (window as any).__closeos_unload_handler;
    }
    const visHandler = (window as any).__closeos_visibility_handler;
    if (visHandler) {
      document.removeEventListener('visibilitychange', visHandler);
      delete (window as any).__closeos_visibility_handler;
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

  // Resolved timezone: team member tz > owner profile tz > browser tz
  const userTimezone = useMemo(() => {
    if (isTeamMember && teamMember?.timezone) return teamMember.timezone
    if (businessProfile?.timezone) return businessProfile.timezone
    return getBrowserTimezone()
  }, [isTeamMember, teamMember?.timezone, businessProfile?.timezone])

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
      userTimezone,
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
