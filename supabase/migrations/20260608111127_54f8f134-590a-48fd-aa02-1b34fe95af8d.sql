
INSERT INTO public.app_modules (key, name)
VALUES ('intervention', 'Intervention')
ON CONFLICT (key) DO NOTHING;

DO $$ BEGIN
  CREATE TYPE public.intervention_share_status AS ENUM ('offen','angenommen','in_bearbeitung','abgeschlossen','abgelehnt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.intervention_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  partner_domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  kontakt_email text,
  kontakt_telefon text,
  notiz text,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, partner_domain_id),
  CHECK (domain_id <> partner_domain_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_partners TO authenticated;
GRANT ALL ON public.intervention_partners TO service_role;
ALTER TABLE public.intervention_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partners_select_own_domain"
  ON public.intervention_partners FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());

CREATE POLICY "partners_admin_write"
  ON public.intervention_partners FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.is_domain_admin(domain_id))
  WITH CHECK (public.is_superadmin() OR public.is_domain_admin(domain_id));

CREATE TRIGGER trg_intervention_partners_updated
  BEFORE UPDATE ON public.intervention_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.einsatz_partner_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  einsatz_id uuid NOT NULL REFERENCES public.einsaetze(id) ON DELETE CASCADE,
  owner_domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  partner_domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  status public.intervention_share_status NOT NULL DEFAULT 'offen',
  partner_assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_notiz text,
  ablehnung_grund text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (einsatz_id, partner_domain_id)
);

CREATE INDEX IF NOT EXISTS idx_eps_partner_status ON public.einsatz_partner_shares (partner_domain_id, status);
CREATE INDEX IF NOT EXISTS idx_eps_einsatz ON public.einsatz_partner_shares (einsatz_id);
CREATE INDEX IF NOT EXISTS idx_eps_partner_fahrer ON public.einsatz_partner_shares (partner_assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.einsatz_partner_shares TO authenticated;
GRANT ALL ON public.einsatz_partner_shares TO service_role;
ALTER TABLE public.einsatz_partner_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.einsatz_is_shared_to_me(_einsatz_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.einsatz_partner_shares s
    WHERE s.einsatz_id = _einsatz_id
      AND s.partner_domain_id = public.current_effective_domain_id()
      AND s.status <> 'abgelehnt'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_partner_fahrer(_einsatz_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.einsatz_partner_shares s
    WHERE s.einsatz_id = _einsatz_id
      AND s.partner_assigned_to = _user_id
      AND s.status IN ('angenommen','in_bearbeitung','abgeschlossen')
  )
$$;

CREATE POLICY "shares_select_owner_or_partner"
  ON public.einsatz_partner_shares FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR owner_domain_id = public.current_effective_domain_id()
    OR partner_domain_id = public.current_effective_domain_id()
  );

CREATE POLICY "shares_insert_owner_admin"
  ON public.einsatz_partner_shares FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (owner_domain_id = public.current_effective_domain_id()
        AND (public.is_domain_admin(owner_domain_id) OR public.has_role(auth.uid(),'dispatcher'::app_role)))
  );

CREATE POLICY "shares_update_owner_or_partner"
  ON public.einsatz_partner_shares FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR owner_domain_id = public.current_effective_domain_id()
    OR partner_domain_id = public.current_effective_domain_id()
  )
  WITH CHECK (
    public.is_superadmin()
    OR owner_domain_id = public.current_effective_domain_id()
    OR partner_domain_id = public.current_effective_domain_id()
  );

CREATE POLICY "shares_delete_owner"
  ON public.einsatz_partner_shares FOR DELETE TO authenticated
  USING (public.is_superadmin() OR owner_domain_id = public.current_effective_domain_id());

CREATE TRIGGER trg_eps_updated
  BEFORE UPDATE ON public.einsatz_partner_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "einsaetze_select_partner_share"
  ON public.einsaetze FOR SELECT TO authenticated
  USING (public.einsatz_is_shared_to_me(id));

CREATE POLICY "einsaetze_update_partner_fahrer"
  ON public.einsaetze FOR UPDATE TO authenticated
  USING (public.user_is_partner_fahrer(id, auth.uid()) OR public.einsatz_is_shared_to_me(id))
  WITH CHECK (public.user_is_partner_fahrer(id, auth.uid()) OR public.einsatz_is_shared_to_me(id));

CREATE POLICY "historie_select_partner_share"
  ON public.einsatz_historie FOR SELECT TO authenticated
  USING (public.einsatz_is_shared_to_me(einsatz_id));
