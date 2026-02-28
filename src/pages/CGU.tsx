import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const CGU = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">
      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour à l'accueil</span>
          </Link>
          <span className="font-bold text-white">Conditions Générales d'Utilisation</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Conditions Générales d'Utilisation</h1>
        <p className="text-slate-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-sm leading-relaxed text-justify">

          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Objet</h2>
            <p>
              Les présentes Conditions Générales d'Utilisation (ci-après "CGU") régissent l'accès et l'utilisation de la plateforme logicielle en mode SaaS <strong>CloseOS</strong>, éditée par <strong>Thomas Shamoev</strong>, Entrepreneur Individuel, immatriculé au RNE sous le numéro SIREN <strong>993 427 509</strong>, dont le siège social est situé au <strong>4 Rue des Coquelicots, 68120 Pfastatt, France</strong>.
            </p>
            <p className="mt-2">
              En créant un compte sur CloseOS, l'Utilisateur accepte sans réserve les présentes CGU. La création d'un compte est gratuite et ne constitue pas un engagement commercial.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Description du Service</h2>
            <p>
              CloseOS est une plateforme tout-en-un destinée aux closers professionnels. Elle inclut notamment : la gestion de pipeline (CRM), le suivi des KPIs et commissions, l'agenda et le booking, la facturation automatisée, l'enregistrement d'appels, le partage de profil closer, et la synchronisation avec des outils tiers (iClosed, HubSpot, Pipedrive, Google Calendar).
            </p>
            <p className="mt-2">
              Le Prestataire se réserve le droit de faire évoluer le Service, d'ajouter ou de modifier des fonctionnalités, sans que cela ne constitue une modification substantielle du contrat, tant que la qualité globale du Service n'est pas dégradée.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Période d'Essai Gratuit</h2>
            <p>
              Toute inscription ouvre droit à une période d'essai gratuit de <strong>7 jours</strong>. Durant cette période, aucune carte bancaire n'est requise et aucun prélèvement n'est effectué. L'inscription gratuite ne constitue pas un contrat commercial et n'engage pas l'Utilisateur à souscrire un abonnement payant.
            </p>
            <p className="mt-2">
              À l'issue des 7 jours, l'Utilisateur peut choisir de souscrire à un abonnement payant. Les conditions commerciales applicables sont décrites dans les Conditions Générales de Vente (CGV), distinctes des présentes CGU, et acceptées au moment de la souscription payante.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Compte Utilisateur</h2>
            <p>
              L'accès au Service nécessite la création d'un compte avec une adresse email valide. L'Utilisateur est responsable de la confidentialité de ses identifiants. Toute action effectuée via son compte est réputée avoir été effectuée par lui. Il s'engage à informer immédiatement le Prestataire en cas d'utilisation non autorisée de son compte à l'adresse <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">5. Obligations de l'Utilisateur</h2>
            <p>L'Utilisateur s'engage à :</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Utiliser le Service uniquement à des fins professionnelles et légales.</li>
              <li>Ne pas tenter de contourner, désactiver ou interférer avec les mécanismes de sécurité du Service.</li>
              <li>Ne pas reproduire, copier, vendre ou exploiter toute partie du Service sans autorisation expresse du Prestataire.</li>
              <li>Ne pas importer de données illégales ou portant atteinte aux droits de tiers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">6. Enregistrement des Appels</h2>
            <p>
              Le Service propose une fonctionnalité d'enregistrement des appels vidéo et audio. Si l'Utilisateur active cette fonctionnalité, il lui incombe légalement d'informer son interlocuteur que l'appel est susceptible d'être enregistré, conformément aux lois en vigueur (notamment l'article 226-1 du Code pénal français). CloseOS décline toute responsabilité en cas de non-respect de cette obligation par l'Utilisateur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">7. Propriété Intellectuelle</h2>
            <p>
              Tous les éléments du Service (logiciel, code source, design, logo, textes, marque) sont la propriété exclusive du Prestataire. La création d'un compte confère à l'Utilisateur un droit d'utilisation personnel, non exclusif et non cessible du Service pour ses besoins propres. Toute reproduction, ingénierie inverse ou exploitation commerciale non autorisée est strictement interdite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">8. Données Personnelles (RGPD)</h2>
            <p>
              Le Prestataire traite les données personnelles de l'Utilisateur conformément à sa <Link to="/confidentialite" className="text-blue-400 hover:underline">Politique de Confidentialité</Link>. Concernant les données des tiers (prospects) importées par l'Utilisateur dans CloseOS, le Prestataire agit en tant que <strong>Sous-traitant</strong> et l'Utilisateur en tant que Responsable de Traitement. Le Prestataire s'engage à ne traiter ces données que sur instruction de l'Utilisateur et à assurer leur sécurité.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">9. Responsabilité</h2>
            <p>
              Le Prestataire est soumis à une <strong>obligation de moyens</strong>. Il s'engage à mettre en œuvre tous les efforts raisonnables pour assurer la disponibilité du Service. En aucun cas, le Prestataire ne pourra être tenu responsable des dommages indirects (perte de chiffre d'affaires, perte de données, préjudice commercial) subis par l'Utilisateur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">10. Résiliation du Compte</h2>
            <p>
              L'Utilisateur peut supprimer son compte à tout moment depuis son espace personnel ou en contactant <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a>. Le Prestataire se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">11. Droit Applicable</h2>
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, et à défaut d'accord amiable, compétence exclusive est attribuée aux tribunaux du ressort de la Cour d'appel de <strong>Mulhouse</strong>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-xs">
          <p>Fin du document — CGU CloseOS</p>
        </div>
      </main>
    </div>
  );
};
