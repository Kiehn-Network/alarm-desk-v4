
CREATE TABLE public.user_tour_settings (
  user_id uuid PRIMARY KEY,
  domain_id uuid NOT NULL,
  tour_enabled boolean NOT NULL DEFAULT true,
  enabled_steps text[] NOT NULL DEFAULT ARRAY[]::text[],
  completed_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_tour_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY uts_select ON public.user_tour_settings FOR SELECT TO authenticated
  USING (is_superadmin() OR user_id = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE POLICY uts_insert ON public.user_tour_settings FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR user_id = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE POLICY uts_update ON public.user_tour_settings FOR UPDATE TO authenticated
  USING (is_superadmin() OR user_id = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
  WITH CHECK (is_superadmin() OR user_id = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE POLICY uts_delete ON public.user_tour_settings FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE TRIGGER uts_set_updated_at BEFORE UPDATE ON public.user_tour_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
