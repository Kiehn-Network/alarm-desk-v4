import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Info, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listDateienForEinsatz } from "@/lib/einsaetze.functions";

export function KundenInfoDialog({
  einsatzId, open, onClose,
}: { einsatzId: string | null; open: boolean; onClose: () => void }) {
  const list = useServerFn(listDateienForEinsatz);
  const { data, isLoading } = useQuery({
    queryKey: ["einsatz-kunden-info", einsatzId],
    queryFn: () => list({ data: { einsatz_id: einsatzId! } }),
    enabled: open && !!einsatzId,
  });
  const dateien = ((data?.dateien ?? []) as any[]).filter((d) => d.notiz && String(d.notiz).trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Info className="size-4 text-amber-500" /> Kunden-Hinweise</DialogTitle>
          <DialogDescription>Hinterlegte Notizen aus den Kunden-Dateien.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Lade…
          </div>
        ) : dateien.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Keine Notizen hinterlegt.</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto space-y-3">
            {dateien.map((d) => (
              <li key={d.id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="text-xs text-muted-foreground mb-1.5">
                  {[d.kunden_name, d.address, d.key_number && `🔑 ${d.key_number}`, d.anlagen_nr && `🏷️ ${d.anlagen_nr}`]
                    .filter(Boolean).join(" · ") || d.filename}
                </div>
                <p className="text-sm whitespace-pre-wrap text-foreground/90">{d.notiz}</p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}