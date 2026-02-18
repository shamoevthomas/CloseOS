import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';
import { CheckCircle2, ShieldCheck, ArrowLeft, Rocket, Square, CheckSquare, AlertCircle, TicketPercent, Loader2 } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { DemoExitModal } from '../components/DemoExitModal'; // 👈 IMPORT DU MODAL

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_live_51SxnxC33xpuYLywqRhYvxhWrChlI3Ckjj1AfJLqRQJQwaXNyVLuLAPaURbnEcrKRAQJTneB3ZjhUHSHuFQ9Xekdt00k1ho4IEt');

export const CheckoutStarter = () => {
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVoipSelected, setIsVoipSelected] = useState(false);

  // ÉTATS CODE PROMO
  const [referralCode, setReferralCode] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [displayDiscount, setDisplayDiscount] = useState(0);

  // ÉTATS CGV
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);

  // 👇 MODIFICATION ICI : On récupère aussi la fonction pour changer l'URL
  const [searchParams, setSearchParams] = useSearchParams();
  const isYearly = searchParams.get('billing') === 'yearly';

  // 🚀 ÉTAT POUR LE POPUP DE SORTIE
  const [showExitModal, setShowExitModal] = useState(false);
  const navigate = useNavigate();

  // Fonction pour basculer le cycle de facturation
  const handleBillingSwitch = (mode: 'monthly' | 'yearly') => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('billing', mode);
    setSearchParams(newParams);
  };

  // CONFIGURATION DES PRIX (STARTER)
  const PRICE_STARTER = isYearly
    ? "price_1Sz1Cj33xpuYLywq7Lkx6GKp"
    : "price_1SyYFA33xpuYLywqHtV34VGE";

  // ✅ IDS VOIP (Mis à jour)
  const PRICE_VOIP = isYearly
    ? "price_1T0mG633xpuYLywq8yhJmMPv" // VoIP Annuel 7€/mois
    : "price_1T0mFQ33xpuYLywq6UJANiK5"; // VoIP Mensuel 10€/mois

  // CALCUL VISUEL
  const basePrice = isYearly ? 33 : 39;
  const finalPrice = displayDiscount > 0
    ? (basePrice * (1 - displayDiscount / 100)).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    : basePrice;

  const fetchClientSecret = () => {
    setLoading(true);
    const lineItems = [{ price: PRICE_STARTER, quantity: 1 }];

    if (isVoipSelected) {
      lineItems.push({ price: PRICE_VOIP, quantity: 1 });
    }

    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineItems,
        plan: 'starter',
        referralCode: appliedCode,
        isVoip: isVoipSelected // 👇 Ajout de l'option VoIP
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erreur API');
        return res.json();
      })
      .then((data) => {
        setClientSecret(data.clientSecret);
        setLoading(false);
        setIsApplyingCode(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Erreur de chargement du module de paiement.");
        setLoading(false);
        setIsApplyingCode(false);
      });
  };

  useEffect(() => {
    fetchClientSecret();
  }, [isVoipSelected, isYearly, appliedCode]);

  const CODE_CONFIG: Record<string, number> = {
    'TEKA15': 15,
  };

  const handleApplyCode = () => {
    if (referralCode.trim() !== appliedCode) {
      setIsApplyingCode(true);
      const cleanCode = referralCode.trim().toUpperCase();
      setAppliedCode(cleanCode);

      if (CODE_CONFIG[cleanCode]) {
        setDisplayDiscount(CODE_CONFIG[cleanCode]);
      } else {
        setDisplayDiscount(0);
      }
    }
  };

  const handleOverlayClick = () => {
    if (!isTermsAccepted) {
      setShowTermsError(true);
      const checkbox = document.getElementById('terms-checkbox');
      checkbox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  if (error) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="bg-red-950/20 border border-red-900/50 p-8 rounded-3xl text-center max-w-md">
          <p className="text-red-400 mb-6">{error}</p>
          <Link to="/" className="text-white bg-slate-800 px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-blue-500/30">

      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">

          {/* 👇 REMPLACEMENT DU LINK PAR UN BOUTON AVEC ACTION */}
          <button
            onClick={() => setShowExitModal(true)}
            className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour</span>
          </button>

          <div className="flex items-center gap-2">
            <img src="/logo.PNG" alt="CloseOS Logo" className="h-8 w-auto" />
          </div>

          <div className="w-10"></div>
        </div>
      </nav>

      <main className="flex-1 py-12 px-6 lg:py-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-start">

          <div className="space-y-8">
            <div>
              <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 mb-6">
                <Rocket className="w-3 h-3" /> Offre Standard {isYearly && "(Annuel)"}
              </span>
              <h1 className="text-4xl font-extrabold text-white mb-4">Pack Starter</h1>
              <p className="text-slate-400 text-lg">
                Tout ce qu'il faut pour organiser votre closing et encaisser vos premières commissions.
              </p>
            </div>

            {/* 👇 AJOUT DU SWITCH MENSUEL / ANNUEL ICI 👇 */}
            <div className="flex justify-start">
              <div className="bg-slate-900/50 p-1.5 rounded-xl border border-slate-800 flex items-center relative gap-1">
                <button
                  onClick={() => handleBillingSwitch('monthly')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${!isYearly ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => handleBillingSwitch('yearly')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isYearly ? 'bg-blue-600 text-white shadow-lg border border-blue-500' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Annuel
                  {/* LA PETITE BULLE -15% */}
                  <span className="bg-white text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">
                    -15%
                  </span>
                </button>
              </div>
            </div>
            {/* 👆 FIN DU SWITCH 👆 */}

            <div className="bg-slate-900/40 rounded-3xl p-8 border border-slate-800 relative overflow-hidden">

              <div className="flex items-baseline gap-3 mb-6 flex-wrap">
                <span className="text-6xl font-black text-white">{finalPrice}€</span>

                {isYearly && displayDiscount === 0 && (
                  <span className="text-2xl text-slate-500 line-through">39€</span>
                )}

                {displayDiscount > 0 && (
                  <span className="text-2xl text-slate-500 line-through">{basePrice}€</span>
                )}

                {displayDiscount > 0 && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 self-center">
                    -{displayDiscount}%
                  </span>
                )}

                <span className="text-slate-400 font-medium w-full sm:w-auto">
                  {isYearly ? "/mois (facturé annuellement)" : "/mois"}
                </span>
              </div>

              <div className="space-y-4 mb-8">
                {[
                  "Pipeline Visuel illimité",
                  "Agenda & Booking (Liens de rdv)",
                  "Facturation (Générateur PDF)",
                  "KPIs (CA, Conversion, Ventes)",
                  "Support standard email"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${isVoipSelected ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                onClick={() => setIsVoipSelected(!isVoipSelected)}
              >
                <div className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors ${isVoipSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                  {isVoipSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-bold text-sm ${isVoipSelected ? 'text-white' : 'text-slate-300'}`}>Ajouter l'option VoIP & Records</span>
                    <span className="text-sm font-bold text-white">
                      {isYearly ? "+7€" : "+10€"}
                      <span className="text-slate-500 font-normal text-xs">{isYearly ? "/mois (84€/an)" : "/mois"}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Appels illimités depuis la plateforme + enregistrement automatique.</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                <TicketPercent className="h-4 w-4 text-blue-400" />
                <span className="font-semibold">Code de parrainage / Promo</span>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Ex: ADMIN15"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors uppercase placeholder:normal-case"
                />
                <button
                  onClick={handleApplyCode}
                  disabled={isApplyingCode || !referralCode}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                >
                  {isApplyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
                </button>
              </div>
              {appliedCode && !isApplyingCode && (
                <p className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Code appliqué ! Vérifiez le montant total à droite.
                </p>
              )}
            </div>

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
                <div className="text-sm text-slate-300 leading-relaxed select-none">
                  Je reconnais avoir pris connaissance et j'accepte les <Link to="/cgu" target="_blank" className="text-blue-400 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>Conditions Générales de Vente (CGV)</Link> et la <Link to="/confidentialite" target="_blank" className="text-blue-400 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>Politique de Confidentialité</Link>. Je renonce expressément à mon droit de rétractation pour accéder au service immédiatement.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
              <ShieldCheck className="h-10 w-10 text-slate-600" />
              <p className="text-xs text-slate-500 leading-tight">
                Paiement sécurisé par Stripe. Prélèvement automatique après 7 jours d'essai. Annulable à tout moment.
              </p>
            </div>
          </div>

          <div className="relative bg-[#0F172A] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden p-2 sm:p-4 min-h-[600px]">
            {/* Halo moins lumineux pour le Starter */}
            <div className="absolute -inset-4 bg-slate-600/5 blur-[60px] rounded-full pointer-events-none" />

            {loading || !clientSecret ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-500 mb-6"></div>
                <p className="text-slate-400 font-medium text-sm">Chargement du module sécurisé...</p>
              </div>
            ) : (
              <div className="relative h-full w-full">
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{ clientSecret }}
                >
                  <EmbeddedCheckout className="h-full w-full" />
                </EmbeddedCheckoutProvider>

                {/* LE BOUCLIER : Bloque les clics si CGV non acceptées */}
                {!isTermsAccepted && (
                  <div
                    onClick={handleOverlayClick}
                    className="absolute inset-0 z-50 bg-slate-950/10 backdrop-blur-[2px] flex items-center justify-center cursor-not-allowed transition-all duration-300"
                  >
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* 🚀 MODAL DE SORTIE AJOUTÉ ICI */}
      <DemoExitModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirmExit={() => navigate('/')}
      />
    </div>
  );
};