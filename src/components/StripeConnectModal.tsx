import { useState, useEffect } from 'react';
import { X, CreditCard, CheckCircle2, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { stripeConnectTranslations } from '../i18n/translations';

interface StripeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StripeConnectModal({ isOpen, onClose }: StripeConnectModalProps) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const t = stripeConnectTranslations[lang];
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);

  // Charger l'état actuel à l'ouverture
  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
    }
  }, [isOpen, user]);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_connected')
      .eq('id', user?.id)
      .single();

    if (data) {
      setStripeAccountId(data.stripe_account_id);
      setStripeConnected(data.stripe_connected || false);
    }
    setLoading(false);
  }

  // --- MODIFICATION : APPEL RÉEL AU BACKEND ---
  const handleConnectStripe = async () => {
    if (!user) return;
    setConnecting(true);

    try {
      // Appel à ton API Vercel (api/connect-stripe.ts)
      const response = await fetch('/api/connect-stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirection vers Stripe
        window.location.href = data.url;
      } else {
        console.error("Erreur API:", data);
        alert(lang === 'fr' ? "Erreur lors de l'initialisation de Stripe. Veuillez réessayer." : "Error initializing Stripe. Please try again.");
        setConnecting(false);
      }

    } catch (error) {
      console.error("Erreur connexion:", error);
      alert(lang === 'fr' ? "Impossible de contacter le serveur de paiement." : "Unable to contact payment server.");
      setConnecting(false);
    }
  };
  // ---------------------------------------------

  const handleDisconnect = async () => {
    if (!confirm(lang === 'fr' ? "Voulez-vous vraiment déconnecter votre compte Stripe ?" : "Do you really want to disconnect your Stripe account?")) return;

    setConnecting(true);
    if (user) {
      // Idéalement, faire aussi un appel API pour révoquer le token chez Stripe
      await supabase
        .from('profiles')
        .update({ stripe_connected: false })
        .eq('id', user.id);

      setStripeConnected(false);
      // On garde l'account ID en mémoire au cas où ils se reconnectent, 
      // ou on le nullifie selon ta préférence. Ici on garde pour faciliter la reconnexion.
    }
    setConnecting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-[0_20px_40px_rgba(0,0,0,0.2)] relative overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-white/[0.08] bg-[#111111]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#635BFF]/20 rounded-lg">
              <CreditCard className="h-6 w-6 text-[#635BFF]" />
            </div>
            <h2 className="text-lg font-bold text-white">{lang === 'fr' ? 'Connexion Stripe' : 'Stripe Connection'}</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
              <p className="text-sm text-white/40">{lang === 'fr' ? 'Vérification du statut...' : 'Checking status...'}</p>
            </div>
          ) : stripeConnected ? (
            // MODE CONNECTÉ
            <div className="text-center py-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{lang === 'fr' ? 'Compte actif' : 'Active account'}</h3>
              <p className="text-sm text-white/40 mb-6 px-4">
                {lang === 'fr' ? 'Votre compte Stripe est correctement relié. Vous pouvez recevoir des paiements directement sur vos factures.' : 'Your Stripe account is properly connected. You can receive payments directly on your invoices.'}
              </p>

              <div className="bg-[#111111] rounded-2xl p-3 border border-white/[0.08] mb-6 text-left flex items-center justify-between">
                <span className="text-xs text-white/40 font-mono">ID: {stripeAccountId}</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{t.connected}</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-full bg-white/[0.03] text-white font-medium hover:bg-white/10 transition-colors border border-white/[0.08]"
                >
                  {lang === 'fr' ? 'Fermer' : 'Close'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2.5 rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
                >
                  Déconnecter
                </button>
              </div>
            </div>
          ) : (
            // MODE DÉCONNECTÉ
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-white/60">Recevez vos commissions par CB directement sur votre compte bancaire.</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-white/60">Vos clients paient en 1 clic depuis le PDF de la facture.</p>
                </div>
              </div>

              <button
                onClick={handleConnectStripe}
                disabled={connecting}
                className="w-full py-3.5 bg-[#635BFF] hover:bg-[#5349E0] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#635BFF]/20 group"
              >
                {connecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Connecter mon compte Stripe</span>
                    <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-white/40 flex items-center justify-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                Redirection sécurisée vers Stripe Connect
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}