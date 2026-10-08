import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Nfc, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { pruefeFid, meldeFund } from "@/lib/findo.functions";

export const Route = createFileRoute("/findo")({
  validateSearch: (s: Record<string, unknown>) => ({ fid: typeof s.fid === "string" ? s.fid : undefined }),
  head: () => ({
    meta: [
      { title: "Findo-ID – Schlüssel gefunden?" },
      { name: "description", content: "Schlüssel mit Findo-ID Anhänger gefunden? FID eingeben und den Fund in wenigen Sekunden melden." },
      { property: "og:title", content: "Findo-ID – Schlüssel gefunden?" },
      { property: "og:description", content: "Fund melden – ohne die Daten des Besitzers zu kennen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FundSeite,
});

function FundSeite() {
  const { fid: start } = Route.useSearch();
  const pruefe = useServerFn(pruefeFid);
  const melde = useServerFn(meldeFund);
  const [fid, setFid] = useState(start ?? "");
  const [stelle, setStelle] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  const [f, setF] = useState({ finder_name: "", finder_kontakt: "", fundort: "", nachricht: "", sendet_per_post: false });
  const [busy, setBusy] = useState(false);
  const [fertig, setFertig] = useState(false);

  async function check() {
    setBusy(true); setFehler(false);
    try { const r = await pruefe({ data: { fid } }); if (r.gefunden) setStelle(r.stelle); else setFehler(true); }
    catch { setFehler(true); } finally { setBusy(false); }
  }
  async function senden() {
    setBusy(true);
    try { await melde({ data: { fid, ...f } }); setFertig(true); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto max-w-md space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="text-center">
          <Nfc className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-2 text-2xl font-bold">Schlüssel gefunden?</h1>
          <p className="text-sm text-muted-foreground">Gib die FID / UID von der Rückseite des Anhängers ein. Die Daten des Besitzers bleiben geschützt.</p>
        </div>

        {fertig ? (
          <div className="space-y-2 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <p className="font-medium">Danke! Dein Fund wurde gemeldet.</p>
            <p className="text-sm text-muted-foreground">{stelle} kümmert sich um die Rückgabe. {f.sendet_per_post && "Bitte sende den Schlüssel gut verpackt an die Adresse auf dem Anhänger."}</p>
          </div>
        ) : !stelle ? (
          <div className="space-y-3">
            <Label htmlFor="fid">FID / UID</Label>
            <Input id="fid" className="font-mono" placeholder="04 A8 7C 92 6F 13 80" value={fid} onChange={(e) => setFid(e.target.value)} />
            {fehler && <p className="flex items-center gap-1 text-sm text-destructive"><XCircle className="h-4 w-4" />Diese FID ist nicht bekannt. Bitte Eingabe prüfen.</p>}
            <Button className="w-full" disabled={busy || fid.trim().length < 4} onClick={check}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}FID prüfen</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="rounded-md bg-primary/10 p-3 text-sm">Anhänger erkannt – zuständig ist <b>{stelle}</b>.</p>
            <div><Label>Wo hast du ihn gefunden?</Label><Input value={f.fundort} onChange={(e) => setF({ ...f, fundort: e.target.value })} /></div>
            <div><Label>Dein Name (optional)</Label><Input value={f.finder_name} onChange={(e) => setF({ ...f, finder_name: e.target.value })} /></div>
            <div><Label>Telefon oder E-Mail für Rückfragen (optional)</Label><Input value={f.finder_kontakt} onChange={(e) => setF({ ...f, finder_kontakt: e.target.value })} /></div>
            <div><Label>Nachricht (optional)</Label><Textarea value={f.nachricht} onChange={(e) => setF({ ...f, nachricht: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.sendet_per_post} onCheckedChange={(v) => setF({ ...f, sendet_per_post: !!v })} />Ich schicke den Schlüssel per Post</label>
            <Button className="w-full" disabled={busy} onClick={senden}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Fund melden</Button>
          </div>
        )}
      </div>
    </div>
  );
}
