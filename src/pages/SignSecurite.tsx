import { useEffect } from 'react';
import { SignLegalShell } from '../components/SignLegalShell';
import { useSignLang } from '../contexts/SignLangContext';

export default function SignSecurite() {
  const { lang } = useSignLang();
  useEffect(() => { document.title = lang === 'fr' ? 'Sécurité technique | CloseOS Sign' : 'Technical Security | CloseOS Sign'; }, [lang]);
  return (
    <SignLegalShell
      title={lang === 'fr' ? 'Sécurité technique & valeur probante' : 'Technical Security & Evidentiary Value'}
      updated={lang === 'fr' ? '11 juin 2026' : 'June 11, 2026'}
    >
      <p>
        {lang === 'fr' ? (
          <>Cette page décrit les mesures techniques qui fondent l'intégrité des documents et la force probante des signatures
          réalisées avec CloseOS Sign.</>
        ) : (
          <>This page describes the technical measures that underpin the integrity of documents and the evidentiary weight of
          signatures made with CloseOS Sign.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '1. Faisceau de preuves' : '1. Evidence bundle'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Chaque action est consignée dans un <strong>journal d'événements en ajout seul (append-only)</strong>, non modifiable
          depuis l'application : ouverture du document, envoi et vérification du code, consentement explicite, signature,
          paiement, ainsi que l'adresse IP, l'agent utilisateur et l'horodatage. Ce faisceau, recoupé, établit l'imputabilité de
          la signature.</>
        ) : (
          <>Every action is recorded in an <strong>append-only event log</strong> that cannot be modified from the application:
          document opening, code sending and verification, explicit consent, signature, payment, as well as the IP address, user
          agent and timestamp. Cross-referenced, this bundle establishes the attributability of the signature.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '2. Horodatage' : '2. Timestamping'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Tous les événements sont horodatés par le <strong>serveur en temps universel (UTC)</strong>, indépendamment de
          l'horloge du poste du signataire, afin de garantir une chronologie fiable et opposable.</>
        ) : (
          <>All events are timestamped by the <strong>server in Coordinated Universal Time (UTC)</strong>, independently of the
          clock on the signer's device, in order to guarantee a reliable and enforceable chronology.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '3. Intégrité du document' : '3. Document integrity'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Une empreinte cryptographique <strong>SHA-256</strong> du document présenté est calculée et figée, puis une empreinte
          du document signé final (« scellé ») est générée côté serveur sur les octets effectivement reçus. Toute altération,
          même d'un seul caractère, modifie l'empreinte et devient ainsi détectable.</>
        ) : (
          <>A cryptographic <strong>SHA-256</strong> hash of the presented document is computed and frozen, then a hash of the
          final signed ("sealed") document is generated server-side on the bytes actually received. Any alteration, even of a
          single character, changes the hash and thus becomes detectable.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '4. Certificat de preuve' : '4. Proof certificate'}</h2>
      <p>
        {lang === 'fr' ? (
          <>À l'issue de la signature, un <strong>certificat de preuve</strong> est généré <strong>une seule fois</strong> puis
          figé (jamais régénéré) : il récapitule les signataires, la chronologie horodatée, les empreintes et les éléments de
          sécurité. Il est conservé dans un stockage privé et reste <strong>vérifiable publiquement</strong> via une page de
          vérification dédiée, sans exposer les données des autres parties.</>
        ) : (
          <>Once signing is complete, a <strong>proof certificate</strong> is generated <strong>only once</strong> then frozen
          (never regenerated): it summarizes the signers, the timestamped chronology, the hashes and the security elements. It is
          kept in private storage and remains <strong>publicly verifiable</strong> via a dedicated verification page, without
          exposing the data of the other parties.</>
        )}
      </p>

      <h2>{lang === 'fr' ? "5. Vérification d'identité du signataire" : '5. Signer identity verification'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Selon la configuration du contrat, le signataire confirme son identité par un <strong>code à usage unique</strong>
          (email et/ou SMS) adressé à une coordonnée préalablement autorisée (liste blanche). Le dispositif intègre une
          protection anti-force brute (limitation des tentatives et blocage), tracée dans le faisceau de preuves.</>
        ) : (
          <>Depending on the contract configuration, the signer confirms their identity with a <strong>one-time code</strong>
          (email and/or SMS) sent to a previously authorized contact detail (whitelist). The mechanism includes anti-brute-force
          protection (attempt limiting and blocking), recorded in the evidence bundle.</>
        )}
      </p>

      <h2>{lang === 'fr' ? "6. Cloisonnement et contrôle d'accès" : '6. Compartmentalization and access control'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Les données sont <strong>isolées par compte</strong> au niveau de la base (politiques de sécurité au niveau des lignes,
          « Row Level Security ») : aucun accès anonyme direct aux données sensibles n'est possible. Les accès des signataires et
          des espaces d'équipe passent par des fonctions serveur autorisées par jeton, strictement cloisonnées.</>
        ) : (
          <>Data is <strong>isolated per account</strong> at the database level (row-level security policies, "Row Level
          Security"): no direct anonymous access to sensitive data is possible. Access by signers and team workspaces goes through
          token-authorized server functions, strictly compartmentalized.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '7. Authentification du propriétaire' : '7. Owner authentication'}</h2>
      <p>
        {lang === 'fr' ? (
          <>L'accès au compte propriétaire est protégé par mot de passe et par une <strong>vérification d'appareil</strong> (code
          envoyé par email à chaque nouvel appareil, appareil de confiance mémorisé temporairement, alerte de nouvelle
          connexion).</>
        ) : (
          <>Access to the owner account is protected by password and by a <strong>device verification</strong> (a code sent by
          email for each new device, a trusted device remembered temporarily, a new-login alert).</>
        )}
      </p>

      <h2>{lang === 'fr' ? '8. Chiffrement et hébergement' : '8. Encryption and hosting'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Les échanges sont chiffrés en transit (TLS) et les données chiffrées au repos. L'hébergement de la base et du stockage
          est situé dans l'<strong>Union européenne</strong>. Les secrets et clés de paiement sont conservés côté serveur
          uniquement, jamais exposés au navigateur.</>
        ) : (
          <>Communications are encrypted in transit (TLS) and data is encrypted at rest. The database and storage are hosted in the
          <strong> European Union</strong>. Secrets and payment keys are kept server-side only, never exposed to the browser.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '9. Conservation et legal hold' : '9. Retention and legal hold'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Les documents signés, certificats et journaux de preuve sont conservés <strong>au minimum 5 ans</strong>. En cas de
          litige, une conservation prolongée (« legal hold ») peut être appliquée pour préserver les éléments de preuve.</>
        ) : (
          <>Signed documents, certificates and evidence logs are retained for <strong>at least 5 years</strong>. In the event of a
          dispute, extended retention (a "legal hold") may be applied to preserve the evidence.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '10. Conformité' : '10. Compliance'}</h2>
      <p>
        {lang === 'fr' ? (
          <>CloseOS Sign s'inscrit dans le cadre du règlement (UE) n° 910/2014 (« eIDAS ») pour la signature électronique et du
          RGPD pour la protection des données. Voir la <a href="/sign/confidentialite">Politique de confidentialité</a> et les
          <a href="/sign/cgv"> CGV &amp; CGU</a>.</>
        ) : (
          <>CloseOS Sign operates within the framework of Regulation (EU) No 910/2014 ("eIDAS") for electronic signatures and the
          GDPR for data protection. See the <a href="/sign/confidentialite">Privacy Policy</a> and the
          <a href="/sign/cgv"> Terms of Sale &amp; Use</a>.</>
        )}
      </p>
    </SignLegalShell>
  );
}
