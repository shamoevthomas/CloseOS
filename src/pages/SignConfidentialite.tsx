import { useEffect } from 'react';
import { SignLegalShell } from '../components/SignLegalShell';
import { useSignLang } from '../contexts/SignLangContext';

export default function SignConfidentialite() {
  const { lang } = useSignLang();
  useEffect(() => { document.title = lang === 'fr' ? 'Politique de confidentialité | CloseOS Sign' : 'Privacy Policy | CloseOS Sign'; }, [lang]);
  return (
    <SignLegalShell
      title={lang === 'fr' ? 'Politique de confidentialité' : 'Privacy Policy'}
      updated={lang === 'fr' ? '29 juillet 2026' : 'July 29, 2026'}
    >
      <p>
        {lang === 'fr' ? (
          <>La présente politique décrit comment CloseOS Sign traite les données personnelles, dans le respect du Règlement
          général sur la protection des données (RGPD) et de la loi « Informatique et Libertés ».</>
        ) : (
          <>This policy describes how CloseOS Sign processes personal data, in compliance with the General Data Protection
          Regulation (GDPR) and the French Data Protection Act ("Informatique et Libertés").</>
        )}
      </p>

      <h2>{lang === 'fr' ? '1. Responsable du traitement' : '1. Data controller'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Thomas Shamoev, entreprise individuelle exerçant sous le nom commercial CloseOS Technologies (SIREN 993 427 509),
          éditeur de CloseOS Sign. Contact :
          <a href="mailto:support@closeos.fr"> support@closeos.fr</a>.</>
        ) : (
          <>Thomas Shamoev, a sole proprietorship trading as CloseOS Technologies (SIREN 993 427 509), publisher of CloseOS Sign.
          Contact:
          <a href="mailto:support@closeos.fr"> support@closeos.fr</a>.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '2. Données collectées' : '2. Data collected'}</h2>
      <h3>{lang === 'fr' ? '2.1 Utilisateur (titulaire du compte)' : '2.1 User (account holder)'}</h3>
      <ul>
        {lang === 'fr' ? (
          <>
            <li>Identité et coordonnées : nom, email, téléphone, société, informations d'entreprise (SIRET, TVA…).</li>
            <li>Données de compte et de connexion : identifiants, journaux de connexion, appareils de confiance (empreinte d'appareil mémorisée jusqu'à 7 jours pour la 2FA à la connexion).</li>
            <li>Données de facturation gérées par Stripe (le Prestataire ne stocke pas le numéro de carte).</li>
            <li>Le cas échéant, données issues du dossier « CRM CloseOS » synchronisé depuis un compte CloseOS Business (clients et équipe) pour préremplir les contrats, sous le contrôle de l'Utilisateur.</li>
          </>
        ) : (
          <>
            <li>Identity and contact details: name, email, phone, company, business information (SIRET, VAT, etc.).</li>
            <li>Account and login data: credentials, login logs, trusted devices (device fingerprint stored for up to 7 days for login 2FA).</li>
            <li>Billing data managed by Stripe (the Provider does not store card numbers).</li>
            <li>Where applicable, data from the "CloseOS CRM" folder synchronized from a CloseOS Business account (clients and team) to pre-fill contracts, under the User's control.</li>
          </>
        )}
      </ul>
      <h3>{lang === 'fr' ? '2.2 Signataires' : '2.2 Signers'}</h3>
      <ul>
        {lang === 'fr' ? (
          <>
            <li>Nom, email et/ou téléphone fournis pour la signature.</li>
            <li>Données de preuve : adresse IP, agent utilisateur, horodatage des événements, coordonnées de vérification, consentement.</li>
            <li>Contenu du document signé et valeurs des champs renseignés.</li>
          </>
        ) : (
          <>
            <li>Name, email and/or phone provided for signing.</li>
            <li>Evidence data: IP address, user agent, event timestamps, verification contact details, consent.</li>
            <li>Content of the signed document and the values entered in its fields.</li>
          </>
        )}
      </ul>

      <h2>{lang === 'fr' ? '3. Finalités et bases légales' : '3. Purposes and legal bases'}</h2>
      <ul>
        {lang === 'fr' ? (
          <>
            <li><strong>Fourniture du service</strong> (signature, encaissement) — exécution du contrat.</li>
            <li><strong>Constitution et conservation de la preuve</strong> — intérêt légitime et obligation légale.</li>
            <li><strong>Sécurité et prévention de la fraude</strong> (vérification d'identité, anti-brute-force) — intérêt légitime.</li>
            <li><strong>Facturation et obligations comptables</strong> — obligation légale.</li>
          </>
        ) : (
          <>
            <li><strong>Provision of the service</strong> (signing, payment collection) — performance of the contract.</li>
            <li><strong>Establishing and retaining evidence</strong> — legitimate interest and legal obligation.</li>
            <li><strong>Security and fraud prevention</strong> (identity verification, anti-brute-force) — legitimate interest.</li>
            <li><strong>Billing and accounting obligations</strong> — legal obligation.</li>
          </>
        )}
      </ul>

      <h2>{lang === 'fr' ? '4. Sous-traitants et destinataires' : '4. Processors and recipients'}</h2>
      <p>{lang === 'fr' ? 'Les données sont traitées par des sous-traitants engagés contractuellement à un niveau de protection conforme :' : 'Data is processed by subprocessors contractually bound to a compliant level of protection:'}</p>
      <table>
        <thead><tr>
          <th>{lang === 'fr' ? 'Sous-traitant' : 'Subprocessor'}</th>
          <th>{lang === 'fr' ? 'Finalité' : 'Purpose'}</th>
          <th>{lang === 'fr' ? 'Localisation' : 'Location'}</th>
        </tr></thead>
        <tbody>
          <tr><td>Supabase</td><td>{lang === 'fr' ? 'Hébergement base de données & stockage' : 'Database hosting & storage'}</td><td>{lang === 'fr' ? 'Union européenne' : 'European Union'}</td></tr>
          <tr><td>Vercel</td><td>{lang === 'fr' ? 'Hébergement applicatif' : 'Application hosting'}</td><td>{lang === 'fr' ? 'UE / international (clauses contractuelles types)' : 'EU / international (standard contractual clauses)'}</td></tr>
          <tr><td>Stripe</td><td>{lang === 'fr' ? 'Paiement et encaissement' : 'Payment and payment collection'}</td><td>{lang === 'fr' ? 'UE / international (CCT)' : 'EU / international (SCC)'}</td></tr>
          <tr><td>Brevo</td><td>{lang === 'fr' ? 'Envoi des emails (codes, notifications)' : 'Email delivery (codes, notifications)'}</td><td>{lang === 'fr' ? 'Union européenne' : 'European Union'}</td></tr>
          <tr><td>ClickSend</td><td>{lang === 'fr' ? 'Envoi des SMS de vérification' : 'Verification SMS delivery'}</td><td>{lang === 'fr' ? 'International (CCT)' : 'International (SCC)'}</td></tr>
          <tr><td>Anthropic / OpenAI</td><td>{lang === 'fr' ? 'Assistant IA via serveur MCP — uniquement si l\'Utilisateur l\'active' : 'AI assistant via MCP server — only if enabled by the User'}</td><td>{lang === 'fr' ? 'International (CCT)' : 'International (SCC)'}</td></tr>
        </tbody>
      </table>
      <p>{lang === 'fr' ? 'Le recours à un assistant IA (via le serveur MCP CloseOS Sign) n\'a lieu que si l\'Utilisateur le connecte ; les données transmises se limitent alors à ce qui est nécessaire à sa requête. Aucune donnée n\'est vendue ni cédée à des fins publicitaires.' : 'The use of an AI assistant (via the CloseOS Sign MCP server) only occurs if the User connects it; the data transmitted is then limited to what is necessary for their request. No data is sold or transferred for advertising purposes.'}</p>

      <h2>{lang === 'fr' ? '5. Durée de conservation' : '5. Retention period'}</h2>
      <ul>
        {lang === 'fr' ? (
          <>
            <li>Données de compte : pendant la durée de l'abonnement, puis archivage légal.</li>
            <li>Documents signés, certificats et faisceau de preuves : <strong>5 ans</strong> minimum, prolongé en cas de litige (legal hold).</li>
            <li>Codes de vérification : éphémères (quelques minutes), purgés automatiquement.</li>
          </>
        ) : (
          <>
            <li>Account data: for the duration of the subscription, then legal archiving.</li>
            <li>Signed documents, certificates and evidence bundle: <strong>5 years</strong> minimum, extended in the event of a dispute (legal hold).</li>
            <li>Verification codes: ephemeral (a few minutes), automatically purged.</li>
          </>
        )}
      </ul>

      <h2>{lang === 'fr' ? '6. Sécurité' : '6. Security'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Chiffrement des échanges (TLS) et des données au repos, isolation stricte des données par compte, accès serveur
          restreint, journal d'événements inaltérable. Le détail figure dans la page <a href="/sign/securite">Sécurité
          technique</a>.</>
        ) : (
          <>Encryption of communications (TLS) and of data at rest, strict per-account data isolation, restricted server access,
          tamper-proof event log. Details are provided on the <a href="/sign/securite">Technical Security</a> page.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '7. Vos droits' : '7. Your rights'}</h2>
      <p>
        {lang === 'fr' ? (
          <>Conformément au RGPD, vous disposez des droits d'accès, de rectification, d'effacement, de limitation, de portabilité
          et d'opposition. Le droit à l'effacement s'exerce sous réserve des obligations de conservation de la preuve et des
          obligations légales. Pour exercer vos droits : <a href="mailto:support@closeos.fr">support@closeos.fr</a>. Vous pouvez
          introduire une réclamation auprès de la CNIL.</>
        ) : (
          <>In accordance with the GDPR, you have the rights of access, rectification, erasure, restriction, portability and
          objection. The right to erasure is exercised subject to evidence-retention obligations and legal obligations. To
          exercise your rights: <a href="mailto:support@closeos.fr">support@closeos.fr</a>. You may lodge a complaint with the
          CNIL (the French data protection authority).</>
        )}
      </p>

      <h2>{lang === 'fr' ? '8. Cookies' : '8. Cookies'}</h2>
      <p>
        {lang === 'fr' ? (
          <>CloseOS Sign n'utilise que des cookies/stockages strictement nécessaires au fonctionnement (session, authentification,
          appareil de confiance). Aucun cookie publicitaire ou de pistage tiers n'est déposé.</>
        ) : (
          <>CloseOS Sign uses only cookies/storage strictly necessary for operation (session, authentication, trusted device).
          No advertising or third-party tracking cookies are set.</>
        )}
      </p>

      <h2>{lang === 'fr' ? '9. Contact' : '9. Contact'}</h2>
      <p>{lang === 'fr' ? <>Pour toute question relative à cette politique : <a href="mailto:support@closeos.fr">support@closeos.fr</a>.</> : <>For any question relating to this policy: <a href="mailto:support@closeos.fr">support@closeos.fr</a>.</>}</p>
    </SignLegalShell>
  );
}
