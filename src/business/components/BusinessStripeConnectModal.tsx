import { useState, useEffect } from 'react';
import { X, CreditCard, CheckCircle2, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { useBusinessLang } from '../i18n/BusinessLangContext'

interface BusinessStripeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnPath?: string;
  benefits?: string[];
  connectedDescription?: string;
}

// Default benefits and connected description are now handled via i18n (see component body)

export function BusinessStripeConnectModal({
  isOpen,
  onClose,
  returnPath = '/business/factures',
  benefits: benefitsProp,
  connectedDescription: connectedDescProp,
}: BusinessStripeConnectModalProps) {
  const { user } = useBusinessAuth();
  const { t, lang } = useBusinessLang()
  const benefits = benefitsProp ?? [t.stripe_connect_benefit_1, t.stripe_connect_benefit_2];
  const connectedDescription = connectedDescProp ?? t.stripe_connect_connected_desc;
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
    } else {
      setLoading(false);
    }
  }, [isOpen, user]);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_connected')
        .eq('id', user?.id)
        .maybeSingle();

      if (data) {
        setStripeAccountId(data.stripe_account_id);
        setStripeConnected(data.stripe_connected || false);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleConnectStripe = async () => {
    if (!user) return;
    setConnecting(true);

    try {
      const response = await fetch('/api/connect-stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          returnPath,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Erreur API:', data);
        alert(t.stripe_connect_error_init);
        setConnecting(false);
      }
    } catch (error) {
      console.error('Erreur connexion:', error);
      alert(t.stripe_connect_error_server);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(t.stripe_connect_disconnect_confirm)) return;

    setConnecting(true);
    if (user) {
      await supabase
        .from('profiles')
        .update({ stripe_connected: false })
        .eq('id', user.id);

      setStripeConnected(false);
    }
    setConnecting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700 w-full max-w-md relative overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-[#c4c7c7]/10 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#635BFF]/10 rounded-xl">
              <CreditCard className="h-6 w-6 text-[#635BFF]" />
            </div>
            <h2 className="text-lg font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white">
              {t.stripe_connect_title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#444748] dark:text-neutral-400 hover:text-[#1b1c1b] dark:hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#006c49] mb-2" />
              <p className="text-sm text-[#444748] dark:text-neutral-400">
                {t.stripe_connect_checking}
              </p>
            </div>
          ) : stripeConnected ? (
            /* Connected state */
            <div className="text-center py-2">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#006c49]/10 border border-[#006c49]/20 mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#006c49]" />
              </div>
              <h3 className="text-lg font-extrabold font-['Manrope'] text-[#1b1c1b] dark:text-white mb-2">
                {t.stripe_connect_active}
              </h3>
              <p className="text-sm text-[#444748] dark:text-neutral-400 mb-6 px-4">
                {connectedDescription}
              </p>

              <div className="bg-[#f5f3f2] dark:bg-neutral-800 rounded-xl p-3 border border-[#c4c7c7]/10 dark:border-neutral-700 mb-6 text-left flex items-center justify-between">
                <span className="text-xs text-[#444748] dark:text-neutral-500 font-mono">
                  ID: {stripeAccountId}
                </span>
                <span className="bg-[#006c49]/10 text-[#006c49] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  {t.stripe_connect_connected}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-[#f5f3f2] dark:bg-neutral-800 text-[#1b1c1b] dark:text-white hover:bg-[#eae8e7] dark:hover:bg-neutral-700 border border-[#c4c7c7]/10 dark:border-neutral-700 rounded-xl font-medium transition-colors"
                >
                  {t.stripe_connect_close}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2.5 text-[#444748] hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/10 rounded-xl transition-colors text-sm font-medium"
                >
                  {t.stripe_connect_disconnect}
                </button>
              </div>
            </div>
          ) : (
            /* Disconnected state */
            <div className="space-y-6">
              <div className="space-y-3">
                {benefits.map((text, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#006c49]/5 border border-[#006c49]/10 rounded-xl p-3">
                    <CheckCircle2 className="h-5 w-5 text-[#006c49] shrink-0 mt-0.5" />
                    <p className="text-sm text-[#444748] dark:text-neutral-300">
                      {text}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleConnectStripe}
                disabled={connecting}
                className="w-full py-3.5 bg-[#635BFF] hover:bg-[#5349E0] text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#635BFF]/20 group"
              >
                {connecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>{t.stripe_connect_btn}</span>
                    <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-[#444748]/60 dark:text-neutral-500 flex items-center justify-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                {t.stripe_connect_redirect}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
