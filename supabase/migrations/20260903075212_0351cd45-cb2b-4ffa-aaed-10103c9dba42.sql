CREATE TABLE public.lager_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (domain_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lager_admins TO authenticated;
GRANT ALL ON public.lager_admins TO service_role;
ALTER TABLE public.lager_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_lager_admin(_domain_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_domain_admin(_domain_id)
    OR EXISTS (
      SELECT 1 FROM public.lager_admins
      WHERE domain_id = _domain_id
        AND user_id = auth.uid()
    )
$function$;

GRANT EXECUTE ON FUNCTION public.is_lager_admin(uuid) TO authenticated;

CREATE POLICY "lager_admins_select" ON public.lager_admins FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_domain_admin(domain_id) OR public.is_superadmin());
CREATE POLICY "lager_admins_insert" ON public.lager_admins FOR INSERT TO authenticated
  WITH CHECK (public.is_domain_admin(domain_id));
CREATE POLICY "lager_admins_update" ON public.lager_admins FOR UPDATE TO authenticated
  USING (public.is_domain_admin(domain_id)) WITH CHECK (public.is_domain_admin(domain_id));
CREATE POLICY "lager_admins_delete" ON public.lager_admins FOR DELETE TO authenticated
  USING (public.is_domain_admin(domain_id));

DROP POLICY IF EXISTS "lager_artikel_insert" ON public.lager_artikel;
DROP POLICY IF EXISTS "lager_artikel_update" ON public.lager_artikel;
DROP POLICY IF EXISTS "lager_artikel_delete" ON public.lager_artikel;
CREATE POLICY "lager_artikel_insert" ON public.lager_artikel FOR INSERT TO authenticated
  WITH CHECK (public.is_lager_admin(domain_id));
CREATE POLICY "lager_artikel_update" ON public.lager_artikel FOR UPDATE TO authenticated
  USING (public.is_lager_admin(domain_id)) WITH CHECK (public.is_lager_admin(domain_id));
CREATE POLICY "lager_artikel_delete" ON public.lager_artikel FOR DELETE TO authenticated
  USING (public.is_lager_admin(domain_id));

DROP POLICY IF EXISTS "lager_settings_insert" ON public.lager_settings;
DROP POLICY IF EXISTS "lager_settings_update" ON public.lager_settings;
CREATE POLICY "lager_settings_insert" ON public.lager_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_lager_admin(domain_id));
CREATE POLICY "lager_settings_update" ON public.lager_settings FOR UPDATE TO authenticated
  USING (public.is_lager_admin(domain_id)) WITH CHECK (public.is_lager_admin(domain_id));