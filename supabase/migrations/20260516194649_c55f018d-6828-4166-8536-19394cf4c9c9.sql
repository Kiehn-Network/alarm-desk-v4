-- Enums
create type public.einsatz_status as enum ('entwurf','wartet_freigabe','freigegeben','abgelehnt','in_bearbeitung','abgeschlossen');
create type public.einsatz_prioritaet as enum ('niedrig','normal','hoch','kritisch');

-- Einsatzgruende
create table public.einsatz_gruende (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table public.einsatz_gruende enable row level security;

create policy "gruende_select_auth" on public.einsatz_gruende for select to authenticated using (true);
create policy "gruende_insert_disp_admin" on public.einsatz_gruende for insert to authenticated
  with check ((has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'dispatcher'::app_role)) and auth.uid() = created_by);
create policy "gruende_update_disp_admin" on public.einsatz_gruende for update to authenticated
  using (has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'dispatcher'::app_role));
create policy "gruende_delete_admin" on public.einsatz_gruende for delete to authenticated
  using (has_role(auth.uid(),'admin'::app_role));

insert into public.einsatz_gruende (name) values
  ('Einbruchalarm'),('Brandmeldung'),('Wasseralarm'),('Schlüsseldienst'),
  ('Kontrollgang'),('Technische Störung'),('Notdienst'),('Sonstiges');

-- Einsaetze
create table public.einsaetze (
  id uuid primary key default gen_random_uuid(),
  einsatzgrund text not null,
  einsatzgrund_id uuid references public.einsatz_gruende(id) on delete set null,
  kunden_name text,
  address text,
  key_number text,
  anlagen_nr text,
  teilnehmer_id text,
  prioritaet public.einsatz_prioritaet not null default 'normal',
  beschreibung text,
  geplant_am timestamptz,
  status public.einsatz_status not null default 'wartet_freigabe',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  ablehnung_grund text,
  assigned_to uuid,
  assigned_at timestamptz,
  abgeschlossen_am timestamptz
);
alter table public.einsaetze enable row level security;

create index einsaetze_status_idx on public.einsaetze(status);
create index einsaetze_assigned_idx on public.einsaetze(assigned_to);
create index einsaetze_created_idx on public.einsaetze(created_at desc);

create trigger einsaetze_set_updated_at
  before update on public.einsaetze
  for each row execute function public.set_updated_at();

create policy "einsaetze_select_auth" on public.einsaetze for select to authenticated using (true);

create policy "einsaetze_insert_disp_admin" on public.einsaetze for insert to authenticated
  with check ((has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'dispatcher'::app_role)) and auth.uid() = created_by);

create policy "einsaetze_update_disp_admin" on public.einsaetze for update to authenticated
  using (has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'dispatcher'::app_role));

-- Fahrer darf eigene zugewiesene Einsätze updaten (Status)
create policy "einsaetze_update_fahrer_assigned" on public.einsaetze for update to authenticated
  using (has_role(auth.uid(),'fahrer'::app_role) and assigned_to = auth.uid());

create policy "einsaetze_delete_admin" on public.einsaetze for delete to authenticated
  using (has_role(auth.uid(),'admin'::app_role));

-- Historie
create table public.einsatz_historie (
  id uuid primary key default gen_random_uuid(),
  einsatz_id uuid not null references public.einsaetze(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
alter table public.einsatz_historie enable row level security;

create index einsatz_historie_einsatz_idx on public.einsatz_historie(einsatz_id, changed_at desc);

create policy "einsatz_historie_select_auth" on public.einsatz_historie for select to authenticated using (true);
create policy "einsatz_historie_insert_auth" on public.einsatz_historie for insert to authenticated
  with check (auth.uid() = changed_by);