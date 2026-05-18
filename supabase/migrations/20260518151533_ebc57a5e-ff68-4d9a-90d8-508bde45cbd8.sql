
-- Conversations
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('channel','dm')),
  title TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_conv_domain ON public.chat_conversations(domain_id);

-- Participants (immer für DMs; optional für Channels mit last_read_at)
CREATE TABLE public.chat_participants (
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  domain_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX idx_chat_part_user ON public.chat_participants(user_id);
CREATE INDEX idx_chat_part_conv ON public.chat_participants(conversation_id);

-- Messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  body TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  attachment_size BIGINT,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_msg_conv ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_msg_domain ON public.chat_messages(domain_id);

-- Helper: Zugriff auf Konversation
CREATE OR REPLACE FUNCTION public.can_access_conversation(_conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = _conv_id
      AND (
        public.is_superadmin()
        OR (
          c.domain_id = public.current_effective_domain_id()
          AND (
            c.kind = 'channel'
            OR EXISTS (
              SELECT 1 FROM public.chat_participants p
              WHERE p.conversation_id = c.id AND p.user_id = auth.uid()
            )
          )
        )
      )
  )
$$;

-- Helper: get_or_create_dm
CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other_user UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
  _domain UUID := public.current_effective_domain_id();
  _conv UUID;
  _other_domain UUID;
BEGIN
  IF _me IS NULL OR _other_user IS NULL OR _me = _other_user THEN
    RAISE EXCEPTION 'invalid users';
  END IF;
  SELECT domain_id INTO _other_domain FROM public.profiles WHERE id = _other_user;
  IF _other_domain IS DISTINCT FROM _domain THEN
    RAISE EXCEPTION 'user not in same domain';
  END IF;

  SELECT c.id INTO _conv
  FROM public.chat_conversations c
  WHERE c.kind = 'dm' AND c.domain_id = _domain
    AND EXISTS (SELECT 1 FROM public.chat_participants p1 WHERE p1.conversation_id = c.id AND p1.user_id = _me)
    AND EXISTS (SELECT 1 FROM public.chat_participants p2 WHERE p2.conversation_id = c.id AND p2.user_id = _other_user)
  LIMIT 1;

  IF _conv IS NOT NULL THEN RETURN _conv; END IF;

  INSERT INTO public.chat_conversations (domain_id, kind, created_by) VALUES (_domain, 'dm', _me) RETURNING id INTO _conv;
  INSERT INTO public.chat_participants (conversation_id, user_id, domain_id) VALUES (_conv, _me, _domain), (_conv, _other_user, _domain);
  RETURN _conv;
END $$;

-- Helper: get_or_create_domain_channel
CREATE OR REPLACE FUNCTION public.get_or_create_domain_channel()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _domain UUID := public.current_effective_domain_id();
  _conv UUID;
BEGIN
  IF _domain IS NULL THEN RAISE EXCEPTION 'no domain'; END IF;
  SELECT id INTO _conv FROM public.chat_conversations
   WHERE domain_id = _domain AND kind = 'channel' AND title = 'Allgemein' LIMIT 1;
  IF _conv IS NOT NULL THEN RETURN _conv; END IF;
  INSERT INTO public.chat_conversations (domain_id, kind, title, created_by)
    VALUES (_domain, 'channel', 'Allgemein', auth.uid()) RETURNING id INTO _conv;
  RETURN _conv;
END $$;

-- updated_at trigger
CREATE TRIGGER trg_chat_conv_updated BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY cc_select ON public.chat_conversations FOR SELECT TO authenticated
USING (
  is_superadmin() OR (
    domain_id = current_effective_domain_id()
    AND (kind = 'channel' OR EXISTS (
      SELECT 1 FROM public.chat_participants p WHERE p.conversation_id = id AND p.user_id = auth.uid()
    ))
  )
);
CREATE POLICY cc_insert ON public.chat_conversations FOR INSERT TO authenticated
WITH CHECK (domain_id = current_effective_domain_id() AND created_by = auth.uid());
CREATE POLICY cc_admin_all ON public.chat_conversations FOR ALL TO authenticated
USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- Participants policies
CREATE POLICY cp_select ON public.chat_participants FOR SELECT TO authenticated
USING (
  is_superadmin() OR user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.chat_participants me WHERE me.conversation_id = conversation_id AND me.user_id = auth.uid()
  ) OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id))
);
CREATE POLICY cp_insert ON public.chat_participants FOR INSERT TO authenticated
WITH CHECK (domain_id = current_effective_domain_id());
CREATE POLICY cp_update_own ON public.chat_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY cp_delete_admin ON public.chat_participants FOR DELETE TO authenticated
USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)) OR user_id = auth.uid());

-- Messages policies
CREATE POLICY cm_select ON public.chat_messages FOR SELECT TO authenticated
USING (public.can_access_conversation(conversation_id));
CREATE POLICY cm_insert ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND domain_id = current_effective_domain_id()
  AND public.can_access_conversation(conversation_id)
);
CREATE POLICY cm_update_own ON public.chat_messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid() OR is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
WITH CHECK (sender_id = auth.uid() OR is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));
CREATE POLICY cm_delete_own ON public.chat_messages FOR DELETE TO authenticated
USING (sender_id = auth.uid() OR is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_participants REPLICA IDENTITY FULL;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY chat_att_select ON storage.objects FOR SELECT TO authenticated, anon
USING (bucket_id = 'chat-attachments');
CREATE POLICY chat_att_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY chat_att_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
