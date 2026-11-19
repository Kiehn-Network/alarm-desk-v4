CREATE TABLE public.nutzer_aktivitaet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  user_name text,
  seite text NOT NULL,
  aktion text NOT NULL,
  ziel text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.nutzer_aktivitaet TO authenticated;
GRANT ALL ON public.nutzer_aktivitaet TO service_role;
ALTER TABLE public.nutzer_aktivitaet ENABLE ROW LEVEL SECURITY;
CREATE POLICY na_insert_own ON public.nutzer_aktivitaet FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (domain_id IS NULL OR domain_id = public.current_user_domain_id()));
CREATE POLICY na_select_admin ON public.nutzer_aktivitaet FOR SELECT TO authenticated
  USING (public.is_superadmin() OR (domain_id IS NOT NULL AND public.is_domain_admin(domain_id)));
CREATE INDEX nutzer_aktivitaet_domain_time ON public.nutzer_aktivitaet (domain_id, created_at DESC);
CREATE INDEX nutzer_aktivitaet_time ON public.nutzer_aktivitaet (created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.nutzer_aktivitaet;
DO $$ BEGIN
  PERFORM cron.schedule('nutzer-aktivitaet-7-tage', '17 * * * *',
    $c$DELETE FROM public.nutzer_aktivitaet WHERE created_at < now() - interval '7 days'$c$);
EXCEPTION WHEN others THEN RAISE NOTICE 'pg_cron nicht verfügbar: %', SQLERRM;
END $$;