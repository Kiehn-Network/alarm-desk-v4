
-- =============================================================
-- PART 2.1: Core multi-tenant tables
-- =============================================================

CREATE TABLE public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  license_key text NOT NULL UNIQUE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  max_users integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.domain_modules (
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain_id, module_key)
);
ALTER TABLE public.domain_modules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.superadmin_impersonation (
  superadmin_id uuid PRIMARY KEY,
  target_domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.superadmin_impersonation ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- PART 2.2: Add domain_id to existing tables (nullable first)
-- =============================================================
ALTER TABLE public.profiles               ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles             ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE;
ALTER TABLE public.einsaetze              ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE;
ALTER TABLE public.einsatz_gruende       ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE;
ALTER TABLE public.dateien                ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE;
ALTER TABLE public.datei_historie        ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE;
ALTER TABLE public.datei_verknuepfungen  ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE;
ALTER TABLE public.einsatz_historie      ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE;
ALTER TABLE public.einsatz_email_log     ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE;
ALTER TABLE public.app_modules            ADD COLUMN is_global boolean NOT NULL DEFAULT true;

-- app_settings: drop singleton id, add domain_id PK
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE public.app_settings DROP COLUMN id;
ALTER TABLE public.app_settings ADD COLUMN domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE;

-- =============================================================
-- PART 2.3: Seed default domain + backfill
-- =============================================================

INSERT INTO public.domains (slug, name) VALUES ('default', 'AlarmDesk')
  ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_domain_id uuid;
  v_first_user uuid;
BEGIN
  SELECT id INTO v_domain_id FROM public.domains WHERE slug = 'default';

  -- Backfill all data tables
  UPDATE public.profiles               SET domain_id = v_domain_id WHERE domain_id IS NULL;
  UPDATE public.user_roles             SET domain_id = v_domain_id WHERE domain_id IS NULL;
  UPDATE public.einsaetze              SET domain_id = v_domain_id WHERE domain_id IS NULL;
  UPDATE public.einsatz_gruende       SET domain_id = v_domain_id WHERE domain_id IS NULL;
  UPDATE public.dateien                SET domain_id = v_domain_id WHERE domain_id IS NULL;
  UPDATE public.datei_historie        SET domain_id = v_domain_id WHERE domain_id IS NULL;
  UPDATE public.datei_verknuepfungen  SET domain_id = v_domain_id WHERE domain_id IS NULL;
  UPDATE public.einsatz_historie      SET domain_id = v_domain_id WHERE domain_id IS NULL;
  UPDATE public.einsatz_email_log     SET domain_id = v_domain_id WHERE domain_id IS NULL;

  -- Pick the oldest user → SuperAdmin
  SELECT id INTO v_first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF v_first_user IS NOT NULL THEN
    -- remove old roles for that user
    DELETE FROM public.user_roles WHERE user_id = v_first_user;
    INSERT INTO public.user_roles (user_id, role, domain_id) VALUES (v_first_user, 'superadmin'::app_role, NULL);
    -- superadmins should not belong to a domain
    UPDATE public.profiles SET domain_id = NULL WHERE id = v_first_user;
  END IF;

  -- Default license
  INSERT INTO public.licenses (domain_id, license_key, valid_until, status, notes)
  VALUES (v_domain_id,
          'DEFAULT-' || upper(encode(gen_random_bytes(12), 'hex')),
          now() + interval '10 years',
          'active',
          'Auto-generated default license')
  ON CONFLICT DO NOTHING;

  -- Enable all existing app_modules for default domain
  INSERT INTO public.domain_modules (domain_id, module_key, enabled)
  SELECT v_domain_id, key, enabled FROM public.app_modules
  ON CONFLICT DO NOTHING;

  -- Migrate app_settings: there was one row; assign to default domain
  IF EXISTS (SELECT 1 FROM public.app_settings) THEN
    UPDATE public.app_settings SET domain_id = v_domain_id WHERE domain_id IS NULL;
  ELSE
    INSERT INTO public.app_settings (domain_id, firmenname) VALUES (v_domain_id, 'AlarmDesk');
  END IF;
END $$;

-- Enforce NOT NULL where possible
ALTER TABLE public.einsaetze              ALTER COLUMN domain_id SET NOT NULL;
ALTER TABLE public.einsatz_gruende       ALTER COLUMN domain_id SET NOT NULL;
ALTER TABLE public.dateien                ALTER COLUMN domain_id SET NOT NULL;
ALTER TABLE public.datei_historie        ALTER COLUMN domain_id SET NOT NULL;
ALTER TABLE public.datei_verknuepfungen  ALTER COLUMN domain_id SET NOT NULL;
ALTER TABLE public.einsatz_historie      ALTER COLUMN domain_id SET NOT NULL;
ALTER TABLE public.einsatz_email_log     ALTER COLUMN domain_id SET NOT NULL;
ALTER TABLE public.app_settings           ALTER COLUMN domain_id SET NOT NULL;
ALTER TABLE public.app_settings           ADD PRIMARY KEY (domain_id);

-- =============================================================
-- PART 2.4: Security helper functions
-- =============================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin'::app_role) $$;

CREATE OR REPLACE FUNCTION public.current_user_domain_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT domain_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.current_effective_domain_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT target_domain_id FROM public.superadmin_impersonation WHERE superadmin_id = auth.uid()),
    (SELECT domain_id FROM public.profiles WHERE id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_domain_admin(_domain_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
      AND domain_id = _domain_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_active_license(_domain_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.licenses
    WHERE domain_id = _domain_id
      AND status = 'active'
      AND (valid_until IS NULL OR valid_until > now())
  )
$$;

-- Trigger updates
CREATE TRIGGER trg_domains_updated_at        BEFORE UPDATE ON public.domains        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_licenses_updated_at       BEFORE UPDATE ON public.licenses       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_domain_modules_updated_at BEFORE UPDATE ON public.domain_modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- PART 2.5: Updated handle_new_user (no auto-admin, no role)
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, domain_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NULL);

  -- If no user exists yet → make first user superadmin
  IF (SELECT count(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role, domain_id) VALUES (NEW.id, 'superadmin'::app_role, NULL);
  END IF;
  -- Otherwise: no role assigned. SuperAdmin must assign domain + role.
  RETURN NEW;
END;
$$;

-- =============================================================
-- PART 3: RLS policies
-- =============================================================

-- ---- domains ----
DROP POLICY IF EXISTS domains_select ON public.domains;
DROP POLICY IF EXISTS domains_all_super ON public.domains;
CREATE POLICY domains_select ON public.domains FOR SELECT TO authenticated
  USING (public.is_superadmin() OR id = public.current_effective_domain_id());
CREATE POLICY domains_all_super ON public.domains FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ---- licenses ----
CREATE POLICY licenses_select ON public.licenses FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY licenses_all_super ON public.licenses FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ---- domain_modules ----
CREATE POLICY dm_select ON public.domain_modules FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY dm_all_super ON public.domain_modules FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ---- superadmin_impersonation ----
CREATE POLICY imp_own ON public.superadmin_impersonation FOR ALL TO authenticated
  USING (superadmin_id = auth.uid() AND public.is_superadmin())
  WITH CHECK (superadmin_id = auth.uid() AND public.is_superadmin());

-- ---- profiles: replace policies ----
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR id = auth.uid()
    OR (domain_id IS NOT NULL AND domain_id = public.current_effective_domain_id())
  );
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_super_all ON public.profiles FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY profiles_admin_update_in_domain ON public.profiles FOR UPDATE TO authenticated
  USING (domain_id IS NOT NULL AND public.is_domain_admin(domain_id))
  WITH CHECK (domain_id IS NOT NULL AND public.is_domain_admin(domain_id));

-- ---- user_roles: replace policies ----
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_superadmin()
    OR (domain_id IS NOT NULL AND public.is_domain_admin(domain_id))
  );
CREATE POLICY user_roles_super_all ON public.user_roles FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY user_roles_admin_manage ON public.user_roles FOR ALL TO authenticated
  USING (domain_id IS NOT NULL AND public.is_domain_admin(domain_id) AND role <> 'superadmin'::app_role)
  WITH CHECK (domain_id IS NOT NULL AND public.is_domain_admin(domain_id) AND role <> 'superadmin'::app_role);

-- ---- einsaetze ----
DROP POLICY IF EXISTS einsaetze_select_auth ON public.einsaetze;
DROP POLICY IF EXISTS einsaetze_insert_disp_admin ON public.einsaetze;
DROP POLICY IF EXISTS einsaetze_update_disp_admin ON public.einsaetze;
DROP POLICY IF EXISTS einsaetze_update_fahrer_assigned ON public.einsaetze;
DROP POLICY IF EXISTS einsaetze_delete_admin ON public.einsaetze;
CREATE POLICY einsaetze_select ON public.einsaetze FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY einsaetze_insert ON public.einsaetze FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_superadmin() OR domain_id = public.current_effective_domain_id())
    AND auth.uid() = created_by
  );
CREATE POLICY einsaetze_update ON public.einsaetze FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id())
  WITH CHECK (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY einsaetze_delete ON public.einsaetze FOR DELETE TO authenticated
  USING (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)));

-- ---- einsatz_gruende ----
DROP POLICY IF EXISTS gruende_select_auth ON public.einsatz_gruende;
DROP POLICY IF EXISTS gruende_insert_disp_admin ON public.einsatz_gruende;
DROP POLICY IF EXISTS gruende_update_disp_admin ON public.einsatz_gruende;
DROP POLICY IF EXISTS gruende_delete_admin ON public.einsatz_gruende;
CREATE POLICY gruende_select ON public.einsatz_gruende FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY gruende_insert ON public.einsatz_gruende FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin() OR domain_id = public.current_effective_domain_id()) AND auth.uid() = created_by);
CREATE POLICY gruende_update ON public.einsatz_gruende FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)))
  WITH CHECK (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)));
CREATE POLICY gruende_delete ON public.einsatz_gruende FOR DELETE TO authenticated
  USING (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)));

-- ---- dateien ----
DROP POLICY IF EXISTS dateien_select_authenticated ON public.dateien;
DROP POLICY IF EXISTS dateien_insert_authenticated ON public.dateien;
DROP POLICY IF EXISTS dateien_update_own_or_admin ON public.dateien;
DROP POLICY IF EXISTS dateien_delete_admin ON public.dateien;
CREATE POLICY dateien_select ON public.dateien FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY dateien_insert ON public.dateien FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin() OR domain_id = public.current_effective_domain_id()) AND auth.uid() = uploaded_by);
CREATE POLICY dateien_update ON public.dateien FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id())
  WITH CHECK (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY dateien_delete ON public.dateien FOR DELETE TO authenticated
  USING (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)));

-- ---- datei_historie ----
DROP POLICY IF EXISTS historie_select_authenticated ON public.datei_historie;
DROP POLICY IF EXISTS historie_insert_authenticated ON public.datei_historie;
CREATE POLICY dh_select ON public.datei_historie FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY dh_insert ON public.datei_historie FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin() OR domain_id = public.current_effective_domain_id()) AND auth.uid() = changed_by);

-- ---- datei_verknuepfungen ----
DROP POLICY IF EXISTS verknuepfung_select_authenticated ON public.datei_verknuepfungen;
DROP POLICY IF EXISTS verknuepfung_insert_authenticated ON public.datei_verknuepfungen;
DROP POLICY IF EXISTS verknuepfung_delete_admin_dispatcher ON public.datei_verknuepfungen;
CREATE POLICY dv_select ON public.datei_verknuepfungen FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY dv_insert ON public.datei_verknuepfungen FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin() OR domain_id = public.current_effective_domain_id()) AND auth.uid() = created_by);
CREATE POLICY dv_delete ON public.datei_verknuepfungen FOR DELETE TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());

-- ---- einsatz_historie ----
DROP POLICY IF EXISTS einsatz_historie_select_auth ON public.einsatz_historie;
DROP POLICY IF EXISTS einsatz_historie_insert_auth ON public.einsatz_historie;
CREATE POLICY eh_select ON public.einsatz_historie FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY eh_insert ON public.einsatz_historie FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin() OR domain_id = public.current_effective_domain_id()) AND auth.uid() = changed_by);

-- ---- einsatz_email_log ----
DROP POLICY IF EXISTS email_log_select_auth ON public.einsatz_email_log;
DROP POLICY IF EXISTS email_log_insert_auth ON public.einsatz_email_log;
CREATE POLICY eel_select ON public.einsatz_email_log FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY eel_insert ON public.einsatz_email_log FOR INSERT TO authenticated
  WITH CHECK ((public.is_superadmin() OR domain_id = public.current_effective_domain_id()) AND auth.uid() = sent_by);

-- ---- app_settings ----
DROP POLICY IF EXISTS settings_select_auth ON public.app_settings;
DROP POLICY IF EXISTS settings_update_admin ON public.app_settings;
DROP POLICY IF EXISTS settings_insert_admin ON public.app_settings;
CREATE POLICY settings_select ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());
CREATE POLICY settings_update ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)))
  WITH CHECK (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)));
CREATE POLICY settings_insert ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id)));

-- ---- app_modules: global catalog, admin write only by superadmin, everyone can read ----
DROP POLICY IF EXISTS modules_select_auth ON public.app_modules;
DROP POLICY IF EXISTS modules_insert_admin ON public.app_modules;
DROP POLICY IF EXISTS modules_update_admin ON public.app_modules;
DROP POLICY IF EXISTS modules_delete_admin ON public.app_modules;
CREATE POLICY modules_select ON public.app_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY modules_super_all ON public.app_modules FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_einsaetze_domain      ON public.einsaetze (domain_id);
CREATE INDEX IF NOT EXISTS idx_dateien_domain        ON public.dateien (domain_id);
CREATE INDEX IF NOT EXISTS idx_einsatz_gruende_dom   ON public.einsatz_gruende (domain_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_domain     ON public.user_roles (domain_id);
CREATE INDEX IF NOT EXISTS idx_profiles_domain       ON public.profiles (domain_id);
CREATE INDEX IF NOT EXISTS idx_licenses_domain       ON public.licenses (domain_id);
