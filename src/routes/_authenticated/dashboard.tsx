import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect } from "react";
import {
  BarChart3, CheckCircle2, ListChecks, XCircle, FolderOpen, TrendingUp, Clock, Users, KeyRound,
  Activity, Timer, Building2, Wallet, CheckSquare, ArrowRight,
} from "lucide-react";
import { getDashboardStats, getDashboardExtras } from "@/lib/dashboard.functions";
import { rueckgabeBestaetigen } from "@/lib/schluesselbuch.functions";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Info } from "lucide-react";
import { useDomainModules } from "@/hooks/use-domain-modules";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePresenceList } from "@/hooks/use-presence";
import { PartnerInbox } from "@/components/intervention/partner-inbox";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
}

function getStatusMeta(status: string) {
  const s = (status ?? "").toLowerCase();
  const labels: Record<string, string> = {
    abgelehnt: "Storniert",
    in_bearbeitung: "In Bearbeitung",
    freigegeben: "Freigegeben",
    wartet_freigabe: "Wartet Freigabe",
    abgeschlossen: "Abgeschlossen",
  };
  const classes: Record<string, string> = {
    abgelehnt: "bg-destructive/15 text-destructive",
    in_bearbeitung: "bg-warning/15 text-warning",
    freigegeben: "bg-warning/15 text-warning",
    wartet_freigabe: "bg-warning/15 text-warning",
    abgeschlossen: "bg-success/15 text-success",
  };
  return {
    label: labels[s] ?? s,
    classes: classes[s] ?? "bg-muted text-muted-foreground",
  };
}

function DashboardPage() {
  const { isFahrer, isAdmin, isDispatcher, loading: roleLoading } = useRole();
  if (roleLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;
  }
  if (isFahrer && !isAdmin && !isDispatcher) {
    return <Navigate to="/meine-einsaetze" />;
  }
  return <DashboardContent />;
}

function DashboardContent() {
  const { user } = useAuth();
  const fetch = useServerFn(getDashboardStats);
  const fetchExtras = useServerFn(getDashboardExtras);
  const qc = useQueryClient();
  const { data: settings } = useAppSettings();
  const { data: modules } = useDomainModules();
  const { domainId } = useRole();
  const schluesselbuchAktiv = modules?.has("schluesselbuch") ?? false;
  const hausnotrufAktiv = modules?.has("hausnotruf") ?? false;
  const aktiveProvider = (["malteser", "johanniter", "lgwa"] as const).filter((k) => modules?.has(k));
  const interventionAktiv = modules?.has("intervention") ?? false;
  const presence = usePresenceList(domainId);
  const onlineByRole = presence.reduce(
    (acc, p) => {
      const r = (p.role ?? "").toLowerCase();
      if (r === "fahrer") acc.fahrer++;
      else if (r === "dispatcher") acc.dispatcher++;
      else if (r === "admin" || r === "superadmin") acc.admin++;
      else acc.other++;
      return acc;
    },
    { fahrer: 0, dispatcher: 0, admin: 0, other: 0 },
  );

  const { data: schluessel } = useQuery({
    queryKey: ["dashboard-schluessel-unterwegs"],
    enabled: schluesselbuchAktiv,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schluessel_buch")
        .select("id, key_number, traeger_name, kunden_name, address, status, ausgegeben_at")
        .in("status", ["ausgegeben", "uebernommen", "rueckgabe_offen"])
        .order("ausgegeben_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!schluesselbuchAktiv) return;
    const ch = supabase
      .channel("dashboard-schluessel-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "schluessel_buch" },
        () => qc.invalidateQueries({ queryKey: ["dashboard-schluessel-unterwegs"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, schluesselbuchAktiv]);

  const { data } = useSuspenseQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch(),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: extras } = useQuery({
    queryKey: ["dashboard-extras"],
    queryFn: () => fetchExtras(),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-stats-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "einsaetze" },
        () => qc.invalidateQueries({ queryKey: ["dashboard-stats"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "dateien" },
        () => qc.invalidateQueries({ queryKey: ["dashboard-stats"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const name = (user?.user_metadata?.display_name as string) ?? user?.email?.split("@")[0] ?? "";

  if ((data as any).noDomain) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Dashboard</div>
        <h1 className="text-3xl font-bold mt-1">Hallo {name} 👋</h1>
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-sm">
          <p className="font-medium">Keine Domain aktiv</p>
          <p className="text-muted-foreground mt-2">
            Du hast aktuell keine Domain zugewiesen. Als SuperAdmin kannst du im
            <a href="/superadmin" className="text-primary underline mx-1">SuperAdmin-Bereich</a>
            eine Domain wählen und dich darin als Admin einloggen.
          </p>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Monat Einsätze", value: data.stats.monatEinsaetze, icon: BarChart3, tone: "info" },
    { label: "Aktive Einsätze", value: data.stats.aktiveEinsaetze, icon: CheckCircle2, tone: "success" },
    { label: "Gesamt Einsätze", value: data.stats.gesamtEinsaetze, icon: ListChecks, tone: "warning" },
    { label: "Storno / Abgelaufen", value: data.stats.storniert, icon: XCircle, tone: "destructive" },
    { label: "Datensätze", value: data.stats.datensaetze, icon: FolderOpen, tone: "muted" },
  ] as const;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1600px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Dashboard</div>
          <h1 className="text-3xl font-bold mt-1">{greeting()}, {name} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Hier ist dein aktueller Überblick.</p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["dashboard-stats"] })}
          className="h-10 px-4 rounded-lg bg-card hover:bg-accent border border-border text-sm transition"
        >Aktualisieren</button>
      </div>

      {settings?.dashboard_hinweis && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm flex gap-2">
          <Info className="size-4 mt-0.5 shrink-0 text-primary" />
          <p className="whitespace-pre-wrap">{settings.dashboard_hinweis}</p>
        </div>
      )}

      {interventionAktiv && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Eingehende Partner-Einsätze</h2>
          <PartnerInbox />
        </section>
      )}

      <div className={`grid grid-cols-2 sm:grid-cols-3 ${schluesselbuchAktiv ? "lg:grid-cols-7" : "lg:grid-cols-5"} gap-3`}>
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
        {schluesselbuchAktiv && (
          <div className="col-span-2">
            <SchluesselCard entries={schluessel ?? []} />
          </div>
        )}
      </div>

      {/* Online + Reaktionszeit + Stunden */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OnlineCard online={onlineByRole} />
        <ReaktionCard reaktion={extras?.reaktion} />
        <StundenCard stunden={extras?.stunden} />
      </div>

      {/* Provider + Top Kunden */}
      <div className="grid lg:grid-cols-3 gap-6">
        {hausnotrufAktiv && aktiveProvider.length > 0 && (
          <ProviderCard provider={extras?.provider} aktiveProvider={aktiveProvider} />
        )}
        <TopKundenCard kunden={extras?.topKunden ?? []} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold">Letzte Einsätze</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Übersicht der jüngsten Aktivitäten</p>
            </div>
            <TrendingUp className="size-5 text-muted-foreground" />
          </div>
          {data.recent.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Noch keine Einsätze"
              hint="Sobald Einsätze erstellt werden, erscheinen sie hier."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left font-medium py-2">Datei</th>
                    <th className="text-left font-medium py-2">Fahrer</th>
                    <th className="text-left font-medium py-2">Start</th>
                    <th className="text-left font-medium py-2">Dauer</th>
                    <th className="text-left font-medium py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => {
                    const statusMeta = getStatusMeta(r.status);
                    return (
                      <tr key={r.id} className="border-b border-border/50 last:border-0">
                        <td className="py-3">{r.dateiname}</td>
                        <td className="py-3 text-muted-foreground">{r.fahrer}</td>
                        <td className="py-3 text-muted-foreground">{r.start}</td>
                        <td className="py-3 text-muted-foreground">{r.dauer}</td>
                        <td className="py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${statusMeta.classes}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Clock className="size-3.5" /> Durchschnittswerte (Monat)
            </div>
            <div className="mt-4 space-y-3">
              <KV label="Einsatzdauer" value="—" />
              <KV label="Anfahrtszeit" value="—" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Users className="size-3.5" /> Top Teilnehmer
            </div>
            <div className="mt-4 text-sm text-muted-foreground">Noch keine Daten verfügbar.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const toneMap: Record<string, string> = {
    info: "bg-info/15 text-info",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:-translate-y-0.5 duration-200" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className={`size-8 rounded-md grid place-items-center ${toneMap[tone]}`}>
        <Icon className="size-4" />
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 truncate">{label}</div>
    </div>
  );
}

function SchluesselCard({ entries }: { entries: Array<any> }) {
  const count = entries.length;
  const rueckgabeCount = entries.filter((e) => e.status === "rueckgabe_offen").length;
  const qc = useQueryClient();
  const bestaetigen = useServerFn(rueckgabeBestaetigen);
  async function doBestaetigen(id: string) {
    try {
      await bestaetigen({ data: { id } });
      toast.success("Rückgabe bestätigt");
      qc.invalidateQueries({ queryKey: ["dashboard-schluessel-unterwegs"] });
      qc.invalidateQueries({ queryKey: ["schluesselbuch"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  }
  const statusLabel: Record<string, string> = {
    ausgegeben: "Ausgegeben",
    uebernommen: "Übernommen",
    rueckgabe_offen: "Rückgabe offen",
  };
  const statusTone: Record<string, string> = {
    ausgegeben: "bg-warning/15 text-warning",
    uebernommen: "bg-info/15 text-info",
    rueckgabe_offen: "bg-destructive/15 text-destructive",
  };
  return (
    <div
      className="relative h-full rounded-xl border border-warning/40 p-4 transition hover:border-warning/70 hover:-translate-y-0.5 duration-200 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, color-mix(in oklab, var(--warning) 14%, var(--card)) 0%, var(--card) 70%)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-warning/10 blur-2xl pointer-events-none" />
      <div className="flex items-start justify-between relative">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-lg grid place-items-center bg-warning/20 text-warning ring-1 ring-warning/30">
            <KeyRound className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-warning font-semibold">Schlüssel</span>
            <span className="text-[10px] text-muted-foreground">unterwegs</span>
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="size-7 rounded-full grid place-items-center text-muted-foreground hover:bg-warning/15 hover:text-warning transition"
              aria-label="Schlüssel-Details anzeigen"
            >
              <Info className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 p-0">
            <div className="px-4 py-3 border-b border-border">
              <div className="text-sm font-semibold">Schlüssel unterwegs</div>
              <div className="text-xs text-muted-foreground">{count} aktuell nicht in der Zentrale</div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {count === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                  Alle Schlüssel sind in der Zentrale.
                </div>
              ) : (
                entries.map((e) => (
                  <div key={e.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono font-semibold">#{e.key_number}</div>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${statusTone[e.status] ?? "bg-muted text-muted-foreground"}`}>
                        {statusLabel[e.status] ?? e.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Träger: <span className="text-foreground">{e.traeger_name || "—"}</span>
                    </div>
                    {(e.kunden_name || e.address) && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[e.kunden_name, e.address].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {e.status === "rueckgabe_offen" && (
                      <button
                        type="button"
                        onClick={() => doBestaetigen(e.id)}
                        className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/15 text-success hover:bg-success/25 text-xs font-semibold transition"
                      >
                        <CheckSquare className="size-3.5" /> Rückgabe annehmen
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-border">
              <Link
                to="/schluesselbuch"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Schlüsselbuch öffnen <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="mt-3 flex items-baseline gap-2 relative">
        <div className="text-4xl font-bold tabular-nums leading-none text-warning">{count}</div>
        <div className="text-xs text-muted-foreground">{count === 1 ? "Schlüssel" : "Schlüssel"} extern</div>
      </div>
      {rueckgabeCount > 0 && (
        <div className="mt-3 relative flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          <div className="text-xs font-semibold text-destructive">
            {rueckgabeCount} Rückgabe{rueckgabeCount === 1 ? "" : "n"} offen
          </div>
          <Link
            to="/schluesselbuch"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive hover:underline"
          >
            Bearbeiten <ArrowRight className="size-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function fmtHM(min: number | null | undefined) {
  if (min == null) return "–";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function OnlineCard({ online }: { online: { fahrer: number; dispatcher: number; admin: number; other: number } }) {
  const total = online.fahrer + online.dispatcher + online.admin + online.other;
  return (
    <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Activity className="size-3.5" /> Online
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-3xl font-bold tabular-nums">{total}</div>
        <div className="text-xs text-muted-foreground">aktiv gerade</div>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <RoleRow label="Fahrer" value={online.fahrer} tone="success" />
        <RoleRow label="Dispatcher" value={online.dispatcher} tone="info" />
        <RoleRow label="Admin" value={online.admin} tone="warning" />
      </div>
    </div>
  );
}

function RoleRow({ label, value, tone }: { label: string; value: number; tone: "success" | "info" | "warning" }) {
  const dotCls = tone === "success" ? "bg-success" : tone === "info" ? "bg-info" : "bg-warning";
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={`size-2 rounded-full ${dotCls}`} />
        {label}
      </div>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ReaktionCard({ reaktion }: { reaktion?: { heute: number | null; gestern: number | null; countHeute: number } }) {
  const heute = reaktion?.heute ?? null;
  const gestern = reaktion?.gestern ?? null;
  const diff = heute != null && gestern != null ? heute - gestern : null;
  const trendTone = diff == null ? "text-muted-foreground" : diff < 0 ? "text-success" : diff > 0 ? "text-destructive" : "text-muted-foreground";
  const trendArrow = diff == null ? "·" : diff < 0 ? "▼" : diff > 0 ? "▲" : "·";
  return (
    <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Timer className="size-3.5" /> Reaktionszeit heute
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-3xl font-bold tabular-nums">{heute != null ? `${heute} min` : "–"}</div>
        <div className={`text-xs ${trendTone}`}>
          {trendArrow} {diff != null ? `${Math.abs(diff)} min vs. gestern` : "kein Vortag"}
        </div>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        Ø Zeit Alarm → Vor Ort · {reaktion?.countHeute ?? 0} Einsätze heute
      </div>
    </div>
  );
}

function StundenCard({ stunden }: { stunden?: { totalMin: number; projectedMin: number; daysElapsed: number; daysInMonth: number } }) {
  const total = stunden?.totalMin ?? 0;
  const proj = stunden?.projectedMin ?? 0;
  const pct = stunden && stunden.daysInMonth > 0 ? Math.min(100, Math.round((stunden.daysElapsed / stunden.daysInMonth) * 100)) : 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Wallet className="size-3.5" /> Stunden-Hochrechnung
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-3xl font-bold tabular-nums">{fmtHM(total)}</div>
        <div className="text-xs text-muted-foreground">bisher diesen Monat</div>
      </div>
      <div className="mt-4">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Tag {stunden?.daysElapsed ?? 0} / {stunden?.daysInMonth ?? 0}</span>
          <span>Prognose: <span className="text-foreground font-medium">{fmtHM(proj)}</span></span>
        </div>
      </div>
    </div>
  );
}

const PROVIDER_LABEL: Record<string, string> = { malteser: "Malteser", johanniter: "Johanniter", lgwa: "LüWa" };

function ProviderCard({ provider, aktiveProvider }: { provider?: Record<string, number>; aktiveProvider: readonly string[] }) {
  const entries = aktiveProvider.map((k) => ({
    key: k, label: PROVIDER_LABEL[k] ?? k, value: provider?.[k] ?? 0,
  }));
  const max = Math.max(1, ...entries.map((e) => e.value));
  return (
    <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold">Einsätze pro Provider</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Hausnotruf – aktueller Monat</p>
        </div>
        <BarChart3 className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-4">
        {entries.map((e) => (
          <div key={e.key}>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium">{e.label}</span>
              <span className="tabular-nums text-muted-foreground">{e.value}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/70 to-primary"
                style={{ width: `${(e.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopKundenCard({ kunden }: { kunden: Array<{ name: string; count: number }> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold">Top-Kunden</h2>
          <p className="text-xs text-muted-foreground mt-0.5">nach Einsatzvolumen (Monat)</p>
        </div>
        <Building2 className="size-5 text-muted-foreground" />
      </div>
      {kunden.length === 0 ? (
        <div className="text-sm text-muted-foreground">Noch keine Daten verfügbar.</div>
      ) : (
        <ol className="space-y-2">
          {kunden.map((k, i) => (
            <li key={k.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="size-6 rounded-full bg-muted text-xs font-semibold grid place-items-center shrink-0">
                  {i + 1}
                </span>
                <span className="truncate">{k.name}</span>
              </div>
              <span className="font-medium tabular-nums shrink-0 ml-3">{k.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
