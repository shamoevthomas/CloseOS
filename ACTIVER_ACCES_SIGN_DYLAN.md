# Activer l'accès CloseOS Sign pour Dylan Bonnet

> **Pour qui ?** Une autre conversation Claude Code, **uniquement quand l'utilisateur (Thomas) demande explicitement** « ouvre / active l'accès Sign à Dylan ». Tant qu'il ne l'a pas demandé, **ne rien exécuter**.

---

## TL;DR — la seule action à faire

Lancer cette requête sur le projet Supabase **CloseOS** (`qwjvdwpixewsctircibl`) :

```sql
insert into public.sign_users (id, email, full_name, phone)
select b.id, b.email, b.full_name, b.phone
from public.business_users b
where lower(b.email) = 'bonnetdylan42@gmail.com'
  and not exists (select 1 from public.sign_users s where s.id = b.id)
returning id::text, email, full_name;
```

Doit renvoyer **1 ligne**. C'est tout : **aucun déploiement, aucune modif de code, aucun nouveau compte ni nouveau mot de passe.** Dylan pourra ensuite se connecter sur `sign.closeos.fr` avec son **email + mot de passe Business**.

Outil : MCP `mcp__supabase__execute_sql` (project_id `qwjvdwpixewsctircibl`) ou l'éditeur SQL du dashboard Supabase.

---

## Contexte (à comprendre avant d'agir)

- **Modèle de comptes** (décidé le 2026-06-10) : *tout compte CloseOS Business a un compte CloseOS Sign avec le même login.*
  - Un compte Business = **une identité `auth.users`** qui possède une ligne `profiles` **et** une ligne `business_users`.
  - « Avoir un compte Sign » = avoir une ligne **`sign_users`** dont l'**`id` = l'id auth** du Business. L'identité est **partagée** : Dylan se connectera à Sign avec son **email + mot de passe Business existant** (pas de second compte, pas de mot de passe dupliqué).
- **Dylan est la SEULE exception volontaire.** Son compte Business existe déjà mais on ne lui a pas créé de ligne `sign_users`. L'activer = créer cette ligne (la requête du TL;DR).
- **Pourquoi un insert manuel ?** Le trigger `trg_business_provision_sign` crée le compte Sign automatiquement **à l'INSERT** d'une ligne `business_users`. Dylan existe déjà → ce trigger ne se redéclenchera jamais pour lui → l'activation se fait donc **à la main** avec la requête ci-dessus.

## Identifiants

| | |
|---|---|
| Email Business | `bonnetdylan42@gmail.com` |
| `business_users.id` (= id auth) | `c62164d1-cb2e-450d-abab-2e18cee46f5e` |
| Projet Supabase | `qwjvdwpixewsctircibl` |

---

## Étape 1 — Vérifier l'état AVANT

```sql
select b.id::text, b.email, b.full_name,
       exists(select 1 from public.sign_users s where s.id = b.id) as has_sign
from public.business_users b
where lower(b.email) = 'bonnetdylan42@gmail.com';
```

- Attendu : **1 ligne, `has_sign = false`**.
- Si `has_sign = true` → c'est **déjà activé**, ne rien faire.
- Si **0 ligne** → son compte Business n'existe pas/plus : **s'arrêter et prévenir l'utilisateur** (ne pas créer de compte Business).

## Étape 2 — Activer

Lancer la requête du **TL;DR**. Elle est **idempotente** (le `not exists` empêche tout doublon). Elle doit renvoyer la ligne créée.

## Étape 3 — Vérifier APRÈS

```sql
select s.id::text, s.email, s.full_name, s.created_at,
       exists(select 1 from public.business_users b where b.id = s.id) as is_business
from public.sign_users s
where lower(s.email) = 'bonnetdylan42@gmail.com';
```

- Attendu : **1 ligne, `is_business = true`**.

---

## Ce qui se passe ensuite

Dylan peut se connecter **immédiatement** sur `sign.closeos.fr` (page `/sign/login`) avec son **email + mot de passe Business**. Au premier login : espace Sign vierge (onboarding), son nom déjà pré-rempli depuis `business_users`. Rien d'autre à faire.

## À NE PAS faire

- ❌ Ne **pas** créer un nouvel utilisateur `auth.users` ni un nouveau mot de passe pour Dylan — l'identité auth est partagée avec son compte Business.
- ❌ Ne **pas** modifier les triggers de séparation (`sign_enforce_account_separation`, `enforce_no_sign_account`) ni `handle_new_user`.
- ❌ Ne **pas** toucher au code applicatif ni redéployer — c'est inutile, l'activation est purement en base.
- ⚠️ La règle « **Sales pur ⇎ Sign** » reste active : cet insert n'est autorisé **que parce que Dylan a une ligne `business_users`**. (Un `profiles` sans `business_users` serait refusé par le trigger — comportement normal, ne pas le contourner.)

## Annuler (si l'activation était une erreur)

À n'utiliser **que juste après** et **seulement si Dylan n'a encore rien créé dans Sign** :

```sql
delete from public.sign_users s
where lower(s.email) = 'bonnetdylan42@gmail.com'
  and exists (select 1 from public.business_users b where b.id = s.id);
```

⚠️ Supprime son compte Sign (et ses éventuelles données Sign en cascade). Ne pas l'utiliser s'il a déjà des contrats/contacts Sign.

---

## Pour aller plus loin

Modèle de comptes et fonctionnement complet du module : voir **`CLOSEOS_SIGN.md`** (même dossier).
