CREATE OR REPLACE FUNCTION public.is_lager_admin(_domain_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
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
REVOKE EXECUTE ON FUNCTION public.is_lager_admin(uuid) FROM anon;