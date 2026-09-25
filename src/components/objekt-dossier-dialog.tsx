import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { DoorOpen, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DossierAnsicht } from "@/components/objekt-dossier-view";
import { findDossierForKunde } from "@/lib/objektdossier.functions";

/**
 * Objektinfo direkt am Einsatz – zeigt das hinterlegte Objektdossier
 * (Anfahrt, Schlüssellage, Alarmplan, Kontakte) ohne die Seite zu verlassen.
 */
export function ObjektDossierDialog({
  open,
  onClose,
  kunde,
}: {
  open: boolean;
  onClose: () => void;
  kunde: { kunden_name?: string | null; key_number?: string | null; address?: string | null } | null;
}) {
  const findFn = useServerFn(findDossierForKunde);
  const [key, setKey] = useState(0);

  const { data, isFetching, error } = useQuery({
    queryKey: ["objekt-dossier-fuer-einsatz", kunde?.kunden_name ?? "", kunde?.key_number ?? "", kunde?.address ?? "", key],
    queryFn: () =>
      findFn({
        data: {
          kunden_name: kunde?.kunden_name ?? null,
          key_number: kunde?.key_number ?? null,
          address: kunde?.address ?? null,
        },
      }),
    enabled: open && !!kunde,
    staleTime: 30_000,
  });

  const dossier = (data as any)?.dossier ?? null;
  const kontakte = ((data as any)?.kontakte ?? []) as any[];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
        else setKey((k) => k + 1);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="size-4" /> Objektinfo
          </DialogTitle>
          <DialogDescription>
            Hinweise für dieses Objekt – Anfahrt, Schlüssel, Alarmplan und Kontakte.
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="grid place-items-center py-12 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Objektinfo wird geladen ...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : !dossier ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Für {kunde?.kunden_name || "dieses Objekt"} ist noch keine Objektinfo hinterlegt.
            </p>
            <Button variant="outline" size="sm" onClick={() => setKey((k) => k + 1)}>
              Erneut prüfen
            </Button>
          </div>
        ) : (
          <DossierAnsicht dossier={dossier} kontakte={kontakte} dicht />
        )}
      </DialogContent>
    </Dialog>
  );
}
