
-- Allow archived status
ALTER TABLE public.domains DROP CONSTRAINT IF EXISTS domains_status_check;
ALTER TABLE public.domains ADD CONSTRAINT domains_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'disabled'::text, 'archived'::text]));

-- Domain-Stats RPC for superadmin
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
    SELECT count(*), COALESCE(sum(groesse_bytes), 0)
      INTO files_cnt, files_bytes FROM public.dateien WHERE domain_id = _domain_id;
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

-- pg_cron: daily license expiry notice at 09:00 UTC
DO $$
DECLARE
  job_url text;
  anon_key text;
BEGIN
  -- Best-effort: only schedule when pg_cron + pg_net are available
  PERFORM 1 FROM pg_extension WHERE extname = 'pg_cron';
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM 1 FROM pg_extension WHERE extname = 'pg_net';
  IF NOT FOUND THEN RETURN; END IF;

  -- Unschedule previous job (idempotent)
  BEGIN
    PERFORM cron.unschedule('license-expiry-notice');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  job_url := 'https://project--d24def79-6f1f-485f-bbf8-387dfb1597be.lovable.app/api/public/hooks/license-expiry';
  anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbnRydXBvbXdrb3RocmhsaG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTU5NjIsImV4cCI6MjA5NDUzMTk2Mn0.klj29sOmPqxqdjryhBDBhd2JAC3_ffhDWr0iGRz7Ikg';

  PERFORM cron.schedule(
    'license-expiry-notice',
    '0 9 * * *',
    format($cmd$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$cmd$,
      job_url,
      jsonb_build_object('Content-Type','application/json','apikey',anon_key)::text)
  );
END $$;
