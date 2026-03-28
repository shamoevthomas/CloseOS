import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2, CheckCircle, AlertCircle, Mail, Lock, ArrowRight,
  Globe, Building2, User as UserIcon, Eye, EyeOff, Shield, MapPin,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import BusinessVerification from './BusinessVerification';

export function BusinessInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [ownerSettings, setOwnerSettings] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<{ userId: string; email: string; authMethod: 'classic' | 'google' } | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Lien d'invitation invalide.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/business-invitation?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Invitation invalide ou expirée.');
        } else {
          setInvitation(data.invitation);
          setOwnerSettings(data.ownerSettings || null);
        }
      } catch {
        setError("Impossible de valider l'invitation.");
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const acceptInvitation = async (userId: string, userEmail: string, userFirstName: string, userLastName: string, avatarUrl?: string) => {
    const res = await fetch('/api/business-invitation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        user_id: userId,
        first_name: userFirstName,
        last_name: userLastName,
        email: userEmail,
        avatar_url: avatarUrl || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Erreur lors de l'acceptation de l'invitation.");
    }
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;
    setSubmitLoading(true);
    setError(null);

    try {
      // Check if email already has a Sales account
      const { data: salesProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (salesProfile) {
        setError("Cet email est déjà associé à un compte CloseOS Sales. Veuillez utiliser un autre email.");
        setSubmitLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      let userId: string;
      let userEmail = email;

      if (session?.user) {
        // Check if existing session belongs to a Sales user
        const { data: salesCheck } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (salesCheck) {
          setError("Ce compte est déjà associé à un compte CloseOS Sales. Veuillez vous déconnecter et utiliser un autre email.");
          setSubmitLoading(false);
          return;
        }

        userId = session.user.id;
        userEmail = session.user.email || email;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: `${firstName} ${lastName}`.trim() }
          }
        });

        if (signUpError) {
          setError(signUpError.message);
          setSubmitLoading(false);
          return;
        }

        if (!data.user) {
          setError('Erreur lors de la création du compte.');
          setSubmitLoading(false);
          return;
        }

        userId = data.user.id;
      }

      await acceptInvitation(userId, userEmail, firstName, lastName);
      // Show verification before onboarding
      setPendingVerification({ userId, email: userEmail, authMethod: 'classic' });
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!token) return;
    setGoogleLoading(true);
    setError(null);

    try {
      localStorage.setItem('pending_invitation_token', token);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/business/invitation/${token}`,
        }
      });

      if (error) {
        setError(error.message);
        setGoogleLoading(false);
      }
    } catch {
      setError('Impossible de lancer la connexion Google.');
      setGoogleLoading(false);
    }
  };

  // ─── Handle Google OAuth return ───
  // After Google redirects back, we need BOTH: a valid session AND invitation data.
  // We use refs to avoid stale closure issues and a single orchestrator effect.
  const oauthAcceptedRef = useRef(false);
  const invitationRef = useRef(invitation);
  invitationRef.current = invitation;

  const tryAcceptOAuth = useCallback(async (user: any) => {
    if (oauthAcceptedRef.current) return;
    oauthAcceptedRef.current = true;
    localStorage.removeItem('pending_invitation_token');
    setSubmitLoading(true);

    try {
      // Check if this Google account already has a Sales profile
      const { data: salesProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (salesProfile) {
        oauthAcceptedRef.current = false;
        setError("Ce compte Google est déjà associé à un compte CloseOS Sales. Veuillez utiliser un autre compte.");
        setSubmitLoading(false);
        return;
      }

      const fullName = user.user_metadata?.full_name || '';
      const parts = fullName.split(' ');
      await acceptInvitation(
        user.id,
        user.email || '',
        parts[0] || '',
        parts.slice(1).join(' ') || '',
        user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
      );
      // Show verification before onboarding
      setPendingVerification({ userId: user.id, email: user.email || '', authMethod: 'google' });
    } catch (err: any) {
      oauthAcceptedRef.current = false; // allow retry
      setError(err.message || "Erreur lors de l'acceptation.");
    } finally {
      setSubmitLoading(false);
    }
  }, [token, navigate]);

  // Single effect: listen for auth + poll until both invitation & session are ready
  useEffect(() => {
    const pendingToken = localStorage.getItem('pending_invitation_token');
    if (!pendingToken || oauthAcceptedRef.current) return;

    let cancelled = false;

    // Method 1: auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled || oauthAcceptedRef.current) return;
        if (session?.user && invitationRef.current) {
          await tryAcceptOAuth(session.user);
        }
      }
    );

    // Method 2: poll every 500ms for up to 10s (handles cases where auth event already fired)
    const poll = async () => {
      for (let i = 0; i < 20; i++) {
        if (cancelled || oauthAcceptedRef.current) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && invitationRef.current) {
          await tryAcceptOAuth(session.user);
          return;
        }
        await new Promise(r => setTimeout(r, 500));
      }
    };
    poll();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [tryAcceptOAuth]);

  // ─── Success: redirect after verification ───
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => navigate('/business/organisation'), 2500);
      return () => clearTimeout(t);
    }
  }, [success, navigate]);

  const inviterName = invitation?.inviter?.full_name || 'Un manager';
  const inviterFirstName = inviterName.split(' ')[0];
  const companyName = ownerSettings?.company_name || 'une organisation';
  const role = invitation?.role || 'Membre';

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-neutral-900">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400 dark:text-neutral-500" />
      </div>
    );
  }

  // ─── Error (no invitation) ───
  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-neutral-900 px-4">
        <div className="w-full max-w-md rounded-3xl border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 p-10 text-center shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-stone-900 dark:text-white mb-2">Invitation invalide</h2>
          <p className="text-stone-500 dark:text-neutral-400 mb-6">{error}</p>
          <Link
            to="/business/register"
            className="inline-flex items-center gap-2 bg-stone-900 text-white px-7 py-3.5 rounded-full font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xl text-sm"
          >
            Créer un compte Business
          </Link>
        </div>
      </div>
    );
  }

  // ─── Verification ───
  if (pendingVerification) {
    return (
      <BusinessVerification
        userId={pendingVerification.userId}
        email={pendingVerification.email}
        authMethod={pendingVerification.authMethod}
        onVerified={() => {
          setSuccess(true);
          setPendingVerification(null);
        }}
        onCancel={() => setPendingVerification(null)}
      />
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-neutral-900 px-4">
        <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white dark:bg-neutral-800 p-10 text-center shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-stone-900 dark:text-white mb-2">Bienvenue dans l'équipe !</h2>
          <p className="text-stone-500 dark:text-neutral-400 mb-2">
            Vous avez rejoint <strong>{companyName}</strong> en tant que <strong>{role}</strong>.
          </p>
          <p className="text-sm text-stone-400 dark:text-neutral-500">Redirection vers le dashboard...</p>
        </div>
      </div>
    );
  }

  // ─── Main: Two-column layout ───
  return (
    <div className="flex min-h-screen">
      {/* ─── LEFT PANEL: Company info ─── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-stone-100 dark:bg-neutral-800 p-12 xl:p-24 relative overflow-hidden">
        {/* Decorative blob */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 space-y-12">
          {/* Branding */}
          <div className="flex items-center gap-4">
            {ownerSettings?.logo_url ? (
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white">
                <img src={ownerSettings.logo_url} alt={companyName} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-stone-900 flex items-center justify-center rounded-xl">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            )}
            <span className="font-extrabold text-xl tracking-tight uppercase text-stone-900 dark:text-white">{companyName}</span>
          </div>

          {/* Headline */}
          <div className="max-w-md">
            <h1 className="text-5xl font-extrabold tracking-tight leading-[1.1] mb-6 text-stone-900 dark:text-white">
              Rejoignez <span className="text-emerald-700 italic">{companyName}</span>.
            </h1>
            {ownerSettings?.description && (
              <p className="text-stone-500 dark:text-neutral-400 text-lg leading-relaxed">{ownerSettings.description}</p>
            )}
          </div>

          {/* Info Cards */}
          <div className="grid gap-4 max-w-sm">
            {inviterName && (
              <div className="p-6 bg-white/50 dark:bg-white/5 border border-stone-200/20 dark:border-neutral-700 rounded-2xl hover:bg-white dark:hover:bg-white/10 transition-colors">
                <p className="text-[10px] font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-1">Dirigeant</p>
                <p className="font-bold text-lg text-stone-900 dark:text-white">{inviterName}</p>
              </div>
            )}

            {ownerSettings?.website && (
              <div className="p-6 bg-white/50 dark:bg-white/5 border border-stone-200/20 dark:border-neutral-700 rounded-2xl hover:bg-white dark:hover:bg-white/10 transition-colors">
                <p className="text-[10px] font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-1">Site web</p>
                <a href={ownerSettings.website.startsWith('http') ? ownerSettings.website : `https://${ownerSettings.website}`} target="_blank" rel="noopener noreferrer" className="font-bold text-lg text-stone-900 dark:text-white hover:text-emerald-700 transition-colors">
                  {ownerSettings.website}
                </a>
              </div>
            )}

            {ownerSettings?.address && (
              <div className="p-6 bg-white/50 dark:bg-white/5 border border-stone-200/20 dark:border-neutral-700 rounded-2xl hover:bg-white dark:hover:bg-white/10 transition-colors">
                <p className="text-[10px] font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-1">Adresse</p>
                <p className="font-bold text-lg text-stone-900 dark:text-white">{ownerSettings.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* Trust badge */}
        <div className="relative z-10 mt-12 flex items-center gap-3 py-4 px-6 bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-full self-start border border-stone-200/10 dark:border-neutral-700">
          <Shield className="h-5 w-5 text-emerald-600" />
          <span className="text-xs font-bold tracking-widest uppercase text-stone-700 dark:text-neutral-200">Accès sécurisé</span>
        </div>
      </div>

      {/* ─── RIGHT PANEL: Registration form ─── */}
      <div className="flex flex-1 items-center justify-center bg-white dark:bg-neutral-900 px-6 py-12 sm:px-12">
        <div className="w-full max-w-md space-y-10">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <Link to="/business" className="inline-block">
              <img src="/closeos-business-logo-ecrit.png" alt="CloseOS Business" className="h-10 w-auto mx-auto dark:hidden" />
              <img src="/closeos-business-logo-ecrit-dark.png" alt="CloseOS Business" className="h-10 w-auto mx-auto hidden dark:block" />
            </Link>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white">
              Rejoignez {companyName}
            </h2>
            <p className="text-stone-500 dark:text-neutral-400">
              Invité par <span className="text-stone-900 dark:text-white font-semibold underline decoration-amber-300 decoration-4">{inviterFirstName}</span> en tant que{' '}
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-tight">
                {role}
              </span>
            </p>
          </div>

          {/* Mobile company info */}
          <div className="lg:hidden rounded-2xl bg-stone-50 dark:bg-neutral-800 border border-stone-200/50 dark:border-neutral-700 p-4 flex items-center gap-3">
            {ownerSettings?.logo_url ? (
              <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 border border-white shadow-sm">
                <img src={ownerSettings.logo_url} alt={companyName} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-900 shrink-0">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800 dark:text-neutral-100 truncate">{companyName}</p>
              <p className="text-xs text-stone-500 dark:text-neutral-400 truncate">Invité par {inviterName}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {/* Google signup */}
          <button
            onClick={handleGoogleSignup}
            disabled={googleLoading || submitLoading}
            className="flex w-full items-center justify-center gap-3 py-4 px-6 border border-stone-200/30 dark:border-neutral-700 rounded-full font-bold text-stone-900 dark:text-white hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors active:scale-95 duration-200 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continuer avec Google
          </button>

          {/* Separator */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-stone-200/20 dark:border-neutral-700" />
            <span className="flex-shrink mx-4 text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-neutral-500">Ou avec email</span>
            <div className="flex-grow border-t border-stone-200/20 dark:border-neutral-700" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* First name / Last name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 ml-2">Prénom</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl py-4 px-6 text-stone-900 dark:text-white placeholder:text-stone-400/60 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-stone-900/20 transition-all focus:outline-none"
                  placeholder="Jean"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 ml-2">Nom</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl py-4 px-6 text-stone-900 dark:text-white placeholder:text-stone-400/60 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-stone-900/20 transition-all focus:outline-none"
                  placeholder="Dupont"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 ml-2">Adresse email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl py-4 px-6 text-stone-900 dark:text-white placeholder:text-stone-400/60 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-stone-900/20 transition-all focus:outline-none"
                placeholder="jean.dupont@business.com"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 ml-2">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-stone-100 border-none rounded-xl py-4 px-6 pr-12 text-stone-900 placeholder:text-stone-400/60 focus:ring-2 focus:ring-stone-900/20 transition-all focus:outline-none"
                  placeholder="••••••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitLoading}
              className="w-full py-5 bg-stone-900 dark:bg-white dark:text-black text-white rounded-full font-extrabold text-lg tracking-tight hover:shadow-xl hover:shadow-stone-900/10 transition-all active:scale-95 duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "Accepter l'invitation"
              )}
            </button>
          </form>

          {/* Legal + login link */}
          <div className="space-y-4 text-center">
            <p className="text-[11px] text-stone-500 dark:text-neutral-400 leading-relaxed">
              En continuant, vous acceptez nos <Link to="#" className="underline text-stone-900 dark:text-white">Conditions Générales</Link> et notre <Link to="#" className="underline text-stone-900 dark:text-white">Politique de Confidentialité</Link>.
            </p>
            <p className="text-sm text-stone-500 dark:text-neutral-400">
              Déjà un compte ?{' '}
              <Link to="/business/login" className="font-semibold text-stone-900 dark:text-white hover:text-stone-600 dark:hover:text-neutral-200 transition-colors">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
