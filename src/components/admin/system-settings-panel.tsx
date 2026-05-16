import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Upload, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getAppSettings, updateAppSettings } from "@/lib/settings.functions";

export function SystemSettingsPanel() {
  return (
    <div className="space-y-6">
      <GeneralSettings />
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

// ============ Modules ============

function ModulesSettings() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAppModules);
  const toggleFn = useServerFn(setAppModuleEnabled);
  const upsertFn = useServerFn(upsertAppModule);
  const deleteFn = useServerFn(deleteAppModule);

  const { data: modules, isLoading } = useQuery({ queryKey: ["app-modules"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<any | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["app-modules"] });

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleFn({ data: { id, enabled } });
      toast.success(enabled ? "Modul aktiviert" : "Modul deaktiviert");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <header className="flex items-center justify-between pb-4 border-b border-border mb-5">
        <div className="flex items-center gap-2">
          <Power className="size-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Module & Funktionen</h3>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-2" />Modul hinzufügen
        </Button>
      </header>

      {isLoading && <div className="text-sm text-muted-foreground">Lade…</div>}
      {!isLoading && (modules?.length ?? 0) === 0 && (
        <div className="text-sm text-muted-foreground">Noch keine Module angelegt.</div>
      )}

      <div className="divide-y divide-border">
        {(modules ?? []).map((m: any) => (
          <div key={m.id} className="py-3 flex items-center gap-4">
            <Switch checked={m.enabled} onCheckedChange={(v) => handleToggle(m.id, v)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{m.name}</span>
                <Badge variant="outline" className="text-[10px] uppercase">{m.key}</Badge>
                {!m.enabled && <Badge variant="secondary" className="text-[10px]">inaktiv</Badge>}
              </div>
              {m.beschreibung && <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.beschreibung}</p>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => setEditing(m)}>
              <Pencil className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setDelTarget(m)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <ModuleDialog
        open={createOpen || !!editing}
        onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditing(null); } }}
        initial={editing}
        onSubmit={async (v) => {
          try {
            await upsertFn({ data: v });
            toast.success(editing ? "Modul gespeichert" : "Modul angelegt");
            setCreateOpen(false); setEditing(null); refresh();
          } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
        }}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modul löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{delTarget?.name}" wird unwiderruflich entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try { await deleteFn({ data: { id: delTarget.id } }); toast.success("Gelöscht"); setDelTarget(null); refresh(); }
                catch (e: any) { toast.error(e?.message ?? "Fehler"); }
              }}
            >Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ModuleDialog({
  open, onOpenChange, initial, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: any | null;
  onSubmit: (v: any) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setKey(initial?.key ?? "");
    setBeschreibung(initial?.beschreibung ?? "");
    setEnabled(initial?.enabled ?? true);
    setSortOrder(initial?.sort_order ?? 0);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Modul bearbeiten" : "Modul hinzufügen"}</DialogTitle>
          <DialogDescription>
            Module entsprechen Lizenz-Paketen. Aktive Module sind in der App freigeschaltet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Malteser Module" />
            </div>
            <div className="space-y-2">
              <Label>Schlüssel</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                placeholder="malteser" disabled={!!initial} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="space-y-2">
              <Label>Sortierung</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <Label className="!mt-0">Aktiv</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => onSubmit({
            id: initial?.id,
            name, key, beschreibung: beschreibung || null,
            enabled, sort_order: sortOrder,
          })}>
            <Save className="size-4 mr-2" />Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}