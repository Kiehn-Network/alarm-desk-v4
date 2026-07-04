import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText, Loader2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listDateienForEinsatz } from "@/lib/einsaetze.functions";
import { FilePreviewDialog } from "@/components/file-preview-dialog";

export function EinsatzDateienDialog({
  einsatzId, open, onClose,
}: { einsatzId: string | null; open: boolean; onClose: () => void }) {
  const list = useServerFn(listDateienForEinsatz);
  const { data, isLoading } = useQuery({
    queryKey: ["einsatz-dateien", einsatzId],
    queryFn: () => list({ data: { einsatz_id: einsatzId! } }),
    enabled: open && !!einsatzId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const dateien = (data?.dateien ?? []) as any[];
  const [preview, setPreview] = useState<{ path: string; name: string; mime?: string | null } | null>(null);

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kunden-Dateien</DialogTitle>
          <DialogDescription>Treffer anhand Kunde, Adresse, Schlüssel, Anlage oder TN.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Lade…
          </div>
        ) : dateien.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Keine passenden Dateien gefunden.</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {dateien.map((d) => (
              <li key={d.id} className="py-2.5 space-y-1.5">
                <div className="flex items-center gap-3">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.filename}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[d.kunden_name, d.address, d.key_number && `🔑 ${d.key_number}`, d.anlagen_nr && `🏷️ ${d.anlagen_nr}`]
                        .filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {d.storage_path && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => setPreview({ path: d.storage_path, name: d.filename, mime: d.mime_type })}
                    >
                      <Eye className="size-4" /> Ansehen
                    </Button>
                  )}
                </div>
                {d.notiz && (
                  <div className="ml-7 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 flex gap-2">
                    <Info className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs whitespace-pre-wrap text-foreground/90">{d.notiz}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
    {preview && einsatzId && (
      <FilePreviewDialog
        open={!!preview}
        onClose={() => setPreview(null)}
        storagePath={preview.path}
        filename={preview.name}
        mimeType={preview.mime}
        einsatzId={einsatzId}
        noDownload
      />
    )}
    </>
  );
}