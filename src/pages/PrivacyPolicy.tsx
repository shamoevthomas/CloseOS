import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">
      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour a l'accueil</span>
          </Link>
          <span className="font-bold text-white">Confidentialite</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Politique de Confidentialite</h1>
        <p className="text-slate-500 mb-8">Derniere mise a jour : 25 mars 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-justify">

          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Responsable du Traitement</h2>
            <p>
              Le responsable du traitement des donnees est <strong>Thomas Shamoev</strong> (CloseOS), Entrepreneur Individuel, domicilie au 4 Rue des Coquelicots, 68120 Pfastatt, France.
            </p>
            <p className="mt-2">
              La presente politique s'applique a l'ensemble de l'ecosysteme CloseOS : <strong>CloseOS Sales</strong> et <strong>CloseOS Business</strong>.
            </p>
            <p className="mt-2">
              Pour toute question relative a vos donnees, vous pouvez nous contacter a : <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Les Donnees que nous collectons</h2>
            <p>Dans le cadre de l'utilisation de CloseOS, nous sommes amenes a collecter les categories de donnees suivantes :</p>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">2.1 Donnees communes (Sales & Business)</h3>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Donnees de Compte :</strong> Nom, prenom, email, mot de passe (hashe), photo de profil, adresse IP, logs de connexion.
              </li>
              <li>
                <strong>Donnees CRM (Prospects) :</strong> Nom, prenom, email, telephone, entreprise, titre, stade du pipeline, valeur du deal, type de paiement, notes d'appel, tags, motif de perte.
              </li>
              <li>
                <strong>Donnees de Rendez-vous :</strong> Date, heure, duree, fuseau horaire, statut, lien Google Meet, notes.
              </li>
              <li>
                <strong>Donnees de Paiement (Abonnement) :</strong> Les 4 derniers chiffres de votre carte bancaire et la date d'expiration (geres de maniere securisee par Stripe).
              </li>
              <li>
                <strong>Identifiants CRM tiers :</strong> Tokens OAuth et identifiants de synchronisation pour HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io.
              </li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">2.2 Donnees specifiques a CloseOS Sales</h3>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Donnees de Contacts Internes :</strong> Nom, prenom, email, telephone des infopreneurs et partenaires avec lesquels le closer travaille.
              </li>
              <li>
                <strong>Donnees de Facturation & Bancaires :</strong> Nom de la banque, IBAN, BIC, numero SIRET (du closer et de l'infopreneur), adresses postales — pour la generation automatique de factures.
              </li>
              <li>
                <strong>Donnees d'Appels :</strong> Historique des appels (duree, contact, date, statut), scripts d'appel.
              </li>
              <li>
                <strong>Donnees de Booking (Cal.com) :</strong> Types d'evenements, disponibilites, reservations synchronisees.
              </li>
              <li>
                <strong>Messages :</strong> Conversations internes entre le closer et ses contacts.
              </li>
              <li>
                <strong>Stripe Connect :</strong> Identifiant de compte Stripe connecte pour recevoir des paiements.
              </li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">2.3 Donnees specifiques a CloseOS Business</h3>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Donnees des Membres d'Equipe :</strong> Nom, prenom, email, telephone, date de naissance, role, equipe, fuseau horaire.
              </li>
              <li>
                <strong>Donnees de Remuneration :</strong> Type de compensation, salaire fixe, taux de commission, jour de paiement.
              </li>
              <li>
                <strong>Donnees de Presence :</strong> Statut en ligne (heartbeat), historique de connexion/deconnexion.
              </li>
              <li>
                <strong>Donnees de Campagnes :</strong> Nom, source (Instagram, LinkedIn, ADS, Organic), parametres UTM, champs personnalises des formulaires de capture.
              </li>
              <li>
                <strong>Donnees de Capture (Prospects) :</strong> Email, telephone (multi-pays), champs personnalises, creneau de rendez-vous selectionne, fuseau horaire du prospect.
              </li>
              <li>
                <strong>Empreintes d'Appareil :</strong> Identifiant unique + user-agent pour la verification de securite.
              </li>
              <li>
                <strong>Donnees d'Onboarding :</strong> Contenus de formation (textes, videos, liens, PDFs) crees par le proprietaire.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Pourquoi collectons-nous ces donnees ?</h2>
            <p>Vos donnees sont utilisees exclusivement pour :</p>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900">
                    <th className="px-4 py-3 text-left font-bold text-white">Finalite</th>
                    <th className="px-4 py-3 text-left font-bold text-white">Base legale</th>
                    <th className="px-4 py-3 text-left font-bold text-white">Service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-400">
                  <tr><td className="px-4 py-2">Gestion du compte et authentification</td><td className="px-4 py-2">Execution du contrat</td><td className="px-4 py-2">Sales & Business</td></tr>
                  <tr><td className="px-4 py-2">Gestion du CRM et pipeline</td><td className="px-4 py-2">Execution du contrat</td><td className="px-4 py-2">Sales & Business</td></tr>
                  <tr><td className="px-4 py-2">Planification et rappels de rendez-vous</td><td className="px-4 py-2">Execution du contrat</td><td className="px-4 py-2">Sales & Business</td></tr>
                  <tr><td className="px-4 py-2">Generation automatique de factures</td><td className="px-4 py-2">Obligation legale / contrat</td><td className="px-4 py-2">Sales & Business</td></tr>
                  <tr><td className="px-4 py-2">Telephonie VoIP et enregistrement d'appels</td><td className="px-4 py-2">Execution du contrat</td><td className="px-4 py-2">Sales</td></tr>
                  <tr><td className="px-4 py-2">Gestion d'equipe et remuneration</td><td className="px-4 py-2">Execution du contrat</td><td className="px-4 py-2">Business</td></tr>
                  <tr><td className="px-4 py-2">Campagnes d'acquisition et capture</td><td className="px-4 py-2">Interet legitime</td><td className="px-4 py-2">Business</td></tr>
                  <tr><td className="px-4 py-2">Rapports de performance et KPIs</td><td className="px-4 py-2">Interet legitime</td><td className="px-4 py-2">Sales & Business</td></tr>
                  <tr><td className="px-4 py-2">Synchronisation CRM tiers</td><td className="px-4 py-2">Consentement</td><td className="px-4 py-2">Sales & Business</td></tr>
                  <tr><td className="px-4 py-2">Verification de securite des appareils</td><td className="px-4 py-2">Interet legitime (securite)</td><td className="px-4 py-2">Business</td></tr>
                  <tr><td className="px-4 py-2">Facturation de l'abonnement CloseOS</td><td className="px-4 py-2">Execution du contrat</td><td className="px-4 py-2">Sales & Business</td></tr>
                  <tr><td className="px-4 py-2">Amelioration du service et analyse d'erreurs</td><td className="px-4 py-2">Interet legitime</td><td className="px-4 py-2">Sales & Business</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Partage des Donnees (Sous-traitants)</h2>
            <p>
              Nous ne vendons <strong>jamais</strong> vos donnees. Elles sont uniquement transmises a nos prestataires techniques indispensables au fonctionnement des services :
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Hebergement & Base de donnees :</strong> Vercel & Supabase (Infrastructure securisee).</li>
              <li><strong>Paiement :</strong> Stripe (Gestion des abonnements et paiements).</li>
              <li><strong>Emails Transactionnels :</strong> Brevo (Rappels de rendez-vous, verification, factures, rapports). Expediteur : support@closeos.fr.</li>
              <li><strong>Telephonie (VoIP) :</strong> Twilio (Acheminement des appels et SMS — CloseOS Sales).</li>
              <li><strong>Calendrier :</strong> Google Calendar API (Synchronisation d'evenements — Sales & Business), Cal.com (Booking — Sales).</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">Integrations tierces (a l'initiative de l'Utilisateur)</h3>
            <p>
              Si l'Utilisateur connecte des services tiers, les donnees sont partagees selon la configuration choisie :
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li>HubSpot — synchronisation contacts/deals</li>
              <li>Pipedrive — synchronisation deals/personnes</li>
              <li>GoHighLevel — synchronisation contacts/opportunites</li>
              <li>Airtable — synchronisation d'enregistrements</li>
              <li>Systeme.io — synchronisation par tags</li>
              <li>iClosed — import de donnees par webhook</li>
              <li>Zapier — automatisations personnalisees (Business)</li>
            </ul>
            <p className="mt-2">
              L'Utilisateur est seul responsable de la conformite de ces integrations avec le RGPD et les conditions d'utilisation des services tiers concernes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">5. Traitements Automatises</h2>
            <p>Les services executent les traitements automatises suivants :</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Rappels de rendez-vous</strong> (Business) — Emails automatiques aux prospects a des intervalles configurables (24h, 10h, 5h, 3h, 1h, 30min, 15min avant le rendez-vous).</li>
              <li><strong>Generation de factures</strong> (Sales & Business) — Creation automatique mensuelle selon la configuration de l'Utilisateur.</li>
              <li><strong>Rapports hebdomadaires</strong> (Business) — Agregation des metriques et envoi par email.</li>
              <li><strong>Attribution de rendez-vous</strong> (Business) — Algorithme round-robin ou aleatoire pour assigner les prospects aux membres d'equipe.</li>
              <li><strong>Nettoyage de donnees</strong> — Traitement automatise des demandes de suppression de compte.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">6. Securite des Donnees</h2>
            <p>
              La securite est notre priorite. Nous mettons en oeuvre les mesures suivantes :
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li>Communications chiffrees via HTTPS/TLS</li>
              <li>Mots de passe hashes et illisibles</li>
              <li>Verification des appareils par code a usage unique (Business)</li>
              <li>Controle d'acces base sur les roles (Row Level Security)</li>
              <li>Isolation des donnees par compte utilisateur</li>
              <li>Jetons OAuth stockes de maniere securisee avec rafraichissement automatique</li>
              <li>Verification en deux etapes pour les changements d'email</li>
              <li>Donnees bancaires sensibles (IBAN/BIC) stockees avec acces restreints</li>
              <li>Donnees de paiement (carte bancaire) gerees exclusivement par Stripe — jamais stockees sur nos serveurs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">7. Duree de Conservation</h2>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900">
                    <th className="px-4 py-3 text-left font-bold text-white">Type de donnees</th>
                    <th className="px-4 py-3 text-left font-bold text-white">Duree de conservation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-400">
                  <tr><td className="px-4 py-2">Compte actif</td><td className="px-4 py-2">Tant que l'abonnement est actif</td></tr>
                  <tr><td className="px-4 py-2">Donnees CRM (apres resiliation)</td><td className="px-4 py-2">3 mois (recuperation possible), puis suppression definitive</td></tr>
                  <tr><td className="px-4 py-2">Donnees d'equipe (Business)</td><td className="px-4 py-2">Jusqu'a suppression par le proprietaire ou du compte</td></tr>
                  <tr><td className="px-4 py-2">Historique de rendez-vous</td><td className="px-4 py-2">Jusqu'a suppression par l'Utilisateur</td></tr>
                  <tr><td className="px-4 py-2">Historique d'appels (Sales)</td><td className="px-4 py-2">Jusqu'a suppression par l'Utilisateur</td></tr>
                  <tr><td className="px-4 py-2">Jetons d'appareil (Business)</td><td className="px-4 py-2">Duree de la session</td></tr>
                  <tr><td className="px-4 py-2">Jetons OAuth (Google, CRM tiers)</td><td className="px-4 py-2">Jusqu'a revocation ou suppression du compte</td></tr>
                  <tr><td className="px-4 py-2">Factures et pieces comptables</td><td className="px-4 py-2">10 ans (obligation legale francaise)</td></tr>
                  <tr><td className="px-4 py-2">Logs de connexion</td><td className="px-4 py-2">Selon politique de retention interne</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">8. Vos Droits (RGPD)</h2>
            <p>
              Conformement au Reglement General sur la Protection des Donnees, vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li><strong className="text-slate-300">Droit d'acces</strong> — Obtenir une copie de vos donnees personnelles</li>
              <li><strong className="text-slate-300">Droit de rectification</strong> — Corriger des donnees inexactes ou incompletes</li>
              <li><strong className="text-slate-300">Droit de suppression</strong> — Demander l'effacement de vos donnees</li>
              <li><strong className="text-slate-300">Droit a la portabilite</strong> — Recevoir vos donnees dans un format structure et reutilisable</li>
              <li><strong className="text-slate-300">Droit d'opposition</strong> — Vous opposer au traitement de vos donnees pour des motifs legitimes</li>
              <li><strong className="text-slate-300">Droit a la limitation</strong> — Demander la suspension du traitement dans certains cas</li>
            </ul>
            <p className="mt-4">
              Pour exercer ces droits ou demander la suppression integrale de votre compte, contactez-nous a : <strong className="text-white">support@closeos.fr</strong>.
            </p>
            <p className="mt-2">
              Vous disposez egalement du droit d'introduire une reclamation aupres de la CNIL (Commission Nationale de l'Informatique et des Libertes) : <span className="text-slate-400">www.cnil.fr</span>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">9. Roles de traitement</h2>
            <p>
              <strong>Pour les donnees de l'Utilisateur</strong> (compte, facturation, connexion) : CloseOS est <strong className="text-white">responsable de traitement</strong>.
            </p>
            <p className="mt-2">
              <strong>Pour les donnees des tiers</strong> (prospects CRM, membres d'equipe) importees ou collectees par l'Utilisateur : CloseOS agit en tant que <strong className="text-white">sous-traitant</strong>. L'Utilisateur est responsable de traitement et doit s'assurer de la conformite de sa collecte (consentement, information des personnes, base legale).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">10. Cookies</h2>
            <p>
              Nous utilisons des cookies strictement necessaires au fonctionnement du site (session d'authentification, preferences). Aucun cookie publicitaire n'est utilise. Vous pouvez gerer vos preferences via les parametres de votre navigateur.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-xs">
          <p>Fin du document — Politique de Confidentialite CloseOS (Sales & Business)</p>
        </div>
      </main>
    </div>
  );
};
