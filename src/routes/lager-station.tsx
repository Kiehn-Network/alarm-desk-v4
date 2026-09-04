import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Boxes, Nfc, LogOut, ShieldCheck, Loader2, ScanLine, ArrowLeft,
  ArrowDownToLine, ArrowUpFromLine, CheckCircle2, PenLine, AlertTriangle, Camera,
  Trash2, Car, Building2, Plus, Minus, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SignatureField } from "@/components/signature-field";
import { BarcodeScannerDialog } from "@/components/barcode-scanner-dialog";
import {
  kioskTransponderLogin, kioskFindArtikel, kioskBuchenBatch, kioskFindFahrzeug,
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

type Step = "scan" | "ziel" | "checkout" | "fertig";

const STEP_LABEL: Record<Step, string> = {
  scan: "1. Artikel scannen",
  ziel: "2. Auto oder Projekt",
  checkout: "3. Checkout",
  fertig: "Fertig",
};

type CartItem = { artikel: LagerKioskArtikel; menge: number };

function StationHome({ person, onLogout }: { person: LagerKioskPerson; onLogout: () => void }) {
  const findArtikel = useServerFn(kioskFindArtikel);
  const buchenBatch = useServerFn(kioskBuchenBatch);

  const [step, setStep] = useState<Step>("scan");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ziel, setZiel] = useState<"auto" | "projekt" | null>(null);
  const [zielBezeichnung, setZielBezeichnung] = useState("");
  const [richtung, setRichtung] = useState<"eingang" | "ausgang">("ausgang");
  const [notiz, setNotiz] = useState("");
  const [signatur, setSignatur] = useState<string | null>(null);
  const [result, setResult] = useState<{ anzahl: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [camOpen, setCamOpen] = useState(false);

  useEffect(() => { if (step === "scan") setTimeout(() => scanRef.current?.focus(), 80); }, [step]);

  function resetFlow() {
    setCart([]); setZiel(null); setZielBezeichnung(""); setRichtung("ausgang");
    setNotiz(""); setSignatur(null); setResult(null); setError(null); setCode(""); setStep("scan");
  }

  function setMenge(artikelId: string, menge: number) {
    setCart((prev) => prev.map((it) => (it.artikel.id === artikelId ? { ...it, menge: Math.max(1, menge) } : it)));
  }

  function removeItem(artikelId: string) {
    setCart((prev) => prev.filter((it) => it.artikel.id !== artikelId));
  }

  async function handleScan(value: string) {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await findArtikel({ data: { person_id: person.id, barcode: v } } as any);
      const found = res.artikel;
      setCart((prev) => {
        const exists = prev.find((it) => it.artikel.id === found.id);
        if (exists) return prev.map((it) => (it.artikel.id === found.id ? { ...it, menge: it.menge + 1 } : it));
        return [...prev, { artikel: found, menge: 1 }];
      });
      toast.success(`${found.bezeichnung} hinzugefügt`);
      scanRef.current?.focus();
    } catch (e: any) {
      setError(e?.message ?? "Artikel nicht gefunden");
      setCode("");
      scanRef.current?.focus();
    } finally { setBusy(false); }
  }

  async function handleBuchen() {
    if (cart.length === 0 || !ziel) return;
    setBusy(true); setError(null);
    try {
      const res = await buchenBatch({
        data: {
          person_id: person.id,
          richtung,
          ziel,
          ziel_bezeichnung: zielBezeichnung.trim() || null,
          signatur,
          notiz: notiz.trim() || null,
          positionen: cart.map((it) => ({ artikel_id: it.artikel.id, menge: it.menge })),
        },
      } as any);
      setResult({ anzahl: res.anzahl });
      setStep("fertig");
      toast.success("Buchung gespeichert");
    } catch (e: any) {
      setError(e?.message ?? "Buchung fehlgeschlagen");
    } finally { setBusy(false); }
  }

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
            <div className="space-y-5">
              <form onSubmit={(e) => { e.preventDefault(); handleScan(code); }} className="space-y-4 text-center">
                <div className="mx-auto size-14 rounded-2xl bg-primary/10 grid place-items-center">
                  <ScanLine className="size-7 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Mehrere Artikel nacheinander scannen – mit Handscanner oder Kamera.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    ref={scanRef}
                    value={code}
                    autoComplete="off"
                    placeholder="Barcode scannen …"
                    className="h-14 flex-1 text-center font-mono text-lg tracking-widest"
                    onChange={(e) => { setCode(e.target.value); setError(null); }}
                    onBlur={() => { if (!camOpen) setTimeout(() => { if (!camOpen) scanRef.current?.focus(); }, 50); }}
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="size-14 shrink-0"
                    aria-label="Mit Kamera scannen"
                    title="Mit Kamera scannen"
                    onClick={() => setCamOpen(true)}
                    disabled={busy}
                  >
                    <Camera className="size-6" />
                  </Button>
                </div>
                <Button type="submit" className="w-full h-12" disabled={busy || !code.trim()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Zur Liste hinzufügen
                </Button>
                <BarcodeScannerDialog
                  open={camOpen}
                  onOpenChange={setCamOpen}
                  onDetected={(value) => { setCode(value); handleScan(value); }}
                />
              </form>

              <CartList cart={cart} onMenge={setMenge} onRemove={removeItem} />

              <Button className="w-full h-12" disabled={cart.length === 0} onClick={() => setStep("ziel")}>
                Weiter ({cart.length} {cart.length === 1 ? "Artikel" : "Artikel"})
              </Button>
            </div>
          )}

          {step === "ziel" && (
            <div className="space-y-5">
              <CartList cart={cart} onMenge={setMenge} onRemove={removeItem} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant={ziel === "auto" ? "default" : "outline"}
                  className="h-24 text-base flex-col gap-1"
                  onClick={() => setZiel("auto")}
                >
                  <Car className="size-6" /> Auto
                </Button>
                <Button
                  variant={ziel === "projekt" ? "default" : "outline"}
                  className="h-24 text-base flex-col gap-1"
                  onClick={() => setZiel("projekt")}
                >
                  <Building2 className="size-6" /> Projekt
                </Button>
              </div>
              {ziel && (
                <div>
                  <Label>{ziel === "auto" ? "Fahrzeug (optional)" : "Projekt (optional)"}</Label>
                  <Input
                    value={zielBezeichnung}
                    onChange={(e) => setZielBezeichnung(e.target.value)}
                    placeholder={ziel === "auto" ? "z. B. HH-AD 123" : "z. B. Objekt Musterstraße"}
                    className="h-11"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("scan")}>
                  <ArrowLeft className="size-4" /> Zurück
                </Button>
                <Button className="flex-1" disabled={!ziel} onClick={() => setStep("checkout")}>Weiter zum Checkout</Button>
              </div>
            </div>
          )}

          {step === "checkout" && (
            <div className="space-y-5">
              <CartList cart={cart} onMenge={setMenge} onRemove={removeItem} readOnly />
              <Badge variant="secondary" className="text-sm">
                {ziel === "auto" ? "Auto" : "Projekt"}{zielBezeichnung.trim() ? ` · ${zielBezeichnung.trim()}` : ""}
              </Badge>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant={richtung === "eingang" ? "default" : "outline"}
                  className="h-20 text-base"
                  onClick={() => setRichtung("eingang")}
                >
                  <ArrowDownToLine className="size-5" /> Eingang
                </Button>
                <Button
                  variant={richtung === "ausgang" ? "default" : "outline"}
                  className="h-20 text-base"
                  onClick={() => setRichtung("ausgang")}
                >
                  <ArrowUpFromLine className="size-5" /> Ausgang
                </Button>
              </div>

              <div>
                <Label>Notiz (optional)</Label>
                <Textarea rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Auftragsnummer" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                  <PenLine className="size-4" /> Unterschrift ist optional – die Buchung geht auch ohne.
                </p>
                <SignatureField label="Unterschrift" value={signatur} onChange={(v) => setSignatur(v)} who={person.name} />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("ziel")}>
                  <ArrowLeft className="size-4" /> Zurück
                </Button>
                <Button className="flex-1" onClick={handleBuchen} disabled={busy || cart.length === 0}>
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
                  {result.anzahl} {result.anzahl === 1 ? "Artikel" : "Artikel"} gebucht.
                </p>
              </div>
              <Button className="w-full h-12" onClick={resetFlow}>
                <ScanLine className="size-4" /> Neue Buchung starten
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function CartList({
  cart, onMenge, onRemove, readOnly = false,
}: {
  cart: CartItem[];
  onMenge: (id: string, menge: number) => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}) {
  if (cart.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Noch keine Artikel gescannt.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium flex items-center gap-2">
        <ListChecks className="size-4" /> Gescannte Artikel ({cart.length})
      </div>
      {cart.map((it) => (
        <div key={it.artikel.id} className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{it.artikel.bezeichnung}</div>
            <div className="text-xs text-muted-foreground font-mono">{it.artikel.barcode}</div>
            <div className="text-xs text-muted-foreground">Bestand: {it.artikel.bestand} {it.artikel.einheit}</div>
          </div>
          {readOnly ? (
            <Badge variant="secondary">{it.menge} {it.artikel.einheit}</Badge>
          ) : (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-9" aria-label="Menge verringern" onClick={() => onMenge(it.artikel.id, it.menge - 1)}>
                <Minus className="size-4" />
              </Button>
              <Input
                type="number"
                min={1}
                className="h-9 w-16 text-center"
                value={it.menge}
                onChange={(e) => onMenge(it.artikel.id, Number(e.target.value) || 1)}
              />
              <Button variant="outline" size="icon" className="size-9" aria-label="Menge erhöhen" onClick={() => onMenge(it.artikel.id, it.menge + 1)}>
                <Plus className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-9 text-destructive" aria-label="Artikel entfernen" onClick={() => onRemove(it.artikel.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
