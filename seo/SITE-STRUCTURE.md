# SITE-STRUCTURE — CloseOS

Date : 2026-07-30
Objet : arborescence cible, maillage interne, plan de schema, correctifs techniques

---

## 1. Architecture de domaine — décision prise : Sign autonome

### État constaté en production le 2026-07-30
`sign.closeos.fr` ne servait pas seulement Sign : il servait **l'application entière**. `sign.closeos.fr/business` répondait 200 avec le contenu de la landing Business, et le même `robots.txt` était servi sur les deux hôtes. Surtout, les canoniques se contredisaient — aucune URL ne se déclarait canonique pour Sign.

### ✅ Option retenue : `sign.closeos.fr` comme produit autonome

Le dépôt implémentait déjà cette direction (redirection `sign.closeos.fr/` → `/sign` dans `vercel.json`, canonique Sign sur le sous-domaine dans `SignLanding.tsx`). Elle a été **complétée** plutôt que basculée :

```
sign.closeos.fr/sign             ← landing Sign, auto-canonique
sign.closeos.fr/                 → 301 vers /sign
www.closeos.fr/sign              → 301 vers https://sign.closeos.fr/sign
sign.closeos.fr/sign/securite    ← page de confiance, canonique sur le sous-domaine
sign.closeos.fr/sign/app/*       ← application, non indexée
```

Sitemaps : `sitemap.xml` (URLs www) et `sitemap-sign.xml` (URLs Sign), tous deux déclarés dans `robots.txt`. La cross-submission entre sous-domaines est valide dès lors que les hôtes appartiennent à la même propriété Search Console — une **propriété de domaine `closeos.fr`** couvre www et sign. C'est la seule action encore à faire côté GSC.

**Le compromis assumé.** Un sous-domaine est traité par Google comme une entité largement distincte pour l'autorité : les backlinks obtenus par Sales et Business ne profiteront que marginalement à Sign, et inversement. Sur un domaine créé en 2025, c'est un vrai coût. Il est accepté ici parce que Sign est positionné comme un produit à marque propre. **Si Sign ne décolle pas au point de contrôle des 6 mois** (`SEO-STRATEGY.md` §9), la consolidation sur `www.closeos.fr/sign` reste la première option à reconsidérer — elle ne coûterait qu'un jeu de 301 supplémentaires.

---

## 2. Arborescence cible (12 mois)

`✅` existe · `🔧` existe, à corriger · `➕` à créer · `🔓` écrit, à rendre public

```
www.closeos.fr/
│
├── /                                    ✅ Home écosystème (voir §5.2)
│
├── /sales                               ✅ Landing Sales (URL canonique unique)
│   └── /landing                         ✅ → 301 vers /sales
│
├── /business                            ✅ Landing Business
│
│   (Sign vit sur sign.closeos.fr — voir §1)
├── sign.closeos.fr/sign                 ✅ Landing Sign, auto-canonique
│   ├── /sign/securite                   ✅ publiée, sitemap + prerender
│   ├── /sign/signature-et-paiement      ➕ page différenciateur
│   └── /sign/valeur-juridique           ➕ eIDAS, E-E-A-T
│
├── /tarifs                              ✅
│
├── /fonctionnalites                     ✅ hub
│   ├── /crm-closer                      ✅
│   ├── /pipeline-closing                ➕
│   ├── /callroom-voip                   ➕
│   ├── /facturation-automatique         ➕
│   ├── /kpi-closing                     ➕
│   ├── /gestion-equipe-closers          ➕
│   ├── /campagnes-acquisition           ➕
│   ├── /formulaires                     ➕  → cible « alternative Tally »
│   ├── /liens-de-booking                ➕  → cible « alternative Calendly »
│   └── /signature-electronique          ➕  → passerelle vers Sign
│
├── /integrations                        ➕ hub
│   ├── /hubspot  /pipedrive  /gohighlevel                ➕
│   ├── /stripe   /google-calendar  /systeme-io           ➕
│   └── (Airtable, Calendly, iClosed, Zapier, Make, n8n)  ➕ Phase 4
│
├── /comparatifs                         ➕ hub (les pages existent, le hub non)
│   ├── /alternative-iclosed             ✅
│   ├── /closeos-vs-iclosed              ✅
│   ├── /closeos-vs-notion               ➕
│   ├── /alternative-gohighlevel         ➕
│   ├── /alternative-calendly            ➕
│   ├── /alternative-yousign             ➕
│   └── /alternative-docusign            ➕
│
├── /cas-usage                           ➕ hub
│   ├── /closer-independant              ➕
│   ├── /infopreneur                     ➕
│   ├── /head-of-sales                   ➕
│   └── /agence-de-closing               ➕
│
├── /clients                             ➕ hub études de cas (E-E-A-T)
│   └── /clients/[nom]                   ➕ ×2 en Phase 3
│
├── /ressources                          ➕ blog
│   └── /ressources/[slug]               ➕
│
├── /guides                              ➕ hub evergreen
│   ├── /recruter-un-closer              ➕
│   ├── /remunerer-un-closer             ➕
│   ├── /kpi-closing-a-suivre            ➕
│   └── /gerer-une-equipe-de-setters     ➕
│
├── /glossaire                           ➕ hub
│   └── /glossaire/[terme]               ➕ ×10-12
│
├── /aide                                🔓 centre d'aide Sales (existe, privé)
│   └── /aide/[article]                  🔓
│
├── /business/aide                       🔓 centre d'aide Business (existe, privé)
│   └── /business/aide/[article]         🔓
│
├── /a-propos                            ➕ E-E-A-T
├── /securite                            ➕ sécurité plateforme
│
└── Légal                                ✅ /mentions-legales /cgu /cgv
                                            /confidentialite
                                            /business/politique-utilisation
```

**Volumétrie cible** : 13 pages aujourd'hui → ~80 pages à 12 mois (hors articles d'aide, qui peuvent en ajouter plusieurs dizaines à coût quasi nul).

### Conventions d'URL
- Français, minuscules, tirets, sans accents (cohérent avec l'existant).
- Pas de date dans les URLs de blog : `/ressources/recruter-closer`, pas `/ressources/2026/07/...`. Permet la mise à jour sans redirection.
- Un hub par catégorie, systématiquement — un hub sans page enfant est acceptable, une page enfant sans hub casse le maillage.
- Slug figé dès la création. Chaque renommage coûte une redirection et une perte partielle d'autorité.

---

## 3. Maillage interne

### Règles
1. **Profondeur maximale 3 clics** depuis la home.
2. **Chaque page enfant remonte à son hub**, chaque hub liste tous ses enfants.
3. **Toute page de contenu pointe vers au moins une page de conversion** (`/tarifs`, une landing produit ou un comparatif). Un article qui ne mène nulle part ne sert à rien.
4. **Ancres descriptives.** `gérer une équipe de closers`, jamais `en savoir plus`.
5. **3 à 5 liens internes contextuels minimum** par page de contenu.

### Flux prioritaires

**Flux TOFU → conversion** (le plus important, celui qui monétise le blog) :
```
/glossaire/setter ──► /guides/recruter-un-closer ──► /fonctionnalites/gestion-equipe-closers
                                                          │
                                                          ▼
                                                    /business ──► /tarifs
```

**Flux comparaison → conversion** (le plus court, le mieux convertissant) :
```
/comparatifs/alternative-iclosed ──► /fonctionnalites/crm-closer ──► /sales ──► /tarifs
```

**Flux inter-produits** (celui qui donne son sens à l'écosystème) :
```
/business ──► /fonctionnalites/signature-electronique ──► /sign ──► /tarifs
```
Ce dernier flux est aujourd'hui **inexistant** : rien ne relie Business à Sign côté public, alors que le pont CRM→Sign est un différenciateur produit réel documenté dans le dépôt. C'est une page à créer en priorité.

### Depuis la home
La home doit lier explicitement les 3 landings produit, `/tarifs`, `/fonctionnalites` et `/comparatifs`. C'est elle qui distribue l'autorité : les pages qu'elle ne lie pas mettront beaucoup plus longtemps à se positionner.

---

## 4. Plan de schema par type de page

L'existant (`index.html`, `@graph` : Organization, Person, WebSite, 2× WebApplication, BreadcrumbList) est solide. À compléter :

| Type de page | Schema | Statut |
|---|---|---|
| Home | Organization + WebSite + WebApplication | ✅ |
| Landing produit | WebApplication + Offer + FAQPage | ✅ présent (réponses à étoffer) |
| Sign | WebApplication dédié + Offer | ✅ ajouté au `@graph` le 2026-07-30 |
| Tarifs | Product/Offer + FAQPage | ✅ présent (réponses à étoffer) |
| Fonctionnalité | WebPage + BreadcrumbList | 🔧 |
| Comparatif | WebPage + FAQPage + ItemList | 🔧 ItemList à ajouter |
| Intégration | WebPage + SoftwareApplication (partenaire) | ➕ |
| Blog / guide | **Article** + `author` → `@id` fondateur + `datePublished` / `dateModified` | ➕ |
| Glossaire (terme) | **DefinedTerm** + DefinedTermSet | ➕ |
| Centre d'aide | **TechArticle** | ➕ |
| Étude de cas | Article + Organization (client) | ➕ |
| Cas d'usage | WebPage + FAQPage | ➕ |

**Trois manques notables :**
- **CloseOS Sign n'a pas d'entrée `WebApplication`** dans le `@graph` alors que Sales et Business en ont une. Pour un moteur génératif, Sign n'existe pas comme produit identifié. Correctif simple et à fort rendement.
- ~~**Aucun `FAQPage`** nulle part.~~ ⚠️ **Faux, corrigé le 2026-07-30.** `FAQPage` est présent sur 5 pages (`/sales`, `/business`, `/sign`, `/tarifs`, le comparatif), soit 33 Q/R au total — j'avais lu le `@graph` statique d'`index.html` sans voir les données injectées par les pages. Le vrai problème est la **longueur des réponses** : médiane ~45 mots contre 134-167 pour la fenêtre de citation IA. Voir `GEO-ANALYSIS.md` §4. Restent sans `FAQPage` : `/fonctionnalites` et `/`.
- **`DefinedTerm`** sur le glossaire : peu utilisé en français, et c'est exactement ce qui permet à un modèle d'associer CloseOS à la définition d'un terme métier.

---

## 5. Correctifs techniques — détail et procédure

> **Statut au 2026-07-30 : tous appliqués dans le dépôt, non déployés.** Build complet vérifié (17 pages prérendues, contrôles SEO au vert) et garde-fou testé négativement en rejouant la régression `/sales` — le build échoue bien.
>
> Fichiers touchés : `scripts/seo-routes.mjs` *(nouveau)*, `scripts/generate-sitemap.mjs` *(nouveau)*, `scripts/prerender.mjs`, `package.json`, `vercel.json`, `src/pages/LandingPage.tsx`, `src/components/SignLegalShell.tsx`, `index.html`, `public/robots.txt`, `public/llms.txt`, suppression de `public/sitemap.xml`.
>
> Les descriptions ci-dessous documentent le problème d'origine et la solution retenue.

### 5.1 ✅ Chaîne de canoniques Sign

**Constaté :**
```
www.closeos.fr/sign   → canonical → sign.closeos.fr/
sign.closeos.fr/sign  → canonical → sign.closeos.fr/
sign.closeos.fr/      → canonical → www.closeos.fr/     ← rupture
```
Aucune URL ne se déclare canonique pour Sign. Google écarte les canoniques circulaires et choisit lui-même : très probablement la home, qui parle d'autre chose.

**Correctif appliqué :**
```
sign.closeos.fr/sign → canonical → https://sign.closeos.fr/sign   (auto-canonique)
sign.closeos.fr/     → 301       → /sign
www.closeos.fr/sign  → 301       → https://sign.closeos.fr/sign
```
Une seule URL indexable pour Sign, et elle se déclare elle-même. Le 301 depuis `www` est préféré à une canonique inter-domaines : plus net, et il ne dépend pas du bon vouloir de Google.

Cas connexe corrigé au passage : `src/components/SignLegalShell.tsx` ne posait **aucune** canonique. `/sign/securite`, `/sign/cgv` et `/sign/confidentialite` héritaient donc de celle d'`index.html` (`https://www.closeos.fr/`) et se déclaraient toutes comme étant la home de l'écosystème. Le gabarit pose désormais une canonique dérivée du chemin courant sur le sous-domaine.

À noter : `api/social-meta.ts` est **dormant** (aucun rewrite ne pointe dessus, le prerender gagne toujours par précédence du système de fichiers sur Vercel). Il n'avait donc pas besoin d'être corrigé — le commentaire en tête du fichier le documente déjà.

### 5.2 ✅ Triplon `/` + `/sales` + `/landing`

**Constaté :**

| URL | `<h1>` servi | `<title>` | canonical | dans sitemap |
|---|---|---|---|---|
| `/` | Le logiciel pour closers | Écosystème SaaS… | `/` | ✅ |
| `/sales` | Le logiciel pour closers | Écosystème SaaS… | **`/`** | ✅ |
| `/landing` | Le CRM pour closer | CloseOS Sales, CRM… | `/landing` | ✅ |

Deux anomalies distinctes :
- **`/sales` est soumis à l'indexation tout en se canonisant vers `/`.** Il ne se positionnera jamais. Il occupe une entrée de sitemap pour rien.
- **Le prérendu est désynchronisé du routeur.** `src/App.tsx:594` route `/sales` vers `LandingPage`, mais le HTML prérendu de `/sales` contient la page de choix d'écosystème. `scripts/prerender.mjs` a capturé un état qui ne correspond pas au routeur actuel.

**Correctif appliqué :** une seule URL canonique pour la landing Sales.
```
/sales    ← URL canonique (slug le plus explicite et le plus lisible en SERP)
/landing  → 301 vers /sales
/         → home écosystème, contenu et métas cohérents entre eux
```
`/landing` est sorti du sitemap et du prérendu ; `src/pages/LandingPage.tsx` pose désormais `/sales` en canonique, en `og:url`, en `hreflang` et dans son JSON-LD.

**Point à trancher sur la home.** `/` sert aujourd'hui une page de choix (Sales ou Business) avec un `<title>` qui décrit l'écosystème et un `<h1>` qui annonce « Le logiciel pour closers ». Le titre et le corps ne racontent pas la même chose. Une page de choix est une bonne UX mais une mauvaise page d'accueil SEO : c'est l'URL la plus autoritaire du domaine et elle ne cible aucune requête. Deux voies :
- **(a)** garder la page de choix mais lui donner un vrai contenu sous les cartes (positionnement, les 3 produits, preuves, FAQ) — recommandé, sans coût produit ;
- **(b)** faire de `/` la landing Sales et déplacer le choix ailleurs — plus agressif, à ne faire que si Sales redevient prioritaire.

Dans les deux cas, **aligner `<title>`, `<h1>` et `<meta description>`**.

### 5.3 ✅ Sitemap

Problèmes :
- entrée inter-domaines `https://sign.closeos.fr/sign` (invalide sur un sitemap servi par `www.closeos.fr`, et non canonique) ;
- `/sales` listé alors qu'il se canonise ailleurs ;
- `/sign/securite` absent alors que la route existe ;
- fichier maintenu à la main → dérive inévitable à 80 pages.

**Correctif appliqué.** `public/sitemap.xml` est supprimé. Deux sitemaps sont désormais générés au build par `scripts/generate-sitemap.mjs`, à partir du **même manifeste que le prérendu** (`scripts/seo-routes.mjs`) :

| Fichier | Contenu | Déclaré dans `robots.txt` |
|---|---|---|
| `sitemap.xml` | 13 URLs `www.closeos.fr` | `https://www.closeos.fr/sitemap.xml` |
| `sitemap-sign.xml` | 4 URLs `sign.closeos.fr` | `https://sign.closeos.fr/sitemap-sign.xml` |

Le générateur échoue si une URL canonique apparaît deux fois. `/sign/securite` est entré dans le sitemap et le prérendu. Une seule liste de routes publiques existe désormais : la classe de bugs « sitemap qui dérive du routeur » est fermée.

Note : `<changefreq>` et `<priority>` sont ignorés par Google depuis des années. Ils sont conservés par continuité, sans effet.

### 5.4 ✅ Garde-fou sur le prérendu

Le bug de `/sales` est passé en production sans être détecté. `scripts/prerender.mjs` compare désormais, pour chaque route, le HTML réellement produit à ce que déclare `scripts/seo-routes.mjs` :

| Contrôle | Effet |
|---|---|
| Canonique servie ≠ canonique déclarée | ❌ build interrompu |
| `<title>` vide, contenant `undefined`, ou hors regex attendue | ❌ build interrompu |
| `meta description` absente | ❌ build interrompu |
| Aucun `<h1>` dans `#root`, ou `<h1>` hors regex attendue | ❌ build interrompu |
| Deux routes partageant le même `<title>` ou la même canonique | ❌ build interrompu |
| Plusieurs `<h1>` dans `#root` | ⚠️ avertissement seulement |

L'échec utilise `process.exit(1)` et non une exception : le `catch` en bas de fichier doit rester tolérant quand Chrome est indisponible sur CI, sans jamais masquer une régression SEO.

**Testé dans les deux sens** : build complet au vert sur 17 pages, puis test négatif en rejouant la régression `/sales` (canonique attendue remise sur `/`) — le build s'interrompt avec le diagnostic attendu.

### 5.5 ✅ `robots.txt`

Déjà très bon. Ajustements appliqués :
- `Allow: /sign` et `Allow: /sign/securite` ;
- répertoires à venir ouverts par avance : `/aide`, `/business/aide`, `/ressources`, `/guides`, `/glossaire`, `/integrations`, `/cas-usage`, `/clients` ;
- `Disallow: /f/` (formulaires publics `/f/:slug`), au même titre que `/book/` et `/capture/` — pages applicatives sans valeur d'indexation, que le module Formulaires va multiplier ;
- `Allow: /landing` retiré (l'URL redirige désormais) ;
- les deux sitemaps déclarés.

`Google-Extended: Disallow` est un choix délibéré (bloque l'entraînement Gemini sans bloquer Googlebot ni les AI Overviews). Correct — le noter comme intentionnel pour éviter qu'on le « corrige » par erreur plus tard.

### 5.6 ✅ `llms.txt`

⚠️ **Correction d'un constat initial.** La version *déployée* de `llms.txt` ne décrit que Sales et Business. La version du *dépôt* est bien plus complète et couvre déjà les trois produits, dont Sign — l'écart venait de la production, pas du code. Le fichier du dépôt n'avait donc pas besoin d'être réécrit.

Ajouts effectués : lien vers `/sign/securite` et une section **Questions fréquentes** (6 Q/R factuelles : ce qu'est CloseOS, les prix, le différenciateur de Sign, RGPD, alternative à iClosed, langues). C'est le format le plus directement réutilisable par les moteurs génératifs.

Reste à faire : enrichir cette FAQ à partir de `CHATBOT_KNOWLEDGE_CLOSEOS.txt`, et la reprendre en schema `FAQPage` sur les pages de conversion.

---

## 6. Portes de qualité

Aucune page ne part en production sans :

- [ ] `<title>` unique, 50–60 caractères, mot-clé cible en tête
- [ ] `<meta description>` unique, 140–160 caractères, avec une incitation
- [ ] Un seul `<h1>`, contenant le mot-clé cible
- [ ] Canonique auto-référente (sauf duplication assumée)
- [ ] Au moins 600 mots utiles — pas de remplissage
- [ ] 3 à 5 liens internes contextuels, dont au moins un vers une page de conversion
- [ ] Un lien depuis son hub (sinon la page est orpheline)
- [ ] Schema JSON-LD conforme au tableau §4, validé
- [ ] Image OG dédiée (l'infrastructure `api/og.tsx` existe déjà)
- [ ] Toutes les images en `alt` descriptif, dimensions déclarées (CLS)
- [ ] Une réponse directe et extractible dans les 2 premières phrases (GEO)
- [ ] Ajoutée au sitemap
- [ ] Route ajoutée à la liste de prérendu **et** à `EXPECTED` (§5.4)

**Sur les pages comparatives, en plus :**
- [ ] Toutes les données concurrentes vérifiées à la date de publication
- [ ] Date de dernière vérification affichée sur la page
- [ ] Aucune affirmation invérifiable ; les forces réelles du concurrent sont mentionnées
- [ ] Aucune suggestion d'affiliation ou d'endossement
