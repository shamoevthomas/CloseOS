import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Lock, User, Mail, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFirstPromoterReferral } from '../lib/firstpromoter';

export function Return() {
  const [status, setStatus] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [loadingStripe, setLoadingStripe] = useState(true);

  const { lang } = useLanguage();
  // 👇 On récupère le paramètre "plan" de l'URL (envoyé par Stripe)
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');

  // États pour l'inscription
  const { register, loginWithGoogle, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'password' | 'google'>('password');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 👇 PROTECTION IFRAME : Si on est chargé dans une iframe (ex: Stripe Embedded), on sort !
    if (window.self !== window.top && window.top) {
      window.top.location.href = window.location.href;
      return;
    }

    const sessionId = searchParams.get('session_id');

    // 👇👇👇 LA PORTE DÉROBÉE DU FONDATEUR 👇👇👇
    if (searchParams.get('admin_bypass') === 'true') {
      setStatus('complete');
      setCustomerEmail('admin@closeos.fr');
      setLoadingStripe(false);
      return;
    }
    // 👆👆👆 FIN DE LA PORTE DÉROBÉE 👆👆👆

    if (sessionId) {
      fetch(`/api/session-status?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setStatus(data.status);
          setCustomerEmail(data.customer_email);
          setLoadingStripe(false);
        })
        .catch(() => setLoadingStripe(false));
    } else {
      setLoadingStripe(false);
    }
  }, [searchParams]);

  // 👇 FONCTION D'ENVOI D'EMAIL (BREVO) AJOUTÉE ICI
  const sendWelcomeEmail = async (email: string, userName: string) => {

    const subject = "Bienvenue sur CloseOS Pro 💎";

    const title = "Membre Pro Confirmé";

    const subtext = "Votre accès Pro est activé. Préparez-vous à closer.";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #020617; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
           <h1 style="color: #ffffff; margin: 0; font-size: 24px;">CloseOS</h1>
        </div>
        <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Bonjour ${userName},</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #475569;">
            Félicitations ! Votre inscription est validée. <br/>
            <strong>Statut : <span style="color: #2563eb;">${title}</span></strong>
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #475569;">${subtext}</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 14px; text-transform: uppercase;">🚀 Prochaines étapes :</h3>
            <ul style="font-size: 15px; line-height: 1.6; padding-left: 20px; margin-bottom: 0; color: #334155;">
              <li>Rejoignez le canal WhatsApp (lien sur votre espace).</li>
              <li>Surveillez vos emails pour l'ouverture officielle le <strong>1er Mars</strong>.</li>
              <li><strong>Rappel :</strong> L'accès au logiciel ouvrira le 1er Mars et votre essai gratuit ne débutera qu'à ce moment-là.</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="https://closeos.fr/" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accéder à mon Espace</a>
          </div>
        </div>
        <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px;">
          © 2026 CloseOS. Vous recevez cet email car vous avez rejoint la liste d'attente.
        </p>
      </div>
    `;

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: "Thomas de CloseOS", email: "support@closeos.fr" },
          to: [{ email: email, name: userName }],
          subject: subject,
          htmlContent: htmlContent
        })
      });
      console.log("Email de bienvenue envoyé !");
    } catch (err) {
      console.error("Erreur envoi email", err);
    }
  };

  // Gestion de l'inscription par Email/Mot de passe
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthLoading(true);

    try {
      const result = await register({
        email: customerEmail,
        password,
        options: {
          data: {
            full_name: name,
            is_founder: true
          }
        }
      });

      if (result?.error) {
        setError(result.error.message);
        setAuthLoading(false);
      } else {
        // 👇 SYNC FORCÉE DE L'ABONNEMENT (pour éviter d'attendre le webhook)
        if (result.data?.user) {
          try {
            await fetch('/api/sync-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: result.data.user.id,
                email: customerEmail
              })
            });
            // 👇 UPDATE STATE AUTH
            await refreshProfile();
          } catch (syncErr) {
            console.error("Erreur sync abo", syncErr);
          }
        }

        // 👇 ENVOI DE L'EMAIL AJOUTÉ ICI
        await sendWelcomeEmail(customerEmail, name);

        // 👇 FirstPromoter : suivi parrainage à l'inscription (attend que le script soit chargé)
        await trackFirstPromoterReferral(customerEmail);

        // 👇 REDIRECTION : On transmet le plan à la page suivante
        navigate('/welcome-founder');
      }
    } catch (err: any) {
      setError(lang === 'fr' ? "Une erreur est survenue lors de la création du compte." : "An error occurred while creating the account.");
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      // FirstPromoter : stocker l'email pour le suivi après le callback OAuth
      sessionStorage.setItem("fpr_pending_email", customerEmail);
      const { error } = await loginWithGoogle();
      if (error) setError(error.message);
      // Note : Pour Google, la redirection dépend de la configuration Supabase, 
      // mais pour le mot de passe, c'est géré juste au-dessus.
    } catch (err) {
      setError(lang === 'fr' ? "Impossible de lancer la connexion Google." : "Unable to launch Google login.");
    } finally {
      setAuthLoading(false);
    }
  };

  if (!loadingStripe && status === 'open') {
    return <Navigate to="/checkout" />;
  }
  if (!loadingStripe && !status) {
    return <Navigate to="/" />;
  }

  if (loadingStripe) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-white/40 text-sm">{lang === 'fr' ? 'Vérification du paiement...' : 'Verifying payment...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans selection:bg-emerald-500/30">
      <div className="w-full max-w-lg bg-[#0B1121] border border-emerald-500/20 rounded-3xl p-8 shadow-2xl shadow-emerald-900/10 animate-in fade-in zoom-in duration-500">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-full mb-4 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{lang === 'fr' ? 'Paiement réussi !' : 'Payment successful!'}</h1>
          <p className="text-white/40">
            {lang === 'fr' ? 'Bienvenue sur CloseOS Pro. Finalisez votre compte pour accéder à votre espace.' : 'Welcome to CloseOS Pro. Complete your account to access your workspace.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-[#1a1a1a] rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('password')}
            className={`py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'password'
              ? 'bg-white/5 text-white shadow-lg border border-white/[0.08]'
              : 'text-white/40 hover:text-white/60'
              }`}
          >
            {lang === 'fr' ? 'Mot de passe' : 'Password'}
          </button>
          <button
            onClick={() => setActiveTab('google')}
            className={`py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'google'
              ? 'bg-white/5 text-white shadow-lg border border-white/[0.08]'
              : 'text-white/40 hover:text-white/60'
              }`}
          >
            Google
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase mb-1.5 ml-1">{lang === 'fr' ? 'Email (lié au paiement)' : 'Email (linked to payment)'}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  type="email"
                  value={customerEmail}
                  disabled={customerEmail !== 'admin@closeos.fr'}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className={`w-full bg-[#1a1a1a]/50 border border-white/[0.08] rounded-xl py-3 pl-10 pr-4 text-white/60 focus:outline-none ${customerEmail === 'admin@closeos.fr' ? 'cursor-text text-white border-emerald-500' : 'cursor-not-allowed opacity-70'}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Lock className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase mb-1.5 ml-1">{lang === 'fr' ? 'Votre Nom' : 'Your Name'}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex: Thomas Shelby"
                  className="w-full bg-[#1a1a1a] border border-white/[0.08] rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase mb-1.5 ml-1">{lang === 'fr' ? 'Choisir un mot de passe' : 'Choose a password'}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full bg-[#1a1a1a] border border-white/[0.08] rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (lang === 'fr' ? "Activer mon compte" : "Activate my account")}
              {!authLoading && <LayoutDashboard className="h-4 w-4" />}
            </button>
          </form>
        )}

        {activeTab === 'google' && (
          <div className="text-center py-4">
            <p className="text-white/40 mb-6 text-sm">
              {lang === 'fr' ? "Utilisez votre compte Google pour accéder directement à l'espace membre." : 'Use your Google account to directly access the member area.'}
              <br />
              <span className="text-xs text-white/40">{lang === 'fr' ? "(L'email doit correspondre à celui utilisé pour le paiement)" : '(Email must match the one used for payment)'}</span>
            </p>

            <button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full bg-white hover:bg-white/90 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {authLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-black" />
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
              )}
              {lang === 'fr' ? 'Continuer avec Google' : 'Continue with Google'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}