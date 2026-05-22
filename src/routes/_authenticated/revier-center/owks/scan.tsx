import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { recordScan } from "@/lib/owks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ScanLine, Smartphone, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/revier-center/owks/scan")({
  component: ScanSeite,
});

function ScanSeite() {
  const fn = useServerFn(recordScan);
  const [uid, setUid] = useState("");
  const [notiz, setNotiz] = useState("");
  const [last, setLast] = useState<any>(null);
  const [scanning, setScanning] = useState(false);

  const submit = useMutation({
    mutationFn: async (overrideUid?: string) => {
      const pos = await new Promise<GeolocationPosition | null>((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition((p) => res(p), () => res(null), { timeout: 3000 });
      });
      return fn({ data: {
        nfc_uid: overrideUid ?? uid,
        notiz: notiz || null,
        lat: pos?.coords.latitude ?? null,
        lng: pos?.coords.longitude ?? null,
      } });
    },
    onSuccess: (res) => { setLast(res); setNotiz(""); setUid(""); toast.success(`Scan erfasst: ${res.kontrollpunkt.bezeichnung}`); },
    onError: (e: any) => toast.error(e.message ?? "Scan fehlgeschlagen"),
  });

  async function startNfcScan() {
    const NDEFReaderCtor = (window as any).NDEFReader;
    if (!NDEFReaderCtor) { toast.error("Web-NFC nicht verfügbar (Chrome/Android über HTTPS)"); return; }
    try {
      setScanning(true);
      const reader = new NDEFReaderCtor();
      await reader.scan();
      toast.info("Tag an Gerät halten…");
      reader.onreading = (e: any) => {
        const serial = e.serialNumber;
        setUid(serial);
        submit.mutate(serial);
      };
    } catch (err: any) { toast.error(err.message ?? "NFC-Scan fehlgeschlagen"); setScanning(false); }
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div className="text-center pt-4">
        <Smartphone className="size-10 mx-auto text-primary" />
        <h2 className="text-lg font-semibold mt-2">NFC-Scan</h2>
        <p className="text-xs text-muted-foreground">Tag an dein Gerät halten oder UID manuell eingeben.</p>
      </div>
      <Button className="w-full" size="lg" onClick={startNfcScan} disabled={scanning}>
        <ScanLine className="size-5 mr-2" />
        {scanning ? "Scan läuft…" : "NFC-Tag scannen"}
      </Button>
      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-medium uppercase text-muted-foreground">Manuell</div>
        <Input placeholder="NFC-UID" value={uid} onChange={(e) => setUid(e.target.value)} />
        <Textarea placeholder="Notiz (optional)" value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} />
        <Button className="w-full" onClick={() => submit.mutate()} disabled={!uid || submit.isPending}>Erfassen</Button>
      </div>
      {last && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-center gap-3">
          <CheckCircle2 className="size-6 text-green-500" />
          <div>
            <div className="text-sm font-medium">{last.kontrollpunkt.bezeichnung}</div>
            {last.kontrollpunkt.raum && <div className="text-xs text-muted-foreground">{last.kontrollpunkt.raum}</div>}
          </div>
        </div>
      )}
    </div>
  );
}