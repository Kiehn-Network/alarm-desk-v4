
CREATE TABLE public.superadmin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.superadmin_audit_log TO authenticated;
GRANT ALL ON public.superadmin_audit_log TO service_role;

ALTER TABLE public.superadmin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins read audit log"
  ON public.superadmin_audit_log FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE INDEX idx_sa_audit_created ON public.superadmin_audit_log (created_at DESC);
CREATE INDEX idx_sa_audit_action ON public.superadmin_audit_log (action);
CREATE INDEX idx_sa_audit_actor ON public.superadmin_audit_log (actor_id);

-- Health snapshot: DB size, pgmq queue depth (best-effort), recent send stats
CREATE OR REPLACE FUNCTION public.superadmin_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq, cron
AS $$
DECLARE
  result jsonb;
  db_size_bytes bigint;
  auth_q_len bigint := 0;
  tx_q_len bigint := 0;
  auth_dlq_len bigint := 0;
  tx_dlq_len bigint := 0;
  sent_24h bigint := 0;
  failed_24h bigint := 0;
  dlq_24h bigint := 0;
  pending_now bigint := 0;
  cron_runs_24h bigint := 0;
  cron_failed_24h bigint := 0;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT pg_database_size(current_database()) INTO db_size_bytes;

  BEGIN
    SELECT count(*) INTO auth_q_len FROM pgmq.q_auth_emails;
  EXCEPTION WHEN OTHERS THEN auth_q_len := -1; END;
  BEGIN
    SELECT count(*) INTO tx_q_len FROM pgmq.q_transactional_emails;
  EXCEPTION WHEN OTHERS THEN tx_q_len := -1; END;
  BEGIN
    SELECT count(*) INTO auth_dlq_len FROM pgmq.q_auth_emails_dlq;
  EXCEPTION WHEN OTHERS THEN auth_dlq_len := -1; END;
  BEGIN
    SELECT count(*) INTO tx_dlq_len FROM pgmq.q_transactional_emails_dlq;
  EXCEPTION WHEN OTHERS THEN tx_dlq_len := -1; END;

  WITH latest AS (
    SELECT DISTINCT ON (message_id) status, created_at
      FROM public.email_send_log
      WHERE message_id IS NOT NULL
        AND created_at > now() - interval '24 hours'
      ORDER BY message_id, created_at DESC
  )
  SELECT
    count(*) FILTER (WHERE status = 'sent'),
    count(*) FILTER (WHERE status IN ('failed','bounced','complained')),
    count(*) FILTER (WHERE status = 'dlq'),
    count(*) FILTER (WHERE status = 'pending')
  INTO sent_24h, failed_24h, dlq_24h, pending_now
  FROM latest;

  BEGIN
    SELECT count(*), count(*) FILTER (WHERE status <> 'succeeded')
      INTO cron_runs_24h, cron_failed_24h
      FROM cron.job_run_details
     WHERE start_time > now() - interval '24 hours';
  EXCEPTION WHEN OTHERS THEN cron_runs_24h := -1; cron_failed_24h := -1; END;

  result := jsonb_build_object(
    'db_size_bytes', db_size_bytes,
    'queues', jsonb_build_object(
      'auth_emails', auth_q_len,
      'transactional_emails', tx_q_len,
      'auth_emails_dlq', auth_dlq_len,
      'transactional_emails_dlq', tx_dlq_len
    ),
    'emails_24h', jsonb_build_object(
      'sent', sent_24h, 'failed', failed_24h, 'dlq', dlq_24h, 'pending', pending_now
    ),
    'cron_24h', jsonb_build_object(
      'runs', cron_runs_24h, 'failed', cron_failed_24h
    ),
    'generated_at', now()
  );
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_cron_jobs()
RETURNS TABLE (jobname text, schedule text, active boolean, last_status text, last_start timestamptz, last_end timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT j.jobname::text,
           j.schedule::text,
           j.active,
           r.status::text AS last_status,
           r.start_time AS last_start,
           r.end_time AS last_end
      FROM cron.job j
      LEFT JOIN LATERAL (
        SELECT status, start_time, end_time
          FROM cron.job_run_details d
         WHERE d.jobid = j.jobid
         ORDER BY start_time DESC
         LIMIT 1
      ) r ON true
     ORDER BY j.jobname;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_health() FROM public, anon;
REVOKE ALL ON FUNCTION public.superadmin_cron_jobs() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.superadmin_health() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_cron_jobs() TO authenticated, service_role;
