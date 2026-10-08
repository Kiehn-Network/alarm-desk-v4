import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  listNotizenForEinsatz, listNotizenForKunde, addNotizForEinsatz, deleteKundenNotiz, type KundenNotiz,
} from "@/lib/kunden-notizen.functions";
import type { KundenKennung } from "@/lib/kundenakte.functions";

const fmt = (d: string) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });

function NotizListe({ notizen, onDelete }: { notizen: KundenNotiz[]; onDelete?: (id: string) => void }) {
  if (!notizen.length) return <p className="text-sm text-muted-foreground">Noch keine Notizen zu diesem Kunden.</p>;
  return (
    <ul className="space-y-2">
      {notizen.map((n) => (
        <li key={n.id} className="rounded-lg border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm whitespace-pre-wrap flex-1">{n.text}</p>
            {onDelete && n.eigene && (
              <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Notiz löschen" onClick={() => onDelete(n.id)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{n.autor} · {fmt(n.created_at)}</div>
        </li>
      ))}
    </ul>
  );
}

/** Fahrer: Notizen zum Kunden eines Einsatzes ansehen und anlegen. */
export function KundenNotizenDialog({ einsatzId, open, onClose }: { einsatzId: string | null; open: boolean; onClose: () => void }) {
  const list = useServerFn(listNotizenForEinsatz);
  const add = useServerFn(addNotizForEinsatz);
  const del = useServerFn(deleteKundenNotiz);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const qk = ["kunden-notizen", "einsatz", einsatzId];
  const { data, isLoading } = useQuery({ queryKey: qk, queryFn: () => list({ data: { einsatzId: einsatzId! } }), enabled: open && !!einsatzId });
  const refresh = () => qc.invalidateQueries({ queryKey: ["kunden-notizen"] });

  async function speichern() {
    if (!text.trim() || !einsatzId) return;
    setBusy(true);
    try { await add({ data: { einsatzId, text } }); setText(""); toast.success("Notiz gespeichert"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Speichern fehlgeschlagen"); }
    finally { setBusy(false); }
  }
  async function loeschen(id: string) {
    if (!confirm("Notiz wirklich löschen?")) return;
    try { await del({ data: { id } }); refresh(); } catch (e: any) { toast.error(e?.message ?? "Löschen fehlgeschlagen"); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><StickyNote className="size-5" /> Notizen zum Kunden</DialogTitle>
          <DialogDescription>Bleibt beim Kunden gespeichert und ist für die Leitstelle sichtbar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3}
            placeholder="z. B. Hund im Hof, Zugang nur über Hintertür, Bewegungsmelder im Flur …" />
          <Button onClick={speichern} disabled={busy || !text.trim()} className="w-full">
            {busy && <Loader2 className="size-4 animate-spin" />} Notiz speichern
          </Button>
        </div>
        <div className="pt-2">
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <NotizListe notizen={data ?? []} onDelete={loeschen} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Leitstelle: Notizen in der Kundenakte. */
export function KundenNotizenTab({ kennung }: { kennung: KundenKennung }) {
  const list = useServerFn(listNotizenForKunde);
  const del = useServerFn(deleteKundenNotiz);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["kunden-notizen", "kunde", kennung], queryFn: () => list({ data: kennung as any }) });
  async function loeschen(id: string) {
    if (!confirm("Notiz wirklich löschen?")) return;
    try { await del({ data: { id } }); qc.invalidateQueries({ queryKey: ["kunden-notizen"] }); }
    catch (e: any) { toast.error(e?.message ?? "Löschen nicht erlaubt"); }
  }
  if (isLoading) return <Loader2 className="size-4 animate-spin" />;
  return <NotizListe notizen={(data ?? []).map((n) => ({ ...n, eigene: true }))} onDelete={loeschen} />;
}
