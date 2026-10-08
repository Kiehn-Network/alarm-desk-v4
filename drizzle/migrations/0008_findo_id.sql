CREATE TABLE public.findo_anhaenger (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete cascade not null,
  fid text not null,
  besitzer_name text not null,
  besitzer_telefon text,
  besitzer_email text,
  besitzer_adresse text,
  paket text not null default 'basis',
  ersatz_lagerort text,
  status text not null default 'aktiv',
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE UNIQUE INDEX findo_anhaenger_fid_idx ON public.findo_anhaenger(upper(replace(fid,' ','')));

CREATE TABLE public.findo_fundmeldungen (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete cascade not null,
  anhaenger_id uuid references public.findo_anhaenger(id) on delete cascade not null,
  weg text not null default 'online',
  finder_name text,
  finder_kontakt text,
  fundort text,
  nachricht text,
  status text not null default 'gemeldet',
  bearbeitet_von_name text,
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.findo_anhaenger TO authenticated;
GRANT ALL ON public.findo_anhaenger TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findo_fundmeldungen TO authenticated;
GRANT ALL ON public.findo_fundmeldungen TO service_role;

ALTER TABLE public.findo_anhaenger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findo_fundmeldungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Findo: Lesen" ON public.findo_anhaenger FOR SELECT TO authenticated USING (domain_id = public.current_effective_domain_id());
CREATE POLICY "Findo: Anlegen" ON public.findo_anhaenger FOR INSERT TO authenticated WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Findo: Aendern" ON public.findo_anhaenger FOR UPDATE TO authenticated USING (domain_id = public.current_effective_domain_id()) WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Findo: Loeschen Admin" ON public.findo_anhaenger FOR DELETE TO authenticated USING (public.is_domain_admin(domain_id));

CREATE POLICY "Findo-Fund: Lesen" ON public.findo_fundmeldungen FOR SELECT TO authenticated USING (domain_id = public.current_effective_domain_id());
CREATE POLICY "Findo-Fund: Anlegen" ON public.findo_fundmeldungen FOR INSERT TO authenticated WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Findo-Fund: Aendern" ON public.findo_fundmeldungen FOR UPDATE TO authenticated USING (domain_id = public.current_effective_domain_id()) WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Findo-Fund: Loeschen Admin" ON public.findo_fundmeldungen FOR DELETE TO authenticated USING (public.is_domain_admin(domain_id));

CREATE INDEX idx_findo_anhaenger_domain ON public.findo_anhaenger(domain_id);
CREATE INDEX idx_findo_fund_domain ON public.findo_fundmeldungen(domain_id);
CREATE INDEX idx_findo_fund_anh ON public.findo_fundmeldungen(anhaenger_id);