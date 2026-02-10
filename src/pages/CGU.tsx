import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const CGU = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">
      {/* Header simple */}
      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour à l'accueil</span>
          </Link>
          <span className="font-bold text-white">CGV & CGU</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Conditions Générales de Vente et d'Utilisation</h1>
        <p className="text-slate-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-sm leading-relaxed text-justify">
          
          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Objet et Champ d'application</h2>
            <p>
              Les présentes Conditions Générales de Vente et d'Utilisation (ci-après "CGVU") régissent l'accès et l'utilisation de la plateforme logicielle en mode SaaS <strong>CloseOS</strong> (ci-après le "Service"), éditée par <strong>Thomas Shamoev</strong>, Entrepreneur Individuel, immatriculé au Registre National des Entreprises sous le numéro SIREN <strong>993 427 509</strong>, dont le siège social est situé au <strong>4 Rue des Coquelicots, 68120 Pfastatt, France</strong> (ci-après le "Prestataire").
            </p>
            <p className="mt-2">
              Le Service est destiné exclusivement à des professionnels (Closers, Agences, Entreprises). En souscrivant au Service, le Client reconnaît agir à des fins professionnelles et accepte sans réserve les présentes CGVU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Description du Service</h2>
            <p>
              CloseOS est une solution de gestion de la relation client (CRM) et d'optimisation des ventes. Les fonctionnalités incluent, sans s'y limiter : la gestion de pipeline, la téléphonie VoIP, l'agenda, et le suivi des KPIs.
            </p>
            <p className="mt-2">
              Le Prestataire se réserve le droit de faire évoluer le Service, d'ajouter ou de supprimer des fonctionnalités, sans que cela ne constitue une modification substantielle du contrat, tant que la qualité globale du Service n'est pas dégradée.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Accès et Compte Utilisateur</h2>
            <p>
              L'accès au Service nécessite la création d'un compte. Le Client est responsable de la confidentialité de ses identifiants. Toute action effectuée via le compte du Client est réputée avoir été effectuée par lui. Le Client s'engage à informer immédiatement le Prestataire en cas d'utilisation non autorisée de son compte.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Tarifs et Paiement</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Abonnement :</strong> Le Service est facturé sous forme d'abonnement (mensuel ou annuel). Les prix sont indiqués en euros et s'entendent hors taxes (HT), sauf mention contraire.</li>
              <li><strong>Paiement :</strong> Les paiements sont effectués par carte bancaire via notre prestataire sécurisé <strong>Stripe</strong>. Le Client garantit qu'il dispose des fonds nécessaires.</li>
              <li><strong>Tacite Reconduction :</strong> L'abonnement est renouvelé automatiquement à la fin de chaque période pour une durée identique, sauf résiliation par le Client avant la date d'échéance.</li>
              <li><strong>Retard de paiement :</strong> En cas de défaut de paiement, le Prestataire se réserve le droit de suspendre l'accès au Service immédiatement. Tout retard entraînera l'application d'une pénalité égale à trois fois le taux d'intérêt légal, ainsi qu'une indemnité forfaitaire de 40€ pour frais de recouvrement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">5. Durée et Résiliation</h2>
            <p>
              L'engagement est conclu pour la durée sélectionnée lors de la commande (1 mois ou 1 an).
            </p>
            <p className="mt-2">
              <strong>Résiliation par le Client :</strong> Le Client peut résilier son abonnement à tout moment depuis son espace personnel. La résiliation prendra effet à la fin de la période d'abonnement en cours. Aucun remboursement ne sera effectué pour la période restant à courir (tout mois ou année commencé est dû).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">6. Téléphonie et Enregistrements (VoIP)</h2>
            <p>
              Le Service inclut une fonctionnalité de téléphonie sur IP (VoIP) fournie via un partenaire tiers (Twilio).
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Usage légal :</strong> Le Client s'interdit d'utiliser la VoIP pour du démarchage abusif, du harcèlement ou toute activité illégale.</li>
              <li><strong>Enregistrements :</strong> Si le Client active l'enregistrement des appels, il lui incombe légalement d'informer son interlocuteur que l'appel est susceptible d'être enregistré, conformément aux lois en vigueur. CloseOS décline toute responsabilité en cas de non-respect de cette obligation par le Client.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">7. Responsabilité (Clause limitative)</h2>
            <p>
              Le Prestataire est soumis à une <strong>obligation de moyens</strong>. Il s'engage à mettre en œuvre tous les efforts raisonnables pour assurer la disponibilité du Service.
            </p>
            <p className="mt-2 text-slate-300 bg-slate-900 p-4 rounded-lg border border-slate-700">
              <strong>Limitation :</strong> En aucun cas, le Prestataire ne pourra être tenu responsable des dommages indirects (perte de chiffre d'affaires, perte de clientèle, perte de données, préjudice commercial) subis par le Client. La responsabilité totale du Prestataire, toutes causes confondues, est strictement limitée au montant payé par le Client au cours des 12 derniers mois précédant le fait générateur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">8. Propriété Intellectuelle</h2>
            <p>
              Tous les éléments du Service (logiciel, code source, design, logo, textes) sont la propriété exclusive du Prestataire. L'abonnement ne confère au Client qu'un droit d'utilisation personnel, non exclusif et non cessible du Service pour ses besoins propres. Toute reproduction ou ingénierie inverse est strictement interdite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">9. Données Personnelles (RGPD)</h2>
            <p>
              Le Prestataire traite les données personnelles du Client conformément à sa <Link to="/confidentialite" className="text-blue-400 hover:underline">Politique de Confidentialité</Link>.
            </p>
            <p className="mt-2">
              Concernant les données des tiers (prospects) importées par le Client dans CloseOS, le Prestataire agit en tant que <strong>Sous-traitant</strong> et le Client en tant que Responsable de Traitement. Le Prestataire s'engage à ne traiter ces données que sur instruction du Client et à assurer leur sécurité.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">10. Droit applicable et Juridiction</h2>
            <p>
              Les présentes CGVU sont soumises au droit français. En cas de litige, et à défaut d'accord amiable, compétence exclusive est attribuée aux tribunaux du ressort de la Cour d'appel de <strong>Mulhouse</strong>.
            </p>
          </section>

        </div>
        
        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-xs">
          <p>Fin du document.</p>
        </div>
      </main>
    </div>
  );
};