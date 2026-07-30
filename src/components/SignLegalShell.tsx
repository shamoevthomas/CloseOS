import { useEffect, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SignLogo } from './SignLogo';
import SignLangToggle from './SignLangToggle';
import { useSignLang } from '../contexts/SignLangContext';

/** Gabarit commun des pages légales CloseOS Sign (DA dark + lime). */
export function SignLegalShell({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  const { lang } = useSignLang();

  // Sans ça, ces pages héritaient de la canonique d'index.html (https://www.closeos.fr/) :
  // /sign/securite, /sign/cgv et /sign/confidentialite se déclaraient donc toutes comme
  // étant la home de l'écosystème, et aucune ne pouvait être indexée pour elle-même.
  // Sign vit sur son propre hôte : la canonique doit y pointer.
  useEffect(() => {
    const url = `https://sign.closeos.fr${window.location.pathname.replace(/\/+$/, '')}`;
    document.getElementById('canonical')?.setAttribute('href', url);
    document.getElementById('og-url')?.setAttribute('content', url);
    document.getElementById('tw-url')?.setAttribute('content', url);
    document.getElementById('og-title')?.setAttribute('content', title);
    document.getElementById('tw-title')?.setAttribute('content', title);
  }, [title]);

  return (
    <div className="min-h-screen bg-[#191E1E] text-[#F3F4F6]">
      <style>{`
        .sign-legal h2{color:#fff;font-size:1.15rem;font-weight:600;margin:2.2rem 0 .6rem;}
        .sign-legal h3{color:#F3F4F6;font-size:1rem;font-weight:600;margin:1.3rem 0 .4rem;}
        .sign-legal p,.sign-legal li{color:#A1A9A9;font-size:.92rem;line-height:1.75;}
        .sign-legal ul{list-style:disc;padding-left:1.3rem;margin:.6rem 0;}
        .sign-legal li{margin:.25rem 0;}
        .sign-legal strong{color:#F3F4F6;font-weight:600;}
        .sign-legal a{color:#CEFF8F;text-decoration:none;}
        .sign-legal a:hover{text-decoration:underline;}
        .sign-legal table{width:100%;border-collapse:collapse;margin:.8rem 0;font-size:.88rem;}
        .sign-legal th,.sign-legal td{border:1px solid #3A4242;padding:.5rem .75rem;text-align:left;color:#A1A9A9;}
        .sign-legal th{color:#F3F4F6;background:#222828;font-weight:600;}
      `}</style>

      <header className="sticky top-0 z-10 border-b border-[#3A4242] bg-[#191E1E]/90 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <a href="/sign"><SignLogo className="text-lg" /></a>
          <div className="flex items-center gap-2">
            <SignLangToggle className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-[#A1A9A9] transition-colors hover:bg-white/10 hover:text-white" />
            <a href="/sign" className="flex items-center gap-1.5 text-sm text-[#A1A9A9] transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /> {lang === 'fr' ? 'Accueil' : 'Home'}</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-[26px] font-semibold tracking-tight text-white sm:text-[32px]">{title}</h1>
        {updated && <p className="mt-2 text-xs text-[#6b7373]">{lang === 'fr' ? 'Dernière mise à jour : ' : 'Last updated: '}{updated}</p>}
        <div className="sign-legal mt-8">{children}</div>
      </main>

      <footer className="border-t border-[#3A4242] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4 text-xs text-[#6b7373]">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="/sign/cgv" className="transition-colors hover:text-[#CEFF8F]">{lang === 'fr' ? 'CGV & CGU' : 'Terms of Sale & Use'}</a>
            <a href="/sign/confidentialite" className="transition-colors hover:text-[#CEFF8F]">{lang === 'fr' ? 'Politique de confidentialité' : 'Privacy Policy'}</a>
            <a href="/sign/securite" className="transition-colors hover:text-[#CEFF8F]">{lang === 'fr' ? 'Sécurité technique' : 'Technical Security'}</a>
          </div>
          <p>
            <strong className="text-[#A1A9A9]">{lang === 'fr' ? 'Éditeur :' : 'Publisher:'}</strong> {lang === 'fr' ? 'Thomas Shamoev, entreprise individuelle exerçant sous le nom commercial CloseOS Technologies' : 'Thomas Shamoev, sole proprietorship trading as CloseOS Technologies'} — SIREN 993 427 509 — SIRET 99342750900019.
            {lang === 'fr' ? ' Directeur de la publication : ' : ' Publication director: '}Thomas Shamoev.{lang === 'fr' ? ' Contact : ' : ' Contact: '}<a href="mailto:support@closeos.fr" className="text-[#CEFF8F] hover:underline">support@closeos.fr</a>.
            {lang === 'fr' ? ' Hébergement : Supabase (Union européenne) & Vercel.' : ' Hosting: Supabase (European Union) & Vercel.'}
          </p>
          <p>{lang === 'fr' ? '© 2026 CloseOS Technologies. Tous droits réservés. Construit en France.' : '© 2026 CloseOS Technologies. All rights reserved. Built in France.'}</p>
        </div>
      </footer>
    </div>
  );
}
