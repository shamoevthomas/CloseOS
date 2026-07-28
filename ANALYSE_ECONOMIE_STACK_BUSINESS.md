# CloseOS Business — « Combien d'outils en un ? Combien ça fait économiser ? »

> Analyse réalisée le 2026-07-28 à partir de la landing page Business
> (`src/pages/BusinessLanding.tsx` + `src/pages/businessLandingI18n.ts`)
> et des tarifs publics 2026 des outils concurrents.
>
> Conversion retenue : **1 $ ≈ 0,92 €**. Tous les prix concurrents sont les
> **tarifs annuels les moins chers** de chaque éditeur — la comparaison est donc
> volontairement **conservatrice** (les paliers supérieurs coûtent 2 à 4× plus).

---

## 1. Cartographie : ce que couvre la LP Business

Les fonctionnalités mises en avant sur la landing page se regroupent en
**15 catégories d'outils SaaS distincts**.

| # | Bloc CloseOS (LP Business) | Catégorie marché | Outils remplacés |
|---|---|---|---|
| 1 | CRM natif, pipeline Kanban, tags illimités, stages custom, import/export CSV (reformatage IA) | CRM commercial | Pipedrive, HubSpot, GoHighLevel, iClosed |
| 2 | Agenda, RDV, booking links, sync Google Calendar bidirectionnelle, dispos & absences par membre | Scheduling | Calendly, TidyCal, Cal.com |
| 3 | Auto-qualification (questionnaire scoré, réponses éliminatoires), assignation auto setter/closer (manuelle, tournante, hasard) | Lead routing & qualification | Chili Piper, LeanData, Default |
| 4 | Pages de capture, embed iframe, popup, précapture, tracking UTM, RDV payants Stripe | Landing pages / funnel | Systeme.io, ClickFunnels, Leadpages, Unbounce |
| 5 | Module Formulaires (éditeur « / », 20+ blocs, logique conditionnelle, vidéo à visionnage obligatoire, pont CRM) | Form builder | Tally, Typeform, Jotform |
| 6 | Relances automatiques (jusqu'à 7 emails No Show avec lien de rebooking intégré), rappels | Email automation | Brevo, ActiveCampaign, Lemlist |
| 7 | Cockpit d'appel plein écran + enregistrement écran/micro | Call recording / revenue intelligence | Fathom, tl;dv, Modjo, Gong |
| 8 | Google Meet intégré | Visio | Zoom, Whereby |
| 9 | KPI 3 onglets (Organisation / Offre / Membre), 8 KPI globaux, graphiques, export PDF, Monday Morning Reporting auto | Dashboard BI / reporting | Geckoboard, Databox, Looker Studio |
| 10 | Commissions par closer, matching Stripe, marge nette, MRR, churn, charges fixes/variables | Commission management | QuotaPath, Everstage, Spiff |
| 11 | Facturation (comptant / échelonné, PDF, lien Stripe, validation Owner) | Logiciel de facturation | Abby, Henrri, Pennylane, QuickBooks |
| 12 | **CloseOS Sign inclus** (signature + paiement, multi-signataire, certificat de preuve) | Signature électronique | Yousign, DocuSign, PandaDoc |
| 13 | Liens de tracking courts, clics par pays / appareil / visiteur unique, globe interactif | Short links / attribution | Dub, Bitly, Rebrandly |
| 14 | Onboarding closers : scripts, playbooks, vidéos, ressources, suivi de progression | LMS / onboarding interne | Trainual, Notion, Teachable |
| 15 | API REST + Webhooks signés HMAC + serveur MCP (28 outils) | Automatisation no-code | Zapier, Make, n8n |

**Sans équivalent sur le marché :** le serveur MCP (piloter le CRM en langage
naturel depuis Claude / ChatGPT). Aucun concurrent de ces 15 catégories ne le
propose aujourd'hui.

---

## 2. Scénario A — Solo (1 utilisateur)

**CloseOS Solo : 39 €/mois** (28 €/mois en annuel) — CloseOS Sign inclus.

| Catégorie | Outil de référence | Prix/mois |
|---|---|---:|
| CRM | Pipedrive Growth (39 $) | 36 € |
| Scheduling | Calendly Standard (10 $) | 9 € |
| Landing / funnel | Systeme.io Startup (17 $) | 16 € |
| Formulaires | Tally Pro (24 $) | 22 € |
| Call recording | Fathom Premium (16 $) | 15 € |
| Email automation | Brevo Starter (25 $) | 23 € |
| Dashboard KPI | Geckoboard Essential (44 $) | 40 € |
| Liens de tracking | Dub Pro (19 $) | 17 € |
| Signature électronique | Yousign Starter | 9 € |
| Facturation | Abby | 9 € |
| Automatisation | Zapier Professional (20 $) | 18 € |
| **TOTAL — 11 abonnements** | | **≈ 214 €** |

### Résultat

| | Stack éclatée | CloseOS Solo |
|---|---:|---:|
| Par mois | 214 € | 39 € |
| Par an | 2 568 € | 468 € |
| **Économie** | | **≈ 175 €/mois — 2 100 €/an** |
| **Facteur** | | **5,5× moins cher** |

---

## 3. Scénario B — Équipe de 5 (owner + 4 closers/setters)

**CloseOS Business + Acquisition : 99 €/mois**, 5 équipiers inclus,
CloseOS Sign inclus.

| Catégorie | Outil de référence | Calcul | Prix/mois |
|---|---|---|---:|
| CRM | Pipedrive Growth | 36 € × 5 | 180 € |
| Scheduling | Calendly Teams | 15 € × 5 | 75 € |
| Lead routing | Chili Piper Distro (+ frais plateforme) | 28 € × 5 + 138 € | 278 € |
| Call recording | Fathom Team | 17 € × 5 | 85 € |
| Commissions | QuotaPath Essential | 23 € × 5 | 115 € |
| Onboarding / LMS | Trainual | 23 € × 5 | 115 € |
| Landing / funnel | Systeme.io Startup | flat | 16 € |
| Formulaires | Tally Pro | flat | 22 € |
| Email automation | Brevo Business | flat | 60 € |
| Dashboard KPI | Geckoboard | flat | 40 € |
| Liens de tracking | Dub Business | flat | 45 € |
| Signature électronique | Yousign Business | flat | 25 € |
| Facturation | Abby | flat | 9 € |
| Automatisation | Zapier Team | flat | 63 € |
| **TOTAL — 14 abonnements** | | | **≈ 1 128 €** |

### Résultat

| | Stack éclatée | CloseOS B+A |
|---|---:|---:|
| Par mois | 1 128 € | 99 € |
| Par an | 13 536 € | 1 188 € |
| **Économie** | | **≈ 1 030 €/mois — 12 350 €/an** |
| **Facteur** | | **11× moins cher** |

### Variante « stack réaliste » (sans Chili Piper ni Trainual)

Beaucoup d'infopreneurs ne paient pas ces deux postes (routing fait à la main,
onboarding sur Notion). On retombe alors à **≈ 735 €/mois** :

- Économie : **≈ 636 €/mois — 7 630 €/an**
- Facteur : **7,4× moins cher**

C'est le chiffre le plus défendable en public.

---

## 4. Synthèse chiffrée pour la communication

| Message | Chiffre | Solidité |
|---|---|---|
| Nombre d'outils remplacés | **1 outil au lieu de 14** (15 catégories, 14 payantes) | ✅ Très solide |
| Économie solo | **≈ 175 €/mois — 2 100 €/an** | ✅ Solide (tarifs annuels bas) |
| Économie équipe de 5 | **≈ 1 000 €/mois — 12 000 €/an** | ✅ Solide |
| Économie équipe, version prudente | **≈ 640 €/mois — 7 600 €/an** | ✅ Inattaquable |
| Facteur prix | **5× à 11× moins cher** | ✅ Solide |

### L'argument non-monétaire (souvent plus fort)

La bio fondateur de la LP mentionne déjà **1h à 1h30 perdue chaque jour** à
mettre à jour des outils qui ne se parlent pas. Sur une équipe de 5 :

- ~30 h/mois par personne → **~150 h/mois de saisie redondante**
- Pour un business qui facture 5 000 € le deal, c'est un argument plus lourd
  que les 1 000 € d'abonnements.

---

## 5. Limites à connaître (pour ne pas se faire attaquer)

La comparaison est honnête sur le **périmètre fonctionnel couvert**, pas sur la
**profondeur** de chaque brique :

- Pipedrive à 36 €/siège fait plus de choses en CRM pur (prévisions, séquences
  avancées, rapports custom) que le CRM CloseOS.
- Typeform / Tally font plus de choses en formulaires (calculs, paiements
  multiples, marketplace d'intégrations).
- Gong / Modjo font de l'analyse conversationnelle IA que CloseOS ne fait pas.

**Formulation à tenir :** « tout ce dont un business de closing a besoin »,
**jamais** « tout ce que fait chaque outil ». Sinon un prospect technique tape
directement dans la faille.

Autre point : Zapier n'est remplacé que **partiellement** (API REST + Webhooks
natifs couvrent les cas branchés, pas les 7 000 intégrations no-code). La LP le
dit déjà correctement en positionnant Zapier/Make/n8n comme *intégrations*, pas
comme concurrents — garder cette nuance.

---

## 6. Sources (tarifs publics, juillet 2026)

- Pipedrive — https://costbench.com/software/crm/pipedrive/
- Calendly — https://costbench.com/software/scheduling/calendly/
- iClosed — https://www.iclosed.io/pricing
- Typeform — https://costbench.com/software/survey-software/typeform/
- Tally — https://tally.so/help/plans-and-pricing
- Fathom — https://www.g2.com/products/fathom-video/pricing
- QuotaPath — https://www.quotapath.com/pricing/
- Yousign / DocuSign — https://stackindep.fr/signature-electronique/yousign-prix
- Systeme.io / ClickFunnels / Leadpages — https://landingi.com/systeme-io/alternative/
- Geckoboard / Databox — https://www.basedash.com/blog/best-kpi-tracking-software-compared-2026
- Dub / Bitly — https://dub.co/blog/bitly-vs-tinyurl
- Trainual — https://www.educate-me.co/blog/trainual-pricing
- Zapier — https://www.nocode.mba/articles/zapier-pricing-2026
- Brevo — https://www.emailtooltester.com/en/reviews/brevo/pricing/
- HubSpot / GoHighLevel — https://bestcrmreviews.com/gohighlevel-vs-hubspot
- Chili Piper — https://www.chilipiper.com/pricing
- Abby / Henrri — https://www.portail-autoentrepreneur.fr/academie/gestion-auto-entreprise/facturation/meilleur-logiciel-facturation-auto-entrepreneur
- Zoom — https://costbench.com/software/communication/zoom/
