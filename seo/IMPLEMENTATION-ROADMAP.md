# IMPLEMENTATION-ROADMAP — CloseOS

Date : 2026-07-30 · Horizon : 12 mois · 4 phases

Chaque phase a des **critères de sortie**. Ne pas passer à la suivante tant qu'ils ne sont pas remplis : les phases sont des dépendances, pas un calendrier décoratif.

---

## Phase 1 — Fondation (semaines 1 à 4 · août 2026)

**Objectif : réparer avant de construire.** Aucune page de contenu n'est produite ce mois-ci.

> ✅ **Les tâches 1.3 à 1.7 sont faites dans le dépôt (non déployées).** Restent ouvertes, et elles sont le vrai chemin critique : **1.1 (baseline et validation des mots-clés)**, **1.2 (propriété de domaine Search Console)**, **1.8 (audit de performance)** et **1.9 (signaux externes)**.

### 1.1 🔴 Mesurer la baseline et valider les mots-clés — **bloquant, à faire en premier**

Tout le reste du plan repose sur des estimations non vérifiées. Cette tâche les remplace par des faits.

- [ ] Search Console : vérifier la propriété `www.closeos.fr` **et** `sign.closeos.fr` (Domain property couvre les deux)
- [ ] Exporter 3 mois de données : clics, impressions, position moyenne, pages indexées
- [ ] Remplir la colonne « Baseline » de `SEO-STRATEGY.md` §7 et **convertir les multiplicateurs en valeurs absolues**
- [ ] Valider les volumes des 20 mots-clés prioritaires (Search Console + Google Keyword Planner, ou lancer `/seo-dataforseo` si un accès est ouvert)
- [ ] Réordonner `CONTENT-CALENDAR.md` si les données contredisent les estimations
- [ ] GA4 : créer un événement de conversion « essai gratuit » et un segment « organique »

> Sans cette étape, il sera impossible de dire à 6 mois si le plan fonctionne. Le temps qu'elle prend est du temps gagné.

### 1.2 🔴 Search Console — propriété de domaine
Architecture tranchée : Sign reste autonome sur son sous-domaine (`SITE-STRUCTURE.md` §1). Cela impose une contrainte GSC qui n'est **pas encore remplie** :
- [ ] Créer une **propriété de domaine** `closeos.fr` (et non une propriété de préfixe d'URL) — elle seule couvre `www` et `sign`, ce qui rend valide la déclaration croisée de `sitemap-sign.xml`
- [ ] Soumettre les deux sitemaps : `https://www.closeos.fr/sitemap.xml` et `https://sign.closeos.fr/sitemap-sign.xml`

### 1.3 ✅ Corriger les canoniques
- [x] Chaîne Sign : une seule URL indexable, auto-canonique (§5.1)
- [x] `SignLegalShell` pose une canonique (`/sign/securite`, `/sign/cgv`, `/sign/confidentialite` se déclaraient comme la home)
- [x] `/landing` → 301 vers `/sales` ; `/sales` auto-canonique (§5.2)
- [ ] **Après déploiement** : `curl -s <url> | grep canonical` sur `/`, `/sales`, `/landing`, `/business`, `/tarifs`, `www.closeos.fr/sign`, `sign.closeos.fr/sign`, `sign.closeos.fr/sign/securite`
- [ ] Reste ouvert : aligner `<title>` / `<h1>` / `<meta description>` sur la home (§5.2) — décision éditoriale, pas technique

### 1.4 ✅ Sitemap généré au build
- [x] `scripts/seo-routes.mjs` : manifeste unique des routes publiques
- [x] `scripts/generate-sitemap.mjs` et `scripts/prerender.mjs` le consomment tous les deux
- [x] `public/sitemap.xml` supprimé ; `sitemap.xml` (13 URLs www) et `sitemap-sign.xml` (4 URLs Sign) générés
- [x] `/sign/securite` ajouté ; une seule URL canonique de landing Sales

### 1.5 ✅ Garde-fou anti-régression du prérendu
- [x] Contrôles canonique / title / description / h1 / unicité par route (§5.4)
- [x] Échec du build (`process.exit(1)`) en cas d'écart
- [x] Test négatif validé : la régression `/sales` rejouée interrompt bien le build

### 1.6 ✅ `robots.txt` et `llms.txt`
- [x] `robots.txt` : `/sign` et `/sign/securite` autorisés, répertoires à venir ouverts, `Disallow: /f/`, deux sitemaps déclarés
- [x] `llms.txt` : lien sécurité + section FAQ (6 Q/R factuelles). La section Sign y était déjà — son absence ne concernait que la version déployée
- [ ] Reste ouvert : enrichir la FAQ depuis `CHATBOT_KNOWLEDGE_CLOSEOS.txt`

### 1.7 🟠 Schema
- [x] Entrée `WebApplication` **CloseOS Sign** ajoutée au `@graph` de `index.html`, plus la marque Sign et son `alternateName`
- [ ] `FAQPage` sur `/tarifs` et les 3 landings — reste à faire
- [ ] Valider avec le Rich Results Test **après déploiement**

### 1.8 🟠 Audit de performance — **non fait, à faire**
Aucune mesure de performance n'a été réalisée dans ce plan. Application React + Vite avec prérendu Puppeteer et 5 scripts tiers (CookieYes, GA4, FirstPromoter, Promotekit, tracking maison) : profil à mesurer sérieusement.
- [ ] Lancer `/seo-technical` ou `/seo-page` sur `/`, `/business`, `/tarifs`
- [ ] Relever LCP / INP / CLS p75 mobile via CrUX
- [ ] Évaluer le coût de Promotekit (chargé à load+5s) et de FirstPromoter sur l'INP
- [ ] Fixer des cibles réelles en remplacement des standards de `SEO-STRATEGY.md` §7

### 1.9 🟢 Signaux externes (indépendant du reste, à lancer tôt)
- [ ] Fiches produit : Appvizer, Capterra FR, Product Hunt — sources fortement reprises par les AI Overviews en français
- [ ] Élargir `sameAs` dans le schema Organization

**Critères de sortie Phase 1** — tous obligatoires :
- ✅ Baseline chiffrée et inscrite dans `SEO-STRATEGY.md` §7
- ✅ `curl` confirme une canonique auto-référente sur `/`, `/sales`, `/business`, `/sign`, `/tarifs`
- ✅ Sitemap généré au build, zéro URL inter-domaine, zéro URL non canonique
- ✅ Build en échec si le prérendu diverge du routeur
- ✅ Search Console : 0 erreur d'indexation sur les pages publiques

---

## Phase 2 — Expansion (semaines 5 à 12 · sept. → nov. 2026)

**Objectif : passer de 13 à ~35 pages indexées en exploitant d'abord ce qui est déjà écrit.**

### 2.1 🔥 Publier les centres d'aide
`src/pages/SalesHelpCenter.tsx` et `src/business/pages/BusinessHelpCenter.tsx` existent, sont rédigés, et sont bloqués derrière l'auth.
- [ ] Versions publiques indexables sur `/aide` et `/business/aide`
- [ ] **Une URL par article** (un centre d'aide en page unique ne capte presque rien)
- [ ] Schema `TechArticle`, ajout au sitemap et au prérendu
- [ ] `robots.txt` : autoriser `/aide` et `/business/aide` sans ouvrir l'application

C'est la meilleure action du plan en ratio effort/impact : contenu déjà payé, longue traîne massive, et l'un des formats les plus cités par les moteurs génératifs.

### 2.2 Produire les 9 pages du T1
Voir `CONTENT-CALENDAR.md` T1. Ordre strict : la priorité décroissante est intentionnelle.

### 2.3 Structure éditoriale
- [ ] Créer les hubs `/glossaire`, `/guides`, `/ressources`, `/comparatifs`
- [ ] Poser le maillage des flux prioritaires (`SITE-STRUCTURE.md` §3), **dont le flux inter-produits Business→Sign, aujourd'hui inexistant**
- [ ] Étendre `api/og.tsx` aux nouveaux types de page

### 2.4 Mise en place du suivi
- [ ] Tableau de bord GSC mensuel
- [ ] Protocole de citations IA : 10 prompts fixes, 3 plateformes, relevé daté (`SEO-STRATEGY.md` §8)

**Critères de sortie Phase 2 :**
- ✅ ≥ 35 pages indexées (GSC)
- ✅ Centres d'aide publics, une URL par article
- ✅ Impressions ×3 vs baseline
- ✅ ≥ 5 mots-clés en top 10
- ✅ Aucune page orpheline

---

## Phase 3 — Montée en puissance (semaines 13 à 24 · déc. 2026 → mai 2027)

**Objectif : convertir la couverture en classements, et combler le déficit E-E-A-T.**

### 3.1 Produire les 18 pages T2 + T3
Voir `CONTENT-CALENDAR.md`.

### 3.2 🔥 Études de cas clients — **le point le plus lourd et le plus rentable**
Seul déficit E-E-A-T que le contenu seul ne comble pas (`COMPETITOR-ANALYSIS.md` §5).
- [ ] **Dès février** : identifier 4 clients candidats, solliciter l'accord (délai long, prévoir le double)
- [ ] Collecter des chiffres réels : avant/après, période, résultat mesuré
- [ ] Publier 2 études de cas (mai et juin)
- [ ] Schema `Article` + `Organization` client

Bloquant externe : sans accord client, cette action glisse. La démarrer tôt est le seul levier disponible.

### 3.3 Netlinking — **non audité, à cadrer ici**
Le profil de backlinks actuel est inconnu.
- [ ] Auditer le profil existant (Ahrefs / Search Console → liens)
- [ ] Cibler les annuaires SaaS FR, podcasts et communautés closing/infopreneuriat
- [ ] Objectif : +20 domaines référents à 6 mois
- [ ] Ne pas acheter de liens : sur un domaine de 2025 et une niche étroite, le risque dépasse le gain

### 3.4 GEO
- [ ] Appliquer les 5 règles de `SEO-STRATEGY.md` §8 rétroactivement aux pages du T1
- [ ] `FAQPage` sur toutes les pages de conversion
- [ ] Vérifier que les tableaux de prix sont en HTML, pas en image

### 3.5 Performance
- [ ] Traiter les correctifs issus de l'audit 1.8
- [ ] Atteindre les cibles CWV du §7

**Critères de sortie Phase 3 :**
- ✅ ≥ 70 pages indexées
- ✅ ≥ 45 mots-clés en top 10, ≥ 18 en top 3
- ✅ 2 études de cas publiées
- ✅ Essais gratuits organiques mesurables et en croissance
- ✅ ≥ 10 citations IA relevées
- ✅ **Décision Sign** : si aucun mot-clé Sign en top 20 à 6 mois, rebasculer le budget Sign vers Business (`SEO-STRATEGY.md` §9)

---

## Phase 4 — Autorité (mois 7 à 12 · juin → juillet 2027 et au-delà)

**Objectif : consolider, et arbitrer sur données réelles plutôt que sur le plan.**

### 4.1 Produire les pages T4 (28 à 33)
### 4.2 Utiliser les 3 créneaux de réserve
Décidés sur les données GSC réelles, pas sur ce document. Priorité aux pages en page 2 : les faire passer en page 1 coûte moins cher qu'une page neuve.

### 4.3 Compléter les intégrations
- [ ] Porter le hub `/integrations` à 6–8 fiches **substantielles**
- [ ] Ne pas produire les 12 intégrations de `llms.txt` en pages minces : 6 solides valent mieux que 12 creuses (risque de contenu mince, `SEO-STRATEGY.md` §9)

### 4.4 Décision internationalisation
Le site est bilingue en interface mais sans `hreflang` ni URLs distinctes. Ouvrir l'anglais diluerait 3 pages/mois sur deux langues.
- [ ] Évaluer au mois 12, sur données : y a-t-il des impressions anglophones dans GSC ?
- [ ] Si oui : plan `hreflang` dédié (`/seo-hreflang`), en projet séparé
- [ ] Si non : rester en français, et considérer la question tranchée

### 4.5 Industrialiser
- [ ] Modèles de page par type (comparatif, intégration, glossaire) pour réduire le coût unitaire
- [ ] Automatiser la vérification trimestrielle des tarifs concurrents (alerte de fraîcheur)

**Critères de sortie Phase 4 :**
- ✅ ≥ 80 pages indexées
- ✅ ≥ 110 mots-clés en top 10, ≥ 45 en top 3
- ✅ Clics organiques ×8 vs baseline
- ✅ ≥ 40 essais gratuits organiques / mois
- ✅ ≥ 30 citations IA relevées

---

## Dépendances

```
1.1 Baseline ────────────────► tout le reste (bloquant absolu)
1.2 Décision domaine ────────► 1.3 canoniques ──► 1.4 sitemap ──► Phase 2
1.5 Garde-fou prérendu ──────► toute publication de page
2.1 Centres d'aide ──────────► indépendant, à lancer en parallèle
3.2 Accord clients ──────────► études de cas (délai externe, démarrer en février)
1.8 Audit perf ──────────────► 3.5 correctifs performance
1.9 Fiches annuaires ────────► indépendant, à lancer dès la semaine 1
```

**Chemin critique restant** : 1.1 (baseline) → 1.2 (propriété de domaine GSC) → déploiement + vérification → contenu. Les correctifs 1.3 à 1.7 sont faits.

**Chemin critique d'origine** : 1.1 → 1.2 → 1.3 → 1.4 → contenu. Les tâches 1.9, 2.1 et 3.2 sont hors chemin critique et doivent être lancées **au plus tôt**, pas à leur tour.

---

## Ressources

| Rôle | Charge | Phase |
|---|---|---|
| ~~Développement (correctifs techniques)~~ | ~~~5 j~~ ✅ fait | Phase 1 |
| Développement (pages publiques d'aide) | ~3 j | Phase 2 |
| Rédaction / production | ~3 j / mois | Phases 2 à 4, continu |
| Suivi et arbitrage | ~1 h / mois | continu |

Poste le plus contraint : **la rédaction**. Le plan est calibré sur 3 pages/mois précisément pour rester tenable. Passer à 4 pages/mois ne se décide qu'après trois mois consécutifs à 3 tenus.

---

## Ce que la roadmap ne couvre pas

- Aucune mesure de performance n'a été effectuée (tâche 1.8 à faire).
- Le profil de backlinks n'a pas été audité (tâche 3.3).
- Les volumes de mots-clés ne sont pas mesurés (tâche 1.1).
- L'internationalisation est reportée au mois 12, délibérément.
- Aucun SEO local : hors périmètre pour un SaaS pur.
