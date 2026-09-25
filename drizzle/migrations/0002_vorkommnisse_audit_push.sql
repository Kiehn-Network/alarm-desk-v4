-- Vorkommnis-Buch
CREATE TABLE public.vorkommnisse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  einsatz_id uuid REFERENCES public.einsaetze(id) ON DELETE SET NULL,
  datei_id uuid REFERENCES public.dateien(id) ON DELETE SET NULL,
  titel text NOT NULL,
  beschreibung text NOT NULL DEFAULT '',
  typ text NOT NULL DEFAULT 'Sonstiges',
  ereignis_am timestamptz NOT NULL DEFAULT now(),
  wichtig boolean NOT NULL DEFAULT false,
  erledigt boolean NOT NULL DEFAULT false,
  erstellt_von uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  erstellt_von_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vorkommnisse_domain ON public.vorkommnisse(domain_id, ereignis_am DESC);
CREATE INDEX idx_vorkommnisse_einsatz ON public.vorkommnisse(einsatz_id);
GRANT SELECT, INSERT ON public.vorkommnisse TO authenticated;
GRANT ALL ON public.vorkommnisse TO service_role;
ALTER TABLE public.vorkommnisse ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Domain-Mitglieder lesen Vorkommnisse" ON public.vorkommnisse
  FOR SELECT TO authenticated USING (domain_id = public.current_effective_domain_id());
CREATE POLICY "Domain-Mitglieder melden Vorkommnisse" ON public.vorkommnisse
  FOR INSERT TO authenticated WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Admins verwalten Vorkommnisse" ON public.vorkommnisse
  FOR UPDATE TO authenticated USING (domain_id = public.current_effective_domain_id() AND (public.is_domain_admin(domain_id) OR public.is_superadmin())) WITH CHECK (domain_id = public.current_effective_domain_id());
CREATE POLICY "Admins loeschen Vorkommnisse" ON public.vorkommnisse
  FOR DELETE TO authenticated USING (domain_id = public.current_effective_domain_id() AND (public.is_domain_admin(domain_id) OR public.is_superadmin()));

-- Änderungshistorie
CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_domain ON public.audit_log(domain_id, created_at DESC);
CREATE INDEX idx_audit_table ON public.audit_log(table_name, record_id);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lesen Historie" ON public.audit_log
  FOR SELECT TO authenticated USING (domain_id = public.current_effective_domain_id() AND (public.is_domain_admin(domain_id) OR public.is_superadmin()));

-- Push-Anmeldungen
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES public.domains(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eigene Push-Anmeldungen" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins sehen Push-Anmeldungen" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (domain_id = public.current_effective_domain_id() AND (public.is_domain_admin(domain_id) OR public.is_superadmin()));

-- Generische Audit-Trigger-Funktion (Security Definer, schreibt ohne RLS)
CREATE OR REPLACE FUNCTION public.audit_log_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  _old jsonb;
  _new jsonb;
  _action text;
  _domain uuid;
  _diff jsonb := '{}'::jsonb;
  _k text;
  _uname text;
begin
  if tg_op = 'DELETE' then
    _old := to_jsonb(old); _new := null; _action := 'delete';
  elsif tg_op = 'INSERT' then
    _old := null; _new := to_jsonb(new); _action := 'insert';
  else
    _old := to_jsonb(old); _new := to_jsonb(new); _action := 'update';
  end if;
  _domain := coalesce((_new ->> 'domain_id')::uuid, (_old ->> 'domain_id')::uuid);
  if _action = 'update' then
    for _k in select jsonb_object_keys(_new - 'updated_at' - 'updated_by' - 'created_at') loop
      if _old -> _k is distinct from _new -> _k then
        _diff := _diff || jsonb_build_object(_k, jsonb_build_object('alt', _old -> _k, 'neu', _new -> _k));
      end if;
    end loop;
  end if;
  if auth.uid() is not null then
    select display_name into _uname from public.profiles where id = auth.uid();
  else
    _uname := 'System';
  end if;
  insert into public.audit_log(domain_id, user_id, user_name, table_name, record_id, action, changes)
  values (_domain, auth.uid(), _uname, tg_table_name, coalesce(_new ->> 'id', _old ->> 'id'), _action, _diff);
  return coalesce(new, old);
end $$;

CREATE OR REPLACE TRIGGER audit_einsaetze AFTER INSERT OR UPDATE OR DELETE ON public.einsaetze
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE OR REPLACE TRIGGER audit_dateien AFTER INSERT OR UPDATE OR DELETE ON public.dateien
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE OR REPLACE TRIGGER audit_schluessel_buch AFTER INSERT OR UPDATE OR DELETE ON public.schluessel_buch
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE OR REPLACE TRIGGER audit_schluessel_bestand AFTER INSERT OR UPDATE OR DELETE ON public.schluessel_bestand
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE OR REPLACE TRIGGER audit_schluesseluebergabe AFTER INSERT OR UPDATE OR DELETE ON public.schluesseluebergabe_protokolle
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE OR REPLACE TRIGGER audit_lager_artikel AFTER INSERT OR UPDATE OR DELETE ON public.lager_artikel
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();