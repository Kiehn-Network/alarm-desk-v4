import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, History, Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { updateDatei, listDateiHistorie } from "@/lib/dateien.functions";

const FIELD_LABELS: Record<string, string> = {
  filename: "Dateiname",
  kunden_name: "Kunde",
  address: "Adresse",
  key_number: "Schlüssel-Nr.",
  anlagen_nr: "Anlagen-Nr.",
  teilnehmer_id: "Teilnehmer-ID",
  folder: "Ordner",
  notiz: "Notiz",
};

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={255} />
    </div>
  );
}

export type DateiLike = {
  id: string;
  filename: string;
  kunden_name: string | null;
  address: string | null;
  key_number: string | null;
  anlagen_nr: string | null;
  teilnehmer_id: string | null;
  folder: string | null;
  notiz: string | null;
};

export function DateiEditDialog({
  datei, onClose, onDone,
}: { datei: DateiLike; onClose: () => void; onDone?: () => void }) {
  const update = useServerFn(updateDatei);
  const history = useServerFn(listDateiHistorie);
  const qc = useQueryClient();

  const [form, setForm] = useState({
    filename: datei.filename ?? "",
    kunden_name: datei.kunden_name ?? "",
    address: datei.address ?? "",
    key_number: datei.key_number ?? "",
    anlagen_nr: datei.anlagen_nr ?? "",
    teilnehmer_id: datei.teilnehmer_id ?? "",
    folder: datei.folder ?? "",
    notiz: datei.notiz ?? "",
  });
  const [busy, setBusy] = useState(false);

  const { data: hist, isLoading: histLoading } = useQuery({
    queryKey: ["datei-historie", datei.id],
    queryFn: () => history({ data: { datei_id: datei.id } }),
  });

  const save = async () => {
    setBusy(true);
    try {
      await update({
        data: {
          id: datei.id,
          filename: form.filename,
          kunden_name: form.kunden_name || null,
          address: form.address || null,
          key_number: form.key_number || null,
          anlagen_nr: form.anlagen_nr || null,
          teilnehmer_id: form.teilnehmer_id || null,
          folder: form.folder || null,
          notiz: form.notiz || null,
        },
      });
      toast.success("Änderungen gespeichert");
      qc.invalidateQueries({ queryKey: ["datei-historie", datei.id] });
      qc.invalidateQueries({ queryKey: ["dateien"] });
      onDone?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Speichern fehlgeschlagen");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5" /> Kunden-/Datei-Einstellungen
          </DialogTitle>
          <DialogDescription className="truncate">{datei.filename}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Dateiname</Label>
            <Input value={form.filename} onChange={(e) => setForm({ ...form, filename: e.target.value })} maxLength={255} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kunde" value={form.kunden_name} onChange={(v) => setForm({ ...form, kunden_name: v })} />
            <Field label="Adresse" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <Field label="Schlüssel-Nr." value={form.key_number} onChange={(v) => setForm({ ...form, key_number: v })} />
            <Field label="Anlagen-Nr." value={form.anlagen_nr} onChange={(v) => setForm({ ...form, anlagen_nr: v })} />
            <Field label="Teilnehmer-ID" value={form.teilnehmer_id} onChange={(v) => setForm({ ...form, teilnehmer_id: v })} />
            <Field label="Ordner" value={form.folder} onChange={(v) => setForm({ ...form, folder: v })} />
          </div>
          <div className="grid gap-2">
            <Label>Notiz</Label>
            <Textarea value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} rows={3} maxLength={2000} />
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center gap-2 mb-3">
            <History className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Änderungs-Historie</h3>
            <Badge variant="secondary">{hist?.entries.length ?? 0}</Badge>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 max-h-72 overflow-y-auto">
            {histLoading ? (
              <div className="p-6 text-center"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : (hist?.entries.length ?? 0) === 0 ? (
              <p className="p-6 text-sm text-center text-muted-foreground">Noch keine Änderungen erfasst.</p>
            ) : (
              <ul className="divide-y divide-border">
                {hist!.entries.map((e: any) => (
                  <li key={e.id} className="p-3 text-sm">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">
                        {FIELD_LABELS[e.field_name] ?? e.field_name}
                      </span>
                      <span>
                        {e.changed_by_name ?? "Unbekannt"} · {new Date(e.changed_at).toLocaleString("de-DE")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-1 rounded bg-destructive/10 text-destructive text-xs line-through max-w-[45%] truncate">
                        {e.old_value ?? "—"}
                      </span>
                      <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs max-w-[45%] truncate">
                        {e.new_value ?? "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Abbrechen</Button>
          <Button onClick={save} disabled={busy} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}