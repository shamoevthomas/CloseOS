# CloseOS Sign — Documentation complète

> Module de **signature électronique** (+ paiement) de CloseOS, sur `sign.closeos.fr`.
> Ce document décrit **toutes les fonctionnalités et leur fonctionnement** : création de contrats,
> multi-signataire, vérifications d'identité, paiement « Payé + signé », parcours signataire,
> **certificat de preuve**, sécurité, conservation RGPD, schéma de base et Edge Functions.
>
> Pour la **direction artistique** (couleurs, composants visuels), voir [`Sign.md`](./Sign.md).

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Authentification](#2-authentification)
3. [Pages & routes](#3-pages--routes)
4. [Création & édition d'un contrat](#4-création--édition-dun-contrat)
5. [Multi-signataire](#5-multi-signataire)
6. [Vérification d'identité](#6-vérification-didentité)
7. [Paiement « Payé + signé »](#7-paiement--payé--signé-)
8. [Envoi & liens de signature](#8-envoi--liens-de-signature)
9. [Parcours signataire](#9-parcours-signataire)
10. [Certificat de preuve](#10-certificat-de-preuve)
11. [Sécurité & immuabilité](#11-sécurité--immuabilité)
12. [Conservation & RGPD](#12-conservation--rgpd)
13. [Schéma de base de données](#13-schéma-de-base-de-données)
14. [Edge Functions](#14-edge-functions)
15. [Modèle de statuts](#15-modèle-de-statuts)
16. [Limites connues & hors-scope](#16-limites-connues--hors-scope)

---

## 1. Vue d'ensemble

**CloseOS Sign** permet de créer un contrat (texte rédigé dans l'app **ou** PDF importé),
d'y poser des **champs à remplir/signer**, puis de l'envoyer à un ou plusieurs **signataires**
qui le remplissent, vérifient leur identité (selon le mode choisi), paient si demandé, et signent.
À la fin, un **certificat de preuve** est généré et envoyé automatiquement à toutes les parties.

- **Module isolé** du reste de CloseOS : tables Supabase préfixées `sign_*`, **séparation stricte**
  des comptes (un email Sales/Business ne peut pas avoir de compte Sign et inversement).
- **Stack** : Vite + React 19 + TypeScript + TailwindCSS ; Supabase (Postgres + Storage + Edge Functions Deno) ;
  Stripe Connect (paiement) ; Brevo (emails) ; ClickSend (SMS).
- **DA** : fond sombre `#191E1E`, accent **lime** `#CEFF8F` (signataire) / **mint** `#A0E7EC` (propriétaire). Voir `Sign.md`.
- **Génération PDF** : côté client (`jspdf` + `html2canvas` + `jspdf-autotable` + `qrcode`).
- **Niveau de signature** : **signature électronique simple documentée**. Pas de signature qualifiée / horodatage qualifié.

### Rôles
- **Propriétaire (émetteur)** : crée et configure le contrat, place ses propres champs, suit la signature.
- **Signataire(s)** : reçoivent un lien, remplissent leurs champs, se vérifient, signent (et paient si requis).
  Le propriétaire **n'est pas** un « signataire » au sens de la liste : il a son propre rôle (`owner`).

---

## 2. Authentification

> ⚠️ **MVP** : l'auth Sign définitive n'est pas branchée. Tout est rattaché à un **compte bypass** unique.

- `BYPASS_SIGN_USER_ID = '00000000-0000-0000-0000-0000000000aa'`, `BYPASS_OWNER_EMAIL = 'demo@sign.closeos.fr'`.
- Connexion via `localStorage` (page `/sign/login`, helper `src/lib/signAuth.ts`).
- Tous les contrats/contacts créés appartiennent au compte bypass.
- Séparation des comptes garantie par le trigger `sign_enforce_account_separation` sur `sign_users`.

---

## 3. Pages & routes

| Route | Page | Accès | Rôle |
|-------|------|-------|------|
| `/sign` | `SignLanding` | public | Landing marketing |
| `/sign/login` | `SignLogin` | public | Connexion (MVP localStorage) |
| `/sign/app` | `SignHome` | proprio | Tableau de bord (stats, contrats récents) |
| `/sign/app/nouveau` | `SignNewContract` | proprio | Choix du point de départ d'un contrat |
| `/sign/app/contrat/:id` | `SignContractEditor` | proprio | **Éditeur** de contrat |
| `/sign/app/contrats` | `SignContracts` | proprio | Liste des contrats + filtres |
| `/sign/app/contacts` `/:id` | `SignContacts` / `SignContactDetail` | proprio | Carnet de contacts + fiche/dossier |
| `/sign/app/profil` | `SignProfile` | proprio | Profil + paramètres (dont connexion Stripe) |
| `/sign/s/:token` | `SignPublic` | **signataire** (par token) | Page publique de signature |
| `/sign/verify/:certificateId` | `SignVerify` | **public** | Vérification d'un certificat par son ID |

---

## 4. Création & édition d'un contrat

Éditeur : `src/pages/SignContractEditor.tsx`. Données : `src/lib/signContracts.ts`.

### Deux sources de document
- **Texte (`source_type='text'`)** : feuille A4 éditable (mise en forme riche, pagination A4 automatique).
- **PDF importé (`source_type='pdf'`)** : le PDF est rendu via `pdf.js` ; on pose les champs **en glisser-déposer**.

### Champs
Deux placements :
- **Inline** (`placement='free'` côté table mais « dans le texte ») : puces `<span class="sign-field">` insérées dans le contenu (mode texte). Stockées dans le HTML ; valeurs dans `sign_contracts.inline_values` / par signataire.
- **Libres / overlay** (`placement='free'`) : champs positionnés librement (x/y/page), table `sign_contract_fields`.

**Types de champs** : `signature`, `checkbox` (« Lu et approuvé »), `name`, `email`, `tel`, `address`,
`siret`, `siren`, `tva`, `company_id`, `ape`, `date`, `time`, `city`, `text`. (`initials` = legacy, rendu comme signature.)

Chaque champ porte :
- un **rôle** : `owner` (propriétaire) ou `signer` (signataire) ;
- un **`signer_index`** : `null` pour le propriétaire, `1..N` pour le signataire concerné ;
- une **couleur** dérivée du rôle/index (`src/lib/signColors.ts`).

### Préremplissage
Le propriétaire peut **assigner un contact** au signataire sélectionné : les champs `email`, `tel`, `address`
(et identité entreprise) sont préremplis depuis la fiche contact.

### Flux de validation (éditeur)
1. **Pop-up Titre** (toujours en premier) → on nomme le contrat.
2. **Confirmation** → le contenu est figé (pagination « bakée »), `status` passe `draft → pending`, `locked=true`.
3. Si le propriétaire a des champs → **mode « remplir ma partie »** (préremplissage depuis son profil) avant l'envoi.

Autres actions éditeur : **Dupliquer** (copie tout sauf l'assignation contact), **Modifier** (revenir en édition), **Retour** → liste des contrats.

---

## 5. Multi-signataire

Un contrat peut avoir **1 à 10 signataires**. Chaque signataire = une ligne de la table `sign_contract_signers`
(le propriétaire n'y figure pas).

### Réglages dans l'éditeur (panneau latéral)
- **Nombre de signataires** : contrôle `[−] N [+]`. À la baisse, les champs des signataires retirés sont supprimés (après confirmation).
- **Ordre de signature** (roue ⚙️) :
  - **Parallèle** (défaut) : « tout le monde peut signer quand il veut » → tous reçoivent leur lien en même temps.
  - **Séquentiel** : « à la suite » → signataire 1, puis 2, puis 3… Le suivant est notifié **automatiquement (côté serveur)** dès que le précédent a signé.
- **Sélecteur « Champs pour… »** : `Signataire 1 … N` + `Propriétaire`. Le choix détermine à qui appartiennent les champs posés. **Chaque signataire a sa couleur** (champs libres + puces inline).
- **Contact par signataire** : l'assignation et le préremplissage se font pour le signataire sélectionné.

### Tokens & valeurs par signataire
- Chaque signataire a son **propre `access_token`** → son **propre lien** `/sign/s/<token>`.
- Les **valeurs inline** sont stockées **par signataire** (`sign_contract_signers.inline_values`) → pas d'écrasement entre signataires en mode parallèle (anti-race). L'affichage **fusionne** propriétaire + tous les signataires.

### Complétion
Le contrat passe `signed` **uniquement quand tous les signataires ont signé** (logique serveur centralisée
`advanceAfterSignerDone`). C'est aussi le moment où le **certificat** est généré.

---

## 6. Vérification d'identité

La **méthode de vérification est GLOBALE au contrat** ; les **listes blanches sont PAR signataire**.

| Méthode (`verification_method`) | Description |
|---|---|
| `none` | Aucune vérification — le signataire signe directement. |
| `email` | Code à 6 chiffres envoyé par **email** (Brevo) à une adresse autorisée. |
| `sms` | Code à 6 chiffres envoyé par **SMS** (ClickSend) à un numéro autorisé. |
| `email_sms` | **Double** : email PUIS SMS **du même couple** (anti-croisement). |

> ⚠️ Le **paiement n'est plus une méthode de vérification** : c'est un axe **indépendant** (voir §7).

### Listes blanches par signataire
Pour `email`/`sms`/`email_sms`, chaque signataire a ses propres adresses/numéros/couples autorisés
(colonnes `verification_emails`, `verification_phones`, `verification_pairs` sur `sign_contract_signers`).
Réglées dans le pop-up « Style de vérification » (`VerificationStyleModal`), section par signataire.
**Chaque signataire doit avoir au moins une entrée**, sinon il ne pourrait pas se vérifier.

### Déroulé côté signataire (`SignVerificationModal`)
Au clic sur le champ signature, modale en 2 étapes :
1. **Saisie de la destination** : le signataire saisit lui-même son email/numéro → le serveur vérifie qu'il est dans **sa** liste blanche, puis envoie le code **à cette seule adresse**.
2. **Saisie du code** → le pad de signature est débloqué.

Codes **hachés SHA-256** côté serveur, jamais exposés au navigateur. Table `sign_verification_codes`
(colonnes `signer_index` + `channel` pour isoler les codes par signataire et par canal).

### Anti-brute-force / blocage
Par **signataire** :
- **3 essais** à l'étape 1 (destination), **3 essais** à l'étape 2 (code), **3 renvois** max avec **90 s** d'écart.
- Au 3ᵉ échec → `verification_locked=true` (+ raison/étape). La page signataire se **floute** avec un **cadenas**.
- Le **propriétaire reçoit un email** (lien de déblocage) ; l'éditeur affiche une **bannière + bouton Débloquer** (réinitialise les compteurs).
- Chaque échec est journalisé en événement `security` (la coordonnée tentée hors-whitelist est **stockée en clair côté plateforme** mais **masquée** dans le certificat).

---

## 7. Paiement « Payé + signé »

Axe **indépendant** de la vérification (un même signataire peut **vérifier par SMS *et* payer**).
Backend : Edge Function `sign-pay` (Stripe **Connect**, *destination charges*). Commission CloseOS = **2 %**.

### Configuration (propriétaire)
- Connexion du compte Stripe du proprio : page **Profil → Paramètres** (`sign-pay connect` / `connect-status`).
- Pop-up **Paiement** dédié (`PaymentConfigModal`, bouton « Paiement : Activé/Sans » dans l'éditeur) :
  - **Activer le paiement** (`payment_enabled`).
  - **Prix** ; **One-shot** ou **Abonnement** (fréquence mensuel/trimestriel/annuel, durée à vie/X mois, jours d'essai gratuit).
  - **TVA** optionnelle (taux %, aperçu HT/TVA/TTC).
  - **Qui paie ?** : **tout le monde** OU **un signataire précis** → `payment_required` posé sur les lignes signataires concernées.

### Côté signataire
À la validation, si le signataire est **payeur** : modale Stripe (`SignPaymentModal`) →
- **One-shot** → `PaymentIntent` (`confirmPayment`).
- **Abonnement** → `Subscription` (`default_incomplete`) ; essai gratuit → `SetupIntent` (`confirmSetup`, 0 € débité).
- Au succès, `sign-pay confirm` **revérifie côté serveur** que le paiement est passé **ET** que la vérification d'identité (si requise) est satisfaite, puis scelle la signature.

Le contrat ne passe `payment_status='paid'` que lorsque **tous les payeurs requis** ont payé.

> **v1** : pas de webhook Stripe — les échéances/échecs d'abonnement sont gérés par Stripe, non suivis dans CloseOS.

---

## 8. Envoi & liens de signature

- **« Envoyer pour signature »** : modale **multi-lignes** (un nom + email par signataire, préremplis depuis les contacts), un seul bouton **Envoyer** (`sendForSignatureMulti`).
  - **Parallèle** → tous les emails partent immédiatement.
  - **Séquentiel** → seul le signataire 1 reçoit son lien ; les suivants sont notifiés **automatiquement par le serveur** à chaque signature.
- **« Copier le(s) lien(s) »** : pop-up listant **un lien par signataire** (chacun avec bouton copier).
- Emails envoyés via Brevo (`/api/send-email`, expéditeur `support@closeos.fr`).

---

## 9. Parcours signataire

Page publique `src/pages/SignPublic.tsx`, chargée via `getContractByToken(token)` qui **résout le signataire**
par son token (et renvoie `signerIndex`, `paymentRequired`, l'ordre, l'état des autres signataires…).

1. **Ouverture** : journalisée via l'Edge Function `sign-event` (capture l'**IP réelle** côté serveur).
2. **Champs** : le signataire ne voit éditables que **ses** champs (`signer_index` = le sien) ; les champs du propriétaire et des autres signataires sont en **lecture seule**.
3. **Ordre séquentiel** : si ce n'est pas encore son tour, écran « en attente du signataire précédent ».
4. **Vérification** : si la méthode ≠ `none`, le clic sur le champ signature ouvre la modale de code (déverrouille le pad au succès).
5. **Consentement** : case **obligatoire** « J'ai lu et j'accepte ce document » avant de pouvoir signer (tous modes).
6. **Validation** :
   - **Payeur** → `sign-pay create-payment` + modale de paiement → `confirm`.
   - **Non-payeur** → `sign-verify finalize`.
   - Dans **tous les cas**, la signature est **finalisée côté serveur** (jamais marquée signée par le client seul).
7. **Après signature** : le signataire peut **télécharger** le PDF final (document + certificat) ; il peut aussi recevoir une copie par email.

---

## 10. Certificat de preuve

> Le **cœur de valeur** : un PDF récapitulatif qui prouve **qui** a signé, **quand**, **comment**, et **avec quelles preuves**.
> Backend : Edge Function `sign-certificate` + lib client `src/lib/signCertificate.ts`.

### Principe directeur
- Le **journal d'événements** `sign_signature_events` est la **SOURCE DE VÉRITÉ**. Il est **append-only** (on n'efface, on ne modifie jamais — on ajoute).
- Le certificat n'est **que la mise en page** de ce journal. Il est **généré UNE SEULE FOIS** puis **figé** (`certified_at`). Toute consultation ultérieure sert **le même fichier**.

### Empreintes (SHA-256, intégrité)
- **Document original** (`document_hash`) : calculé **à l'envoi** (le document présenté au signataire).
- **Document scellé** (`sealed_hash`) : calculé **côté serveur sur les octets reçus** du PDF signé (jamais un hash fourni par le client).
- **Certificat** (`certificate_hash`) : calculé sur le **fichier fusionné produit par le serveur**.

### Quand
À la **complétion** : signataire unique → au scellement de sa signature ; plusieurs signataires → quand **tous** ont signé.
Généré pour **tous les modes**, y compris « sans vérification » (le contenu est plus ou moins garni selon les preuves disponibles).

### Pipeline (3 étapes, `sign-certificate`)
1. **`seal`** `{ token|contractId, sealedPdfB64 }` : le navigateur envoie le PDF du **document signé** (rendu fidèle à l'écran). Le serveur **hashe les octets reçus** (`sealed_hash`), stocke `sealed.pdf`, génère le `certificate_id`, et renvoie le **journal sanitisé** (masqué/minimisé) pour le rendu.
2. Le client **construit les pages du certificat** (jspdf + autotable + QR), avec les empreintes original/scellé.
3. **`finalize`** `{ certPdfB64 }` : le serveur **fusionne (pdf-lib)** document + certificat en **un seul fichier inséparable**, hashe le fichier fusionné (`certificate_hash`), le stocke (`certificat.pdf`, **source unique**), pose `certified_at`, journalise `certified`, puis **envoie automatiquement le PDF final en pièce jointe à toutes les parties** (émetteur + signataires) via Brevo — **une seule fois**.

> **`finalize` refuse de régénérer** si `certified_at` est déjà posé (garde « certifier une fois »).
> **Repli** : si le navigateur du dernier signataire n'a pas généré, le propriétaire peut le faire depuis l'éditeur (bouton **« Certificat de preuve »**, idempotent).

### Contrats PDF importés
Supportés. Le « document signé » est un **raster fidèle de ce que le signataire a vu** (PDF d'origine + champs incrustés, rendu client), fusionné par pdf-lib avec le certificat. Le PDF vectoriel d'origine reste en base et son intégrité est prouvée par `document_hash`.

### Contenu du certificat
- **En-tête** : titre, **identifiant unique** du certificat, date de génération.
- **Document** : titre, empreinte originale, empreinte scellée.
- **Signataires** : nom, email vérifié, téléphone vérifié (si applicable), **méthode** de vérification.
- **Chronologie horodatée (UTC)** : envoyé → ouvert → accès boîte mail → code envoyé/validé → consentement → signé → payé → scellé → complété.
- **Traces techniques** : **IP** + **appareil** par action.
- **Preuve de paiement** (si « Payé + signé ») : montant, date, identifiant de transaction.
- **Événements de sécurité** (échecs, blocages) — coordonnées tentées **masquées**.
- **Pied** : attestation, QR vers la **page de vérification publique**, mention « signature électronique simple documentée ».

### Vérification publique
Page `/sign/verify/:certificateId` (`sign-certificate verify`) → affiche les **empreintes enregistrées**
(original / scellé / certificat) + date — preuve vérifiable par tous, sans donnée personnelle.

### Visibilité (cloisonnement strict)
Un **seul certificat commun** aux parties. Règles :
- **Visible (émetteur + signataire)** : document signé final, identités vérifiées, chronologie, empreintes, sa propre preuve de paiement.
- **Masqué dans le certificat** : les emails/numéros **tentés hors liste blanche** (`j***@client.com`).
- **Plateforme uniquement (jamais dans le PDF)** : logs techniques bruts (user-agent complet, identifiants internes, tokens), coordonnées tentées **en clair**, métadonnées d'infrastructure → restent dans `metadata` en base.
- Un signataire ne voit **jamais** les données d'un autre contrat (cloisonnement par token).

---

## 11. Sécurité & immuabilité

- **Signature inviolable (server-enforced)** : un signataire ne peut être marqué `signed`/`paid` que par le **service_role** (Edge Functions). Triggers `sign_guard_signing` (contrat) et `sign_signers_guard` (signataire) bloquent anon/authenticated. Toute signature passe par `sign-verify finalize` ou `sign-pay confirm`.
- **Journal append-only** : trigger `sign_events_immutable` → **bloque anon/authenticated** sur UPDATE/DELETE de `sign_signature_events` (le service_role/admin reste autorisé, pour l'effacement RGPD).
- **Colonnes certificat protégées** : trigger `sign_cert_guard` → anon/authenticated ne peuvent écrire `sealed_hash`, `certificate_hash`, `certificate_path`, `certificate_id`, `certified_at` (service_role only). `document_hash` (original) reste autorisé côté client.
- **Codes de vérification** : hachés SHA-256, jamais renvoyés au client ; isolés par `signer_index` + `channel`.
- **Bucket privé** `sign-documents` : le document scellé + certificat ne sont servis que via **URL signée** (10 min) générée par l'Edge Function.
- **RLS** : permissive (`*_mvp_all`, anon/authenticated) — posture MVP. La confidentialité des listes blanches repose sur l'**omission de colonnes** côté lecture publique (jamais sélectionnées via le token).
- **Secrets** (Stripe `sk_live`, ClickSend) : stockés dans la table verrouillée `sign_secrets` (RLS deny-all, lue uniquement par le service_role).
- **Capture d'IP non falsifiable** : la plateforme Supabase écrase le `x-forwarded-for` fourni par le client par l'IP réelle.

---

## 12. Conservation & RGPD

> Politique **validée** ; son **application automatique (cron de purge) n'est pas encore construite**.

| Donnée | Durée | Point de départ |
|--------|-------|-----------------|
| **PDF final (doc + certificat)** | **5 ans** | `signed_at` / `certified_at` (PAS la création) |
| **Journal d'événements** | **5 ans** (indissociable de la preuve) | idem |
| **Données techniques brutes** (IP en clair, user-agent complet, coordonnées tentées hors-whitelist, métadonnées infra) | **12 mois** puis purge/anonymisation | création de l'événement |

- La purge des données techniques **ne touche pas** au certificat déjà figé (qui ne contient que du masqué/minimisé).
- **Legal hold** : colonne `sign_contracts.purge_hold` (bool). Si `true` (litige en cours), le contrat ne doit **jamais** être purgé automatiquement — la future purge l'exclut.
- **À construire avec le cron** : la **cascade Storage** à la suppression d'un contrat (aujourd'hui, supprimer un contrat laisse le fichier du bucket).

---

## 13. Schéma de base de données

Tables `sign_*` (Postgres / Supabase). Principales colonnes (non exhaustif).

### `sign_contracts`
Contenu, état, config globale.
- Identité/contenu : `id`, `user_id`, `title`, `content_html`, `source_type` (`text`|`pdf`), `pdf_data`, `page_count`, `theme`, `images`, `inline_values` (jsonb), `owner_email`, `status`, `locked`, timestamps.
- Multi-signataire : `signer_count`, `signing_order` (`parallel`|`sequential`).
- Vérif (globale ; legacy/fallback mono-signataire) : `verification_method`, `verification_email(s)`, `verification_phones`, `verification_pairs`, `verification_locked`, `verification_*_attempts`, `access_token`, `contact_id`.
- Paiement : `payment_enabled`, `payment_mode`, `payment_amount`, `payment_interval`, `payment_duration_months`, `payment_trial_days`, `payment_tva_rate`, `payment_status`, `currency`, `stripe_payment_intent_id`, `stripe_subscription_id`, `paid_at`.
- Certificat : `document_hash` (original), `sealed_hash`, `certificate_hash`, `certificate_path`, `certificate_id`, `certified_at`, `purge_hold`.

### `sign_contract_signers` (multi-signataire)
Une ligne par signataire. `contract_id`, `signer_index` (1..N, unique par contrat), `contact_id`, `name`/`email`/`phone`,
`access_token` (unique → lien propre), `status`, `sent_at`/`opened_at`/`signed_at`/`paid_at`,
`inline_values` (jsonb, valeurs inline du signataire), listes blanches `verification_emails`/`phones`/`pairs`,
`verification_locked`/`lock_reason`/`lock_step`/`dest_attempts`/`code_attempts`,
`payment_required`, `payment_status`, `stripe_payment_intent_id`/`subscription_id`.

### `sign_contract_fields`
Champs posés. `contract_id`, `field_type`, `placement` (`inline`|`free`), `pos_x/pos_y/width/height/page`,
`assignee` (`owner`|`signer`), **`signer_index`** (null = propriétaire), `label`, `value`, `sort_order`, `filled_at`, `tz_offset`.

### `sign_signature_events` (journal append-only — faisceau de preuves)
`contract_id`, `contact_id`, `event_type`, `email`, `ip_address` (inet), `user_agent`, `document_hash`, `metadata` (jsonb), `created_at`.
Types autorisés : `created`, `sent`, `opened`, `otp_sent`, `otp_verified`, `signed`, `paid`, `declined`, `downloaded`, `consent`, `email_access`, `sealed`, `completed`, `certified`, `security`.

### Autres
- `sign_verification_codes` : codes hachés (`code_hash`), `channel`, `signer_index`, `expires_at`, `consumed`.
- `sign_contacts` : carnet de contacts du proprio.
- `sign_users` : compte propriétaire (+ `stripe_account_id`, `stripe_connected`).
- `sign_secrets` : secrets k/v (deny-all).
- Storage bucket privé `sign-documents` : `<contract_id>/sealed.pdf` + `<contract_id>/certificat.pdf`.

---

## 14. Edge Functions

Déployées sur Supabase (Deno, `verify_jwt=false` — autorisation par token de signataire). Projet `qwjvdwpixewsctircibl`.

| Fonction | Rôle | Actions |
|----------|------|---------|
| **`sign-verify`** | Vérification d'identité + finalisation de signature (non-payeurs) | `send` (envoie le code), `verify` (valide le code), `finalize` (vérifie ordre + vérif + consentement → scelle la signature, fait avancer le séquentiel, complète le contrat). |
| **`sign-pay`** | Paiement Stripe Connect (payeurs) | `connect`, `connect-status`, `create-payment`, `confirm` (revérifie paiement **+ vérif** → scelle). |
| **`sign-event`** | Journalisation côté signataire **avec IP serveur** | `opened` (ouverture du document). |
| **`sign-certificate`** | Certificat de preuve | `seal` (hash doc), `finalize` (merge + hash + stockage + **envoi auto à toutes les parties**), `get` (URL signée), `verify` (empreintes publiques). |

Helpers serveur communs : `resolveSigner`, `verificationSatisfied`, `isSignerTurn`, `advanceAfterSignerDone`.

---

## 15. Modèle de statuts

**Contrat** (`sign_contracts.status`) : `draft` → `pending` (validé) → `sent` (envoyé) → `signed` (tous signés) ; `paid` si paiement complet ; + `declined`, `expired`, `cancelled`, `viewed`.

**Signataire** (`sign_contract_signers.status`) : `pending` → `sent` → `opened` → `signed` (+ `declined`).

Un contrat n'est `signed` **que lorsque tous ses signataires sont `signed`** (centralisé serveur).

---

## 16. Limites connues & hors-scope

- **Auth Sign** : MVP bypass (compte unique, localStorage) — pas de vraie auth multi-utilisateurs.
- **Webhook Stripe** : absent (v1). Échéances/échecs d'abonnement non suivis dans CloseOS.
- **Cron de purge RGPD** + **cascade Storage** à la suppression d'un contrat : à construire (politique définie, §12).
- **Niveau de signature** : signature électronique simple documentée. Pas de signature qualifiée / cachet serveur / horodatage qualifié.
- **PDF importés** : rendu **raster** (≈ écran) dans le certificat, pas vectoriel (choix v1, fidèle à ce qui a été vu).
- **RLS** : permissive (MVP) ; durcissement possible (vues security-barrier, table deny-all pour les whitelists).
- **Stripe en live** : les vrais paiements/onboarding Connect ne sont testables qu'en HTTPS (pas sur `localhost`).

---

*Dernière mise à jour : 2026-06-10. Voir aussi `Sign.md` (direction artistique).*
