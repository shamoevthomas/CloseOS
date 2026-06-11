import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

/** Gabarit commun des pages légales CloseOS Sign (DA dark + lime). */
export function SignLegalShell({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
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

      <header className="sticky top-0 z-10 border-b border-[#3A4242] bg-[#191E1E]/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <a href="/sign" className="text-lg font-bold tracking-tight">CloseOS <span className="text-[#CEFF8F]">Sign</span></a>
          <a href="/sign" className="flex items-center gap-1.5 text-sm text-[#A1A9A9] transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /> Accueil</a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-[32px] font-semibold tracking-tight text-white">{title}</h1>
        {updated && <p className="mt-2 text-xs text-[#6b7373]">Dernière mise à jour : {updated}</p>}
        <div className="sign-legal mt-8">{children}</div>
      </main>

      <footer className="border-t border-[#3A4242] px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-4 text-xs text-[#6b7373]">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="/sign/cgv" className="transition-colors hover:text-[#CEFF8F]">CGV &amp; CGU</a>
            <a href="/sign/confidentialite" className="transition-colors hover:text-[#CEFF8F]">Politique de confidentialité</a>
            <a href="/sign/securite" className="transition-colors hover:text-[#CEFF8F]">Sécurité technique</a>
          </div>
          <p>
            <strong className="text-[#A1A9A9]">Éditeur :</strong> CloseOS Technologies — SIREN 993 427 509 — SIRET 99342750900019.
            Directeur de la publication : Thomas Shamoev. Contact : <a href="mailto:support@closeos.fr" className="text-[#CEFF8F] hover:underline">support@closeos.fr</a>.
            Hébergement : Supabase (Union européenne) &amp; Vercel.
          </p>
          <p>© 2026 CloseOS Technologies. Tous droits réservés. Construit en France.</p>
        </div>
      </footer>
    </div>
  );
}
