# CloseOS Sign — Serveur MCP

Serveur MCP (local, stdio) pour piloter CloseOS Sign depuis un client MCP
(Claude Desktop, Claude Code…). Il permet de :

1. **Importer un contrat** (PDF ou texte/HTML) — **uniquement en brouillon**
2. **Poser les champs** (signature, date, texte, checkbox, coordonnées…) au bon endroit
3. **Vérifier si c'est signé** (statut global + par signataire)

> ⚠️ **Garde-fou** : ce serveur ne crée que des **brouillons** (`status='draft'`) et
> refuse de modifier un contrat déjà envoyé/signé/verrouillé. Il n'expose **aucun**
> outil d'envoi, de signature ou de paiement. L'envoi reste 100 % manuel depuis l'app.

## Outils exposés

| Outil | Rôle |
|---|---|
| `sign_import_contract` | Crée un contrat en brouillon depuis un PDF (`pdf_base64` / `pdf_path` / `pdf_url`) ou du `html`. Retourne l'id, les dimensions des pages et l'URL de l'éditeur. |
| `sign_place_fields` | Ajoute des champs positionnés (coordonnées en **% via `x_pct`/`y_pct`** recommandé). Crée/renseigne les signataires au besoin. Refuse si non-brouillon. |
| `sign_get_status` | Indique si le contrat est signé (global + détail par signataire). |
| `sign_list_contracts` | Liste les contrats (filtre optionnel par statut). |
| `sign_get_contract` | Détail : signataires, champs déjà posés, dimensions de page. |

## Système de coordonnées

Les pages sont posées à une largeur fixe **794 px** (≈ A4). Positionne les champs avec
`x_pct`/`y_pct` ∈ `[0,1]` (fraction de la largeur/hauteur de la page) — le serveur convertit
en pixels selon les dimensions **réelles** de chaque page (lues dans le PDF). Origine =
coin **haut-gauche**. Exemple : bloc signature en bas à droite de la page 1 →
`{ type: 'signature', page: 1, x_pct: 0.6, y_pct: 0.85 }`. Tu peux aussi donner des pixels
bruts (`x`/`y`) et des tailles (`w`/`h`) ; sinon des tailles par défaut s'appliquent.

Types de champs : `signature, initials, name, date, time, email, tel, address, city,
siret, siren, tva, company_id, ape, checkbox, text`. `assignee` = `signer` (destinataire,
avec `signer_index` 1..N) ou `owner` (toi).

## Deux modes

| Mode | Pour quel client | Où |
|---|---|---|
| **Distant (HTTP)** | **Claude.ai (web)**, Claude Desktop, Claude Code | `api/mcp.ts` (déployé sur Vercel) |
| Local (stdio) | Claude Desktop / Claude Code uniquement | `sign-mcp/index.mjs` (ce dossier) |

> Claude.ai **ne parle qu'à des serveurs MCP distants HTTPS** → utilise le mode distant.

---

## Mode distant — Claude.ai (recommandé)

L'endpoint est la fonction Vercel **`api/mcp.ts`** (transport Streamable HTTP, stateless),
sécurisée par une **URL secrète** : le secret `SIGN_MCP_SECRET` doit figurer dans l'URL,
sinon l'endpoint répond 404.

### 1. Variables d'environnement Vercel (projet CloseOS)

| Variable | Déjà présente ? | Valeur |
|---|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | ✅ oui | `https://qwjvdwpixewsctircibl.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ oui | (secret service_role) |
| `SIGN_OWNER_EMAIL` | ➕ à ajouter | ton email propriétaire Sign |
| `SIGN_MCP_SECRET` | ➕ à ajouter | un secret long et aléatoire (ex. `openssl rand -hex 24`) |
| `SIGN_APP_URL` | (optionnel) | `https://sign.closeos.fr` |

Puis **déploie** (push git → Vercel).

### 2. Ajouter le connecteur dans Claude.ai

Paramètres → **Connecteurs** → **Ajouter un connecteur personnalisé** → URL :

```
https://sign.closeos.fr/api/mcp/<SIGN_MCP_SECRET>
```

(La forme `https://sign.closeos.fr/api/mcp?key=<SIGN_MCP_SECRET>` fonctionne aussi.)

### 3. Test rapide (après déploiement)

```bash
curl -sS -X POST "https://sign.closeos.fr/api/mcp/<SECRET>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
# → doit renvoyer un résultat JSON avec serverInfo.name = "closeos-sign"
```

> ⚠️ En distant, l'import PDF se fait via `pdf_base64` (petit fichier) ou **`pdf_url`**
> (recommandé pour les gros PDF — la taille du corps de requête serverless est limitée).

---

## Mode local — Claude Desktop / Code (stdio)

```bash
cd sign-mcp
npm install
cp .env.example .env
# puis renseigne SUPABASE_SERVICE_ROLE_KEY et SIGN_OWNER_EMAIL dans .env
```

Test rapide (le serveur doit afficher « prêt » sur stderr, puis attendre en stdio) :

```bash
set -a && source .env && set +a && npm start
```

## Configuration client MCP

### Claude Code (CLI)

```bash
claude mcp add closeos-sign \
  --env SUPABASE_URL=https://qwjvdwpixewsctircibl.supabase.co \
  --env SUPABASE_SERVICE_ROLE_KEY=... \
  --env SIGN_OWNER_EMAIL=ton-email@exemple.fr \
  -- node /chemin/absolu/closeros-mvp/sign-mcp/index.mjs
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "closeos-sign": {
      "command": "node",
      "args": ["/chemin/absolu/closeros-mvp/sign-mcp/index.mjs"],
      "env": {
        "SUPABASE_URL": "https://qwjvdwpixewsctircibl.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "...",
        "SIGN_OWNER_EMAIL": "ton-email@exemple.fr"
      }
    }
  }
}
```

## Sécurité

- La **clé service-role** contourne la RLS Supabase. Ne la mets que dans `.env` /
  la config du client MCP (jamais dans git). `.env` est ignoré par git.
- Le serveur est **mono-compte** : il n'agit que pour `SIGN_OWNER_EMAIL` et vérifie
  que chaque contrat manipulé appartient bien à ce propriétaire.
