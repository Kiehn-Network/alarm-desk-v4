import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Boxes, Nfc, LogOut, Plus, Pencil, Trash2, ShieldCheck, Construction, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import {
  lagerTransponderLogin, listLagerPersonen, upsertLagerPerson, deleteLagerPerson,
  type LagerPerson,
} from "@/lib/lager.functions";

export const Route = createFileRoute("/_authenticated/lager")({
  component: LagerPage,
  head: () => ({
    meta: [
      { title: "Lager – AlarmDesk" },
      { name: "description", content: "Lagermodul mit Transponder-Login für Mitarbeitende und Verwaltung der Lager-Transponder." },
      { property: "og:title", content: "Lager – AlarmDesk" },
      { property: "og:description", content: "Lagermodul mit Transponder-Login für Mitarbeitende und Verwaltung der Lager-Transponder." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function LagerPage() {
  const [person, setPerson] = useState<LagerPerson | null>(null);
  if (!person) return <LagerLogin onLogin={setPerson} />;
  return <LagerHome person={person} onLogout={() => setPerson(null)} />;
}

// ------------------------------------------------------------------
// Transponder-Login (USB-Leser tippt die ID + Enter ins Feld)
// ------------------------------------------------------------------
function LagerLogin({ onLogin }: { onLogin: (p: LagerPerson) => void }) {
  const login = useServerFn(lagerTransponderLogin);
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
    <div className="min-h-full grid place-items-center p-6 lg:p-8">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="mx-auto size-16 rounded-2xl bg-primary/10 grid place-items-center">
            <Nfc className="size-8 text-primary" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Lager-Anmeldung</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transponder an den Leser halten. Die Anmeldung erfolgt automatisch.
          </p>

          <form
            className="mt-6 space-y-3 text-left"
            onSubmit={(e) => { e.preventDefault(); submit(code); }}
          >
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
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Lager-Bereich nach dem Login (Platzhalter + Admin-Verwaltung)
// ------------------------------------------------------------------
function LagerHome({ person, onLogout }: { person: LagerPerson; onLogout: () => void }) {
  const { isAdmin } = useRole();
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="size-11 rounded-xl bg-primary/10 grid place-items-center">
          <Boxes className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Lager</h1>
          <p className="text-sm text-muted-foreground">
            Angemeldet als <span className="font-medium text-foreground">{person.name}</span>
            {person.personalnummer ? ` · Pers.-Nr. ${person.personalnummer}` : ""}
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

      {isAdmin && <PersonenPanel />}
    </div>
  );
}

const EMPTY = { name: "", personalnummer: "", transponder_id: "", aktiv: true, notiz: "" };

function PersonenPanel() {
  const qc = useQueryClient();
  const load = useServerFn(listLagerPersonen);
  const save = useServerFn(upsertLagerPerson);
  const del = useServerFn(deleteLagerPerson);
  const [edit, setEdit] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lager-personen"],
    queryFn: () => load({ data: {} } as any),
  });
  const rows = data?.rows ?? [];

  async function handleSave() {
    try {
      await save({ data: edit } as any);
      toast.success("Gespeichert");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["lager-personen"] });
    } catch (e: any) { toast.error(e?.message ?? "Fehler beim Speichern"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Diese Lager-Person wirklich löschen?")) return;
    try {
      await del({ data: { id } } as any);
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["lager-personen"] });
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Lager-Personen &amp; Transponder</CardTitle>
        <Button size="sm" onClick={() => setEdit({ ...EMPTY })}>
          <Plus className="size-4" /> Person
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Lade…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Noch keine Lager-Personen angelegt. Lege eine Person mit ihrer Transponder-Nummer an.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Pers.-Nr.</th>
                  <th className="py-2 pr-3">Transponder</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Letzter Login</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r: LagerPerson) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.personalnummer ?? "–"}</td>
                    <td className="py-2 pr-3 font-mono">{r.transponder_id}</td>
                    <td className="py-2 pr-3">
                      {r.aktiv ? <Badge variant="secondary">aktiv</Badge> : <Badge variant="destructive">gesperrt</Badge>}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{fmt(r.last_login_at)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => setEdit({
                        id: r.id, name: r.name, personalnummer: r.personalnummer ?? "",
                        transponder_id: r.transponder_id, aktiv: r.aktiv, notiz: r.notiz ?? "",
                      })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Person bearbeiten" : "Neue Lager-Person"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <div>
                <Label>Personalnummer</Label>
                <Input value={edit.personalnummer} onChange={(e) => setEdit({ ...edit, personalnummer: e.target.value })} />
              </div>
              <div>
                <Label>Transponder-Nummer</Label>
                <Input
                  className="font-mono"
                  placeholder="Transponder am Leser scannen"
                  value={edit.transponder_id}
                  onChange={(e) => setEdit({ ...edit, transponder_id: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">Aktiv</span>
                <Switch checked={edit.aktiv} onCheckedChange={(v) => setEdit({ ...edit, aktiv: v })} />
              </div>
              <div>
                <Label>Notiz</Label>
                <Textarea rows={2} value={edit.notiz} onChange={(e) => setEdit({ ...edit, notiz: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Abbrechen</Button>
            <Button onClick={handleSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
