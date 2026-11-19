import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FahrzeugSkizze, type SkizzenMarker } from "@/components/fahrzeug-skizze";
import { listFahrerFahrzeuge, meldeFahrerSchaden, SCHADEN_SCHWERE } from "@/lib/fuhrpark.functions";

export function FahrzeugSchadenButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Car className="size-4" /> Fahrzeug
      </Button>
      {open && <SchadenDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SchadenDialog({ onClose }: { onClose: () => void }) {
  const listFn = useServerFn(listFahrerFahrzeuge);
  const meldeFn = useServerFn(meldeFahrerSchaden);
  const { data, isLoading } = useQuery({ queryKey: ["fahrer-fahrzeuge"], queryFn: () => listFn() });
  const [fahrzeugId, setFahrzeugId] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [schwere, setSchwere] = useState("leicht");
  const [marker, setMarker] = useState<SkizzenMarker | null>(null);
  const [busy, setBusy] = useState(false);
  const fahrzeuge = data?.fahrzeuge ?? [];

  async function senden() {
    if (!fahrzeugId) return toast.error("Bitte ein Fahrzeug auswählen.");
    if (!beschreibung.trim()) return toast.error("Bitte den Schaden beschreiben.");
    setBusy(true);
    try {
      await meldeFn({ data: { fahrzeug_id: fahrzeugId, beschreibung: beschreibung.trim(), schwere, marker } });
      toast.success("Schaden gemeldet – die Zentrale wurde benachrichtigt.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fahrzeugschaden melden</DialogTitle>
          <DialogDescription>Fahrzeug wählen, Schaden auf der Skizze markieren und kurz beschreiben.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin" /></div>
        ) : fahrzeuge.length === 0 ? (
          <p className="text-sm text-muted-foreground">Es sind noch keine Fahrzeuge für Fahrer freigegeben. Bitte an die Zentrale wenden.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Fahrzeug</Label>
              <Select value={fahrzeugId} onValueChange={setFahrzeugId}>
                <SelectTrigger><SelectValue placeholder="Fahrzeug auswählen" /></SelectTrigger>
                <SelectContent>
                  {fahrzeuge.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.kennzeichen}{f.bezeichnung || f.marke ? ` · ${[f.bezeichnung, f.marke, f.modell].filter(Boolean).join(" ")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FahrzeugSkizze marker={marker} onChange={setMarker} />
            <div className="space-y-1">
              <Label className="text-xs">Schwere</Label>
              <Select value={schwere} onValueChange={setSchwere}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCHADEN_SCHWERE.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Beschreibung</Label>
              <Textarea rows={3} value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} placeholder="z. B. Kratzer an der Fahrertür" />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          {fahrzeuge.length > 0 && (
            <Button onClick={senden} disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />} Schaden melden
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
