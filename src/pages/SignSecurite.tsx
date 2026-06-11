import { useEffect } from 'react';
import { SignLegalShell } from '../components/SignLegalShell';

export default function SignSecurite() {
  useEffect(() => { document.title = 'Sécurité technique | CloseOS Sign'; }, []);
  return (
    <SignLegalShell title="Sécurité technique & valeur probante" updated="11 juin 2026">
      <p>
        Cette page décrit les mesures techniques qui fondent l'intégrité des documents et la force probante des signatures
        réalisées avec CloseOS Sign.
      </p>

      <h2>1. Faisceau de preuves</h2>
      <p>
        Chaque action est consignée dans un <strong>journal d'événements en ajout seul (append-only)</strong>, non modifiable
        depuis l'application : ouverture du document, envoi et vérification du code, consentement explicite, signature,
        paiement, ainsi que l'adresse IP, l'agent utilisateur et l'horodatage. Ce faisceau, recoupé, établit l'imputabilité de
        la signature.
      </p>

      <h2>2. Horodatage</h2>
      <p>
        Tous les événements sont horodatés par le <strong>serveur en temps universel (UTC)</strong>, indépendamment de
        l'horloge du poste du signataire, afin de garantir une chronologie fiable et opposable.
      </p>

      <h2>3. Intégrité du document</h2>
      <p>
        Une empreinte cryptographique <strong>SHA-256</strong> du document présenté est calculée et figée, puis une empreinte
        du document signé final (« scellé ») est générée côté serveur sur les octets effectivement reçus. Toute altération,
        même d'un seul caractère, modifie l'empreinte et devient ainsi détectable.
      </p>

      <h2>4. Certificat de preuve</h2>
      <p>
        À l'issue de la signature, un <strong>certificat de preuve</strong> est généré <strong>une seule fois</strong> puis
        figé (jamais régénéré) : il récapitule les signataires, la chronologie horodatée, les empreintes et les éléments de
        sécurité. Il est conservé dans un stockage privé et reste <strong>vérifiable publiquement</strong> via une page de
        vérification dédiée, sans exposer les données des autres parties.
      </p>

      <h2>5. Vérification d'identité du signataire</h2>
      <p>
        Selon la configuration du contrat, le signataire confirme son identité par un <strong>code à usage unique</strong>
        (email et/ou SMS) adressé à une coordonnée préalablement autorisée (liste blanche). Le dispositif intègre une
        protection anti-force brute (limitation des tentatives et blocage), tracée dans le faisceau de preuves.
      </p>

      <h2>6. Cloisonnement et contrôle d'accès</h2>
      <p>
        Les données sont <strong>isolées par compte</strong> au niveau de la base (politiques de sécurité au niveau des lignes,
        « Row Level Security ») : aucun accès anonyme direct aux données sensibles n'est possible. Les accès des signataires et
        des espaces d'équipe passent par des fonctions serveur autorisées par jeton, strictement cloisonnées.
      </p>

      <h2>7. Authentification du propriétaire</h2>
      <p>
        L'accès au compte propriétaire est protégé par mot de passe et par une <strong>vérification d'appareil</strong> (code
        envoyé par email à chaque nouvel appareil, appareil de confiance mémorisé temporairement, alerte de nouvelle
        connexion).
      </p>

      <h2>8. Chiffrement et hébergement</h2>
      <p>
        Les échanges sont chiffrés en transit (TLS) et les données chiffrées au repos. L'hébergement de la base et du stockage
        est situé dans l'<strong>Union européenne</strong>. Les secrets et clés de paiement sont conservés côté serveur
        uniquement, jamais exposés au navigateur.
      </p>

      <h2>9. Conservation et legal hold</h2>
      <p>
        Les documents signés, certificats et journaux de preuve sont conservés <strong>au minimum 5 ans</strong>. En cas de
        litige, une conservation prolongée (« legal hold ») peut être appliquée pour préserver les éléments de preuve.
      </p>

      <h2>10. Conformité</h2>
      <p>
        CloseOS Sign s'inscrit dans le cadre du règlement (UE) n° 910/2014 (« eIDAS ») pour la signature électronique et du
        RGPD pour la protection des données. Voir la <a href="/sign/confidentialite">Politique de confidentialité</a> et les
        <a href="/sign/cgv"> CGV &amp; CGU</a>.
      </p>
    </SignLegalShell>
  );
}
