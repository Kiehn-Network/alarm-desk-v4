import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Boxes, Nfc, LogOut, ShieldCheck, Loader2, ScanLine, ArrowLeft,
  ArrowDownToLine, ArrowUpFromLine, CheckCircle2, PenLine, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SignatureField } from "@/components/signature-field";
import {
  kioskTransponderLogin, kioskFindArtikel, kioskBuchen,
  type LagerKioskPerson, type LagerKioskArtikel,
} from "@/lib/lager-kiosk.functions";

export const Route = createFileRoute("/lager-station")({
  component: LagerStationPage,
  head: () => ({
    meta: [
      { title: "Lager-Station – Transponder-Anmeldung" },
      { name: "description", content: "Eigenständige Lager-Station: Anmeldung per Transponder, Artikel scannen sowie Ein- und Ausbuchungen mit Unterschrift erfassen." },
      { property: "og:title", content: "Lager-Station – Transponder-Anmeldung" },
      { property: "og:description", content: "Eigenständige Lager-Station: Anmeldung per Transponder, Artikel scannen sowie Ein- und Ausbuchungen mit Unterschrift erfassen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STORAGE_KEY = "lager-station-person";

function LagerStationPage() {
  const [person, setPerson] = useState<LagerKioskPerson | null>(null);
  const [ready, setReady] = useState(false);

  // Die Lager-Station läuft immer im hellen Design.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.classList.contains("light") ? "light" : html.classList.contains("dark") ? "dark" : null;
    const prevTheme = html.getAttribute("data-theme");
    html.classList.remove("light", "dark");
    html.classList.add("light");
    if (!html.getAttribute("data-theme")) html.setAttribute("data-theme", "midnight");
    return () => {
      html.classList.remove("light", "dark");
      if (prev) html.classList.add(prev);
      if (prevTheme === null) html.removeAttribute("data-theme");
      else html.setAttribute("data-theme", prevTheme);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPerson(JSON.parse(raw) as LagerKioskPerson);
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  function login(p: LagerKioskPerson) {
    setPerson(p);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  }

  function logout() {
    setPerson(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  if (!ready) return null;
  if (!person) return <StationLogin onLogin={login} />;
  return <StationHome person={person} onLogout={logout} />;
}

function StationLogin({ onLogin }: { onLogin: (p: LagerKioskPerson) => void }) {
  const login = useServerFn(kioskTransponderLogin);
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit(value: string) {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await login({ data: { transponder_id: v } } as any);
      toast.success(`Willkommen, ${res.person.name}`);
      onLogin(res.person);
    } catch (e: any) {
      setError(e?.message ?? "Anmeldung fehlgeschlagen");
      setCode("");
      inputRef.current?.focus();
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="mx-auto size-16 rounded-2xl bg-primary/10 grid place-items-center">
            <Nfc className="size-8 text-primary" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Lager-Station</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transponder an den Leser halten. Die Anmeldung erfolgt automatisch.
          </p>

          <form className="mt-6 space-y-3 text-left" onSubmit={(e) => { e.preventDefault(); submit(code); }}>
            <Label htmlFor="transponder">Transponder-Nummer</Label>
            <Input
              id="transponder"
              ref={inputRef}
              value={code}
              autoComplete="off"
              placeholder="Transponder scannen …"
              className="h-12 text-center font-mono text-lg tracking-widest"
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              onBlur={() => setTimeout(() => inputRef.current?.focus(), 50)}
              disabled={busy}
            />
            <Button type="submit" className="w-full h-11" disabled={busy || !code.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Anmelden
            </Button>
          </form>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Eigenständige Lager-Anmeldung – unabhängig vom AlarmDesk-Login.
        </p>
      </div>
    </main>
  );
}

type Step = "scan" | "richtung" | "menge" | "signatur" | "fertig";

const STEP_LABEL: Record<Step, string> = {
  scan: "1. Artikel scannen",
  richtung: "2. Ein- oder Ausbuchen",
  menge: "3. Menge erfassen",
  signatur: "4. Unterschrift (optional)",
  fertig: "Fertig",
};

function StationHome({ person, onLogout }: { person: LagerKioskPerson; onLogout: () => void }) {
  const findArtikel = useServerFn(kioskFindArtikel);
  const buchen = useServerFn(kioskBuchen);

  const [step, setStep] = useState<Step>("scan");
  const [artikel, setArtikel] = useState<LagerKioskArtikel | null>(null);
  const [richtung, setRichtung] = useState<"eingang" | "ausgang">("ausgang");
  const [menge, setMenge] = useState("1");
  const [notiz, setNotiz] = useState("");
  const [signatur, setSignatur] = useState<string | null>(null);
  const [result, setResult] = useState<{ bestand: number; bezeichnung: string; einheit: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");

  useEffect(() => { if (step === "scan") setTimeout(() => scanRef.current?.focus(), 80); }, [step]);

  function resetFlow() {
    setArtikel(null); setRichtung("ausgang"); setMenge("1"); setNotiz("");
    setSignatur(null); setResult(null); setError(null); setCode(""); setStep("scan");
  }

  async function handleScan(value: string) {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await findArtikel({ data: { person_id: person.id, barcode: v } } as any);
      setArtikel(res.artikel);
      setStep("richtung");
    } catch (e: any) {
      setError(e?.message ?? "Artikel nicht gefunden");
      setCode("");
      scanRef.current?.focus();
    } finally { setBusy(false); }
  }

  async function handleBuchen() {
    if (!artikel) return;
    setBusy(true); setError(null);
    try {
      const res = await buchen({
        data: {
          person_id: person.id, artikel_id: artikel.id, richtung,
          menge: Number(menge), signatur, notiz: notiz.trim() || null,
        },
      } as any);
      setResult(res);
      setStep("fertig");
      toast.success("Buchung gespeichert");
    } catch (e: any) {
      setError(e?.message ?? "Buchung fehlgeschlagen");
    } finally { setBusy(false); }
  }

  const mengeValid = Number(menge) > 0 && Number.isFinite(Number(menge));

  return (
    <main className="min-h-screen bg-background p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="size-11 rounded-xl bg-primary/10 grid place-items-center">
          <Boxes className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Lager</h1>
          <p className="text-sm text-muted-foreground">
            Angemeldet als <span className="font-medium text-foreground">{person.name}</span>
            {person.personalnummer ? ` · Pers.-Nr. ${person.personalnummer}` : ""}
            {person.domain_name ? ` · ${person.domain_name}` : ""}
          </p>
        </div>
        <Button variant="outline" className="ml-auto" onClick={onLogout}>
          <LogOut className="size-4" /> Abmelden
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-3 text-sm font-medium text-muted-foreground">{STEP_LABEL[step]}</div>

        <div className="rounded-2xl border border-border bg-card p-6 lg:p-8" style={{ boxShadow: "var(--shadow-card)" }}>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" /> {error}
            </div>
          )}

          {step === "scan" && (
            <form onSubmit={(e) => { e.preventDefault(); handleScan(code); }} className="space-y-4 text-center">
              <div className="mx-auto size-14 rounded-2xl bg-primary/10 grid place-items-center">
                <ScanLine className="size-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Artikel-Barcode oder QR-Code scannen.</p>
              <Input
                ref={scanRef}
                value={code}
                autoComplete="off"
                placeholder="Barcode scannen …"
                className="h-14 text-center font-mono text-lg tracking-widest"
                onChange={(e) => { setCode(e.target.value); setError(null); }}
                onBlur={() => setTimeout(() => scanRef.current?.focus(), 50)}
                disabled={busy}
              />
              <Button type="submit" className="w-full h-12" disabled={busy || !code.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />} Artikel suchen
              </Button>
            </form>
          )}

          {step !== "scan" && artikel && (
            <div className="mb-5 rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div className="font-semibold">{artikel.bezeichnung}</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">{artikel.barcode}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Bestand: <span className="font-medium text-foreground">{artikel.bestand} {artikel.einheit}</span>
                {artikel.lagerort ? ` · ${artikel.lagerort}` : ""}
              </div>
            </div>
          )}

          {step === "richtung" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant={richtung === "eingang" ? "default" : "outline"}
                  className="h-20 text-base"
                  onClick={() => { setRichtung("eingang"); setStep("menge"); }}
                >
                  <ArrowDownToLine className="size-5" /> Einbuchen
                </Button>
                <Button
                  variant={richtung === "ausgang" ? "default" : "outline"}
                  className="h-20 text-base"
                  onClick={() => { setRichtung("ausgang"); setStep("menge"); }}
                >
                  <ArrowUpFromLine className="size-5" /> Ausbuchen
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={resetFlow}>
                <ArrowLeft className="size-4" /> Zurück zum Scannen
              </Button>
            </div>
          )}

          {step === "menge" && (
            <div className="space-y-4">
              <Badge variant="secondary" className="text-sm">
                {richtung === "eingang" ? "Einbuchen" : "Ausbuchen"}
              </Badge>
              <div>
                <Label>Menge</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="size-12 text-lg" onClick={() => setMenge(String(Math.max(1, Number(menge || 1) - 1)))}>–</Button>
                  <Input
                    type="number"
                    min={1}
                    className="h-12 text-center text-lg"
                    value={menge}
                    onChange={(e) => setMenge(e.target.value)}
                  />
                  <Button variant="outline" size="icon" className="size-12 text-lg" onClick={() => setMenge(String(Number(menge || 0) + 1))}>+</Button>
                </div>
              </div>
              <div>
                <Label>Notiz (optional)</Label>
                <Textarea rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Auftrag oder Fahrzeug" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("richtung")}>
                  <ArrowLeft className="size-4" /> Zurück
                </Button>
                <Button className="flex-1" disabled={!mengeValid} onClick={() => setStep("signatur")}>Weiter</Button>
              </div>
            </div>
          )}

          {step === "signatur" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <PenLine className="size-4" /> Unterschrift ist optional – die Buchung geht auch ohne.
              </p>
              <SignatureField
                label="Unterschrift"
                value={signatur}
                onChange={(v) => setSignatur(v)}
                who={person.name}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("menge")}>
                  <ArrowLeft className="size-4" /> Zurück
                </Button>
                <Button className="flex-1" onClick={handleBuchen} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Buchung abschließen
                </Button>
              </div>
            </div>
          )}

          {step === "fertig" && result && (
            <div className="space-y-4 text-center">
              <div className="mx-auto size-14 rounded-full bg-emerald-500/10 grid place-items-center">
                <CheckCircle2 className="size-7 text-emerald-500" />
              </div>
              <div>
                <div className="text-lg font-semibold">Buchung gespeichert</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.bezeichnung} · neuer Bestand: <span className="font-medium text-foreground">{result.bestand} {result.einheit}</span>
                </p>
              </div>
              <Button className="w-full h-12" onClick={resetFlow}>
                <ScanLine className="size-4" /> Nächsten Artikel scannen
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
