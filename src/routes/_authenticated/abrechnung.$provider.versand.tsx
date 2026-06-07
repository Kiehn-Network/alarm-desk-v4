import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Printer, FileText, Download, Send, ClipboardList, Timer, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useDomainModules } from "@/hooks/use-domain-modules";
import { useAppSettings } from "@/hooks/use-app-settings";
import {
  listProviderEinsaetze, getProviderSettings, upsertProviderSettings, sendAbrechnungEmail,
} from "@/lib/abrechnung.functions";
import { buildAbrechnungPdf } from "@/lib/abrechnung-pdf";

const PROVIDER_LABEL: Record<string, string> = {
  malteser: "Malteser", johanniter: "Johanniter", lgwa: "LüWa",
};

export const Route = createFileRoute("/_authenticated/abrechnung/$provider/versand")({
  component: VersandPage,
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function lastMonth() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, (mm ?? 1) - 1, 1).toLocaleString("de-DE", { month: "long", year: "numeric" });
}
function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function dauerMinutes(s?: string | null, e?: string | null) {
  if (!s || !e) return 0;
  const ms = new Date(e).getTime() - new Date(s).getTime();
  return isFinite(ms) && ms > 0 ? Math.floor(ms / 60000) : 0;
}

function VersandPage() {
  const { provider } = Route.useParams() as { provider: string };
  const navigate = useNavigate();
  const { data: modules } = useDomainModules();
  const { data: settings } = useAppSettings();
  const providerKey = provider as "malteser" | "johanniter" | "lgwa";
  const providerLabel = PROVIDER_LABEL[providerKey] ?? provider;
  const enabled = modules?.has(providerKey) ?? false;

  const [monthInput, setMonthInput] = useState(currentMonth());
  const [activeMonth, setActiveMonth] = useState(currentMonth());
  const [excludeStorno, setExcludeStorno] = useState(false);
  const [email, setEmail] = useState("");
  const [emailDirty, setEmailDirty] = useState(false);
  const [sending, setSending] = useState(false);

  const list = useServerFn(listProviderEinsaetze);
  const getS = useServerFn(getProviderSettings);
  const upS = useServerFn(upsertProviderSettings);
  const send = useServerFn(sendAbrechnungEmail);

  const { data: setData } = useQuery({
    queryKey: ["abrechnung-settings", providerKey],
    queryFn: () => getS({ data: { provider: providerKey } }),
    enabled,
  });
  useEffect(() => {
    if (!emailDirty && setData?.settings?.recipient_email) {
      setEmail(setData.settings.recipient_email);
    }
  }, [setData, emailDirty]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["abrechnung-versand", providerKey, activeMonth, excludeStorno],
    queryFn: () => list({ data: { provider: providerKey, month: activeMonth, excludeStorno } }),
    enabled: enabled && !!providerKey,
  });
  const einsaetze: any[] = data?.einsaetze ?? [];
  const profiles: Record<string, string> = data?.profiles ?? {};
  const totalMin = useMemo(
    () => einsaetze.reduce((s, e) => s + dauerMinutes(e.vor_ort_am ?? e.created_at, e.einsatz_ende_am ?? e.abgeschlossen_am), 0),
    [einsaetze],
  );

  function makePdfBlobAndBase64() {
    const doc = buildAbrechnungPdf({
      providerLabel,
      monthLabel: monthLabel(activeMonth),
      einsaetze,
      profiles,
      firmenname: settings?.firmenname,
    });
    const blob = doc.output("blob") as Blob;
    const dataUri = doc.output("datauristring");
    const base64 = dataUri.split(",")[1] ?? "";
    return { blob, base64 };
  }

  async function generateBericht() {
    setActiveMonth(monthInput);
    await refetch();
    toast.success("Bericht aktualisiert");
  }

  function downloadPdf() {
    if (einsaetze.length === 0) { toast.error("Keine Einsätze für diesen Monat"); return; }
    const { blob } = makePdfBlobAndBase64();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abrechnung_${providerKey}_${activeMonth}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendEmail() {
    if (!email) { toast.error("Bitte Empfänger-E-Mail eingeben"); return; }
    if (einsaetze.length === 0) { toast.error("Keine Einsätze für diesen Monat"); return; }
    setSending(true);
    try {
      const { base64 } = makePdfBlobAndBase64();
      // Empfänger speichern (falls Admin), Fehler ignorieren
      try { await upS({ data: { provider: providerKey, recipient_email: email } }); } catch {}
      await send({
        data: {
          provider: providerKey,
          month: activeMonth,
          recipient_email: email,
          pdf_base64: base64,
          filename: `abrechnung_${providerKey}_${activeMonth}.pdf`,
          einsatz_count: einsaetze.length,
        },
      });
      toast.success("Bericht versendet");
    } catch (e: any) {
      toast.error(e?.message ?? "Versand fehlgeschlagen");
    } finally { setSending(false); }
  }

  if (!modules) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Lade…</div>;
  if (!enabled) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-xl border border-border bg-card p-8 max-w-xl">
          <h2 className="font-semibold">Modul nicht aktiv</h2>
          <p className="text-sm text-muted-foreground mt-2">Das Modul „{providerLabel}" ist nicht aktiviert.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Einsatzberichte (Monatlich) – {providerLabel}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            © {new Date().getFullYear()} · {settings?.firmenname ?? "AlarmDesk"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/abrechnung/$provider", params: { provider: providerKey } })} className="gap-2">
            <ArrowLeft className="size-4" /> Zurück
          </Button>
          <Button onClick={() => window.print()} className="gap-2"><Printer className="size-4" /> Drucken</Button>
        </div>
      </div>

      {/* Monat */}
      <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h2 className="font-semibold mb-4">Monat wählen</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Monat</Label>
            <Input type="month" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} className="w-[180px]" />
          </div>
          <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
            <Checkbox checked={excludeStorno} onCheckedChange={(v) => setExcludeStorno(!!v)} />
            Storno nicht auflisten
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <Button onClick={generateBericht} className="gap-2"><FileText className="size-4" /> Bericht generieren</Button>
            <Button variant="outline" onClick={() => { setMonthInput(lastMonth()); setActiveMonth(lastMonth()); }}>
              Letzter Monat
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<ClipboardList className="size-5" />} label="Anzahl Einsätze" value={String(einsaetze.length)} tint="blue" />
        <StatCard icon={<Timer className="size-5" />} label="Gesamtdauer (ca.)" value={`${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")} Std`} tint="emerald" />
        <StatCard icon={<Calendar className="size-5" />} label="Monat" value={monthLabel(activeMonth)} tint="amber" />
      </div>

      {/* PDF & Versand */}
      <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h2 className="font-semibold mb-4">PDF & Versand</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={downloadPdf} className="gap-2"><Download className="size-4" /> PDF herunterladen</Button>
          <Input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailDirty(true); }}
            placeholder="Empfänger E-Mail-Adresse"
            className="max-w-xs"
          />
          <Button onClick={sendEmail} disabled={sending || !email} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Send className="size-4" /> {sending ? "Sende…" : "Per E-Mail senden"}
          </Button>
        </div>
      </div>

      {/* Enthaltene Einsätze */}
      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Enthaltene Einsätze</h2>
        </div>
        {isFetching ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Lade…</div>
        ) : einsaetze.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Keine Einsätze.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-xs uppercase tracking-wide text-primary">
                  <th className="px-4 py-3 font-semibold">Teilnehmer-ID</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Adresse</th>
                  <th className="px-4 py-3 font-semibold">Fahrer</th>
                  <th className="px-4 py-3 font-semibold">Start</th>
                  <th className="px-4 py-3 font-semibold">Ende</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {einsaetze.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">{e.teilnehmer_id ?? "–"}</td>
                    <td className="px-4 py-3">{e.kunden_name ?? "–"}</td>
                    <td className="px-4 py-3">{e.address ?? "–"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.assigned_to ? (profiles[e.assigned_to] ?? "–") : "–"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(e.vor_ort_am ?? e.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(e.einsatz_ende_am ?? e.abgeschlossen_am)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.status === "abgeschlossen" ? "completed" : e.status}</td>
                  </tr>
                ))}
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