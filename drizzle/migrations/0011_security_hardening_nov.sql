CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT (_user_id = auth.uid() OR public.is_superadmin()) AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (domain_id IS NULL OR domain_id = public.current_effective_domain_id())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_chat_participant(_conversation_id uuid, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.next_service_nr(_domain_id uuid)
 RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.is_superadmin() OR _domain_id = public.current_effective_domain_id()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN (SELECT coalesce(max(nummer), 0) + 1 FROM public.service_auftraege WHERE domain_id = _domain_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_service_nr(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_service_nr(uuid) TO authenticated, service_role;

-- Chat: nur sich selbst in zugängliche Unterhaltungen eintragen (Admins dürfen mehr)
DROP POLICY IF EXISTS cp_insert ON public.chat_participants;
CREATE POLICY cp_insert ON public.chat_participants FOR INSERT TO authenticated
WITH CHECK (
  domain_id = public.current_effective_domain_id()
  AND EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.domain_id = chat_participants.domain_id)
  AND (
    public.is_domain_admin(domain_id)
    OR (user_id = auth.uid() AND public.can_access_conversation(conversation_id))
  )
);

-- Einsätze: Ändern nur durch Admin/Disponent oder zugewiesene/erstellende Person
DROP POLICY IF EXISTS einsaetze_update ON public.einsaetze;
CREATE POLICY einsaetze_update ON public.einsaetze FOR UPDATE TO authenticated
USING (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND (
  public.is_domain_admin(domain_id) OR public.has_role(auth.uid(), 'dispatcher'::app_role)
  OR assigned_to = auth.uid() OR created_by = auth.uid())))
WITH CHECK (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND (
  public.is_domain_admin(domain_id) OR public.has_role(auth.uid(), 'dispatcher'::app_role)
  OR assigned_to = auth.uid() OR created_by = auth.uid())));

CREATE OR REPLACE FUNCTION public.einsatz_guard_approval()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('freigegeben','abgelehnt'))
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    IF NOT (public.is_superadmin() OR public.is_domain_admin(NEW.domain_id)
            OR public.has_role(auth.uid(), 'dispatcher'::app_role)) THEN
      RAISE EXCEPTION 'Nur Admins und Disponenten dürfen Einsätze freigeben oder ablehnen';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_einsatz_guard_approval ON public.einsaetze;
CREATE TRIGGER trg_einsatz_guard_approval BEFORE UPDATE ON public.einsaetze
FOR EACH ROW EXECUTE FUNCTION public.einsatz_guard_approval();

-- Partner-Freigaben: nur Admin/Disponent der beteiligten Domäne
DROP POLICY IF EXISTS shares_update_owner_or_partner ON public.einsatz_partner_shares;
CREATE POLICY shares_update_owner_or_partner ON public.einsatz_partner_shares FOR UPDATE TO authenticated
USING (public.is_superadmin() OR (
  (owner_domain_id = public.current_effective_domain_id() OR partner_domain_id = public.current_effective_domain_id())
  AND (public.is_domain_admin(public.current_effective_domain_id()) OR public.has_role(auth.uid(), 'dispatcher'::app_role))))
WITH CHECK (public.is_superadmin() OR (
  (owner_domain_id = public.current_effective_domain_id() OR partner_domain_id = public.current_effective_domain_id())
  AND (public.is_domain_admin(public.current_effective_domain_id()) OR public.has_role(auth.uid(), 'dispatcher'::app_role))));

-- Offene Lese-Regeln
DROP POLICY IF EXISTS modules_select ON public.app_modules;
CREATE POLICY modules_select ON public.app_modules FOR SELECT TO authenticated
USING (public.is_superadmin() OR public.current_effective_domain_id() IS NOT NULL);
DROP POLICY IF EXISTS ps_select ON public.platform_settings;
DROP POLICY IF EXISTS av_select ON public.app_versions;

-- Storage
DROP POLICY IF EXISTS bkn_public_read ON storage.objects;
DROP POLICY IF EXISTS rsn_public_read ON storage.objects;
DROP POLICY IF EXISTS dateien_bucket_insert ON storage.objects;
CREATE POLICY dateien_bucket_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dateien' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "intrahub upload" ON storage.objects;
CREATE POLICY "intrahub upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'intrahub' AND (storage.foldername(name))[1] = (select auth.uid()::text));