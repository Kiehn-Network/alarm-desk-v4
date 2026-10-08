CREATE TABLE public.kunden_notizen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  einsatz_id uuid,
  kunden_name text,
  teilnehmer_id text,
  anlagen_nr text,
  key_number text,
  address text,
  text text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kunden_notizen TO authenticated;
GRANT ALL ON public.kunden_notizen TO service_role;
ALTER TABLE public.kunden_notizen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kn_select" ON public.kunden_notizen FOR SELECT TO authenticated
  USING (domain_id = public.current_user_domain_id());
CREATE POLICY "kn_insert" ON public.kunden_notizen FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_user_domain_id() AND created_by = auth.uid());
CREATE POLICY "kn_update" ON public.kunden_notizen FOR UPDATE TO authenticated
  USING (domain_id = public.current_user_domain_id() AND (created_by = auth.uid() OR public.is_domain_admin(domain_id)));
CREATE POLICY "kn_delete" ON public.kunden_notizen FOR DELETE TO authenticated
  USING (domain_id = public.current_user_domain_id() AND (created_by = auth.uid() OR public.is_domain_admin(domain_id)));
CREATE INDEX kunden_notizen_domain_idx ON public.kunden_notizen(domain_id, created_at DESC);
CREATE INDEX kunden_notizen_tn_idx ON public.kunden_notizen(teilnehmer_id);
CREATE INDEX kunden_notizen_name_idx ON public.kunden_notizen(kunden_name);
CREATE TRIGGER kunden_notizen_updated BEFORE UPDATE ON public.kunden_notizen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();