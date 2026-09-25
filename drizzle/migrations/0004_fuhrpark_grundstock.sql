CREATE TABLE public.fuhrpark_fahrzeuge (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete cascade not null,
  kennzeichen text not null,
  bezeichnung text,
  art text not null default 'Dienstfahrzeug',
  marke text,
  modell text,
  baujahr integer,
  vin text,
  km_stand integer,
  tankart text not null default 'benzin',
  status text not null default 'aktiv',
  hauptfahrer text,
  notizen text,
  erstellt_von uuid references public.profiles(id) on delete set null,
  erstellt_von_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.fuhrpark_termine (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete cascade not null,
  fahrzeug_id uuid references public.fuhrpark_fahrzeuge(id) on delete cascade not null,
  art text not null default 'inspektion',
  faellig_am date,
  erledigt_am timestamptz,
  km_stand integer,
  kosten numeric(10,2),
  beschreibung text,
  erstellt_von uuid references public.profiles(id) on delete set null,
  erstellt_von_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.fuhrpark_schaeden (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete cascade not null,
  fahrzeug_id uuid references public.fuhrpark_fahrzeuge(id) on delete cascade not null,
  gemeldet_am date not null default CURRENT_DATE,
  beschreibung text not null,
  schwere text not null default 'leicht',
  status text not null default 'offen',
  kosten numeric(10,2),
  gemeldet_von uuid references public.profiles(id) on delete set null,
  gemeldet_von_name text,
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.fuhrpark_km_log (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete cascade not null,
  fahrzeug_id uuid references public.fuhrpark_fahrzeuge(id) on delete cascade not null,
  km_stand integer not null,
  notiert_am date not null default CURRENT_DATE,
  notiert_von uuid references public.profiles(id) on delete set null,
  notiert_von_name text,
  notizen text,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuhrpark_fahrzeuge TO authenticated;
GRANT ALL ON public.fuhrpark_fahrzeuge TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuhrpark_termine TO authenticated;
GRANT ALL ON public.fuhrpark_termine TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuhrpark_schaeden TO authenticated;
GRANT ALL ON public.fuhrpark_schaeden TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuhrpark_km_log TO authenticated;
GRANT ALL ON public.fuhrpark_km_log TO service_role;

ALTER TABLE public.fuhrpark_fahrzeuge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuhrpark_termine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuhrpark_schaeden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuhrpark_km_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fuhrpark: Lesen in eigener Domain" ON public.fuhrpark_fahrzeuge
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark: Anlegen in eigener Domain" ON public.fuhrpark_fahrzeuge
  FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark: Aendern in eigener Domain" ON public.fuhrpark_fahrzeuge
  FOR UPDATE TO authenticated
  USING (domain_id = public.current_effective_domain_id())
  WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark: Loeschen nur Domain-Admin" ON public.fuhrpark_fahrzeuge
  FOR DELETE TO authenticated
  USING (public.is_domain_admin(domain_id));

CREATE POLICY "Fuhrpark-Termine: Lesen in eigener Domain" ON public.fuhrpark_termine
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark-Termine: Anlegen in eigener Domain" ON public.fuhrpark_termine
  FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark-Termine: Aendern in eigener Domain" ON public.fuhrpark_termine
  FOR UPDATE TO authenticated
  USING (domain_id = public.current_effective_domain_id())
  WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark-Termine: Loeschen nur Domain-Admin" ON public.fuhrpark_termine
  FOR DELETE TO authenticated
  USING (public.is_domain_admin(domain_id));

CREATE POLICY "Fuhrpark-Schaeden: Lesen in eigener Domain" ON public.fuhrpark_schaeden
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark-Schaeden: Anlegen in eigener Domain" ON public.fuhrpark_schaeden
  FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark-Schaeden: Aendern in eigener Domain" ON public.fuhrpark_schaeden
  FOR UPDATE TO authenticated
  USING (domain_id = public.current_effective_domain_id())
  WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark-Schaeden: Loeschen nur Domain-Admin" ON public.fuhrpark_schaeden
  FOR DELETE TO authenticated
  USING (public.is_domain_admin(domain_id));

CREATE POLICY "Fuhrpark-KM-Log: Lesen in eigener Domain" ON public.fuhrpark_km_log
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark-KM-Log: Anlegen in eigener Domain" ON public.fuhrpark_km_log
  FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark-KM-Log: Aendern in eigener Domain" ON public.fuhrpark_km_log
  FOR UPDATE TO authenticated
  USING (domain_id = public.current_effective_domain_id())
  WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Fuhrpark-KM-Log: Loeschen nur Domain-Admin" ON public.fuhrpark_km_log
  FOR DELETE TO authenticated
  USING (public.is_domain_admin(domain_id));

CREATE INDEX idx_fuhrpark_fahrzeuge_domain ON public.fuhrpark_fahrzeuge(domain_id);
CREATE INDEX idx_fuhrpark_termine_fahrzeug ON public.fuhrpark_termine(fahrzeug_id);
CREATE INDEX idx_fuhrpark_termine_domain ON public.fuhrpark_termine(domain_id);
CREATE INDEX idx_fuhrpark_schaeden_fahrzeug ON public.fuhrpark_schaeden(fahrzeug_id);
CREATE INDEX idx_fuhrpark_schaeden_domain ON public.fuhrpark_schaeden(domain_id);
CREATE INDEX idx_fuhrpark_km_log_fahrzeug ON public.fuhrpark_km_log(fahrzeug_id);

CREATE TRIGGER set_updated_at_fuhrpark_fahrzeuge BEFORE UPDATE ON public.fuhrpark_fahrzeuge
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_fuhrpark_termine BEFORE UPDATE ON public.fuhrpark_termine
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_fuhrpark_schaeden BEFORE UPDATE ON public.fuhrpark_schaeden
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();