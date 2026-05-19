import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Search, Send, ClipboardList, Timer, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useDomainModules } from "@/hooks/use-domain-modules";
import { listProviderEinsaetze } from "@/lib/abrechnung.functions";

const PROVIDER_LABEL: Record<string, string> = {
  malteser: "Malteser",
  johanniter: "Johanniter",
  lgwa: "LGWA",
};

export const Route = createFileRoute("/_authenticated/abrechnung/$provider")({
  component: AbrechnungUebersicht,
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dauerMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / 60000);
}
function monthLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, (mm ?? 1) - 1, 1).toLocaleString("de-DE", { month: "long", year: "numeric" });
}
function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AbrechnungUebersicht() {
  const { provider } = Route.useParams() as { provider: string };
  const navigate = useNavigate();
  const { data: modules } = useDomainModules();
  const providerKey = provider as "malteser" | "johanniter" | "lgwa";
  const providerLabel = PROVIDER_LABEL[providerKey] ?? provider;
  const enabled = modules?.has(providerKey) ?? false;

  const [monthInput, setMonthInput] = useState(currentMonth());
  const [activeMonth, setActiveMonth] = useState(currentMonth());
  const [excludeStorno, setExcludeStorno] = useState(false);

  const list = useServerFn(listProviderEinsaetze);
  const { data, isFetching } = useQuery({
    queryKey: ["abrechnung", providerKey, activeMonth, excludeStorno],
    queryFn: () => list({ data: { provider: providerKey, month: activeMonth, excludeStorno } }),
    enabled: enabled && !!providerKey,
  });
  const einsaetze: any[] = data?.einsaetze ?? [];

  const totalMin = useMemo(
    () => einsaetze.reduce((s, e) => s + dauerMinutes(e.vor_ort_am ?? e.created_at, e.einsatz_ende_am ?? e.abgeschlossen_am), 0),
    [einsaetze],
  );

  if (!modules) {
    return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Lade…</div>;
  }
  if (!enabled) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-xl border border-border bg-card p-8 max-w-xl">
          <h2 className="font-semibold">Modul nicht aktiv</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Das Modul „{providerLabel}" ist für diese Domäne nicht aktiviert.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 print:p-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Einsatzübersicht {providerLabel}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            © {new Date().getFullYear()} · AlarmDesk · Monatsübersicht „{providerLabel}"
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })} className="gap-2">
            <ArrowLeft className="size-4" /> Zurück
          </Button>
          <Link to="/abrechnung/$provider/versand" params={{ provider: providerKey }}>
            <Button variant="outline" className="gap-2"><Send className="size-4" /> Versand</Button>
          </Link>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="size-4" /> Drucken
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-xl border border-border bg-card p-5 print:hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-semibold">Filter</h2>
          <span className="text-xs text-muted-foreground">Monatsübersicht „{providerLabel}"</span>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Monat</Label>
            <Input
              type="month"
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
            <Checkbox
              checked={excludeStorno}
              onCheckedChange={(v) => setExcludeStorno(!!v)}
            />
            Storno nicht auflisten
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <Button onClick={() => setActiveMonth(monthInput)} className="gap-2">
              <Search className="size-4" /> Anzeigen
            </Button>
            <Button variant="outline" onClick={() => { setMonthInput(currentMonth()); setActiveMonth(currentMonth()); }}>
              Aktueller Monat
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<ClipboardList className="size-5" />} label={`Einsätze (${monthLabel(activeMonth)})`} value={String(einsaetze.length)} tint="blue" />
        <StatCard icon={<Timer className="size-5" />} label="Gesamtdauer" value={`${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")} Std`} tint="emerald" />
        <StatCard icon={<Calendar className="size-5" />} label="Monat" value={monthLabel(activeMonth)} tint="amber" />
      </div>

      {/* Tabelle */}
      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Einträge</h2>
        </div>
        {isFetching ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Lade…</div>
        ) : einsaetze.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Keine Einsätze im gewählten Monat.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-xs uppercase tracking-wide text-primary">
                  <th className="px-4 py-3 font-semibold">Teilnehmer-ID</th>
                  <th className="px-4 py-3 font-semibold">Startzeit</th>
                  <th className="px-4 py-3 font-semibold">Endzeit</th>
                  <th className="px-4 py-3 font-semibold">Dauer</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Adresse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {einsaetze.map((e) => {
                  const start = e.vor_ort_am ?? e.created_at;
                  const end = e.einsatz_ende_am ?? e.abgeschlossen_am;
                  const min = dauerMinutes(start, end);
                  return (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">{e.teilnehmer_id ?? "–"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(start)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(end)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{min ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} Std` : "–"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{e.status === "abgeschlossen" ? "completed" : e.status}</td>
                      <td className="px-4 py-3">{e.kunden_name ?? "–"}</td>
                      <td className="px-4 py-3">{e.address ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: "blue" | "emerald" | "amber" }) {
  const tintCls =
    tint === "blue" ? "bg-blue-500/15 text-blue-400"
    : tint === "emerald" ? "bg-emerald-500/15 text-emerald-400"
    : "bg-amber-500/15 text-amber-400";
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className={`size-12 rounded-lg grid place-items-center ${tintCls}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
}