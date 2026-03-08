import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, User as UserIcon, Mail, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function BusinessInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Registration form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Lien d\'invitation invalide.');
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
        }
      } catch (err) {
        setError('Impossible de valider l\'invitation.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;
    setSubmitLoading(true);
    setError(null);

    try {
      // Check if user is already logged in
      const { data: { session } } = await supabase.auth.getSession();
      let userId: string;

      if (session?.user) {
        userId = session.user.id;
      } else {
        // Register new user
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name }
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

      // Accept the invitation
      const res = await fetch('/api/business-invitation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          user_id: userId,
          first_name: name.split(' ')[0] || '',
          last_name: name.split(' ').slice(1).join(' ') || '',
          email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'acceptation de l\'invitation.');
        setSubmitLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate('/business/dashboard'), 3000);
    } catch (err) {
      setError('Une erreur est survenue.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF6EE]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

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

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF6EE] px-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Bienvenue dans l'équipe !</h2>
          <p className="text-slate-500 mb-2">Vous avez rejoint en tant que <strong>{invitation?.role}</strong>.</p>
          <p className="text-sm text-slate-400">Redirection vers le dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDF6EE] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/business" className="inline-block">
            <img src="/logo.PNG" alt="CloseOS Business" className="h-12 w-auto mx-auto" />
          </Link>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Invitation à rejoindre l'équipe</h2>
            {invitation?.inviter && (
              <p className="text-slate-500 text-sm">
                <strong>{invitation.inviter.full_name}</strong> vous invite en tant que{' '}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
                  {invitation.role}
                </span>
              </p>
            )}
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Nom complet</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 font-bold text-white transition-all hover:bg-amber-500 disabled:opacity-50"
            >
              {submitLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Rejoindre l'équipe
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
