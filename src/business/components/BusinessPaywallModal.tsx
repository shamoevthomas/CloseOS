import { useState } from 'react';
import { Lock, ArrowRight, Loader2, X, Clock } from 'lucide-react';
import { useBusinessLang } from '../i18n/BusinessLangContext';
import { useBusinessAuth } from '../contexts/BusinessAuthContext';

export function BusinessPaywallModal({ daysLeft, dismissable }: { daysLeft?: number; dismissable?: boolean } = {}) {
  const { t, lang } = useBusinessLang();
  const { user } = useBusinessAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isWarning = dismissable && daysLeft !== undefined && daysLeft > 0;

  const handleSubscribe = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/business-checkout?action=reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError(data.error || 'Erreur');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 sm:p-10 shadow-2xl text-center">
        {dismissable && (
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-5 ${isWarning ? 'bg-amber-50' : 'bg-red-50'}`}>
          {isWarning
            ? <Clock className="h-7 w-7 text-amber-500" />
            : <Lock className="h-7 w-7 text-red-500" />
          }
        </div>

        <h2
          className="text-2xl font-extrabold text-stone-900 tracking-tight mb-3"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          {isWarning
            ? (lang === 'fr'
              ? `Votre essai expire dans ${daysLeft} jour${daysLeft! > 1 ? 's' : ''}`
              : `Your trial expires in ${daysLeft} day${daysLeft! > 1 ? 's' : ''}`)
            : t.paywall_trial_ended
          }
        </h2>

        <p className="text-stone-500 mb-8 leading-relaxed">
          {isWarning
            ? (lang === 'fr'
              ? 'Souscrivez maintenant pour ne pas perdre l\u2019acc\u00e8s \u00e0 votre compte et vos donn\u00e9es.'
              : 'Subscribe now to keep access to your account and data.')
            : t.paywall_trial_ended_desc
          }
        </p>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-4 font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 ${isWarning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-stone-900 hover:bg-stone-800'}`}
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {lang === 'fr' ? 'S\u2019abonner' : 'Subscribe'}
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        {dismissable && (
          <button
            onClick={() => setDismissed(true)}
            className="mt-3 text-xs text-stone-400 hover:text-stone-600 hover:underline"
          >
            {lang === 'fr' ? 'Plus tard' : 'Later'}
          </button>
        )}

        <p className="mt-4 text-xs text-stone-400">
          {t.paywall_contact_question}{' '}
          <a href="mailto:support@closeos.fr" className="text-stone-600 hover:underline">
            support@closeos.fr
          </a>
        </p>
      </div>
    </div>
  );
}
