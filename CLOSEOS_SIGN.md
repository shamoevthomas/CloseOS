# CloseOS Sign — Documentation complète

> Module de **signature électronique + encaissement** de l'écosystème CloseOS, servi sur `sign.closeos.fr`
> (et `/sign/*`). Document de **référence unique** : produit, fonctionnalités, **tarifs**, parcours, contrats
> réutilisables, lien avec CloseOS Business, certificat de preuve, sécurité, schéma de base, Edge Functions, Stripe.
>
> Direction artistique (couleurs, composants) : voir [`Sign.md`](./Sign.md).
> Activer un accès au cas par cas : voir [`ACTIVER_ACCES_SIGN_DYLAN.md`](./ACTIVER_ACCES_SIGN_DYLAN.md).
>
> _Dernière mise à jour : 11 juin 2026._

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Tarifs & abonnement](#2-tarifs--abonnement)
3. [Comptes, authentification & lien CloseOS Business](#3-comptes-authentification--lien-closeos-business)
4. [Pages & routes](#4-pages--routes)
5. [Création & édition d'un contrat](#5-création--édition-dun-contrat)
6. [Multi-signataire](#6-multi-signataire)
7. [Vérification d'identité du signataire](#7-vérification-didentité-du-signataire)
8. [Paiement « Payé + signé »](#8-paiement--payé--signé-)
9. [Envoi & liens de signature](#9-envoi--liens-de-signature)
10. [Parcours signataire](#10-parcours-signataire)
11. [Contrats réutilisables (templates) & espace closer](#11-contrats-réutilisables-templates--espace-closer)
12. [Contacts, dossiers & pont CRM Business](#12-contacts-dossiers--pont-crm-business)
13. [Certificat de preuve](#13-certificat-de-preuve)
14. [Sécurité & immuabilité](#14-sécurité--immuabilité)
15. [2FA d'appareil (propriétaire)](#15-2fa-dappareil-propriétaire)
16. [Conservation, RGPD & pages légales](#16-conservation-rgpd--pages-légales)
17. [Schéma de base de données](#17-schéma-de-base-de-données)
18. [Edge Functions & API](#18-edge-functions--api)
19. [Stripe (Sign+Pay & abonnement)](#19-stripe-signpay--abonnement)
20. [Modèle de statuts & événements](#20-modèle-de-statuts--événements)
21. [Limites connues & notes internes](#21-limites-connues--notes-internes)

---

## 1. Vue d'ensemble

**CloseOS Sign** permet de composer un contrat (texte rédigé dans l'app **ou** PDF importé), d'y poser des
**champs à remplir/signer**, puis de l'envoyer à un ou plusieurs **signataires** qui le remplissent, vérifient
leur identité, **paient si demandé**, et signent. À la complétion, un **certificat de preuve** figé est généré
et envoyé à toutes les parties. Pensé pour les **cycles de vente rapides** : sécuriser le contrat **et** encaisser
dans le même geste.

- **Stack** : Vite + React 19 + TypeScript + TailwindCSS ; Supabase (Postgres + RLS + Storage + Edge Functions Deno,
  projet `qwjvdwpixewsctircibl`) ; Stripe (Connect + abonnement) ; Brevo (emails) ; ClickSend (SMS).
- **Rendu/PDF** : rendu PDF via `pdfjs-dist` ; export/certificat côté client (`jspdf` + `html2canvas` + `jspdf-autotable` + `qrcode`), fusion serveur via `pdf-lib`.
- **DA** : fond `#191E1E`, **lime** `#CEFF8F` (signataire), **mint** `#A0E7EC` (propriétaire), surfaces `#222828`/`#1D2323`,
  bordure `#3A4242`, texte `#F3F4F6`/`#A1A9A9`, alerte `#ef6b6b`, or `#F0B86E`. Voir `Sign.md`.
- **Niveau de signature** : **signature électronique simple documentée** (eIDAS), appuyée par un **faisceau de preuves** opposable. Pas de signature qualifiée / horodatage qualifié.

### Rôles
- **Propriétaire (émetteur)** : crée/configure contrats et **modèles**, place ses champs, gère ses **closers**, suit l'activité. Rôle `owner` (n'apparaît pas dans la liste des signataires).
- **Closer (« rep »)** : accès par lien dédié à un **modèle**, pour générer ses propres liens et suivre **ses** signatures (cloisonné).
- **Signataire** : reçoit un lien, remplit ses champs, se vérifie, paie si requis, signe. **Aucun compte à créer.**

---

## 2. Tarifs & abonnement

- **Formule unique à 9 € / mois**, **toutes les fonctionnalités incluses** (multi-signataire, vérif d'identité, Sign+Pay, modèles, espaces closer, certificat…). Pas de paliers.
- **Essai 14 jours** avec **carte bancaire obligatoire** (prélèvement automatique à la fin sauf résiliation).
- **Sans engagement**, résiliable depuis les Paramètres (portail Stripe).
- **Inclus pour CloseOS Business** : tout titulaire d'un abonnement **Business actif** accède à Sign **sans payer** (`sign_users.subscription_exempt = true`).
- **Échec de paiement au renouvellement** → pop-up de **grâce 3 jours** (`SignPaywall mode="grace"`) puis **blocage plein écran** (`mode="blocked"`). Les contrats signés & preuves restent intacts.
- **Parcours d'achat** : landing → **checkout** (carte + création de compte, Stripe Elements embarqué) → essai 14 j → ouverture du compte → gestion de l'abonnement dans les Paramètres.

Implémentation : `src/lib/signSubscription.ts` (`createSignSetupIntent`, `registerSign`, `openSignBillingPortal`, `getSignSubscription`, `subAccessState`), `api/sign-checkout.ts`, page `/sign/abonnement` (`SignCheckout`), gate `SignProtected` + `SignPaywall`.

---

## 3. Comptes, authentification & lien CloseOS Business

### Modèle de comptes
- **Identité unique Supabase** : `auth.users.id` = `sign_users.id` = (`business_users.id` si l'utilisateur a aussi Business).
- **Business ⟹ Sign (même login)** : tout compte **Business** est provisionné avec un compte **Sign** (mêmes identifiants), **sauf exclusions** (ex. Dylan Bonnet — voir `ACTIVER_ACCES_SIGN_DYLAN.md`).
- **Sales ⇎ Sign** : un compte **Sales** pur n'a pas de Sign et inversement. **Sign-pur** : compte Sign sans Business ni Sales (ex. `demo@sign.closeos.fr`).
- Critère d'accès Sign = présence d'une ligne `sign_users` pour l'`auth.uid()`.

### Authentification propriétaire (vraie auth — le bypass MVP n'existe plus)
- **Client dédié** `signSupabase` (`src/lib/signSupabase.ts`) : `storageKey: 'closeos-sign-auth'`, `detectSessionInUrl: false`, `flowType: 'pkce'` — session isolée.
- **Connexion** email + mot de passe **et Google** (`/sign/login`, `src/lib/signAuth.ts` : `signInSign`, `signInWithGoogle`, `completeOAuthRedirect`).
- **Mot de passe oublié** : lien de réinitialisation Supabase (`sendPasswordReset`, `consumeRecoveryLink`, `updatePassword`).
- **2FA d'appareil** (voir §15). **RLS fermée** : aucune policy `anon` ; policies `authenticated` scopées `user_id = auth.uid()`.
- Compte de test : `demo@sign.closeos.fr` / `TEKOULI`.

### Passage transparent Business → Sign (SSO)
- Dans la **sidebar Business**, bouton **« Accéder à CloseOS Sign »** visible **uniquement** pour le **propriétaire** ayant un accès Sign (`hasSign && !isTeamMember`).
- Au clic : **transfert de la session** Business → client Sign (`signSupabase.auth.setSession`, compte auth commun) + **confiance d'appareil silencieuse** (`/api/sign-trust-device`, autorisée par le JWT), puis bascule sur `/sign/app` → **aucune reconnexion, aucun code**. Le garde d'essai/paiement **Sales** est exclu des routes `/sign`.

---

## 4. Pages & routes

| Route | Accès | Page |
|-------|-------|------|
| `/sign` | public | Landing (`SignLanding`) |
| `/sign/login` | public | Connexion (`SignLogin`) |
| `/sign/abonnement` | public | Checkout abonnement (`SignCheckout`) |
| `/sign/s/:token` | public (token signataire) | Parcours signataire (`SignPublic`) |
| `/sign/rep/:token` | public (token closer) | Espace closer (`SignRepSpace`) |
| `/sign/verify/:certificateId` | public | Vérification d'un certificat (`SignVerify`) |
| `/sign/cgv` · `/sign/confidentialite` · `/sign/securite` | public | Pages légales (DA Sign) |
| `/sign/app` | **propriétaire** (`SignProtected`) | Accueil (`SignHome`) |
| `/sign/app/nouveau` | propriétaire | Choix de création (`SignNewContract`) |
| `/sign/app/contrat` · `/sign/app/contrat/:id` | propriétaire | Éditeur (`SignContractEditor`) |
| `/sign/app/contrats` | propriétaire | Liste des contrats (`SignContracts`) |
| `/sign/app/template/:id` | propriétaire | Tableau de bord d'un modèle (`SignTemplateDashboard`) |
| `/sign/app/contacts` · `/sign/app/contacts/:id` | propriétaire | Contacts (`SignContacts`, `SignContactDetail`) |
| `/sign/app/profil` | propriétaire | Profil & Paramètres (`SignProfile`) |

`SignProtected` exige : (1) propriétaire authentifié, (2) appareil de confiance, (3) abonnement OK (exempt/actif/essai).

---

## 5. Création & édition d'un contrat

Éditeur : `src/pages/SignContractEditor.tsx`. Données : `src/lib/signContracts.ts` (`createContract`, `getContract`, `updateContract`, `saveFreeFields`, `duplicateContract`).

### Deux sources de document
- **Texte** (`source_type='text'`) : feuille A4 éditable (mise en forme riche, pagination automatique) → `content_html`. Thèmes via `src/lib/signThemes.ts` (`.sign-doc` + `THEME_CSS`).
- **PDF importé** (`source_type='pdf'`) : `pdf_data` (data URL base64), rendu par `pdfjs-dist` ; on pose les champs en glisser-déposer.

### Champs
- **Inline** : puces `<span class="sign-field">` dans le texte ; valeurs dans `inline_values` (globales) ou par signataire.
- **Libres / overlay** (`sign_contract_fields`, `placement='free'`) : positionnés librement (x/y/w/h/page).
- **Types** : `signature`, `checkbox` (« Lu et approuvé »), `name`, `email`, `tel`, `address`, `siret`, `siren`, `tva`, `company_id`, `ape`, `date`, `time`, `city`, `text` (`initials` = legacy, rendu comme signature).
- Chaque champ porte : un **rôle** (`owner` / `signer`), un **`signer_index`** (`null` pour le proprio, `1..N` pour le signataire), une **couleur** dérivée (`src/lib/signColors.ts`).
- **Préremplissage** : assigner un contact à un signataire préremplit email/tel/adresse + identité entreprise.

### Flux de validation (éditeur)
1. **Titre** (pop-up) → on nomme le contrat.
2. **Valider l'édition** → contenu figé (pagination « bakée »), `locked=true`.
3. Si le proprio a des champs → **« remplir ma partie »** (préremplissage depuis son profil) avant l'envoi.
Une fois envoyé/signé, l'autosave ne touche **que le titre** (le contenu rempli par le signataire n'est jamais écrasé).
Autres actions : **Dupliquer**, **Modifier**, et — si **mode Modèle** — **Tableau de bord** (voir §11).

---

## 6. Multi-signataire

- **1 à 10 signataires** (`signer_count`), chacun = une ligne `sign_contract_signers` (le proprio n'y figure pas).
- **Ordre** (`signing_order`) : **parallèle** (tous reçoivent leur lien en même temps) ou **séquentiel** (1 → 2 → 3 ; le suivant est notifié **automatiquement côté serveur** dès que le précédent a signé).
- **Tokens & valeurs par signataire** : chacun a son `access_token` (lien propre) et ses `inline_values` → **pas d'écrasement** entre signataires (anti-race) ; l'affichage **fusionne** proprio + tous.
- **Complétion** : le contrat passe `signed` **uniquement quand tous** ont signé (logique serveur `advanceAfterSignerDone`) ; c'est aussi le moment du **certificat**.

---

## 7. Vérification d'identité du signataire

**Méthode GLOBALE au contrat** ; **listes blanches PAR signataire**.

| `verification_method` | Description |
|---|---|
| `none` | Aucune vérification. |
| `email` | Code 6 chiffres par **email** (Brevo) à une adresse autorisée. |
| `sms` | Code 6 chiffres par **SMS** (ClickSend) à un numéro autorisé. |
| `email_sms` | **Double** : email PUIS SMS du **même couple** (anti-croisement). |

> Le **paiement n'est pas** une méthode de vérification : c'est un axe **indépendant** (§8).

- **Listes blanches** par signataire : `verification_emails`, `verification_phones`, `verification_pairs`. Chaque signataire doit avoir ≥ 1 entrée.
- **Déroulé** (`SignVerificationModal`, 2 étapes) : (1) le signataire saisit sa coordonnée → le serveur vérifie qu'elle est dans **sa** liste blanche puis envoie le code à **cette seule** adresse ; (2) saisie du code → pad de signature débloqué.
- **Codes** : hachés **SHA-256** côté serveur (`sign_verification_codes.code_hash`), jamais exposés ; isolés par `signer_index` + `channel`.
- **Anti-brute-force** (par signataire) : **3 essais** à l'étape destination, **3 essais** au code, **3 renvois** max (90 s d'écart). Au 3ᵉ échec → `verification_locked` (page floutée + cadenas), **email d'alerte au propriétaire** (lien de déblocage) + bannière/bouton **Débloquer** dans l'éditeur. Chaque échec = événement `security` (coordonnée tentée masquée dans le certificat).
- Tout est résolu **côté serveur** : Edge Function **`sign-verify`** (`send` / `verify` / `finalize`).

---

## 8. Paiement « Payé + signé »

Axe **indépendant** de la vérification (un signataire peut vérifier par SMS **et** payer). Backend : Edge **`sign-pay`** (Stripe **Connect**, *destination charges*), commission CloseOS **~2 %** via `application_fee`.

### Configuration (propriétaire)
- **Connexion Stripe** du proprio : Profil → Paramètres (`sign-pay connect` / `connect-status`).
- Pop-up **Paiement** (`payment_enabled`) : **prix** ; **one-shot** ou **abonnement** (mensuel/trimestriel/annuel, durée à vie / X mois, jours d'essai) ; **TVA** optionnelle (HT/TVA/TTC) ; **qui paie ?** (tout le monde / un signataire précis → `payment_required` sur les lignes concernées).

### Côté signataire
- **One-shot** → `PaymentIntent` (`confirmPayment`). **Abonnement** → `Subscription` (`default_incomplete`) ; essai gratuit → `SetupIntent` (0 € débité).
- Au succès, `sign-pay confirm` **revérifie côté serveur** paiement **+ vérif d'identité** (si requise) puis scelle la signature. Le contrat passe `paid` quand **tous les payeurs requis** ont payé.

---

## 9. Envoi & liens de signature

- **« Envoyer pour signature »** : modale multi-lignes (nom + email par signataire, préremplis depuis les contacts) → `sendForSignatureMulti`. Parallèle → tous les emails partent ; séquentiel → seul le 1ᵉʳ, les suivants relancés par le serveur.
- **« Copier le(s) lien(s) »** : un lien par signataire (`…/sign/s/<token>`), lazy via `getOrCreateSignLinkForSigner`.
- Emails via Brevo (`/api/send-email`, expéditeur `support@closeos.fr`).

---

## 10. Parcours signataire

Page `src/pages/SignPublic.tsx` (`/sign/s/:token`), **100 % via Edge Functions** (aucun accès direct aux tables) :
1. **Ouverture** → `sign-event` (capture l'**IP réelle** serveur) ; `sign-public get` renvoie le contrat + le signataire courant (jamais les autres).
2. **Champs** : seuls **ses** champs sont éditables ; ceux du proprio/autres sont en lecture seule. (Séquentiel : écran d'attente si ce n'est pas son tour.)
3. **Vérification** (si ≠ `none`) → `sign-verify`.
4. **Consentement** obligatoire (« J'ai lu et j'accepte ») + signature → `sign-verify finalize` (ou `sign-pay confirm` si payeur). La signature est **toujours finalisée côté serveur**.
5. **Complétion** : rendu du PDF signé côté client → **scellement + certificat** (`sign-certificate`) → emails aux parties.
6. **Téléchargement** du PDF final (`downloaded`, journalisé via `sign-event`).

---

## 11. Contrats réutilisables (templates) & espace closer

> Un **modèle** réutilisable + des **espaces par closer** : générer des signatures en volume, avec attribution et cloisonnement.

### Concept
- **Template** = contrat avec `is_template = true`. Il **ne se signe jamais** et reste **modifiable**.
- **Instance** = à chaque génération de lien, le template est **cloné** en **contrat normal** (`is_template=false`, `template_id`, `rep_id`). L'instance réutilise **tout le flux existant** (signature, vérif, paiement, certificat) **sans modifier** les Edge Functions critiques. Une instance est **indépendante** (modifier/supprimer le template ne change rien aux instances).

### Décisions verrouillées
- **Naissance = à la génération du lien** (action délibérée) — 1 lien = 1 prospect = 1 instance, **pas de fantômes**.
- **Contenu figé à la création** (le prospect signe exactement ce qu'on lui a envoyé).
- **Expiration 7 jours** (`expires_at`), **régénérable** : un lien expiré non signé est **recyclé en place** (re-fige le template courant, nouveau token) — jamais une instance signée, **sans empiler** d'expirées.

### Espace closer (« rep »)
- Le proprio crée un **rep** par closer (`sign_template_reps` : `label`, `email`, `access_token`). Lien : `…/sign/rep/<token>`.
- **Auth closer** = lien + **2FA** : code OTP envoyé à l'email du closer (**renseigné par le propriétaire**) + **appareil de confiance**. Aucune action sensible sans appareil de confiance.
- Le closer **génère** des liens (un par prospect), **régénère** les expirés, suit **ses** instances — **cloisonnement strict** (jamais celles des autres).
- **Révocation** par le proprio : `status='revoked'` + **purge des appareils** (déconnexion immédiate) + blocage des nouveaux liens. **Historique & instances signées préservés.**
- **Attribution** : `instance.template_id` + `instance.rep_id` (nul = généré par le proprio). Compteurs = `COUNT` par statut.

### Tableau de bord du modèle
`/sign/app/template/:id` (`SignTemplateDashboard`) : générer un lien soi-même, gérer les closers (créer / copier le lien / révoquer), voir **toutes** les instances (statut, attribution, compteurs, certificat).

### Implémentation
- SQL `SECURITY DEFINER` : `sign_clone_template_to_instance`, `sign_regenerate_instance_internal`, wrappers `sign_owner_generate_link`, `sign_create_template_rep`, `sign_revoke_template_rep`, `sign_owner_regenerate_instance`.
- Edge **`sign-rep`** (`bootstrap` / `verify-code` / `dashboard` / `create-link` / `regenerate-link`).
- Front : `src/lib/signTemplates.ts` (proprio), `src/lib/signRepClient.ts` (closer), toggle « Modèle » dans l'éditeur, badge + compteurs dans la liste.

---

## 12. Contacts, dossiers & pont CRM Business

### Contacts & dossiers (`/sign/app/contacts`)
- Carnet `sign_contacts` + **dossiers** `sign_contact_groups` (créer/renommer/supprimer, déplacer, « Sans dossier »). Sélecteur `ContactPicker` dans l'éditeur. Les contacts s'enregistrent **automatiquement** à la signature.

### Pont CRM CloseOS Business → Sign
- Dossier spécial **« CRM CloseOS »** (synchronisé en **lecture directe**, temps réel) pour les proprios ayant un Business :
  - **Prospects** › un sous-dossier **par offre** (`business_formulas.name`), contenant les **clients gagnés** (stage `won`).
  - **Équipe** › membres `business_team_members`, **si** le plan Business est `business` / `business_acquisition` (pas `solo`).
- Lecture via le **même `auth.uid()`** (la RLS Business autorise le propriétaire) — aucune copie, aucune Edge.
- **Matérialisation à l'usage** : choisir une personne CRM crée/réutilise un vrai contact Sign (par email) au moment où on l'utilise. Fichier : `src/lib/signCrm.ts`.

### Prévisualisation des contrats (liste)
La liste `/sign/app/contrats` affiche une **vraie miniature** : contenu HTML mis à l'échelle (texte) ou **1ʳᵉ page PDF rendue en lazy**. Actions au survol : ouvrir / dupliquer / télécharger / supprimer.

---

## 13. Certificat de preuve

> Le **cœur de valeur** : un PDF prouvant **qui** a signé, **quand**, **comment**, et **avec quelles preuves**. Backend : Edge **`sign-certificate`** + `src/lib/signCertificate.ts`.

### Principe directeur
- Le journal `sign_signature_events` est la **SOURCE DE VÉRITÉ**, **append-only**. Le certificat n'est que sa **mise en page**, **généré UNE SEULE FOIS** puis **figé** (`certified_at`).

### Empreintes (SHA-256, intégrité)
- **`document_hash`** : document **original présenté** (à l'envoi / au clone).
- **`sealed_hash`** : PDF **signé final**, hashé **côté serveur sur les octets reçus** (jamais un hash fourni par le client).
- **`certificate_hash`** : fichier fusionné produit par le serveur.

### Pipeline (3 étapes)
1. **`seal`** `{ token|contractId, sealedPdfB64 }` : le navigateur envoie le PDF du document signé ; le serveur hashe les octets reçus, stocke `sealed.pdf`, génère le `certificate_id`, renvoie le journal **sanitisé** pour le rendu.
2. Le client **construit les pages du certificat** (jspdf + autotable + QR) avec les empreintes.
3. **`finalize`** `{ certPdfB64 }` : le serveur **fusionne (pdf-lib)** document + certificat en **un seul fichier**, hashe le tout (`certificate_hash`), stocke `certificat.pdf` (**source unique**, bucket privé), pose `certified_at`, journalise `certified`, puis **envoie le PDF final à toutes les parties** — **une seule fois**. `finalize` **refuse de régénérer** si `certified_at` est déjà posé. **Repli** : le propriétaire peut générer depuis l'éditeur (idempotent).

### PDF importés
Le « document signé » est un **raster fidèle de ce que le signataire a vu** (PDF d'origine + champs incrustés), fusionné avec le certificat ; le PDF vectoriel d'origine reste prouvé par `document_hash`.

### Contenu
En-tête (titre, identifiant, date) · document (empreintes) · signataires (nom, email/tél vérifiés, méthode) · **chronologie horodatée UTC** (envoyé → ouvert → accès mail → code envoyé/validé → consentement → signé → payé → scellé → complété) · IP + appareil par action · preuve de paiement · événements de sécurité (coordonnées masquées) · QR vers la **vérification publique**.

### Vérification publique & cloisonnement
- `/sign/verify/:certificateId` → affiche les **empreintes enregistrées** (original / scellé / certificat) + date, sans donnée personnelle.
- **Visible** (émetteur + signataire) : document final, identités vérifiées, chronologie, empreintes, sa propre preuve de paiement. **Masqué** : coordonnées tentées hors-liste. **Plateforme uniquement** (jamais dans le PDF) : logs bruts, user-agent complet, tokens, coordonnées en clair → restent dans `metadata`. Un signataire ne voit jamais un autre contrat.

---

## 14. Sécurité & immuabilité

- **RLS fermée** : aucun accès `anon` direct aux tables sensibles ; `authenticated` scopé `user_id = auth.uid()` ; signataire & closer **uniquement via Edge Functions** (service_role) autorisées par token.
- **Triggers de garde** (n'agissent que contre `anon`/`authenticated` — les Edge `service_role` & fonctions `SECURITY DEFINER` passent) :
  - `sign_guard_signing` / `sign_signers_guard` : un contrat/signataire ne peut passer `signed`/`paid` que côté serveur (après vérification).
  - `sign_cert_guard` : champs certificat (`sealed_hash`, `certificate_*`, `certified_at`) **serveur uniquement** ; `document_hash` original reste autorisé.
  - `sign_events_immutable` : `sign_signature_events` **append-only** (UPDATE/DELETE bloqués côté client ; service_role autorisé pour l'effacement RGPD).
  - `sign_users` séparation de comptes + `updated_at` triggers.
- **Codes** hachés SHA-256, jamais renvoyés au client.
- **Bucket privé** `sign-documents` : `sealed.pdf` + `certificat.pdf` servis via **URL signée** (≈ 10 min) générée par l'Edge.
- **Secrets** (Stripe `sk_live`, ClickSend, secret webhook) : table verrouillée `sign_secrets` (deny-all, service_role only).
- **Capture d'IP non falsifiable** : Supabase écrase le `x-forwarded-for` client par l'IP réelle.

---

## 15. 2FA d'appareil (propriétaire)

- À chaque **nouvel appareil** : code 6 chiffres par email (`sign_device_codes`), puis **appareil de confiance 7 jours** (`sign_device_tokens`).
- Email **« nouvelle connexion »** avec lien de **révocation** ; gestion des appareils dans Paramètres > Sécurité.
- Endpoints (Vercel, dispatchés par `api/sign-auth.ts`) : `sign-send-verification-code`, `sign-verify-code`, `sign-check-device`, `sign-list-devices`, `sign-revoke-device-id`, `sign-revoke-all-devices`, `sign-revoke-device` (lien email), **`sign-trust-device`** (confiance silencieuse via JWT — SSO depuis Business).
- Client : `src/lib/signDevice.ts` (`useDeviceTrust`, `getSignDeviceFingerprint`, `trustDeviceFromSession`…). Gate `SignProtected` → `SignVerification`.

---

## 16. Conservation, RGPD & pages légales

| Donnée | Durée | Départ |
|--------|-------|--------|
| PDF final (doc + certificat) | **≥ 5 ans** | `signed_at` / `certified_at` |
| Journal d'événements (preuve) | **≥ 5 ans** (indissociable) | idem |
| Données techniques brutes (IP en clair, UA complet, coordonnées tentées, métadonnées infra) | **~12 mois** puis purge/anonymisation | création de l'événement |

- **Legal hold** : `sign_contracts.purge_hold` (bool) → exclut le contrat de toute purge automatique en cas de litige.
- **Sous-traitants** : Supabase (UE), Vercel, Stripe, Brevo, ClickSend. Aucune revente. **Cookies** : strictement nécessaires (session, auth, appareil).
- **Pages légales Sign** (DA dark, gabarit `SignLegalShell`) : `/sign/cgv` (`SignCGV`), `/sign/confidentialite` (`SignConfidentialite`), `/sign/securite` (`SignSecurite`). Mentions éditeur : **CloseOS Technologies**, SIREN 993 427 509, SIRET 99342750900019, dir. publication Thomas Shamoev, `support@closeos.fr`.
- La **CGV globale** de l'écosystème (`/cgv`) inclut une section **3.3 CloseOS Sign**.
- _À construire : cron de purge automatique + cascade Storage à la suppression d'un contrat._

---

## 17. Schéma de base de données

Tables `sign_*` (projet `qwjvdwpixewsctircibl`).

### `sign_contracts` (contrats, templates et instances)
Contenu : `id`, `user_id`, `title`, `content_html`, `source_type`, `pdf_data`, `page_count`, `theme`, `images`, `inline_values`, `owner_email`, `status`, `locked`. ·
Multi-signataire : `signer_count`, `signing_order`. ·
Templates : **`is_template`**, **`template_id`**, **`rep_id`**, `expires_at`. ·
Vérif (globale/fallback) : `verification_method`, `verification_email(s)`, `verification_phones`, `verification_pairs`, `verification_locked`/`*_attempts`, `access_token`, `contact_id`. ·
Paiement : `payment_enabled`, `payment_mode`, `payment_amount`, `payment_interval`, `payment_duration_months`, `payment_trial_days`, `payment_tva_rate`, `payment_status`, `currency`, `stripe_payment_intent_id`, `stripe_subscription_id`, `paid_at`. ·
Certificat : `document_hash`, `sealed_hash`, `certificate_hash`, `certificate_path`, `certificate_id`, `certified_at`, `purge_hold`.

### `sign_contract_signers`
Une ligne / signataire : `contract_id`, `signer_index`, `contact_id`, `name`/`email`/`phone`, `access_token` (unique), `status`, `sent_at`/`opened_at`/`signed_at`/`paid_at`, `inline_values`, whitelists `verification_*`, `verification_locked`/`lock_reason`/`lock_step`/`dest_attempts`/`code_attempts`, `payment_required`, `payment_status`, `subscription_status`, Stripe IDs.

### `sign_contract_fields`
`contract_id`, `field_type`, `placement`, `pos_x/pos_y/width/height/page`, `assignee`, `signer_index`, `label`, `value`, `sort_order`, `filled_at`, `tz_offset`.

### `sign_signature_events` (journal append-only)
`contract_id`, `contact_id`, `event_type`, `email`, `ip_address` (inet), `user_agent`, `document_hash`, `metadata` (jsonb), `created_at`.

### Templates / closer
- `sign_template_reps` : `template_id`, `user_id`, `label`, `email`, `access_token`, `status`, `revoked_at`.
- `sign_rep_codes` / `sign_rep_devices` : OTP + appareils de confiance closer (RLS fermée).

### Sécurité / comptes
- `sign_users` : proprio (PK = `auth.users.id`) + Stripe Connect (`stripe_account_id`, `stripe_connected`) + abonnement (`stripe_customer_id`, `subscription_status`, `subscription_cycle`, `current_period_end`, `subscription_exempt`) + `notif_prefs`.
- `sign_device_codes` / `sign_device_tokens` : 2FA appareil propriétaire (+ `revoke_token`).
- `sign_login_codes` · `sign_verification_codes` (`code_hash`, `channel`, `signer_index`) · `sign_otp_codes` (SMS legacy).
- `sign_contacts` / `sign_contact_groups` : carnet + dossiers.
- `sign_secrets` (deny-all) · `sign_subscription_events` / `sign_webhook_events` (suivi paiements + idempotence webhook).
- Storage bucket privé `sign-documents` : `<contract_id>/sealed.pdf` + `<contract_id>/certificat.pdf`.

---

## 18. Edge Functions & API

### Edge Functions Supabase (Deno, `verify_jwt=false`, autorisées par token/contexte)
| Fonction | Rôle |
|----------|------|
| `sign-public` | Accès signataire (get / save-fields / save-inline / contact) — seul point d'accès aux données du signataire. |
| `sign-verify` | Vérification d'identité (`send`/`verify`/`finalize`) + complétion de la signature. |
| `sign-pay` | Sign+Pay (`connect`/`connect-status`/`create-payment`/`confirm`) via Stripe Connect. |
| `sign-event` | Événements de preuve (opened, downloaded…) avec IP serveur. |
| `sign-certificate` | Scellement + génération/finalisation du certificat (`seal`/`finalize`/`get`/`verify`). |
| `sign-rep` | Espace closer (bootstrap / verify-code / dashboard / create-link / regenerate-link). |
| `sign-stripe-webhook` | Webhook Stripe **unifié** (abonnement propriétaire + paiements récurrents Sign+Pay). |
| `sign-bootstrap` | Provisioning / amorçage (administratif). |

### API Vercel (`/api/*`, dispatch par `?action=`)
- `api/sign-auth.ts` — 2FA d'appareil propriétaire + gestion des appareils + **`trust-device`** (SSO Business).
- `api/sign-checkout.ts` — abonnement (setup-intent / register / portal).
- `api/sign-stripe-webhook.ts` — webhook (mirror Vercel).

> ⚠️ **Note interne (drift)** : les Edge Functions sont **déployées** sur Supabase et certaines ne sont pas
> intégralement versionnées dans le repo. **Ne pas redéployer** une fonction existante sans vérifier le code déployé
> (`get_edge_function`). Un `git push` (Vercel) **ne touche pas** les Edge Functions Supabase.

---

## 19. Stripe (Sign+Pay & abonnement)

- **Un seul compte Stripe CloseOS** (`sign_secrets.stripe_secret_key`, même compte que Business).
- **Sign+Pay** = **Connect** (destination charges) : encaissement sur le compte connecté du proprio, **commission ~2 %** (`application_fee`).
- **Abonnement Sign** = `api/sign-checkout.ts` (clé `STRIPE_SECRET_KEY`), Stripe Elements embarqué, essai 14 j avec CB.
- **Webhook unifié** `api/sign-stripe-webhook.ts` (secret `sign_secrets.stripe_sign_webhook_secret`) : idempotence via `sign_webhook_events`, distingue abonnement propriétaire vs paiements Sign+Pay (résolution `sign_users` → signers → contrats), commissions dans `sign_subscription_events`. `bodyParser:false`.
- ⚠️ Stripe **live** : onboarding/paiements Connect testables uniquement en HTTPS (pas sur `localhost`).

---

## 20. Modèle de statuts & événements

- **Contrat / instance** (`sign_contracts.status`) : `draft` → `sent` → `viewed` → `signed` → `paid` ; + `declined`, `expired`, `cancelled`. Un **template** reste hors cycle (`is_template=true`).
- **Signataire** (`sign_contract_signers.status`) : `pending` → `sent` → `opened` → `signed` (+ `payment_status` : `none`/`pending`/`paid`).
- **Statut effectif UI** (templates/closer) : `en_cours`, `consulte`, `signe`, `paye`, `expire` (via `expires_at`), `refuse`.
- **Abonnement** (`subAccessState`) : `exempt`/`active`/`trialing` → accès ; `past_due` < 3 j → **grâce** ; au-delà / `unpaid` → **bloqué**.
- **Types d'événements** (`sign_signature_events.event_type`) : `created`, `sent`, `opened`, `otp_sent`, `otp_verified`, `email_access`, `consent`, `signed`, `paid`, `declined`, `downloaded`, `sealed`, `completed`, `certified`, `security`.

---

## 21. Limites connues & notes internes

- **Mode template = signataire unique** (le prospect) : une instance ne crée que le signataire 1 ; les modèles multi-signataires ne sont pas ciblés par le mode closer en v1.
- **Sessions Business/Sign partagées** après SSO : transparent en un onglet ; deux onglets actifs simultanément peuvent redemander une connexion (rare).
- **Niveau de signature** : électronique **simple** documentée (pas qualifiée).
- **PDF importés** : certificat en rendu **raster** (≈ écran), pas vectoriel (choix v1, fidèle à ce qui a été vu).
- **Conservation** : politique définie ; **cron de purge + cascade Storage** à construire.
- **Exclusions d'accès** : certains comptes Business sont délibérément exclus du provisioning Sign (voir `ACTIVER_ACCES_SIGN_DYLAN.md`).
- **Règles de travail** : ne jamais committer/pusher sans demande explicite ; ne jamais redéployer une Edge Function depuis le repo sans vérifier le déployé.

---

_CloseOS Sign — © 2026 CloseOS Technologies. Document de référence interne. Voir aussi `Sign.md` (DA)._
