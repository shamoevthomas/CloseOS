import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const CGU = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">
      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour a l'accueil</span>
          </Link>
          <span className="font-bold text-white">Conditions Generales d'Utilisation</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Conditions Generales d'Utilisation</h1>
        <p className="text-slate-500 mb-8">Derniere mise a jour : 25 mars 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-justify">

          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Objet</h2>
            <p>
              Les presentes Conditions Generales d'Utilisation (ci-apres "CGU") regissent l'acces et l'utilisation de l'ecosysteme logiciel en mode SaaS <strong>CloseOS</strong>, edite par <strong>Thomas Shamoev</strong>, Entrepreneur Individuel, immatricule au RNE sous le numero SIREN <strong>993 427 509</strong>, dont le siege social est situe au <strong>4 Rue des Coquelicots, 68120 Pfastatt, France</strong>.
            </p>
            <p className="mt-2">
              CloseOS comprend deux services distincts :
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>CloseOS Sales</strong> — Plateforme tout-en-un pour closers et setters professionnels : CRM, pipeline de vente, agenda & booking, VoIP integre, enregistrement d'appels, facturation automatisee, KPIs de closing, messagerie interne et synchronisation CRM tiers.</li>
              <li><strong>CloseOS Business</strong> — Plateforme de management pour infopreneurs et responsables commerciaux : gestion d'equipe (closers, setters, Head of Sales), campagnes d'acquisition, CRM acquisition, rendez-vous avec integration Google Calendar & Google Meet, facturation equipe, rapports de performance et onboarding.</li>
            </ul>
            <p className="mt-2">
              En creant un compte sur CloseOS, l'Utilisateur accepte sans reserve les presentes CGU. La creation d'un compte est gratuite et ne constitue pas un engagement commercial.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Description des Services</h2>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">2.1 CloseOS Sales</h3>
            <p>
              CloseOS Sales est une plateforme destinee aux closers et setters professionnels. Elle inclut notamment :
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li>Gestion de pipeline et CRM (prospects, offres, stades de vente)</li>
              <li>Suivi des KPIs et commissions</li>
              <li>Agenda et booking avec synchronisation Google Calendar et Cal.com</li>
              <li>Page de booking publique personnalisable</li>
              <li>Telephonie VoIP integree et enregistrement d'appels</li>
              <li>Facturation automatisee (factures de commissions, Stripe Connect)</li>
              <li>Messagerie interne entre contacts</li>
              <li>Gestion de scripts d'appels</li>
              <li>Synchronisation avec des outils tiers (HubSpot, Pipedrive, GoHighLevel, Systeme.io, Airtable, iClosed)</li>
              <li>Coach IA d'analyse d'appels (a venir)</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">2.2 CloseOS Business</h3>
            <p>
              CloseOS Business est une plateforme de management commercial destinee aux infopreneurs, dirigeants et Head of Sales. Elle inclut notamment :
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li>Gestion d'equipe : closers, setters, Head of Sales, Admins</li>
              <li>CRM acquisition et pipeline avec assignation automatique</li>
              <li>Campagnes d'acquisition avec formulaires de capture personnalises</li>
              <li>Rendez-vous avec integration Google Calendar et Google Meet</li>
              <li>Distribution automatique des leads (round-robin ou aleatoire)</li>
              <li>Facturation et remuneration equipe (salaire fixe, commissions)</li>
              <li>Tableau de bord et reporting de performance equipe</li>
              <li>Objectifs individuels et collectifs</li>
              <li>Onboarding personnalise des membres d'equipe</li>
              <li>Rappels automatiques par email (rendez-vous)</li>
              <li>Synchronisation avec des CRM tiers (HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io)</li>
            </ul>

            <p className="mt-4">
              Le Prestataire se reserve le droit de faire evoluer les Services, d'ajouter ou de modifier des fonctionnalites, sans que cela ne constitue une modification substantielle du contrat, tant que la qualite globale des Services n'est pas degradee.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Periode d'Essai Gratuit</h2>
            <p>
              <strong>CloseOS Sales :</strong> Toute inscription ouvre droit a une periode d'essai gratuit de <strong>10 jours</strong>. Durant cette periode, aucune carte bancaire n'est requise et aucun prelevement n'est effectue. A l'issue des 10 jours, l'Utilisateur peut choisir de souscrire a un abonnement payant.
            </p>
            <p className="mt-2">
              <strong>CloseOS Business :</strong> Les conditions d'acces (essai gratuit, liste d'attente ou acces direct) sont definies au moment du lancement commercial et communiquees sur la page dediee.
            </p>
            <p className="mt-2">
              L'inscription gratuite ne constitue pas un contrat commercial et n'engage pas l'Utilisateur a souscrire un abonnement payant. Les conditions commerciales applicables sont decrites dans les Conditions Generales de Vente (CGV), distinctes des presentes CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Compte Utilisateur</h2>
            <p>
              L'acces aux Services necessite la creation d'un compte avec une adresse email valide. L'authentification est possible via email/mot de passe ou via Google OAuth.
            </p>
            <p className="mt-2">
              <strong>CloseOS Business</strong> impose une verification supplementaire des appareils : un code a 6 chiffres est envoye par email a chaque connexion depuis un nouvel appareil.
            </p>
            <p className="mt-2">
              L'Utilisateur est responsable de la confidentialite de ses identifiants. Toute action effectuee via son compte est reputee avoir ete effectuee par lui. Il s'engage a informer immediatement le Prestataire en cas d'utilisation non autorisee de son compte a l'adresse <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">5. Roles et acces</h2>
            <p>Les Services distinguent les roles suivants :</p>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">CloseOS Sales</h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong className="text-slate-300">Closer / Setter</strong> — Acces a son propre CRM, pipeline, agenda, factures, KPIs, booking et appels</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">CloseOS Business</h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong className="text-slate-300">Owner (proprietaire)</strong> — Acces complet : CRM, equipe, campagnes, facturation, parametres, rapports</li>
              <li><strong className="text-slate-300">Head of Sales</strong> — Gestion de l'equipe, visibilite sur l'ensemble des donnees commerciales</li>
              <li><strong className="text-slate-300">Admin</strong> — Administration technique du compte</li>
              <li><strong className="text-slate-300">Closer / Setter / Setter-Closer</strong> — Acces aux fonctionnalites de vente assignees par le proprietaire</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">6. Obligations de l'Utilisateur</h2>
            <p>L'Utilisateur s'engage a :</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Utiliser les Services uniquement a des fins professionnelles et legales.</li>
              <li>Ne pas tenter de contourner, desactiver ou interferer avec les mecanismes de securite des Services.</li>
              <li>Ne pas reproduire, copier, vendre ou exploiter toute partie des Services sans autorisation expresse du Prestataire.</li>
              <li>Ne pas importer de donnees illegales ou portant atteinte aux droits de tiers.</li>
              <li>Ne pas stocker de donnees sensibles (sante, opinions politiques, donnees judiciaires) dans les champs du CRM.</li>
              <li>Ne pas utiliser les formulaires de capture ou les Services pour envoyer du spam ou des communications non sollicitees.</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">Obligations specifiques — CloseOS Business</h3>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>L'Utilisateur Business (Owner) est <strong>responsable de traitement</strong> au sens du RGPD pour les donnees de ses prospects et membres d'equipe. Il doit obtenir le consentement de ses prospects avant collecte et informer les personnes concernees de leurs droits.</li>
              <li>L'Utilisateur Business est seul responsable de la conformite de ses integrations tierces avec les reglementations applicables.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">7. Enregistrement des Appels</h2>
            <p>
              CloseOS Sales propose une fonctionnalite d'enregistrement des appels video et audio. Si l'Utilisateur active cette fonctionnalite, il lui incombe legalement d'informer son interlocuteur que l'appel est susceptible d'etre enregistre, conformement aux lois en vigueur (notamment l'article 226-1 du Code penal francais). CloseOS decline toute responsabilite en cas de non-respect de cette obligation par l'Utilisateur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">8. Integrations tierces</h2>
            <p>
              Les Services permettent a l'Utilisateur de connecter, a sa seule initiative, des services tiers via des protocoles OAuth ou API :
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li><strong className="text-slate-300">CRM :</strong> HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io, iClosed</li>
              <li><strong className="text-slate-300">Calendrier :</strong> Google Calendar (Sales & Business), Cal.com (Sales)</li>
              <li><strong className="text-slate-300">Paiement :</strong> Stripe (abonnement et Stripe Connect)</li>
              <li><strong className="text-slate-300">Automatisation :</strong> Zapier (Business)</li>
            </ul>
            <p className="mt-2">
              L'Utilisateur est seul responsable de la configuration et de la conformite de ces integrations. Le Prestataire ne saurait etre tenu responsable des dysfonctionnements ou pertes de donnees lies a un service tiers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">9. Propriete Intellectuelle</h2>
            <p>
              Tous les elements des Services (logiciel, code source, design, logo, textes, marque) sont la propriete exclusive du Prestataire. La creation d'un compte confere a l'Utilisateur un droit d'utilisation personnel, non exclusif et non cessible des Services pour ses besoins propres. Toute reproduction, ingenierie inverse ou exploitation commerciale non autorisee est strictement interdite.
            </p>
            <p className="mt-2">
              Les donnees saisies par l'Utilisateur restent sa propriete.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">10. Donnees Personnelles (RGPD)</h2>
            <p>
              Le Prestataire traite les donnees personnelles de l'Utilisateur conformement a sa <Link to="/confidentialite" className="text-blue-400 hover:underline">Politique de Confidentialite</Link>.
            </p>
            <p className="mt-2">
              Concernant les donnees des tiers (prospects, membres d'equipe) importees ou collectees par l'Utilisateur dans CloseOS, le Prestataire agit en tant que <strong>Sous-traitant</strong> et l'Utilisateur en tant que Responsable de Traitement. Le Prestataire s'engage a ne traiter ces donnees que sur instruction de l'Utilisateur et a assurer leur securite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">11. Responsabilite</h2>
            <p>
              Le Prestataire est soumis a une <strong>obligation de moyens</strong>. Il s'engage a mettre en oeuvre tous les efforts raisonnables pour assurer la disponibilite des Services. En aucun cas, le Prestataire ne pourra etre tenu responsable des dommages indirects (perte de chiffre d'affaires, perte de donnees, prejudice commercial) subis par l'Utilisateur.
            </p>
            <p className="mt-2">
              Le Prestataire ne saurait etre tenu responsable des decisions commerciales prises par l'Utilisateur sur la base des donnees fournies par les Services, ni des consequences d'une mauvaise configuration des campagnes, rappels ou integrations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">12. Resiliation du Compte</h2>
            <p>
              L'Utilisateur peut supprimer son compte a tout moment depuis son espace personnel ou en contactant <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a>. La suppression entraine la suppression de l'ensemble des donnees associees (prospects, rendez-vous, campagnes, membres d'equipe, integrations), sous reserve des delais de conservation legaux.
            </p>
            <p className="mt-2">
              Le Prestataire se reserve le droit de suspendre ou supprimer tout compte en cas de violation des presentes CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">13. Droit Applicable</h2>
            <p>
              Les presentes CGU sont soumises au droit francais. En cas de litige, et a defaut d'accord amiable, competence exclusive est attribuee aux tribunaux du ressort de la Cour d'appel de <strong>Mulhouse</strong>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-xs">
          <p>Fin du document — CGU CloseOS (Sales & Business)</p>
        </div>
      </main>
    </div>
  );
};
