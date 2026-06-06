
CREATE OR REPLACE FUNCTION public.superadmin_domain_stats(_domain_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  user_cnt bigint := 0;
  ein_cnt bigint := 0;
  ein_24h bigint := 0;
  files_cnt bigint := 0;
  files_bytes bigint := 0;
  lic_active bigint := 0;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT count(*) INTO user_cnt FROM public.profiles WHERE domain_id = _domain_id;
  BEGIN
    SELECT count(*), count(*) FILTER (WHERE created_at > now() - interval '24 hours')
      INTO ein_cnt, ein_24h FROM public.einsaetze WHERE domain_id = _domain_id;
  EXCEPTION WHEN OTHERS THEN ein_cnt := 0; ein_24h := 0; END;
  BEGIN
    SELECT count(*), COALESCE(sum(size_bytes), 0)
      INTO files_cnt, files_bytes FROM public.dateien
      WHERE domain_id = _domain_id AND deleted_at IS NULL;
  EXCEPTION WHEN OTHERS THEN files_cnt := 0; files_bytes := 0; END;
  SELECT count(*) INTO lic_active FROM public.licenses
    WHERE domain_id = _domain_id AND status = 'active'
      AND (valid_until IS NULL OR valid_until > now());

  result := jsonb_build_object(
    'users', user_cnt,
    'einsaetze_total', ein_cnt,
    'einsaetze_24h', ein_24h,
    'dateien_count', files_cnt,
    'dateien_bytes', files_bytes,
    'licenses_active', lic_active,
    'generated_at', now()
  );
  RETURN result;
END;
$$;
