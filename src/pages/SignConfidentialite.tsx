import { useEffect } from 'react';
import { SignLegalShell } from '../components/SignLegalShell';

export default function SignConfidentialite() {
  useEffect(() => { document.title = 'Politique de confidentialité | CloseOS Sign'; }, []);
  return (
    <SignLegalShell title="Politique de confidentialité" updated="11 juin 2026">
      <p>
        La présente politique décrit comment CloseOS Sign traite les données personnelles, dans le respect du Règlement
        général sur la protection des données (RGPD) et de la loi « Informatique et Libertés ».
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        CloseOS Technologies (SIREN 993 427 509), éditeur de CloseOS Sign. Contact :
        <a href="mailto:support@closeos.fr"> support@closeos.fr</a>.
      </p>

      <h2>2. Données collectées</h2>
      <h3>2.1 Utilisateur (titulaire du compte)</h3>
      <ul>
        <li>Identité et coordonnées : nom, email, téléphone, société, informations d'entreprise (SIRET, TVA…).</li>
        <li>Données de compte et de connexion : identifiants, journaux de connexion, appareils de confiance.</li>
        <li>Données de facturation gérées par Stripe (le Prestataire ne stocke pas le numéro de carte).</li>
      </ul>
      <h3>2.2 Signataires</h3>
      <ul>
        <li>Nom, email et/ou téléphone fournis pour la signature.</li>
        <li>Données de preuve : adresse IP, agent utilisateur, horodatage des événements, coordonnées de vérification, consentement.</li>
        <li>Contenu du document signé et valeurs des champs renseignés.</li>
      </ul>

      <h2>3. Finalités et bases légales</h2>
      <ul>
        <li><strong>Fourniture du service</strong> (signature, encaissement) — exécution du contrat.</li>
        <li><strong>Constitution et conservation de la preuve</strong> — intérêt légitime et obligation légale.</li>
        <li><strong>Sécurité et prévention de la fraude</strong> (vérification d'identité, anti-brute-force) — intérêt légitime.</li>
        <li><strong>Facturation et obligations comptables</strong> — obligation légale.</li>
      </ul>

      <h2>4. Sous-traitants et destinataires</h2>
      <p>Les données sont traitées par des sous-traitants engagés contractuellement à un niveau de protection conforme :</p>
      <table>
        <thead><tr><th>Sous-traitant</th><th>Finalité</th><th>Localisation</th></tr></thead>
        <tbody>
          <tr><td>Supabase</td><td>Hébergement base de données &amp; stockage</td><td>Union européenne</td></tr>
          <tr><td>Vercel</td><td>Hébergement applicatif</td><td>UE / international (clauses contractuelles types)</td></tr>
          <tr><td>Stripe</td><td>Paiement et encaissement</td><td>UE / international (CCT)</td></tr>
          <tr><td>Brevo</td><td>Envoi des emails (codes, notifications)</td><td>Union européenne</td></tr>
          <tr><td>ClickSend</td><td>Envoi des SMS de vérification</td><td>International (CCT)</td></tr>
        </tbody>
      </table>
      <p>Aucune donnée n'est vendue ni cédée à des fins publicitaires.</p>

      <h2>5. Durée de conservation</h2>
      <ul>
        <li>Données de compte : pendant la durée de l'abonnement, puis archivage légal.</li>
        <li>Documents signés, certificats et faisceau de preuves : <strong>5 ans</strong> minimum, prolongé en cas de litige (legal hold).</li>
        <li>Codes de vérification : éphémères (quelques minutes), purgés automatiquement.</li>
      </ul>

      <h2>6. Sécurité</h2>
      <p>
        Chiffrement des échanges (TLS) et des données au repos, isolation stricte des données par compte, accès serveur
        restreint, journal d'événements inaltérable. Le détail figure dans la page <a href="/sign/securite">Sécurité
        technique</a>.
      </p>

      <h2>7. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez des droits d'accès, de rectification, d'effacement, de limitation, de portabilité
        et d'opposition. Le droit à l'effacement s'exerce sous réserve des obligations de conservation de la preuve et des
        obligations légales. Pour exercer vos droits : <a href="mailto:support@closeos.fr">support@closeos.fr</a>. Vous pouvez
        introduire une réclamation auprès de la CNIL.
      </p>

      <h2>8. Cookies</h2>
      <p>
        CloseOS Sign n'utilise que des cookies/stockages strictement nécessaires au fonctionnement (session, authentification,
        appareil de confiance). Aucun cookie publicitaire ou de pistage tiers n'est déposé.
      </p>

      <h2>9. Contact</h2>
      <p>Pour toute question relative à cette politique : <a href="mailto:support@closeos.fr">support@closeos.fr</a>.</p>
    </SignLegalShell>
  );
}
