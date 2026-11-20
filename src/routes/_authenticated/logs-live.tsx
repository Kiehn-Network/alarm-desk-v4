import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, Pause, Play, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListenPager, useSeiten } from "@/components/listen-pager";

export const Route = createFileRoute("/_authenticated/logs-live")({
  head: () => ({
    meta: [
      { title: "Logs live – AlarmDesk" },
      { name: "description", content: "Live-Protokoll aller Klicks und Aktionen der Nutzer (7 Tage)." },
      { property: "og:title", content: "Logs live – AlarmDesk" },
      { property: "og:description", content: "Live-Protokoll aller Klicks und Aktionen der Nutzer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LogsLive,
});

type Row = { id: string; user_id: string; user_name: string | null; seite: string; aktion: string; ziel: string | null; created_at: string };

const fmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function LogsLive() {
  const { isAdmin, loading } = useRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [nutzer, setNutzer] = useState("");
  const [pause, setPause] = useState(false);
  const [neu, setNeu] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("nutzer_aktivitaet").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setRows((prev) => {
        const map = new Map<string, Row>();
        [...prev, ...((data ?? []) as Row[])].forEach((r) => map.set(r.id, r));
        return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || pause) return;
    const ch = supabase
      .channel(`logs-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "nutzer_aktivitaet" }, (p) => {
        const r = p.new as Row;
        setRows((prev) => prev.some((x) => x.id === r.id) ? prev
          : [r, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 1000));
        setNeu(r.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, pause]);

  const namen = useMemo(() => [...new Set(rows.map((r) => r.user_name || r.user_id.slice(0, 8)))].sort(), [rows]);
  const gefiltert = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const n = r.user_name || r.user_id.slice(0, 8);
      if (nutzer && n !== nutzer) return false;
      if (!s) return true;
      return [n, r.seite, r.aktion, r.ziel].some((v) => v?.toLowerCase().includes(s));
    });
  }, [rows, q, nutzer]);
  const seiten = useSeiten(gefiltert, 20, `${q}|${nutzer}`);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;
  if (!isAdmin) return <div className="p-6 text-sm text-muted-foreground">Nur Admins haben Zugriff auf die Live-Logs.</div>;

  return (
    <div className="p-4 md:p-8 space-y-4" data-no-log>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Activity className="size-3.5" /> Protokoll</div>
          <h1 className="text-2xl md:text-3xl font-bold">Logs live</h1>
          <p className="text-sm text-muted-foreground">Alle Klicks und Aktionen der Nutzer in Echtzeit. Einträge werden 7 Tage gespeichert.</p>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={() => setPause((p) => !p)}>
          {pause ? <><Play className="size-4" /> Fortsetzen</> : <><Pause className="size-4" /> Pausieren</>}
        </Button>
      </header>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suche nach Nutzer, Seite, Aktion…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={nutzer} onChange={(e) => setNutzer(e.target.value)}>
          <option value="">Alle Nutzer</option>
          {namen.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <Badge variant={pause ? "secondary" : "default"} className="self-center">{pause ? "Pausiert" : "Live"}</Badge>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr><th className="text-left p-3">Zeit</th><th className="text-left p-3">Nutzer</th><th className="text-left p-3">Seite</th><th className="text-left p-3">Aktion</th><th className="text-left p-3">Wo geklickt</th></tr>
          </thead>
          <tbody>
            {gefiltert.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Noch keine Einträge.</td></tr>}
            {seiten.pageItems.map((r) => (
              <tr key={r.id} className={`border-b border-border/50 ${r.id === neu ? "bg-primary/10" : ""}`}>
                <td className="p-3 whitespace-nowrap tabular-nums text-muted-foreground">{fmt.format(new Date(r.created_at))}</td>
                <td className="p-3 font-medium whitespace-nowrap">{r.user_name || r.user_id.slice(0, 8)}</td>
                <td className="p-3 font-mono text-xs">{r.seite}</td>
                <td className="p-3 whitespace-nowrap">{r.aktion}</td>
                <td className="p-3 break-all">{r.ziel || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ListenPager {...seiten} />
      </div>
    </div>
  );
}
