CREATE TABLE public.lager_fahrzeuge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL,
  kennzeichen TEXT NOT NULL,
  bezeichnung TEXT,
  fahrer TEXT,
  code TEXT NOT NULL,
  notiz TEXT,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (domain_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lager_fahrzeuge TO authenticated;
GRANT ALL ON public.lager_fahrzeuge TO service_role;
ALTER TABLE public.lager_fahrzeuge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lager_fahrzeuge_select" ON public.lager_fahrzeuge FOR SELECT TO authenticated USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "lager_fahrzeuge_insert" ON public.lager_fahrzeuge FOR INSERT TO authenticated WITH CHECK (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "lager_fahrzeuge_update" ON public.lager_fahrzeuge FOR UPDATE TO authenticated USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "lager_fahrzeuge_delete" ON public.lager_fahrzeuge FOR DELETE TO authenticated USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE TRIGGER lager_fahrzeuge_updated_at BEFORE UPDATE ON public.lager_fahrzeuge FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();