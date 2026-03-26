# CLAUDE.md - CloseOS Development Guide

## Project Overview

CloseOS is a Francophone SaaS platform for digital sales professionals (closers) and business owners (infopreneurs). It provides CRM, pipeline management, VoIP telephony, KPI dashboards, invoicing, and team management. The platform has two modules: an **Individual User Module** (personal CRM/pipeline) and a **Business Module** (organization/team management under `src/business/`).

## Tech Stack

- **Frontend**: React 19.2, TypeScript 5.9, Vite 7.2, Tailwind CSS 3.4
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Payments**: Stripe + Stripe Connect
- **Video/Animation**: Remotion (video generation), Motion (animations)
- **Charts**: Recharts 3.7
- **PDF**: jsPDF, html2pdf.js
- **Drag & Drop**: @hello-pangea/dnd
- **Integrations**: HubSpot, Pipedrive, Cal.com, Daily.co, Brevo, GoHighLevel, SystemeIO, Zapier, Airtable, Google Calendar, FirstPromoter

## Quick Commands

```bash
# Development
npx vite --port 5173          # Start dev server (do NOT use vercel dev)
npm run build                  # Production build (vite build)
npm run lint                   # ESLint check
npm run preview                # Preview production build

# Kill stuck dev server
lsof -ti:5173 | xargs kill -9
```

## Project Structure

```
src/
  App.tsx                    # Router + context providers (50+ routes)
  main.tsx                   # Entry point (React DOM, GoogleOAuthProvider)
  pages/                     # Individual user pages (37 files: Dashboard, Pipeline, Contacts, etc.)
  components/                # Shared React components (36 files: modals, forms, UI)
    settings/                # Settings modal (SettingsModal subdirectory)
  contexts/                  # Global state (11 contexts)
    AuthContext.tsx           # Primary user authentication
    ProspectsContext.tsx      # Sales prospects management
    OffersContext.tsx         # Offers/deals
    CallsContext.tsx          # Call tracking
    MeetingsContext.tsx       # Meeting scheduling
    NotificationsContext.tsx  # In-app notifications
    MessagesContext.tsx       # Messaging
    GoogleCalendarContext.tsx # Google Calendar sync
    InternalContactsContext.tsx # Team contacts
    PrivacyContext.tsx        # Data masking/privacy
    UpgradeContext.tsx        # Subscription upgrade prompts
  lib/                       # Utilities (7 files)
    supabase.ts              # Supabase client initialization
    supabaseHelpers.ts       # Database helper functions
    utils.ts                 # cn() utility for Tailwind class merging
    timezone.ts              # Timezone data
    countries.ts             # Country data
    image-crop.ts            # Image processing
    firstpromoter.ts         # Referral tracking integration
  layouts/                   # Layout wrappers (Layout.tsx)
  business/                  # Business/team module (separate architecture)
    pages/                   # Business pages (37 files)
    components/              # Business-specific components (15 files)
    contexts/                # Business state (4 contexts)
      BusinessAuthContext.tsx
      BusinessProspectsContext.tsx
      BusinessGoogleCalendarContext.tsx
      BusinessThemeContext.tsx
    hooks/                   # Custom hooks (useScrambleText, useCustomStages)
    layouts/                 # BusinessLayout wrapper

api/                         # Vercel serverless functions (22 files)
  account.ts                 # User account management
  stripe.ts                  # Stripe payment processing
  stripe-webhook.ts          # Stripe webhook handler
  subscription.ts            # Subscription lifecycle
  email.ts                   # Email sending (Brevo)
  hubspot.ts                 # HubSpot CRM integration
  pipedrive.ts               # Pipedrive CRM integration
  business.ts                # Business account operations
  cal.ts                     # Cal.com calendar integration
  ghll.ts                    # GoHighLevel integration
  ghll/callback.ts           # GoHighLevel OAuth callback
  presence.ts                # User presence tracking
  systemeio.ts               # SystemeIO integration
  webhooks.ts                # Generic webhook handling
  zapier-webhook.ts          # Zapier webhook handler
  cron/                      # Scheduled background jobs (7 cron tasks)

supabase/
  migrations/                # Database schema migrations (40 files)

public/                      # Static assets (logos, favicons, images)
```

## Architecture & Patterns

### Dual Module Architecture
- **Individual routes**: `/dashboard`, `/pipeline`, `/contacts`, `/offers`, `/appels`, `/factures`, `/kpi`, `/agenda`, `/telephony`, `/ai-coach`, `/rendez-vous`, `/messages`, `/reminders`
- **Business routes**: `/business/*` with separate `BusinessAuthContext` (dashboard, crm, team, organisation, campagnes, acquisition, objectifs, formules, pipeline-owner, closer-kpi, setter-kpi, report, etc.)
- **Public routes**: `/`, `/login`, `/register`, `/book/:slug`, `/capture/:slug`, `/appointment/:token`
- **Legal routes**: `/mentions-legales`, `/cgu`, `/cgv`, `/confidentialite`
- **Payment/Onboarding**: `/checkout`, `/return`, `/welcome-founder`, `/retention`

### State Management
- **React Context API** for all global state - no Redux or Zustand
- 11 individual contexts: `AuthContext`, `ProspectsContext`, `OffersContext`, `CallsContext`, `MeetingsContext`, `NotificationsContext`, `MessagesContext`, `GoogleCalendarContext`, `InternalContactsContext`, `PrivacyContext`, `UpgradeContext`
- 4 business contexts: `BusinessAuthContext`, `BusinessProspectsContext`, `BusinessGoogleCalendarContext`, `BusinessThemeContext`

### Data Flow
1. Authentication via Supabase Auth
2. Direct Supabase queries from frontend for CRUD operations
3. Vercel serverless functions as middleware for external integrations (Stripe, HubSpot, etc.)
4. Supabase real-time subscriptions for live updates

### Component Patterns
- Functional components with hooks only (no class components)
- Modal-driven UI for settings, onboarding, and data entry
- Pages in `pages/` directory, reusable UI in `components/`
- Tailwind CSS utility classes for all styling (dark mode via `class` strategy)

## Code Conventions

### TypeScript
- **Strict mode** enabled with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Target: ES2022, Module: ESNext, JSX: react-jsx
- All components are `.tsx`, utilities are `.ts`

### Styling
- Tailwind CSS exclusively - no CSS modules or styled-components
- Use the `cn()` utility from `src/lib/utils.ts` for conditional class merging
- Custom design tokens in `tailwind.config.js`:
  - Primary color: `#00E676` (bright green)
  - Dark background: `#020617`, card: `#0f172a`
  - Business theme: `#493627` (business-primary) with separate background tokens
  - Fonts: Manrope (display), Playfair Display (serif)
  - Custom animations: `wiggle`, `scroll-left`

### File Naming
- React components: PascalCase (`Dashboard.tsx`, `SettingsModal.tsx`)
- Utilities/lib: camelCase (`supabase.ts`, `supabaseHelpers.ts`)
- API routes: kebab-case (`zapier-webhook.ts`, `appointment-reminders.ts`)

### Language
- UI text and user-facing content is in **French**
- Code (variables, functions, comments) is in **English**

## Key Configuration

| File | Purpose |
|------|---------|
| `vercel.json` | Deployment config, cron schedules, API rewrites (54 routes) |
| `vite.config.ts` | Dev server config, API proxy to `close-os.vercel.app` |
| `tailwind.config.js` | Design tokens, custom colors, fonts, animations |
| `eslint.config.js` | Flat config with TS + React Hooks rules |
| `tsconfig.json` | Strict TypeScript compiler options |

## Cron Jobs (Vercel)

| Job | Schedule | File |
|-----|----------|------|
| Process deletions | Daily 00:00 UTC | `api/cron/process-deletions.ts` |
| Generate invoices | Daily 08:00 | `api/cron/generate-invoices.ts` |
| Lifecycle emails | Daily 09:00 | `api/cron/lifecycle-emails.ts` |
| Pipeline reset | Daily 03:00 | `api/cron/pipeline-reset.ts` |
| Objective cycle reset | Daily 23:00 | `api/cron/objective-cycle-reset.ts` |
| Appointment reminders | Every 5 min | `api/cron/appointment-reminders.ts` |
| Weekly report | Sunday 08:00 | `api/cron/weekly-report.ts` |

## Environment Variables

Required env vars (set in Vercel dashboard and `.env.local` for development):
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` - Supabase frontend config
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin access (server-side only)
- `STRIPE_SECRET_KEY` - Stripe payments
- `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` - HubSpot OAuth
- `PIPEDRIVE_CLIENT_ID` / `PIPEDRIVE_CLIENT_SECRET` - Pipedrive OAuth
- Various integration API keys for Brevo, Cal.com, Daily.co, etc.

## Testing

No formal test framework is configured. Testing is done via:
- Manual verification and ad-hoc test scripts (`test-stripe.ts`, `test-weekly-report.mjs`, `test-hubspot-oauth.js`, `test_db.js`)
- TypeScript compiler checks (`npm run build` catches type errors)
- ESLint (`npm run lint`)

## Deployment

- **Platform**: Vercel (auto-deploys from `main` branch)
- **Frontend**: SPA with catchall route to `index.html`
- **API**: Serverless functions under `/api`
- **Database migrations**: Applied via Supabase dashboard or CLI

## Common Tasks

### Adding a new page
1. Create the page component in `src/pages/` (or `src/business/pages/` for business module)
2. Add the route in `src/App.tsx`
3. Add navigation link in sidebar (`Layout.tsx` or `BusinessLayout.tsx`)

### Adding a new API endpoint
1. Create the handler in `api/`
2. Add the rewrite rule in `vercel.json`
3. For cron jobs, also add the schedule in `vercel.json`

### Adding a new context
1. Create the context file in `src/contexts/` (or `src/business/contexts/`)
2. Wrap the provider in `src/App.tsx` (or the business layout)

### Database changes
1. Create a new migration file in `supabase/migrations/`
2. Follow the existing naming pattern: `YYYYMMDDHHMMSS_description.sql`
3. Apply via Supabase CLI or dashboard

## Feature Documentation

The repo contains 30+ markdown files documenting specific feature implementations and fixes. Key examples:
- `B2B-B2C-IMPLEMENTATION.md` - B2B vs B2C targeting logic
- `KPI-DASHBOARD-IMPLEMENTATION.md` - KPI metrics and rendering
- `PIPELINE-FILTERS-IMPLEMENTATION.md` - Pipeline filtering logic
- `NOTIFICATION-SYSTEM-COMPLETE.md` - Notification infrastructure
- `GOOGLE_CALENDAR_SETUP.md` - Calendar integration setup
- `COMMISSION-REMOVAL-AND-CARD-TITLES.md` - Commission system changes
- `local-connexion.md` - Local development setup guide

These files serve as implementation logs and troubleshooting references.
