-- app_settings (single row)
create table public.app_settings (
  id boolean primary key default true check (id = true),
  firmenname text not null default 'AlarmDesk',
  logo_url text,
  dashboard_hinweis text,
  wartung_aktiv boolean not null default false,
  wartung_nachricht text,
  wartung_farbe text not null default 'info',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.app_settings enable row level security;

create policy "settings_select_auth" on public.app_settings
  for select to authenticated using (true);

create policy "settings_update_admin" on public.app_settings
  for update to authenticated using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "settings_insert_admin" on public.app_settings
  for insert to authenticated with check (has_role(auth.uid(), 'admin'));

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

insert into public.app_settings (id) values (true) on conflict do nothing;

-- app_modules
create table public.app_modules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  beschreibung text,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_modules enable row level security;

create policy "modules_select_auth" on public.app_modules
  for select to authenticated using (true);

create policy "modules_insert_admin" on public.app_modules
  for insert to authenticated with check (has_role(auth.uid(), 'admin'));

create policy "modules_update_admin" on public.app_modules
  for update to authenticated using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "modules_delete_admin" on public.app_modules
  for delete to authenticated using (has_role(auth.uid(), 'admin'));

create trigger app_modules_set_updated_at
before update on public.app_modules
for each row execute function public.set_updated_at();

insert into public.app_modules (key, name, sort_order) values
  ('malteser', 'Malteser Module', 10),
  ('johanniter', 'Johanniter Module', 20),
  ('lgwa', 'LGWa Module', 30),
  ('valora', 'Valora & Intervention', 40),
  ('aufschaltungen', 'Aufschaltungs Module', 50),
  ('notdienst', 'Notdienst Module', 60),
  ('reviererdienst', 'Reviererdienst', 70)
on conflict (key) do nothing;

-- logos bucket
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and has_role(auth.uid(), 'admin'));

create policy "logos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and has_role(auth.uid(), 'admin'));

create policy "logos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and has_role(auth.uid(), 'admin'));