import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';

export function Legal() {
  // Page prérendue : ces métas sont figées dans le HTML servi aux moteurs.
  useEffect(() => {
    document.title = 'Mentions légales — CloseOS';
    document.querySelector('meta[name="description"]')?.setAttribute('content', "Mentions légales de CloseOS : éditeur, hébergeur, propriété intellectuelle et coordonnées de contact.");
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/mentions-legales');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/mentions-legales');
    document.getElementById('og-title')?.setAttribute('content', 'Mentions légales — CloseOS');
    document.getElementById('og-description')?.setAttribute('content', "Mentions légales de CloseOS : éditeur, hébergeur, propriété intellectuelle et coordonnées de contact.");
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/mentions-legales');
    document.getElementById('tw-title')?.setAttribute('content', 'Mentions légales — CloseOS');
    document.getElementById('tw-description')?.setAttribute('content', "Mentions légales de CloseOS : éditeur, hébergeur, propriété intellectuelle et coordonnées de contact.");
    document.documentElement.lang = 'fr';
  }, []);
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-12 group">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Retour a l'accueil
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Info className="h-8 w-8 text-blue-500" />
          <h1 className="text-4xl font-bold text-white">Mentions Legales</h1>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 space-y-6 text-sm leading-relaxed">

          {/* IDENTITE */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-wider text-blue-400">1. Editeur du site</h2>
            <p>
              Le site <strong>CloseOS.fr</strong> et l'ensemble de ses services — <strong>CloseOS Sales</strong>, <strong>CloseOS Business</strong> et <strong>CloseOS Sign</strong> — sont edites par l'entreprise individuelle <strong>Thomas Shamoev</strong>, exercant sous le nom commercial <strong>CloseOS</strong> (aussi designe « CloseOS Technologies »).<br/>
              Immatriculee au Registre National des Entreprises (RNE).
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
              <li><strong>SIREN :</strong> 993 427 509</li>
              <li><strong>SIRET :</strong> 99342750900019</li>
              <li><strong>Siege social :</strong> 4 Rue des Coquelicots, 68120 Pfastatt, France</li>
              <li><strong>Directeur de la publication :</strong> Thomas Shamoev</li>
            </ul>
          </section>

          <hr className="border-slate-800" />

          {/* SERVICES */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-wider text-blue-400">2. Services proposes</h2>
            <p>CloseOS est un ecosysteme SaaS francais pour la vente digitale, compose de trois produits complementaires :</p>
            <ul className="mt-2 space-y-2 list-disc list-inside text-slate-400">
              <li><strong>CloseOS Sales</strong> — Outil tout-en-un pour closers et setters freelance : CRM, pipeline de vente, agenda, booking, Call Room (cockpit d'appel avec enregistrement), facturation automatique, KPIs de closing et synchronisation CRM tiers.</li>
              <li><strong>CloseOS Business</strong> — Plateforme de management pour infopreneurs et Head of Sales : gestion d'equipe de closers/setters, campagnes d'acquisition, formulaires et pages de capture, CRM acquisition, rendez-vous, facturation equipe, tableau de bord analytics et pilotage par API / serveur MCP.</li>
              <li><strong>CloseOS Sign</strong> — Signature electronique avec encaissement (« Paye + signe ») : composition de contrats, verification du signataire, multi-signataires, certificat de preuve et espaces par membre d'equipe. Documents specifiques : <a href="/sign/cgv" className="text-white hover:underline">CGV & CGU Sign</a>, <a href="/sign/confidentialite" className="text-white hover:underline">Confidentialite Sign</a> et <a href="/sign/securite" className="text-white hover:underline">Securite technique</a>.</li>
            </ul>
          </section>

          <hr className="border-slate-800" />

          {/* CONTACT */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-wider text-blue-400">3. Contact</h2>
            <p>
              Vous pouvez contacter l'editeur a tout moment a l'adresse suivante :<br/>
              <a href="mailto:support@closeos.fr" className="text-white hover:underline">support@closeos.fr</a>
            </p>
          </section>

          <hr className="border-slate-800" />

          {/* HEBERGEMENT */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-wider text-blue-400">4. Hebergement</h2>
            <p className="mb-2">
              <strong>Application Web :</strong><br/>
              Hebergee par Vercel Inc.<br/>
              440 N Barranca Ave #4133, Covina, CA 91723, USA.
            </p>
            <p>
              <strong>Base de donnees & Authentification :</strong><br/>
              Hebergees par Supabase Inc.<br/>
              970 Toa Payoh N, #07-04, Singapore 319000.
            </p>
          </section>

        </div>

        <footer className="mt-12 text-center text-slate-600 text-xs">
          Ces mentions legales sont regies par la loi francaise.
        </footer>
      </div>
    </div>
  );
}
