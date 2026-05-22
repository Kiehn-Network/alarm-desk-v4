
-- Enums
CREATE TYPE public.owks_tag_typ AS ENUM ('ntag213','ntag215','ntag216','mifare_classic','mifare_ultralight','desfire','sonstige');
CREATE TYPE public.owks_bestreifung_status AS ENUM ('geplant','aktiv','erledigt','versaeumt','storniert');
CREATE TYPE public.owks_reihenfolge_modus AS ENUM ('ignorieren','warnen','strikt');
CREATE TYPE public.owks_ereignis_typ AS ENUM ('hinweis','warnung','vorfall','schaden','sonstige');

-- Objekte
CREATE TABLE public.owks_objekte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  name TEXT NOT NULL,
  kunden_id UUID NULL,
  kunden_name TEXT NULL,
  adresse TEXT NULL,
  ort TEXT NULL,
  plz TEXT NULL,
  lat DOUBLE PRECISION NULL,
  lng DOUBLE PRECISION NULL,
  notizen TEXT NULL,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owks_objekte_domain_idx ON public.owks_objekte(domain_id);

-- Rundgänge
CREATE TABLE public.owks_rundgaenge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  objekt_id UUID NULL REFERENCES public.owks_objekte(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  rundgang_nr TEXT NULL,
  beschreibung TEXT NULL,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owks_rundgaenge_domain_idx ON public.owks_rundgaenge(domain_id);
CREATE INDEX owks_rundgaenge_objekt_idx ON public.owks_rundgaenge(objekt_id);

-- Kontrollpunkte (NFC)
CREATE TABLE public.owks_kontrollpunkte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  rundgang_id UUID NOT NULL REFERENCES public.owks_rundgaenge(id) ON DELETE CASCADE,
  objekt_id UUID NULL REFERENCES public.owks_objekte(id) ON DELETE SET NULL,
  bezeichnung TEXT NOT NULL,
  raum TEXT NULL,
  reihenfolge INTEGER NOT NULL DEFAULT 0,
  nfc_uid TEXT NULL,
  nfc_tag_typ public.owks_tag_typ NOT NULL DEFAULT 'ntag213',
  lat DOUBLE PRECISION NULL,
  lng DOUBLE PRECISION NULL,
  notizen TEXT NULL,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owks_kp_domain_idx ON public.owks_kontrollpunkte(domain_id);
CREATE INDEX owks_kp_rundgang_idx ON public.owks_kontrollpunkte(rundgang_id);
CREATE UNIQUE INDEX owks_kp_nfc_unique ON public.owks_kontrollpunkte(domain_id, nfc_uid) WHERE nfc_uid IS NOT NULL;

-- Bestreifungspläne (wiederkehrend)
CREATE TABLE public.owks_bestreifungsplaene (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  rundgang_id UUID NOT NULL REFERENCES public.owks_rundgaenge(id) ON DELETE CASCADE,
  objekt_id UUID NULL REFERENCES public.owks_objekte(id) ON DELETE SET NULL,
  zeit_von TIME NOT NULL DEFAULT '00:00',
  zeit_bis TIME NOT NULL DEFAULT '23:59',
  soll_zeit_von TIME NULL,
  soll_zeit_bis TIME NULL,
  durchgaenge INTEGER NOT NULL DEFAULT 1,
  min_dauer_minuten INTEGER NULL,
  max_dauer_minuten INTEGER NULL,
  unterschreitung_unzulaessig BOOLEAN NOT NULL DEFAULT false,
  reihenfolge_modus public.owks_reihenfolge_modus NOT NULL DEFAULT 'ignorieren',
  manuell_buchen BOOLEAN NOT NULL DEFAULT false,
  wochentage SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}', -- 1=Mo .. 7=So
  intervall_wochen INTEGER NOT NULL DEFAULT 1,
  gueltig_ab DATE NOT NULL DEFAULT CURRENT_DATE,
  gueltig_bis DATE NULL,
  ferien_modus TEXT NOT NULL DEFAULT 'ignorieren',
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owks_plan_domain_idx ON public.owks_bestreifungsplaene(domain_id);
CREATE INDEX owks_plan_rundgang_idx ON public.owks_bestreifungsplaene(rundgang_id);

-- Bestreifungs-Instanzen
CREATE TABLE public.owks_bestreifungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  plan_id UUID NULL REFERENCES public.owks_bestreifungsplaene(id) ON DELETE SET NULL,
  rundgang_id UUID NOT NULL REFERENCES public.owks_rundgaenge(id) ON DELETE CASCADE,
  objekt_id UUID NULL REFERENCES public.owks_objekte(id) ON DELETE SET NULL,
  datum DATE NOT NULL,
  zeit_von TIMESTAMPTZ NOT NULL,
  zeit_bis TIMESTAMPTZ NOT NULL,
  status public.owks_bestreifung_status NOT NULL DEFAULT 'geplant',
  durchgaenge_soll INTEGER NOT NULL DEFAULT 1,
  durchgaenge_ist INTEGER NOT NULL DEFAULT 0,
  notizen TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owks_best_domain_idx ON public.owks_bestreifungen(domain_id);
CREATE INDEX owks_best_datum_idx ON public.owks_bestreifungen(domain_id, datum);
CREATE INDEX owks_best_rundgang_idx ON public.owks_bestreifungen(rundgang_id);

-- Durchgänge
CREATE TABLE public.owks_durchgaenge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  bestreifung_id UUID NOT NULL REFERENCES public.owks_bestreifungen(id) ON DELETE CASCADE,
  fahrer_id UUID NULL,
  nummer INTEGER NOT NULL DEFAULT 1,
  start_at TIMESTAMPTZ NULL,
  ende_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'offen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owks_dg_domain_idx ON public.owks_durchgaenge(domain_id);
CREATE INDEX owks_dg_best_idx ON public.owks_durchgaenge(bestreifung_id);

-- Scans
CREATE TABLE public.owks_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  durchgang_id UUID NOT NULL REFERENCES public.owks_durchgaenge(id) ON DELETE CASCADE,
  kontrollpunkt_id UUID NULL REFERENCES public.owks_kontrollpunkte(id) ON DELETE SET NULL,
  fahrer_id UUID NULL,
  nfc_uid TEXT NULL,
  gescannt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION NULL,
  lng DOUBLE PRECISION NULL,
  notiz TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owks_scan_domain_idx ON public.owks_scans(domain_id);
CREATE INDEX owks_scan_dg_idx ON public.owks_scans(durchgang_id);

-- Ereignisse
CREATE TABLE public.owks_ereignisse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  bestreifung_id UUID NULL REFERENCES public.owks_bestreifungen(id) ON DELETE CASCADE,
  durchgang_id UUID NULL REFERENCES public.owks_durchgaenge(id) ON DELETE SET NULL,
  kontrollpunkt_id UUID NULL REFERENCES public.owks_kontrollpunkte(id) ON DELETE SET NULL,
  typ public.owks_ereignis_typ NOT NULL DEFAULT 'hinweis',
  titel TEXT NOT NULL,
  beschreibung TEXT NULL,
  foto_url TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owks_ev_domain_idx ON public.owks_ereignisse(domain_id);

-- Updated-At Trigger
CREATE TRIGGER trg_owks_objekte_uat BEFORE UPDATE ON public.owks_objekte FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_owks_rundgaenge_uat BEFORE UPDATE ON public.owks_rundgaenge FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_owks_kp_uat BEFORE UPDATE ON public.owks_kontrollpunkte FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_owks_plaene_uat BEFORE UPDATE ON public.owks_bestreifungsplaene FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_owks_best_uat BEFORE UPDATE ON public.owks_bestreifungen FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_owks_dg_uat BEFORE UPDATE ON public.owks_durchgaenge FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS aktivieren
ALTER TABLE public.owks_objekte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owks_rundgaenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owks_kontrollpunkte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owks_bestreifungsplaene ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owks_bestreifungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owks_durchgaenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owks_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owks_ereignisse ENABLE ROW LEVEL SECURITY;

-- Generische Policies: select für Domäne, admin/dispatcher schreibt
-- Helfer-Makros nicht möglich; daher pro Tabelle Policies anlegen.

-- ===== owks_objekte =====
CREATE POLICY owks_objekte_select ON public.owks_objekte FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_objekte_insert ON public.owks_objekte FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))));
CREATE POLICY owks_objekte_update ON public.owks_objekte FOR UPDATE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))))
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))));
CREATE POLICY owks_objekte_delete ON public.owks_objekte FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- ===== owks_rundgaenge =====
CREATE POLICY owks_rg_select ON public.owks_rundgaenge FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_rg_insert ON public.owks_rundgaenge FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))));
CREATE POLICY owks_rg_update ON public.owks_rundgaenge FOR UPDATE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))))
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))));
CREATE POLICY owks_rg_delete ON public.owks_rundgaenge FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- ===== owks_kontrollpunkte =====
CREATE POLICY owks_kp_select ON public.owks_kontrollpunkte FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_kp_insert ON public.owks_kontrollpunkte FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))));
CREATE POLICY owks_kp_update ON public.owks_kontrollpunkte FOR UPDATE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))))
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))));
CREATE POLICY owks_kp_delete ON public.owks_kontrollpunkte FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- ===== owks_bestreifungsplaene =====
CREATE POLICY owks_bp_select ON public.owks_bestreifungsplaene FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_bp_insert ON public.owks_bestreifungsplaene FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))));
CREATE POLICY owks_bp_update ON public.owks_bestreifungsplaene FOR UPDATE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))))
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))));
CREATE POLICY owks_bp_delete ON public.owks_bestreifungsplaene FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- ===== owks_bestreifungen =====
CREATE POLICY owks_best_select ON public.owks_bestreifungen FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_best_insert ON public.owks_bestreifungen FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(),'dispatcher'))));
CREATE POLICY owks_best_update ON public.owks_bestreifungen FOR UPDATE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id())
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_best_delete ON public.owks_bestreifungen FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- ===== owks_durchgaenge =====
CREATE POLICY owks_dg_select ON public.owks_durchgaenge FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_dg_insert ON public.owks_durchgaenge FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_dg_update ON public.owks_durchgaenge FOR UPDATE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id())
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_dg_delete ON public.owks_durchgaenge FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- ===== owks_scans =====
CREATE POLICY owks_scan_select ON public.owks_scans FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_scan_insert ON public.owks_scans FOR INSERT TO authenticated
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND (fahrer_id IS NULL OR fahrer_id = auth.uid()));
CREATE POLICY owks_scan_delete ON public.owks_scans FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- ===== owks_ereignisse =====
CREATE POLICY owks_ev_select ON public.owks_ereignisse FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY owks_ev_insert ON public.owks_ereignisse FOR INSERT TO authenticated
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY owks_ev_update ON public.owks_ereignisse FOR UPDATE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR created_by = auth.uid())))
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR created_by = auth.uid())));
CREATE POLICY owks_ev_delete ON public.owks_ereignisse FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- Modul-Registry
INSERT INTO public.app_modules (key, name, beschreibung, sort_order, parent_key)
VALUES ('owks', 'OWKS', 'Objekt-Wach-Kontroll-System mit NFC-Punkten, Rundgängen und Bestreifungsplänen', 50, NULL)
ON CONFLICT DO NOTHING;
