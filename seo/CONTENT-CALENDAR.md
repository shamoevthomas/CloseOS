# CONTENT-CALENDAR — CloseOS

Période : août 2026 → juillet 2027
Cadence : **3 pages / mois** (borne basse de la fourchette 2–4 annoncée) → **36 pages**
Répartition mensuelle : 1 page Sales **ou** Business (alternance) · 1 page Sign · 1 page TOFU

> Le calendrier est **ordonné par priorité décroissante**. En cas de retard, on décale la fin — on ne saute jamais une ligne du début. Les 6 premiers mois concentrent les opportunités les plus rentables identifiées dans `COMPETITOR-ANALYSIS.md` §6.

> Tous les volumes sont des estimations non mesurées `(est.)`. La tâche 1.1 de la roadmap les valide **avant** le premier mois de production. Si la validation contredit une estimation, réordonner — le calendrier est un plan, pas un contrat.

---

## Mois 0 — août 2026 : correctifs, zéro contenu

**Aucune page produite ce mois-ci, et c'est délibéré.** Publier du contenu sur une architecture dont les canoniques se contredisent revient à alimenter des pages qui ne se positionneront pas. Tout le mois passe sur `SITE-STRUCTURE.md` §5 et la roadmap Phase 1.

Livrables : canoniques corrigées · `/landing` → 301 · sitemap généré au build · garde-fou prérendu · `robots.txt` + `llms.txt` enrichis · Search Console configurée · **baseline mesurée**.

---

## T1 — Fondation (sept. → nov. 2026) · 9 pages

### Septembre 2026

| # | Page | Pilier | Requête cible (est.) | Vol. | Diff. | Notes |
|---|---|---|---|---|---|---|
| 1 | `/aide` + 10 premiers articles | Tous | longue traîne `comment faire X` | cumulé élevé | Très faible | 🔥 **Le contenu existe déjà** (`SalesHelpCenter.tsx`). Travail = rendre public + indexable, pas rédiger. Schema `TechArticle`. |
| 2 | `/sign/signature-et-paiement` | Sign | `signature électronique et paiement` | 50–200 | Très faible | Cœur du différenciateur. Aucun concurrent FR ne la fait. |
| 3 | `/glossaire` + 4 termes (`closer`, `setter`, `high ticket`, `taux de closing`) | TOFU | définitions | 100–400 cumulé | Très faible | Schema `DefinedTerm`. Fenêtre GEO — voir `SEO-STRATEGY.md` §3. |

### Octobre 2026

| # | Page | Pilier | Requête cible (est.) | Vol. | Diff. | Notes |
|---|---|---|---|---|---|---|
| 4 | `/fonctionnalites/liens-de-booking` | Business | `alternative calendly gratuite` | 300–800 | Moyenne | 🔥 **Meilleur ratio volume/difficulté du plan.** Fonctionnalité déjà livrée. |
| 5 | `/sign/securite` (publier l'existante) | Sign | `sécurité signature électronique` | 50–150 | Faible | Route existante non indexée. Page de confiance + E-E-A-T. |
| 6 | `/glossaire` +4 (`cash collecté`, `no-show`, `R1/R2`, `appel de découverte`) | TOFU | définitions | cumulé | Très faible | |

### Novembre 2026

| # | Page | Pilier | Requête cible (est.) | Vol. | Diff. | Notes |
|---|---|---|---|---|---|---|
| 7 | `/business/aide` + 10 articles | Business | longue traîne | cumulé élevé | Très faible | 🔥 `BusinessHelpCenter.tsx` existe déjà. |
| 8 | `/comparatifs/alternative-yousign` | Sign | `alternative yousign` | 100–300 | Moyenne | Angle : signature **+ encaissement**, pas « moins cher ». Vérifier les tarifs Yousign le jour de la publication. |
| 9 | `/guides/recruter-un-closer` | TOFU | `recruter un closer` | 100–400 | Faible | Plus gros volume TOFU. Concurrence = pages de vente de formations → un guide neutre gagne. |

**Point de contrôle T1** — attendu : ~35 pages indexées, premières impressions sur les requêtes de marque et de glossaire. Aucun classement significatif attendu avant le mois 4 : c'est normal, ne pas réagir.

---

## T2 — Expansion (déc. 2026 → févr. 2027) · 9 pages

### Décembre 2026

| # | Page | Pilier | Requête cible (est.) | Vol. | Diff. |
|---|---|---|---|---|---|
| 10 | `/fonctionnalites/formulaires` | Business | `alternative tally français` | 100–300 | Faible |
| 11 | `/comparatifs/alternative-docusign` | Sign | `alternative docusign français` | 100–300 | Moyenne |
| 12 | `/a-propos` | E-E-A-T | marque | faible | — |

`/a-propos` ne vise aucun volume : c'est un signal E-E-A-T (`SEO-STRATEGY.md` §6) et la page que les moteurs génératifs lisent pour établir qui édite le site. Fondateur, parcours, origine du produit, expérience terrain du closing.

### Janvier 2027

| # | Page | Pilier | Requête cible (est.) | Vol. | Diff. |
|---|---|---|---|---|---|
| 13 | `/comparatifs/closeos-vs-notion` | Sales | `notion crm closer`, `template closer notion` | 50–200 | Faible |
| 14 | `/sign/valeur-juridique` | Sign | `valeur juridique signature électronique` | 300–800 | Moyenne |
| 15 | `/guides/remunerer-un-closer` | TOFU | `commission closer`, `rémunérer un closer` | 100–300 | Faible |

⚠️ La page 14 doit être **juridiquement exacte et prudente** : n'affirmer que ce que le produit garantit réellement. Le certificat de preuve documenté dans le dépôt fournit une matière factuelle solide. Une surpromesse sur eIDAS se paierait bien au-delà du SEO.

### Février 2027

| # | Page | Pilier | Requête cible (est.) | Vol. | Diff. |
|---|---|---|---|---|---|
| 16 | `/fonctionnalites/gestion-equipe-closers` | Business | `gérer une équipe de closers`, `logiciel pour setter` | 50–180 | Très faible |
| 17 | `/comparatifs/alternative-gohighlevel` | Business | `alternative gohighlevel français` | 30–100 | Faible |
| 18 | `/guides/kpi-closing-a-suivre` | TOFU | `kpi closing`, `taux de closing` | 100–300 | Faible |

**Point de contrôle T2** — attendu : ~55 pages, 15+ mots-clés en top 10, premières citations IA sur les termes de glossaire.

---

## T3 — Montée en puissance (mars → mai 2027) · 9 pages

### Mars 2027

| # | Page | Pilier | Requête (est.) | Notes |
|---|---|---|---|---|
| 19 | `/fonctionnalites/signature-electronique` | Business↔Sign | `crm avec signature électronique` | **Comble le flux inter-produits inexistant** (`SITE-STRUCTURE.md` §3). Sert le pont CRM→Sign, différenciateur produit réel. |
| 20 | `/integrations` (hub) + `/integrations/stripe` | Tous | `crm intégration stripe` | Hub + première fiche modèle. |
| 21 | `/ressources/iclosed-avis` | Sales | `iclosed avis`, `iclosed tarif` | Requête d'évaluation, en amont de « alternative ». Exactitude impérative. |

### Avril 2027

| # | Page | Pilier | Requête (est.) |
|---|---|---|---|
| 22 | `/cas-usage/infopreneur` | Business | `logiciel pour infopreneur` |
| 23 | `/integrations/hubspot` + `/integrations/pipedrive` | Tous | `hubspot closer`, `pipedrive alternative` |
| 24 | `/guides/gerer-une-equipe-de-setters` | TOFU | `manager des setters` |

### Mai 2027

| # | Page | Pilier | Requête (est.) | Notes |
|---|---|---|---|---|
| 25 | **`/clients/[nom]` — étude de cas n°1** | E-E-A-T | marque + preuve | 🔥 Action à plus fort levier du plan. Chiffres réels, avant/après, verbatim client. Bloquant : accord client — **démarrer la sollicitation dès février**. |
| 26 | `/fonctionnalites/campagnes-acquisition` | Business | `logiciel campagne acquisition` | |
| 27 | `/glossaire` +4 termes | TOFU | définitions | Complète le glossaire à ~12 termes. |

**Point de contrôle T3** — attendu : ~70 pages, 45+ top 10, 18+ top 3, essais organiques mesurables.

---

## T4 — Autorité (juin → juillet 2027 + réserve) · 9 pages

### Juin 2027

| # | Page | Pilier |
|---|---|---|
| 28 | **`/clients/[nom]` — étude de cas n°2** | E-E-A-T |
| 29 | `/fonctionnalites/facturation-automatique` | Sales |
| 30 | `/ressources/[sujet de tête]` | TOFU — sujet choisi sur les données GSC réelles, pas décidé ici |

### Juillet 2027

| # | Page | Pilier |
|---|---|---|
| 31 | `/cas-usage/agence-de-closing` | Business |
| 32 | `/integrations/gohighlevel` + `/integrations/systeme-io` | Tous |
| 33 | `/securite` (plateforme) | Tous — E-E-A-T |

### Réserve (34–36)
Trois créneaux **volontairement non affectés**, à décider sur les données réelles :
- renforcer une page arrivée en page 2 (gain plus rapide qu'une page neuve) ;
- couvrir une requête découverte dans le rapport GSC ;
- répondre à une nouveauté produit ou concurrente.

Un calendrier de 12 mois entièrement figé d'avance ignore l'information la plus utile : ce que les données diront au mois 9.

---

## Répartition finale

| Pilier | Pages | Part | Cible `SEO-STRATEGY.md` §3 |
|---|---|---|---|
| Sales | 6 | 18 % | 25 % |
| Business | 10 | 30 % | 30 % |
| Sign | 6 | 18 % | 25 % |
| TOFU / glossaire / guides | 9 | 27 % | 20 % |
| E-E-A-T (à propos, clients, sécurité) | 5 | 15 % | — |
| Réserve | 3 | — | — |

Écarts assumés : **Sales** est sous-pondéré car il possède déjà les 2 comparatifs et la page `crm-closer` — le rattrapage est moindre. **TOFU** est sur-pondéré au T1 parce que le glossaire est le levier GEO le moins cher et le plus urgent (fenêtre concurrentielle courte). **Sign** est plafonné à 18 % : au-delà, on financerait un marché où la traction reste à démontrer — le point de contrôle à 6 mois (`SEO-STRATEGY.md` §9) décide de l'augmenter ou de le rebasculer vers Business.

---

## Cadence de mise à jour (non comptée dans les 36 pages)

| Fréquence | Action | Charge |
|---|---|---|
| Mensuelle | Relevé GSC + protocole citations IA (§8 stratégie) | 45 min |
| Trimestrielle | Vérification tarifs/fonctionnalités concurrents sur toutes les pages comparatives | 2 h |
| Trimestrielle | Veille concurrentielle (`COMPETITOR-ANALYSIS.md` §7) | 30 min |
| Semestrielle | Rafraîchissement des 5 pages les plus performantes (`dateModified` à jour) | 3 h |

**Le rafraîchissement des pages comparatives n'est pas optionnel.** Une donnée tarifaire périmée sur une page « alternative à X » détruit à la fois la crédibilité auprès du lecteur et le classement.
