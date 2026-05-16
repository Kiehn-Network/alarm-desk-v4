import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listBerichte, deleteBericht, updateBericht, sendBericht, getBericht, getRohrserviceConfig,
} from "@/lib/rohrservice.functions";
import { buildRohrservicePdf } from "@/lib/rohrservice-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Send, CheckCircle2, Trash2, Pencil, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useAppSettings } from "@/hooks/use-app-settings";

export const Route = createFileRoute("/_authenticated/notdienst/rohrservice/nachbearbeitung")({
  component: Nachbearbeitung,
});

function fmtDe(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Nachbearbeitung() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBerichte);
  const delFn = useServerFn(deleteBericht);
  const sendFn = useServerFn(sendBericht);
  const cfgFn = useServerFn(getRohrserviceConfig);
  const { data: settings } = useAppSettings();

  const { data } = useQuery({ queryKey: ["rs-berichte"], queryFn: () => listFn() });
  const { data: cfg } = useQuery({ queryKey: ["rs-config"], queryFn: () => cfgFn() });
  const variante = (cfg?.variante ?? "standard") as "standard" | "budeko";
  const berichte = (data?.berichte ?? []) as any[];

  const [editId, setEditId] = useState<string | null>(null);
  const [sendId, setSendId] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["rs-berichte"] });
    },
  });

  async function handleSend(b: any, email: string) {
    const doc = buildRohrservicePdf(b, settings?.firmenname ?? "Rohrservice", variante);
    const ab = doc.output("arraybuffer");
    const b64 = btoa(String.fromCharCode(...new Uint8Array(ab as ArrayBuffer)));
    await sendFn({
      data: {
        id: b.id,
        recipient_email: email,
        pdf_base64: b64,
        filename: `rohrservice_bericht_${b.bericht_nr}.pdf`,
      },
    });
    toast.success("Bericht versendet");
    qc.invalidateQueries({ queryKey: ["rs-berichte"] });
    setSendId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ClipboardList className="size-4" />
        <span>{berichte.length} {berichte.length === 1 ? "Bericht" : "Berichte"}</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto" style={{ boxShadow: "var(--shadow-card)" }}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Anrufer</th>
              <th className="text-left px-4 py-3">Straße</th>
              <th className="text-left px-4 py-3">Stadt</th>
              <th className="text-left px-4 py-3">Erstellt am</th>
              <th className="text-right px-4 py-3">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {berichte.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Keine Berichte vorhanden.</td></tr>
            )}
            {berichte.map((b) => (
              <tr key={b.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-primary">{b.bericht_nr}</td>
                <td className="px-4 py-3">{b.anrufer_name ?? "–"}</td>
                <td className="px-4 py-3">{b.mieter_strasse ?? "–"}</td>
                <td className="px-4 py-3">{b.mieter_ort ?? "–"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDe(b.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    {b.versendet ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-success/15 text-success">
                        <CheckCircle2 className="size-3" /> Versendet
                      </span>
                    ) : (
                      <Button size="sm" variant="default" onClick={() => setSendId(b.id)}>
                        <Send className="size-3.5 mr-1" /> Versand
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setEditId(b.id)}>
                      <Pencil className="size-3.5 mr-1" /> Bearbeiten
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (confirm("Bericht wirklich löschen?")) del.mutate(b.id);
                    }}>
                      <Trash2 className="size-3.5 mr-1" /> Löschen
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId && <EditDialog id={editId} variante={variante} onClose={() => setEditId(null)} />}
      {sendId && (
        <SendDialog
          bericht={berichte.find((b) => b.id === sendId)}
          onClose={() => setSendId(null)}
          onSend={handleSend}
        />
      )}
    </div>
  );
}

function SendDialog({
  bericht, onClose, onSend,
}: { bericht: any; onClose: () => void; onSend: (b: any, email: string) => Promise<void> }) {
  const [email, setEmail] = useState(bericht?.versendet_an ?? "");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Bericht versenden</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Bericht #{bericht?.bericht_nr}</div>
          <div className="space-y-1.5">
            <Label>Empfänger-E-Mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kunde@example.com" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={!email || pending}
            onClick={async () => {
              setPending(true);
              try { await onSend(bericht, email); } catch (e: any) { toast.error(e.message ?? "Fehler"); }
              finally { setPending(false); }
            }}
          >
            {pending ? "Senden…" : "Senden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type FieldDef = [string, string, "text" | "textarea" | "datetime-local"];
const FIELDS_STANDARD: FieldDef[] = [
  ["anrufer_name", "Anrufer Name", "text"],
  ["anrufer_telefon", "Anrufer Telefon", "text"],
  ["anrufer_adresse", "Anrufer Adresse", "text"],
  ["anrufer_firma", "Anrufer Firma", "text"],
  ["rechnung_name", "Rechnung Name", "text"],
  ["rechnung_adresse", "Rechnung Adresse", "text"],
  ["rechnung_telefon", "Rechnung Telefon", "text"],
  ["mieter_name", "Mieter Name", "text"],
  ["mieter_telefon", "Mieter Telefon", "text"],
  ["mieter_strasse", "Mieter Straße", "text"],
  ["mieter_ort", "Mieter Ort", "text"],
  ["stoerungsart", "Störungsart", "textarea"],
  ["zeit_kundenanruf", "Kundenanruf", "datetime-local"],
  ["zeit_weitergabe", "Weitergabe", "datetime-local"],
  ["monteur_weitergabe", "Monteur Weitergabe", "text"],
  ["zeit_rueckmeldung", "Rückmeldung", "datetime-local"],
  ["monteur_rueckmeldung", "Monteur Rückmeldung", "text"],
  ["diensthabender_alarmzentrale", "Diensthabender Alarmzentrale", "text"],
];
const FIELDS_BUDEKO: FieldDef[] = [
  ["anrufer_name", "Anrufer Name", "text"],
  ["anrufer_telefon", "Anrufer Telefon", "text"],
  ["anrufer_adresse", "Anrufer Adresse", "text"],
  ["anrufer_firma", "Anrufer Firma", "text"],
  ["mieter_name", "Objekt/Mieter Name", "text"],
  ["mieter_telefon", "Telefon", "text"],
  ["mieter_strasse", "Straße/Hausnummer", "text"],
  ["mieter_ort", "Ort", "text"],
  ["stoerungsart", "Störungsart", "textarea"],
  ["zeit_kundenanruf", "Kundenanruf", "datetime-local"],
  ["zeit_weitergabe", "Weitergabe", "datetime-local"],
  ["monteur_weitergabe", "Name der Bereitschaft", "text"],
  ["diensthabender_alarmzentrale", "Diensthabender Alarmzentrale", "text"],
];

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditDialog({ id, variante, onClose }: { id: string; variante: "standard" | "budeko"; onClose: () => void }) {
  const FIELDS = variante === "budeko" ? FIELDS_BUDEKO : FIELDS_STANDARD;
  const qc = useQueryClient();
  const getFn = useServerFn(getBericht);
  const updFn = useServerFn(updateBericht);
  const { data: bericht, isLoading } = useQuery({
    queryKey: ["rs-bericht", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const [f, setF] = useState<any>(null);
  if (bericht && !f) {
    const init: any = { ...bericht };
    for (const [k, , t] of FIELDS) if (t === "datetime-local") init[k] = toLocalInput(init[k]);
    setF(init);
  }

  const mut = useMutation({
    mutationFn: (data: any) => updFn({ data }),
    onSuccess: () => {
      toast.success("Gespeichert");
      qc.invalidateQueries({ queryKey: ["rs-berichte"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Bericht bearbeiten</DialogTitle></DialogHeader>
        {isLoading || !f ? (
          <div className="py-8 text-center text-muted-foreground">Lade…</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {FIELDS.map(([k, label, type]) => (
              <div key={k} className={type === "textarea" ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
                <Label className="text-xs">{label}</Label>
                {type === "textarea" ? (
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                    value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })}
                  />
                ) : (
                  <Input type={type} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={!f || mut.isPending}
            onClick={() => {
              const out: any = { id };
              for (const [k, , t] of FIELDS) {
                const v = f[k];
                if (t === "datetime-local") out[k] = v ? new Date(v).toISOString() : null;
                else out[k] = v || null;
              }
              mut.mutate(out);
            }}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}