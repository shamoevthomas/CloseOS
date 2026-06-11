import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const CGV = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">
      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour a l'accueil</span>
          </Link>
          <span className="font-bold text-white">Conditions Generales de Vente</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Conditions Generales de Vente</h1>
        <p className="text-slate-500 mb-8">Derniere mise a jour : 25 mars 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-justify">

          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Objet</h2>
            <p>
              Les presentes Conditions Generales de Vente (ci-apres "CGV") regissent exclusivement la relation commerciale entre <strong>Thomas Shamoev</strong>, Entrepreneur Individuel, immatricule au RNE sous le numero SIREN <strong>993 427 509</strong>, dont le siege social est situe au <strong>4 Rue des Coquelicots, 68120 Pfastatt, France</strong> (ci-apres le "Prestataire"), et toute personne souscrivant a un abonnement payant sur l'un des services CloseOS (ci-apres le "Client").
            </p>
            <p className="mt-2">
              Les CGV s'appliquent aux deux services de l'ecosysteme CloseOS :
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li><strong className="text-slate-300">CloseOS Sales</strong> — Outil pour closers et setters professionnels</li>
              <li><strong className="text-slate-300">CloseOS Business</strong> — Plateforme de management pour infopreneurs et Head of Sales</li>
            </ul>
            <p className="mt-2">
              Les CGV sont distinctes des Conditions Generales d'Utilisation (CGU) acceptees lors de la creation du compte. Le Service est destine exclusivement a des professionnels (Closers, Setters, Infopreneurs, Head of Sales, Agences, Independants). En souscrivant, le Client reconnait agir a des fins professionnelles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Periode d'Essai et Souscription Payante</h2>
            <p>
              <strong>CloseOS Sales :</strong> Avant toute souscription payante, le Client beneficie d'une <strong>periode d'essai gratuit de 10 jours</strong>, sans carte bancaire requise. Durant cette periode, aucun contrat commercial n'est conclu et aucun prelevement n'est effectue. Si le Client ne souscrit pas a l'issue des 10 jours, son acces au Service est automatiquement suspendu. Ses donnees sont conservees pendant 30 jours supplementaires, puis definitivement supprimees.
            </p>
            <p className="mt-4">
              <strong>CloseOS Business :</strong> Les conditions d'acces (essai gratuit, acces direct ou liste d'attente) sont definies au moment du lancement commercial et communiquees sur la page dediee. Les memes principes de conservation des donnees s'appliquent.
            </p>
            <p className="mt-4">
              Pour les deux services, la souscription payante est effectuee via la page de paiement securisee de CloseOS. Le contrat commercial est conclu au moment ou le Client valide son paiement via Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Offres et Tarifs</h2>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">3.1 CloseOS Sales</h3>
            <p>Les tarifs en vigueur au moment de la souscription sont les suivants (en euros, toutes taxes comprises) :</p>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900">
                    <th className="px-4 py-3 text-left font-bold text-white">Offre</th>
                    <th className="px-4 py-3 text-left font-bold text-white">Mensuel</th>
                    <th className="px-4 py-3 text-left font-bold text-white">Annuel (-25%)</th>
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

            <h3 className="text-base font-semibold text-white mt-6 mb-2">3.2 CloseOS Business</h3>
            <p>
              Les tarifs de CloseOS Business sont communiques sur la page dediee au moment du lancement commercial. Ils peuvent inclure une tarification par equipe ou par nombre de membres.
            </p>

            <h3 className="text-base font-semibold text-white mt-6 mb-2">3.3 CloseOS Sign</h3>
            <p>
              CloseOS Sign (signature electronique et encaissement) est propose via une formule unique a 9 € / mois TTC, incluant l'ensemble des fonctionnalites, apres une periode d'essai de 14 jours necessitant l'enregistrement d'un moyen de paiement. L'abonnement est sans engagement et resiliable a tout moment. En cas d'echec de paiement au renouvellement, l'acces est suspendu apres un delai de grace. La fonction « Paye + signe » permet d'encaisser un paiement lors de la signature via Stripe ; CloseOS percoit une commission de service sur les transactions encaissees, l'Utilisateur restant le beneficiaire des fonds via son compte Stripe connecte. Les titulaires d'un abonnement CloseOS Business actif beneficient de l'acces a CloseOS Sign inclus. Les conditions specifiques et la valeur probante sont detaillees sur les pages dediees de CloseOS Sign.
            </p>

            <p className="mt-4">
              Les prix sont indiques en euros. Le Prestataire se reserve le droit de modifier ses tarifs a tout moment pour les nouveaux abonnements. Les abonnements en cours ne sont pas affectes par ces modifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Tarification et abonnements existants</h2>
            <p>
              Les abonnements souscrits avant le 16 mars 2026 conservent leur tarif d'origine tant que l'abonnement reste actif. En cas de resiliation volontaire par le Client, le tarif preferentiel est definitivement perdu. En cas de reabonnement ulterieur, le Client sera soumis aux tarifs en vigueur a cette date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">5. Paiement</h2>
            <p>
              Les paiements sont effectues par carte bancaire via le prestataire de paiement securise <strong>Stripe</strong>. Le Client garantit disposer des autorisations necessaires pour utiliser le moyen de paiement renseigne.
            </p>
            <p className="mt-2">
              L'abonnement est renouvele automatiquement a chaque echeance (mensuelle ou annuelle), par prelevement automatique sur la carte bancaire enregistree. Le Client recoit une confirmation de paiement par email a chaque renouvellement.
            </p>
            <p className="mt-2">
              En cas de defaut de paiement, le Prestataire se reserve le droit de suspendre l'acces au Service immediatement. Tout retard de paiement entraine l'application de penalites egales a trois fois le taux d'interet legal en vigueur, ainsi qu'une indemnite forfaitaire de 40 € pour frais de recouvrement, conformement a l'article L.441-10 du Code de commerce.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">6. Droit de Retractation</h2>
            <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-300 font-bold mb-2">Information importante</p>
              <p>
                Conformement a l'article L.221-18 du Code de la consommation, le Client dispose d'un delai de <strong>14 jours calendaires</strong> a compter de la date de souscription payante pour exercer son droit de retractation, sans avoir a justifier de motif.
              </p>
            </div>
            <p className="mt-4">
              Pour exercer ce droit, le Client doit notifier sa decision par email a <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a> avant l'expiration du delai. En cas de retractation valide, le remboursement integral sera effectue sous 14 jours, par le meme moyen de paiement que celui utilise lors de la souscription.
            </p>
            <p className="mt-2">
              <strong>Exception — Renonciation expresse :</strong> Si le Client coche la case prevue a cet effet lors du paiement ("Je souhaite acceder immediatement au Service et renonce expressement a mon droit de retractation"), le droit de retractation est legalement neutralise conformement a l'article L.221-28 du Code de la consommation. Dans ce cas, aucun remboursement ne pourra etre accorde.
            </p>
            <p className="mt-2 text-slate-500 text-xs">
              Note : CloseOS etant destine a des professionnels, le droit de retractation ne s'applique en principe qu'aux utilisateurs agissant en qualite de consommateurs (personnes physiques n'agissant pas dans le cadre de leur activite professionnelle).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">7. Duree et Resiliation</h2>
            <p>
              L'abonnement est conclu pour la duree selectionnee lors de la souscription (1 mois ou 1 an) et se renouvelle automatiquement par tacite reconduction.
            </p>
            <p className="mt-2">
              <strong>Resiliation par le Client :</strong> Le Client peut resilier son abonnement a tout moment depuis son espace personnel ou en contactant <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a>. La resiliation prend effet a la fin de la periode d'abonnement en cours. <strong>Aucun remboursement ne sera effectue pour la periode restant a courir</strong> (tout mois ou toute annee commence est du), hors exercice du droit de retractation dans les conditions de l'article 6.
            </p>
            <p className="mt-2">
              <strong>Resiliation par le Prestataire :</strong> Le Prestataire peut resilier l'abonnement en cas de violation des CGU ou des presentes CGV, apres mise en demeure restee sans effet sous 48 heures.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">8. Responsabilite</h2>
            <p className="bg-slate-900 p-4 rounded-xl border border-slate-700">
              <strong>Limitation :</strong> En aucun cas le Prestataire ne pourra etre tenu responsable des dommages indirects (perte de chiffre d'affaires, perte de clientele, perte de donnees, prejudice commercial) subis par le Client. La responsabilite totale du Prestataire, toutes causes confondues, est strictement limitee au montant paye par le Client au cours des 12 derniers mois precedant le fait generateur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">9. Donnees Personnelles</h2>
            <p>
              Le traitement des donnees personnelles effectue dans le cadre de la relation commerciale est regi par la <Link to="/confidentialite" className="text-blue-400 hover:underline">Politique de Confidentialite</Link> de CloseOS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">10. Droit Applicable et Juridiction</h2>
            <p>
              Les presentes CGV sont soumises au droit francais. En cas de litige, et a defaut d'accord amiable trouve dans un delai de 30 jours a compter de la notification du differend, competence exclusive est attribuee aux tribunaux du ressort de la Cour d'appel de <strong>Mulhouse</strong>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-xs">
          <p>Fin du document — CGV CloseOS (Sales & Business)</p>
        </div>
      </main>
    </div>
  );
};
