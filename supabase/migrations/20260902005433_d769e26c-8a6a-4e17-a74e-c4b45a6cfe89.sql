CREATE TABLE public.schluessel_bestand (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  key_number text NOT NULL,
  bezeichnung text,
  kunden_name text,
  address text,
  objekt text,
  schrank text,
  fach text,
  anzahl_soll integer NOT NULL DEFAULT 1,
  zustand text NOT NULL DEFAULT 'ok',
  label_code text,
  notiz text,
  aktiv boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX schluessel_bestand_domain_key_uidx ON public.schluessel_bestand (domain_id, lower(key_number));
CREATE INDEX schluessel_bestand_domain_idx ON public.schluessel_bestand (domain_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schluessel_bestand TO authenticated;
GRANT ALL ON public.schluessel_bestand TO service_role;
ALTER TABLE public.schluessel_bestand ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bestand_select" ON public.schluessel_bestand FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY "bestand_insert" ON public.schluessel_bestand FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR (domain_id = public.current_effective_domain_id()));
CREATE POLICY "bestand_update" ON public.schluessel_bestand FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id())
  WITH CHECK (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY "bestand_delete" ON public.schluessel_bestand FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.is_domain_admin(domain_id));

CREATE TRIGGER trg_schluessel_bestand_updated BEFORE UPDATE ON public.schluessel_bestand
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.schluessel_inventuren (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  titel text NOT NULL,
  status text NOT NULL DEFAULT 'offen',
  notiz text,
  gestartet_von uuid,
  gestartet_at timestamptz NOT NULL DEFAULT now(),
  abgeschlossen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX schluessel_inventuren_domain_idx ON public.schluessel_inventuren (domain_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schluessel_inventuren TO authenticated;
GRANT ALL ON public.schluessel_inventuren TO service_role;
ALTER TABLE public.schluessel_inventuren ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventur_select" ON public.schluessel_inventuren FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY "inventur_insert" ON public.schluessel_inventuren FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY "inventur_update" ON public.schluessel_inventuren FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id())
  WITH CHECK (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY "inventur_delete" ON public.schluessel_inventuren FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.is_domain_admin(domain_id));

CREATE TRIGGER trg_schluessel_inventuren_updated BEFORE UPDATE ON public.schluessel_inventuren
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.schluessel_inventur_positionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  inventur_id uuid NOT NULL REFERENCES public.schluessel_inventuren(id) ON DELETE CASCADE,
  bestand_id uuid REFERENCES public.schluessel_bestand(id) ON DELETE SET NULL,
  key_number text NOT NULL,
  anzahl_soll integer NOT NULL DEFAULT 1,
  anzahl_ist integer,
  ergebnis text NOT NULL DEFAULT 'offen',
  notiz text,
  geprueft_von uuid,
  geprueft_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX schluessel_inv_pos_inventur_idx ON public.schluessel_inventur_positionen (inventur_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schluessel_inventur_positionen TO authenticated;
GRANT ALL ON public.schluessel_inventur_positionen TO service_role;
ALTER TABLE public.schluessel_inventur_positionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_pos_select" ON public.schluessel_inventur_positionen FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY "inv_pos_insert" ON public.schluessel_inventur_positionen FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY "inv_pos_update" ON public.schluessel_inventur_positionen FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id())
  WITH CHECK (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY "inv_pos_delete" ON public.schluessel_inventur_positionen FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.is_domain_admin(domain_id));

CREATE TRIGGER trg_schluessel_inv_pos_updated BEFORE UPDATE ON public.schluessel_inventur_positionen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();