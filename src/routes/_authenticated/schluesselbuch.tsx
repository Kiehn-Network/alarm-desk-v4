import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, CheckSquare, Search, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/hooks/use-role";
import { AccessDenied } from "@/components/layout/access-denied";
import { listSchluesselbuch, rueckgabeBestaetigen } from "@/lib/schluesselbuch.functions";

export const Route = createFileRoute("/_authenticated/schluesselbuch")({
  component: SchluesselbuchPage,
});

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ausgegeben:      { label: "Ausgegeben",      cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  uebernommen:     { label: "Übernommen",      cls: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  rueckgabe_offen: { label: "Rückgabe offen",  cls: "bg-orange-500/15 text-orange-400 border border-orange-500/30" },
  zurueck:         { label: "Zurück",          cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
};

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function SchluesselbuchPage() {
  const { isFahrer, loading } = useRole();
  const qc = useQueryClient();
  const listFn = useServerFn(listSchluesselbuch);
  const bestaetigen = useServerFn(rueckgabeBestaetigen);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["schluesselbuch"],
    queryFn: () => listFn(),
    enabled: !loading && !isFahrer,
  });

  const [tab, setTab] = useState("offen");
  const [q, setQ] = useState("");

  const entries: any[] = data?.entries ?? [];
  const profiles: Record<string, string> = data?.profiles ?? {};

  const counts = useMemo(() => ({
    offen: entries.filter((e) => e.status !== "zurueck").length,
    rueckgabe: entries.filter((e) => e.status === "rueckgabe_offen").length,
    alle: entries.length,
  }), [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (tab === "offen") list = list.filter((e) => e.status !== "zurueck");
    else if (tab === "rueckgabe") list = list.filter((e) => e.status === "rueckgabe_offen");
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((e) =>
        [e.key_number, e.kunden_name, e.address, e.traeger_name]
          .filter(Boolean).some((v: string) => v.toLowerCase().includes(needle)));
    }
    return list;
  }, [entries, tab, q]);

  if (loading) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Lade…</div>;
  if (isFahrer) return <AccessDenied title="Kein Zugriff" message="Das Schlüsselbuch ist nicht für Fahrer freigegeben." />;

  async function doBestaetigen(id: string) {
    try {
      await bestaetigen({ data: { id } });
      toast.success("Rückgabe bestätigt");
      refetch();
      qc.invalidateQueries({ queryKey: ["schluessel-einsatz"] });
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
  }

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-6xl">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <KeyRound className="size-3.5" /> Schlüsselverwaltung
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Schlüsselbuch</h1>
        <p className="text-sm text-muted-foreground">Übersicht aller ausgegebenen Schlüssel und offenen Rückgaben.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="offen" className="gap-2">Offen <Badge variant="secondary">{counts.offen}</Badge></TabsTrigger>
            <TabsTrigger value="rueckgabe" className="gap-2">Rückgabe wartet <Badge variant="secondary">{counts.rueckgabe}</Badge></TabsTrigger>
            <TabsTrigger value="alle">Alle ({counts.alle})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative ml-auto w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen…" className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Lade…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Keine Einträge.</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => {
            const meta = STATUS_META[s.status] ?? { label: s.status, cls: "bg-muted text-muted-foreground" };
            return (
              <li key={s.id} className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                    <KeyRound className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold tabular-nums">{s.key_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="text-sm flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                      {s.kunden_name && <span className="inline-flex items-center gap-1"><User className="size-3.5" /> {s.kunden_name}</span>}
                      {s.address && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {s.address}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Träger: <span className="text-foreground/80 font-medium">{s.traeger_name}</span>
                      {" · "}Ausgabe {fmt(s.ausgegeben_at)} ({profiles[s.ausgegeben_by] ?? "—"})
                      {s.uebernommen_at && <> · Übernommen {fmt(s.uebernommen_at)}</>}
                      {s.rueckgabe_angefragt_at && <> · Rückgabe angefragt {fmt(s.rueckgabe_angefragt_at)}</>}
                      {s.zurueck_at && <> · Zurück {fmt(s.zurueck_at)} ({profiles[s.zurueck_by] ?? "—"})</>}
                    </div>
                    {s.notiz && <div className="text-xs text-muted-foreground italic">„{s.notiz}"</div>}
                  </div>
                  {s.status === "rueckgabe_offen" && (
                    <Button size="sm" onClick={() => doBestaetigen(s.id)} className="gap-1.5">
                      <CheckSquare className="size-4" /> Rückgabe bestätigen
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}