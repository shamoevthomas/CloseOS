import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';
import { CheckCircle2, ShieldCheck, Sparkles, ArrowLeft, Square, CheckSquare, AlertCircle, TicketPercent, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

// Initialise Stripe avec ta clé publique
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export const CheckoutForm = () => {
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVoipSelected, setIsVoipSelected] = useState(false);

  // 👇 NOUVEAUX ÉTATS POUR LE CODE PROMO
  const [referralCode, setReferralCode] = useState(''); // Ce que l'utilisateur tape
  const [appliedCode, setAppliedCode] = useState('');   // Le code validé et envoyé
  const [isApplyingCode, setIsApplyingCode] = useState(false);

  // ÉTATS POUR LES CGV
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);

  // Récupération du cycle de facturation via l'URL (?billing=yearly)
  const [searchParams] = useSearchParams();
  const isYearly = searchParams.get('billing') === 'yearly';

  // CONFIGURATION DES PRIX
  const PRICE_FOUNDER = isYearly 
    ? "price_1Sz1Kg33xpuYLywqS5kHdnyU" 
    : "price_1SzEPa33xpuYLywq3TKcBIji"; 

  const PRICE_VOIP = isYearly 
    ? "price_1SzEPo33xpuYLywqhRb738Lv"
    : "price_1SyXw433xpuYLywqpvmyAueZ";

  // Fonction pour récupérer le Client Secret
  const fetchClientSecret = () => {
    setLoading(true);
    const lineItems = [{ price: PRICE_FOUNDER, quantity: 1 }];
    
    if (isVoipSelected) {
      lineItems.push({ price: PRICE_VOIP, quantity: 1 });
    }

    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 👇 ON ENVOIE LE CODE APPLIQUÉ ICI
      body: JSON.stringify({ 
        lineItems, 
        referralCode: appliedCode 
      }), 
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erreur API');
        return res.json();
      })
      .then((data) => {
        setClientSecret(data.clientSecret);
        setLoading(false);
        setIsApplyingCode(false); // Fin du chargement code
      })
      .catch((err) => {
        console.error(err);
        setError("Erreur de chargement du module de paiement.");
        setLoading(false);
        setIsApplyingCode(false);
      });
  };

  // Recharger le checkout quand l'option VoIP, le cycle, OU LE CODE change
  useEffect(() => {
    fetchClientSecret();
  }, [isVoipSelected, isYearly, appliedCode]);

  // Gestion du clic sur "Appliquer le code"
  const handleApplyCode = () => {
    if (referralCode.trim() !== appliedCode) {
      setIsApplyingCode(true);
      setAppliedCode(referralCode.trim());
      // Le useEffect va détecter le changement de appliedCode et relancer fetchClientSecret
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
          <Link to="/" className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour</span>
          </Link>
          
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
              <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 mb-6">
                <Sparkles className="w-3 h-3" /> Offre de Prélancement
              </span>
              <h1 className="text-4xl font-extrabold text-white mb-4">Pack Founder {isYearly && "(Annuel)"}</h1>
              <p className="text-slate-400 text-lg">
                Rejoignez les premiers membres et sécurisez votre tarif à VIE.
              </p>
            </div>

            <div className="bg-blue-600/5 rounded-3xl p-8 border border-blue-500/20 relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">OFFRE LIMITÉE</div>
              
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-6xl font-black text-white">{isYearly ? "25€" : "29€"}</span>
                <span className="text-2xl text-slate-500 line-through">{isYearly ? "60€" : "69€"}</span>
                <span className="text-slate-400 font-medium">
                  {isYearly ? "/mois (facturé 300€/an)" : "/mois à vie"}
                </span>
              </div>
              
              <div className="space-y-4 mb-8">
                {[
                  "7 jours d'essai gratuit au lancement",
                  "Accès complet illimité (CRM, Agenda)",
                  "Badge Founder exclusif",
                  "Support prioritaire 24/7"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* OPTIONS VOIP */}
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
                        {isYearly ? "+50€" : "+5€"}
                        <span className="text-slate-500 font-normal text-xs">{isYearly ? "/an" : "/mois"}</span>
                      </span>
                   </div>
                   <p className="text-xs text-slate-400">Appels illimités depuis la plateforme + enregistrement automatique des appels.</p>
                </div>
              </div>
            </div>

            {/* 👇 NOUVELLE SECTION CODE PROMO */}
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

            {/* SECTION CGV / CGU OBLIGATOIRE */}
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
              <ShieldCheck className="h-10 w-10 text-blue-500/50" />
              <p className="text-xs text-slate-500 leading-tight">
                Paiement sécurisé par Stripe. Vos données sont cryptées et le prélèvement ne commencera qu'après vos 7 jours d'essai.
              </p>
            </div>
          </div>

          {/* COLONNE DE DROITE AVEC PROTECTION */}
          <div className="relative bg-[#0F172A] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden p-2 sm:p-4 min-h-[600px]">
            <div className="absolute -inset-4 bg-blue-600/10 blur-[60px] rounded-full pointer-events-none" />
            
            {loading || !clientSecret ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-6"></div>
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
    </div>
  );
};