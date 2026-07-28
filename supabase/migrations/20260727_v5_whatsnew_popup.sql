-- ─── Pop-up "Quoi de neuf V5" (3 onglets : Sales / Business / Sign) ───
--
-- Une colonne booléenne par produit (même schéma que onboarding_completed /
-- has_onboarded déjà en place). DEFAULT true : un compte créé APRÈS cette
-- migration ne voit jamais le pop-up (il découvre le produit tel quel, pas
-- besoin de lui annoncer une nouveauté qu'il n'a jamais connue autrement).
-- Les comptes EXISTANTS sont explicitement repassés à false ci-dessous : ils
-- verront le pop-up une fois, à leur prochaine connexion, puis plus jamais.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_v5_popup boolean NOT NULL DEFAULT true;
UPDATE profiles SET has_seen_v5_popup = false;

ALTER TABLE business_users ADD COLUMN IF NOT EXISTS has_seen_v5_popup boolean NOT NULL DEFAULT true;
UPDATE business_users SET has_seen_v5_popup = false;

ALTER TABLE sign_users ADD COLUMN IF NOT EXISTS has_seen_v5_popup boolean NOT NULL DEFAULT true;
UPDATE sign_users SET has_seen_v5_popup = false;
