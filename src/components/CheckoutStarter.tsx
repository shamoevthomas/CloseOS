import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';
import { CheckCircle2, ShieldCheck, Target, ArrowLeft, Rocket } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

// Initialise Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export const CheckoutStarter = () => {
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVoipSelected, setIsVoipSelected] = useState(false);

  // 👇 Récupération du cycle de facturation via l'URL (?billing=yearly)
  const [searchParams] = useSearchParams();
  const isYearly = searchParams.get('billing') === 'yearly';

  // 👇 CONFIGURATION DES PRIX (Mensuel vs Annuel)
  const PRICE_STARTER = isYearly 
    ? "price_1Sz1Cj33xpuYLywq7Lkx6GKp" // Annuel
    : "price_1SyYFA33xpuYLywqHtV34VGE"; // Mensuel

  const PRICE_VOIP = isYearly 
    ? "price_1Sz1Hv33xpuYLywqyPFLWC2x" // Annuel
    : "price_1SyYGp33xpuYLywqxEJKYtUC"; // Mensuel

  const fetchClientSecret = () => {
    setLoading(true);
    // On met le produit de base
    const lineItems = [{ price: PRICE_STARTER, quantity: 1 }];
    
    // Si l'option VoIP est cochée, on l'ajoute à la liste
    if (isVoipSelected) {
      lineItems.push({ price: PRICE_VOIP, quantity: 1 });
    }

    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItems, plan: 'starter' }), 
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erreur API');
        return res.json();
      })
      .then((data) => {
        setClientSecret(data.clientSecret);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Erreur de chargement du module de paiement.");
        setLoading(false);
      });
  };

  // Recharger le checkout quand l'option change ou le cycle change
  useEffect(() => {
    fetchClientSecret();
  }, [isVoipSelected, isYearly]);

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
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
              <Target className="h-4 w-4 text-white" />
            </div>
            <span>CloseOS.fr</span>
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

            <div className="bg-slate-900/40 rounded-3xl p-8 border border-slate-800 relative overflow-hidden">
              <div className="flex items-baseline gap-3 mb-6">
                {/* 👇 AFFICHAGE PRIX DYNAMIQUE */}
                <span className="text-6xl font-black text-white">{isYearly ? "33€" : "39€"}</span>
                {isYearly && <span className="text-2xl text-slate-500 line-through">39€</span>}
                <span className="text-slate-400 font-medium">
                   {isYearly ? "/mois (facturé 396€/an)" : "/mois"}
                </span>
              </div>
              <div className="space-y-4 mb-8">
                {[
                  "7 jours d'essai gratuit",
                  "Pipeline de vente illimité",
                  "Agenda & Booking intégré",
                  "Facturation automatisée",
                  "Support standard email"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* SÉLECTEUR VOIP */}
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
                   <p className="text-xs text-slate-400">Appels illimités depuis la plateforme + enregistrement automatique.</p>
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
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ clientSecret }}
              >
                <EmbeddedCheckout className="h-full w-full" />
              </EmbeddedCheckoutProvider>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};