import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, CheckSquare, Search, User, MapPin, ArrowRight, ArrowLeft, Hand, Undo2, ChevronDown } from "lucide-react";
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
        <h1 className="text-xl md:text-2xl font-bold">Schlüsselbuch</h1>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab} data-tour="sb-tabs">
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
        <ul data-tour="sb-liste" className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          {filtered.map((s) => {
            const meta = STATUS_META[s.status] ?? { label: s.status, cls: "bg-muted text-muted-foreground" };
            const isOpen = !!expanded[s.id];
            const steps = [
              { icon: ArrowRight, label: "Ausgabe",   at: s.ausgegeben_at,           by: profiles[s.ausgegeben_by] },
              { icon: Hand,       label: "Übernahme", at: s.uebernommen_at,          by: s.traeger_name },
              { icon: Undo2,      label: "Rückgabe angefragt", at: s.rueckgabe_angefragt_at, by: null },
              { icon: ArrowLeft,  label: "Zurück",    at: s.zurueck_at,              by: profiles[s.zurueck_by] },
            ];
            return (
              <li key={s.id} className="hover:bg-muted/30 transition">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [s.id]: !p[s.id] }))}
                    className="size-7 rounded-md grid place-items-center hover:bg-muted text-muted-foreground shrink-0"
                    aria-label={isOpen ? "Details schließen" : "Details öffnen"}
                  >
                    <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="flex items-center gap-2 shrink-0">
                      <KeyRound className="size-4 text-primary" />
                      <span className="text-base font-bold tabular-nums">{s.key_number}</span>
                      <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
                    </div>
                    {s.traeger_name && (
                      <span className="text-xs text-muted-foreground truncate">
                        <User className="inline size-3 mr-1 -mt-0.5" />{s.traeger_name}
                      </span>
                    )}
                    {s.kunden_name && (
                      <span className="text-xs text-muted-foreground truncate">
                        {s.kunden_name}
                      </span>
                    )}
                    {s.address && (
                      <span className="text-xs text-muted-foreground truncate hidden md:inline">
                        <MapPin className="inline size-3 mr-1 -mt-0.5" />{s.address}
                      </span>
                    )}
                  </div>
                  {s.status === "rueckgabe_offen" && (
                    <Button size="sm" onClick={() => doBestaetigen(s.id)} className="gap-1.5 h-8 shrink-0">
                      <CheckSquare className="size-3.5" /> Rückgabe
                    </Button>
                  )}
                </div>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 bg-muted/20">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {steps.map((step, i) => {
                        const Icon = step.icon;
                        const done = !!step.at;
                        return (
                          <div
                            key={i}
                            className={`rounded-md border px-2.5 py-1.5 ${done ? "border-border bg-card" : "border-dashed border-border/60 opacity-60"}`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              <Icon className="size-3" /> {step.label}
                            </div>
                            <div className={`text-xs tabular-nums ${done ? "text-foreground" : "text-muted-foreground"}`}>
                              {done ? fmt(step.at) : "–"}
                            </div>
                            {done && step.by && (
                              <div className="text-[10px] text-muted-foreground truncate">{step.by}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {s.notiz && (
                      <div className="mt-2 text-xs text-muted-foreground italic border-l-2 border-border pl-2">„{s.notiz}"</div>
                    )}
                    {s.address && (
                      <div className="mt-2 text-xs text-muted-foreground md:hidden">
                        <MapPin className="inline size-3 mr-1 -mt-0.5" />{s.address}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}