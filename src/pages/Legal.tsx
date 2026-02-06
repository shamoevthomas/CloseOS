import { Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';

export function Legal() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-12 group">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Retour à l'accueil
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Info className="h-8 w-8 text-blue-500" />
          <h1 className="text-4xl font-bold text-white">Mentions Légales</h1>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 space-y-6 text-sm leading-relaxed">
          
          {/* IDENTITÉ */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-wider text-blue-400">1. Éditeur du site</h2>
            <p>
              Le site <strong>CloseOS.fr</strong> est édité par l'entreprise individuelle <strong>Shamoev Thomas</strong>.<br/>
              Immatriculée au Registre National des Entreprises (RNE).
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
              <li><strong>SIREN :</strong> 993 427 509</li>
              <li><strong>SIRET :</strong> 99342750900019</li>
              <li><strong>Siège social :</strong> 4 Rue des Coquelicots, 68120 Pfastatt, France</li>
              <li><strong>Directeur de la publication :</strong> Thomas Shamoev</li>
            </ul>
          </section>

          <hr className="border-slate-800" />

          {/* CONTACT */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-wider text-blue-400">2. Contact</h2>
            <p>
              Vous pouvez contacter l'éditeur à tout moment à l'adresse suivante :<br/>
              <a href="mailto:support@closeos.fr" className="text-white hover:underline">support@closeos.fr</a>
            </p>
          </section>

          <hr className="border-slate-800" />

          {/* HÉBERGEMENT */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-wider text-blue-400">3. Hébergement</h2>
            <p className="mb-2">
              <strong>Application Web :</strong><br/>
              Hébergée par Vercel Inc.<br/>
              440 N Barranca Ave #4133, Covina, CA 91723, USA.
            </p>
            <p>
              <strong>Base de données & Authentification :</strong><br/>
              Hébergées par Supabase Inc.<br/>
              970 Toa Payoh N, #07-04, Singapore 319000.
            </p>
          </section>

        </div>

        <footer className="mt-12 text-center text-slate-600 text-xs">
          Ces mentions légales sont régies par la loi française.
        </footer>
      </div>
    </div>
  );
}