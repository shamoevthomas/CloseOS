import { useEffect } from 'react';
import { SignLegalShell } from '../components/SignLegalShell';

export default function SignCGV() {
  useEffect(() => { document.title = 'CGV & CGU | CloseOS Sign'; }, []);
  return (
    <SignLegalShell title="Conditions Générales de Vente et d'Utilisation" updated="11 juin 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions régissent la souscription et l'utilisation de <strong>CloseOS Sign</strong>, service de
        signature électronique et d'encaissement édité par CloseOS Technologies (le « Prestataire »). Elles s'appliquent à
        tout utilisateur professionnel disposant d'un compte (l'« Utilisateur »). La souscription emporte acceptation pleine
        et entière des présentes.
      </p>

      <h2>2. Description du service</h2>
      <p>
        CloseOS Sign permet de composer un contrat (à partir d'un modèle, d'une feuille blanche ou d'un PDF importé), de le
        faire signer électroniquement par un ou plusieurs signataires, et le cas échéant d'encaisser un paiement au moment de
        la signature (fonction « Payé + signé »). Chaque signature génère un document scellé accompagné d'un faisceau de
        preuves et d'un certificat vérifiable. Les modèles réutilisables et les espaces par membre d'équipe font partie du
        service.
      </p>

      <h2>3. Abonnement, période d'essai et tarifs</h2>
      <p>
        CloseOS Sign est proposé via une <strong>formule unique à 9 € / mois</strong> (TTC), incluant l'ensemble des
        fonctionnalités. La souscription débute par une <strong>période d'essai de 14 jours</strong> nécessitant
        l'enregistrement d'un moyen de paiement valide. À l'issue de l'essai, l'abonnement est automatiquement activé sauf
        résiliation. L'abonnement est <strong>sans engagement</strong> et résiliable à tout moment depuis l'espace de
        l'Utilisateur.
      </p>
      <p>
        Les titulaires d'un abonnement <strong>CloseOS Business</strong> actif bénéficient de l'accès à CloseOS Sign inclus,
        sans souscription distincte.
      </p>

      <h2>4. Paiement et renouvellement</h2>
      <p>
        L'abonnement est payable d'avance par carte bancaire via notre prestataire de paiement <strong>Stripe</strong>. Il se
        renouvelle automatiquement par périodes successives. En cas d'échec de prélèvement au renouvellement, l'Utilisateur
        dispose d'un délai de grâce pour régulariser ; à défaut, l'accès au service est suspendu. Les documents déjà signés et
        leurs preuves restent conservés conformément à l'article 9.
      </p>

      <h2>5. Fonction « Payé + signé »</h2>
      <p>
        Lorsque cette fonction est activée, le signataire règle un montant défini par l'Utilisateur au moment de la signature,
        via Stripe Connect. <strong>L'Utilisateur reste le bénéficiaire des fonds</strong> (encaissés sur son compte Stripe
        connecté) et le responsable de la prestation vendue. CloseOS perçoit une commission de service sur les transactions
        encaissées, prélevée automatiquement. CloseOS n'est pas partie au contrat conclu entre l'Utilisateur et son client.
      </p>

      <h2>6. Valeur juridique de la signature</h2>
      <p>
        Les signatures réalisées via CloseOS Sign constituent des signatures électroniques au sens du règlement (UE)
        n° 910/2014 (« eIDAS »). Le service réunit un <strong>faisceau de preuves</strong> (horodatage serveur, adresse IP,
        empreinte du document, vérification d'identité, consentement explicite, journal d'événements inaltérable) destiné à
        établir l'intégrité du document et l'imputabilité de la signature. La force probante relève de l'appréciation
        souveraine des tribunaux ; l'Utilisateur demeure responsable de l'adéquation du niveau de signature à ses besoins.
      </p>

      <h2>7. Obligations de l'Utilisateur (CGU)</h2>
      <ul>
        <li>Fournir des informations exactes et maintenir la confidentialité de ses accès.</li>
        <li>N'utiliser le service que pour des documents licites dont il détient les droits.</li>
        <li>Ne pas détourner le service à des fins frauduleuses, trompeuses ou portant atteinte aux droits de tiers.</li>
        <li>Obtenir le consentement des signataires au traitement de leurs données aux fins de signature.</li>
        <li>Ne pas tenter de contourner les mesures de sécurité ni d'altérer les preuves générées.</li>
      </ul>
      <p>Tout manquement peut entraîner la suspension immédiate du compte sans préjudice d'éventuels recours.</p>

      <h2>8. Disponibilité et maintenance</h2>
      <p>
        Le Prestataire met en œuvre les moyens raisonnables pour assurer la disponibilité du service mais ne garantit pas une
        disponibilité ininterrompue. Des opérations de maintenance peuvent être réalisées, en principe signalées lorsqu'elles
        sont programmées.
      </p>

      <h2>9. Responsabilité</h2>
      <p>
        CloseOS fournit un outil technique. L'Utilisateur est seul responsable du contenu, de la validité et de la légalité des
        contrats qu'il établit et fait signer, ainsi que des montants encaissés. La responsabilité du Prestataire, à supposer
        qu'elle soit engagée, est limitée aux dommages directs et plafonnée au montant des sommes versées par l'Utilisateur au
        cours des douze derniers mois.
      </p>

      <h2>10. Droit de rétractation</h2>
      <p>
        Le service étant souscrit par des professionnels dans le cadre de leur activité, le droit de rétractation prévu par le
        Code de la consommation ne s'applique pas (art. L221-3). L'Utilisateur peut néanmoins résilier à tout moment, l'arrêt
        prenant effet à la fin de la période en cours.
      </p>

      <h2>11. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans notre <a href="/sign/confidentialite">Politique de
        confidentialité</a>. Les mesures de sécurité et la valeur probante sont détaillées dans la page <a href="/sign/securite">Sécurité
        technique</a>.
      </p>

      <h2>12. Durée et résiliation</h2>
      <p>
        Les présentes s'appliquent pendant toute la durée d'utilisation du service. L'Utilisateur peut résilier depuis son
        espace ; le Prestataire peut résilier en cas de manquement. La résiliation n'emporte pas suppression des preuves des
        documents déjà signés, conservées conformément à la loi.
      </p>

      <h2>13. Droit applicable et juridiction</h2>
      <p>
        Les présentes sont soumises au droit français. À défaut de résolution amiable, tout litige relève de la compétence des
        tribunaux français compétents.
      </p>
    </SignLegalShell>
  );
}
