CREATE TABLE public.checklisten_vorlagen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  name TEXT NOT NULL,
  einsatz_typ TEXT NOT NULL DEFAULT 'beide' CHECK (einsatz_typ IN ('av_einsatz','hausnotruf','beide')),
  punkte JSONB NOT NULL DEFAULT '[]'::jsonb,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX checklisten_vorlagen_domain_idx ON public.checklisten_vorlagen (domain_id, aktiv);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklisten_vorlagen TO authenticated;
GRANT ALL ON public.checklisten_vorlagen TO service_role;
ALTER TABLE public.checklisten_vorlagen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklisten_vorlagen_select" ON public.checklisten_vorlagen FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "checklisten_vorlagen_insert" ON public.checklisten_vorlagen FOR INSERT TO authenticated
  WITH CHECK (public.is_domain_admin(domain_id) OR public.is_superadmin());
CREATE POLICY "checklisten_vorlagen_update" ON public.checklisten_vorlagen FOR UPDATE TO authenticated
  USING (public.is_domain_admin(domain_id) OR public.is_superadmin()) WITH CHECK (public.is_domain_admin(domain_id) OR public.is_superadmin());
CREATE POLICY "checklisten_vorlagen_delete" ON public.checklisten_vorlagen FOR DELETE TO authenticated
  USING (public.is_domain_admin(domain_id) OR public.is_superadmin());

CREATE TRIGGER checklisten_vorlagen_set_updated_at BEFORE UPDATE ON public.checklisten_vorlagen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.einsatz_checklisten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  einsatz_id UUID NOT NULL REFERENCES public.einsaetze(id) ON DELETE CASCADE,
  vorlage_id UUID REFERENCES public.checklisten_vorlagen(id) ON DELETE SET NULL,
  vorlage_name TEXT NOT NULL,
  punkte JSONB NOT NULL DEFAULT '[]'::jsonb,
  abgeschlossen BOOLEAN NOT NULL DEFAULT false,
  abgeschlossen_am TIMESTAMPTZ,
  abgeschlossen_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX einsatz_checklisten_einsatz_idx ON public.einsatz_checklisten (einsatz_id);
CREATE INDEX einsatz_checklisten_domain_idx ON public.einsatz_checklisten (domain_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.einsatz_checklisten TO authenticated;
GRANT ALL ON public.einsatz_checklisten TO service_role;
ALTER TABLE public.einsatz_checklisten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "einsatz_checklisten_select" ON public.einsatz_checklisten FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "einsatz_checklisten_insert" ON public.einsatz_checklisten FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "einsatz_checklisten_update" ON public.einsatz_checklisten FOR UPDATE TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());

CREATE TRIGGER einsatz_checklisten_set_updated_at BEFORE UPDATE ON public.einsatz_checklisten
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();