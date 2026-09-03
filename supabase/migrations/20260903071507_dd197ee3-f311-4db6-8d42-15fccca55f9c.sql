CREATE TABLE public.lager_personen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id uuid NOT NULL,
  name text NOT NULL,
  personalnummer text,
  transponder_id text NOT NULL,
  aktiv boolean NOT NULL DEFAULT true,
  notiz text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lager_personen_domain_transponder_key
  ON public.lager_personen (domain_id, transponder_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lager_personen TO authenticated;
GRANT ALL ON public.lager_personen TO service_role;

ALTER TABLE public.lager_personen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lager_personen_select" ON public.lager_personen
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());

CREATE POLICY "lager_personen_insert" ON public.lager_personen
  FOR INSERT TO authenticated
  WITH CHECK ((domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)) OR public.is_superadmin());

CREATE POLICY "lager_personen_update" ON public.lager_personen
  FOR UPDATE TO authenticated
  USING ((domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)) OR public.is_superadmin())
  WITH CHECK ((domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)) OR public.is_superadmin());

CREATE POLICY "lager_personen_delete" ON public.lager_personen
  FOR DELETE TO authenticated
  USING ((domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)) OR public.is_superadmin());

CREATE TRIGGER lager_personen_set_updated_at
  BEFORE UPDATE ON public.lager_personen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();