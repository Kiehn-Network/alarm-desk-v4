
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS restricted_roles public.app_role[];

CREATE OR REPLACE FUNCTION public.can_access_conversation(_conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id = _conv_id
      AND (
        public.is_superadmin()
        OR (
          c.domain_id = public.current_effective_domain_id()
          AND (
            (c.kind = 'channel' AND (
              c.restricted_roles IS NULL
              OR public.is_domain_admin(c.domain_id)
              OR EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                  AND ur.role = ANY (c.restricted_roles)
                  AND (ur.domain_id IS NULL OR ur.domain_id = c.domain_id)
              )
            ))
            OR (c.kind = 'dm' AND public.is_chat_participant(c.id, auth.uid()))
          )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_zentrale_channel()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        AND ur.role IN ('admin'::public.app_role, 'dispatcher'::public.app_role)
        AND (ur.domain_id IS NULL OR ur.domain_id = _domain)
    );
  IF NOT _has_access THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id INTO _conv FROM public.chat_conversations
    WHERE domain_id = _domain AND kind = 'channel' AND title = 'Zentrale'
    LIMIT 1;
  IF _conv IS NOT NULL THEN
    UPDATE public.chat_conversations
      SET restricted_roles = ARRAY['admin','dispatcher']::public.app_role[]
      WHERE id = _conv AND (restricted_roles IS NULL);
    RETURN _conv;
  END IF;

  INSERT INTO public.chat_conversations (domain_id, kind, title, created_by, restricted_roles)
    VALUES (_domain, 'channel', 'Zentrale', auth.uid(),
            ARRAY['admin','dispatcher']::public.app_role[])
    RETURNING id INTO _conv;
  RETURN _conv;
END $$;

GRANT EXECUTE ON FUNCTION public.get_or_create_zentrale_channel() TO authenticated;
