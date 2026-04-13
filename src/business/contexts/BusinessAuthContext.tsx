import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getBrowserTimezone } from '../../lib/timezone';

const BusinessAuthContext = createContext<any>(null);

function getDeviceFingerprint(): string {
  const key = 'closeos_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID() + '-' + navigator.userAgent.slice(0, 50).replace(/\s/g, '_');
    localStorage.setItem(key, id);
  }
  return id;
}

export function BusinessAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamMember, setTeamMember] = useState<any>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSalesUser, setIsSalesUser] = useState(false);
  const [hasSalesAccount, setHasSalesAccount] = useState(false);
  const [authError, setAuthError] = useState(false);
  const isMountedRef = useRef(true);
  // Guard: prevents initUser from signing out during registration (race condition)
  const isRegisteringRef = useRef(false);
  // Guard: tracks the latest initUser call to discard stale results
  const initVersionRef = useRef(0);
  // Refs to avoid stale closures in visibility/token handlers
  const businessProfileRef = useRef<any>(null);
  const teamMemberRef = useRef<any>(null);

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
    // Keep refs in sync for use in event handlers (avoids stale closures)
    businessProfileRef.current = data.businessProfile;
    teamMemberRef.current = data.teamMember;
  }, []);

  const initUser = useCallback(async (userId: string) => {
    const version = ++initVersionRef.current;
    setAuthError(false);

    try {
      console.log('[BusinessAuth] initUser called for:', userId);
      // Fetch business_users AND Sales profile (with active org) in parallel
      const [profileRes, salesRes] = await Promise.all([
        supabase.from('business_users').select('*').eq('id', userId).maybeSingle(),
        supabase.from('profiles').select('id, business_owner_id').eq('id', userId).maybeSingle(),
      ]);

      // Fetch team member scoped to active org (supports multi-org)
      let teamQuery = supabase.from('business_team_members').select('*').eq('user_id', userId);
      if (salesRes.data?.business_owner_id) {
        teamQuery = teamQuery.eq('business_owner_id', salesRes.data.business_owner_id);
      }
      const teamRes = await teamQuery.maybeSingle();

      console.log('[BusinessAuth] profileRes:', profileRes.data, profileRes.error);
      console.log('[BusinessAuth] teamRes:', teamRes.data, teamRes.error);

      if (!isMountedRef.current || initVersionRef.current !== version) return;

      // Block Sales users: has a profiles row but NO business_users/team_members row
      const hasBusinessAccount = !!(profileRes.data || teamRes.data);
      if (salesRes.data && !hasBusinessAccount) {
        setIsSalesUser(true);
        if (isMountedRef.current) setLoading(false);
        return;
      }

      // Team member takes priority
      if (!teamRes.error && teamRes.data) {
        // Auto-fill Google avatar if missing
        if (!teamRes.data.avatar_url) {
          const { data: authData } = await supabase.auth.getUser();
          const googleAvatar = authData?.user?.user_metadata?.avatar_url || authData?.user?.user_metadata?.picture;
          if (googleAvatar) {
            await supabase.from('business_team_members').update({ avatar_url: googleAvatar }).eq('id', teamRes.data.id);
            teamRes.data.avatar_url = googleAvatar;
          }
        }

        const { data: ownerSettings } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', teamRes.data.business_owner_id)
          .single();

        setHasSalesAccount(!!salesRes.data);
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

      // Auto-fill Google avatar for existing owners if missing
      if (profile && !profile.avatar_url) {
        const { data: authData } = await supabase.auth.getUser();
        const googleAvatar = authData?.user?.user_metadata?.avatar_url || authData?.user?.user_metadata?.picture;
        if (googleAvatar) {
          await supabase.from('business_users').update({ avatar_url: googleAvatar }).eq('id', profile.id);
          profile.avatar_url = googleAvatar;
        }
      }

      // No business_users row: user hasn't gone through checkout/registration
      if (!profile) {
        // Registration in progress — row will exist shortly, don't sign out
        if (isRegisteringRef.current) {
          if (isMountedRef.current) setLoading(false);
          return;
        }

        // Sales user trying to access Business
        if (salesRes.data) {
          setIsSalesUser(true);
          if (isMountedRef.current) setLoading(false);
          return;
        }

        // No profile at all → sign out and let the UI redirect to login/checkout
        // Do NOT auto-create accounts (prevents Google OAuth from bypassing payment)
        console.log('[BusinessAuth] No business_users row found — user needs checkout');
        await supabase.auth.signOut();
        setUser(null);
        clearUserData();
        if (isMountedRef.current) setLoading(false);
        return;
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
      if (isMountedRef.current) {
        setAuthError(true);
        setLoading(false);
      }
    }
  }, [applyUserData]);

  const clearUserData = useCallback(() => {
    initVersionRef.current++;
    setBusinessProfile(null);
    setBusinessSettings(null);
    setTeamMember(null);
    setIsTeamMember(false);
    setOwnerUserId(null);
    setNeedsVerification(false);
    setIsSalesUser(false);
    setHasSalesAccount(false);
    setAuthError(false);
    businessProfileRef.current = null;
    teamMemberRef.current = null;
  }, []);

  const checkDeviceVerified = useCallback(async (userId: string): Promise<boolean> => {
    const token = localStorage.getItem('closeos_device_token');
    const fingerprint = getDeviceFingerprint();
    if (!token) return false;
    try {
      const res = await fetch('/api/business-check-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, device_fingerprint: fingerprint, token })
      });
      const data = await res.json();
      return !!data.verified;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let initialSessionHandled = false;

    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current) setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMountedRef.current) return;

        // Skip INITIAL_SESSION — let getSession handle first load to avoid double-call
        if (!initialSessionHandled) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // TOKEN_REFRESHED: session is still valid, only re-init if user data is missing
          if (event === 'TOKEN_REFRESHED') {
            if (!businessProfileRef.current && !teamMemberRef.current) {
              await initUser(currentUser.id);
            }
          } else {
            await initUser(currentUser.id);
          }
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
        // Check device verification (skip for local dev account)
        const isLocalDev = currentUser.email === 'teka@closeos.local';
        const deviceOk = isLocalDev || await checkDeviceVerified(currentUser.id);
        if (isMountedRef.current) setNeedsVerification(!deviceOk);
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

    // Proactive session refresh: keep session alive when tab stays open
    const refreshInterval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Refresh if token expires within the next 5 minutes
        const expiresAt = session.expires_at ?? 0;
        if (expiresAt - Math.floor(Date.now() / 1000) < 300) {
          await supabase.auth.refreshSession();
        }
      }
    }, 60000); // Check every minute

    // Re-establish session when tab becomes visible again
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMountedRef.current) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser && !businessProfileRef.current && !teamMemberRef.current) {
        await initUser(currentUser.id);
      } else if (!currentUser) {
        clearUserData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMountedRef.current = false;
      clearTimeout(safetyTimeout);
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((credentials: any) => supabase.auth.signInWithPassword(credentials), []);

  const register = useCallback(async (credentials: { email: string; password: string; full_name: string }) => {
    isRegisteringRef.current = true;
    try {
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

        // Row exists now — initialize properly
        await initUser(data.user.id);
      }

      return { data, error: null };
    } finally {
      isRegisteringRef.current = false;
    }
  }, [initUser]);

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

    // Always upsert to handle both existing and new rows
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        user_id: user.id,
        ...updates,
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Settings upsert failed:', error.message);
      return { error };
    }

    // Refresh settings in state
    await initUser(user.id);
    return { error: null };
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

  const isSolo = useMemo(() => {
    const plan = businessSettings?.subscription_plan
    return !plan || plan === 'solo'
  }, [businessSettings?.subscription_plan])

  const hasAcquisition = useMemo(() => {
    const plan = businessSettings?.subscription_plan
    return plan === 'business_acquisition' || plan === 'enterprise'
  }, [businessSettings?.subscription_plan])

  const isLifetimeFree = useMemo(() => {
    return !!businessProfile?.is_lifetime_free
  }, [businessProfile?.is_lifetime_free])

  const isTrialActive = useMemo(() => {
    if (!businessProfile?.trial_ends_at) return false
    return new Date(businessProfile.trial_ends_at) > new Date()
  }, [businessProfile?.trial_ends_at])

  const isSubscribed = useMemo(() => {
    return !!businessProfile?.stripe_customer_id
  }, [businessProfile?.stripe_customer_id])

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
      isSolo,
      hasAcquisition,
      isLifetimeFree,
      isTrialActive,
      isSubscribed,
      ownerUserId,
      userTimezone,
      needsVerification,
      setNeedsVerification,
      isSalesUser,
      hasSalesAccount,
      authError,
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
