import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Boxes, Nfc, LogOut, ShieldCheck, Construction, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kioskTransponderLogin, type LagerKioskPerson } from "@/lib/lager-kiosk.functions";

export const Route = createFileRoute("/lager-station")({
  component: LagerStationPage,
  head: () => ({
    meta: [
      { title: "Lager-Station – Transponder-Anmeldung" },
      { name: "description", content: "Eigenständige Lager-Station: Anmeldung ausschließlich per Transponder, unabhängig vom AlarmDesk-Login." },
      { property: "og:title", content: "Lager-Station – Transponder-Anmeldung" },
      { property: "og:description", content: "Eigenständige Lager-Station: Anmeldung ausschließlich per Transponder, unabhängig vom AlarmDesk-Login." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STORAGE_KEY = "lager-station-person";

function LagerStationPage() {
  const [person, setPerson] = useState<LagerKioskPerson | null>(null);
  const [ready, setReady] = useState(false);

  // Eigene, vom AlarmDesk getrennte Sitzung der Lager-Station
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPerson(JSON.parse(raw) as LagerKioskPerson);
    } catch {
      /* ignore */
    }
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
    } finally {
      setBusy(false);
    }
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

function StationHome({ person, onLogout }: { person: LagerKioskPerson; onLogout: () => void }) {
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

      <div className="rounded-xl border border-border bg-card p-12 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="mx-auto size-14 rounded-full bg-muted grid place-items-center">
          <Construction className="size-6 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Lagerbereich in Vorbereitung</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Der Transponder-Login steht bereit. Die Lagerfunktionen (Artikel, Entnahmen, Bestände)
          werden hier Schritt für Schritt ergänzt.
        </p>
      </div>
    </main>
  );
}
