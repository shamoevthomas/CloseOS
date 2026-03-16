import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const CGV = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">
      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour à l'accueil</span>
          </Link>
          <span className="font-bold text-white">Conditions Générales de Vente</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Conditions Générales de Vente</h1>
        <p className="text-slate-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-sm leading-relaxed text-justify">

          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Objet</h2>
            <p>
              Les présentes Conditions Générales de Vente (ci-après "CGV") régissent exclusivement la relation commerciale entre <strong>Thomas Shamoev</strong>, Entrepreneur Individuel, immatriculé au RNE sous le numéro SIREN <strong>993 427 509</strong>, dont le siège social est situé au <strong>4 Rue des Coquelicots, 68120 Pfastatt, France</strong> (ci-après le "Prestataire"), et toute personne souscrivant à un abonnement payant CloseOS (ci-après le "Client").
            </p>
            <p className="mt-2">
              Les CGV s'appliquent uniquement à partir du moment où le Client souscrit à un abonnement payant, à l'issue de la période d'essai gratuit de 10 jours. Elles sont distinctes des Conditions Générales d'Utilisation (CGU) acceptées lors de la création du compte.
            </p>
            <p className="mt-2">
              Le Service est destiné exclusivement à des professionnels (Closers, Agences, Indépendants). En souscrivant, le Client reconnaît agir à des fins professionnelles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Période d'Essai et Souscription Payante</h2>
            <p>
              Avant toute souscription payante, le Client bénéficie d'une <strong>période d'essai gratuit de 10 jours</strong>, sans carte bancaire requise. Durant cette période, aucun contrat commercial n'est conclu et aucun prélèvement n'est effectué.
            </p>
            <p className="mt-2">
              À l'issue de la période d'essai, le Client peut choisir librement de souscrire à l'un des abonnements payants proposés. La souscription payante est effectuée via la page de paiement sécurisée de CloseOS. Le contrat commercial est conclu au moment où le Client valide son paiement via Stripe.
            </p>
            <p className="mt-2">
              Si le Client ne souscrit pas à l'issue des 10 jours, son accès au Service est automatiquement suspendu. Ses données sont conservées pendant 30 jours supplémentaires, puis définitivement supprimées.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Offres et Tarifs</h2>
            <p>Les tarifs en vigueur au moment de la souscription sont les suivants (en euros, toutes taxes comprises) :</p>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900">
                    <th className="px-4 py-3 text-left font-bold text-white">Offre</th>
                    <th className="px-4 py-3 text-left font-bold text-white">Mensuel</th>
                    <th className="px-4 py-3 text-left font-bold text-white">Annuel (−25%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="px-4 py-3 text-slate-300">Pack Pro <span className="text-blue-400 text-xs font-bold">(offre de lancement)</span></td>
                    <td className="px-4 py-3 text-slate-300">34 € / mois</td>
                    <td className="px-4 py-3 text-slate-300">25,50 € / mois</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              Les prix sont indiqués en euros. Le Prestataire se réserve le droit de modifier ses tarifs à tout moment pour les nouveaux abonnements. Les abonnements en cours ne sont pas affectés par ces modifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Tarification et abonnements existants</h2>
            <p>
              Les abonnements souscrits avant le 16 mars 2026 conservent leur tarif d'origine tant que l'abonnement reste actif. En cas de résiliation volontaire par le Client, le tarif préférentiel est définitivement perdu. En cas de réabonnement ultérieur, le Client sera soumis aux tarifs en vigueur à cette date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">5. Paiement</h2>
            <p>
              Les paiements sont effectués par carte bancaire via le prestataire de paiement sécurisé <strong>Stripe</strong>. Le Client garantit disposer des autorisations nécessaires pour utiliser le moyen de paiement renseigné.
            </p>
            <p className="mt-2">
              L'abonnement est renouvelé automatiquement à chaque échéance (mensuelle ou annuelle), par prélèvement automatique sur la carte bancaire enregistrée. Le Client reçoit une confirmation de paiement par email à chaque renouvellement.
            </p>
            <p className="mt-2">
              En cas de défaut de paiement, le Prestataire se réserve le droit de suspendre l'accès au Service immédiatement. Tout retard de paiement entraîne l'application de pénalités égales à trois fois le taux d'intérêt légal en vigueur, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement, conformément à l'article L.441-10 du Code de commerce.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">6. Droit de Rétractation</h2>
            <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-300 font-bold mb-2">⚠️ Information importante</p>
              <p>
                Conformément à l'article L.221-18 du Code de la consommation, le Client dispose d'un délai de <strong>14 jours calendaires</strong> à compter de la date de souscription payante pour exercer son droit de rétractation, sans avoir à justifier de motif.
              </p>
            </div>
            <p className="mt-4">
              Pour exercer ce droit, le Client doit notifier sa décision par email à <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a> avant l'expiration du délai. En cas de rétractation valide, le remboursement intégral sera effectué sous 14 jours, par le même moyen de paiement que celui utilisé lors de la souscription.
            </p>
            <p className="mt-2">
              <strong>Exception — Renonciation expresse :</strong> Si le Client coche la case prévue à cet effet lors du paiement ("Je souhaite accéder immédiatement au Service et renonce expressément à mon droit de rétractation"), le droit de rétractation est légalement neutralisé conformément à l'article L.221-28 du Code de la consommation. Dans ce cas, aucun remboursement ne pourra être accordé.
            </p>
            <p className="mt-2 text-slate-500 text-xs">
              Note : CloseOS étant destiné à des professionnels, le droit de rétractation ne s'applique en principe qu'aux utilisateurs agissant en qualité de consommateurs (personnes physiques n'agissant pas dans le cadre de leur activité professionnelle).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">7. Durée et Résiliation</h2>
            <p>
              L'abonnement est conclu pour la durée sélectionnée lors de la souscription (1 mois ou 1 an) et se renouvelle automatiquement par tacite reconduction.
            </p>
            <p className="mt-2">
              <strong>Résiliation par le Client :</strong> Le Client peut résilier son abonnement à tout moment depuis son espace personnel ou en contactant <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a>. La résiliation prend effet à la fin de la période d'abonnement en cours. <strong>Aucun remboursement ne sera effectué pour la période restant à courir</strong> (tout mois ou toute année commencé est dû), hors exercice du droit de rétractation dans les conditions de l'article 6.
            </p>
            <p className="mt-2">
              <strong>Résiliation par le Prestataire :</strong> Le Prestataire peut résilier l'abonnement en cas de violation des CGU ou des présentes CGV, après mise en demeure restée sans effet sous 48 heures.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">8. Responsabilité</h2>
            <p className="bg-slate-900 p-4 rounded-xl border border-slate-700">
              <strong>Limitation :</strong> En aucun cas le Prestataire ne pourra être tenu responsable des dommages indirects (perte de chiffre d'affaires, perte de clientèle, perte de données, préjudice commercial) subis par le Client. La responsabilité totale du Prestataire, toutes causes confondues, est strictement limitée au montant payé par le Client au cours des 12 derniers mois précédant le fait générateur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">9. Données Personnelles</h2>
            <p>
              Le traitement des données personnelles effectué dans le cadre de la relation commerciale est régi par la <Link to="/confidentialite" className="text-blue-400 hover:underline">Politique de Confidentialité</Link> de CloseOS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">10. Droit Applicable et Juridiction</h2>
            <p>
              Les présentes CGV sont soumises au droit français. En cas de litige, et à défaut d'accord amiable trouvé dans un délai de 30 jours à compter de la notification du différend, compétence exclusive est attribuée aux tribunaux du ressort de la Cour d'appel de <strong>Mulhouse</strong>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-xs">
          <p>Fin du document — CGV CloseOS</p>
        </div>
      </main>
    </div>
  );
};
