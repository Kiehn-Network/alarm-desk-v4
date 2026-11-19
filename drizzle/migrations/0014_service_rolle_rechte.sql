DO $$
DECLARE p record; q text; w text; sql text;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies
           WHERE schemaname='public' AND (qual ILIKE '%''dispatcher''::app_role%' OR with_check ILIKE '%''dispatcher''::app_role%') LOOP
    q := replace(p.qual, 'has_role(auth.uid(), ''dispatcher''::app_role)', '(has_role(auth.uid(), ''dispatcher''::app_role) OR has_role(auth.uid(), ''service''::app_role))');
    w := replace(p.with_check, 'has_role(auth.uid(), ''dispatcher''::app_role)', '(has_role(auth.uid(), ''dispatcher''::app_role) OR has_role(auth.uid(), ''service''::app_role))');
    sql := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF q IS NOT NULL THEN sql := sql || ' USING (' || q || ')'; END IF;
    IF w IS NOT NULL THEN sql := sql || ' WITH CHECK (' || w || ')'; END IF;
    EXECUTE sql;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.einsatz_guard_approval()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('freigegeben','abgelehnt'))
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    IF NOT (public.is_superadmin() OR public.is_domain_admin(NEW.domain_id)
            OR public.has_role(auth.uid(), 'dispatcher'::app_role)
            OR public.has_role(auth.uid(), 'service'::app_role)) THEN
      RAISE EXCEPTION 'Nur Admins, Service und Disponenten dürfen Einsätze freigeben oder ablehnen';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.get_or_create_zentrale_channel()
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _domain UUID := public.current_effective_domain_id();
  _conv UUID;
  _has_access boolean;
BEGIN
  IF _domain IS NULL THEN RAISE EXCEPTION 'no domain'; END IF;
  _has_access := public.is_superadmin()
    OR public.is_domain_admin(_domain)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'dispatcher'::public.app_role, 'service'::public.app_role)
        AND (ur.domain_id IS NULL OR ur.domain_id = _domain)
    );
  IF NOT _has_access THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO _conv FROM public.chat_conversations
    WHERE domain_id = _domain AND kind = 'channel' AND title = 'Zentrale' LIMIT 1;
  IF _conv IS NOT NULL THEN
    UPDATE public.chat_conversations
      SET restricted_roles = ARRAY['admin','dispatcher','service']::public.app_role[]
      WHERE id = _conv AND (restricted_roles IS NULL OR NOT ('service'::public.app_role = ANY(restricted_roles)));
    RETURN _conv;
  END IF;
  INSERT INTO public.chat_conversations (domain_id, kind, title, created_by, restricted_roles)
    VALUES (_domain, 'channel', 'Zentrale', auth.uid(), ARRAY['admin','dispatcher','service']::public.app_role[])
    RETURNING id INTO _conv;
  RETURN _conv;
END $function$;