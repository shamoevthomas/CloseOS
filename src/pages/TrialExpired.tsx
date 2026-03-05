import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, Sparkles, Rocket, Crown, ArrowRight, LogOut, Clock } from 'lucide-react';

export function TrialExpired() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        navigate('/', { replace: true });
    };

    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || '';

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans selection:bg-blue-500/30">
            {/* Header */}
            <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/logo.PNG" alt="CloseOS Logo" className="h-8 w-auto" />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                    >
                        <LogOut className="h-4 w-4" />
                        Déconnexion
                    </button>
                </div>
            </nav>

            <main className="flex-1 py-12 px-4 sm:px-6 lg:py-20">
                <div className="max-w-5xl mx-auto">
                    {/* Hero */}
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
                            <Clock className="h-4 w-4 text-amber-400" />
                            <span className="text-sm font-bold text-amber-400">
                                Votre essai gratuit est terminé
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
                            Continuez à <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">closer</span> avec CloseOS
                        </h1>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                            {firstName ? `${firstName}, c` : 'C'}hoisissez le plan qui correspond à vos ambitions. Sans engagement, annulable à tout moment.
                        </p>
                    </div>

                    {/* Plans */}
                    <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">

                        {/* STARTER */}
                        <div className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-8 flex flex-col transition-all hover:border-slate-700 group">
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="rounded-lg bg-slate-800 p-2">
                                        <Rocket className="h-5 w-5 text-slate-300" />
                                    </div>
                                    <h2 className="text-xl font-bold">Starter</h2>
                                </div>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-4xl font-black">39€</span>
                                    <span className="text-slate-400 text-sm">/mois</span>
                                </div>
                                <p className="text-sm text-slate-500">Tout ce qu'il faut pour organiser votre closing.</p>
                            </div>

                            <div className="space-y-3 mb-8 flex-1">
                                {[
                                    "Pipeline Visuel illimité",
                                    "Agenda & Booking (Liens de rdv)",
                                    "Facturation (Générateur PDF)",
                                    "KPIs (CA, Conversion, Ventes)",
                                    "Rappels programmables",
                                    "Support standard email"
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => navigate('/checkout-starter')}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-700 hover:border-slate-600 group-hover:scale-[1.02]"
                            >
                                Choisir Starter
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>

                        {/* FOUNDER */}
                        <div className="relative rounded-2xl border-2 border-blue-500/30 bg-gradient-to-b from-blue-500/5 to-transparent p-8 flex flex-col transition-all hover:border-blue-500/50 group">
                            {/* Badge populaire */}
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-blue-600 text-white text-xs font-bold shadow-lg shadow-blue-600/30">
                                    <Crown className="h-3 w-3" />
                                    POPULAIRE
                                </span>
                            </div>

                            <div className="mb-6 pt-2">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="rounded-lg bg-blue-500/20 p-2">
                                        <Sparkles className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <h2 className="text-xl font-bold">Founder</h2>
                                </div>
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-4xl font-black">29€</span>
                                    <span className="text-slate-400 text-sm">/mois</span>
                                    <span className="text-lg text-slate-500 line-through ml-1">69€</span>
                                </div>
                                <p className="text-sm text-blue-400 font-medium">Prix fondateur à vie</p>
                            </div>

                            <div className="space-y-3 mb-8 flex-1">
                                {[
                                    "Tout Starter inclus",
                                    "KPI Avancés (Évolution, Objectifs)",
                                    "Call Room & Scripts Interactifs",
                                    "Automatisations (Factures & CRM)",
                                    "Badges Founder & Support Prioritaire"
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => navigate('/checkout')}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 group-hover:scale-[1.02]"
                            >
                                Choisir Founder
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Footer note */}
                    <div className="text-center mt-10">
                        <p className="text-xs text-slate-500 max-w-lg mx-auto">
                            Paiement sécurisé par Stripe. Essai gratuit de 10 jours inclus dans chaque plan.
                            Annulable à tout moment depuis vos paramètres.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
