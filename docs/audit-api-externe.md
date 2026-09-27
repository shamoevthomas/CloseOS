# Audit — CloseOS Sign comme moteur de signature externe (API, webhooks, marque blanche)

*Audit en lecture seule du repo `closeros-mvp`, 27 septembre 2026. Mis à jour à la fin du lot 1 (branche `sign/lot1-securite`) : voir « État après le lot 1 » ci-dessous. Les sections 1 à 6 décrivent l'état **avant** le lot 1, corrigées là où la vérification en production a levé un « à vérifier ».*

## État après le lot 1 (sécuriser et versionner)

**Statut :** code corrigé et testé sur la branche ; **pas encore déployé** (migrations, Edge Functions et Vercel à déployer dans l'ordre indiqué dans la PR). Tant que ce n'est pas fait, les failles restent ouvertes en production.

**Versionné dans le repo :**
- les 8 Edge Functions déployées, copie conforme (commit `a3a6360`) : `sign-public`, `sign-event`, `sign-verify` v13, `sign-pay` v7, `sign-certificate` v3, `sign-rep` v3, `sign-stripe-webhook` (Edge, en plus de la route Vercel du même nom) et `sign-bootstrap` (neutralisée : répond 410, à supprimer du projet) ; réglages `verify_jwt` dans `supabase/config.toml` ;
- le schéma Sign complet reconstitué depuis la production : `supabase/migrations/20260927_sign_baseline.sql` (23 tables, 15 policies, 10 triggers, 24 fonctions, bucket), idempotent, testé.

**Vérifié en production (lecture seule du catalogue) — corrige les « à vérifier » :**
- RLS activée sur les 23 tables `sign_*`, **aucune policy pour `anon`** ; policies `authenticated` bornées à `user_id = auth.uid()` (ou au propriétaire du contrat parent). Tables de codes, secrets et sessions : RLS sans policy (service_role seul).
- Bucket `sign-documents` : **privé**, aucune policy Storage (accès serveur uniquement). Pas de limite de taille ni de type.
- Triggers de garde présents : `sign_guard_signing`, `sign_signers_guard`, `sign_cert_guard`, `sign_events_immutable`. Ce dernier **autorise** la suppression des événements par cascade quand un propriétaire supprime son contrat depuis l'UI : la preuve d'un contrat signé reste effaçable par son propriétaire (hors `purge_hold`, désormais protégé).
- `sign-public` ne renvoie que le contrat du token et les signataires sans leurs listes blanches ni leurs tokens.

**Failles supplémentaires trouvées pendant le lot 1 (corrigées sur la branche) :**

| # | Faille | Correctif |
|---|---|---|
| 9 | `sign_clone_template_to_instance` et `sign_regenerate_instance_internal` (SECURITY DEFINER) **exécutables par `anon`** : avec un id de modèle, n'importe qui créait une instance dans le compte du propriétaire et lisait le modèle ; avec un id d'instance, réinitialisait un contrat en cours. Reproduit sur la base locale. | droits retirés à `anon`/`authenticated` (service_role seul) |
| 10 | Policy `sign_users_owner` en écriture sur toute la ligne : un propriétaire pouvait se mettre `subscription_exempt = true`, changer son statut d'abonnement, son compte Stripe ou sa clé MCP ; un compte CloseOS pouvait créer sa ligne `sign_users` déjà exemptée. Reproduit. | trigger `sign_users_guard` sur `current_user` (le provisionnement Business SECURITY DEFINER reste permis) |
| 11 | `sign-certificate` `seal` / `finalize` acceptaient aussi un simple `contractId` : scellement d'un contrat terminé avec un PDF arbitraire | token du signataire ou session du propriétaire exigés |
| 12 | 2FA d'appareil : code à 6 chiffres vérifié sans limite d'essais | session exigée, 5 essais par code, 60 s entre deux envois |

**Les 8 failles du §5.3 : toutes corrigées sur la branche** (détail dans le tableau §5.3).

**Reste ouvert, hors lot 1 :**
- La 2FA d'appareil n'est imposée que par l'interface : une personne qui a le mot de passe obtient un JWT valable pour PostgREST sans passer par le code. La corriger demande d'exiger un facteur côté base (claim AAL ou session d'appareil vérifiée côté serveur) : chantier à part.
- Un signataire peut toujours sceller son propre contrat avec un PDF de son choix, puisque le PDF final est produit par son navigateur : réglé par le lot 3 (génération serveur).
- Erreur de typage déjà présente dans la version déployée de `sign-certificate` (`crypto.subtle.digest` sur `Uint8Array`), sans effet à l'exécution.

**Tests :** `npm test` (Vitest), 101 cas : SQL sur Postgres local (`SIGN_TEST_PG`), handlers Vercel, règles des Edge Functions. Chaque correctif a été vérifié en contre-épreuve : ses tests échouent sur l'ancien code.

---

**Sources et fiabilité.**
- Toute affirmation renvoie à un fichier du repo (`fichier:ligne`).
- Plusieurs Edge Functions Supabase déployées **ne sont pas dans le repo** : `sign-public`, `sign-event`, `sign-certificate`, `sign-rep` et `sign-bootstrap`. Voir `CLOSEOS_SIGN.md:377-379`.
- Les versions du repo de `sign-verify` et `sign-pay` sont **plus anciennes** que les versions déployées.
- Les affirmations sur ces fonctions sont marquées **[déployé]**. Elles viennent d'une lecture en lecture seule des versions déployées sur le projet Supabase `qwjvdwpixewsctircibl`, et ne sont pas vérifiables dans le repo.
- Le SQL des tables Sign de base (création, RLS, triggers, RPC) n'est pas versionné. Tout ce qui en dépend est marqué **à vérifier**.

---

## 1. API publique

### 1.1 Ce qui existe

**Pas d'API REST publique pour Sign.** La seule interface machine réelle est un **serveur MCP** (JSON-RPC 2.0 sur HTTP, sans état) :

- **Route :** `POST https://sign.closeos.fr/api/mcp/<clé>`, réécrite en `/api/mcp?key=` (`vercel.json:481-482`). Source : `api/mcp.js`.
- **Méthodes :** `initialize`, `ping`, `tools/list` et `tools/call`. Les lots sont acceptés (`api/mcp.js:774-795`, `817-823`). `GET` renvoie 405 (`api/mcp.js:811`).
- **Erreur d'authentification :** clé absente ou inconnue → `401 {error:'unauthorized'}` (`api/mcp.js:806-809`).
- **CORS :** ouvert à `*` (`api/mcp.js:800`).
- **Format de réponse :** chaque outil renvoie `{content:[{type:'text', text: JSON.stringify(résultat)}]}` (`api/mcp.js:786-790`). C'est du JSON sérialisé dans du texte, pas une réponse structurée.
- **Accès base de données :** tout passe par la clé service-role, donc sans RLS (`api/mcp.js:25-26`, `48-50`). L'appartenance est contrôlée à la main par `getOwnedContract` et `getOwnedFolder` (`api/mcp.js:97-111`).
- **Limite de débit :** aucune.

**Outils MCP (23)** — numéros de ligne dans `api/mcp.js` :

| Outil | Paramètres principaux | Retour | Impl. / schéma |
|---|---|---|---|
| `sign_import_contract` | `title`, `pdf_base64` \| `pdf_url` \| `html`, `contact_email`, `contact_name` | `contract_id`, `page_count`, `pages`, `editor_url` | 236 / 630 |
| `sign_update_contract` | `contract_id`, `title`, `html`, `theme`, `pdf_*` (brouillon uniquement) | — | 488 / 711 |
| `sign_place_fields` | `contract_id`, `fields[]` (`type`, `page`, `x_pct`/`y_pct` ou `x`/`y`, `w`, `h`, `assignee`, `signer_index`, `label`, `value`), `mode`, `signers[]` | champs ajoutés | 265 / 646 |
| `sign_configure_contract` | `verification_method`, `payment`, `is_template`, `signing_order`, `signers[]` | — | 355 / 663 |
| `sign_get_signer_links` | `contract_id` | `signer_links` | 524 / 732 |
| `sign_send_contract` | `contract_id` | passe en `sent` et renvoie les liens, **sans email** | 403 / 691 |
| `sign_get_status` | `contract_id` | statut global et statut de chaque signataire | 315 / 659 |
| `sign_get_contract` / `sign_list_contracts` | `contract_id` / `status`, `limit` ≤ 100 | métadonnées (sans `pdf_data`) | 339, 330 |
| `sign_delete_contract` | `contract_id`, `confirm` | — | 509 / 727 |
| `sign_owner_authorize` / `sign_owner_sign` | `contract_ids[]` / `session_token` | lien de signature propriétaire (30 min), puis application de la signature | 427, 452 |
| `sign_list_templates`, `sign_list_team`, `sign_assign_template`, `sign_unassign_template`, `sign_add_closer`, `sign_list_closers` | modèles, équipe et closers | — | 202-229, 415, 534 |
| `sign_list_folders`, `sign_create_folder`, `sign_update_folder`, `sign_delete_folder`, `sign_move_contract` | dossiers | — | 548-597 |

**Utilisable par un client externe : oui**, avec la clé MCP d'un propriétaire. Le protocole MCP est toutefois pensé pour des agents IA : pour un SaaS, il faut soit implémenter un client JSON-RPC, soit poser une couche REST par-dessus.

**Autres points d'entrée, non destinés à un client externe :**

| Route / fonction | Rôle | Source | Utilisable par un externe ? |
|---|---|---|---|
| `sign-mcp/index.mjs` (MCP local stdio) | 9 outils, un seul compte (`SIGN_OWNER_EMAIL`) | `sign-mcp/index.mjs:27-41`, `69-80` | **Non** : exige la clé service-role en local |
| `POST /api/sign-setup-intent`, `/api/sign-register`, `/api/sign-portal` | inscription payante, portail Stripe | `api/sign-checkout.ts:79-181` | Inscription publique, mais avec une carte réelle obligatoire |
| `POST /api/sign-send-verification-code`, `/api/sign-verify-code`, `/api/sign-*-device` | 2FA d'appareil de l'UI | `api/sign-auth.ts:175-362` | Non (interne UI) |
| `GET/POST /api/sign-owner` | page de signature propriétaire, par token de session | `api/sign-owner.ts:70-133` | Non : humain requis |
| `POST /api/sign-stripe-webhook` | webhook Stripe **entrant** | `api/sign-stripe-webhook.ts:127-204` | Stripe uniquement |
| `/api/cron/sign-reminders`, `/api/cron/sign-subscription-grace` | crons (Bearer `CRON_SECRET`) | `api/cron/sign-reminders.ts:106-110` | Non |
| Edge `sign-verify`, `sign-pay` | OTP, finalisation, paiement signataire (par token) | `supabase/functions/sign-*/index.ts` (repo ancien) | Non : parcours signataire |
| Edge `sign-public`, `sign-event`, `sign-certificate`, `sign-rep` | lecture et sauvegarde signataire, événements, certificat, closers | appelées en `src/lib/signContracts.ts:525,803-829,1029`, `src/lib/signCertificate.ts:232-244`, `src/lib/signRepClient.ts:33-109` | Non ; **code absent du repo** |
| PostgREST et RPC Supabase directs (`sign_*`) | tout le back-office de l'UI (JWT propriétaire et RLS) | ~120 appels `.from('sign_…')` dans `src/` ; RPC en `src/lib/signTeam.ts:71-192` et `src/lib/signTemplates.ts:64-107` | Techniquement possible avec le login du propriétaire. Non documenté ni versionné, à proscrire |

- **OAuth :** volontairement absent, `/.well-known/oauth-*` répond 404 (`api/well-known-oauth.ts:5-14`).
- **Doc obsolète :** `sign-mcp/README.md` et le commentaire `api/mcp.js:11-12` décrivent encore un MCP mono-compte (9 outils, erreur 404).

### 1.2 Authentification

| Mécanisme | Stockage | Rattaché à | Source |
|---|---|---|---|
| **Clé MCP** passée **dans l'URL** | `sign_users.mcp_key`, **en clair**, recherche par égalité | un propriétaire (`sign_users.id` = `auth.users.id`) | `api/mcp.js:86-89` ; RPC `sign_generate_mcp_key` / `sign_get_mcp_key` / `sign_revoke_mcp_key` appelées en `src/lib/signTeam.ts:122-136` (SQL non versionné : format et entropie **à vérifier**) |
| Clé legacy globale | variables d'environnement `SIGN_MCP_SECRET` + `SIGN_OWNER_EMAIL`, toujours actives | un propriétaire fixe | `api/mcp.js:90-93` |
| JWT Supabase | session `closeos-sign-auth` | utilisateur auth (propriétaire ou équipier) | `src/lib/signSupabase.ts:12-21`, `src/lib/signAuth.ts:21-33` |
| Token signataire | `sign_contract_signers.access_token` (MCP : 128 bits, `randHex(16)`) | un signataire | `api/mcp.js:137-153` |

Limites de la clé MCP :
- pas de scopes, pas de clé en lecture seule, pas d'expiration ;
- pas de hash en base ;
- la clé transite dans l'URL, donc dans les logs ;
- une clé donne un accès complet au compte, suppression comprise.

### 1.3 Multi-tenant

- **Pas de compte plateforme.** Il n'existe ni entité organisation ni lien parent/enfant entre comptes.
- Chaque clé MCP résout exactement **un** propriétaire (`api/mcp.js:86-96`). Le schéma documenté de `sign_users` n'a pas de colonne parent (`CLOSEOS_SIGN.md:341`, **à vérifier** en base).
- Le seul niveau hiérarchique est l'équipe : propriétaire → équipiers (`sign_team_members`, `src/lib/signTeam.ts:4-27`). Un équipier n'agit que sur les modèles qui lui sont assignés.

**Créer un compte aujourd'hui :**
1. **Checkout public** avec carte obligatoire, 14 jours d'essai, puis 12 € / 30 € / 108 € (`api/sign-checkout.ts:28-32`, `87-166`). La doc annonce 9 € (`CLOSEOS_SIGN.md:64`) : **écart**.
2. **Provisionnement automatique** depuis un compte Business, par le trigger `trg_business_provision_sign` (`ACTIVER_ACCES_SIGN_DYLAN.md:31`). SQL non versionné.
3. **Insertion SQL manuelle** en service-role (`ACTIVER_ACCES_SIGN_DYLAN.md:9-16`).

Aucun endpoint ne permet à un tiers de créer un compte ou une clé par artisan. Le SaaS devrait gérer N comptes, chacun payant son abonnement, et N clés générées à la main dans l'UI par chaque artisan.

---

## 2. Cycle d'un document par API

| Étape | Par API ? | Comment / limites |
|---|---|---|
| **Importer un PDF** | **Oui** | `sign_import_contract` (`api/mcp.js:236-263`).<br>• PDF stocké en **base64 dans `sign_contracts.pdf_data`**, pas dans Storage (`api/mcp.js:133,245`).<br>• Pas de validation du type de fichier.<br>• Pages comptées par regex (`api/mcp.js:114-120`) et **forcées en A4 794×1122 px** (`api/mcp.js:13-14,31-32`).<br>• Taille bornée par le corps de requête Vercel (~4,5 Mo, **à vérifier**) : préférer `pdf_url`. |
| **Placer les champs** | **Oui** | `sign_place_fields` (`api/mcp.js:265-313`).<br>• 16 types : signature, initials, name, date, time, email, tel, address, city, siret, siren, tva, company_id, ape, **checkbox**, **text** (`api/mcp.js:34-37`).<br>• Coordonnées en % ou en px sur une page de 794 px de large.<br>• Tous les champs sont `required` (`api/mcp.js:308`).<br>• Pour un PDF non-A4, le placement vertical en % est faux (`api/mcp.js:304`). |
| **Définir les signataires** | **Oui** | `signers[]` dans `sign_configure_contract` (`api/mcp.js:378-397`) ou `sign_place_fields` (`:282-288`).<br>• Ordre parallèle ou séquentiel (`:363`).<br>• Rôles `owner`/`signer` uniquement, pas de destinataire en copie (`src/lib/signContracts.ts:27-29`).<br>• L'UI plafonne à 10 signataires (`src/lib/signColors.ts:11`), le MCP n'impose aucun plafond (**à vérifier**). |
| **Générer les liens** | **Oui** | `sign_get_signer_links` ou `sign_send_contract` (`api/mcp.js:137-153`, `524-531`).<br>• Format : `https://sign.closeos.fr/sign/s/<token hex 32>`.<br>• **Aucune expiration du token.** |
| **Envoyer** | **Partiel** | `sign_send_contract` passe le contrat en `sent` mais **n'envoie aucun email** (`api/mcp.js:403-412`) : le SaaS diffuse lui-même les liens.<br>Écarts avec l'envoi depuis l'app (`src/lib/signContracts.ts:844-910`) :<br>• pas de `document_hash`, donc empreinte d'origine vide sur le certificat ;<br>• pas d'événement `sent` ;<br>• signataires non passés à `sent` ;<br>• aucune relance auto, car le cron ne voit que `sign_contracts.access_token` (`api/cron/sign-reminders.ts:119-124`).<br>La signature propriétaire via API exige un humain : lien, code email, dessin (`api/mcp.js:427-486`, `api/sign-owner.ts:84-124`). |
| **Lire le statut** | **Oui, par polling** | `sign_get_status` (`api/mcp.js:315-328`).<br>• Statuts contrat : `draft\|sent\|viewed\|signed\|paid` (`api/mcp.js:660`).<br>• Statuts signataire : `pending\|sent\|opened\|signed\|declined` (`src/lib/signContracts.ts:31`).<br>• `viewed_at` est lu mais pas renvoyé.<br>• `verification_locked` n'est pas exposé. |
| **Récupérer le PDF signé** | **Non** | Aucun outil MCP ne le renvoie.<br>• Le PDF final est **généré dans le navigateur du dernier signataire** (jsPDF / html2canvas / pdf.js, `src/lib/signPdfExport.ts:163-216`, appelé en `src/pages/SignPublic.tsx:271-298`). C'est un **raster**, pas le PDF vectoriel d'origine (`CLOSEOS_SIGN.md:271-272`).<br>• [déployé] Il est ensuite scellé et stocké par `sign-certificate` (`sign-documents/<id>/sealed.pdf`, puis `certificat.pdf`).<br>• Si l'onglet se ferme, aucun PDF final n'existe tant que le propriétaire ne le régénère pas depuis l'éditeur (`CLOSEOS_SIGN.md:269`). |
| **Récupérer le dossier de preuve** | **Partiel** | • Journal append-only `sign_signature_events` (IP, user-agent, horodatage) : `src/lib/signCertificate.ts:30-42`.<br>• Certificat avec 3 empreintes SHA-256, chronologie et QR de vérification (`src/lib/signCertificate.ts:54-223`).<br>• Accessible uniquement via l'Edge `sign-certificate` (`get` → URL signée 600 s, `src/lib/signCertificate.ts:242-246`). Aucun outil MCP.<br>• Niveau : signature électronique **simple** (`src/lib/signCertificate.ts:220`, `CLOSEOS_SIGN.md:53`). |

### 2.1 Les 4 niveaux de vérification

Le niveau est défini **par contrat** via `verification_method` ; les listes blanches sont définies **par signataire** (`CLOSEOS_SIGN.md:152-170` ; type en `src/components/VerificationStyleModal.tsx:13`).

| Niveau | Contrôle | Pilotable par API ? |
|---|---|---|
| `none` | consentement coché uniquement (`src/pages/SignPublic.tsx:102`) | Oui |
| `email` | code à 6 chiffres par email (Brevo), valable 10 min, email en liste blanche | Oui |
| `sms` | code par SMS (ClickSend), numéro en liste blanche | Oui |
| `email_sms` | email puis SMS vers le même couple email/téléphone | Oui |

- **Mécanique** (`supabase/functions/sign-verify/index.ts:20-22`, `272-283`) : 3 essais, 3 renvois espacés de 90 s. Au 3e échec, le signataire est verrouillé et le propriétaire reçoit un email (`:126-148`).
- **Réglage par API** : `sign_configure_contract` (`api/mcp.js:360-361`, `386-393`). Limites :
  - une seule adresse ou un seul numéro autorisé par signataire ;
  - les listes blanches ne sont écrites que si `verification_method` est passé dans le **même** appel ;
  - **aucun outil pour débloquer** un signataire verrouillé.
- **Pas de vérification d'identité** : ni pièce d'identité, ni FranceConnect.
- **Coût** :
  - SMS ClickSend, identifiants dans la table `sign_secrets` (`supabase/functions/sign-verify/index.ts:103-111`) ;
  - le code ne contient **aucun prix, quota, compteur ni refacturation**. Tout est absorbé par CloseOS dans l'abonnement unique ;
  - seul frein : 4 SMS maximum par signataire et par canal ;
  - tarif ClickSend réel : **à vérifier** hors code.

### 2.2 Signature + paiement

- **Fonctionnement :** Stripe Connect Standard, avec l'argent versé sur le compte Stripe du propriétaire et 2 % de frais CloseOS (`supabase/functions/sign-pay/index.ts:18`, `CLOSEOS_SIGN.md:173-185`).
- **Désactivable, oui.** Le paiement est désactivé par défaut. Il ne s'active qu'avec `sign_contracts.payment_enabled` **et** `sign_contract_signers.payment_required`.
  - Par API : ne pas passer `payment`, ou passer `payment: false` (`api/mcp.js:375-377`).
- **Pièges :**
  - `payment: false` ne remet pas `payment_required` à false sur les signataires (**à vérifier**) ;
  - si `payment` est passé sans `verification_method`, le MCP force `verification_method='pay'` (`api/mcp.js:374`), qui est un mode legacy.
- **Portée pour un SaaS tiers :** le paiement va au détenteur de la clé. Il n'existe pas de « sous-marchand » par artisan géré par une plateforme.

---

## 3. Webhooks

### 3.1 Sign : aucun webhook sortant

- Aucun événement Sign n'est poussé vers un tiers : ni envoyé, ni ouvert, ni signé, ni payé, ni refusé.
- Le seul webhook de Sign est **Stripe entrant** (`api/sign-stripe-webhook.ts`).
- `sign_webhook_events` ne sert qu'à l'idempotence Stripe (`api/sign-stripe-webhook.ts:142`, `187-201`).
- Le dispatcher générique ne connaît pas Sign (`api/_lib/emit-webhook.ts:21`, `95-103`).

### 3.2 Système existant réutilisable (CRM / Business)

- **Dispatcher :** `emitWebhookEvent` (`api/_lib/emit-webhook.ts:36-89`).
- **Abonnements :** tables `crm_webhook_subscriptions` et `business_webhook_subscriptions`. Champs `url`, `events[]`, `secret` et `last_status` ; RLS `auth.uid() = user_id` (`supabase/migrations/20260422_crm_product.sql:84-128`).
- **Payload :** `{ event, product, user_id, timestamp, data }` (`api/_lib/emit-webhook.ts:52-58`).
- **Signature :** HMAC-SHA256 hex du corps, dans l'en-tête `X-CloseOS-Signature`, avec aussi `X-CloseOS-Event` et `X-CloseOS-Product` (`api/_lib/emit-webhook.ts:3-14`, `61-70`). Aucun timestamp n'est signé, donc pas de protection contre le rejeu.
- **Rejeu :** **aucun**. Un seul POST, sans timeout ni file d'attente ; seul `last_error` est enregistré (`api/_lib/emit-webhook.ts:73-84`). Appel parfois lancé sans `await` (`api/zapier-webhook.ts:54`) : sur Vercel, l'envoi peut être coupé (**à vérifier**).
- **Configuration :** dans l'UI (`src/business/components/BusinessCRMIntegrationModal.tsx:840-860`, `src/crm/pages/CRMIntegrations.tsx:58-92`). Le secret est généré dans le navigateur.

### 3.3 Où brancher des webhooks Sign

| Transition | Où | Côté serveur ? |
|---|---|---|
| Envoyé (app) | `src/lib/signContracts.ts:569-587`, `892-910` | **Non** (navigateur du propriétaire) |
| Envoyé (MCP) | `api/mcp.js:403-411`, `478` | Oui |
| Ouvert / téléchargé | Edge `sign-event`, déclenchée par `src/pages/SignPublic.tsx:159` | Edge, mais déclenchée par le navigateur ; code absent du repo |
| OTP envoyé / vérifié / verrouillé | `supabase/functions/sign-verify/index.ts:282`, `309`, `126-148` | Oui |
| Signé | `sign-verify` action `finalize` (`supabase/functions/sign-verify/index.ts:171-197`) | Oui |
| Signé + payé | `sign-pay` action `confirm` (`supabase/functions/sign-pay/index.ts:167-195`) | Oui |
| Paiements récurrents | `api/sign-stripe-webhook.ts:78-125` | Oui, sans navigateur |
| Complété / scellé / certifié | `afterSigned` → `sign-certificate` (`src/pages/SignPublic.tsx:271-297`) | **Orchestré par le navigateur** |
| Relance / suppression à 90 j | `api/cron/sign-reminders.ts:144-146`, `192` | Oui |

**Recommandation.** Émettre depuis la base plutôt que depuis le code : un trigger Postgres, ou un Database Webhook Supabase, sur `INSERT` de `sign_signature_events`. Ce journal fait foi (`CLOSEOS_SIGN.md:259`), et il capte aussi les transitions faites dans le navigateur.

---

## 4. Marque blanche

### 4.1 Page de signature (`/sign/s/:token` → `src/pages/SignPublic.tsx`, route `src/App.tsx:466`)

**Personnalisable :**
- 5 thèmes de document fixes, `da1` à `da5` (`src/lib/signThemes.ts:7-15`) ;
- des images **dans** le document, par exemple un logo (`src/pages/SignPublic.tsx:440-453`) ;
- le titre et le contenu du document.

**Reste CloseOS, codé en dur et sans aucun réglage :**
- logo « CloseOS Sign » (`src/components/SignLogo.tsx:10-23`, `src/pages/SignPublic.tsx:476-479`) ;
- titre de page « Signer le document | CloseOS Sign » (`src/pages/SignPublic.tsx:107`) ;
- charte `#191E1E` / `#CEFF8F` (`src/pages/SignPublic.tsx:456-472`) ;
- favicon (`index.html:74-85`) ;
- aperçus OG (`vercel.json:569-570`, `api/social-meta.ts:209-257`) ;
- pages CGV et confidentialité (`src/App.tsx:473-474`) ;
- page de vérification « scellé par CloseOS Sign » (`src/pages/SignVerify.tsx:28-72`) ;
- en-tête du certificat PDF et QR vers `sign.closeos.fr` (`src/lib/signCertificate.ts:28`, `66-68`) ;
- **domaine** : `sign.closeos.fr` en dur (`api/mcp.js:28`, `api/cron/sign-reminders.ts:32`, `supabase/functions/sign-verify/index.ts:23`). Pas de domaine personnalisé.

Pour un artisan, le signataire voit donc « CloseOS Sign », jamais la marque du SaaS ni celle de l'artisan.

### 4.2 Emails et SMS aux signataires

**Fournisseur :** Brevo. **Expéditeur :** `support@closeos.fr` / « CloseOS Sign » partout.

| Envoi | Source | Désactivable ? |
|---|---|---|
| Invitation « À signer » + relance manuelle | `src/lib/signContracts.ts:592-641`, `685` | **Oui via MCP** (`sign_send_contract` n'envoie rien). Non depuis l'app |
| Relances auto + avertissement de suppression | `api/cron/sign-reminders.ts:51-104`, `186` | Aucun flag. A priori non déclenchées pour les contrats MCP (**à vérifier**, voir §2) |
| Code OTP (email) | `supabase/functions/sign-verify/index.ts:45-100` | Seulement en passant à `verification_method='none'` |
| Email au signataire suivant (séquentiel) | [déployé] `advanceAfterSignerDone` dans `sign-verify` / `sign-pay` | Non |
| PDF final + certificat à toutes les parties | [déployé] `sign-certificate finalize` (`CLOSEOS_SIGN.md:269`) | **À vérifier**, aucun flag connu |
| Copie PDF à la demande du signataire | `src/lib/signPdfExport.ts:223-259` | Uniquement si le signataire la demande |
| Reçu de paiement | Stripe `receipt_email` (`supabase/functions/sign-pay/index.ts:109`) | Via les réglages du compte Stripe |
| **SMS OTP** | ClickSend, expéditeur global, texte en dur « CloseOS Sign : votre code… » (`supabase/functions/sign-verify/index.ts:103-123`) | Non |

Aucun flag `send_emails`, `email_from` ou `brand_*` n'existe, ni par compte ni par contrat.

---

## 5. Données et sécurité

### 5.1 Stockage

- **Base partagée :** Sign partage le projet Supabase de CloseOS, avec la même URL et la même clé anon (`src/lib/signSupabase.ts:7-10` vs `src/lib/supabase.ts:3-4`). La clé service-role utilisée par l'API Sign donne donc accès à **toutes** les données CloseOS.
- **PDF source et signatures :** stockés en **base64 dans Postgres**, dans `sign_contracts.pdf_data`, `sign_contract_fields.value` et `inline_values` (`src/lib/signContracts.ts:205-209`, `api/mcp.js:133`, `CLOSEOS_SIGN.md:147,339`).
- **PDF scellé et certificat :** bucket `sign-documents`, servi par URL signée de 600 s (`supabase/functions/sign-certificate/index.ts`). **Vérifié :** bucket privé, aucune policy Storage, accès service_role uniquement.
- **Rétention annoncée :** 5 ans pour le PDF final et le journal ; legal hold via `purge_hold` (`CLOSEOS_SIGN.md:309-315`). **Non construit** : purge automatique et cascade Storage « à construire » (`CLOSEOS_SIGN.md:319,409`).
  - Seule purge réelle : suppression à 90 jours des contrats restés `sent` (`api/cron/sign-reminders.ts:35`, `144-146`). Les fichiers Storage ne sont pas nettoyés.
- **Accès d'un client externe :**
  - lecture des métadonnées : oui ;
  - lecture du PDF ou du certificat : **non**, car `pdf_data` est exclu de `sign_get_contract` (`api/mcp.js:341`) ;
  - suppression : **oui**, via `sign_delete_contract`, y compris pour un contrat signé. Il suffit de passer `confirm=true`, sans aucun contrôle de `purge_hold` (`api/mcp.js:509-520`). **La preuve peut être effacée.** *Lot 1 : refusé pour signé/payé/certifié ; `purge_hold` bloqué en base pour tous les rôles.*

### 5.2 RLS et cloisonnement

- **Versionné :** seules deux tables ont leur RLS dans le repo.
  - `sign_contract_folders` : policy `owner_all`, `user_id = auth.uid()` (`supabase/migrations/20260705_sign_contract_folders.sql:12-13`).
  - `sign_owner_sign_sessions` : RLS sans policy, donc service-role uniquement (`supabase/migrations/20260705_sign_owner_sign_sessions.sql:20-21`).
- **Non versionné avant le lot 1 :** la création, la RLS, les triggers de garde et les RPC des tables de base. **Vérifié en production et désormais versionné** (`supabase/migrations/20260927_sign_baseline.sql`) : aucune policy `anon`, policies `authenticated` bornées au propriétaire. Deux exceptions graves, corrigées au lot 1 : failles 9 et 10 (voir « État après le lot 1 »).
- **Signataire anonyme :** il passe par des Edge Functions en service-role, avec un token dans le corps de la requête ; `src/pages/SignPublic.tsx` ne fait aucun appel direct à la base. **Vérifié :** `sign-public` (désormais dans `supabase/functions/sign-public/index.ts`) ne renvoie que le contrat du token, sans listes blanches ni tokens des autres signataires.
- **API MCP :** le cloisonnement se fait par filtres manuels `user_id=eq.<uid>`. **Faille :** `getOwnedContract` accepte un contrat dont `user_id` est NULL (`api/mcp.js:102` ; même défaut en `sign-mcp/index.mjs:93`). *Lot 1 : corrigé dans les deux fichiers. En base, `user_id` est `not null`.*

### 5.3 Failles relevées (à corriger avant toute ouverture)

| # | Faille | Source (avant lot 1) | Lot 1 |
|---|---|---|---|
| 1 | `/api/send-email` : relais Brevo **sans authentification**, avec expéditeur et contenu libres | `api/email.ts:53-88` | JWT ou secret interne exigé, expéditeur en liste blanche, 10 destinataires max ; copie du signataire via `/api/sign-send-copy` (token, contenu fixé, 5/24 h) |
| 2 | `sign-pay` actions `connect` / `connect-status` : `ownerId` lu dans le corps, sans JWT. L'appelant peut créer ou lier un compte Stripe à n'importe quel propriétaire, et `origin` libre ouvre une redirection | `supabase/functions/sign-pay/index.ts` — **vérifié : même code dans la version déployée v7** | session propriétaire exigée, `ownerId` ignoré, origine en liste blanche |
| 3 | [déployé] `sign-certificate` action `get` accepte un `contractId` sans authentification, donc l'URL du PDF certifié est accessible à quiconque connaît l'UUID (et `seal`/`finalize` aussi, faille 11) | `supabase/functions/sign-certificate/index.ts` | token du signataire ou session du propriétaire |
| 4 | `pdf_url` téléchargé côté serveur sans filtrage (risque SSRF) | `api/mcp.js:126-127` | https, IP publiques, sans redirection, 15 Mo, contenu %PDF |
| 5 | `/api/sign-send-verification-code` sans authentification : un `user_id` suffit pour déclencher un email ou un SMS | `api/sign-auth.ts:191-217` | session du compte visé exigée, 60 s entre envois ; vérification bornée à 5 essais (faille 12) |
| 6 | Clé MCP en clair, dans l'URL ; clé globale legacy toujours active ; CORS `*` | `api/mcp.js:86-93`, `800` | empreinte SHA-256 en base, en-tête Bearer accepté (URL gardée pour les connecteurs Claude), clé globale retirée, CORS limité aux origines Sign |
| 7 | Contrat signé supprimable par API, preuve comprise, sans contrôle de legal hold | `api/mcp.js:509-520` | refusé pour signé/payé/certifié ; `purge_hold` bloqué en base |
| 8 | `api/sign-owner.ts` `send-code` remet le compteur d'essais à 0 et n'est pas limité | `api/sign-owner.ts:96-97`, `108` | compteur conservé, 3 envois par session, 60 s d'écart ; CORS limité |

---

## 6. Synthèse

### 6.1 État par fonctionnalité

| Fonctionnalité nécessaire | État | Effort estimé |
|---|---|---|
| Interface API pour un SaaS (REST ou JSON-RPC stable, documentée) | **Partiel** (MCP seulement) | M : couche REST au-dessus des handlers de `api/mcp.js` |
| Clé plateforme + sous-comptes par artisan, création de compte par API | **Absent** | L : entité plateforme, provisioning, facturation plateforme |
| Clés API hashées, scopes, rotation, en en-tête | **Partiel** après lot 1 (clé MCP hashée + Bearer ; pas de scopes) | S |
| Import PDF (vraies dimensions, taille, stockage) | **Partiel** | S : reprendre pdf-lib de `sign-mcp/index.mjs:112-133` ; M : passer à Storage |
| Placement des champs | **Prêt** (limite non-A4) | S |
| Signataires, ordre, vérification | **Prêt** | S : déblocage d'un signataire, listes blanches multiples |
| Liens de signature | **Prêt** (pas d'expiration) | S |
| Envoi sans email CloseOS | **Prêt** via MCP | S : aligner `document_hash`, l'événement `sent` et les statuts signataires sur l'envoi de l'app |
| Statut | **Prêt** (polling) | — |
| Webhooks sortants signés avec rejeu | **Absent** | M : réutiliser `emit-webhook.ts`, ajouter file + retries, déclencheur sur `sign_signature_events` |
| PDF signé généré côté serveur, récupérable par API | **Absent** | L : génération serveur (pdf-lib sur le PDF d'origine) au lieu du navigateur |
| Dossier de preuve récupérable par API | **Partiel** | S : outil `get_certificate` / `get_events` |
| Signature propriétaire automatisable | **Absent** (humain requis) | M, décision produit : cachet serveur ou signature pré-enregistrée |
| Marque blanche page (logo, couleurs, nom) | **Absent** | M |
| Domaine personnalisé | **Absent** | M/L (domaines Vercel + certificats) |
| Emails / SMS désactivables ou brandés | **Partiel** (invitation seulement) | M : flag par compte ou contrat sur OTP, séquentiel, final, relances |
| Paiement désactivable | **Prêt** | — |
| Refacturation SMS | **Absent** | M : compteur + quotas par compte |
| Rétention, purge, legal hold | **Partiel** après lot 1 (`purge_hold` imposé en base ; pas de purge ni de cascade Storage) | M (lot 3) |
| Code des Edge Functions et SQL versionnés | **Prêt** après lot 1 | — |
| Failles de sécurité connues (§5.3 + 9 à 12) | **Corrigées** sur la branche lot 1, à déployer | — |

*S = quelques jours, M = 1 à 2 semaines, L = plus de 2 semaines. Estimations indicatives.*

### 6.2 Chantiers à faire dans Sign, dans l'ordre

1. **Sécuriser et versionner l'existant.** *Fait (lot 1), en attente de déploiement.*
   - Corriger les failles §5.3 : relais email, `sign-pay connect`, `sign-certificate get`, SSRF, suppression de preuve, contrat à `user_id` NULL.
   - Rapatrier dans le repo le code déployé des Edge Functions et le SQL des tables, RLS, triggers et RPC.
   - Sans cela, rien de ce qui est construit dessus n'est vérifiable.
2. **Compte plateforme et sous-comptes.**
   - Entité plateforme avec clé API hashée en en-tête et scopes.
   - Création de sous-comptes (un par artisan) par API, sans carte ni abonnement individuel.
   - Toutes les requêtes portent l'identifiant du sous-compte, et le paiement Stripe Connect est rattaché au sous-compte.
3. **Fiabiliser le cycle côté serveur.**
   - Générer le PDF signé et le certificat côté serveur à la dernière signature, au lieu du navigateur.
   - Exposer « récupérer PDF signé + preuve » par API.
   - Aligner l'envoi API sur l'envoi app : `document_hash`, événements, statuts.
   - Ajouter l'expiration des liens.
4. **Webhooks sortants.**
   - Déclencheur sur `sign_signature_events`.
   - Payload signé HMAC avec timestamp.
   - File d'attente avec retries, et configuration par API pour le compte plateforme.
5. **Marque blanche.**
   - Branding par sous-compte ou plateforme : logo, couleurs, nom sur la page, le certificat et l'OG.
   - Flags pour couper tous les emails et SMS CloseOS, ou les envoyer au nom de l'artisan.
   - Domaine personnalisé ensuite.
