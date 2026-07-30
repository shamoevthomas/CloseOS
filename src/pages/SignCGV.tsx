import { useEffect } from 'react';
import { SignLegalShell } from '../components/SignLegalShell';
import { useSignLang } from '../contexts/SignLangContext';

export default function SignCGV() {
  const { lang } = useSignLang();
  useEffect(() => { document.title = lang === 'fr' ? 'CGV & CGU | CloseOS Sign' : 'Terms of Sale & Use | CloseOS Sign'; }, [lang]);
  return (
    <SignLegalShell
      title={lang === 'fr' ? "Conditions Générales de Vente et d'Utilisation" : 'General Terms of Sale and Use'}
      updated={lang === 'fr' ? '29 juillet 2026' : 'July 29, 2026'}
    >
      <h2>{lang === 'fr' ? '1. Objet' : '1. Purpose'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Les présentes conditions régissent la souscription et l'utilisation de <strong>CloseOS Sign</strong>, service de
          signature électronique et d'encaissement édité par <strong>Thomas Shamoev</strong>, entreprise individuelle exerçant
          sous le nom commercial <strong>CloseOS Technologies</strong> (SIREN 993 427 509) (le « Prestataire »). Elles s'appliquent à
          tout utilisateur professionnel disposant d'un compte (l'« Utilisateur »). La souscription emporte acceptation pleine
          et entière des présentes.</>
        ) : (
          <>These terms govern the subscription to and use of <strong>CloseOS Sign</strong>, an electronic signature and payment
          collection service published by <strong>Thomas Shamoev</strong>, a sole proprietorship trading as <strong>CloseOS Technologies</strong>
          (SIREN 993 427 509) (the "Provider"). They apply to any professional user holding an
          account (the "User"). Subscribing constitutes full and unreserved acceptance of these terms.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '2. Description du service' : '2. Service description'}</h2>
      <p>
        {lang === 'fr' ? (
          <>CloseOS Sign permet de composer un contrat (à partir d'un modèle, d'une feuille blanche ou d'un PDF importé), de le
          faire signer électroniquement par un ou plusieurs signataires, et le cas échéant d'encaisser un paiement au moment de
          la signature (fonction « Payé + signé »). Chaque signature génère un document scellé accompagné d'un faisceau de
          preuves et d'un certificat vérifiable. La signature peut être demandée à <strong>plusieurs signataires selon un ordre
          parallèle ou séquentiel</strong>, avec le cas échéant un paiement dû par chaque signataire. Les modèles réutilisables et
          les espaces par membre d'équipe font partie du service : un membre d'équipe (« closer ») peut préparer et envoyer des
          contrats <strong>pour le compte de l'Utilisateur</strong>, qui en demeure responsable.</>
        ) : (
          <>CloseOS Sign lets you compose a contract (from a template, a blank page, or an imported PDF), have it signed
          electronically by one or more signers, and, where applicable, collect a payment at the time of signing (the "Sign +
          Pay" feature). Each signature generates a sealed document accompanied by an evidence bundle and a verifiable
          certificate. Signature can be requested from <strong>several signers in parallel or sequential order</strong>, with a
          payment due per signer where applicable. Reusable templates and per-team-member workspaces are part of the service: a
          team member ("closer") may prepare and send contracts <strong>on behalf of the User</strong>, who remains responsible
          for them.</>
        )}
      </p>

      <h2>{lang === 'fr' ? "3. Abonnement, période d'essai et tarifs" : '3. Subscription, trial period and pricing'}</h2>
      <p>
        {lang === 'fr' ? (
          <>CloseOS Sign est proposé via une <strong>formule unique à 9 € / mois</strong> (TTC), incluant l'ensemble des
          fonctionnalités. La souscription débute par une <strong>période d'essai de 14 jours</strong> nécessitant
          l'enregistrement d'un moyen de paiement valide. À l'issue de l'essai, l'abonnement est automatiquement activé sauf
          résiliation. L'abonnement est <strong>sans engagement</strong> et résiliable à tout moment depuis l'espace de
          l'Utilisateur.</>
        ) : (
          <>CloseOS Sign is offered through a <strong>single plan at 9 € / month</strong> (incl. tax), including all features.
          The subscription begins with a <strong>14-day trial period</strong> requiring a valid payment method to be
          registered. At the end of the trial, the subscription is automatically activated unless cancelled. The subscription
          is <strong>commitment-free</strong> and can be cancelled at any time from the User's workspace.</>
        )}
      </p>
      <p>
        {lang === 'fr' ? (
          <>Les titulaires d'un abonnement <strong>CloseOS Business</strong> actif bénéficient de l'accès à CloseOS Sign inclus,
          sans souscription distincte.</>
        ) : (
          <>Holders of an active <strong>CloseOS Business</strong> subscription benefit from access to CloseOS Sign included, at
          no separate subscription.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '4. Paiement et renouvellement' : '4. Payment and renewal'}</h2>
      <p>
        {lang === 'fr' ? (
          <>L'abonnement est payable d'avance par carte bancaire via notre prestataire de paiement <strong>Stripe</strong>. Il se
          renouvelle automatiquement par périodes successives. En cas d'échec de prélèvement au renouvellement, l'Utilisateur
          dispose d'un délai de grâce pour régulariser ; à défaut, l'accès au service est suspendu. Les documents déjà signés et
          leurs preuves restent conservés conformément à l'article 9.</>
        ) : (
          <>The subscription is payable in advance by bank card via our payment provider <strong>Stripe</strong>. It renews
          automatically for successive periods. Should a renewal charge fail, the User has a grace period to remedy the
          situation; failing that, access to the service is suspended. Documents already signed and their evidence remain
          retained in accordance with article 9.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '5. Fonction « Payé + signé »' : '5. The "Sign + Pay" feature'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Lorsque cette fonction est activée, le signataire règle un montant défini par l'Utilisateur au moment de la signature,
          via Stripe Connect. <strong>L'Utilisateur reste le bénéficiaire des fonds</strong> (encaissés sur son compte Stripe
          connecté) et le responsable de la prestation vendue. CloseOS perçoit une commission de service sur les transactions
          encaissées, prélevée automatiquement. CloseOS n'est pas partie au contrat conclu entre l'Utilisateur et son client et
          intervient uniquement comme <strong>facilitateur technique</strong> de l'encaissement, sans détenir les fonds.
          L'Utilisateur définit et assure seul la <strong>politique de remboursement</strong> de la prestation vendue et gère les
          litiges, impayés et rétrofacturations (chargebacks) avec son client. Lorsque le client final est un consommateur, il
          appartient à l'Utilisateur de respecter à son égard le droit de la consommation applicable.</>
        ) : (
          <>When this feature is enabled, the signer pays an amount set by the User at the time of signing, via Stripe Connect.
          <strong> The User remains the beneficiary of the funds</strong> (collected into their connected Stripe account) and is
          responsible for the service sold. CloseOS charges a service commission on collected transactions, deducted
          automatically. CloseOS is not a party to the contract entered into between the User and their client and acts solely as
          a <strong>technical facilitator</strong> of the collection, without holding the funds. The User alone defines and
          ensures the <strong>refund policy</strong> for the service sold and handles disputes, unpaid amounts, and chargebacks
          with their client. Where the end client is a consumer, it is the User's responsibility to comply with applicable
          consumer law toward them.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '6. Valeur juridique de la signature' : '6. Legal value of the signature'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Les signatures réalisées via CloseOS Sign constituent des signatures électroniques au sens du règlement (UE)
          n° 910/2014 (« eIDAS ») et des <strong>articles 1366 et 1367 du Code civil</strong>. Le service fournit une
          <strong> signature électronique simple</strong>, renforcée par la vérification du signataire (par code email et/ou SMS)
          lorsque celle-ci est activée par l'Utilisateur. Il réunit un <strong>faisceau de preuves</strong> (horodatage serveur,
          adresse IP, empreinte du document, vérification d'identité, consentement explicite, journal d'événements inaltérable)
          destiné à établir l'intégrité du document et l'imputabilité de la signature. La force probante relève de l'appréciation
          souveraine des tribunaux ; l'Utilisateur demeure responsable de l'adéquation du niveau de signature à ses besoins.</>
        ) : (
          <>Signatures made through CloseOS Sign constitute electronic signatures within the meaning of Regulation (EU)
          No 910/2014 ("eIDAS") and of <strong>articles 1366 and 1367 of the French Civil Code</strong>. The service provides a
          <strong> simple electronic signature</strong>, reinforced by signer verification (via email and/or SMS code) when
          enabled by the User. It gathers an <strong>evidence bundle</strong> (server timestamp, IP address,
          document hash, identity verification, explicit consent, tamper-proof event log) intended to establish the integrity of
          the document and the attributability of the signature. Evidentiary weight is a matter for the sole assessment of the
          courts; the User remains responsible for ensuring the signature level is appropriate to their needs.</>
        )}
      </p>

      <h2>{lang === 'fr' ? "7. Obligations de l'Utilisateur (CGU)" : '7. User obligations (Terms of Use)'}</h2>
      <ul>
        {lang === 'fr' ? (
          <>
            <li>Fournir des informations exactes et maintenir la confidentialité de ses accès.</li>
            <li>N'utiliser le service que pour des documents licites dont il détient les droits.</li>
            <li>Ne pas détourner le service à des fins frauduleuses, trompeuses ou portant atteinte aux droits de tiers.</li>
            <li>Obtenir le consentement des signataires au traitement de leurs données aux fins de signature.</li>
            <li>Ne pas tenter de contourner les mesures de sécurité ni d'altérer les preuves générées.</li>
          </>
        ) : (
          <>
            <li>Provide accurate information and keep their credentials confidential.</li>
            <li>Use the service only for lawful documents to which they hold the rights.</li>
            <li>Not misuse the service for fraudulent or deceptive purposes or in a way that infringes third-party rights.</li>
            <li>Obtain the signers' consent to the processing of their data for signing purposes.</li>
            <li>Not attempt to circumvent security measures or tamper with the evidence generated.</li>
          </>
        )}
      </ul>
      <p>{lang === 'fr' ? 'Tout manquement peut entraîner la suspension immédiate du compte sans préjudice d\'éventuels recours.' : 'Any breach may result in the immediate suspension of the account without prejudice to any legal recourse.'}</p>

      <h2>{lang === 'fr' ? '8. Disponibilité et maintenance' : '8. Availability and maintenance'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Le Prestataire met en œuvre les moyens raisonnables pour assurer la disponibilité du service mais ne garantit pas une
          disponibilité ininterrompue. Des opérations de maintenance peuvent être réalisées, en principe signalées lorsqu'elles
          sont programmées.</>
        ) : (
          <>The Provider uses reasonable means to ensure the availability of the service but does not guarantee uninterrupted
          availability. Maintenance operations may be carried out, and are in principle announced when scheduled.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '9. Responsabilité' : '9. Liability'}</h2>
      <p>
        {lang === 'fr' ? (
          <>CloseOS fournit un outil technique. L'Utilisateur est seul responsable du contenu, de la validité et de la légalité des
          contrats qu'il établit et fait signer, ainsi que des montants encaissés. La responsabilité du Prestataire, à supposer
          qu'elle soit engagée, est limitée aux dommages directs et plafonnée au montant des sommes versées par l'Utilisateur au
          cours des douze derniers mois.</>
        ) : (
          <>CloseOS provides a technical tool. The User is solely responsible for the content, validity, and legality of the
          contracts they draw up and have signed, as well as for the amounts collected. The Provider's liability, should it be
          engaged, is limited to direct damages and capped at the amount of the sums paid by the User over the last twelve
          months.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '10. Droit de rétractation' : '10. Right of withdrawal'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Le service étant souscrit par des professionnels dans le cadre de leur activité, le droit de rétractation prévu par le
          Code de la consommation ne s'applique pas (art. L221-3). L'Utilisateur peut néanmoins résilier à tout moment, l'arrêt
          prenant effet à la fin de la période en cours.</>
        ) : (
          <>As the service is subscribed to by professionals in the course of their business, the right of withdrawal provided by
          the French Consumer Code does not apply (art. L221-3). The User may nonetheless cancel at any time, with the
          termination taking effect at the end of the current period.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '11. Données personnelles' : '11. Personal data'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Le traitement des données personnelles est décrit dans notre <a href="/sign/confidentialite">Politique de
          confidentialité</a>. Les mesures de sécurité et la valeur probante sont détaillées dans la page <a href="/sign/securite">Sécurité
          technique</a>. Pour les Utilisateurs disposant d'un compte <strong>CloseOS Business</strong>, un dossier « CRM CloseOS »
          (clients et équipe) peut être synchronisé vers CloseOS Sign afin de préremplir les contrats ; ce flux repose sur le
          compte commun de l'Utilisateur, qui en reste responsable de traitement.</>
        ) : (
          <>The processing of personal data is described in our <a href="/sign/confidentialite">Privacy Policy</a>. Security
          measures and evidentiary value are detailed on the <a href="/sign/securite">Technical Security</a> page. For Users with a
          <strong> CloseOS Business</strong> account, a "CloseOS CRM" folder (clients and team) may be synchronized to CloseOS Sign
          to pre-fill contracts; this flow relies on the User's shared account, who remains the data controller.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '12. Durée et résiliation' : '12. Term and termination'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Les présentes s'appliquent pendant toute la durée d'utilisation du service. L'Utilisateur peut résilier depuis son
          espace ; le Prestataire peut résilier en cas de manquement. La résiliation n'emporte pas suppression des preuves des
          documents déjà signés, conservées conformément à la loi.</>
        ) : (
          <>These terms apply for the entire duration of use of the service. The User may cancel from their workspace; the
          Provider may terminate in the event of a breach. Termination does not entail the deletion of the evidence of documents
          already signed, which is retained in accordance with the law.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '13. Droit applicable et juridiction' : '13. Governing law and jurisdiction'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Les présentes sont soumises au droit français. À défaut de résolution amiable, tout litige relève de la compétence des
          tribunaux français compétents.</>
        ) : (
          <>These terms are governed by French law. Failing an amicable resolution, any dispute falls within the jurisdiction of
          the competent French courts.</>
        )}
      </p>
    </SignLegalShell>
  );
}
