
CREATE TABLE public.schluesseluebergabe_protokolle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  protokoll_nr bigint NOT NULL,
  richtung text NOT NULL CHECK (richtung IN ('ausgang','eingang')),
  kunden_name text,
  strasse text,
  ort text,
  uebergeben_von_name text,
  uebergeben_an_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notiz text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain_id, protokoll_nr)
);

CREATE INDEX idx_schluesseluebergabe_domain ON public.schluesseluebergabe_protokolle(domain_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schluesseluebergabe_protokolle TO authenticated;
GRANT ALL ON public.schluesseluebergabe_protokolle TO service_role;

ALTER TABLE public.schluesseluebergabe_protokolle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domain members can read protokolle"
  ON public.schluesseluebergabe_protokolle FOR SELECT
  TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());

CREATE POLICY "domain members can insert protokolle"
  ON public.schluesseluebergabe_protokolle FOR INSERT
  TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id() OR public.is_superadmin());

CREATE POLICY "domain admins can delete protokolle"
  ON public.schluesseluebergabe_protokolle FOR DELETE
  TO authenticated
  USING (public.is_domain_admin(domain_id));

-- Footer settings per domain
CREATE TABLE public.schluesseluebergabe_settings (
  domain_id uuid PRIMARY KEY REFERENCES public.domains(id) ON DELETE CASCADE,
  firmenname text,
  footer_adresse text,
  footer_kontakt text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schluesseluebergabe_settings TO authenticated;
GRANT ALL ON public.schluesseluebergabe_settings TO service_role;

ALTER TABLE public.schluesseluebergabe_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domain members can read footer settings"
  ON public.schluesseluebergabe_settings FOR SELECT
  TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());

CREATE POLICY "domain admins can upsert footer settings"
  ON public.schluesseluebergabe_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_domain_admin(domain_id));

CREATE POLICY "domain admins can update footer settings"
  ON public.schluesseluebergabe_settings FOR UPDATE
  TO authenticated
  USING (public.is_domain_admin(domain_id))
  WITH CHECK (public.is_domain_admin(domain_id));

-- Sequence helper for protokoll_nr per domain
CREATE OR REPLACE FUNCTION public.next_schluessel_protokoll_nr(_domain_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_nr bigint;
BEGIN
  SELECT COALESCE(MAX(protokoll_nr), 0) + 1
    INTO next_nr
    FROM public.schluesseluebergabe_protokolle
    WHERE domain_id = _domain_id;
  RETURN next_nr;
END;
$$;
