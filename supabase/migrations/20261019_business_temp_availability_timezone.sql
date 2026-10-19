-- ============================================
-- CloseOS Business — Fuseau horaire propre à une dispo temporaire
-- ============================================
-- Une période peut être exprimée dans un autre fuseau que celui du profil
-- (ex. voyage à Tbilissi : 10h–14h heure géorgienne). Ses dates ET ses heures
-- sont alors lues dans ce fuseau, et changer le fuseau du profil ne la déplace
-- pas. NULL = fuseau du profil (comportement historique).
ALTER TABLE business_temporary_availability
  ADD COLUMN IF NOT EXISTS timezone text;
