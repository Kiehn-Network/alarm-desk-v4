CREATE TABLE public.dienstausweis_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dienstausweis_designs TO authenticated;
GRANT ALL ON public.dienstausweis_designs TO service_role;
ALTER TABLE public.dienstausweis_designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dad_all ON public.dienstausweis_designs FOR ALL TO authenticated
  USING (public.is_domain_admin(domain_id)) WITH CHECK (public.is_domain_admin(domain_id));
CREATE INDEX dad_domain_idx ON public.dienstausweis_designs(domain_id);

CREATE TABLE public.dienstausweis_daten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  user_id uuid NOT NULL,
  foto text,
  ausweis_nr text,
  funktion text,
  gueltig_bis date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dienstausweis_daten TO authenticated;
GRANT ALL ON public.dienstausweis_daten TO service_role;
ALTER TABLE public.dienstausweis_daten ENABLE ROW LEVEL SECURITY;
CREATE POLICY dda_all ON public.dienstausweis_daten FOR ALL TO authenticated
  USING (public.is_domain_admin(domain_id)) WITH CHECK (public.is_domain_admin(domain_id));

CREATE TRIGGER dad_upd BEFORE UPDATE ON public.dienstausweis_designs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER dda_upd BEFORE UPDATE ON public.dienstausweis_daten FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();