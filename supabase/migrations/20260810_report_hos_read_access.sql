-- ============================================
-- CloseOS Business — lecture Head of Sales / Admin pour la page Rapport
-- ============================================
-- La route /business/report est ouverte à l'owner ET aux Head of Sales / Admin
-- (OwnerOnlyRoute). Or objectifs, formulaires, liens de tracking et historique
-- d'appels étaient en RLS strictement owner : ces blocs du rapport s'affichaient
-- vides pour un HOS, sans erreur — donc « 0 » au lieu de « pas le droit ».
--
-- On ouvre la LECTURE SEULE à ces deux rôles uniquement (pas à toute l'équipe),
-- sur le modèle de la policy « Team members can view owner invoices ».

CREATE OR REPLACE FUNCTION public.is_hos_or_admin_of(owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_team_members
    WHERE user_id = auth.uid()
      AND business_owner_id = owner
      AND role IN ('Head of Sales', 'Admin')
  );
$$;

DROP POLICY IF EXISTS "HOS can read owner objectives" ON business_objectives;
CREATE POLICY "HOS can read owner objectives"
  ON business_objectives FOR SELECT
  USING (public.is_hos_or_admin_of(user_id));

DROP POLICY IF EXISTS "HOS can read owner forms" ON business_forms;
CREATE POLICY "HOS can read owner forms"
  ON business_forms FOR SELECT
  USING (public.is_hos_or_admin_of(user_id));

DROP POLICY IF EXISTS "HOS can read owner form responses" ON business_form_responses;
CREATE POLICY "HOS can read owner form responses"
  ON business_form_responses FOR SELECT
  USING (public.is_hos_or_admin_of(user_id));

DROP POLICY IF EXISTS "HOS can read owner tracking links" ON business_tracking_links;
CREATE POLICY "HOS can read owner tracking links"
  ON business_tracking_links FOR SELECT
  USING (public.is_hos_or_admin_of(user_id));

DROP POLICY IF EXISTS "HOS can read owner tracking events" ON business_tracking_events;
CREATE POLICY "HOS can read owner tracking events"
  ON business_tracking_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM business_tracking_links l
    WHERE l.id = business_tracking_events.link_id
      AND public.is_hos_or_admin_of(l.user_id)
  ));

-- Historique d'appels : un membre ne voyait que les siens, le HOS ne voyait donc
-- pas l'activité téléphonique de l'équipe dans le rapport.
DROP POLICY IF EXISTS "HOS can read team call history" ON business_call_history;
CREATE POLICY "HOS can read team call history"
  ON business_call_history FOR SELECT
  USING (public.is_hos_or_admin_of(business_owner_id));
