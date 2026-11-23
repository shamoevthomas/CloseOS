# CloseOS — image pour Dokploy (VPS), remplace l'hébergement Vercel.
# Étape 1 : build (Vite + sitemap + prérendu SEO avec Chromium)
# Étape 2 : exécution (server/prod-server.ts : site statique + api/ + crons)

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Chromium pour le prérendu des pages publiques (scripts/prerender.mjs)
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Variables lues par Vite au moment du build (à renseigner dans Dokploy > Build-time arguments)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_DAILY_API_KEY
ARG VITE_APP_URL
ARG VITE_BREVO_API_KEY
ARG VITE_UMAMI_SRC
ARG VITE_UMAMI_WEBSITE_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_DAILY_API_KEY=$VITE_DAILY_API_KEY \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_BREVO_API_KEY=$VITE_BREVO_API_KEY \
    VITE_UMAMI_SRC=$VITE_UMAMI_SRC \
    VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json vercel.json tsconfig.json ./
COPY api ./api
COPY server ./server
COPY src ./src

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=300s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
