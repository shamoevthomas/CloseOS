# CLAUDE.md - CloseOS Development Guide

## Project Overview

CloseOS is a Francophone SaaS platform for digital sales professionals (closers) and business owners (infopreneurs). It provides CRM, pipeline management, VoIP telephony, KPI dashboards, invoicing, and team management. The platform has two modules: an **Individual User Module** (personal CRM/pipeline) and a **Business Module** (organization/team management under `src/business/`).

## Tech Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS 3
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Payments**: Stripe + Stripe Connect
- **Integrations**: HubSpot, Pipedrive, Cal.com, Daily.co, Brevo, GoHighLevel, SystemeIO, Zapier, Airtable, Google Calendar

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
  App.tsx                    # Router + context providers (~40 routes)
  main.tsx                   # Entry point (React DOM, GoogleOAuthProvider)
  pages/                     # Individual user pages (Dashboard, Pipeline, Contacts, etc.)
  components/                # Shared React components (modals, forms, UI)
  contexts/                  # Global state (Auth, Prospects, Offers, Calls, Meetings, etc.)
  lib/                       # Utilities (supabase client, helpers, timezone, countries)
  layouts/                   # Layout wrappers
  business/                  # Business/team module (separate architecture)
    pages/                   # Business pages (BusinessDashboard, BusinessCRM, CloserKPI, etc.)
    components/              # Business-specific components
    contexts/                # Business state (BusinessAuth, BusinessProspects, etc.)
    hooks/                   # Custom hooks (useScrambleText, useCustomStages)
    layouts/                 # BusinessLayout wrapper

api/                         # Vercel serverless functions
  account.ts                 # User account management
  stripe.ts                  # Stripe payment processing
  subscription.ts            # Subscription lifecycle
  email.ts                   # Email sending (Brevo)
  hubspot.ts                 # HubSpot CRM integration
  pipedrive.ts               # Pipedrive CRM integration
  business.ts                # Business account operations
  cal.ts                     # Cal.com calendar integration
  cron/                      # Scheduled background jobs (7 cron tasks)

supabase/
  migrations/                # Database schema migrations (46 files)

public/                      # Static assets (logos, favicons, images)
```

## Architecture & Patterns

### Dual Module Architecture
- **Individual routes**: `/dashboard`, `/pipeline`, `/contacts`, `/offers`, `/calls`, `/invoices`, `/kpi`, `/agenda`
- **Business routes**: `/business/*` with separate `BusinessAuthContext`
- **Public routes**: `/`, `/login`, `/register`, `/booking/*`
- **Legal routes**: `/cgu`, `/cgv`, `/privacy`, `/legal`

### State Management
- **React Context API** for all global state - no Redux or Zustand
- Separate contexts per domain: `AuthContext`, `ProspectsContext`, `OffersContext`, `CallsContext`, `MeetingsContext`, `NotificationsContext`, etc.
- Business module has its own parallel contexts: `BusinessAuthContext`, `BusinessProspectsContext`, etc.

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
  - Fonts: Manrope (display), Playfair Display (serif)

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
| `vercel.json` | Deployment config, cron schedules, API rewrites (45+ routes) |
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
