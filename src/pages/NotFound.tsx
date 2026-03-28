import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  useEffect(() => {
    document.title = 'Page non trouvée — CloseOS';
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex';
    return () => {
      meta?.setAttribute('content', 'index, follow');
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] text-white font-sans px-6 text-center">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-xl text-slate-400 mb-8">Page non trouvée</p>
      <Link
        to="/"
        className="rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 hover:bg-blue-50 transition-colors"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}
