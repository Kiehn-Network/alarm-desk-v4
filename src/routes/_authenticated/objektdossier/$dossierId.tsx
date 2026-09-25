import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Pencil, Trash2, Save, X, Loader2, PhoneCall, UserPlus, FolderOpen, Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DossierAnsicht } from "@/components/objekt-dossier-view";
import {
  getDossier, updateDossier, deleteDossier, saveKontakt, deleteKontakt,
  type DossierRow, type KontaktRow,
} from "@/lib/objektdossier.functions";

export const Route = createFileRoute("/_authenticated/objektdossier/$dossierId")({
  component: DossierDetailPage,
});

const FELDER = [
  { key: "anfahrt", label: "Anfahrt & Zufahrt", platz: "z. B. Hofeinfahrt rechts, Schranke mit Fernbedienung im Schlüsselkasten" },
  { key: "parken", label: "Parken & Wendemöglichkeiten", platz: "z. B. Besucherparkplatz Hinterhof, Wendebucht vor dem Tor" },
  { key: "schluessel", label: "Schlüssellage & Übergabe", platz: "z. B. Schlüssel Nr. 12 im Depot, Code 4321, Rückgabe bis 20:00" },
  { key: "alarm_plan", label: "Alarm- & Aufschaltplan", platz: "z. B. Zone 1 Lager, Aufschalten über Feldbedienteil, Quittierung nötig" },
  { key: "gefahren", label: "Gefahren & besondere Hinweise", platz: "z. B. Hunde auf dem Grundstück, Glatteisgefahr am Nordtor" },
  { key: "technik", label: "Technik im Objekt", platz: "z. B. BMA Notifier, Funkmelder Typ X, Batteriewechsel alle 2 Jahre" },
  { key: "oeffnungszeiten", label: "Verfügbarkeit & Öffnungszeiten", platz: "z. B. Mo–Fr 06–20 Uhr, Werksferien KW 32" },
  { key: "notiz", label: "Weitere Hinweise", platz: "Freitext für alles Weitere" },
] as const;

function DossierDetailPage() {
  const { dossierId } = Route.useParams();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getDossier);
  const updateFn = useServerFn(updateDossier);
  const deleteFn = useServerFn(deleteDossier);

  const [bearbeiten, setBearbeiten] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kontaktDialog, setKontaktDialog] = useState<KontaktRow | "neu" | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["objekt-dossier", dossierId],
    queryFn: () => getFn({ data: { id: dossierId } }),
  });
  const dossier = (data as any)?.dossier as DossierRow | undefined;
  const kontakte = ((data as any)?.kontakte ?? []) as KontaktRow[];
  const dateien = ((data as any)?.dateien ?? []) as Array<{ id: string; filename: string; folder: string | null; created_at: string }>;

  const [form, setForm] = useState<Record<string, any> | null>(null);
  const werte = form ?? (dossier ? (dossier as any) : {});

  function starteBearbeitung() {
    if (!dossier) return;
    const kopie: Record<string, any> = { ...dossier };
    setForm(kopie);
    setBearbeiten(true);
  }

  async function speichern() {
    if (!dossier) return;
    setBusy(true);
    try {
      await updateFn({
        data: {
          id: dossier.id,
          kunden_name: String(werte.kunden_name ?? "").trim(),
          key_number: werte.key_number ?? null,
          teilnehmer_id: werte.teilnehmer_id ?? null,
          anlagen_nr: werte.anlagen_nr ?? null,
          address: werte.address ?? null,
          anfahrt: werte.anfahrt ?? null,
          parken: werte.parken ?? null,
          schluessel: werte.schluessel ?? null,
          alarm_plan: werte.alarm_plan ?? null,
          gefahren: werte.gefahren ?? null,
          technik: werte.technik ?? null,
          oeffnungszeiten: werte.oeffnungszeiten ?? null,
          notiz: werte.notiz ?? null,
          fahrer_sichtbar: werte.fahrer_sichtbar !== false,
        },
      });
      toast.success("Objektdossier gespeichert.");
      setBearbeiten(false);
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["objekt-dossier", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["objekt-dossiers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loeschen() {
    if (!dossier) return;
    if (!window.confirm(`Objektdossier für „${dossier.kunden_name}“ wirklich löschen?`)) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: dossier.id } });
      toast.success("Objektdossier gelöscht.");
      window.location.assign("/objektdossier");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  if (isFetching && !dossier) {
    return (
      <div className="p-6 lg:p-8 grid place-items-center py-20 text-muted-foreground gap-2">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Objektdossier wird geladen ...</span>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <p className="text-sm text-muted-foreground">Objektdossier nicht gefunden.</p>
        <Button variant="outline" className="gap-1.5" asChild>
          <Link to="/objektdossier">
            <ArrowLeft className="size-4" /> Zurück zur Übersicht
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link to="/objektdossier">
            <ArrowLeft className="size-4" /> Objektdossiers
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {bearbeiten ? (
            <>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { setBearbeiten(false); setForm(null); }}>
                <X className="size-4" /> Verwerfen
              </Button>
              <Button size="sm" className="gap-1.5" onClick={speichern} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Speichern
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={starteBearbeitung}>
                <Pencil className="size-4" /> Bearbeiten
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={loeschen} disabled={busy}>
                <Trash2 className="size-4" /> Löschen
              </Button>
            </>
          )}
        </div>
      </div>

      {bearbeiten ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Stammdaten</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Feld label="Kundenname *" wert={werte.kunden_name} onChange={(v) => setForm((f) => ({ ...(f ?? {}), kunden_name: v }))} />
              <Feld label="Adresse" wert={werte.address} onChange={(v) => setForm((f) => ({ ...(f ?? {}), address: v }))} />
              <Feld label="Schlüssel-Nr." wert={werte.key_number} onChange={(v) => setForm((f) => ({ ...(f ?? {}), key_number: v }))} />
              <Feld label="Anlagen-Nr." wert={werte.anlagen_nr} onChange={(v) => setForm((f) => ({ ...(f ?? {}), anlagen_nr: v }))} />
              <Feld label="Teilnehmer-Nr." wert={werte.teilnehmer_id} onChange={(v) => setForm((f) => ({ ...(f ?? {}), teilnehmer_id: v }))} />
              <div className="flex items-center gap-3 sm:col-span-2 pt-1">
                <Switch
                  checked={werte.fahrer_sichtbar !== false}
                  onCheckedChange={(v: boolean) => setForm((f) => ({ ...(f ?? {}), fahrer_sichtbar: v }))}
                  id="fahrer-sichtbar"
                />
                <Label htmlFor="fahrer-sichtbar" className="text-sm font-normal">
                  Für Fahrer freigeben (zeigt die Objektinfo direkt am Einsatz)
                </Label>
              </div>
            </div>
          </div>

          {FELDER.map((f) => (
            <div key={f.key} className="rounded-xl border border-border bg-card p-4 space-y-2" style={{ boxShadow: "var(--shadow-card)" }}>
              <Label className="text-xs">{f.label}</Label>
              <Textarea
                rows={3}
                value={String(werte[f.key] ?? "")}
                onChange={(e) => setForm((prev) => ({ ...(prev ?? {}), [f.key]: e.target.value }))}
                placeholder={f.platz}
              />
            </div>
          ))}
        </div>
      ) : (
        <DossierAnsicht dossier={dossier} kontakte={kontakte} />
      )}

      <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Notfallkontakte ({kontakte.length})
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setKontaktDialog("neu")}>
            <UserPlus className="size-4" /> Kontakt hinzufügen
          </Button>
        </div>
        {kontakte.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Kontakte hinterlegt.</p>
        ) : (
          <ul className="space-y-2">
            {kontakte.map((k) => (
              <li key={k.id} className="flex items-center gap-3 flex-wrap rounded-lg border border-border px-3 py-2">
                <PhoneCall className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {k.name}
                    {k.rolle ? <span className="text-muted-foreground font-normal"> · {k.rolle}</span> : ""}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{k.telefon}</div>
                </div>
                {!k.aktiv && <Badge variant="outline">deaktiviert</Badge>}
                <Button size="sm" variant="ghost" onClick={() => setKontaktDialog(k)}>Bearbeiten</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    try {
                      await deleteKontaktFn(deleteFn, { id: k.id }, queryClient, dossierId);
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dateien.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Dateien zu diesem Objekt
            </div>
            <Button size="sm" variant="ghost" className="gap-1.5" asChild>
              <Link to="/dateien">
                <FolderOpen className="size-4" /> In der Dateiverwaltung
              </Link>
            </Button>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2">
            {dateien.map((d) => (
              <li key={d.id} className="text-sm truncate rounded-lg border border-border px-3 py-2 flex items-center gap-2">
                <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{d.filename}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <KontaktDialog
        dossierId={dossierId}
        kontakt={kontaktDialog === "neu" ? null : kontaktDialog}
        offen={kontaktDialog !== null}
        onClose={() => setKontaktDialog(null)}
        gespeichert={() => {
          setKontaktDialog(null);
          queryClient.invalidateQueries({ queryKey: ["objekt-dossier", dossierId] });
        }}
      />
    </div>
  );
}

const deleteKontaktFn = async (_unused: unknown, _input: unknown, _qc: unknown, _id: string) => {
  throw new Error("bitte über den Kontakt-Dialog löschen");
};

function Feld({ label, wert, onChange }: { label: string; wert?: string | null; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={String(wert ?? "")} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function KontaktDialog({
  dossierId,
  kontakt,
  offen,
  onClose,
  gespeichert,
}: {
  dossierId: string;
  kontakt: KontaktRow | null;
  offen: boolean;
  onClose: () => void;
  gespeichert: () => void;
}) {
  const saveFn = useServerFn(saveKontakt);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(kontakt?.name ?? "");
  const [rolle, setRolle] = useState(kontakt?.rolle ?? "");
  const [telefon, setTelefon] = useState(kontakt?.telefon ?? "");
  const [prioritaet, setPrioritaet] = useState(String(kontakt?.prioritaet ?? 1));
  const [aktiv, setAktiv] = useState(kontakt?.aktiv ?? true);
  const [notiz, setNotiz] = useState(kontakt?.notiz ?? "");

  async function speichern() {
    setBusy(true);
    try {
      await saveFn({
        data: {
          dossier_id: dossierId,
          id: kontakt?.id,
          name: name.trim(),
          rolle: rolle.trim() || null,
          telefon: telefon.trim(),
          prioritaet: Number(prioritaet) || 1,
          aktiv,
          notiz: notiz.trim() || null,
        },
      });
      toast.success("Kontakt gespeichert.");
      gespeichert();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" /> {kontakt ? "Kontakt bearbeiten" : "Neuer Kontakt"}
          </DialogTitle>
          <DialogDescription>Ansprechpartner, die im Einsatzfall angerufen werden.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Herr Weber" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Rolle</Label>
              <Input value={rolle} onChange={(e) => setRolle(e.target.value)} placeholder="Hausmeister, Sicherheitsdienst ..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon *</Label>
              <Input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="0170 1234567" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reihenfolge</Label>
              <Input value={prioritaet} onChange={(e) => setPrioritaet(e.target.value)} inputMode="numeric" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={aktiv} onCheckedChange={(v: boolean) => setAktiv(v)} id="kontakt-aktiv" />
              <Label htmlFor="kontakt-aktiv" className="text-sm font-normal">Aktiv</Label>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hinweis</Label>
            <Input value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. nur tagsüber erreichbar" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={speichern} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="size-4 animate-spin" />} Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
