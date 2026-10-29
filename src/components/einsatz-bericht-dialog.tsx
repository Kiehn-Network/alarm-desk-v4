import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { updateEinsatzBericht } from "@/lib/einsaetze.functions";
import { useRole } from "@/hooks/use-role";
import { enqueue } from "@/lib/offline-queue";
import { useOfflineQueue } from "@/hooks/use-offline-queue";

type Einsatz = any;
type BerichtTyp = "hausnotruf" | "av_einsatz";

function guessTyp(e: Einsatz): BerichtTyp {
  const grund = (e?.einsatzgrund ?? "").toLowerCase();
  if (grund.includes("hausnotruf") || grund.includes("hnr")) return "hausnotruf";
  return "av_einsatz";
}

export function EinsatzBerichtDialog({
  einsatz, open, onClose,
}: { einsatz: Einsatz | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { canManage } = useRole();
  const { online } = useOfflineQueue();
  const readonly = einsatz?.status === "abgeschlossen" && !canManage;
  const [typ, setTyp] = useState<BerichtTyp>("av_einsatz");
  const [hnProblem, setHnProblem] = useState("");
  const [hnLoesung, setHnLoesung] = useState("");
  const [av, setAv] = useState<any>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!einsatz) return;
    setTyp((einsatz.bericht_typ as BerichtTyp) ?? guessTyp(einsatz));
    setHnProblem(einsatz.hausnotruf_problem ?? einsatz.einsatzgrund ?? "");
    setHnLoesung(einsatz.hausnotruf_loesung ?? "");
    setAv(einsatz.bericht_data ?? {});
  }, [einsatz?.id, open]);

  if (!einsatz) return null;

  const set = (k: string, v: any) => setAv((p: any) => ({ ...p, [k]: v }));

  async function submit() {
    setBusy(true);
    const payload = {
      id: einsatz.id,
      bericht_typ: typ,
      bericht_data: typ === "av_einsatz" ? av : null,
      hausnotruf_problem: typ === "hausnotruf" ? hnProblem : null,
      hausnotruf_loesung: typ === "hausnotruf" ? hnLoesung : null,
    };
    try {
      if (!online) {
        enqueue({ kind: "updateEinsatzBericht", data: payload });
        toast.success("Offline – Bericht wird gesendet, sobald wieder online");
        onClose();
        return;
      }
      await updateEinsatzBericht({ data: payload });
      toast.success("Bericht gespeichert");
      qc.invalidateQueries({ queryKey: ["meine-einsaetze"] });
      qc.invalidateQueries({ queryKey: ["einsaetze"] });
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (/network|fetch|failed to fetch|load failed/i.test(msg)) {
        enqueue({ kind: "updateEinsatzBericht", data: payload });
        toast.success("Verbindung weg – Bericht wird automatisch nachgesendet");
        onClose();
      } else {
        toast.error(msg || "Fehler");
      }
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Einsatzbericht
            {readonly && (
              <span className="text-xs inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                <Lock className="size-3" /> abgeschlossen
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="truncate">
            {einsatz.einsatzgrund} {einsatz.kunden_name && `· ${einsatz.kunden_name}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={typ} onValueChange={(v) => setTyp(v as BerichtTyp)}>
          <TabsList className="w-full">
            <TabsTrigger value="hausnotruf" className="flex-1">Hausnotruf</TabsTrigger>
            <TabsTrigger value="av_einsatz" className="flex-1">AV-Einsatz</TabsTrigger>
          </TabsList>

          <TabsContent value="hausnotruf" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Problem</Label>
              <Textarea rows={4} value={hnProblem} disabled={readonly}
                onChange={(e) => setHnProblem(e.target.value)}
                placeholder="Was war das Problem beim Teilnehmer?" />
            </div>
            <div className="space-y-2">
              <Label>Problemlösung</Label>
              <Textarea rows={4} value={hnLoesung} disabled={readonly}
                onChange={(e) => setHnLoesung(e.target.value)}
                placeholder="Wie wurde das Problem gelöst?" />
            </div>
          </TabsContent>

          <TabsContent value="av_einsatz" className="space-y-5 pt-4">
            <div className="text-xs text-muted-foreground">Einsatz-ID: {einsatz.id.slice(0, 8)}</div>

            <section className="space-y-3">
              <div className="font-medium text-sm">Es wurde ausgelöst</div>
              <div className="flex flex-wrap gap-4">
                <CheckRow label="Alarm auf Linie" v={av.alarm_linie} onChange={(b) => set("alarm_linie", b)} disabled={readonly} />
                <CheckRow label="Störung auf Linie" v={av.stoerung_linie} onChange={(b) => set("stoerung_linie", b)} disabled={readonly} />
              </div>
              <Input placeholder="Linien-Nr. / Details" value={av.linie_nr ?? ""} disabled={readonly}
                onChange={(e) => set("linie_nr", e.target.value)} />
            </section>

            <section className="space-y-2">
              <Label>Fremdeinwirkung erkennbar?</Label>
              <YesNo value={av.fremdeinwirkung} onChange={(v) => set("fremdeinwirkung", v)} disabled={readonly} extra="sonstiges" />
              {av.fremdeinwirkung === "sonstiges" && (
                <Textarea rows={2} placeholder="Sonstiges…" value={av.fremdeinwirkung_text ?? ""} disabled={readonly}
                  onChange={(e) => set("fremdeinwirkung_text", e.target.value)} />
              )}
            </section>

            <section className="space-y-3">
              <div className="font-medium text-sm">Maßnahmen</div>
              <Row label="Meldung an Zentrale?"><YesNo value={av.meldung_zentrale} onChange={(v) => set("meldung_zentrale", v)} disabled={readonly} /></Row>
              <Row label="Innenkontrolle?"><YesNo value={av.innenkontrolle} onChange={(v) => set("innenkontrolle", v)} disabled={readonly} /></Row>
              <Row label="Rückstellung des Alarms?"><YesNo value={av.rueckstellung} onChange={(v) => set("rueckstellung", v)} disabled={readonly} /></Row>
              <div className="space-y-2">
                <Label>Weitere Maßnahmen</Label>
                <Textarea rows={2} value={av.weitere_massnahmen ?? ""} disabled={readonly}
                  onChange={(e) => set("weitere_massnahmen", e.target.value)} />
              </div>
            </section>

            <section className="space-y-3">
              <div className="font-medium text-sm">Scharfschaltung</div>
              <CheckRow label="Scharfschaltung durchführen" v={av.scharfschaltung} onChange={(b) => set("scharfschaltung", b)} disabled={readonly} />
              {av.scharfschaltung && (
                <Row label="Mit oder ohne Errichter?">
                  <RadioGroup value={av.errichter ?? ""} onValueChange={(v) => set("errichter", v)} className="flex gap-4" disabled={readonly}>
                    <RadioOpt id="err-mit" value="mit" label="Mit Errichter" />
                    <RadioOpt id="err-ohne" value="ohne" label="Ohne Errichter" />
                  </RadioGroup>
                </Row>
              )}
              <Row label="Außenkontrolle negativ?"><YesNo value={av.aussenkontrolle_negativ} onChange={(v) => set("aussenkontrolle_negativ", v)} disabled={readonly} /></Row>
            </section>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Schließen</Button>
          {!readonly && (
            <Button onClick={submit} disabled={busy} className="gap-1.5">
              <Save className="size-4" /> Speichern
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function CheckRow({ label, v, onChange, disabled }: { label: string; v?: boolean; onChange: (b: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={!!v} onCheckedChange={(c) => onChange(!!c)} disabled={disabled} />
      {label}
    </label>
  );
}

function YesNo({ value, onChange, disabled, extra }: { value?: string; onChange: (v: string) => void; disabled?: boolean; extra?: string }) {
  return (
    <RadioGroup value={value ?? ""} onValueChange={onChange} className="flex gap-4" disabled={disabled}>
      <RadioOpt id={`yn-${Math.random()}-ja`} value="ja" label="Ja" />
      <RadioOpt id={`yn-${Math.random()}-nein`} value="nein" label="Nein" />
      {extra && <RadioOpt id={`yn-${Math.random()}-x`} value={extra} label="Sonstiges" />}
    </RadioGroup>
  );
}

function RadioOpt({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <label htmlFor={id} className="flex items-center gap-1.5 text-sm cursor-pointer">
      <RadioGroupItem id={id} value={value} />
      {label}
    </label>
  );
}