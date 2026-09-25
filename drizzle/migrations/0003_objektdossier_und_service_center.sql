-- ============ OBJEKTDOSSIER ============

CREATE TABLE IF NOT EXISTS public.objekt_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  kunden_name text NOT NULL,
  key_number text,
  teilnehmer_id text,
  anlagen_nr text,
  address text,
  anfahrt text,
  parken text,
  schluessel text,
  alarm_plan text,
  gefahren text,
  technik text,
  oeffnungszeiten text,
  notiz text,
  fahrer_sichtbar boolean NOT NULL DEFAULT true,
  erstellt_von uuid,
  erstellt_von_name text,
  aktualisiert_von uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.objekt_dossiers TO authenticated;
GRANT ALL ON public.objekt_dossiers TO service_role;

ALTER TABLE public.objekt_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objekt_dossiers_select" ON public.objekt_dossiers
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id());

CREATE POLICY "objekt_dossiers_insert" ON public.objekt_dossiers
  FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id());

CREATE POLICY "objekt_dossiers_update" ON public.objekt_dossiers
  FOR UPDATE TO authenticated
  USING (domain_id = public.current_effective_domain_id())
  WITH CHECK (domain_id = public.current_effective_domain_id());

CREATE POLICY "objekt_dossiers_delete" ON public.objekt_dossiers
  FOR DELETE TO authenticated
  USING (domain_id = public.current_effective_domain_id()
    AND public.is_domain_admin(domain_id));

CREATE INDEX IF NOT EXISTS objekt_dossiers_domain_idx ON public.objekt_dossiers (domain_id);
CREATE INDEX IF NOT EXISTS objekt_dossiers_key_idx ON public.objekt_dossiers (domain_id, key_number);
CREATE INDEX IF NOT EXISTS objekt_dossiers_name_idx ON public.objekt_dossiers (domain_id, kunden_name);

DROP TRIGGER IF EXISTS objekt_dossiers_updated ON public.objekt_dossiers;
CREATE TRIGGER objekt_dossiers_updated BEFORE UPDATE ON public.objekt_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.objekt_kontakte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  dossier_id uuid NOT NULL REFERENCES public.objekt_dossiers(id) ON DELETE CASCADE,
  name text NOT NULL,
  rolle text,
  telefon text NOT NULL,
  prioritaet integer NOT NULL DEFAULT 1,
  aktiv boolean NOT NULL DEFAULT true,
  notiz text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.objekt_kontakte TO authenticated;
GRANT ALL ON public.objekt_kontakte TO service_role;

ALTER TABLE public.objekt_kontakte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objekt_kontakte_select" ON public.objekt_kontakte
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id());

CREATE POLICY "objekt_kontakte_insert" ON public.objekt_kontakte
  FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id());

CREATE POLICY "objekt_kontakte_update" ON public.objekt_kontakte
  FOR UPDATE TO authenticated
  USING (domain_id = public.current_effective_domain_id())
  WITH CHECK (domain_id = public.current_effective_domain_id());

CREATE POLICY "objekt_kontakte_delete" ON public.objekt_kontakte
  FOR DELETE TO authenticated
  USING (domain_id = public.current_effective_domain_id());

CREATE INDEX IF NOT EXISTS objekt_kontakte_dossier_idx ON public.objekt_kontakte (dossier_id);

-- ============ SERVICE CENTER ============

CREATE TABLE IF NOT EXISTS public.service_auftraege (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  nummer bigint NOT NULL,
  typ text NOT NULL DEFAULT 'anfrage',
  betreff text NOT NULL,
  beschreibung text,
  kunden_name text,
  key_number text,
  teilnehmer_id text,
  address text,
  status text NOT NULL DEFAULT 'offen',
  prioritaet text NOT NULL DEFAULT 'normal',
  faellig_am date,
  zugewiesen_an uuid,
  zugewiesen_name text,
  einsatz_id uuid REFERENCES public.einsaetze(id) ON DELETE SET NULL,
  erstellt_von uuid,
  erstellt_von_name text,
  erledigt_am timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, nummer)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_auftraege TO authenticated;
GRANT ALL ON public.service_auftraege TO service_role;

ALTER TABLE public.service_auftraege ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_auftraege_select" ON public.service_auftraege
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id());

CREATE POLICY "service_auftraege_insert" ON public.service_auftraege
  FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id());

CREATE POLICY "service_auftraege_update" ON public.service_auftraege
  FOR UPDATE TO authenticated
  USING (domain_id = public.current_effective_domain_id())
  WITH CHECK (domain_id = public.current_effective_domain_id());

CREATE POLICY "service_auftraege_delete" ON public.service_auftraege
  FOR DELETE TO authenticated
  USING (domain_id = public.current_effective_domain_id()
    AND public.is_domain_admin(domain_id));

CREATE INDEX IF NOT EXISTS service_auftraege_domain_idx ON public.service_auftraege (domain_id, status);
CREATE INDEX IF NOT EXISTS service_auftraege_faellig_idx ON public.service_auftraege (domain_id, faellig_am);

DROP TRIGGER IF EXISTS service_auftraege_updated ON public.service_auftraege;
CREATE TRIGGER service_auftraege_updated BEFORE UPDATE ON public.service_auftraege
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.next_service_nr(_domain_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(max(nummer), 0) + 1 FROM public.service_auftraege WHERE domain_id = _domain_id;
$$;

CREATE TABLE IF NOT EXISTS public.service_notizen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  auftrag_id uuid NOT NULL REFERENCES public.service_auftraege(id) ON DELETE CASCADE,
  text text NOT NULL,
  erstellt_von uuid,
  erstellt_von_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_notizen TO authenticated;
GRANT ALL ON public.service_notizen TO service_role;

ALTER TABLE public.service_notizen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_notizen_select" ON public.service_notizen
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id());

CREATE POLICY "service_notizen_insert" ON public.service_notizen
  FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id());

CREATE POLICY "service_notizen_delete" ON public.service_notizen
  FOR DELETE TO authenticated
  USING (domain_id = public.current_effective_domain_id());

CREATE INDEX IF NOT EXISTS service_notizen_auftrag_idx ON public.service_notizen (auftrag_id);