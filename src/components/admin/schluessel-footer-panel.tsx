import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, KeySquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSchluesselSettings, upsertSchluesselSettings } from "@/lib/schluesseluebergabe.functions";

export function SchluesselFooterPanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSchluesselSettings);
  const upFn = useServerFn(upsertSchluesselSettings);
  const q = useQuery({ queryKey: ["schluessel-settings"], queryFn: () => getFn() });

  const [firmenname, setFirmenname] = useState("");
  const [adresse, setAdresse] = useState("");
  const [kontakt, setKontakt] = useState("");

  useEffect(() => {
    const s = q.data?.settings;
    if (s) {
      setFirmenname(s.firmenname ?? "");
      setAdresse(s.footer_adresse ?? "");
      setKontakt(s.footer_kontakt ?? "");
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: () => upFn({ data: { firmenname, footer_adresse: adresse, footer_kontakt: kontakt } }),
    onSuccess: () => {
      toast.success("Footer gespeichert");
      qc.invalidateQueries({ queryKey: ["schluessel-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2">
          <KeySquare className="size-5 text-muted-foreground" />
          <div>
            <div className="font-semibold">PDF-Footer für Schlüsselprotokolle</div>
            <p className="text-xs text-muted-foreground">
              Diese Angaben erscheinen am unteren Rand jedes erstellten Schlüsselprotokoll-PDFs.
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Firmenname (fett, mittig)</Label>
            <Input value={firmenname} onChange={(e) => setFirmenname(e.target.value)} placeholder="z. B. Alarmzentrale Steinberg GmbH" />
          </div>
          <div className="space-y-1.5">
            <Label>Adresszeile</Label>
            <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Am Rosenplatz 6, 21465 Reinbek" />
          </div>
          <div className="space-y-1.5">
            <Label>Kontaktzeile</Label>
            <Input value={kontakt} onChange={(e) => setKontakt(e.target.value)} placeholder="Tel: 040 728 38 480 · info@…" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            <Save className="size-4 mr-2" /> {m.isPending ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <div className="font-medium text-foreground mb-1">Vorschau-Hinweis</div>
        Aus der Adresszeile wird automatisch der Ort für die Kopfzeile „<i>Ort, den TT.MM.JJJJ</i>" extrahiert
        (zweiter Teil hinter dem Komma, ohne Postleitzahl).
      </div>
    </div>
  );
}