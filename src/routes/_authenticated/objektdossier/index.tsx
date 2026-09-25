import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DoorOpen, Plus, Search, KeyRound, MapPin, CalendarClock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { KundeSuche, type KundeHit } from "@/components/kunde-suche";
import { listDossiers, createDossier } from "@/lib/objektdossier.functions";

export const Route = createFileRoute("/_authenticated/objektdossier/")({
  head: () => ({
    meta: [
      { title: "Objektdossier – AlarmDesk" },
      { name: "description", content: "Einsatzanleitung pro Objekt: Anfahrt, Schlüssellage, Alarmplan und Notfallkontakte." },
      { property: "og:title", content: "Objektdossier" },
      { property: "og:description", content: "Alle Objektinformationen gebündelt für Zentrale und Fahrer." },
    ],
  }),
  component: ObjektdossierPage,
});

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ObjektdossierPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listDossiers);
  const [eingabe, setEingabe] = useState("");
  const [q, setQ] = useState("");
  const [neu, setNeu] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(eingabe.trim()), 300);
    return () => clearTimeout(t);
  }, [eingabe]);

  const { data, isFetching } = useQuery({
    queryKey: ["objekt-dossiers", q],
    queryFn: () => listFn({ data: { q } }),
  });
  const rows = ((data as any)?.rows ?? []) as any[];

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <DoorOpen className="size-3.5" /> Objekt & Einsatzvorbereitung
          </div>
          <h1 className="text-3xl font-bold mt-1">Objektdossier</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Eine Seite pro Objekt mit allem, was im Einsatzfall zählt: Anfahrt, Parken, Schlüssellage,
            Alarmplan, Gefahrenhinweise und Kontakte. Fahrer sehen die Infos direkt am Einsatz.
          </p>
        </div>
        <Button onClick={() => setNeu(true)} className="gap-1.5">
          <Plus className="size-4" /> Neues Dossier
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Kunde, Adresse, Schlüssel-Nr. suchen ..."
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
        />
      </div>

      {isFetching && rows.length === 0 ? (
        <div className="grid place-items-center py-16 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Dossiers werden geladen ...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center">
            <DoorOpen className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Noch keine Dossiers angelegt. Lege das erste an – am schnellsten über die Kundensuche.
          </p>
          <Button size="sm" variant="outline" onClick={() => setNeu(true)} className="gap-1.5">
            <Plus className="size-4" /> Erstes Dossier anlegen
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <Link
              key={r.id}
              to="/objektdossier/$dossierId"
              params={{ dossierId: r.id }}
              className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors space-y-2"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold leading-tight">{r.kunden_name}</div>
                <Badge variant={r.fahrer_sichtbar ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                  {r.fahrer_sichtbar ? "Fahrer" : "Zentrale"}
                </Badge>
              </div>
              {r.address && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="size-3" /> {r.address}
                </div>
              )}
              {r.key_number && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="size-3" /> {r.key_number}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                <CalendarClock className="size-3" /> Geändert {fmt(r.updated_at)}
              </div>
            </Link>
          ))}
        </div>
      )}

      <NeuesDossierDialog open={neu} onClose={() => setNeu(false)} onCreated={(id) => navigate({ to: "/objektdossier/$dossierId", params: { dossierId: id } })} />
    </div>
  );
}

function NeuesDossierDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createFn = useServerFn(createDossier);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kunden_name: "",
    address: "",
    key_number: "",
    anlagen_nr: "",
    teilnehmer_id: "",
  });

  function set(feld: keyof typeof form, wert: string) {
    setForm((f) => ({ ...f, [feld]: wert }));
  }

  function uebernehmen(hit: KundeHit) {
    setForm({
      kunden_name: hit.kunden_name ?? "",
      address: hit.address ?? "",
      key_number: hit.key_number ?? "",
      anlagen_nr: hit.anlagen_nr ?? "",
      teilnehmer_id: hit.teilnehmer_id ?? "",
    });
  }

  async function speichern() {
    if (!form.kunden_name.trim()) {
      toast.error("Bitte einen Kundennamen angeben.");
      return;
    }
    setBusy(true);
    try {
      const res = await createFn({ data: { ...form, fahrer_sichtbar: true } });
      toast.success("Objektdossier angelegt.");
      onClose();
      setForm({ kunden_name: "", address: "", key_number: "", anlagen_nr: "", teilnehmer_id: "" });
      onCreated((res as any).dossier.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Neues Objektdossier</DialogTitle>
          <DialogDescription>
            Wähle ein Objekt aus der Dateiverwaltung – die Stammdaten werden übernommen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <KundeSuche onPick={uebernehmen} label="Objekt aus der Dateiverwaltung übernehmen" />

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Kundenname *</Label>
              <Input value={form.kunden_name} onChange={(e) => set("kunden_name", e.target.value)} placeholder="z. B. Fa. Meier OHG" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Adresse</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Straße, Hausnummer, Ort" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Schlüssel-Nr.</Label>
              <Input value={form.key_number} onChange={(e) => set("key_number", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Anlagen-Nr.</Label>
              <Input value={form.anlagen_nr} onChange={(e) => set("anlagen_nr", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teilnehmer-Nr.</Label>
              <Input value={form.teilnehmer_id} onChange={(e) => set("teilnehmer_id", e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={speichern} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="size-4 animate-spin" />} Dossier anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
