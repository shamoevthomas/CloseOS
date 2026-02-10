import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">
      {/* Header simple */}
      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour à l'accueil</span>
          </Link>
          <span className="font-bold text-white">Confidentialité</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Politique de Confidentialité</h1>
        <p className="text-slate-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-sm leading-relaxed text-justify">
          
          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Responsable du Traitement</h2>
            <p>
              Le responsable du traitement des données est <strong>Thomas Shamoev</strong> (CloseOS), Entrepreneur Individuel, domicilié au 4 Rue des Coquelicots, 68120 Pfastatt, France.
            </p>
            <p className="mt-2">
              Pour toute question relative à vos données, vous pouvez nous contacter à : <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Les Données que nous collectons</h2>
            <p>Dans le cadre de l'utilisation de CloseOS, nous sommes amenés à collecter les catégories de données suivantes :</p>
            
            <ul className="list-disc pl-5 space-y-2 mt-4">
              <li>
                <strong>Données de Compte (Vous) :</strong> Nom, Prénom, Email, Numéro de téléphone, Adresse IP, Logs de connexion.
              </li>
              <li>
                <strong>Données CRM (Vos Prospects) :</strong> Nom, Prénom, Email, Téléphone et <em>Notes personnelles</em> prises lors de vos appels.
              </li>
              <li>
                <strong>Données Partenaires (Vos Clients/Infopreneurs) :</strong> Nom, Prénom, Email, Téléphone des infopreneurs avec lesquels vous travaillez.
              </li>
              <li>
                <strong>Données de Facturation & Bancaires :</strong> Pour générer vos factures automatiquement, nous traitons : Nom de la Banque, IBAN, BIC, Numéro SIRET (du Closer et de l'Infopreneur), ainsi que les adresses postales respectives.
              </li>
              <li>
                <strong>Données de Paiement (Abonnement CloseOS) :</strong> Les 4 derniers chiffres de votre carte bancaire et la date d'expiration (gérés de manière sécurisée par Stripe).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Pourquoi collectons-nous ces données ?</h2>
            <p>Vos données sont utilisées exclusivement pour :</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Fournir le Service :</strong> Gestion du pipeline, appels VoIP, agenda.</li>
              <li><strong>Automatisation :</strong> Génération automatique de vos factures de commissions grâce à vos coordonnées bancaires (IBAN/BIC) et celles de vos clients.</li>
              <li><strong>Facturation :</strong> Gestion de votre abonnement CloseOS.</li>
              <li><strong>Amélioration :</strong> Analyse des erreurs et optimisation des performances (Analytics).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Partage des Données (Sous-traitants)</h2>
            <p>
              Nous ne vendons <strong>jamais</strong> vos données. Elles sont uniquement transmises à nos prestataires techniques indispensables au fonctionnement du service :
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Hébergement & Base de données :</strong> Vercel & Supabase (Infrastructure sécurisée).</li>
              <li><strong>Nom de domaine & Emails :</strong> Ionos (Gestion du domaine et messagerie).</li>
              <li><strong>Paiement :</strong> Stripe (Gestion des abonnements).</li>
              <li><strong>Téléphonie (VoIP) :</strong> Twilio (Acheminement des appels et SMS).</li>
              <li><strong>Emails Transactionnels :</strong> Resend/Supabase (Envoi des notifications).</li>
              <li><strong>Analytics :</strong> Google Analytics (Mesure d'audience anonymisée).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">5. Sécurité des Données</h2>
            <p>
              La sécurité est notre priorité. Toutes les communications avec CloseOS sont chiffrées (HTTPS/TLS). Vos mots de passe sont hachés et illisibles. Les données bancaires sensibles (IBAN/BIC) sont stockées dans une base de données sécurisée avec des accès restreints.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">6. Durée de Conservation</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Compte actif :</strong> Vos données sont conservées tant que votre abonnement est actif.</li>
              <li><strong>Après résiliation :</strong> Vos données CRM sont conservées 3 mois pour vous permettre de les récupérer si vous changez d'avis, puis supprimées définitivement.</li>
              <li><strong>Factures :</strong> Les pièces comptables sont conservées 10 ans conformément à la loi française.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">7. Vos Droits (RGPD)</h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données.
            </p>
            <p className="mt-2">
              Pour exercer ces droits ou demander la suppression intégrale de votre compte, contactez-nous simplement à : <strong className="text-white">support@closeos.fr</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">8. Cookies</h2>
            <p>
              Nous utilisons des cookies pour le fonctionnement du site (session) et pour l'analyse d'audience (Google Analytics). Vous pouvez gérer vos préférences via le bandeau de cookies ou les paramètres de votre navigateur.
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