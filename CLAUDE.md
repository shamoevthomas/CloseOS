# CloseOS

CRM et plateforme de gestion commerciale SaaS (B2C + B2B) ciblant le marche francophone. Construit avec React 19 + TypeScript + Vite, deploye sur Vercel avec Supabase comme backend.

## Stack technique

- **Frontend**: React 19, TypeScript 5.9, Vite 7, React Router v7, Tailwind CSS 3, Motion (animations), Lucide React (icones)
- **Backend**: Vercel Functions (serverless Node.js)
- **Database**: Supabase (PostgreSQL + Auth + Realtime), RLS pour l'isolation multi-tenant
- **Paiements**: Stripe (abonnements, checkout, facturation)
- **Video**: Daily.co (appels video), Remotion (rendu video)
- **Calendrier**: Cal.com (OAuth + webhooks), Google Calendar
- **Email**: Brevo (ex-Sendinblue) via API
- **Integrations CRM**: HubSpot, Pipedrive, Go High Level (GHL), Systemeio, Airtable, Calendly
- **Webhooks**: Zapier, Make.com

## Commandes

```bash
npm run dev        # Serveur dev Vite sur port 5173
npm run build      # Build prod + prerendering SEO (Puppeteer)
npm run lint       # ESLint
npm run preview    # Preview du build
```

**Important**: Utiliser `npx vite --port 5173` pour le dev local, PAS `vercel dev` (cause des erreurs 500). Le proxy dans `vite.config.ts` redirige `/api/*` vers `https://close-os.vercel.app`.

## Architecture

```
src/
  pages/           # Pages consumer (lazy-loaded): Dashboard, Pipeline, Contacts, Offers, Agenda, Calls, KPI, Invoices...
  business/        # Module B2B complet (auth separee, layout, pages, contexts, composants)
  components/      # Composants UI partages
  contexts/        # State management via React Context (Auth, Prospects, Offers, Calls, Meetings, GoogleCalendar, Notifications)
  layouts/         # Layouts de page
  services/        # Services API (Daily.co, email)
  lib/             # Utilitaires (supabase client, timezone, countries, image-crop)
api/               # Vercel serverless functions
  cron/            # Taches planifiees (factures, rappels, emails lifecycle, reset pipeline, rapports hebdo)
supabase/
  migrations/      # 40+ fichiers SQL de migration
scripts/
  prerender.mjs    # Prerendering SEO avec Puppeteer
```

### Deux ecosystemes

1. **Consumer (B2C)** - `src/pages/`: CRM individuel pour commerciaux (pipeline, appels, contacts, offres, factures, KPI)
2. **Business (B2B)** - `src/business/`: Gestion d'equipe (equipes setter/closer, campagnes, objectifs, revenue, prospects partages)

### Patterns cles

- **Context API** pour le state management (25+ providers)
- **Lazy loading** avec React.lazy + Suspense sur toutes les routes
- **Action pattern** dans les API (routing par query param `?action=...`)
- **RLS Supabase** pour l'isolation des donnees par utilisateur/organisation
- **Dark mode** via Tailwind class strategy

## Variables d'environnement

**Frontend (Vite)**:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_DAILY_API_KEY` (optionnel)

**Backend (Vercel)**:
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `BREVO_API_KEY`, `CAL_CLIENT_SECRET`, `DAILY_API_KEY`
- `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`
- `PIPEDRIVE_CLIENT_ID`, `PIPEDRIVE_CLIENT_SECRET`

## Deploiement

- **Plateforme**: Vercel (auto-deploy sur push)
- **Production**: https://close-os.vercel.app / closeos.fr
- **Cron jobs**: 7 taches planifiees (factures, rappels RDV toutes les 5min, emails lifecycle, rapport hebdo, reset pipeline/objectifs, suppressions)
- **SEO**: Prerendering Puppeteer sur 8 routes publiques, sitemap.xml, robots.txt
- **Cache**: Assets statiques caches 1 an (immutable)
- **Securite**: Headers X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

## Base de donnees

Tables principales: `profiles`, `prospects`, `offers`, `appointments`, `calls`, `invoices`, `messages`, `reminders`, `subscriptions`, `referral_rewards`
Tables business: `business_settings`, `business_members`, `business_prospects`, `business_campaigns`, `business_objectives`, `business_appointments`, `business_connection_log`, `business_invoices`, `business_revenue`

## Pas de tests

Il n'y a pas de framework de test configure (ni Jest, ni Vitest, ni Cypress). Valider les changements manuellement et avec `npm run lint`.
