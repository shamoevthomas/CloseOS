import { useState, useEffect } from 'react';
import { X, CreditCard, CheckCircle2, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface StripeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StripeConnectModal({ isOpen, onClose }: StripeConnectModalProps) {
  const { user } = useAuth();
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

  const handleConnectStripe = async () => {
    setConnecting(true);
    
    // SIMULATION BACKEND : On fera le vrai appel API plus tard
    setTimeout(async () => {
      if (user) {
        await supabase
          .from('profiles')
          .update({ stripe_connected: true, stripe_account_id: 'acct_TEST123456' })
          .eq('id', user.id);
          
        setStripeConnected(true);
        setStripeAccountId('acct_TEST123456');
      }
      setConnecting(false);
    }, 1500);
  };

  const handleDisconnect = async () => {
    if (!confirm("Voulez-vous vraiment déconnecter votre compte Stripe ?")) return;
    
    setConnecting(true);
    if (user) {
        await supabase
          .from('profiles')
          .update({ stripe_connected: false, stripe_account_id: null })
          .eq('id', user.id);
        setStripeConnected(false);
        setStripeAccountId(null);
    }
    setConnecting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#635BFF]/20 rounded-lg">
              <CreditCard className="h-6 w-6 text-[#635BFF]" />
            </div>
            <h2 className="text-lg font-bold text-white">Connexion Stripe</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
              <p className="text-sm text-slate-500">Vérification du statut...</p>
            </div>
          ) : stripeConnected ? (
            // MODE CONNECTÉ
            <div className="text-center py-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Compte actif</h3>
              <p className="text-sm text-slate-400 mb-6 px-4">
                Votre compte Stripe est correctement relié. Vous pouvez recevoir des paiements directement sur vos factures.
              </p>
              
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 mb-6 text-left flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">ID: {stripeAccountId}</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Connecté</span>
              </div>

              <div className="flex gap-3">
                <button 
                   onClick={onClose}
                   className="flex-1 py-2.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  Fermer
                </button>
                <button 
                   onClick={handleDisconnect}
                   className="px-4 py-2.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
                >
                  Déconnecter
                </button>
              </div>
            </div>
          ) : (
            // MODE DÉCONNECTÉ
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">Recevez vos commissions par CB directement sur votre compte bancaire.</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">Vos clients paient en 1 clic depuis le PDF de la facture.</p>
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
              
              <p className="text-[10px] text-center text-slate-500 flex items-center justify-center gap-1.5">
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