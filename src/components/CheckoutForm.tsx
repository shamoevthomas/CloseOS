import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';
import { CheckCircle2, ShieldCheck, Sparkles, Target, ArrowLeft, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Initialise Stripe avec ta clé publique
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export const CheckoutForm = () => {
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false); // On gère le loading au fetch
  const [error, setError] = useState('');
  const [isVoipSelected, setIsVoipSelected] = useState(false); // État pour la case VoIP

  // IDs des prix Stripe
  const PRICE_FOUNDER_29 = "price_1SyKgI33xpuYLywqfdB8YJTp";
  const PRICE_VOIP_5 = "price_1SyXw433xpuYLywqpvmyAueZ";

  // Fonction pour récupérer le Client Secret (appelée au chargement et au changement de l'option)
  const fetchClientSecret = () => {
    setLoading(true);
    // On construit la liste des items à acheter
    const lineItems = [{ price: PRICE_FOUNDER_29, quantity: 1 }];
    
    // Si l'option VoIP est cochée, on l'ajoute
    if (isVoipSelected) {
      lineItems.push({ price: PRICE_VOIP_5, quantity: 1 });
    }

    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // On envoie le tableau lineItems au backend
      body: JSON.stringify({ lineItems }), 
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

  // Recharger le checkout quand l'option change
  useEffect(() => {
    fetchClientSecret();
  }, [isVoipSelected]);

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
              <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 mb-6">
                <Sparkles className="w-3 h-3" /> Offre de Prélancement
              </span>
              <h1 className="text-4xl font-extrabold text-white mb-4">Pack Founder</h1>
              <p className="text-slate-400 text-lg">
                {/* MODIF : 29€ */}
                Rejoignez les premiers membres et sécurisez votre tarif de 29€/mois à VIE (au lieu de 69€).
              </p>
            </div>

            <div className="bg-blue-600/5 rounded-3xl p-8 border border-blue-500/20 relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">OFFRE LIMITÉE</div>
              <div className="flex items-baseline gap-3 mb-6">
                {/* MODIF : 29€ */}
                <span className="text-6xl font-black text-white">29€</span>
                <span className="text-2xl text-slate-500 line-through">69€</span>
                <span className="text-slate-400 font-medium">/mois à vie</span>
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

              {/* 👇 AJOUT : SÉLECTEUR VOIP */}
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
                      <span className="text-sm font-bold text-white">+5€<span className="text-slate-500 font-normal text-xs">/mois</span></span>
                   </div>
                   <p className="text-xs text-slate-400">Appels illimités depuis la plateforme + enregistrement automatique des appels.</p>
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

          <div className="relative bg-[#0F172A] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden p-2 sm:p-4 min-h-[600px]">
            <div className="absolute -inset-4 bg-blue-600/10 blur-[60px] rounded-full pointer-events-none" />
            {loading || !clientSecret ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-6"></div>
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