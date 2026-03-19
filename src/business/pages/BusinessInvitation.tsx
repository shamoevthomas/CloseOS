import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2, CheckCircle, AlertCircle, Mail, Lock, ArrowRight,
  Globe, Building2, User as UserIcon, Eye, EyeOff, Shield, MapPin,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

  const acceptInvitation = async (userId: string, userEmail: string, userFirstName: string, userLastName: string) => {
    const res = await fetch('/api/business-invitation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        user_id: userId,
        first_name: userFirstName,
        last_name: userLastName,
        email: userEmail,
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
      const { data: { session } } = await supabase.auth.getSession();
      let userId: string;
      let userEmail = email;

      if (session?.user) {
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
      setSuccess(true);
      setTimeout(() => navigate('/business/organisation'), 2500);
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
      const fullName = user.user_metadata?.full_name || '';
      const parts = fullName.split(' ');
      await acceptInvitation(
        user.id,
        user.email || '',
        parts[0] || '',
        parts.slice(1).join(' ') || '',
      );
      setSuccess(true);
      setTimeout(() => navigate('/business/organisation'), 2500);
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

  const inviterName = invitation?.inviter?.full_name || 'Un manager';
  const inviterFirstName = inviterName.split(' ')[0];
  const companyName = ownerSettings?.company_name || 'une organisation';
  const role = invitation?.role || 'Membre';

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF6EE]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // ─── Error (no invitation) ───
  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF6EE] px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Invitation invalide</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link
            to="/business/register"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-500 transition-all"
          >
            Créer un compte Business
          </Link>
        </div>
      </div>
    );
  }

  // ─── Success ───
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF6EE] px-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Bienvenue dans l'équipe !</h2>
          <p className="text-slate-500 mb-2">
            Vous avez rejoint <strong>{companyName}</strong> en tant que <strong>{role}</strong>.
          </p>
          <p className="text-sm text-slate-400">Redirection vers le dashboard...</p>
        </div>
      </div>
    );
  }

  // ─── Main: Two-column layout ───
  return (
    <div className="flex min-h-screen bg-[#FDF6EE]">
      {/* ─── LEFT PANEL: Company info ─── */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-amber-50 via-amber-100/50 to-orange-50 border-r border-amber-200 p-12 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

        <div className="relative z-10 max-w-md w-full space-y-8">
          {/* Logo / company image */}
          <div className="flex justify-center">
            {ownerSettings?.logo_url ? (
              <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-lg border-2 border-white bg-white">
                <img src={ownerSettings.logo_url} alt={companyName} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/20 shadow-lg border-2 border-white">
                <Building2 className="h-10 w-10 text-amber-700" />
              </div>
            )}
          </div>

          {/* Company name */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{companyName}</h2>
            {ownerSettings?.description && (
              <p className="text-sm text-slate-600 leading-relaxed">{ownerSettings.description}</p>
            )}
          </div>

          {/* Company details */}
          <div className="space-y-3">
            {inviterName && (
              <div className="flex items-center gap-3 rounded-xl bg-white/70 border border-amber-200/50 px-4 py-3">
                <UserIcon className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Dirigeant</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{inviterName}</p>
                </div>
              </div>
            )}

            {ownerSettings?.website && (
              <div className="flex items-center gap-3 rounded-xl bg-white/70 border border-amber-200/50 px-4 py-3">
                <Globe className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Site web</p>
                  <a href={ownerSettings.website.startsWith('http') ? ownerSettings.website : `https://${ownerSettings.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-amber-700 hover:text-amber-600 truncate block">
                    {ownerSettings.website}
                  </a>
                </div>
              </div>
            )}

            {ownerSettings?.address && (
              <div className="flex items-center gap-3 rounded-xl bg-white/70 border border-amber-200/50 px-4 py-3">
                <MapPin className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Adresse</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{ownerSettings.address}</p>
                </div>
              </div>
            )}
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-3 rounded-xl bg-white/60 border border-emerald-200/50 px-4 py-3">
            <Shield className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Accès sécurisé</p>
              <p className="text-xs text-slate-500">Votre invitation est unique et chiffrée.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL: Registration form ─── */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          {/* Logo for mobile (hidden on lg) */}
          <div className="mb-8 text-center lg:hidden">
            <Link to="/business" className="inline-block">
              <img src="/logo.PNG" alt="CloseOS Business" className="h-12 w-auto mx-auto" />
            </Link>
          </div>

          {/* Logo desktop */}
          <div className="hidden lg:block mb-8">
            <Link to="/business" className="inline-block">
              <img src="/logo.PNG" alt="CloseOS Business" className="h-10 w-auto" />
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Rejoignez {companyName}
            </h1>
            <p className="text-slate-500">
              <strong className="text-amber-700">{inviterFirstName}</strong> vous invite à rejoindre{' '}
              <strong>{companyName}</strong> en tant que{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
                {role}
              </span>
            </p>
          </div>

          {/* Mobile company info */}
          <div className="lg:hidden mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
            {ownerSettings?.logo_url ? (
              <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 border border-white shadow-sm">
                <img src={ownerSettings.logo_url} alt={companyName} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 shrink-0">
                <Building2 className="h-6 w-6 text-amber-700" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{companyName}</p>
              <p className="text-xs text-slate-500 truncate">Invité par {inviterName}</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {/* Google signup */}
          <button
            onClick={handleGoogleSignup}
            disabled={googleLoading || submitLoading}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 font-medium text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 shadow-sm"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
            )}
            S'inscrire avec Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#FDF6EE] px-3 text-slate-400 font-bold">Ou avec email</span></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First name / Last name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Prénom</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Jean"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nom</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Dupont"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Adresse email</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-600 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="jean.dupont@email.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mot de passe</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-600 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Minimum 8 caractères.</p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 font-bold text-white transition-all hover:bg-amber-500 hover:shadow-lg hover:shadow-amber-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Accepter l'invitation
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Shield className="h-3.5 w-3.5" />
              <span>Ce lien d'invitation est sécurisé et unique.</span>
            </div>
            <p className="text-sm text-slate-500">
              Déjà un compte ?{' '}
              <Link to="/business/login" className="font-semibold text-amber-600 hover:text-amber-500 transition-colors">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
