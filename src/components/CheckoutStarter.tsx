import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';
import { CheckCircle2, ShieldCheck, ArrowLeft, Rocket, Square, CheckSquare, AlertCircle, TicketPercent, Loader2 } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { DemoExitModal } from '../components/DemoExitModal'; // 👈 IMPORT DU MODAL
import { useLanguage } from '../contexts/LanguageContext';

// On force la clé live directement pour être sûr
const stripePromise = loadStripe('pk_live_51SxnxC33xpuYLywqRhYvxhWrChlI3Ckjj1AfJLqRQJQwaXNyVLuLAPaURbnEcrKRAQJTneB3ZjhUHSHuFQ9Xekdt00k1ho4IEt');

export const CheckoutStarter = () => {
  const { lang } = useLanguage();
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


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



  // CALCUL VISUEL
  const basePrice = isYearly ? 33 : 39;
  const finalPrice = displayDiscount > 0
    ? (basePrice * (1 - displayDiscount / 100)).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    : basePrice;

  const fetchClientSecret = () => {
    setClientSecret(''); // 👈 Reset pour forcer l'unmount et éviter l'erreur "multiple objects"
    setLoading(true);
    const lineItems = [{ price: PRICE_STARTER, quantity: 1 }];



    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineItems,
        plan: 'starter',
        referralCode: appliedCode,
        referral_code: localStorage.getItem('referral_code') ?? '',
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erreur API');
        return res.json();
      })
      .then((data) => {
        setClientSecret(data.clientSecret);
        setDisplayDiscount(data.percentOff || 0); // 👈 On affiche le vrai % renvoyé par Stripe
        setLoading(false);
        setIsApplyingCode(false);

        // Si l'utilisateur a tapé un code mais que Stripe renvoie 0%, c'est invalide
        if (appliedCode && !data.percentOff) {
          alert(lang === 'fr' ? "Ce code promo n'existe pas ou est inactif." : "This promo code doesn't exist or is inactive.");
          setAppliedCode(''); // On réinitialise
          setReferralCode('');
        }
      })
      .catch((err) => {
        console.error(err);
        setError(lang === 'fr' ? "Erreur de chargement du module de paiement." : "Error loading payment module.");
        setLoading(false);
        setIsApplyingCode(false);
      });
  };

  useEffect(() => {
    fetchClientSecret();
  }, [isYearly, appliedCode]);


  const handleApplyCode = () => {
    if (referralCode.trim() !== appliedCode) {
      setIsApplyingCode(true);
      const cleanCode = referralCode.trim().toUpperCase();
      setAppliedCode(cleanCode);
      // On ne calcule plus le pourcentage ici. 
      // Le useEffect va détecter le changement de appliedCode et lancer fetchClientSecret.
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
            {lang === 'fr' ? "Retour à l'accueil" : 'Back to home'}
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
            <span className="text-sm font-medium">{lang === 'fr' ? 'Retour' : 'Back'}</span>
          </button>

          <div className="flex items-center gap-2">
            <img src="/logo-sales.png" alt="CloseOS Logo" className="h-12 w-auto" />
          </div>

          <div className="w-10"></div>
        </div>
      </nav>

      <main className="flex-1 py-12 px-6 lg:py-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-start">

          <div className="space-y-8">
            <div>
              <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 mb-6">
                <Rocket className="w-3 h-3" /> {lang === 'fr' ? 'Offre Standard' : 'Standard Offer'} {isYearly && (lang === 'fr' ? "(Annuel)" : "(Yearly)")}
              </span>
              <h1 className="text-4xl font-extrabold text-white mb-4">Pack Starter</h1>
              <p className="text-slate-400 text-lg">
                {lang === 'fr' ? "Tout ce qu'il faut pour organiser votre closing et encaisser vos premières commissions." : "Everything you need to organize your closing and earn your first commissions."}
              </p>
            </div>

            {/* 👇 AJOUT DU SWITCH MENSUEL / ANNUEL ICI 👇 */}
            <div className="flex justify-start">
              <div className="bg-slate-900/50 p-1.5 rounded-xl border border-slate-800 flex items-center relative gap-1">
                <button
                  onClick={() => handleBillingSwitch('monthly')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${!isYearly ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {lang === 'fr' ? 'Mensuel' : 'Monthly'}
                </button>
                <button
                  onClick={() => handleBillingSwitch('yearly')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isYearly ? 'bg-blue-600 text-white shadow-lg border border-blue-500' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {lang === 'fr' ? 'Annuel' : 'Yearly'}
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
                  {isYearly ? (lang === 'fr' ? "/mois (facturé annuellement)" : "/mo (billed yearly)") : (lang === 'fr' ? "/mois" : "/mo")}
                </span>
              </div>

              <div className="space-y-4 mb-8">
                {(lang === 'fr' ? [
                  "Pipeline Visuel illimité",
                  "Agenda & Booking (Liens de rdv)",
                  "Facturation (Générateur PDF)",
                  "KPIs (CA, Conversion, Ventes)",
                  "Rappels programmables",
                  "Support standard email"
                ] : [
                  "Unlimited Visual Pipeline",
                  "Calendar & Booking (Appointment links)",
                  "Invoicing (PDF Generator)",
                  "KPIs (Revenue, Conversion, Sales)",
                  "Programmable Reminders",
                  "Standard email support"
                ]).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>


            </div>

            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                <TicketPercent className="h-4 w-4 text-blue-400" />
                <span className="font-semibold">{lang === 'fr' ? 'Code de parrainage / Promo' : 'Referral / Promo code'}</span>
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
                  {isApplyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === 'fr' ? 'Appliquer' : 'Apply')}
                </button>
              </div>
              {appliedCode && !isApplyingCode && (
                <p className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {lang === 'fr' ? 'Code appliqué ! Vérifiez le montant total à droite.' : 'Code applied! Check the total amount on the right.'}
                </p>
              )}
            </div>

            <div id="terms-checkbox" className={`p-4 rounded-2xl border transition-colors ${showTermsError ? 'bg-red-950/10 border-red-500/50' : 'bg-slate-900/50 border-slate-800'}`}>

              {showTermsError && (
                <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-3 animate-pulse">
                  <AlertCircle className="h-4 w-4" />
                  {lang === 'fr' ? 'Vous devez accepter les conditions pour continuer' : 'You must accept the terms to continue'}
                </div>
              )}

              <div className="flex items-start gap-3 cursor-pointer" onClick={toggleTerms}>
                <div className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0 ${isTermsAccepted ? 'bg-blue-600 border-blue-600' : 'border-slate-500 hover:border-blue-400'}`}>
                  {isTermsAccepted ? <CheckSquare className="h-3.5 w-3.5 text-white" /> : <Square className="h-3.5 w-3.5 text-transparent" />}
                </div>
                <div className="text-sm text-slate-300 leading-relaxed select-none">
                  {lang === 'fr' ? (<>Je reconnais avoir pris connaissance et j'accepte les <Link to="/cgu" target="_blank" className="text-blue-400 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>Conditions Générales de Vente (CGV)</Link> et la <Link to="/confidentialite" target="_blank" className="text-blue-400 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>Politique de Confidentialité</Link>. Je renonce expressément à mon droit de rétractation pour accéder au service immédiatement.</>) : (<>I acknowledge and accept the <Link to="/cgu" target="_blank" className="text-blue-400 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>Terms and Conditions</Link> and the <Link to="/confidentialite" target="_blank" className="text-blue-400 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>Privacy Policy</Link>. I expressly waive my right of withdrawal to access the service immediately.</>)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
              <ShieldCheck className="h-10 w-10 text-slate-600" />
              <p className="text-xs text-slate-500 leading-tight">
                {lang === 'fr' ? "Paiement sécurisé par Stripe. Prélèvement automatique après 10 jours d'essai. Annulable à tout moment." : "Secure payment by Stripe. Automatic billing after 10-day trial. Cancel anytime."}
              </p>
            </div>
          </div>

          <div className="relative bg-[#0F172A] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden p-2 sm:p-4 min-h-[600px]">
            {/* Halo moins lumineux pour le Starter */}
            <div className="absolute -inset-4 bg-slate-600/5 blur-[60px] rounded-full pointer-events-none" />

            {loading || !clientSecret ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-500 mb-6"></div>
                <p className="text-slate-400 font-medium text-sm">{lang === 'fr' ? 'Chargement du module sécurisé...' : 'Loading secure module...'}</p>
              </div>
            ) : (
              <div className="relative h-full w-full">
                <EmbeddedCheckoutProvider
                  key={clientSecret}
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