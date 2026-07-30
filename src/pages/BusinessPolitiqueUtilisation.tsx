import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const BusinessPolitiqueUtilisation = () => {
  // Page prérendue : ces métas sont figées dans le HTML servi aux moteurs.
  useEffect(() => {
    document.title = "Politique d'utilisation — CloseOS Business";
    document.querySelector('meta[name="description"]')?.setAttribute('content', "La politique d'utilisation de CloseOS Business : usages autorisés, limites et règles de bon usage de la plateforme.");
    document.getElementById('canonical')?.setAttribute('href', 'https://www.closeos.fr/business/politique-utilisation');
    document.getElementById('og-url')?.setAttribute('content', 'https://www.closeos.fr/business/politique-utilisation');
    document.getElementById('og-title')?.setAttribute('content', "Politique d'utilisation — CloseOS Business");
    document.getElementById('og-description')?.setAttribute('content', "La politique d'utilisation de CloseOS Business : usages autorisés, limites et règles de bon usage de la plateforme.");
    document.getElementById('tw-url')?.setAttribute('content', 'https://www.closeos.fr/business/politique-utilisation');
    document.getElementById('tw-title')?.setAttribute('content', "Politique d'utilisation — CloseOS Business");
    document.getElementById('tw-description')?.setAttribute('content', "La politique d'utilisation de CloseOS Business : usages autorisés, limites et règles de bon usage de la plateforme.");
    document.documentElement.lang = 'fr';
  }, []);
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">
      <nav className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/business" className="flex items-center gap-2 group text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour</span>
          </Link>
          <span className="font-bold text-white">Politique d'Utilisation</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Politique d'Utilisation — CloseOS Business</h1>
        <p className="text-slate-500 mb-8">Derniere mise a jour : 29 juillet 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-justify">

          {/* 1. Objet */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Objet</h2>
            <p>
              La presente politique d'utilisation (ci-apres « la Politique ») definit les conditions dans lesquelles les utilisateurs (ci-apres « l'Utilisateur ») peuvent acceder et utiliser la plateforme <strong className="text-white">CloseOS Business</strong> (ci-apres « la Plateforme »), accessible depuis closeos.fr/business.
            </p>
            <p className="mt-2">
              CloseOS Business est une solution SaaS de gestion commerciale B2B permettant aux dirigeants, managers et responsables commerciaux de :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Gerer leur equipe de vente (closers, setters, head of sales)</li>
              <li>Piloter un CRM de prospection</li>
              <li>Creer et gerer des campagnes d'acquisition</li>
              <li>Planifier des rendez-vous avec integration calendrier</li>
              <li>Suivre les performances via des tableaux de bord et KPIs</li>
              <li>Automatiser la facturation et les relances</li>
            </ul>
          </section>

          {/* 2. Acceptation */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. Acceptation des conditions</h2>
            <p>
              En creant un compte ou en accedant a la Plateforme, l'Utilisateur reconnait avoir pris connaissance de la presente Politique et s'engage a la respecter integralement. En cas de desaccord, l'Utilisateur doit cesser immediatement toute utilisation de la Plateforme.
            </p>
          </section>

          {/* 3. Inscription et acces */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Inscription et acces au compte</h2>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">3.1 Creation de compte</h3>
            <p>L'Utilisateur peut creer un compte via :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li><strong className="text-slate-300">Email et mot de passe</strong> — un code de verification a 6 chiffres est envoye par email pour valider l'appareil</li>
              <li><strong className="text-slate-300">Google OAuth</strong> — authentification via compte Google avec consentement explicite</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">3.2 Verification des appareils</h3>
            <p>
              Pour des raisons de securite, chaque nouvel appareil utilise pour se connecter fait l'objet d'une verification par empreinte numerique (identifiant unique + user-agent). Un code de validation est envoye a l'adresse email associee au compte.
            </p>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">3.3 Roles et hierarchie d'acces</h3>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4 text-white font-semibold">Role</th>
                    <th className="py-2 text-white font-semibold">Perimetre d'acces</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 font-medium text-slate-300">Owner (proprietaire)</td>
                    <td className="py-2">Acces complet : CRM, equipe, campagnes, facturation, parametres</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 font-medium text-slate-300">Head of Sales</td>
                    <td className="py-2">Gestion de l'equipe, visibilite sur l'ensemble des donnees commerciales</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 font-medium text-slate-300">Admin</td>
                    <td className="py-2">Administration technique du compte</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">3.4 Invitation d'equipe</h3>
            <p>
              Le proprietaire peut inviter des membres via un lien d'invitation. Chaque membre invite se voit attribuer un role, une equipe et des parametres de remuneration.
            </p>
          </section>

          {/* 4. Donnees collectees */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Donnees collectees et traitees</h2>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">4.1 Donnees de l'Utilisateur (proprietaire/manager)</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Nom complet, adresse email, mot de passe (hashe)</li>
              <li>Photo de profil (optionnelle)</li>
              <li>Informations d'entreprise (nom, branding, logo)</li>
              <li>Jetons d'authentification Google Calendar (stockes chiffres)</li>
              <li>Historique de connexion et statut en ligne</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">4.2 Donnees des membres d'equipe</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Nom, prenom, email, telephone, date de naissance</li>
              <li>Role, equipe assignee, fuseau horaire</li>
              <li>Donnees de remuneration : type de compensation, salaire fixe, taux de commission, jour de paiement</li>
              <li>Disponibilites hebdomadaires et absences</li>
              <li>Contraintes de booking (max appels/jour, delai minimum de reservation)</li>
              <li>Statut en ligne et historique de connexion/deconnexion</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">4.3 Donnees des prospects (CRM)</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Identite : prenom, nom, email, telephone</li>
              <li>Entreprise, poste/titre</li>
              <li>Donnees commerciales : valeur du deal, offre liee, stade du pipeline, probabilite de closing</li>
              <li>Type de paiement (unique, echelonne, comptant)</li>
              <li>Notes d'appel (contenu, date, auteur)</li>
              <li>Motif et details de perte (si applicable)</li>
              <li>Tags personnalises et assignation (closer/setter responsable)</li>
              <li>Identifiants CRM externes (HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io)</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">4.4 Donnees de rendez-vous</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Date, heure, duree, fuseau horaire</li>
              <li>Statut (en attente, confirme, annule, realise)</li>
              <li>Lien Google Meet (genere automatiquement)</li>
              <li>Notes et campagne d'origine</li>
              <li>Liens de reprogrammation/annulation</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">4.5 Donnees de campagnes</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Nom, description, source (Instagram, LinkedIn, ADS, Organic)</li>
              <li>Parametres UTM (source, medium, campaign)</li>
              <li>Champs personnalises du formulaire de capture</li>
              <li>Configuration du booking (duree, mode de distribution)</li>
              <li>Page de capture personnalisee (titre, description, video)</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">4.6 Donnees collectees via les formulaires et pages de capture</h3>
            <p>Lorsqu'un prospect remplit un formulaire ou une page de capture cree par l'Utilisateur :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Email (requis ou optionnel selon la campagne)</li>
              <li>Telephone (avec formatage multi-pays : FR, BE, CH, US, UK, DE, ES, IT, etc.)</li>
              <li>Champs personnalises et reponses aux formulaires (candidature, sondage, brief)</li>
              <li>Creneau de rendez-vous selectionne (si applicable)</li>
              <li>Fuseau horaire du prospect</li>
              <li><strong className="text-slate-300">Precapture :</strong> des qu'un email ou un telephone est saisi, ces coordonnees et les reponses deja renseignees sont enregistrees <strong>meme si le formulaire n'est pas soumis jusqu'au bout</strong>.</li>
              <li><strong className="text-slate-300">Visionnage video :</strong> pour les blocs video a visionnage obligatoire, la duree de visionnage est mesuree pour conditionner la validation.</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">4.7 Donnees des liens de tracking (/t/)</h3>
            <p>Lorsque l'Utilisateur cree un lien de tracking, chaque clic collecte :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Adresse IP et type d'appareil</li>
              <li>Pays approximatif</li>
              <li>Caractere de visiteur unique ou recurrent, nombre de clics</li>
            </ul>
          </section>

          {/* 5. Utilisation des donnees */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">5. Utilisation des donnees et finalites</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4 text-white font-semibold">Finalite</th>
                    <th className="py-2 text-white font-semibold">Base legale</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Gestion du compte et authentification</td><td className="py-2">Execution du contrat</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Gestion du CRM et suivi commercial</td><td className="py-2">Interet legitime de l'Utilisateur</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Planification et rappel de rendez-vous</td><td className="py-2">Execution du contrat</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Generation automatique de factures</td><td className="py-2">Obligation legale / contrat</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Envoi de rappels par email</td><td className="py-2">Interet legitime</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Relances automatiques et suivi de discussion (emails aux prospects)</td><td className="py-2">Interet legitime</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Formulaires, capture et precapture de leads</td><td className="py-2">Interet legitime</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Liens de tracking et mesure d'audience</td><td className="py-2">Interet legitime</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Pilotage par API / serveur MCP (assistants IA)</td><td className="py-2">Execution du contrat (a l'initiative de l'Utilisateur)</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Synchronisation avec CRM tiers</td><td className="py-2">Consentement de l'Utilisateur</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Rapports hebdomadaires de performance</td><td className="py-2">Interet legitime</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Verification de securite des appareils</td><td className="py-2">Interet legitime (securite)</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. Integrations tierces */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">6. Integrations tierces</h2>
            <p>L'Utilisateur peut, a sa seule initiative, connecter les services tiers suivants :</p>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">6.1 Google Calendar</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Creation automatique d'evenements avec lien Google Meet</li>
              <li>Consultation des creneaux disponibles</li>
              <li>Stockage securise des jetons OAuth (avec rafraichissement automatique)</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">6.2 CRM externes</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li><strong className="text-slate-300">HubSpot</strong> — synchronisation bidirectionnelle contacts/deals</li>
              <li><strong className="text-slate-300">Pipedrive</strong> — synchronisation deals/personnes, mapping de pipelines</li>
              <li><strong className="text-slate-300">GoHighLevel (GHL)</strong> — synchronisation contacts/opportunites</li>
              <li><strong className="text-slate-300">Airtable</strong> — synchronisation d'enregistrements via OAuth</li>
              <li><strong className="text-slate-300">Systeme.io</strong> — synchronisation par tags</li>
            </ul>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">6.3 Services de paiement</h3>
            <p><strong className="text-slate-300">Stripe</strong> — traitement des paiements d'abonnement, codes promotionnels et parrainage.</p>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">6.4 Services de communication</h3>
            <p><strong className="text-slate-300">Brevo</strong> — envoi d'emails transactionnels (rappels, verification, factures, rapports). Expediteur : <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a>.</p>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">6.5 Automatisations</h3>
            <p><strong className="text-slate-300">Zapier</strong> — webhooks pour automatisations personnalisees.</p>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">6.6 API, Webhooks & serveur MCP (assistants IA)</h3>
            <p>
              CloseOS Business expose une API REST, des Webhooks sortants et un serveur MCP (Model Context Protocol). Si l'Utilisateur genere une cle API et connecte un <strong>assistant IA tiers</strong>, les donnees concernees (prospects, rendez-vous, campagnes, formulaires, facturation) peuvent etre transmises a l'editeur de cet assistant, agissant comme destinataire / sous-traitant :
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
              <li><strong className="text-slate-300">Anthropic (Claude)</strong> — traitement des requetes IA ; hebergement possible hors UE (Etats-Unis), encadre par des Clauses Contractuelles Types.</li>
              <li><strong className="text-slate-300">OpenAI (ChatGPT)</strong> — traitement des requetes IA ; hebergement possible hors UE (Etats-Unis), encadre par des Clauses Contractuelles Types.</li>
            </ul>
            <p className="mt-2 text-slate-400">
              Ce partage n'a lieu que si l'Utilisateur active une cle API et connecte un assistant. Les cles sont revocables a tout moment ; toute action declenchee via l'API, un Webhook ou le MCP est reputee effectuee par l'Utilisateur.
            </p>

            <h3 className="text-base font-semibold text-white mt-4 mb-2">6.7 Transferts hors Union europeenne</h3>
            <p className="text-slate-400">
              Les donnees sont principalement hebergees dans l'UE (Supabase). Certains sous-traitants peuvent traiter des donnees hors UE, notamment aux Etats-Unis : Vercel (hebergement), Stripe (paiement), ainsi que Anthropic et OpenAI si un assistant IA est active. Ces transferts sont encadres par les Clauses Contractuelles Types de la Commission europeenne.
            </p>

            <p className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10 text-slate-400">
              <strong className="text-slate-300">Important :</strong> L'Utilisateur est seul responsable de la conformite de ses integrations tierces avec les reglementations applicables (RGPD, etc.) et les conditions d'utilisation de ces services.
            </p>
          </section>

          {/* 7. Traitements automatises */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">7. Traitements automatises</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4 text-white font-semibold">Processus</th>
                    <th className="py-2 pr-4 text-white font-semibold">Frequence</th>
                    <th className="py-2 text-white font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-slate-300">Rappels de rendez-vous</td>
                    <td className="py-2 pr-4">Selon configuration</td>
                    <td className="py-2">Emails envoyes aux prospects a des intervalles configurables (24h, 10h, 5h, 3h, 1h, 30min, 15min avant)</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-slate-300">Relances automatiques</td>
                    <td className="py-2 pr-4">Selon configuration</td>
                    <td className="py-2">Jusqu'a 7 emails de relance aux prospects apres un no-show ou en stade « Contacte », en pause des que le prospect a repondu</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-slate-300">Digest « suivi de discussion »</td>
                    <td className="py-2 pr-4">Quotidien (17h)</td>
                    <td className="py-2">Email recapitulatif envoye a l'Utilisateur (non au prospect) listant les discussions en attente de suivi</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-slate-300">Generation de factures</td>
                    <td className="py-2 pr-4">Mensuelle</td>
                    <td className="py-2">Creation automatique selon la configuration (jour du mois, methode de paiement)</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-slate-300">Rapports hebdomadaires</td>
                    <td className="py-2 pr-4">Hebdomadaire</td>
                    <td className="py-2">Agregation des metriques business et envoi par email</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-slate-300">Emails de cycle de vie</td>
                    <td className="py-2 pr-4">Automatique</td>
                    <td className="py-2">Sequences email aux moments cles du parcours utilisateur</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-slate-300">Nettoyage de donnees</td>
                    <td className="py-2 pr-4">Automatique</td>
                    <td className="py-2">Traitement des demandes de suppression de compte</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-slate-300">Attribution de RDV</td>
                    <td className="py-2 pr-4">A la reservation</td>
                    <td className="py-2">Algorithme round-robin ou aleatoire pour assigner les prospects</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 8. Obligations */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">8. Obligations de l'Utilisateur</h2>
            <p>L'Utilisateur s'engage a :</p>
            <ol className="list-decimal list-inside mt-2 space-y-2 text-slate-400">
              <li><strong className="text-slate-300">Fournir des informations exactes</strong> lors de l'inscription et les maintenir a jour</li>
              <li><strong className="text-slate-300">Proteger ses identifiants</strong> et ne pas les partager avec des tiers non autorises</li>
              <li><strong className="text-slate-300">Respecter la reglementation applicable</strong> (RGPD, Code de commerce, etc.) dans la collecte et le traitement des donnees de ses prospects</li>
              <li><strong className="text-slate-300">Obtenir le consentement</strong> de ses prospects avant de collecter leurs donnees via les formulaires de capture</li>
              <li><strong className="text-slate-300">Informer ses prospects</strong> de l'existence du traitement de leurs donnees et de leurs droits (acces, rectification, suppression), y compris lorsque des coordonnees sont enregistrees avant la soumission complete d'un formulaire (precapture)</li>
              <li><strong className="text-slate-300">Disposer d'une base legale valable</strong> pour les emails automatiques envoyes a ses prospects (rappels, relances de no-show, suivi de discussion) et fournir un mecanisme de <strong className="text-slate-300">desabonnement (opt-out)</strong> conforme (LCEN, ePrivacy)</li>
              <li><strong className="text-slate-300">Assumer la responsabilite editoriale</strong> du contenu des formulaires et pages publiques qu'il cree (liceite, information des personnes, videos)</li>
              <li><strong className="text-slate-300">Respecter les droits de ses membres d'equipe</strong> concernant les donnees personnelles collectees (remuneration, disponibilites, presence en ligne)</li>
            </ol>

            <p className="mt-4">L'Utilisateur s'interdit de :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Envoyer du spam ou des communications non sollicitees</li>
              <li>Collecter des donnees de maniere frauduleuse ou trompeuse</li>
              <li>Stocker des donnees sensibles (sante, opinions politiques, donnees judiciaires) dans les champs du CRM</li>
              <li>Contourner les mecanismes de securite de la Plateforme</li>
              <li>Utiliser la Plateforme pour toute activite illegale ou contraire aux bonnes moeurs</li>
            </ul>
          </section>

          {/* 9. Responsabilite de traitement */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">9. Responsabilite en tant que responsable de traitement</h2>
            <p>
              Au sens du RGPD, <strong className="text-white">l'Utilisateur est responsable de traitement</strong> pour les donnees de ses prospects et membres d'equipe. CloseOS agit en qualite de <strong className="text-white">sous-traitant</strong>.
            </p>
            <p className="mt-2">A ce titre, l'Utilisateur doit :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Disposer d'une base legale pour chaque traitement de donnees personnelles</li>
              <li>Tenir un registre des traitements si applicable</li>
              <li>Repondre aux demandes d'exercice de droits des personnes concernees</li>
              <li>Notifier toute violation de donnees dans les delais legaux</li>
            </ul>
          </section>

          {/* 10. Securite */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">10. Securite</h2>
            <p>CloseOS met en oeuvre les mesures de securite suivantes :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Communications chiffrees via HTTPS</li>
              <li>Mots de passe hashes (jamais stockes en clair)</li>
              <li>Verification des appareils par code a usage unique</li>
              <li>Controle d'acces base sur les roles (Row Level Security)</li>
              <li>Isolation des donnees par compte utilisateur</li>
              <li>Jetons OAuth stockes de maniere securisee avec rafraichissement automatique</li>
              <li>Verification en deux etapes pour les changements d'email</li>
            </ul>
          </section>

          {/* 11. Conservation */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">11. Conservation des donnees</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4 text-white font-semibold">Type de donnees</th>
                    <th className="py-2 text-white font-semibold">Duree de conservation</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Donnees de compte</td><td className="py-2">Duree de vie du compte + traitement post-suppression</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Donnees prospects (CRM)</td><td className="py-2">Jusqu'a suppression par l'Utilisateur</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Historique de rendez-vous</td><td className="py-2">Jusqu'a suppression par l'Utilisateur</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Notes d'appel</td><td className="py-2">Jusqu'a suppression par l'Utilisateur</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Donnees des liens de tracking</td><td className="py-2">Jusqu'a suppression du lien par l'Utilisateur</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Appareil de confiance / 2FA</td><td className="py-2">7 jours, puis nouvelle verification requise</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Jetons Google OAuth</td><td className="py-2">Jusqu'a revocation ou suppression du compte</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Logs de connexion</td><td className="py-2">Selon politique de retention interne</td></tr>
                  <tr className="border-b border-white/5"><td className="py-2 pr-4">Factures generees</td><td className="py-2">Conformement aux obligations legales (10 ans)</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 12. Suppression */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">12. Suppression de compte et portabilite</h2>
            <p>L'Utilisateur peut a tout moment :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li><strong className="text-slate-300">Demander la suppression de son compte</strong> — les donnees seront traitees via le processus automatise de suppression</li>
              <li><strong className="text-slate-300">Exporter ses donnees</strong> — conformement au droit a la portabilite (RGPD, art. 20)</li>
            </ul>
            <p className="mt-2">
              La suppression entraine la suppression de l'ensemble des donnees associees : prospects, rendez-vous, campagnes, membres d'equipe, integrations.
            </p>
          </section>

          {/* 13. Propriete intellectuelle */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">13. Propriete intellectuelle</h2>
            <p>
              La Plateforme, son code source, son design, ses marques et ses contenus sont la propriete exclusive de CloseOS. L'Utilisateur beneficie d'un droit d'usage non exclusif, non cessible et non transferable, limite a la duree de son abonnement.
            </p>
            <p className="mt-2">Les donnees saisies par l'Utilisateur restent sa propriete.</p>
          </section>

          {/* 14. Disponibilite */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">14. Disponibilite et limitations</h2>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>CloseOS s'efforce d'assurer une disponibilite de la Plateforme 24h/24, 7j/7, sans obligation de resultat</li>
              <li>Des interruptions pour maintenance peuvent survenir sans preavis</li>
              <li>CloseOS ne saurait etre tenu responsable des dommages resultant d'une indisponibilite temporaire</li>
              <li>Les fonctionnalites peuvent evoluer sans preavis</li>
            </ul>
          </section>

          {/* 15. Limitation de responsabilite */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">15. Limitation de responsabilite</h2>
            <p>CloseOS ne saurait etre tenu responsable :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Des donnees saisies par l'Utilisateur ou ses prospects</li>
              <li>De l'usage fait par l'Utilisateur des integrations tierces</li>
              <li>Des consequences d'une mauvaise configuration des campagnes ou rappels</li>
              <li>De la perte de donnees resultant d'une mauvaise manipulation de l'Utilisateur</li>
              <li>Des decisions commerciales prises sur la base des donnees de la Plateforme</li>
            </ul>
          </section>

          {/* 16. Modification */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">16. Modification de la Politique</h2>
            <p>
              CloseOS se reserve le droit de modifier la presente Politique a tout moment. Les modifications prennent effet des leur publication sur la Plateforme. L'Utilisateur sera informe des modifications substantielles par email.
            </p>
          </section>

          {/* 17. Droit applicable */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">17. Droit applicable et juridiction</h2>
            <p>
              La presente Politique est regie par le droit francais. Tout litige relatif a son interpretation ou a son execution releve de la competence exclusive des tribunaux francais.
            </p>
          </section>

          {/* 18. Contact */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">18. Contact</h2>
            <p>Pour toute question relative a la presente Politique :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li><strong className="text-slate-300">Email</strong> : <a href="mailto:support@closeos.fr" className="text-blue-400 hover:underline">support@closeos.fr</a></li>
              <li><strong className="text-slate-300">Site</strong> : closeos.fr</li>
            </ul>
          </section>

        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-slate-600 text-xs">
        CloseOS Business — Tous droits reserves.
      </footer>
    </div>
  );
};
