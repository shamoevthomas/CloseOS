// Écran d'attente de la page de signature (/sign/s/:token), le même que celui servi par le serveur
// avant le démarrage de React (api/_lib/sign-doc-shell.ts) : aucune bascule visible entre les deux.
import { detectSignLang, type SignLang } from '../contexts/SignLangContext';

const TEXT = { fr: 'Chargement de votre document…', en: 'Loading your document…' } as const;

/** Langue initiale, comme SignLangProvider : choix mémorisé, sinon langue du navigateur. */
function initialLang(): SignLang {
  try {
    const saved = localStorage.getItem('closeos_sign_lang');
    if (saved === 'fr' || saved === 'en') return saved;
  } catch { /* stockage indisponible */ }
  return detectSignLang();
}

export default function SignDocLoading({ lang = initialLang() }: { lang?: SignLang }) {
  return (
    <div
      data-sign-doc-loading
      style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#191E1E', color: '#A1A9A9', fontFamily: '"SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif', fontSize: 14,
      }}
    >
      <style>{'@keyframes signDocSpin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width: 28, height: 28, borderRadius: 9999, border: '3px solid #3A4242', borderTopColor: '#CEFF8F', animation: 'signDocSpin .8s linear infinite' }} />
      <p style={{ margin: 0 }}>{TEXT[lang]}</p>
    </div>
  );
}
