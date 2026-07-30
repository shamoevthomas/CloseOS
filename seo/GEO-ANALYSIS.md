# GEO-ANALYSIS — CloseOS

Analyse d'optimisation pour les moteurs génératifs (AI Overviews, ChatGPT, Perplexity)
Date : 2026-07-30 · Domaines : `www.closeos.fr` + `sign.closeos.fr`

> ✅ **Mise à jour du 2026-07-30, après travaux.** Les points 1, 2 et 5 de la section 10 ont été traités dans le dépôt (non déployé) : 39 réponses FAQ étoffées (médiane 38 → 135 mots), soft 404 corrigés avec garde-fou au build, `<main>` ajouté sur 7 pages, `llms-full.txt` créé, désambiguïsation vs Close CRM amorcée dans `llms.txt`. Score dépôt réestimé : **49 → ~62/100**. Restent hors de ma portée : la présence tierce (§10.4), la vidéo, et le déploiement. Détail dans `A-FAIRE.txt`.
>
> ⚠️ **Incohérence de prix détectée pendant les travaux.** Le prix d'entrée de CloseOS Sales est annoncé à 18 €, 25,50 € et 34 € selon la source (page Tarifs, schema `index.html`, page comparatif). Je n'ai propagé aucun de ces chiffres dans les nouvelles réponses. Des tarifs contradictoires sur un même site sont particulièrement nocifs pour la citation par un moteur génératif. À trancher — tâche 8bis d'`A-FAIRE.txt`.

> **Deux états mesurés séparément.** La production tourne sur un build antérieur au dépôt. Les correctifs SEO livrés aujourd'hui ne sont pas déployés. Ce rapport distingue systématiquement **LIVE** (ce que les crawlers IA voient aujourd'hui) de **DÉPÔT** (ce qu'ils verront après déploiement).

---

## 1. Score de préparation GEO

| | LIVE (production) | DÉPÔT (après déploiement) |
|---|---|---|
| **Score global** | **37 / 100** | **49 / 100** |

| Dimension | Poids | LIVE | DÉPÔT | Commentaire |
|---|---|---|---|---|
| Citabilité des passages | 25 % | 8/25 | 10/25 | 33 Q/R en FAQ, **aucune** dans la fenêtre de citation optimale |
| Lisibilité structurelle | 20 % | 10/20 | 12/20 | Hiérarchie propre, mais 4 titres interrogatifs sur 42 |
| Contenu multi-modal | 15 % | 7/15 | 7/15 | Beaucoup d'images légendées, zéro vidéo, zéro donnée visualisée |
| Autorité & signaux de marque | 20 % | 4/20 | 5/20 | **Le point faible critique** — présence tierce nulle |
| Accessibilité technique | 20 % | 8/20 | 15/20 | Prérendu solide, crawlers IA ouverts, mais soft 404 généralisés |

**Lecture.** Le déploiement fait gagner 12 points sans écrire une ligne de contenu — c'est l'action la plus rentable du rapport. Mais il plafonne à 49 : le vrai blocage n'est ni technique ni structurel, il est **externe** (section 5).

---

## 2. Accès des crawlers IA — ✅ bon

Vérifié dans `public/robots.txt`.

| Crawler | Rôle | Statut |
|---|---|---|
| GPTBot | OpenAI — index ChatGPT | ✅ autorisé explicitement |
| ChatGPT-User | ChatGPT navigation | ✅ autorisé explicitement |
| PerplexityBot | Perplexity | ✅ autorisé explicitement |
| ClaudeBot | Claude | ✅ autorisé explicitement |
| OAI-SearchBot | OpenAI — **citations ChatGPT search** | 🟡 non déclaré |
| Perplexity-User | Perplexity navigation | 🟡 non déclaré |
| Applebot-Extended, meta-externalagent, cohere-ai, Bytespider, Amazonbot | divers | 🟡 non déclarés |
| CCBot | Common Crawl (entraînement) | 🚫 bloqué — **délibéré** |
| Google-Extended | entraînement Gemini | 🚫 bloqué — **délibéré** |

**Nuance importante, et rassurante.** « Non déclaré » ne veut pas dire bloqué : ces agents retombent sur le bloc `User-agent: *`, qui commence par `Allow: /` et n'interdit que les routes applicatives. **OAI-SearchBot et Perplexity-User ont donc bien accès aux pages publiques.** Les déclarer explicitement relève de la lisibilité, pas du déblocage. Ce n'est pas un problème.

`Google-Extended: Disallow` bloque l'entraînement Gemini **sans** bloquer Googlebot ni les AI Overviews. C'est un choix cohérent, documenté dans `robots.txt` pour éviter qu'on le « corrige » par erreur.

---

## 3. `llms.txt` — l'écart LIVE / DÉPÔT le plus coûteux

| | LIVE | DÉPÔT |
|---|---|---|
| Taille | **117 mots** | **608 mots** |
| Produits décrits | Sales, Business | Sales, Business, **Sign** |
| Section FAQ | ❌ | ✅ 6 Q/R |
| Valeur juridique / preuves | ❌ | ✅ |
| Tarifs | ❌ | ✅ |

La version en ligne ne mentionne pas CloseOS Sign, ne donne aucun prix et n'a aucune FAQ. La version du dépôt est bonne. **C'est le fichier que les moteurs génératifs lisent en priorité pour se faire une idée d'un domaine** — et il est actuellement périmé en production.

Absents (impact faible, à considérer plus tard) :
- `/llms-full.txt` — version longue, utile quand le corpus grossira (après publication des centres d'aide)
- **RSL 1.0** (`/rsl.xml`) — licence lisible par machine, standard de décembre 2025. Pas encore un facteur de citation ; à surveiller.

---

## 4. Citabilité des passages — 🔴 le défaut technique n°1

La fenêtre de citation optimale est de **134-167 mots** par bloc de réponse autonome. Mesure sur les données `FAQPage` réellement produites :

| Page | Q/R | Mots par réponse (min / médiane / max) | Dans la cible |
|---|---|---|---|
| `/business` | 11 | 34 / 58 / 111 | **0** |
| `/sales` | 7 | 32 / 45 / 74 | **0** |
| `/sign` | 6 | 34 / 42 / 47 | **0** |
| `/tarifs` | 6 | 17 / 32 / 47 | **0** |
| `/comparatifs/closeos-vs-iclosed` | 3 | 23 / 25 / 26 | **0** |

**33 questions-réponses, aucune dans la fenêtre de citation.** Les réponses sont environ **trois fois trop courtes**. Elles sont bonnes pour un humain qui scanne, mais un moteur génératif n'a pas assez de matière autonome à extraire : il ira citer une source plus développée.

C'est une excellente nouvelle en termes d'effort : **la structure est déjà là, il n'y a qu'à étoffer**. Passer 33 réponses de ~45 à ~145 mots est une journée de rédaction, sans aucun changement technique, et c'est probablement le meilleur euro/heure de tout le plan GEO.

### Deux autres freins à l'extraction

**Le texte de navigation pollue l'ouverture de chaque page.** Les 60 premiers mots de `/sales` commencent par : `Fonctionnalités Rôles Comparatif Tarifs Partenariat FAQ EN Se connecter Commencer gratuitement…`. Or l'ouverture est précisément ce qu'un extracteur privilégie. Aggravant : `<main>` n'est présent que sur `/business`, et sur aucune des quatre autres pages clés — rien n'indique à un parseur où commence le contenu.

**Les H1 sont des slogans, pas des définitions.** « Le CRM pour closer tout-en-un. Récupérez 10h par semaine. » vend bien à un humain, mais ne répond pas à « qu'est-ce que… ». Les modèles privilégient les formulations `X est…` / `X désigne…`.

**La meilleure page du site, et pourquoi.** `/comparatifs/closeos-vs-iclosed` ouvre sur :

> « iClosed est un outil de booking et de qualification de leads. CloseOS est un CRM complet pour closers avec… »

Deux entités définies, une distinction nette, aucun superlatif : c'est un passage directement citable. **C'est le modèle à répliquer sur toutes les autres pages.**

---

## 5. Signaux de marque — 🔴 le vrai plafond

L'étude Ahrefs de décembre 2025 (75 000 marques) établit que **les mentions de marque corrèlent environ 3× plus fortement avec la visibilité IA que les backlinks** (YouTube ~0,737 ; Domain Rating ~0,266).

| Signal | Statut |
|---|---|
| Wikipedia / Wikidata | ❌ absent |
| YouTube (mentions tierces) | ❌ aucune trouvée |
| Reddit | ❌ aucune trouvée |
| Appvizer / Capterra FR / GetApp | ❌ absent |
| Trustpilot | ❌ absent |
| LinkedIn | 🟡 profil fondateur en `sameAs`, pas de page entreprise référencée |
| `sameAs` dans le schema | 🟡 **une seule** URL |

### Trois constats issus des recherches web

**1. Aucune source tierce sur CloseOS n'apparaît dans les résultats indexés.** Les recherches ciblées n'ont retourné aucune page parlant de CloseOS sur les domaines d'autorité testés. L'empreinte externe est, à ce jour, nulle.

**2. Collision de marque sévère.** Une requête « CloseOS CRM avis » est absorbée par **Close CRM**, produit américain bien établi ([Appvizer](https://www.appvizer.fr/relation-client/customer-relationship-management-crm/close-crm), [Capterra](https://www.capterra.com/p/132667/Close-io/), [SoftwareAdvice](https://www.softwareadvice.com/crm/close-io-profile/), [GetApp](https://www.getapp.fr/reviews/91339/close-io)). Les moteurs répondent en décrivant Close, pas CloseOS. **C'est le risque GEO le plus structurel du dossier** : sans désambiguïsation, la marque est invisible par écrasement.

**3. Ce que les modèles « savent » de CloseOS est périmé et partiellement faux.** Les réponses générées décrivent un produit « en V1 avec quelques bugs », un « essai de 10 jours », des fonctions IA « bientôt disponibles », et affirment que CloseOS « a été créé pour les closers, pas pour les Head of Sales ou les infopreneurs » — ce qui contredit frontalement l'existence de CloseOS Business. **CloseOS Sign n'apparaît nulle part.** Ces éléments proviennent manifestement d'une version ancienne du site, pas des sources actuelles.

C'est un diagnostic net : **les modèles ont une fiche périmée de CloseOS et aucune source récente pour la corriger.** C'est exactement ce que le déploiement du `llms.txt` à jour, les FAQ étoffées et une présence tierce viennent réparer.

> ⚠️ **Limite méthodologique assumée.** L'outil de recherche utilisé est indexé sur les États-Unis. Pour une marque exclusivement francophone, ces résultats sont **indicatifs, pas concluants**. À confirmer par le protocole manuel de suivi des citations IA (`SEO-STRATEGY.md` §8), en français, depuis la France.

---

## 6. Rendu serveur — ✅ solide, avec un défaut réel

Les crawlers IA **n'exécutent pas JavaScript**. Sur une application React, c'est habituellement rédhibitoire. Ce n'est pas le cas ici.

`scripts/prerender.mjs` produit du HTML réel pour **17 routes publiques**, avec le contenu, les métas et le JSON-LD. Volume de texte servi sans JS :

| Page | Mots | H2 | H3 | Tableaux | Blocs JSON-LD | FAQPage |
|---|---|---|---|---|---|---|
| `/business` | 3 121 | 11 | 20 | 0 | 5 | ✅ |
| `/sales` | 2 132 | 8 | 21 | 0 | 5 | ✅ |
| `/tarifs` | 1 477 | 9 | 13 | 6 | 4 | ✅ |
| `/sign` | 1 059 | 8 | 2 | 0 | 4 | ✅ |
| `/comparatifs/closeos-vs-iclosed` | 661 | 6 | 6 | 2 | 3 | ✅ |
| `/fonctionnalites` | 528 | 4 | 11 | 1 | 3 | ❌ |
| `/` | 426 | 4 | 3 | 0 | 1 | ❌ |

> 📌 **Correction d'une affirmation précédente.** J'avais écrit dans le plan SEO qu'« aucun `FAQPage` n'existe nulle part ». C'est faux : `FAQPage` est présent sur 5 pages (33 Q/R au total). J'avais lu le `@graph` statique d'`index.html` sans voir les données injectées par les pages. `SITE-STRUCTURE.md` §4 et `A-FAIRE.txt` ont été corrigés. Le problème réel n'est pas l'absence de `FAQPage`, c'est la **longueur des réponses** (§4).

**Écart LIVE / DÉPÔT.** En production, `/sales` et `/sign` ne servent qu'**un seul** bloc JSON-LD (le graphe statique) et **aucun `FAQPage`** : leur prérendu est défaillant. Dans le dépôt corrigé, ils en servent 5 et 4. Là encore, déployer suffit.

### 🔴 Soft 404 généralisés

```
curl https://www.closeos.fr/url-qui-nexiste-pas
→ HTTP 200 · text/html
```

**Toute URL inexistante renvoie 200 avec la coquille HTML.** Le `rewrite` catch-all vers `/index.html` s'applique sans exception. Conséquences :
- un espace d'URL infini répond 200, ce qui gaspille le budget de crawl ;
- `/llms-full.txt`, `/rsl.xml`, `/.well-known/rsl.xml` renvoient **200 avec du HTML** — un crawler qui les demande reçoit une page web au lieu d'un 404 franc, ce qui est pire que l'absence ;
- toute URL erronée citée par un modèle « fonctionne », ce qui empêche la correction naturelle.

**Correctif** : servir un vrai 404 (statut HTTP 404) pour les chemins non routés, en particulier ceux portant une extension de fichier (`.txt`, `.xml`, `.json`, `.php`).

---

## 7. Contenu multi-modal — 🟡

Le multi-modal augmente les taux de sélection d'environ 156 %.

| Élément | Statut |
|---|---|
| Images avec `alt` descriptif | ✅ **excellent** — 60/60 sur `/sales`, 55/57 sur `/business` |
| Illustrations SVG inline | ✅ abondantes (188 à 291 par page) |
| Vidéo (embed ou lien) | ❌ **aucune sur toutes les pages** |
| Graphiques / données visualisées | ❌ aucun dans le HTML prérendu |
| Outils interactifs | 🟡 comparateur de prix sur `/tarifs`, **mais en JS pur** — invisible sans exécution |
| Tableaux comparatifs | 🟡 6 sur `/tarifs`, 2 sur le comparatif, **0 sur `/sales` et `/business`** |

**Deux angles morts concrets.** `/sales` et `/business` présentent leurs tarifs et leurs comparaisons **sans aucun tableau HTML** — donc sous une forme que les modèles n'extraient pas. Et le comparateur de prix, qui est exactement le type de contenu original que les moteurs aiment citer, est invisible pour eux : sa conclusion chiffrée devrait être doublée en texte statique.

L'absence totale de vidéo est notable au vu de la corrélation YouTube (~0,737, le signal le plus fort mesuré).

---

## 8. Lisibilité structurelle — 🟡

**Titres formulés en question** — c'est le format qui correspond aux requêtes réelles :

| Page | H2 interrogatifs |
|---|---|
| `/tarifs` | 3 / 9 |
| `/business` | 1 / 11 |
| `/sales` | 0 / 8 |
| `/sign` | 0 / 8 |
| `/comparatifs/closeos-vs-iclosed` | 0 / 6 |
| **Total** | **4 / 42 (10 %)** |

Les titres actuels sont des accroches commerciales : « Le moment de la signature est votre pic émotionnel. Ne le brisez pas. », « Arrêtez de payer pour 10 outils. » Excellent en conversion, nul en appariement de requête.

**Balises sémantiques** : `<main>` sur 1 page sur 5, `<article>` sur aucune, `<header>` sur 1. Les `<section>` sont bien utilisées (8 à 12 par page).

---

## 9. Optimisation par plateforme

| Plateforme | Sources citées | Position CloseOS | Priorité |
|---|---|---|---|
| **Google AI Overviews** | 92 % de pages du top 10 | Dépend du SEO classique → couvert par le plan SEO | Suivre le plan |
| **ChatGPT** | Wikipedia 47,9 %, Reddit 11,3 % | ❌ absent des deux | 🔴 Présence entité |
| **Perplexity** | Reddit 46,7 %, Wikipedia | ❌ absent des deux | 🔴 Présence entité |
| **Bing Copilot** | index Bing, IndexNow | 🟡 Bing Webmaster Tools non confirmé | 🟡 Inscription |

**Seulement 11 % des domaines sont cités à la fois par ChatGPT et par les AI Overviews** pour une même requête : les deux jeux d'optimisations sont distincts et non substituables. Le plan SEO couvre bien les AI Overviews. **Il ne couvre pas ChatGPT ni Perplexity**, qui dépendent massivement de Reddit et Wikipedia — deux terrains où CloseOS n'existe pas.

---

## 10. Les 5 changements à plus fort impact

### 1. 🚀 Déployer — +12 points, zéro rédaction
`llms.txt` passe de 117 à 608 mots et mentionne enfin Sign ; `/sales` et `/sign` retrouvent leur `FAQPage` et leur schéma produit ; les canoniques cessent de se contredire. **Rien d'autre dans ce rapport ne rapporte autant pour aussi peu.**

### 2. ✍️ Étoffer les 33 réponses FAQ à 134-167 mots
Aucune n'est dans la fenêtre de citation ; elles sont ~3× trop courtes. La structure et les questions existent déjà. **≈ 1 journée de rédaction, aucun changement technique.** Priorité : `/sign` et `/tarifs` (les questions les plus factuelles, donc les plus citables).

### 3. 🏷️ Désambiguïser la marque face à « Close CRM »
Aujourd'hui les moteurs répondent en décrivant un autre produit. Actions :
- écrire systématiquement **« CloseOS »** en un mot, jamais « Close OS » ;
- accoler un qualificatif dans les `<title>` et les définitions : *« CloseOS, la suite française du closing high ticket »* ;
- élargir `sameAs` dans le schema `Organization` (LinkedIn entreprise, YouTube, Product Hunt, Appvizer, Crunchbase) — c'est le mécanisme par lequel un moteur relie les mentions à **une** entité ;
- publier une définition en une phrase, répétée **à l'identique** sur tout le site.

### 4. 🌐 Créer une empreinte tierce — le seul levier qui débloque ChatGPT et Perplexity
Par ordre de rendement :
1. Fiches **Appvizer** et **Capterra France** (fortement reprises par les AI Overviews en français)
2. **YouTube** — 2 ou 3 démos produit ; corrélation la plus forte mesurée (~0,737)
3. **Reddit** — participation authentique sur r/entrepreneur_fr, r/freelance_fr (46,7 % des citations Perplexity). ⚠️ L'autopromotion y est sanctionnée : contribuer, pas placer des liens
4. **Trustpilot** — collecte d'avis clients
5. **Wikidata** avant Wikipedia (seuil d'admissibilité bien plus bas, et Wikidata alimente les graphes d'entités)

### 5. 🛠️ Corriger les soft 404 et rendre le contenu extractible
- vrai statut 404 pour les chemins non routés (surtout à extension de fichier) ;
- `<main>` sur les 4 pages qui en manquent ;
- ouvrir chaque page par 2-3 phrases définitionnelles avant tout argumentaire ;
- convertir en **tableaux HTML** les prix et comparaisons de `/sales` et `/business` ;
- doubler la conclusion chiffrée du comparateur de prix en texte statique.

---

## 11. Schema — recommandations

Existant (bon niveau) : `Organization`, `Person` (fondateur), `WebSite`, 3× `WebApplication` (Sign ajouté aujourd'hui), `BreadcrumbList`, 5× `FAQPage`.

| À ajouter | Où | Pourquoi |
|---|---|---|
| `sameAs` élargi | `Organization` | **Le plus important** : désambiguïsation d'entité (§10.3) |
| `DefinedTerm` + `DefinedTermSet` | `/glossaire` | Peu utilisé en français ; associe CloseOS à la définition d'un terme métier |
| `TechArticle` | centres d'aide | Format très cité par les moteurs génératifs |
| `Article` + `author` → `@id` fondateur + `datePublished` / `dateModified` | blog, guides | Aucune page n'a de date ni d'auteur aujourd'hui |
| `HowTo` | guides pas-à-pas | Directement extractible |
| `VideoObject` | après production vidéo | — |
| `Review` / `AggregateRating` | après Trustpilot | ⚠️ uniquement sur avis réels et vérifiables |
| `FAQPage` | `/fonctionnalites`, `/` | Les 2 pages publiques qui en manquent |

---

## 12. Passages à réécrire — exemples concrets

**`/sales` — ouverture actuelle**
> Le CRM pour closer tout-en-un. Récupérez 10h par semaine.

**Proposition** (définition d'abord, promesse ensuite)
> CloseOS Sales est un CRM conçu pour les closers indépendants francophones. Il réunit dans un seul outil le pipeline de vente, la Call Room, l'agenda et les liens de réservation, la facturation automatique et les KPIs de closing — là où un closer utilise habituellement six à dix logiciels distincts. Comptez à partir de 18 €/mois, avec un essai gratuit sans engagement.

**`/sign` — ouverture actuelle**
> Signez le contrat, encaissez le paiement. Dans le même geste.

**Proposition**
> CloseOS Sign est une solution de signature électronique qui intègre l'encaissement. Le signataire signe le contrat et règle le paiement — acompte, solde ou abonnement — au même endroit et dans le même flux, là où les outils de signature classiques s'arrêtent à la signature. Chaque signature est accompagnée d'un faisceau de preuves : journal d'événements horodaté et inaltérable, empreinte SHA-256 du document calculée côté serveur, vérification du signataire par code email ou SMS, et certificat de preuve vérifiable en ligne.

**Titres à reformuler en questions**

| Actuel | Proposé |
|---|---|
| « Un seul outil. Trois manières de l'utiliser. » | « Comment un closer indépendant utilise-t-il CloseOS ? » |
| « Pas juste une signature. Un faisceau de preuves inattaquable. » | « Quelle est la valeur juridique d'une signature CloseOS Sign ? » |
| « Combien vous économisez vraiment » | « Combien coûte CloseOS par rapport à une stack d'outils séparés ? » |
| « Chaque rôle a ses outils. » | « Quels rôles peut-on gérer dans une équipe de closing ? » |

Conserver les accroches commerciales en **sur-titre** ou en `<p>` juste sous le H2 : on garde la conversion et on gagne l'appariement de requête.

---

## 13. Ce que ce rapport ne couvre pas

- **Aucune mesure réelle de citation IA.** Le protocole manuel (`SEO-STRATEGY.md` §8) n'a pas encore tourné une seule fois. C'est la seule donnée qui compte vraiment, et elle est à zéro relevé.
- **Recherche web indexée sur les États-Unis** — indicatif seulement pour une marque francophone (§5).
- **Aucun outil de suivi LLM** (DataForSEO `ai_optimization` non connecté) : pas de mesure de part de voix sur les réponses IA.
- **Aucune analyse de performance** — le temps de réponse influence l'exploration ; audit à mener (`IMPLEMENTATION-ROADMAP.md` tâche 1.8).
- **Le contenu Business/Sign non prérendu** (application privée) est hors périmètre, et c'est correct.
