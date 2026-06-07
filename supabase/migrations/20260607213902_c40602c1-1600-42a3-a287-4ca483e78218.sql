CREATE TABLE public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  started_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  target_url text,
  current_table text,
  current_pass int not null default 1,
  total_tables int not null default 0,
  processed_tables int not null default 0,
  total_read int not null default 0,
  total_written int not null default 0,
  failed_count int not null default 0,
  tables jsonb not null default '[]'::jsonb,
  logs jsonb not null default '[]'::jsonb,
  error text
);
GRANT SELECT ON public.sync_jobs TO authenticated;
GRANT ALL ON public.sync_jobs TO service_role;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin read sync_jobs" ON public.sync_jobs FOR SELECT TO authenticated USING (public.is_superadmin());
CREATE INDEX sync_jobs_started_at_idx ON public.sync_jobs (started_at DESC);