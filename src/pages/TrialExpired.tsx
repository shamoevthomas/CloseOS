import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, LogOut, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

const STARTER_FEATURES = [
    { icon: 'check', text: 'CRM & Pipeline illimité' },
    { icon: 'check', text: 'Agenda & Booking (Liens de rdv)' },
    { icon: 'check', text: 'Facturation (Générateur PDF)' },
    { icon: 'check', text: 'KPIs Globaux (CA, Ventes)' },
    { icon: 'check', text: 'Rappels programmables' },
];

const FOUNDER_FEATURES = [
    { icon: 'shield', text: 'Tout ce qui est inclus dans Starter' },
    { icon: 'shield', text: 'KPI Avancés (Évolution, Objectifs)' },
    { icon: 'shield', text: 'Call Room (Scripts & Notes)' },
    { icon: 'shield', text: 'Envoi Factures Automatique' },
    { icon: 'shield', text: 'Automatisations (Sync CRM, etc.)' },
    { icon: 'shield', text: 'Enregistrement Vidéo/Audio' },
    { icon: 'shield', text: 'Badge "Founder" & Support Prio' },
];

export function TrialExpiredModal() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, profile, isAdmin } = useAuth();
    const [selectedPlan, setSelectedPlan] = useState<'starter' | 'founder'>('founder');

    // Don't show on checkout/return/public pages
    const hiddenPaths = ['/checkout', '/checkout-starter', '/return', '/welcome-founder', '/', '/login', '/register'];
    if (hiddenPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))) {
        return null;
    }

    // Don't show for admin
    if (isAdmin) return null;

    // Don't show if user has an active subscription
    const hasSubscription = profile?.subscription_status && profile.subscription_status !== 'canceled';
    if (hasSubscription) return null;

    // Don't show if trial hasn't expired yet
    if (!user?.created_at || !profile) return null;
    const created = new Date(user.created_at);
    const trialEnd = new Date(created.getTime() + 10 * 24 * 60 * 60 * 1000);
    if (new Date() <= trialEnd) return null;

    const handleLogout = async () => {
        await logout();
        navigate('/', { replace: true });
    };

    const handleSubscribe = () => {
        if (selectedPlan === 'starter') {
            navigate('/checkout-starter');
        } else {
            navigate('/checkout');
        }
    };

    const features = selectedPlan === 'starter' ? STARTER_FEATURES : FOUNDER_FEATURES;
    const subtitle = selectedPlan === 'starter'
        ? 'Le système complet pour organiser votre closing et encaisser vos premières commissions.'
        : "L'expérience ultime. Accès à vie, IA et communauté privée.";

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-[900px] rounded-2xl bg-[#0B1120] border border-slate-800 shadow-2xl overflow-hidden">
                <div className="grid md:grid-cols-2">

                    {/* LEFT SIDE */}
                    <div className="p-8 md:p-10 flex flex-col justify-between border-r border-slate-800/50">
                        <div>
                            {/* Logo */}
                            <div className="flex items-center gap-2.5 mb-8">
                                <img src="/logo.PNG" alt="CloseOS Logo" className="h-9 w-auto" />
                            </div>

                            {/* Title */}
                            <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-4">
                                Votre essai gratuit de<br />10 jours est terminé
                            </h2>

                            <p
                                className="text-slate-400 text-sm leading-relaxed mb-8 transition-opacity duration-300"
                                key={selectedPlan + '-desc'}
                                style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                            >
                                {subtitle}
                            </p>

                            {/* Features — animated */}
                            <div
                                className="space-y-3"
                                key={selectedPlan}
                                style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                            >
                                {features.map((f, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3"
                                        style={{ animation: `fadeSlideIn 0.3s ease-out ${i * 0.05}s both` }}
                                    >
                                        {f.icon === 'shield' ? (
                                            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                                        ) : (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                        )}
                                        <span className="text-slate-300 text-sm font-medium">{f.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="mt-8 flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm"
                        >
                            <LogOut className="h-4 w-4" />
                            Se déconnecter
                        </button>
                    </div>

                    {/* RIGHT SIDE */}
                    <div className="p-8 md:p-10 flex flex-col">
                        <h3 className="text-lg font-bold text-white text-center mb-6">
                            Choisissez votre offre
                        </h3>

                        {/* Plans */}
                        <div className="space-y-4 flex-1">

                            {/* Starter */}
                            <button
                                onClick={() => setSelectedPlan('starter')}
                                className={`w-full rounded-xl border p-5 text-left transition-all duration-200 ${selectedPlan === 'starter'
                                    ? 'border-blue-500 bg-blue-500/5'
                                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-bold text-base">Offre Starter</p>
                                        <p className="text-slate-400 text-xs mt-0.5 italic">L'essentiel pour démarrer</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-black text-white">39€</span>
                                        <span className="text-slate-400 text-xs ml-1">/mois</span>
                                    </div>
                                </div>
                            </button>

                            {/* Founder */}
                            <div className="relative">
                                <div className="absolute -top-2.5 left-4 z-10">
                                    <span className="inline-block px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                                        Meilleure offre
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSelectedPlan('founder')}
                                    className={`w-full rounded-xl border p-5 text-left transition-all duration-200 ${selectedPlan === 'founder'
                                        ? 'border-blue-500 bg-blue-500/5'
                                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-bold text-base">Offre Founder</p>
                                            <p className="text-blue-400 text-xs mt-0.5">Accès complet & illimité</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-2xl font-black text-white">29€</span>
                                            <span className="text-slate-400 text-xs ml-1">/mois</span>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* CTA */}
                        <button
                            onClick={handleSubscribe}
                            className="w-full mt-8 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-[0.98]"
                        >
                            S'abonner maintenant
                        </button>

                        <p className="text-center text-[11px] text-slate-500 mt-4 leading-relaxed">
                            Paiement sécurisé par Stripe. Annulation possible à tout moment.
                        </p>
                    </div>
                </div>
            </div>

            {/* Keyframe animation */}
            <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
        </div>
    );
}
