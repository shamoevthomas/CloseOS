import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User as UserIcon, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { registerTranslations } from '../i18n/translations';

export default function Register() {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth(); // On récupère register et loginWithGoogle
  const { lang } = useLanguage();
  const t = registerTranslations[lang];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPasswordStrength = (pw: string): number => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
  };

  const PasswordStrengthBar = ({ strength }: { strength: number }) => {
    const labels = [t.password_weak, t.password_weak, t.password_medium, t.password_strong, t.password_very_strong];
    const colors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-green-500', 'bg-green-400'];
    return (
      <div className="mt-2">
        <div className="flex gap-1 mb-1">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? colors[strength] : 'bg-slate-700'}`} />
          ))}
        </div>
        <p className={`text-xs ${colors[strength].replace('bg-', 'text-')}`}>
          {t.password_strength} : {labels[strength]}
        </p>
      </div>
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t.passwords_mismatch);
      return;
    }

    setLoading(true);

    try {
      // Check if email already has a Business account
      const { data: businessUser } = await supabase
        .from('business_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      const { data: businessTeam } = await supabase
        .from('business_team_members')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (businessUser || businessTeam) {
        setError(t.error_business_email);
        setLoading(false);
        return;
      }

      // Detect language from landing page preference
      const landingLang = localStorage.getItem('closeos_lang') || 'fr';

      const result = await register({
        email,
        password,
        options: {
          data: { full_name: name, preferred_language: landingLang }
        }
      });

      if (result?.error) {
        setError(result.error.message);
        setLoading(false);
      } else {
        // Sauvegarder le parrainage en base si présent
        const refCode = localStorage.getItem('closeos_ref') || localStorage.getItem('referral_code');
        if (refCode) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            // Chercher le parrain via son code de parrainage
            const { data: referrer } = await supabase
              .from('profiles')
              .select('id')
              .eq('own_referral_code', refCode.toUpperCase())
              .single();

            if (referrer) {
              await supabase
                .from('profiles')
                .update({ referred_by: referrer.id, referral_code: refCode })
                .eq('id', currentUser.id);
            } else {
              // Code externe (Promotekit etc.)
              await supabase
                .from('profiles')
                .update({ referral_code: refCode })
                .eq('id', currentUser.id);
            }
          }
        }
        // Save preferred language to profile
        const { data: { user: langUser } } = await supabase.auth.getUser();
        if (langUser) {
          await supabase
            .from('profiles')
            .update({ preferred_language: landingLang })
            .eq('id', langUser.id);
        }

        // Envoyer le mail de bienvenue (fire & forget)
        fetch('/api/welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email }),
        }).catch(() => {});

        // Ambassador attribution (cookie set on landing) — record signup conversion
        const ambSlug = (() => {
          const m = document.cookie.match(/(?:^|; )closeos_amb=([^;]+)/);
          return m ? decodeURIComponent(m[1]) : localStorage.getItem('closeos_amb');
        })();
        if (ambSlug) {
          const { data: { user: ambUser } } = await supabase.auth.getUser();
          fetch('/api/amb-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: ambSlug, user_id: ambUser?.id || null, email }),
          }).catch(() => {});
        }
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(t.error_generic);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await loginWithGoogle();
      if (error) setError(error.message);
    } catch (err) {
      setError(t.error_google);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#020617] px-4 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block">
            <img src="/logo-sales.png" alt="CloseOS" className="h-12 w-auto mx-auto" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0B1121] p-8 shadow-2xl shadow-blue-900/10">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-2xl font-bold text-white">{t.title}</h2>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-xs font-bold text-blue-300 mb-4">
              {t.trial_badge}
            </span>
            <p className="text-slate-400">{t.subtitle}</p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
              {error}
            </div>
          )}

          {/* BOUTON GOOGLE POUR S'INSCRIRE */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 py-3 font-medium text-white transition-all hover:bg-slate-700 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
            )}
            {t.google}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0B1121] px-2 text-slate-500">{t.or_email}</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300 text-left">{t.full_name}</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300 text-left">{t.email}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300 text-left">{t.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 py-3 pl-10 pr-12 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {password && <PasswordStrengthBar strength={getPasswordStrength(password)} />}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300 text-left">{t.confirm_password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full rounded-lg border bg-slate-900 py-3 pl-10 pr-12 text-white focus:border-blue-500 focus:outline-none ${confirmPassword && confirmPassword !== password ? 'border-red-500' : 'border-slate-700'}`}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1 text-xs text-red-500">{t.passwords_mismatch}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t.submit}
              {!loading && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400">
              {t.already_registered}{' '}
              <Link to="/login" className="font-semibold text-blue-400 hover:text-blue-300">{t.login}</Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">
            {t.tos_prefix}{' '}
            <Link to="/cgu" className="text-blue-400 hover:underline">{t.tos_cgu}</Link>
            {' '}{t.tos_and}{' '}
            <Link to="/confidentialite" className="text-blue-400 hover:underline">{t.tos_privacy}</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
