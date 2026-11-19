CREATE OR REPLACE FUNCTION public.is_domain_service(_domain_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'service'::app_role AND domain_id = _domain_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_domain_service(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_domain_service(uuid) TO authenticated, service_role;

ALTER POLICY dda_all ON public.dienstausweis_daten
  USING (is_domain_admin(domain_id) OR is_domain_service(domain_id))
  WITH CHECK (is_domain_admin(domain_id) OR is_domain_service(domain_id));
ALTER POLICY dad_all ON public.dienstausweis_designs
  USING (is_domain_admin(domain_id) OR is_domain_service(domain_id))
  WITH CHECK (is_domain_admin(domain_id) OR is_domain_service(domain_id));

ALTER POLICY erp_settings_insert ON public.erp_settings
  WITH CHECK (is_superadmin() OR ((domain_id = current_effective_domain_id()) AND (is_domain_admin(domain_id) OR is_domain_service(domain_id))));
ALTER POLICY erp_settings_update ON public.erp_settings
  USING (is_superadmin() OR ((domain_id = current_effective_domain_id()) AND (is_domain_admin(domain_id) OR is_domain_service(domain_id))))
  WITH CHECK (is_superadmin() OR ((domain_id = current_effective_domain_id()) AND (is_domain_admin(domain_id) OR is_domain_service(domain_id))));

ALTER POLICY settings_insert ON public.app_settings
  WITH CHECK (is_superadmin() OR ((domain_id = current_effective_domain_id()) AND (is_domain_admin(domain_id) OR is_domain_service(domain_id))));
ALTER POLICY settings_update ON public.app_settings
  USING (is_superadmin() OR ((domain_id = current_effective_domain_id()) AND (is_domain_admin(domain_id) OR is_domain_service(domain_id))))
  WITH CHECK (is_superadmin() OR ((domain_id = current_effective_domain_id()) AND (is_domain_admin(domain_id) OR is_domain_service(domain_id))));

ALTER POLICY "Fuhrpark: Loeschen nur Domain-Admin" ON public.fuhrpark_fahrzeuge USING (is_domain_admin(domain_id) OR is_domain_service(domain_id));
ALTER POLICY "Fuhrpark-KM-Log: Loeschen nur Domain-Admin" ON public.fuhrpark_km_log USING (is_domain_admin(domain_id) OR is_domain_service(domain_id));
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('fuhrpark_schaeden','fuhrpark_termine') AND cmd='DELETE' AND qual = 'is_domain_admin(domain_id)' LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (is_domain_admin(domain_id) OR is_domain_service(domain_id))', p.policyname, p.tablename);
  END LOOP;
END $$;