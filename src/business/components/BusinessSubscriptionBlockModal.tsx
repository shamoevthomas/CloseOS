import { Lock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBusinessLang } from '../i18n/BusinessLangContext';

interface Props {
  deadline: string;
}

export function BusinessSubscriptionBlockModal({ deadline }: Props) {
  const { t, lang } = useBusinessLang();
  const daysLeft = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 sm:p-10 shadow-2xl text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-5">
          <Lock className="h-7 w-7 text-red-500" />
        </div>

        <h2
          className="text-2xl font-extrabold text-stone-900 tracking-tight mb-3"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          {t.block_access_blocked || 'Accès bloqué'}
        </h2>

        <p className="text-stone-500 mb-4 leading-relaxed">
          {t.block_renewal_failed || 'Le renouvellement de votre abonnement a échoué. Veuillez mettre à jour votre moyen de paiement pour continuer à utiliser CloseOS Business.'}
        </p>

        <div className="rounded-xl bg-red-50 p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-semibold text-left">
            {daysLeft > 0
              ? `${t.block_days_left_prefix || 'Suppression du compte dans'} ${daysLeft} ${t.block_days_left_day || 'jour'}${daysLeft > 1 ? 's' : ''} ${t.block_days_left_suffix || 'si le paiement n\'est pas régularisé.'}`
              : (t.block_deletion_in_progress || 'La suppression de votre compte est en cours.')}
          </p>
        </div>

        <Link
          to="/business/organisation"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-4 font-bold text-white shadow-lg transition-all hover:bg-stone-800 active:scale-95"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          {t.block_update_payment || 'Mettre à jour le paiement'}
        </Link>

        <p className="mt-4 text-xs text-stone-400">
          {t.block_need_help || 'Besoin d\'aide ?'}{' '}
          <a href="mailto:support@closeos.fr" className="text-stone-600 hover:underline">
            support@closeos.fr
          </a>
        </p>
      </div>
    </div>
  );
}
