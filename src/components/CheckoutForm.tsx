import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';

// Initialise Stripe avec ta clé publique
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export const CheckoutForm = () => {
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    // On appelle notre API Vercel pour préparer le paiement
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Remplace par l'ID de prix de ton offre Founder dans Stripe (commence par price_...)
      body: JSON.stringify({ priceId: "price_TON_ID_DE_PRIX_ICI" }),
    })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret));
  }, []);

  return (
    <div id="checkout" className="min-h-screen bg-[#020617] py-20 px-4">
      <div className="max-w-3xl mx-auto bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
        <h2 className="text-3xl font-bold text-white text-center mb-8">
          Rejoindre les Founders
        </h2>
        
        {/* Affichage du formulaire Stripe Sécurisé */}
        {clientSecret && (
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </div>
    </div>
  )
}