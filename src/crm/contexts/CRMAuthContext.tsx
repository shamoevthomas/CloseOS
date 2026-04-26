import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getBrowserTimezone } from '../../lib/timezone';
import { BusinessAuthContext } from '../../business/contexts/BusinessAuthContext';
import { isAdminEmail } from '../../lib/adminEmails';

// CRMAuthContext re-publishes a Business-compatible shape into BusinessAuthContext
// so every page mounted under /crm/* (BusinessCRM, BusinessPipeline, BusinessCampaigns,
// BusinessAcquisition, BusinessDashboard) keeps using useBusinessAuth() transparently.
// Data comes from crm_users (not business_users). isSolo is forced true; no team.

const CRMAuthContext = createContext<any>(null);

export function CRMAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [crmProfile, setCrmProfile] = useState<any>(null);
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [notACrmUser, setNotACrmUser] = useState(false);
  const isMountedRef = useRef(true);
  const isRegisteringRef = useRef(false);
  const initVersionRef = useRef(0);
  const crmProfileRef = useRef<any>(null);

  const clearUserData = useCallback(() => {
    initVersionRef.current++;
    setCrmProfile(null);
    setBusinessSettings(null);
    setAuthError(false);
    setNotACrmUser(false);
    crmProfileRef.current = null;
  }, []);

  const initUser = useCallback(async (userId: string, opts?: { allowSignOut?: boolean; email?: string | null }) => {
    const version = ++initVersionRef.current;
    const allowSignOut = opts?.allowSignOut === true;
    const isAdmin = isAdminEmail(opts?.email);
    setAuthError(false);

    const synthesizeAdminProfile = async (): Promise<any> => {
      const { data: bizProfile } = await supabase
        .from('business_users')
        .select('full_name, email, avatar_url, phone, timezone')
        .eq('id', userId)
        .maybeSingle()
        .then(r => r, () => ({ data: null } as any));
      return {
        id: userId,
        full_name: bizProfile?.full_name || 'Admin',
        email: bizProfile?.email || opts?.email || '',
        avatar_url: bizProfile?.avatar_url || null,
        phone: bizProfile?.phone || null,
        timezone: bizProfile?.timezone || getBrowserTimezone(),
        has_onboarded: true,
        trial_ends_at: null,
        stripe_customer_id: null,
        is_lifetime_free: true,
        __admin_virtual: true,
      };
    };

    try {
      let profile: any = null;
      let profileErr: any = null;
      try {
        const res = await supabase
          .from('crm_users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        profile = res.data;
        profileErr = res.error;
      } catch (fetchErr) {
        profileErr = fetchErr;
      }

      if (!isMountedRef.current || initVersionRef.current !== version) return;

      let resolvedProfile: any = profile;

      if (profileErr) {
        // Most common cause: migration not applied yet — crm_users table missing.
        // Admin accounts keep working via a synthesized profile; non-admins fall through.
        console.warn('[CRMAuth] crm_users unreachable:', profileErr?.message || profileErr);
        if (isAdmin) {
          resolvedProfile = await synthesizeAdminProfile();
        } else {
          setAuthError(true);
          if (isMountedRef.current) setLoading(false);
          return;
        }
      }

      if (!resolvedProfile) {
        if (isRegisteringRef.current) {
          if (isMountedRef.current) setLoading(false);
          return;
        }
        if (isAdmin) {
          resolvedProfile = await synthesizeAdminProfile();
        } else {
          if (allowSignOut) {
            setNotACrmUser(true);
            await supabase.auth.signOut();
            setUser(null);
            clearUserData();
          }
          if (isMountedRef.current) setLoading(false);
          return;
        }
      }

      let settings: any = null;
      try {
        const res = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        settings = res.data;
      } catch { /* non-fatal */ }

      if (!isMountedRef.current || initVersionRef.current !== version) return;

      setCrmProfile(resolvedProfile);
      crmProfileRef.current = resolvedProfile;
      setBusinessSettings(settings || { user_id: userId, subscription_plan: 'crm' });
      if (isMountedRef.current) setLoading(false);
    } catch (err) {
      console.error('[CRMAuth] initUser exception:', err);
      if (isMountedRef.current) {
        setAuthError(true);
        setLoading(false);
      }
    }
  }, [clearUserData]);

  useEffect(() => {
    isMountedRef.current = true;
    let initialSessionHandled = false;

    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current) setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMountedRef.current) return;
        if (!initialSessionHandled) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          if (event === 'TOKEN_REFRESHED') {
            if (!crmProfileRef.current) await initUser(currentUser.id, { email: currentUser.email });
          } else {
            await initUser(currentUser.id, { email: currentUser.email });
          }
        } else {
          clearUserData();
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMountedRef.current) return;
      clearTimeout(safetyTimeout);
      initialSessionHandled = true;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await initUser(currentUser.id, { allowSignOut: true, email: currentUser.email });
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
    isRegisteringRef.current = true;
    try {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: { data: { full_name: credentials.full_name } }
      });
      if (error) return { data, error };
      if (data.user) {
        await supabase.from('crm_users').insert({
          id: data.user.id,
          full_name: credentials.full_name,
          email: credentials.email,
        });
        await supabase.from('business_settings').upsert(
          { user_id: data.user.id, subscription_plan: 'crm' },
          { onConflict: 'user_id' }
        );
        await initUser(data.user.id, { allowSignOut: true });
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
        redirectTo: `${window.location.origin}/crm/dashboard`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      }
    });
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    clearUserData();
    await supabase.auth.signOut();
  }, [clearUserData]);

  const updateBusinessProfile = useCallback(async (updates: any) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase
      .from('crm_users')
      .upsert({ id: user.id, email: user.email, ...updates }, { onConflict: 'id' });
    if (!error) await initUser(user.id);
    return { error };
  }, [user, initUser]);

  const updateBusinessSettings = useCallback(async (updates: any) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase
      .from('business_settings')
      .upsert({ user_id: user.id, subscription_plan: 'crm', ...updates }, { onConflict: 'user_id' });
    if (error) return { error };
    await initUser(user.id);
    return { error: null };
  }, [user, initUser]);

  const userTimezone = useMemo(() => crmProfile?.timezone || getBrowserTimezone(), [crmProfile?.timezone]);
  const isTrialActive = useMemo(() => {
    if (!crmProfile?.trial_ends_at) return false;
    return new Date(crmProfile.trial_ends_at) > new Date();
  }, [crmProfile?.trial_ends_at]);
  const isSubscribed = useMemo(() => !!crmProfile?.stripe_customer_id, [crmProfile?.stripe_customer_id]);
  const isLifetimeFree = useMemo(() => !!crmProfile?.is_lifetime_free, [crmProfile?.is_lifetime_free]);

  // Shape matches BusinessAuthContext so the 5 reused Business pages work as-is.
  const businessCompatibleValue = useMemo(() => ({
    isAuthenticated: !!user,
    user,
    businessProfile: crmProfile,
    businessSettings,
    hasOnboarded: crmProfile?.has_onboarded ?? false,
    loading,
    login,
    register,
    loginWithGoogle,
    updateBusinessProfile,
    updateBusinessSettings,
    logout,
    teamMember: null,
    isTeamMember: false,
    isSolo: true,
    hasAcquisition: true, // CRM plan includes Campagnes + Acquisition
    isLifetimeFree,
    isTrialActive,
    isSubscribed,
    ownerUserId: null,
    userTimezone,
    needsVerification,
    setNeedsVerification,
    isSalesUser: false,
    hasSalesAccount: false,
    authError,
    refreshProfile: async () => { if (user) await initUser(user.id); },
  }), [user, crmProfile, businessSettings, loading, login, register, loginWithGoogle,
       updateBusinessProfile, updateBusinessSettings, logout, isLifetimeFree, isTrialActive,
       isSubscribed, userTimezone, needsVerification, authError, initUser]);

  const crmValue = useMemo(() => ({
    ...businessCompatibleValue,
    crmProfile,
    notACrmUser,
  }), [businessCompatibleValue, crmProfile, notACrmUser]);

  return (
    <BusinessAuthContext.Provider value={businessCompatibleValue}>
      <CRMAuthContext.Provider value={crmValue}>
        {children}
      </CRMAuthContext.Provider>
    </BusinessAuthContext.Provider>
  );
}

export function useCRMAuth() {
  const ctx = useContext(CRMAuthContext);
  if (!ctx) throw new Error('useCRMAuth must be used within CRMAuthProvider');
  return ctx;
}
