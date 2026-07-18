import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, CheckSquare, Search, User, MapPin, ArrowRight, ArrowLeft, Hand, Undo2, ChevronDown, PlayCircle, Trash2, AlertTriangle, Plus, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/hooks/use-role";
import { AccessDenied } from "@/components/layout/access-denied";
import {
  listSchluesselbuch, rueckgabeBestaetigen,
  rueckgabeErzwingen, manuellAusbuchen, manuellEinbuchen,
  seedSchluesselDemo, cleanupSchluesselDemo,
} from "@/lib/schluesselbuch.functions";
import { startWalkthrough, PENDING_KEY } from "@/lib/walkthroughs";

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
  const { isFahrer, loading, canManage } = useRole();
  const qc = useQueryClient();
  const listFn = useServerFn(listSchluesselbuch);
  const bestaetigen = useServerFn(rueckgabeBestaetigen);
  const erzwingen = useServerFn(rueckgabeErzwingen);
  const ausbuchen = useServerFn(manuellAusbuchen);
  const einbuchen = useServerFn(manuellEinbuchen);
  const seedDemo = useServerFn(seedSchluesselDemo);
  const cleanupDemo = useServerFn(cleanupSchluesselDemo);
  const [demoActive, setDemoActive] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const autoDemoTriggered = useRef(false);

  // Dialoge
  const [ausgabeOpen, setAusgabeOpen] = useState(false);
  const [ausgabeForm, setAusgabeForm] = useState({ key_number: "", traeger_name: "", kunden_name: "", address: "", grund: "" });
  const [ausgabeBusy, setAusgabeBusy] = useState(false);

  const [forceRow, setForceRow] = useState<any | null>(null);
  const [forceGrund, setForceGrund] = useState("");
  const [forceBusy, setForceBusy] = useState(false);

  const [einRow, setEinRow] = useState<any | null>(null);
  const [einGrund, setEinGrund] = useState("");
  const [einBusy, setEinBusy] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["schluesselbuch"],
    queryFn: () => listFn(),
    enabled: !loading && !isFahrer,
  });

  // Falls der Nutzer den Testlauf über die Einführung angefordert hat (Pflicht-Modus),
  // seed + Rundgang direkt beim Öffnen der Seite starten.
  useEffect(() => {
    if (loading || isFahrer) return;
    if (autoDemoTriggered.current) return;
    if (typeof window === "undefined") return;
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (pending !== "schluesselbuch-demo") return;
    sessionStorage.removeItem(PENDING_KEY);
    autoDemoTriggered.current = true;
    void startDemo();
    // startDemo ist stabil im Scope; wir wollen den Effekt nur einmal auslösen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isFahrer]);

  const [tab, setTab] = useState("offen");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const entries: any[] = data?.entries ?? [];
  const profiles: Record<string, string> = data?.profiles ?? {};
  const hasDemo = useMemo(
    () => entries.some((e) => typeof e.key_number === "string" && e.key_number.startsWith("DEMO-")),
    [entries],
  );

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

  async function doAusbuchen() {
    if (!ausgabeForm.key_number.trim() || !ausgabeForm.traeger_name.trim() || ausgabeForm.grund.trim().length < 3) {
      toast.error("Schlüsselnummer, Empfänger und Grund (min. 3 Zeichen) sind Pflicht");
      return;
    }
    setAusgabeBusy(true);
    try {
      await ausbuchen({ data: {
        key_number: ausgabeForm.key_number.trim(),
        traeger_name: ausgabeForm.traeger_name.trim(),
        kunden_name: ausgabeForm.kunden_name.trim() || null,
        address: ausgabeForm.address.trim() || null,
        grund: ausgabeForm.grund.trim(),
      } });
      toast.success("Schlüssel ausgebucht");
      setAusgabeOpen(false);
      setAusgabeForm({ key_number: "", traeger_name: "", kunden_name: "", address: "", grund: "" });
      refetch();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
    finally { setAusgabeBusy(false); }
  }

  async function doErzwingen() {
    if (!forceRow || forceGrund.trim().length < 3) {
      toast.error("Bitte Grund angeben (min. 3 Zeichen)"); return;
    }
    setForceBusy(true);
    try {
      await erzwingen({ data: { id: forceRow.id, grund: forceGrund.trim() } });
      toast.success("Schlüssel zwangs-zurückgenommen");
      setForceRow(null); setForceGrund("");
      refetch();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
    finally { setForceBusy(false); }
  }

  async function doEinbuchen() {
    if (!einRow || einGrund.trim().length < 3) {
      toast.error("Bitte Grund angeben (min. 3 Zeichen)"); return;
    }
    setEinBusy(true);
    try {
      await einbuchen({ data: { id: einRow.id, grund: einGrund.trim() } });
      toast.success("Schlüssel eingebucht");
      setEinRow(null); setEinGrund("");
      refetch();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
    finally { setEinBusy(false); }
  }

  async function startDemo() {
    setDemoBusy(true);
    try {
      await seedDemo();
      setDemoActive(true);
      setTab("rueckgabe");
      await refetch();
      // Kurz warten, damit die neuen Rows im DOM sind, dann Rundgang starten
      setTimeout(() => { void startWalkthrough("schluesselbuch-demo"); }, 400);
    } catch (e: any) {
      toast.error(e?.message ?? "Testlauf konnte nicht gestartet werden");
    } finally {
      setDemoBusy(false);
    }
  }
  async function stopDemo() {
    setDemoBusy(true);
    try {
      await cleanupDemo();
      setDemoActive(false);
      await refetch();
      toast.success("Demo-Daten entfernt");
    } catch (e: any) {
      toast.error(e?.message ?? "Aufräumen fehlgeschlagen");
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-6xl">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <KeyRound className="size-3.5" /> Schlüsselverwaltung
            </div>
            <h1 className="text-xl md:text-2xl font-bold">Schlüsselbuch</h1>
          </div>
          <div className="flex gap-2">
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setAusgabeOpen(true)} className="gap-1.5">
                <Plus className="size-3.5" /> Schlüssel ausbuchen
              </Button>
            )}
            {(demoActive || hasDemo) ? (
              <Button variant="outline" size="sm" onClick={stopDemo} disabled={demoBusy} className="gap-1.5">
                <Trash2 className="size-3.5" /> Demo aufräumen
              </Button>
            ) : null}
            <Button size="sm" onClick={startDemo} disabled={demoBusy} className="gap-1.5" data-tour="sb-demo-start">
              <PlayCircle className="size-3.5" /> Geführter Testlauf
            </Button>
          </div>
        </div>
      </header>

      {(demoActive || hasDemo) && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-center gap-2">
          <PlayCircle className="size-4" />
          Testlauf aktiv – Demo-Einträge sind mit <code className="mx-1">DEMO-</code> gekennzeichnet und lassen sich jederzeit über „Demo aufräumen" entfernen.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab} data-tour="sb-tabs">
          <TabsList>
            <TabsTrigger value="offen" className="gap-2">Offen <Badge variant="secondary">{counts.offen}</Badge></TabsTrigger>
            <TabsTrigger value="rueckgabe" data-tour="sb-tab-rueckgabe" className="gap-2">Rückgabe wartet <Badge variant="secondary">{counts.rueckgabe}</Badge></TabsTrigger>
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
            const isDemo = typeof s.key_number === "string" && s.key_number.startsWith("DEMO-");
            const isDemoRueck = isDemo && s.status === "rueckgabe_offen";
            const steps = [
              { icon: ArrowRight, label: "Ausgabe",   at: s.ausgegeben_at,           by: profiles[s.ausgegeben_by] },
              { icon: Hand,       label: "Übernahme", at: s.uebernommen_at,          by: s.traeger_name },
              { icon: Undo2,      label: "Rückgabe angefragt", at: s.rueckgabe_angefragt_at, by: null },
              { icon: ArrowLeft,  label: "Zurück",    at: s.zurueck_at,              by: profiles[s.zurueck_by] },
            ];
            return (
              <li
                key={s.id}
                className="hover:bg-muted/30 transition"
                data-tour={isDemoRueck ? "sb-demo-row" : undefined}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [s.id]: !p[s.id] }))}
                    className="size-7 rounded-md grid place-items-center hover:bg-muted text-muted-foreground shrink-0"
                    aria-label={isOpen ? "Details schließen" : "Details öffnen"}
                    data-tour={isDemoRueck ? "sb-demo-chevron" : undefined}
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
                    <Button
                      size="sm"
                      onClick={() => doBestaetigen(s.id)}
                      className="gap-1.5 h-8 shrink-0"
                      data-tour={isDemoRueck ? "sb-demo-bestaetigen" : undefined}
                    >
                      <CheckSquare className="size-3.5" /> Rückgabe
                    </Button>
                  )}
                  {canManage && s.status !== "zurueck" && s.status !== "rueckgabe_offen" && (
                    <div className="flex gap-1.5 shrink-0">
                      {!s.einsatz_id ? (
                        <Button size="sm" variant="outline" onClick={() => setEinRow(s)} className="gap-1.5 h-8">
                          <LogIn className="size-3.5" /> Einbuchen
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setForceRow(s)} className="gap-1.5 h-8 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400">
                          <AlertTriangle className="size-3.5" /> Zwangs-Rücknahme
                        </Button>
                      )}
                    </div>
                  )}
                  {canManage && s.status === "rueckgabe_offen" && (
                    <Button size="sm" variant="ghost" onClick={() => setForceRow(s)} className="gap-1.5 h-8 shrink-0 text-muted-foreground" title="Mit Grund erzwingen">
                      <AlertTriangle className="size-3.5" />
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

      {/* Manuelle Ausgabe */}
      <Dialog open={ausgabeOpen} onOpenChange={setAusgabeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schlüssel manuell ausbuchen</DialogTitle>
            <DialogDescription>
              Für Ausgaben ohne Einsatz, z.B. wenn ein Kunde seinen Schlüssel selbst abholt.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Schlüsselnummer *</Label>
              <Input value={ausgabeForm.key_number} onChange={(e) => setAusgabeForm((p) => ({ ...p, key_number: e.target.value }))} placeholder="z.B. K-1234" />
            </div>
            <div className="grid gap-1.5">
              <Label>Empfänger (Name) *</Label>
              <Input value={ausgabeForm.traeger_name} onChange={(e) => setAusgabeForm((p) => ({ ...p, traeger_name: e.target.value }))} placeholder="Wer erhält den Schlüssel?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Kunde</Label>
                <Input value={ausgabeForm.kunden_name} onChange={(e) => setAusgabeForm((p) => ({ ...p, kunden_name: e.target.value }))} placeholder="optional" />
              </div>
              <div className="grid gap-1.5">
                <Label>Adresse</Label>
                <Input value={ausgabeForm.address} onChange={(e) => setAusgabeForm((p) => ({ ...p, address: e.target.value }))} placeholder="optional" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Grund *</Label>
              <Textarea rows={3} value={ausgabeForm.grund} onChange={(e) => setAusgabeForm((p) => ({ ...p, grund: e.target.value }))} placeholder="z.B. Kunde hat seinen Schlüssel vergessen und persönlich abgeholt" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAusgabeOpen(false)} disabled={ausgabeBusy}>Abbrechen</Button>
            <Button onClick={doAusbuchen} disabled={ausgabeBusy}>Ausbuchen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zwangs-Rücknahme */}
      <Dialog open={!!forceRow} onOpenChange={(o) => { if (!o) { setForceRow(null); setForceGrund(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /> Zwangs-Rücknahme</DialogTitle>
            <DialogDescription>
              Schlüssel <b>{forceRow?.key_number}</b> wird zurückgenommen, auch wenn keine Rückgabe angefragt wurde. Der Grund wird in der Historie protokolliert.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Grund *</Label>
            <Textarea rows={3} value={forceGrund} onChange={(e) => setForceGrund(e.target.value)} placeholder="z.B. Fahrer nicht erreichbar, Schlüssel physisch bereits zurück" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setForceRow(null); setForceGrund(""); }} disabled={forceBusy}>Abbrechen</Button>
            <Button onClick={doErzwingen} disabled={forceBusy} className="bg-amber-600 hover:bg-amber-600/90">Zwangs-Rücknahme bestätigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manuelle Einbuchung */}
      <Dialog open={!!einRow} onOpenChange={(o) => { if (!o) { setEinRow(null); setEinGrund(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LogIn className="size-4" /> Schlüssel einbuchen</DialogTitle>
            <DialogDescription>
              Schlüssel <b>{einRow?.key_number}</b> wird als zurückgegeben markiert. Der Grund wird in der Historie protokolliert.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Grund *</Label>
            <Textarea rows={3} value={einGrund} onChange={(e) => setEinGrund(e.target.value)} placeholder="z.B. Kunde hat Schlüssel persönlich zurückgebracht" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEinRow(null); setEinGrund(""); }} disabled={einBusy}>Abbrechen</Button>
            <Button onClick={doEinbuchen} disabled={einBusy}>Einbuchen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}