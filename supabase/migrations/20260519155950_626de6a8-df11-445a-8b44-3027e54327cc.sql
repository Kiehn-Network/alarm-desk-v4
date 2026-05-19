CREATE OR REPLACE FUNCTION public.is_chat_participant(_conversation_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation(_conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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
            c.kind = 'channel'
            OR public.is_chat_participant(c.id, auth.uid())
          )
        )
      )
  )
$$;

DROP POLICY IF EXISTS cp_select ON public.chat_participants;

CREATE POLICY cp_select
ON public.chat_participants
FOR SELECT
TO authenticated
USING (
  public.is_superadmin()
  OR user_id = auth.uid()
  OR (
    domain_id = public.current_effective_domain_id()
    AND (
      public.is_domain_admin(domain_id)
      OR public.is_chat_participant(conversation_id, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS cc_select ON public.chat_conversations;

CREATE POLICY cc_select
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (public.can_access_conversation(id));