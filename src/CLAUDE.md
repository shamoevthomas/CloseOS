# CloseOS Sales (Module Consumer B2C)

Module CRM individuel pour commerciaux independants. Situe dans `src/pages/`, `src/components/`, `src/contexts/`, avec le layout principal dans `src/layouts/`.

## Architecture

```
src/
  pages/              # 40+ pages (routes lazy-loaded)
  components/         # 35+ composants partages (modales, UI, settings)
  contexts/           # 11 contexts React (state management global)
  layouts/            # Layout.tsx (wrapper authentifie avec Sidebar)
  services/           # dailyService.ts, emailService.ts
  lib/                # supabase.ts, timezone.ts, countries.ts, utils.ts, image-crop.ts
```

## Pages principales

### CRM & Pipeline
- `Pipeline.tsx` - Pipeline de vente Kanban (drag & drop, filtres, etapes personnalisables)
- `Contacts.tsx` - Gestion des contacts/prospects
- `Dashboard.tsx` - Tableau de bord avec metriques cles
- `KPIPage.tsx` - Indicateurs de performance (CA, taux de conversion, objectifs)
- `Offers.tsx` - Catalogue d'offres/formules avec tarification

### Communication
- `CallsPage.tsx` - Historique des appels
- `CallRoom.tsx` - Salle d'appel video (Daily.co)
- `CallDetails.tsx` / `CallDetailsPage.tsx` - Detail d'un appel avec resume IA
- `TelephonyPage.tsx` - Telephonie integree
- `MessagesPage.tsx` - Messagerie interne

### Agenda & RDV
- `Agenda.tsx` - Calendrier (Google Calendar + Cal.com)
- `RendezVous.tsx` - Gestion des rendez-vous
- `AppointmentManage.tsx` - Gestion avancee des RDV
- `BookingSettings.tsx` - Configuration des liens de reservation
- `PublicBooking.tsx` - Page de reservation publique

### Facturation
- `InvoicesPage.tsx` - Liste et gestion des factures
- `Tarifs.tsx` - Page de tarification (publique, SEO)

### Auth & Onboarding
- `Login.tsx` / `Register.tsx` - Authentification
- `WelcomeFounder.tsx` - Onboarding nouvel utilisateur
- `EcosystemChoice.tsx` - Choix B2C ou B2B
- `TrialExpired.tsx` / `SubscriptionRetention.tsx` - Gestion abonnement

### Pages publiques & SEO
- `LandingPage.tsx` / `Landing.tsx` - Pages d'accueil
- `BusinessLanding.tsx` - Landing B2B
- `CaptureForm.tsx` - Formulaire de capture de leads
- `comparatifs/` - Pages comparatives (CloseOS vs iClosed)
- `fonctionnalites/` - Pages fonctionnalites (CRM Closer, Hub)
- `CGU.tsx`, `CGV.tsx`, `Legal.tsx`, `PrivacyPolicy.tsx` - Pages legales

### Autres
- `AICoachPage.tsx` - Coach IA pour commerciaux
- `RemindersPage.tsx` - Rappels et follow-ups
- `SpectatorPage.tsx` - Mode spectateur (demo)
- `NotFound.tsx` - Page 404

## Contexts (State Management)

- **AuthContext** - Authentification, profil utilisateur, session Supabase
- **ProspectsContext** - CRUD prospects, filtres pipeline, recherche
- **OffersContext** - Gestion des offres/formules
- **CallsContext** - Historique d'appels, enregistrements
- **MeetingsContext** - RDV et reunions
- **GoogleCalendarContext** - Sync Google Calendar (OAuth)
- **NotificationsContext** - Notifications in-app
- **MessagesContext** - Messagerie
- **InternalContactsContext** - Contacts internes
- **UpgradeContext** - Gestion upgrade/abonnement
- **PrivacyContext** - Preferences de confidentialite

## Composants cles

### Modales metier
- `ProspectView.tsx` - Vue detail prospect (fiche complete, historique, notes)
- `OfferDetailModal.tsx` - Detail d'une offre (le plus gros composant ~133KB)
- `InvoiceGeneratorModal.tsx` - Generation de factures PDF
- `InvoiceDetailModal.tsx` - Detail facture
- `CallSummaryModal.tsx` - Resume d'appel avec transcription
- `CreateProspectModal.tsx` - Creation de prospect
- `CreateEventModal.tsx` - Creation d'evenement calendrier
- `NewCallModal.tsx` / `NoAnswerModal.tsx` - Gestion des appels

### Configuration
- `settings/SettingsModal.tsx` - Parametres utilisateur
- `settings/CancellationRetentionModal.tsx` - Retention a la desabonnement
- `settings/DeletionModal.tsx` - Suppression de compte
- `IssuerProfilesModal.tsx` - Profils emetteurs de factures
- `AutoInvoiceConfigModal.tsx` - Facturation automatique
- `PaymentMethodsModal.tsx` - Moyens de paiement
- `StripeConnectModal.tsx` - Connexion Stripe

### UI & Navigation
- `Sidebar.tsx` - Navigation laterale principale
- `NotificationBell.tsx` / `ReminderBell.tsx` - Notifications
- `LoadingScreen.tsx` - Ecran de chargement (Suspense)
- `AgendaErrorBoundary.tsx` - Error boundary pour l'agenda
- `CheckoutForm.tsx` / `CheckoutStarter.tsx` - Paiement Stripe
- `OnboardingModal.tsx` / `VideoOnboardingModal.tsx` - Onboarding
- `DataExportModal.tsx` - Export de donnees
- `EmailCapturePopup.tsx` - Capture email visiteurs
- `SharePerformanceButton.tsx` - Partage de performance
- `VideoCallOverlay.tsx` - Overlay appel video

## Services

- **dailyService.ts** - Integration Daily.co (creation de rooms, tokens, gestion appels video)
- **emailService.ts** - Envoi d'emails via API Brevo (relances, confirmations, notifications)

## Librairies utilitaires

- **supabase.ts** - Client Supabase initialise (auth + database)
- **supabaseHelpers.ts** - Fonctions helper pour queries courantes
- **timezone.ts** - Gestion des fuseaux horaires
- **countries.ts** - Liste des pays et indicatifs telephoniques
- **utils.ts** - Utilitaires generiques
- **image-crop.ts** - Crop d'images (avatars, logos)
- **firstpromoter.ts** - Integration FirstPromoter (affiliation)

## Tables Supabase (Consumer)

- `profiles` - Profils utilisateurs avec preferences et config
- `prospects` - Prospects/leads avec etape pipeline, source, notes
- `offers` - Offres/formules avec prix, description, conditions
- `appointments` - RDV avec date, prospect, statut, lien Google Meet
- `calls` - Appels avec duree, enregistrement, resume IA
- `invoices` - Factures generees (PDF, Stripe)
- `messages` - Messages internes
- `reminders` - Rappels et follow-ups programmes
- `subscriptions` - Abonnements Stripe (trial, active, canceled)
- `referral_rewards` - Commissions de parrainage

## Patterns specifiques

- **Pipeline Kanban** : Drag & drop des prospects entre etapes, etapes personnalisables par utilisateur
- **Appels video integres** : Daily.co avec enregistrement et resume IA automatique
- **Double calendrier** : Google Calendar + Cal.com synchronises
- **Facturation auto** : Generation automatique de factures a partir des offres acceptees
- **Mode demo/spectateur** : Acces en lecture seule pour les prospects
- **Onboarding guide** : Parcours d'onboarding avec video et checklist
- **i18n partiel** : Certaines landing pages ont des fichiers de traduction (`*I18n.ts`)
- **SEO** : Pages publiques prerenderees par Puppeteer, comparatifs et fonctionnalites
