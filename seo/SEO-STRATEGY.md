# SEO-STRATEGY — CloseOS

Date : 2026-07-30
Domaine : `www.closeos.fr` (+ `sign.closeos.fr`)
Template sectoriel appliqué : **SaaS**
Capacité de production retenue : **2 à 4 pages / mois** (~36 pages sur 12 mois)
Périmètre : **les 3 produits en parallèle** (Sales, Business, Sign)
Blog : **oui — blog + glossaire**

> ⚠️ **Sur les données chiffrées.** Aucun connecteur DataForSEO / Ahrefs / Semrush n'est branché sur cette session. Tous les volumes de recherche et difficultés de mots-clés de ce plan sont des **estimations basées sur la structure du marché francophone**, pas des mesures. Ils sont marqués `(est.)`. La première action de la Phase 1 est de les valider (voir `IMPLEMENTATION-ROADMAP.md`, tâche 1.1). Ne prenez pas de décision d'investissement lourde sur ces chiffres avant validation.

---

## 1. Situation de départ (constatée, pas supposée)

### Ce qui est déjà en place et bon
| Élément | État |
|---|---|
| `robots.txt` | Très propre. App privée bien bloquée, crawlers IA (GPTBot, PerplexityBot, ClaudeBot) explicitement autorisés, CCBot et Google-Extended bloqués. |
| `llms.txt` | Présent et servi en 200. Rare, bon signal GEO. |
| JSON-LD | `@graph` statique dans `index.html` : Organization, Person (fondateur), WebSite, 2× WebApplication avec `offers` et `featureList`, BreadcrumbList. Niveau largement au-dessus de la moyenne du marché. |
| Prérendu | `scripts/prerender.mjs` (Puppeteer) sur 10 routes publiques → les crawlers reçoivent du HTML réel, pas un `<div id="root">` vide. |
| Meta sociales | `api/social-meta.ts` sert des métas dédiées aux bots par route, avec images OG par produit. |
| Analytics | GA4 + Consent Mode v2 + CookieYes, page_view restreint aux pages publiques. |

**Conclusion : la fondation technique n'est pas le problème.** Beaucoup de SaaS français à ce stade n'ont ni prérendu, ni schema, ni llms.txt. Le problème est ailleurs.

### Les 3 vrais problèmes

**Problème n°1 — Il n'y a que 13 pages indexables.**
Sur ~140 routes applicatives, seules 13 sont publiques et crawlables : 4 landings, tarifs, 2 pages fonctionnalités, 2 comparatifs, 5 pages légales. Aucun blog, aucun glossaire, aucune page d'intégration, aucun cas d'usage, aucun cas client, aucune page « à propos ». Un site de 13 pages ne peut pas capter de longue traîne — et la longue traîne est précisément là où un domaine jeune peut gagner.

**Problème n°2 — Les pages qui existent se cannibalisent.** (vérifié en prod, détail §2)
`/`, `/sales` et `/landing` servent des variantes du même contenu ; `/sign` a une chaîne de canoniques qui se mord la queue. Une partie de l'autorité déjà accumulée s'annule elle-même.

**Problème n°3 — Trois produits, un seul budget de contenu.**
Sales, Business et Sign visent trois audiences et trois marchés concurrentiels différents. À 3 pages/mois, faire « un peu des trois » sans arbitrage explicite garantit de ne percer nulle part. Le §4 pose cet arbitrage.

---

## 2. Correctifs techniques bloquants (à faire avant toute production de contenu)

Ces quatre points ont été vérifiés par requêtes HTTP sur la production le 2026-07-30.

> ✅ **Statut : tous corrigés dans le dépôt, non déployés.** Build complet vérifié (17 pages prérendues, contrôles au vert) et garde-fou testé négativement. Détail des correctifs dans `SITE-STRUCTURE.md` §5. Les descriptions ci-dessous documentent l'état d'origine.

### 2.1 — Chaîne de canoniques cassée sur Sign 🔴 CRITIQUE
```
https://www.closeos.fr/sign   → canonical → https://sign.closeos.fr/
https://sign.closeos.fr/sign  → canonical → https://sign.closeos.fr/
https://sign.closeos.fr/      → canonical → https://www.closeos.fr/     ← rupture
```
La landing Sign désigne comme canonique une URL qui, elle, renvoie vers la home de l'écosystème. Résultat : **aucune URL ne se déclare comme la page canonique de CloseOS Sign.** Google ignorera ces signaux et choisira lui-même — probablement la home. Tant que ce n'est pas corrigé, tout investissement SEO sur Sign est perdu.

### 2.2 — `/sales` est un doublon qui s'auto-annule 🔴
`/sales` est déclaré dans `sitemap.xml`, prérendu, et sert un `<h1>Le logiciel pour closers</h1>` identique à `/`, avec `canonical → https://www.closeos.fr/`. Il est donc soumis à l'indexation tout en demandant à ne pas être indexé. Par ailleurs le prérendu de `/sales` a capturé la page de choix d'écosystème, alors que la route React (`src/App.tsx:594`) pointe sur `LandingPage`. **Le prérendu est désynchronisé du routeur.**

### 2.3 — Sitemap inter-domaines invalide 🟠
`sitemap.xml` (servi sur `www.closeos.fr`) contient désormais `https://sign.closeos.fr/sign`. Un sitemap ne peut lister que des URLs du même hôte, sauf cross-submission vérifiée dans la Search Console. De plus l'URL listée n'est pas la canonique déclarée. Cette entrée sera ignorée au mieux, signalée en erreur au pire.

### 2.4 — Duplication totale sur deux hôtes 🟠
`sign.closeos.fr` sert **l'application entière**, pas seulement Sign : `sign.closeos.fr/business` répond 200 avec le contenu de la landing Business. Les canoniques rattrapent la plupart des cas, mais le budget de crawl est doublé inutilement et la moindre page sans canonique correcte devient un doublon.

**Décision d'architecture prise** (voir `SITE-STRUCTURE.md` §1) : **Sign reste autonome sur `sign.closeos.fr`**, direction que le dépôt avait déjà engagée. Elle a été complétée proprement — une seule URL indexable pour Sign, auto-canonique, `www.closeos.fr/sign` redirigé en 301, sitemap dédié.

Le compromis est assumé et documenté : un sous-domaine ne partage que marginalement l'autorité du domaine principal, ce qui coûte cher sur un domaine créé en 2025. **Si Sign n'a aucun mot-clé en top 20 au point de contrôle des 6 mois** (§9), la consolidation sur `www.closeos.fr/sign` est la première option à reconsidérer — elle ne coûterait qu'un jeu de 301 supplémentaires.

---

## 3. Positionnement et piliers de contenu

### Proposition de valeur défendable en SERP
CloseOS n'est pas « un CRM de plus ». Sa singularité, celle sur laquelle il faut construire tout le SEO :

> **La seule suite francophone qui couvre la chaîne complète du closing high ticket : acquérir → prendre le RDV → closer → faire signer → encaisser.**

Chaque concurrent ne couvre qu'un segment de cette chaîne. C'est l'angle éditorial de toutes les pages de conversion et la formulation à répéter à l'identique pour les moteurs génératifs.

### Les 4 piliers

| Pilier | Cible | Rôle | Part du budget contenu |
|---|---|---|---|
| **P1 — Closing (Sales)** | Closer indépendant, freelance | Acquisition organique bas de funnel, faible concurrence | 25 % |
| **P2 — Pilotage d'équipe (Business)** | Infopreneur, Head of Sales, agence de closing | Panier moyen le plus élevé, intention business forte | 30 % |
| **P3 — Signature & encaissement (Sign)** | Toute PME/indépendant qui fait signer + encaisser | Marché à gros volume, à attaquer par la niche uniquement | 25 % |
| **P4 — Vocabulaire & méthode (TOFU)** | Toute l'audience, en amont | Trafic haut de funnel, maillage interne, **citations IA** | 20 % |

### Pourquoi P4 compte autant qu'un pilier produit
Le vocabulaire du closing francophone (`closer`, `setter`, `high ticket`, `cash collecté`, `R1/R2`, `no-show`) est mal couvert en français : les sources existantes sont majoritairement des pages de vente de formations, pas des définitions neutres. Les LLM manquent de sources fiables à citer sur ces termes. **C'est une fenêtre d'opportunité GEO courte et réelle** : une page de glossaire neutre, sourcée et structurée peut devenir la référence citée par ChatGPT et Perplexity sur ces termes, à un coût de production faible. Cette fenêtre se refermera quand un concurrent le fera.

---

## 4. Arbitrage entre les trois produits

Vous avez choisi « les 3 en parallèle ». C'est tenable, mais **pas avec la même stratégie sur les trois** : les marchés n'ont pas la même dureté. Voici l'arbitrage qui rend le parallèle réaliste.

### Sales & Business — jouer pour gagner la SERP entière
Marchés de niche, quasi sans concurrence SEO structurée. Requêtes `crm closer`, `logiciel closer high ticket`, `gérer une équipe de closers` : faibles volumes `(est. 50–500/mois)`, mais **difficulté quasi nulle** et intention d'achat maximale. Avec 15 à 20 pages bien faites, CloseOS peut occuper la quasi-totalité des résultats de ces requêtes en 6 à 9 mois. **Objectif : domination, pas part de marché.**

### Sign — ne jamais attaquer la tête de requête
`signature électronique` est un marché où Yousign, Docusign et Universign ont 10 ans d'antériorité, des backlinks presse et des budgets de contenu sans commune mesure. Viser ces requêtes est une perte de temps garantie sur 12 mois.

**La seule porte d'entrée viable est le différenciateur produit :** signature **+ encaissement dans le même acte**. Requêtes du type `signature électronique et paiement`, `faire signer et encaisser un client`, `contrat de closing signature en ligne` : volumes faibles `(est. 20–200/mois)` mais concurrence quasi nulle et **intention parfaitement alignée sur ce que Sign fait et que Yousign ne fait pas**. Deuxième porte : les pages `alternative à Yousign / Docusign`, qui captent une audience déjà éduquée et en phase de comparaison.

### Ce que « en parallèle » signifie concrètement
Chaque mois : **1 page Sales ou Business (alternance), 1 page Sign, 1 page TOFU.** Les trois piliers avancent, aucun ne stagne, et la production reste dans la capacité annoncée.

---

## 5. Trois leviers déjà payés qu'il suffit de publier

Ces trois éléments existent déjà dans le dépôt. Leur coût marginal de mise en ligne est très faible pour un rendement élevé — ce sont les meilleures actions du plan en ratio effort/impact.

**5.1 — Les centres d'aide.** `src/pages/SalesHelpCenter.tsx` et `src/business/pages/BusinessHelpCenter.tsx` existent et sont rédigés, mais sont derrière l'authentification et bloqués dans `robots.txt`. Une documentation d'aide publique est l'un des meilleurs actifs SEO longue traîne d'un SaaS (`comment faire X dans …`) **et** l'une des sources les plus citées par les moteurs génératifs. Recommandation : versions publiques indexables sur `/aide` et `/business/aide`, une URL par article, schema `TechArticle`.

**5.2 — `CHATBOT_KNOWLEDGE_CLOSEOS.txt`.** Base de connaissance déjà écrite à la racine du dépôt. Elle contient la matière brute d'une page FAQ publique (schema `FAQPage`) et d'un enrichissement substantiel de `llms.txt`.

**5.3 — La page sécurité Sign.** ✅ **Fait.** La route `/sign/securite` existait (`src/App.tsx:462`) sans être ni dans le sitemap, ni dans `robots.txt`, ni prérendue — et son gabarit ne posait aucune canonique, si bien qu'elle se déclarait comme la home de l'écosystème. Elle est désormais autorisée, prérendue, dans `sitemap-sign.xml` et auto-canonique. Sur un produit de signature électronique, la page sécurité/conformité est une page de conversion et un signal E-E-A-T de premier ordre.

---

## 6. E-E-A-T — le point faible structurel

Google (mise à jour de décembre 2025) applique désormais l'évaluation E-E-A-T à l'ensemble des requêtes compétitives, plus seulement aux domaines YMYL. Pour un SaaS de 2025 vendant de la signature électronique — donc de la valeur juridique — c'est déterminant.

| Signal | État actuel | Action |
|---|---|---|
| Identité de l'éditeur | ✅ Organization + Person fondateur en JSON-LD, LinkedIn en `sameAs` | Maintenir |
| Page « À propos » | ❌ Inexistante | Créer `/a-propos` : fondateur, origine du produit, expérience terrain du closing |
| Auteur des contenus | ❌ Aucun contenu daté ou signé | Signer chaque article (`author` → `@id` fondateur), afficher date de MAJ |
| Preuve d'usage | ❌ Aucun cas client, aucun chiffre public | 2 études de cas chiffrées en Phase 3 (le point le plus lourd et le plus rentable) |
| Conformité / juridique | ✅ `/sign/securite` publiée et indexable | Ajouter la page eIDAS sur la valeur juridique (T2) |
| Réseau / mentions | 🟠 Un seul `sameAs` | Élargir : profils produit (Product Hunt, Capterra FR, Appvizer), annuaires SaaS FR |

**Appvizer et Capterra France méritent une mention particulière** : ce sont des sources fortement reprises dans les AI Overviews et par Perplexity sur les requêtes « meilleur logiciel … » en français. Une fiche produit complète y est un investissement ponctuel à rendement durable, hors production de contenu.

---

## 7. Objectifs et KPI

### ✅ Baseline mesurée le 2026-07-30
Relevé Search Console sur 3 mois (29/04/2026 → 28/07/2026), propriété de domaine `closeos.fr` (couvre www et sign).

| Métrique | **Baseline (30/07/2026)** | 3 mois | 6 mois | 12 mois | Source |
|---|---|---|---|---|---|
| Pages indexées | **10** (+ 16 non indexées) | 30 | 55 | 80 | GSC → Indexation |
| Clics organiques / mois | **~53** (160 sur 3 mois) | 95 | 210 | 425 | GSC → Performances |
| Impressions / mois | **~603** (1 810 sur 3 mois) | 1 800 | 4 200 | 9 000 | GSC |
| CTR moyen | **8,8 %** | ≥ 8 % | ≥ 8 % | ≥ 8 % | GSC |
| Position moyenne | **16,3** | < 14 | < 11 | < 9 | GSC |
| Clics non-marque / mois | **~2** (5 sur 3 mois) | 25 | 90 | 250 | GSC, hors requêtes marque |
| Essais gratuits issus de l'organique | _à instrumenter (GA4)_ | 5 / mois | 15 / mois | 40 / mois | GA4 (conversion dédiée) |
| Domaines référents | _non audité_ | +8 | +20 | +45 | Search Console / Ahrefs |
| LCP / INP / CLS (p75 mobile) | _non mesuré_ | < 2,5 s / < 200 ms / < 0,1 | — | — | CrUX |
| Citations IA (marque) | **0 relevé** | 3 | 10 | 30 | Suivi manuel, §8 |

### Ce que la baseline révèle — et qui change les priorités

**Le site ne capte presque que sa propre marque.** Sur les 160 clics du trimestre, environ **103 viennent de requêtes de marque** (`closeos`, `close os`, `closer os`, `closeros`, `closeo`), soit **64 %**. Ce sont des gens qui connaissaient déjà CloseOS et cherchaient le site. Le SEO ne les a pas apportés.

**Une seule requête non-marque produit des clics** : `iclosed alternative`, 3 clics pour 15 impressions. C'est peu, mais c'est le signal le plus encourageant du relevé : **la seule page de comparaison existante fonctionne.** Elle valide toute la stratégie de comparatifs du calendrier.

**`sales os` : 231 impressions, 0 clic.** C'est de loin la première source d'impressions du site, et elle ne convertit pas du tout. Deux hypothèses : soit CloseOS apparaît trop bas, soit le résultat affiché ne correspond pas à l'intention de recherche. À inspecter en priorité — 231 impressions gratuites qui ne rapportent rien.

**La marque s'écrit de quatre façons différentes.** `close os`, `closer os`, `closeros`, `closeo` : les utilisateurs ne savent pas l'orthographier. C'est la confirmation directe du problème de désambiguïsation identifié en GEO (`GEO-ANALYSIS.md` §5) — et ça se règle par la répétition d'une graphie unique, pas par du contenu.

**Position moyenne 16,3** : le site est en page 2. C'est la zone où quelques points de gain suffisent à faire basculer le trafic — d'où l'intérêt de la tâche « renforcer les pages en page 2 » plutôt que d'en créer de nouvelles.

Les multiplicateurs sont volontairement exprimés en ratio plutôt qu'en valeurs absolues : sur une base de départ très faible, un chiffre absolu serait de la fiction. Convertissez-les en valeurs dès que la baseline est relevée.

### Le KPI qui prime sur tous les autres
**Essais gratuits attribués à l'organique.** Un SaaS de niche peut atteindre ses objectifs commerciaux avec 800 visites/mois très qualifiées. Ne pas optimiser le volume de trafic pour lui-même : `/tarifs` et les pages comparatifs sont plus importantes que n'importe quel article de blog.

---

## 8. GEO — être cité par les moteurs génératifs

L'infrastructure est déjà là (`llms.txt`, prérendu, schema, crawlers IA autorisés). Ce qui manque, c'est le **contenu citable**.

Règles à appliquer à chaque page produite :
1. **Répondre en premier.** Chaque page ouvre sur une réponse directe de 2 à 3 phrases, autonome, extractible telle quelle. Pas d'introduction rhétorique.
2. **Un H2 = une question.** Formulés comme les utilisateurs les posent (« Combien coûte … ? », « Quelle est la différence entre un closer et un setter ? »).
3. **Chiffres et tableaux plutôt que prose.** Les prix, limites et comparaisons en tableau HTML sont extraits ; noyés dans un paragraphe, ils ne le sont pas.
4. **Formulation de marque stable.** Réutiliser à l'identique la phrase de positionnement du §3. La répétition littérale sur l'ensemble du site renforce l'association marque↔catégorie dans les modèles.
5. **`FAQPage` sur les pages de conversion**, `TechArticle` sur l'aide, `Article` + `author` sur le blog.

**Protocole de mesure** (aucun outil fiable n'existe encore, donc manuel et assumé comme tel) : chaque mois, poser les 10 mêmes prompts dans ChatGPT recherche web, Perplexity et Google AI Overviews (`meilleur CRM pour closer`, `alternative à iClosed`, `logiciel pour gérer une équipe de closers`, `signature électronique avec paiement intégré`, …) et consigner mention et citation dans un tableau daté. 15 minutes par mois, et c'est la seule donnée exploitable disponible aujourd'hui.

---

## 9. Risques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Le prérendu se désynchronise du routeur (déjà constaté sur `/sales`) et publie des métas fausses | **Avérée** | Élevé | Ajouter au build un test qui compare, pour chaque route prérendue, le `<title>` et le `<h1>` attendus. Échec du build en cas d'écart. |
| Contenu mince sur les pages d'intégration et de comparatif produites en série | Élevée | Élevé | Plancher de 600 mots utiles + un élément unique par page (capture réelle, tableau, limite honnête). Mieux vaut 6 pages d'intégration solides que 12 creuses. |
| Pages comparatives inexactes → perte de crédibilité, risque juridique | Moyenne | Élevé | Vérification trimestrielle des tarifs et fonctionnalités concurrents, date de vérification affichée sur la page, aucune affirmation invérifiable. |
| Cadence non tenue à 3 pages/mois | Moyenne | Moyen | Le calendrier est ordonné par priorité décroissante : en cas de retard, on décale la fin, on ne saute pas le début. |
| Sign n'obtient aucune traction malgré l'effort | Moyenne | Moyen | Point de contrôle à 6 mois : si aucun mot-clé Sign en top 20, rebasculer le budget Sign vers Business. Critère de sortie explicite. |
| Investissement sur des mots-clés à volume nul | Moyenne | Moyen | Validation des volumes en tâche 1.1 **avant** la production, pas après. |

---

## 10. Ce que ce plan ne couvre pas

Par honnêteté sur son périmètre :
- **Aucun audit de performance mesuré.** Les cibles Core Web Vitals du §7 sont des standards, pas un diagnostic. Une application React + Vite avec Puppeteer prérendu et plusieurs scripts tiers (CookieYes, GA4, FirstPromoter, Promotekit, tracking maison) a un profil de performance à mesurer sérieusement. À traiter via `/seo-technical` en Phase 1.
- **Aucun audit de netlinking.** Le profil de backlinks actuel est inconnu.
- **Aucune stratégie SEO local** — non pertinent pour un SaaS pur.
- **L'internationalisation (EN)** est mentionnée mais pas planifiée : le site est bilingue en interface, sans `hreflang` ni URLs distinctes. Une stratégie SEO anglophone est un plan à part entière ; l'ouvrir maintenant diluerait les 3 pages/mois sur deux langues. À reconsidérer au mois 12.

---

## Livrables associés
- `COMPETITOR-ANALYSIS.md` — concurrents par produit, écarts de contenu, opportunités
- `SITE-STRUCTURE.md` — arborescence cible, maillage interne, correctifs techniques détaillés
- `CONTENT-CALENDAR.md` — 36 pages ordonnées sur 12 mois
- `IMPLEMENTATION-ROADMAP.md` — 4 phases, dépendances, critères de sortie
