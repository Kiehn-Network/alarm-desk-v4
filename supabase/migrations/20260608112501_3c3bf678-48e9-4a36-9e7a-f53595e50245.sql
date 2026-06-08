
CREATE TABLE public.intervention_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  partner_domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT intervention_allowlist_no_self CHECK (domain_id <> partner_domain_id),
  CONSTRAINT intervention_allowlist_unique UNIQUE (domain_id, partner_domain_id)
);

GRANT SELECT ON public.intervention_allowlist TO authenticated;
GRANT ALL ON public.intervention_allowlist TO service_role;

ALTER TABLE public.intervention_allowlist ENABLE ROW LEVEL SECURITY;

-- Eigene Domain darf ihre Allowlist lesen (um eigene Partner-Auswahl zu zeigen)
CREATE POLICY "allowlist_select_own_domain"
  ON public.intervention_allowlist
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR domain_id = public.current_effective_domain_id()
  );

-- Nur SuperAdmin darf schreiben
CREATE POLICY "allowlist_write_superadmin"
  ON public.intervention_allowlist
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
