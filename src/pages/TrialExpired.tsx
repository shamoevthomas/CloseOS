import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUpgrade } from '../contexts/UpgradeContext';
import { CheckCircle2, LogOut, ShieldCheck, X, ArrowLeft, Square, CheckSquare, AlertCircle, TicketPercent, Loader2, Download } from 'lucide-react';
import { DataExportModal } from '../components/DataExportModal';
import { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_live_51SxnxC33xpuYLywqRhYvxhWrChlI3Ckjj1AfJLqRQJQwaXNyVLuLAPaURbnEcrKRAQJTneB3ZjhUHSHuFQ9Xekdt00k1ho4IEt');

// Features Pack Pro
const PRO_FEATURES = [
    'CRM & Pipeline illimité',
    'Agenda & Booking (Liens de rdv)',
    'Facturation & Envoi Automatique',
    'KPI Avancés (Évolution, Objectifs)',
    'Call Room (Scripts & Notes)',
    'Automatisations (Sync CRM, etc.)',
    'Enregistrement Vidéo/Audio',
    'Support Prioritaire',
];

// Price IDs — Pack Pro
const PRICES: Record<string, string> = {
    monthly: 'price_1TBghQ33xpuYLywqqw113Vxv',
    yearly: 'price_1TBh2Y33xpuYLywqZaoPaqth',
};

const BASE_PRICES: Record<string, number> = { monthly: 34, yearly: 25.50 };
const CROSSED_PRICES: Record<string, number> = { monthly: 69, yearly: 45 };

export function TrialExpiredModal() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, profile, isAdmin, refreshProfile } = useAuth();
    const { isUpgradeModalOpen, hideUpgrade } = useUpgrade();

    // Step management
    const [step, setStep] = useState<'select' | 'checkout' | 'success'>('select');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const selectedPlan = 'pro';
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');


    // Stripe checkout
    const [clientSecret, setClientSecret] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Promo code
    const [referralCode, setReferralCode] = useState('');
    const [appliedCode, setAppliedCode] = useState('');
    const [isApplyingCode, setIsApplyingCode] = useState(false);
    const [displayDiscount, setDisplayDiscount] = useState(0);

    // CGV
    const [isTermsAccepted, setIsTermsAccepted] = useState(false);
    const [showTermsError, setShowTermsError] = useState(false);

    // Determine visibility (computed BEFORE hooks that depend on it)
    const hiddenPaths = ['/checkout', '/return', '/welcome-founder', '/', '/login', '/register'];
    const isOnHiddenPath = hiddenPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
    const hasSubscription = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
    const isPaymentFailed = profile?.subscription_status === 'past_due' || profile?.subscription_status === 'unpaid';
    const created = user?.created_at ? new Date(user.created_at) : null;
    const trialEnd = created ? new Date(created.getTime() + 10 * 24 * 60 * 60 * 1000) : null;
    const isTrialExpired = trialEnd ? new Date() > trialEnd : false;
    const isTrialExpiredShow = !isOnHiddenPath && !isAdmin && !hasSubscription && !isPaymentFailed && !!user?.created_at && !!profile && isTrialExpired;
    const isPaymentFailedShow = !isOnHiddenPath && !isAdmin && isPaymentFailed && !!profile;
    const shouldShow = isTrialExpiredShow || isPaymentFailedShow || isUpgradeModalOpen;

    const [portalLoading, setPortalLoading] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/', { replace: true });
    };

    const handleOpenPortal = async () => {
        setPortalLoading(true);
        try {
            const res = await fetch('/api/create-portal-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert('Impossible d\'ouvrir le portail de paiement.');
        } catch {
            alert('Erreur lors de l\'ouverture du portail.');
        } finally {
            setPortalLoading(false);
        }
    };

    // Fetch Stripe client secret
    const fetchClientSecret = () => {
        setClientSecret('');
        setLoading(true);
        setError('');
        const priceId = PRICES[billingCycle];
        const lineItems = [{ price: priceId, quantity: 1 }];

        const promotekitReferral =
            typeof window !== 'undefined' && (window as any).promotekit_referral
                ? (window as any).promotekit_referral
                : null;

        // Lire le cookie/localStorage de parrainage
        const cookieRef = document.cookie.match(/closeos_ref=([^;]+)/)?.[1] || '';
        const internalRef = decodeURIComponent(cookieRef) || localStorage.getItem('closeos_ref') || '';

        fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lineItems,
                plan: 'pro',
                referralCode: appliedCode,
                promotekitReferral,
                referral_code: localStorage.getItem('referral_code') ?? '',
                internalReferral: internalRef,
                userId: user?.id,
                customerEmail: user?.email,
                existingUser: true,
            }),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error('Erreur API');
                return res.json();
            })
            .then((data) => {
                setClientSecret(data.clientSecret);
                setDisplayDiscount(data.percentOff || 0);
                setLoading(false);
                setIsApplyingCode(false);
                if (appliedCode && !data.promoApplied) {
                    alert("Ce code promo n'existe pas ou est inactif.");
                    setAppliedCode('');
                    setReferralCode('');
                }
            })
            .catch((err) => {
                console.error(err);
                setError('Erreur de chargement du module de paiement.');
                setLoading(false);
                setIsApplyingCode(false);
            });
    };

    // When upgrade modal opens, reset to select step
    useEffect(() => {
        if (isUpgradeModalOpen) {
            setStep('select');
        }
    }, [isUpgradeModalOpen]);

    // Fetch when entering step 2 or when code changes — MUST be after all useState
    useEffect(() => {
        if (shouldShow && step === 'checkout') {
            fetchClientSecret();
        }
    }, [shouldShow, step, billingCycle, appliedCode]);

    // Fire confetti + sync subscription when entering success step
    useEffect(() => {
        if (step === 'success') {
            // Sync subscription immediately on payment completion
            (async () => {
                try {
                    await fetch('/api/sync-subscription', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user?.id, email: user?.email }),
                    });
                } catch (e) {
                    console.error('Auto sync-subscription failed:', e);
                }
                await refreshProfile();
            })();

            const duration = 2000;
            const end = Date.now() + duration;
            const frame = () => {
                confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
                confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
                if (Date.now() < end) requestAnimationFrame(frame);
            };
            frame();
        }
    }, [step]);

    const handleSuccessClose = useCallback(async () => {
        // Force sync Stripe → Supabase avant de rafraîchir le profil
        try {
            await fetch('/api/sync-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id, email: user?.email }),
            });
        } catch (e) {
            console.error('sync-subscription failed, relying on webhook:', e);
        }
        await refreshProfile();
        setStep('select');
        if (isUpgradeModalOpen) hideUpgrade();
    }, [user, refreshProfile, isUpgradeModalOpen, hideUpgrade]);

    // Guard: return null AFTER all hooks
    if (!shouldShow) return null;

    const handleApplyCode = () => {
        if (referralCode.trim() !== appliedCode) {
            setIsApplyingCode(true);
            setAppliedCode(referralCode.trim().toUpperCase());
        }
    };

    const handleOverlayClick = () => {
        if (!isTermsAccepted) {
            setShowTermsError(true);
        }
    };

    const toggleTerms = () => {
        if (isTermsAccepted) {
            setIsTermsAccepted(false);
        } else {
            setIsTermsAccepted(true);
            setShowTermsError(false);
        }
    };

    const handleGoToCheckout = () => {
        setStep('checkout');
    };

    const handleBackToSelect = () => {
        setStep('select');
        setClientSecret('');
        setIsTermsAccepted(false);
        setShowTermsError(false);
        setReferralCode('');
        setAppliedCode('');
        setDisplayDiscount(0);
    };

    // Computed visuals
    const basePrice = BASE_PRICES[billingCycle];
    const crossedPrice = CROSSED_PRICES[billingCycle];
    const finalPrice = displayDiscount > 0
        ? (basePrice * (1 - displayDiscount / 100)).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
        : basePrice;
    const features = PRO_FEATURES;
    const planLabel = 'Pack Pro';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">

            {/* ==================== PAYMENT FAILED ==================== */}
            {isPaymentFailedShow && !isUpgradeModalOpen && (
                <div className="relative w-full max-w-md rounded-2xl bg-[#0B1120] border border-red-500/30 shadow-2xl p-10 text-center" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border-2 border-red-500/30">
                        <AlertCircle className="h-8 w-8 text-red-400" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-white mb-2">Échec de paiement</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                        Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour continuer à utiliser CloseOS.
                    </p>
                    <button
                        onClick={handleOpenPortal}
                        disabled={portalLoading}
                        className="w-full rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50 mb-3"
                    >
                        {portalLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Mettre à jour mon moyen de paiement'}
                    </button>
                    <div className="mt-4 space-y-3">
                        <button onClick={() => setIsExportOpen(true)} className="flex items-center justify-center gap-2 text-slate-400 hover:text-blue-400 transition-colors text-sm font-medium w-full">
                            <Download className="h-4 w-4" />
                            Extraire mes données
                        </button>
                        <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm w-full">
                            <LogOut className="h-4 w-4" />
                            Se déconnecter
                        </button>
                    </div>
                </div>
            )}

            {/* ==================== STEP 1: SELECT PLAN ==================== */}
            {step === 'select' && !isPaymentFailedShow && (
                <div className="relative w-full max-w-[900px] rounded-2xl bg-[#0B1120] border border-slate-800 shadow-2xl overflow-hidden" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                    {isUpgradeModalOpen && !isTrialExpiredShow && (
                        <button onClick={hideUpgrade} className="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    )}
                    <div className="grid md:grid-cols-2">

                        {/* LEFT */}
                        <div className="p-8 md:p-10 flex flex-col justify-between border-r border-slate-800/50">
                            <div>
                                <div className="flex items-center gap-2.5 mb-8">
                                    <img src="/logo-sales.png" alt="CloseOS Logo" className="h-14 w-auto" />
                                </div>
                                <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-4">
                                    {isTrialExpiredShow
                                        ? <>Votre essai gratuit de<br />10 jours est terminé</>
                                        : <>Passez au niveau<br />supérieur</>}
                                </h2>
                                <p className="text-slate-400 text-sm leading-relaxed mb-8 transition-opacity duration-300" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                                    L'outil tout-en-un pour les closers. Accès complet & illimité.
                                </p>
                                <div className="space-y-3" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                                    {features.map((text, i) => (
                                        <div key={i} className="flex items-center gap-3" style={{ animation: `fadeSlideIn 0.3s ease-out ${i * 0.05}s both` }}>
                                            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                                            <span className="text-slate-300 text-sm font-medium">{text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-8 space-y-3">
                                <button onClick={() => setIsExportOpen(true)} className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors text-sm font-medium">
                                    <Download className="h-4 w-4" />
                                    Extraire mes données
                                </button>
                                <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm">
                                    <LogOut className="h-4 w-4" />
                                    Se déconnecter
                                </button>
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div className="p-8 md:p-10 flex flex-col">
                            <h3 className="text-lg font-bold text-white text-center mb-6">Pack Pro — Accès complet</h3>

                            {/* Billing toggle */}
                            <div className="flex justify-center mb-5">
                                <div className="bg-slate-900/50 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
                                    <button
                                        onClick={() => setBillingCycle('monthly')}
                                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${billingCycle === 'monthly' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Mensuel
                                    </button>
                                    <button
                                        onClick={() => setBillingCycle('yearly')}
                                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-blue-600 text-white shadow-lg border border-blue-500' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Annuel
                                        <span className="bg-white text-blue-600 text-[9px] px-1.5 py-0.5 rounded-full font-black">-25%</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4 flex-1">
                                <div className="relative">
                                    <div className="w-full rounded-xl border border-blue-500 bg-blue-500/5 p-5 text-left">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-white font-bold text-base">Offre Pro</p>
                                                <p className="text-blue-400 text-xs mt-0.5">Accès complet & illimité</p>
                                            </div>
                                            <div className="text-right flex items-center gap-2">
                                                <span className="text-sm text-slate-500 line-through">{crossedPrice}€</span>
                                                <span className="text-2xl font-black text-white">{basePrice}€</span>
                                                <span className="text-slate-400 text-xs">/mois</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CTA */}
                            <button
                                onClick={handleGoToCheckout}
                                className="w-full mt-6 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-[0.98]"
                            >
                                S'abonner maintenant
                            </button>
                            <p className="text-center text-[11px] text-slate-500 mt-3 leading-relaxed">
                                Paiement sécurisé par Stripe. Annulation possible à tout moment.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== STEP 2: CHECKOUT ==================== */}
            {step === 'checkout' && !isPaymentFailedShow && (
                <div className="w-full max-w-[1000px] max-h-[90vh] rounded-2xl bg-[#0B1120] border border-slate-800 shadow-2xl overflow-y-auto" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                    {/* Header */}
                    <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0B1120]/95 backdrop-blur-sm">
                        <button onClick={handleBackToSelect} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
                            <ArrowLeft className="h-4 w-4" />
                            Retour
                        </button>
                        <img src="/logo-sales.png" alt="CloseOS Logo" className="h-11 w-auto" />
                        <div className="w-16" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-0">
                        {/* LEFT: Plan summary + promo + CGV */}
                        <div className="p-6 md:p-8 space-y-6 border-r border-slate-800/50">

                            {/* Plan summary */}
                            <div className="rounded-2xl p-6 border bg-blue-600/5 border-blue-500/20">
                                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">🔥 -51% Offre de lancement</div>
                                <h3 className="text-xl font-extrabold text-white mb-1">{planLabel} {billingCycle === 'yearly' && '(Annuel)'}</h3>
                                <p className="text-slate-400 text-sm mb-4">Accès complet & illimité</p>

                                <div className="flex items-baseline gap-2 mb-4 flex-wrap">
                                    <span className="text-4xl font-black text-white">{finalPrice}€</span>
                                    {crossedPrice > 0 && displayDiscount === 0 && (
                                        <span className="text-lg text-slate-500 line-through">{crossedPrice}€</span>
                                    )}
                                    {displayDiscount > 0 && (
                                        <>
                                            <span className="text-lg text-slate-500 line-through">{basePrice}€</span>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                                                -{displayDiscount}%
                                            </span>
                                        </>
                                    )}
                                    <span className="text-slate-400 text-sm">
                                        {billingCycle === 'yearly'
                                            ? '/mois (facturé 306€/an)'
                                            : '/mois'}
                                    </span>
                                </div>

                                {billingCycle === 'yearly' && (
                                    <p className="text-xs text-emerald-400 font-medium">✨ -25% avec la facturation annuelle</p>
                                )}

                                <div className="space-y-2.5 mt-4">
                                    {features.map((text, i) => (
                                        <div key={i} className="flex items-center gap-2.5 text-slate-300 text-sm">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                            <span>{text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Billing toggle small */}
                            <div className="flex justify-center">
                                <div className="bg-slate-900/50 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
                                    <button
                                        onClick={() => setBillingCycle('monthly')}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${billingCycle === 'monthly' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Mensuel
                                    </button>
                                    <button
                                        onClick={() => setBillingCycle('yearly')}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Annuel
                                        <span className="bg-white text-blue-600 text-[9px] px-1.5 py-0.5 rounded-full font-black">-25%</span>
                                    </button>
                                </div>
                            </div>

                            {/* Promo code */}
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                                    <TicketPercent className="h-4 w-4 text-blue-400" />
                                    <span className="font-semibold">Code de parrainage / Promo</span>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Ex: ADMIN15"
                                        value={referralCode}
                                        onChange={(e) => setReferralCode(e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors uppercase placeholder:normal-case"
                                    />
                                    <button
                                        onClick={handleApplyCode}
                                        disabled={isApplyingCode || !referralCode}
                                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                                    >
                                        {isApplyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
                                    </button>
                                </div>
                                {appliedCode && !isApplyingCode && (
                                    <p className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Code appliqué ! Vérifiez le montant total.
                                    </p>
                                )}
                            </div>

                            {/* CGV checkbox */}
                            <div id="terms-checkbox" className={`p-4 rounded-2xl border transition-colors ${showTermsError ? 'bg-red-950/10 border-red-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                                {showTermsError && (
                                    <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-3 animate-pulse">
                                        <AlertCircle className="h-4 w-4" />
                                        Vous devez accepter les conditions pour continuer
                                    </div>
                                )}
                                <div className="flex items-start gap-3 cursor-pointer" onClick={toggleTerms}>
                                    <div className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0 ${isTermsAccepted ? 'bg-blue-600 border-blue-600' : 'border-slate-500 hover:border-blue-400'}`}>
                                        {isTermsAccepted ? <CheckSquare className="h-3.5 w-3.5 text-white" /> : <Square className="h-3.5 w-3.5 text-transparent" />}
                                    </div>
                                    <div className="text-xs text-slate-300 leading-relaxed select-none">
                                        Je reconnais avoir pris connaissance et j'accepte les <Link to="/cgu" target="_blank" className="text-blue-400 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>CGV</Link> et la <Link to="/confidentialite" target="_blank" className="text-blue-400 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>Politique de Confidentialité</Link>. Je renonce expressément à mon droit de rétractation pour accéder au service immédiatement.
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                                <ShieldCheck className="h-8 w-8 text-blue-500/50 shrink-0" />
                                <p className="text-[10px] text-slate-500 leading-tight">
                                    Paiement sécurisé par Stripe. Vos données sont cryptées. Annulation possible à tout moment.
                                </p>
                            </div>
                        </div>

                        {/* RIGHT: Stripe embedded checkout */}
                        <div className="p-4 md:p-6 min-h-[500px] flex flex-col">
                            {error ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-2xl text-center">
                                        <p className="text-red-400 mb-4 text-sm">{error}</p>
                                        <button onClick={fetchClientSecret} className="text-white bg-slate-800 px-5 py-2 rounded-xl font-bold hover:bg-slate-700 transition-all text-sm">
                                            Réessayer
                                        </button>
                                    </div>
                                </div>
                            ) : loading || !clientSecret ? (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-4" />
                                    <p className="text-slate-400 font-medium text-sm">Chargement du module sécurisé...</p>
                                </div>
                            ) : (
                                <div className="relative flex-1">
                                    <EmbeddedCheckoutProvider
                                        key={clientSecret}
                                        stripe={stripePromise}
                                        options={{ clientSecret, onComplete: () => setStep('success') }}
                                    >
                                        <EmbeddedCheckout className="h-full w-full" />
                                    </EmbeddedCheckoutProvider>

                                    {/* CGV overlay */}
                                    {!isTermsAccepted && (
                                        <div
                                            onClick={handleOverlayClick}
                                            className="absolute inset-0 z-50 bg-slate-950/10 backdrop-blur-[2px] flex items-center justify-center cursor-not-allowed transition-all duration-300"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== STEP 3: SUCCESS ==================== */}
            {step === 'success' && !isPaymentFailedShow && (
                <div className="relative w-full max-w-md rounded-2xl bg-[#0B1120] border border-slate-800 shadow-2xl p-10 text-center" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border-2 border-emerald-500/30">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400" style={{ animation: 'successPop 0.5s ease-out' }} />
                    </div>
                    <h2 className="text-2xl font-extrabold text-white mb-2">Paiement validé !</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-5">
                        Vous avez maintenant accès au <span className="text-white font-semibold">{planLabel}</span>. Bienvenue !
                    </p>
                    <div className="w-full rounded-xl overflow-hidden mb-6 border border-slate-700">
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                src="https://www.youtube.com/embed/as_MdM--MYQ?autoplay=1"
                                title="Bienvenue sur CloseOS"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="absolute inset-0 w-full h-full"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSuccessClose}
                        className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-base font-bold text-white transition-all hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-[0.98]"
                    >
                        Commencez réellement
                    </button>
                </div>
            )}


            <DataExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />

            {/* Animation keyframes */}
            <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes successPop {
          0% { opacity: 0; transform: scale(0.3); }
          60% { transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
        </div>
    );
}
