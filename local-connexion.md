# Local Connexion - CloseOS MVP

## Instruction pour Claude

Quand ce fichier est fourni, lance immédiatement le serveur local sans poser de questions.

## Procédure de lancement

### 1. Tuer tout processus existant sur le port 5173

```bash
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null
```

### 2. Lancer Vite directement (PAS vercel dev)

```bash
npx vite --port 5173
```

> **IMPORTANT** : Ne PAS utiliser `vercel dev`. Il cause des erreurs 500 (Internal Server Error) sur `main.tsx`, `@react-refresh` et `@vite/client` car il sert le HTML de l'index au lieu des modules JS, ce qui provoque un écran blanc.

### 3. Vérifier que le serveur répond

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

Doit retourner `200`.

## Connexion aux APIs

Le fichier `vite.config.ts` contient un proxy qui redirige `/api` vers `https://close-os.vercel.app`. Cela permet d'utiliser les API Vercel en local sans avoir besoin de `vercel dev`.

```ts
server: {
  proxy: {
    '/api': {
      target: 'https://close-os.vercel.app',
      changeOrigin: true,
      secure: true,
    }
  }
}
```

## Accès depuis un autre appareil (même réseau)

### 1. Trouver l'IP locale du Mac

```bash
ipconfig getifaddr en0
```

### 2. Lancer Vite avec `--host`

```bash
npx vite --port 5173 --host
```

### 3. Accéder depuis l'autre appareil

Ouvrir dans le navigateur : `http://<IP_LOCALE>:5173`

> Exemple : `http://192.168.1.42:5173`

## Résultat attendu

- Serveur accessible sur **http://localhost:5173**
- Pas d'écran blanc
- APIs fonctionnelles via le proxy Vite

## Compatibilité Production (Vercel)

**Tout ce qui est construit en local DOIT être fonctionnel une fois déployé sur Vercel.**

Règles à respecter lors du développement :

- **API routes** (`/api/*`) : en local, elles passent par le proxy Vite vers `close-os.vercel.app`. En production, Vercel les sert directement via ses serverless functions (`api/*.ts`). Ne jamais hardcoder `localhost` dans les appels API — toujours utiliser des chemins relatifs (`/api/business`, etc.).
- **Variables d'environnement** : si une nouvelle variable est nécessaire, elle doit exister dans les settings Vercel du projet. Ne pas se reposer sur un `.env` local uniquement.
- **Migrations DB** : toute modification de schéma (nouvelles colonnes, tables) doit être appliquée en production (via Supabase MCP ou dashboard) AVANT le déploiement du code qui en dépend.
- **Build** : toujours vérifier que `npx vite build` passe sans erreur avant de push. Si le build casse, Vercel refusera le déploiement.
- **Déploiement** : un simple `git push` déclenche le déploiement Vercel automatiquement. Pas besoin de commande supplémentaire.
