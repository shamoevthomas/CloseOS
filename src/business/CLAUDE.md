# CloseOS Business (Module B2B)

Module B2B de CloseOS pour la gestion d'equipes commerciales (owners, setters, closers). Situe dans `src/business/`, il possede son propre systeme d'auth, layout, routing et contexts, independant du module consumer.

## Architecture

```
src/business/
  pages/              # 37 pages (Business* + Closer* + Setter* + Owner*)
  contexts/           # Auth, Prospects, GoogleCalendar, Theme (separes du consumer)
  components/         # Composants specifiques B2B (sidebar, modales, kanban, settings)
  layouts/            # BusinessLayout.tsx (wrapper principal)
  hooks/              # useCustomStages, useScrambleText
  lib/                # getProspectCA (calcul CA prospect)
```

## Roles et pages

### Owner (proprietaire d'organisation)
- `BusinessDashboard` - Vue d'ensemble de l'organisation
- `BusinessTeam` - Gestion des membres (setters, closers)
- `BusinessCRM` - CRM partage de l'equipe
- `BusinessPipeline` - Pipeline global
- `BusinessCampaigns` - Campagnes marketing
- `BusinessObjectives` - Objectifs d'equipe et individuels
- `BusinessAppointments` - Agenda de l'equipe
- `BusinessRevenue` - Suivi du chiffre d'affaires
- `BusinessReport` - Rapports hebdomadaires
- `BusinessKPI` - KPIs de l'equipe
- `BusinessFormules` - Gestion des offres/formules
- `BusinessReminders` - Rappels
- `BusinessClosers` / `BusinessSetters` - Vues par role
- `BusinessAcquisition` - Acquisition de prospects
- `BusinessOrganization` - Parametres organisation
- `OwnerFactures` - Facturation owner

### Closer (commercial terrain)
- `CloserDashboard` - Dashboard personnel
- `CloserCRM` / `CloserPipeline` - CRM et pipeline assignes
- `CloserAgenda` / `CloserRendezVous` - Agenda et RDV
- `CloserAppels` / `CloserCallRoom` / `CloserCallDetails` - Appels
- `CloserKPI` / `CloserObjectifs` - Performance personnelle
- `CloserFactures` - Factures du closer
- `CloserFormules` / `CloserDisponibilite` - Offres et dispo

### Setter (prise de RDV)
- `SetterKPI` - KPIs setter
- `SetterCallDetails` - Details d'appels
- `TeamMemberDashboard` - Dashboard membre generique

### Auth
- `BusinessLogin` / `BusinessRegister` / `BusinessVerification` / `BusinessInvitation`

## Contexts

- **BusinessAuthContext** - Authentification B2B separee (organisation, membre, role, permissions)
- **BusinessProspectsContext** - Prospects partages de l'equipe avec filtres par setter/closer
- **BusinessGoogleCalendarContext** - Integration Google Calendar pour l'equipe
- **BusinessThemeContext** - Dark/light mode independant

## Composants cles

- `BusinessSidebar` - Navigation laterale avec menu adapte au role
- `BusinessSettingsModal` - Parametres organisation
- `BusinessProspectView` - Vue detail prospect
- `BusinessInvoiceGeneratorModal` - Generation de factures
- `BusinessCRMIntegrationModal` - Connexion HubSpot, Pipedrive, GHL
- `BusinessOnboardingModal` - Onboarding nouvel utilisateur
- `BusinessStripeConnectModal` / `BusinessPaymentMethodsModal` - Paiements
- `BusinessIssuerProfilesModal` - Profils emetteurs de factures
- `InviteMemberModal` - Invitation de membres
- `TeamKanban` - Vue Kanban pour l'equipe
- `ExportProspectsModal` - Export des prospects
- `StripeMatchModal` - Reconciliation Stripe
- `BusinessReminderBell` - Notifications de rappels

## API Backend (api/)

Endpoints business dans `api/business.ts` avec actions:
- Gestion organisation: creation, parametres, settings
- Gestion membres: invitation, roles (owner/setter/closer), permissions
- Prospects partages: CRUD avec attribution setter/closer
- Objectifs: creation, suivi, cycles (hebdo/mensuel)
- Campagnes: creation, stats, booking config
- Revenue: suivi CA, commissions, bonus

Webhook Stripe: `api/business-stripe-webhook.ts`

## Tables Supabase

- `business_settings` - Configuration de l'organisation
- `business_members` - Membres avec roles et permissions
- `business_prospects` - Prospects partages (avec setter_id, closer_id)
- `business_campaigns` - Campagnes marketing
- `business_objectives` - Objectifs d'equipe (cycles hebdo/mensuel)
- `business_appointments` - RDV de l'equipe
- `business_invoices` - Factures B2B
- `business_connection_log` - Logs d'integrations CRM
- `business_revenue` - Suivi du chiffre d'affaires
- `business_custom_sources` / `business_custom_stages` / `business_tags` - Personnalisation

## Patterns specifiques

- **Permissions par role**: L'acces aux pages et actions depend du role (owner > closer > setter)
- **Custom stages**: Pipeline personnalisable par organisation (`useCustomStages` hook)
- **Attribution setter/closer**: Les prospects sont assignes a un setter puis a un closer
- **Compensation**: Systeme de commissions et bonus par membre (`team_compensation_and_bonuses`)
- **Multi-integration CRM**: Sync bidirectionnel avec HubSpot, Pipedrive, GHL
- **Webhooks entrants**: Systemeio, Zapier, Make.com, Calendly pour l'injection de prospects
