import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getZeitstrahl, updateBestreifung, deleteBestreifung } from "@/lib/owks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/revier-center/owks/zeitstrahl")({
  component: ZeitstrahlSeite,
});

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmt(d: Date) { return d.toISOString().slice(0, 10); }

function ZeitstrahlSeite() {
  const qc = useQueryClient();
  const [start, setStart] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; });
  const days = 7;
  const von = fmt(start);
  const bis = fmt(addDays(start, days - 1));
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start]);

  const fn = useServerFn(getZeitstrahl);
  const upFn = useServerFn(updateBestreifung);
  const delFn = useServerFn(deleteBestreifung);
  const q = useQuery({ queryKey: ["owks-zeitstrahl", von, bis], queryFn: () => fn({ data: { von, bis } }) });

  const [selected, setSelected] = useState<any | null>(null);
  const save = useMutation({
    mutationFn: (patch: any) => upFn({ data: { id: selected.id, ...patch } }),
    onSuccess: () => { toast.success("Aktualisiert"); setSelected(null); qc.invalidateQueries({ queryKey: ["owks-zeitstrahl"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { setSelected(null); qc.invalidateQueries({ queryKey: ["owks-zeitstrahl"] }); },
  });

  const objekte = q.data?.objekte ?? [];
  const rundgaenge = q.data?.rundgaenge ?? [];
  const bestreifungen = q.data?.bestreifungen ?? [];

  // group bestreifungen by rundgang_id, then by date
  const byRg = new Map<string, Map<string, any[]>>();
  for (const b of bestreifungen as any[]) {
    if (!byRg.has(b.rundgang_id)) byRg.set(b.rundgang_id, new Map());
    const m = byRg.get(b.rundgang_id)!;
    const k = b.datum;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(b);
  }

  function statusColor(s: string) {
    return s === "erledigt" ? "bg-green-500/80" :
           s === "aktiv" ? "bg-amber-500/80" :
           s === "versaeumt" ? "bg-red-500/80" :
           s === "storniert" ? "bg-muted-foreground/40" :
           "bg-primary/70";
  }

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Zeitstrahl · {dayList[0].toLocaleDateString("de-DE")} – {dayList[days-1].toLocaleDateString("de-DE")}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, -7))}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setStart(d); }}>Heute</Button>
          <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, 7))}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid sticky top-0 bg-muted/60 text-xs font-medium border-b border-border" style={{ gridTemplateColumns: `200px repeat(${days}, 1fr)` }}>
            <div className="p-2">Rundgang</div>
            {dayList.map((d) => (
              <div key={d.toISOString()} className="p-2 text-center border-l border-border">
                {d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
              </div>
            ))}
          </div>
          {rundgaenge.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">Keine Rundgänge im Zeitraum.</div>
          )}
          {rundgaenge.map((rg: any) => {
            const obj = objekte.find((o: any) => o.id === rg.objekt_id);
            return (
              <div key={rg.id} className="grid border-b border-border" style={{ gridTemplateColumns: `200px repeat(${days}, 1fr)` }}>
                <div className="p-2 text-sm">
                  <div className="font-medium">{rg.name}</div>
                  {obj && <div className="text-xs text-muted-foreground">{obj.name}</div>}
                </div>
                {dayList.map((d) => {
                  const k = fmt(d);
                  const items = byRg.get(rg.id)?.get(k) ?? [];
                  return (
                    <div key={k} className="p-1 border-l border-border min-h-[60px] space-y-1">
                      {items.map((b: any) => (
                        <button key={b.id} onClick={() => setSelected(b)}
                          className={`w-full text-left text-[10px] px-1.5 py-1 rounded text-white ${statusColor(b.status)} hover:opacity-90`}>
                          {new Date(b.zeit_von).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–
                          {new Date(b.zeit_bis).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                          <span className="ml-1 opacity-80">({b.durchgaenge_ist}/{b.durchgaenge_soll})</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bestreifung bearbeiten</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Start</Label><Input type="datetime-local" defaultValue={new Date(selected.zeit_von).toISOString().slice(0,16)} onChange={(e) => setSelected({ ...selected, zeit_von: new Date(e.target.value).toISOString() })} /></div>
                <div><Label>Ende</Label><Input type="datetime-local" defaultValue={new Date(selected.zeit_bis).toISOString().slice(0,16)} onChange={(e) => setSelected({ ...selected, zeit_bis: new Date(e.target.value).toISOString() })} /></div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={selected.status} onValueChange={(v) => setSelected({ ...selected, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geplant">Geplant</SelectItem>
                    <SelectItem value="aktiv">Aktiv</SelectItem>
                    <SelectItem value="erledigt">Erledigt</SelectItem>
                    <SelectItem value="versaeumt">Versäumt</SelectItem>
                    <SelectItem value="storniert">Storniert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notizen</Label><Textarea value={selected.notizen ?? ""} onChange={(e) => setSelected({ ...selected, notizen: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => confirm("Löschen?") && del.mutate(selected.id)}>Löschen</Button>
            <Button onClick={() => save.mutate({ zeit_von: selected.zeit_von, zeit_bis: selected.zeit_bis, status: selected.status, notizen: selected.notizen })} disabled={save.isPending}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}