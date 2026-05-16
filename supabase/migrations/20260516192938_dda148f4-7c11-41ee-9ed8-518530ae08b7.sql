-- Dateien-Tabelle
create table public.dateien (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  address text,
  key_number text,
  uploaded_by uuid references auth.users(id) on delete set null,
  folder text,
  kunden_name text,
  notiz text,
  teilnehmer_id text,
  anlagen_nr text,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_dateien_folder on public.dateien(folder);
create index idx_dateien_kunden_name on public.dateien(kunden_name);
create index idx_dateien_address on public.dateien(address);
create index idx_dateien_deleted_at on public.dateien(deleted_at);

alter table public.dateien enable row level security;

create policy "dateien_select_authenticated"
  on public.dateien for select
  to authenticated
  using (true);

create policy "dateien_insert_authenticated"
  on public.dateien for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

create policy "dateien_update_own_or_admin"
  on public.dateien for update
  to authenticated
  using (
    auth.uid() = uploaded_by
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'dispatcher')
  );

create policy "dateien_delete_admin"
  on public.dateien for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger dateien_set_updated_at
  before update on public.dateien
  for each row execute function public.set_updated_at();

-- Verknüpfungen zwischen Dateien
create table public.datei_verknuepfungen (
  id uuid primary key default gen_random_uuid(),
  datei_a_id uuid not null references public.dateien(id) on delete cascade,
  datei_b_id uuid not null references public.dateien(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint datei_verknuepfung_unique unique (datei_a_id, datei_b_id),
  constraint datei_verknuepfung_no_self check (datei_a_id <> datei_b_id)
);

create index idx_verknuepfung_a on public.datei_verknuepfungen(datei_a_id);
create index idx_verknuepfung_b on public.datei_verknuepfungen(datei_b_id);

alter table public.datei_verknuepfungen enable row level security;

create policy "verknuepfung_select_authenticated"
  on public.datei_verknuepfungen for select
  to authenticated
  using (true);

create policy "verknuepfung_insert_authenticated"
  on public.datei_verknuepfungen for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "verknuepfung_delete_admin_dispatcher"
  on public.datei_verknuepfungen for delete
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'dispatcher')
    or auth.uid() = created_by
  );

-- Storage Bucket
insert into storage.buckets (id, name, public)
values ('dateien', 'dateien', false)
on conflict (id) do nothing;

create policy "dateien_bucket_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'dateien');

create policy "dateien_bucket_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'dateien');

create policy "dateien_bucket_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'dateien');

create policy "dateien_bucket_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dateien'
    and public.has_role(auth.uid(), 'admin')
  );
