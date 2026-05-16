import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect } from "react";
import {
  BarChart3, CheckCircle2, ListChecks, XCircle, FolderOpen, TrendingUp, Clock, Users,
} from "lucide-react";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
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
  const qc = useQueryClient();
  const { data: settings } = useAppSettings();
  const { data } = useSuspenseQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch(),
    refetchInterval: 30000,
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

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
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
                  {data.recent.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3">{r.dateiname}</td>
                      <td className="py-3 text-muted-foreground">{r.fahrer}</td>
                      <td className="py-3 text-muted-foreground">{r.start}</td>
                      <td className="py-3 text-muted-foreground">{r.dauer}</td>
                      <td className="py-3"><span className="inline-flex px-2 py-0.5 rounded-full bg-success/15 text-success text-xs">{r.status}</span></td>
                    </tr>
                  ))}
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
    <div className="rounded-xl border border-border bg-card p-5 transition hover:border-primary/40" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between">
        <div className={`size-10 rounded-lg grid place-items-center ${toneMap[tone]}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-4 text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
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
