import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Upload, AlertTriangle, Info, Save, Palette, Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getAppSettings, updateAppSettings, updateFahrerZeitenConfig, updatePdfZeitenConfig, updateZentraleAdresse } from "@/lib/settings.functions";
import { Clock, FileText } from "lucide-react";

export function SystemSettingsPanel() {
  return (
    <div className="space-y-6">
      <GeneralSettings />
      <ThemeSettings />
      <ZentraleAdresseSettings />
      <FahrerZeitenSettings />
      <PdfZeitenSettings />
      <MaintenanceSettings />
    </div>
  );
}

// ============ General ============

function GeneralSettings() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAppSettings);
  const updateFn = useServerFn(updateAppSettings);
  const { data, isLoading } = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchFn() });

  const [firmenname, setFirmenname] = useState("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [hinweis, setHinweis] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFirmenname(data.firmenname ?? "");
    setLogoUrl(data.logo_url ?? "");
    setHinweis(data.dashboard_hinweis ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => updateFn({
      data: {
        firmenname,
        logo_url: logoUrl || null,
        dashboard_hinweis: hinweis || null,
        wartung_aktiv: data?.wartung_aktiv ?? false,
        wartung_nachricht: data?.wartung_nachricht ?? null,
        wartung_farbe: (data?.wartung_farbe as any) ?? "info",
        theme: ((data as any)?.theme as any) ?? "midnight",
      },
    }),
    onSuccess: () => {
      toast.success("Einstellungen gespeichert");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte ein Bild auswählen");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo darf max. 2 MB groß sein");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      toast.success("Logo hochgeladen – bitte speichern");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <header className="flex items-center gap-2 pb-4 border-b border-border mb-5">
        <Building2 className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">Systeminformationen</h3>
      </header>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Firmenname</Label>
            <Input value={firmenname} onChange={(e) => setFirmenname(e.target.value)} placeholder="z.B. Alarmzentrale Steinberg" />
            <p className="text-xs text-muted-foreground">Erscheint in Sidebar, Login-Seite und E-Mails.</p>
          </div>

          <div className="space-y-2">
            <Label>Login Logo</Label>
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-lg border border-border bg-muted/30 grid place-items-center overflow-hidden shrink-0">
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" className="size-full object-contain" />
                  : <Building2 className="size-5 text-muted-foreground" />}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="size-4 mr-2" />
                {uploading ? "Lade hoch…" : (logoUrl ? "Ersetzen" : "Hochladen")}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" onClick={() => setLogoUrl("")}>Entfernen</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG/SVG mit transparentem Hintergrund. Max. 2 MB.</p>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>Interner Hinweistext (Dashboard)</Label>
            <Textarea value={hinweis} onChange={(e) => setHinweis(e.target.value)} rows={3}
              placeholder="z.B. Wichtige Hinweise an alle Mitarbeiter…" />
          </div>

          <div className="lg:col-span-2 flex justify-end pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="size-4 mr-2" />{save.isPending ? "Speichere…" : "Speichern"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ============ Maintenance ============

const FARBEN = [
  { value: "info", label: "Info (Blau)" },
  { value: "orange", label: "Warnung (Orange)" },
  { value: "rot", label: "Kritisch (Rot)" },
];

function MaintenanceSettings() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAppSettings);
  const updateFn = useServerFn(updateAppSettings);
  const { data } = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchFn() });

  const [aktiv, setAktiv] = useState(false);
  const [nachricht, setNachricht] = useState("");
  const [farbe, setFarbe] = useState<"info" | "orange" | "rot">("info");

  useEffect(() => {
    if (!data) return;
    setAktiv(!!data.wartung_aktiv);
    setNachricht(data.wartung_nachricht ?? "");
    setFarbe((data.wartung_farbe as any) ?? "info");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => updateFn({
      data: {
        firmenname: data?.firmenname ?? "AlarmDesk",
        logo_url: data?.logo_url ?? null,
        dashboard_hinweis: data?.dashboard_hinweis ?? null,
        wartung_aktiv: aktiv,
        wartung_nachricht: nachricht || null,
        wartung_farbe: farbe,
        theme: ((data as any)?.theme as any) ?? "midnight",
      },
    }),
    onSuccess: () => {
      toast.success("Wartungsmodus aktualisiert");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const previewClass =
    farbe === "rot" ? "bg-red-500/15 border-red-500/30 text-red-200"
    : farbe === "orange" ? "bg-orange-500/15 border-orange-500/30 text-orange-200"
    : "bg-primary/15 border-primary/30 text-primary";

  return (
    <section className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <header className="flex items-center gap-2 pb-4 border-b border-border mb-5">
        <AlertTriangle className="size-4 text-orange-400" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">Wartungsmodus</h3>
      </header>
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <div className="text-sm font-medium">Wartungs-Hinweis aktivieren</div>
            <p className="text-xs text-muted-foreground mt-0.5">Wenn aktiv, sehen alle Nutzer oben im System einen Banner.</p>
          </div>
          <Switch checked={aktiv} onCheckedChange={setAktiv} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            <Label>Nachricht im Banner</Label>
            <Textarea value={nachricht} onChange={(e) => setNachricht(e.target.value)} rows={2}
              placeholder="z.B. Wartung heute bis 20:30 Uhr." />
          </div>
          <div className="space-y-2">
            <Label>Farbe</Label>
            <Select value={farbe} onValueChange={(v) => setFarbe(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FARBEN.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Vorschau</Label>
          <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${previewClass}`}>
            <Info className="size-4 shrink-0" />
            <span>{nachricht || "Wartungsmodus aktiv"}</span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="size-4 mr-2" />{save.isPending ? "Speichere…" : "Speichern"}
          </Button>
        </div>
      </div>
    </section>
  );
}


// ============ Theme (per-domain) ============

const THEMES = [
  { value: "midnight", label: "Midnight Blue", swatches: ["#1a1f3a", "#3b6fff", "#0f1226"] },
  { value: "emerald",  label: "Emerald Pro",  swatches: ["#0f2a22", "#22c08c", "#d4a84c"] },
  { value: "slate",    label: "Slate Mono",   swatches: ["#1c1e22", "#cfd2d7", "#2a2d33"] },
  { value: "sunset",   label: "Sunset Warm",  swatches: ["#2a1410", "#ff7a3a", "#e23a55"] },
  { value: "crimson",  label: "Crimson Red",  swatches: ["#2a1014", "#e23a4a", "#c4488a"] },
  { value: "violet",   label: "Royal Violet", swatches: ["#1e1530", "#8b5cf6", "#d946ef"] },
  { value: "ocean",    label: "Deep Ocean",   swatches: ["#0c1f2a", "#3aa8d6", "#5cd2c8"] },
  { value: "mono",     label: "Pure Mono",    swatches: ["#0a0a0a", "#ffffff", "#2a2a2a"] },
  { value: "lavender", label: "Soft Lavender",swatches: ["#eef0fa", "#ffffff", "#7c8cf0"] },
] as const;

function ThemeSettings() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAppSettings);
  const updateFn = useServerFn(updateAppSettings);
  const { data } = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchFn() });

  const current = ((data as any)?.theme as string) ?? "midnight";
  const [theme, setTheme] = useState<string>("midnight");

  useEffect(() => { setTheme(current); }, [current]);

  const save = useMutation({
    mutationFn: async () => updateFn({
      data: {
        firmenname: data?.firmenname ?? "AlarmDesk",
        logo_url: data?.logo_url ?? null,
        dashboard_hinweis: data?.dashboard_hinweis ?? null,
        wartung_aktiv: data?.wartung_aktiv ?? false,
        wartung_nachricht: data?.wartung_nachricht ?? null,
        wartung_farbe: (data?.wartung_farbe as any) ?? "info",
        theme: theme as any,
      },
    }),
    onSuccess: () => {
      toast.success("Design aktualisiert – gilt für alle Nutzer der Domäne.");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  return (
    <section className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <header className="flex items-center gap-2 pb-4 border-b border-border mb-5">
        <Palette className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">Design / Theme</h3>
      </header>
      <p className="text-sm text-muted-foreground mb-4">
        Wähle ein Theme für deine Domäne. Light/Dark-Modus können Nutzer weiterhin individuell einstellen.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {THEMES.map((t) => {
          const active = theme === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              className={`group relative text-left rounded-xl border p-4 transition-all ${
                active
                  ? "border-primary ring-2 ring-ring bg-accent/30"
                  : "border-border hover:border-primary/60 hover:bg-accent/20"
              }`}
            >
              <div className="flex gap-1.5 mb-3">
                {t.swatches.map((c) => (
                  <span key={c} className="size-6 rounded-md border border-border" style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{t.label}</div>
                {active && <Check className="size-4 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end mt-5">
        <Button onClick={() => save.mutate()} disabled={save.isPending || theme === current}>
          <Save className="size-4 mr-2" />{save.isPending ? "Speichere…" : "Speichern"}
        </Button>
      </div>
    </section>
  );
}

// ============ Fahrer-Zeiten (per-domain) ============

type ZeitKey = "abfahrt_zentrale" | "vor_ort" | "abfahrt_objekt";
const ZEIT_LABELS: Record<ZeitKey, string> = {
  abfahrt_zentrale: "Abfahrt Zentrale",
  vor_ort: "Vor Ort",
  abfahrt_objekt: "Abfahrt Objekt",
};
const DEFAULT_ZEITEN = {
  abfahrt_zentrale: { enabled: false, required: false },
  vor_ort: { enabled: true, required: true },
  abfahrt_objekt: { enabled: true, required: false },
};

function FahrerZeitenSettings() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAppSettings);
  const updateFn = useServerFn(updateFahrerZeitenConfig);
  const { data } = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchFn() });

  const [cfg, setCfg] = useState(DEFAULT_ZEITEN);
  useEffect(() => {
    const c = (data as any)?.fahrer_zeiten_config;
    if (c) setCfg({ ...DEFAULT_ZEITEN, ...c });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => updateFn({ data: cfg }),
    onSuccess: () => {
      toast.success("Fahrer-Zeiten aktualisiert");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const toggle = (k: ZeitKey, field: "enabled" | "required", v: boolean) =>
    setCfg((prev) => {
      const next = { ...prev, [k]: { ...prev[k], [field]: v } };
      if (field === "enabled" && !v) next[k].required = false;
      if (field === "required" && v) next[k].enabled = true;
      return next;
    });

  return (
    <section className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <header className="flex items-center gap-2 pb-4 border-b border-border mb-5">
        <Clock className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">Fahrer-Zeiten</h3>
      </header>
      <p className="text-sm text-muted-foreground mb-4">
        Lege fest, welche Zeitpunkte der Fahrer während eines Einsatzes erfassen kann und welche
        davon zwingend erforderlich sind, bevor der Einsatz abgeschlossen werden darf.
      </p>
      <div className="space-y-3">
        {(Object.keys(ZEIT_LABELS) as ZeitKey[]).map((k) => (
          <div key={k} className="rounded-lg border border-border bg-muted/20 p-4 flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[160px] text-sm font-medium">{ZEIT_LABELS[k]}</div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={cfg[k].enabled} onCheckedChange={(v) => toggle(k, "enabled", v)} />
              <span>Anzeigen</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={cfg[k].required} onCheckedChange={(v) => toggle(k, "required", v)} />
              <span>Pflicht</span>
            </label>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-5">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="size-4 mr-2" />{save.isPending ? "Speichere…" : "Speichern"}
        </Button>
      </div>
    </section>
  );
}

// ============ Zentrale Adresse (per-domain) ============

function ZentraleAdresseSettings() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAppSettings);
  const updateFn = useServerFn(updateZentraleAdresse);
  const { data } = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchFn() });

  const [adresse, setAdresse] = useState("");
  useEffect(() => {
    setAdresse(((data as any)?.zentrale_adresse as string | null) ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => updateFn({ data: { zentrale_adresse: adresse.trim() || null } }),
    onSuccess: () => {
      toast.success("Zentrale-Adresse gespeichert");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  return (
    <section className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <header className="flex items-center gap-2 pb-4 border-b border-border mb-5">
        <MapPin className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">Zentrale-Adresse</h3>
      </header>
      <p className="text-sm text-muted-foreground mb-4">
        Adresse eurer Zentrale. Der Fahrer sieht in seinen Einsätzen einen Button
        „zur Zentrale", der die Navigation zu dieser Adresse öffnet.
      </p>
      <div className="space-y-2">
        <Label htmlFor="zentrale-adresse">Adresse</Label>
        <Input
          id="zentrale-adresse"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder="Musterstraße 1, 12345 Musterstadt"
          maxLength={500}
        />
      </div>
      <div className="flex justify-end mt-5">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="size-4 mr-2" />{save.isPending ? "Speichere…" : "Speichern"}
        </Button>
      </div>
    </section>
  );
}

// ============ PDF-Zeiten (per-domain) ============

type PdfZeitKey = "created" | "abfahrt_zentrale" | "vor_ort" | "abfahrt_objekt" | "einsatz_ende" | "abgeschlossen";
const PDF_LABELS: Record<PdfZeitKey, string> = {
  created: "Erstellt",
  abfahrt_zentrale: "Abfahrt Zentrale",
  vor_ort: "Vor Ort",
  abfahrt_objekt: "Abfahrt Objekt",
  einsatz_ende: "Einsatz-Ende",
  abgeschlossen: "Abgeschlossen",
};
const DEFAULT_PDF_ZEITEN: Record<PdfZeitKey, boolean> = {
  created: true,
  abfahrt_zentrale: false,
  vor_ort: true,
  abfahrt_objekt: true,
  einsatz_ende: true,
  abgeschlossen: true,
};

function PdfZeitenSettings() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAppSettings);
  const updateFn = useServerFn(updatePdfZeitenConfig);
  const { data } = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchFn() });

  const [cfg, setCfg] = useState(DEFAULT_PDF_ZEITEN);
  useEffect(() => {
    const c = (data as any)?.pdf_zeiten_config;
    if (c) setCfg({ ...DEFAULT_PDF_ZEITEN, ...c });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => updateFn({ data: cfg }),
    onSuccess: () => {
      toast.success("PDF-Zeiten aktualisiert");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  return (
    <section className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <header className="flex items-center gap-2 pb-4 border-b border-border mb-5">
        <FileText className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">PDF-Bericht Zeiten</h3>
      </header>
      <p className="text-sm text-muted-foreground mb-4">
        Wähle, welche Zeitangaben im generierten Einsatzbericht-PDF (Download &amp; E-Mail) erscheinen.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(PDF_LABELS) as PdfZeitKey[]).map((k) => (
          <label key={k} className="rounded-lg border border-border bg-muted/20 p-3 flex items-center justify-between gap-3">
            <span className="text-sm">{PDF_LABELS[k]}</span>
            <Switch checked={cfg[k]} onCheckedChange={(v) => setCfg((p) => ({ ...p, [k]: v }))} />
          </label>
        ))}
      </div>
      <div className="flex justify-end mt-5">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="size-4 mr-2" />{save.isPending ? "Speichere…" : "Speichern"}
        </Button>
      </div>
    </section>
  );
}
