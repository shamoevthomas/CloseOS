import { useAuth } from '../contexts/AuthContext';
import { useUpgrade } from '../contexts/UpgradeContext';
import { ShieldCheck, Lock } from 'lucide-react';

const FOUNDER_ADVANTAGES = [
  'KPI Avancés (Évolution, Objectifs)',
  'Call Room (Scripts & Notes)',
  'Envoi Factures Automatique',
  'Automatisations (Sync CRM, etc.)',
  'Enregistrement Vidéo/Audio',
  'Support Prioritaire',
];

export function FounderOnlyGuard({ children }: { children: React.ReactNode }) {
  const { isFounder, isInTrial, isAdmin } = useAuth();
  const { showUpgrade } = useUpgrade();

  if (isFounder || isInTrial || isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl p-8 md:p-10 text-center" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
        <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-6">
          <Lock className="h-8 w-8 text-blue-400" />
        </div>

        <h2 className="text-2xl font-extrabold text-white mb-3">
          Fonctionnalité réservée au Pack Pro
        </h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Cette fonctionnalité fait partie du Pack Pro. Passez au niveau supérieur pour débloquer toutes les features avancées.
        </p>

        <div className="text-left space-y-3 mb-8">
          {FOUNDER_ADVANTAGES.map((text, i) => (
            <div key={i} className="flex items-center gap-3" style={{ animation: `fadeSlideIn 0.3s ease-out ${i * 0.05}s both` }}>
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
              <span className="text-slate-300 text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={showUpgrade}
          className="w-full rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-[0.98]"
        >
          Passer au Pack Pro
        </button>

        <p className="text-[11px] text-slate-500 mt-4">
          Paiement sécurisé par Stripe. Annulation possible à tout moment.
        </p>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
