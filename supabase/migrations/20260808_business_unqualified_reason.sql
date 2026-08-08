-- Motif de disqualification (stage = unqualified)
-- Renseigné via la pop-up affichée au passage en « Non-Qualifié »
-- (fiche prospect + drag & drop pipeline).
--   unqualified_reason  : clé stable du motif (budget, territory, other…)
--   unqualified_details : texte libre (obligatoire quand reason = 'other')
--   unqualified_at      : horodatage du passage en non-qualifié

alter table public.business_prospects
  add column if not exists unqualified_reason text,
  add column if not exists unqualified_details text,
  add column if not exists unqualified_at timestamptz;

comment on column public.business_prospects.unqualified_reason is
  'Clé du motif de disqualification (voir src/business/lib/unqualifiedReasons.ts)';
comment on column public.business_prospects.unqualified_details is
  'Motif libre saisi par l''utilisateur, obligatoire quand unqualified_reason = ''other''';
