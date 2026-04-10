import { Lock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function BusinessPaywallModal() {
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
          Votre essai gratuit est termine
        </h2>

        <p className="text-stone-500 mb-8 leading-relaxed">
          Pour continuer a utiliser CloseOS Business, choisissez une formule adaptee a vos besoins.
        </p>

        <Link
          to="/business#pricing"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-4 font-bold text-white shadow-lg transition-all hover:bg-stone-800 active:scale-95"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Choisir une formule
          <ArrowRight className="h-5 w-5" />
        </Link>

        <p className="mt-4 text-xs text-stone-400">
          Des questions ? Contactez-nous a{' '}
          <a href="mailto:support@closeos.fr" className="text-stone-600 hover:underline">
            support@closeos.fr
          </a>
        </p>
      </div>
    </div>
  );
}
