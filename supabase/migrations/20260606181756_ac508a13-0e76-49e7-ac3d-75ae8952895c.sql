
CREATE TYPE public.support_ticket_status AS ENUM ('open','in_progress','closed');
CREATE TYPE public.support_ticket_priority AS ENUM ('low','normal','high');

CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_domain_idx ON public.support_tickets(domain_id);
CREATE INDEX support_tickets_status_idx ON public.support_tickets(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select" ON public.support_tickets FOR SELECT TO authenticated
USING (public.is_superadmin() OR public.is_domain_admin(domain_id));

CREATE POLICY "tickets_insert" ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (public.is_superadmin() OR public.is_domain_admin(domain_id))
);

CREATE POLICY "tickets_update" ON public.support_tickets FOR UPDATE TO authenticated
USING (public.is_superadmin() OR public.is_domain_admin(domain_id))
WITH CHECK (public.is_superadmin() OR public.is_domain_admin(domain_id));

CREATE POLICY "tickets_delete" ON public.support_tickets FOR DELETE TO authenticated
USING (public.is_superadmin());

CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.support_ticket_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_messages_ticket_idx ON public.support_ticket_messages(ticket_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_messages_select" ON public.support_ticket_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.support_tickets t
  WHERE t.id = ticket_id
    AND (public.is_superadmin() OR public.is_domain_admin(t.domain_id))
));

CREATE POLICY "ticket_messages_insert" ON public.support_ticket_messages FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id
      AND (public.is_superadmin() OR public.is_domain_admin(t.domain_id))
  )
);

CREATE POLICY "ticket_messages_delete" ON public.support_ticket_messages FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_superadmin());

CREATE OR REPLACE FUNCTION public.bump_ticket_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets SET last_message_at = now(), updated_at = now()
    WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_ticket_last_message
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_ticket_last_message();
