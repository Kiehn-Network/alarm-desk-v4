CREATE TABLE public.kleidung_artikel (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete cascade not null,
  name text not null,
  kategorie text not null default 'sonstiges',
  groessen text,
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.kleidung_ausgaben (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete cascade not null,
  artikel_id uuid references public.kleidung_artikel(id) on delete cascade not null,
  mitarbeiter_id uuid references public.profiles(id) on delete cascade not null,
  groesse text,
  zustand text not null default 'neu',
  ausgegeben_am date not null default (now() at time zone 'utc')::date,
  rueckgabe_faellig date,
  zurueckgegeben_am date,
  rueckgabe_zustand text,
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kleidung_artikel TO authenticated;
GRANT ALL ON public.kleidung_artikel TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kleidung_ausgaben TO authenticated;
GRANT ALL ON public.kleidung_ausgaben TO service_role;

ALTER TABLE public.kleidung_artikel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kleidung_ausgaben ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kleidung: Lesen" ON public.kleidung_artikel FOR SELECT TO authenticated USING (domain_id = public.current_effective_domain_id());
CREATE POLICY "Kleidung: Anlegen" ON public.kleidung_artikel FOR INSERT TO authenticated WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Kleidung: Aendern" ON public.kleidung_artikel FOR UPDATE TO authenticated USING (domain_id = public.current_effective_domain_id()) WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Kleidung: Loeschen Admin" ON public.kleidung_artikel FOR DELETE TO authenticated USING (public.is_domain_admin(domain_id));

CREATE POLICY "Kleidung-Ausgabe: Lesen" ON public.kleidung_ausgaben FOR SELECT TO authenticated USING (domain_id = public.current_effective_domain_id());
CREATE POLICY "Kleidung-Ausgabe: Anlegen" ON public.kleidung_ausgaben FOR INSERT TO authenticated WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Kleidung-Ausgabe: Aendern" ON public.kleidung_ausgaben FOR UPDATE TO authenticated USING (domain_id = public.current_effective_domain_id()) WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Kleidung-Ausgabe: Loeschen Admin" ON public.kleidung_ausgaben FOR DELETE TO authenticated USING (public.is_domain_admin(domain_id));

CREATE INDEX idx_kleidung_artikel_domain ON public.kleidung_artikel(domain_id);
CREATE INDEX idx_kleidung_ausgaben_domain ON public.kleidung_ausgaben(domain_id);
CREATE INDEX idx_kleidung_ausgaben_artikel ON public.kleidung_ausgaben(artikel_id);
CREATE INDEX idx_kleidung_ausgaben_mitarbeiter ON public.kleidung_ausgaben(mitarbeiter_id);