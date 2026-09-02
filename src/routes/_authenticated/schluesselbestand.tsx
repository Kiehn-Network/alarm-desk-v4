import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import {
  Boxes, Plus, Search, Upload, Download, QrCode, AlertTriangle, ClipboardCheck,
  Pencil, Trash2, RefreshCw, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listSchluesselBestand, upsertSchluesselBestand, deleteSchluesselBestand,
  importSchluesselBestand, listInventuren, startInventur, listInventurPositionen,
  setInventurPosition, abschliessenInventur,
} from "@/lib/schluesselbestand.functions";

export const Route = createFileRoute("/_authenticated/schluesselbestand")({
  component: SchluesselbestandPage,
  head: () => ({
    meta: [
      { title: "Schlüsselbestand – AlarmDesk" },
      { name: "description", content: "Bestandsverwaltung aller Schlüssel: Depot, Lagerort, Inventur, Etiketten und Warnungen." },
      { property: "og:title", content: "Schlüsselbestand – AlarmDesk" },
      { property: "og:description", content: "Bestandsverwaltung aller Schlüssel: Depot, Lagerort, Inventur, Etiketten und Warnungen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EMPTY = {
  key_number: "", bezeichnung: "", kunden_name: "", address: "", objekt: "",
  schrank: "", fach: "", anzahl_soll: 1, zustand: "ok", label_code: "", notiz: "", aktiv: true,
};

function SchluesselbestandPage() {
  const qc = useQueryClient();
  const load = useServerFn(listSchluesselBestand);
  const save = useServerFn(upsertSchluesselBestand);
  const del = useServerFn(deleteSchluesselBestand);
  const doImport = useServerFn(importSchluesselBestand);

  const [q, setQ] = useState("");
  const [onlyWarn, setOnlyWarn] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["schluessel-bestand"],
    queryFn: () => load({ data: {} } as any),
  });

  const rows = data?.rows ?? [];
  const unbekannt = data?.unbekannt ?? [];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (onlyWarn && r.warnungen.length === 0) return false;
      if (!s) return true;
      return [r.key_number, r.bezeichnung, r.kunden_name, r.address, r.objekt, r.schrank, r.fach]
        .some((v) => (v ?? "").toString().toLowerCase().includes(s));
    });
  }, [rows, q, onlyWarn]);

  const totals = useMemo(() => ({
    soll: rows.reduce((a: number, r: any) => a + r.anzahl_soll, 0),
    draussen: rows.reduce((a: number, r: any) => a + r.draussen, 0),
    warn: rows.filter((r: any) => r.warnungen.length > 0).length,
  }), [rows]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["schluessel-bestand"] });

  async function handleSave(form: any) {
    try {
      await save({ data: { ...form, anzahl_soll: Number(form.anzahl_soll) || 0 } } as any);
      toast.success("Bestand gespeichert");
      setEditRow(null);
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Fehler beim Speichern"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Diesen Schlüssel aus dem Bestand entfernen?")) return;
    try { await del({ data: { id } } as any); toast.success("Entfernt"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  function exportCsv() {
    const head = ["Schluesselnummer", "Bezeichnung", "Kunde", "Adresse", "Objekt", "Schrank", "Fach", "Soll", "Draussen", "Im Depot", "Zustand", "Aktiv", "Notiz"];
    const lines = [head.join(";")].concat(filtered.map((r: any) => [
      r.key_number, r.bezeichnung ?? "", r.kunden_name ?? "", r.address ?? "", r.objekt ?? "",
      r.schrank ?? "", r.fach ?? "", r.anzahl_soll, r.draussen, r.im_depot, r.zustand,
      r.aktiv ? "ja" : "nein", (r.notiz ?? "").replace(/[\r\n;]+/g, " "),
    ].join(";")));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `schluesselbestand-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return;
    const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    const head = lines[0].split(sep).map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase());
    const idx = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
    const iKey = idx("schluesselnummer", "schlüsselnummer", "key_number", "nummer");
    if (iKey < 0) { toast.error("Spalte mit der Schlüsselnummer nicht gefunden"); return; }
    const cols = {
      bez: idx("bezeichnung"), kunde: idx("kunde"), adr: idx("adresse"), obj: idx("objekt"),
      schrank: idx("schrank"), fach: idx("fach"), soll: idx("soll", "anzahl"), notiz: idx("notiz"),
    };
    const parsed = lines.slice(1).map((l) => {
      const c = l.split(sep).map((v) => v.trim());
      const get = (i: number) => (i >= 0 ? c[i] ?? "" : "");
      return {
        key_number: get(iKey),
        bezeichnung: get(cols.bez) || null,
        kunden_name: get(cols.kunde) || null,
        address: get(cols.adr) || null,
        objekt: get(cols.obj) || null,
        schrank: get(cols.schrank) || null,
        fach: get(cols.fach) || null,
        anzahl_soll: Number(get(cols.soll)) || 1,
        notiz: get(cols.notiz) || null,
      };
    }).filter((r) => r.key_number);
    if (!parsed.length) { toast.error("Keine gültigen Zeilen gefunden"); return; }
    try {
      const res: any = await doImport({ data: { rows: parsed, updateExisting: true } } as any);
      toast.success(`Import: ${res.created} neu, ${res.updated} aktualisiert`);
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Import fehlgeschlagen"); }
  }

  async function printLabels() {
    const items = filtered.slice(0, 200);
    if (!items.length) { toast.error("Keine Einträge zum Drucken"); return; }
    const cards = await Promise.all(items.map(async (r: any) => {
      const code = r.label_code || r.key_number;
      const png = await QRCode.toDataURL(code, { width: 220, margin: 1 });
      return `<div class="l"><img src="${png}"/><div><b>${escapeHtml(r.key_number)}</b>
        <div>${escapeHtml(r.bezeichnung ?? r.kunden_name ?? "")}</div>
        <div class="s">${escapeHtml([r.schrank, r.fach].filter(Boolean).join(" · "))}</div></div></div>`;
    }));
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup blockiert"); return; }
    w.document.write(`<html><head><title>Schlüssel-Etiketten</title><style>
      body{font-family:system-ui,sans-serif;margin:10mm;display:flex;flex-wrap:wrap;gap:4mm}
      .l{display:flex;gap:3mm;align-items:center;border:1px solid #999;border-radius:2mm;padding:2mm;width:62mm}
      .l img{width:18mm;height:18mm}
      .l b{font-size:11pt} .l div{font-size:8pt} .s{color:#555}
    </style></head><body>${cards.join("")}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Boxes className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Schlüsselbestand</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="size-4 mr-2" />Aktualisieren</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="size-4 mr-2" />CSV-Import</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4 mr-2" />Export</Button>
          <Button variant="outline" size="sm" onClick={printLabels}><QrCode className="size-4 mr-2" />Etiketten</Button>
          <Button size="sm" onClick={() => setEditRow({ ...EMPTY })}><Plus className="size-4 mr-2" />Schlüssel anlegen</Button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ""; }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Schlüssel (Positionen)" value={rows.length} />
        <StatCard label="Soll-Bestand gesamt" value={totals.soll} />
        <StatCard label="Aktuell unterwegs" value={totals.draussen} />
        <StatCard label="Warnungen" value={totals.warn} tone={totals.warn ? "warn" : undefined} />
      </div>

      {unbekannt.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <AlertTriangle className="size-4" /> Im Schlüsselbuch bewegt, aber nicht im Bestand
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {unbekannt.map((k: string) => (
              <Button key={k} variant="outline" size="sm"
                onClick={() => setEditRow({ ...EMPTY, key_number: k })}>
                {k} <Plus className="size-3 ml-1" />
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="bestand">
        <TabsList>
          <TabsTrigger value="bestand">Bestand</TabsTrigger>
          <TabsTrigger value="kunden">Kunden</TabsTrigger>
          <TabsTrigger value="inventur">Inventur</TabsTrigger>
        </TabsList>

        <TabsContent value="bestand" className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Suchen (Nummer, Kunde, Schrank …)" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyWarn} onCheckedChange={(v) => setOnlyWarn(!!v)} /> nur Warnungen
            </label>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">Nummer</th>
                    <th className="p-2">Bezeichnung / Kunde</th>
                    <th className="p-2">Lagerort</th>
                    <th className="p-2 text-right">Soll</th>
                    <th className="p-2 text-right">Unterwegs</th>
                    <th className="p-2 text-right">Depot</th>
                    <th className="p-2">Status</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={8} className="p-4 text-muted-foreground">Lade …</td></tr>}
                  {!isLoading && filtered.length === 0 && (
                    <tr><td colSpan={8} className="p-4 text-muted-foreground">Keine Einträge.</td></tr>
                  )}
                  {filtered.map((r: any) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 font-medium">{r.key_number}</td>
                      <td className="p-2">
                        <div>{r.bezeichnung ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.kunden_name ?? r.address ?? ""}</div>
                      </td>
                      <td className="p-2 text-xs">{[r.schrank, r.fach].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="p-2 text-right">{r.anzahl_soll}</td>
                      <td className="p-2 text-right">{r.draussen}</td>
                      <td className={"p-2 text-right " + (r.im_depot < 0 ? "text-destructive font-semibold" : "")}>{r.im_depot}</td>
                      <td className="p-2">
                        {r.warnungen.length === 0
                          ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" />ok</Badge>
                          : <div className="flex flex-wrap gap-1">
                              {r.warnungen.map((w: string) => (
                                <Badge key={w} variant="destructive" className="text-[10px]">{w}</Badge>
                              ))}
                            </div>}
                        {r.traeger.length > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-1">bei: {r.traeger.join(", ")}</div>
                        )}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => setEditRow(r)}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventur">
          <InventurTab />
        </TabsContent>
      </Tabs>

      <EditDialog row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={"text-2xl font-semibold " + (tone === "warn" ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function EditDialog({ row, onClose, onSave }: { row: any | null; onClose: () => void; onSave: (f: any) => Promise<void> }) {
  const [form, setForm] = useState<any>(EMPTY);
  const [key, setKey] = useState<string | null>(null);
  if (row && key !== (row.id ?? "new") + (row.key_number ?? "")) {
    setKey((row.id ?? "new") + (row.key_number ?? ""));
    setForm({ ...EMPTY, ...row });
  }
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) { setKey(null); onClose(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{row?.id ? "Schlüssel bearbeiten" : "Schlüssel anlegen"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Schlüsselnummer *"><Input value={form.key_number} onChange={(e) => set("key_number", e.target.value)} /></Field>
          <Field label="Bezeichnung"><Input value={form.bezeichnung ?? ""} onChange={(e) => set("bezeichnung", e.target.value)} /></Field>
          <Field label="Kunde"><Input value={form.kunden_name ?? ""} onChange={(e) => set("kunden_name", e.target.value)} /></Field>
          <Field label="Adresse"><Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Objekt"><Input value={form.objekt ?? ""} onChange={(e) => set("objekt", e.target.value)} /></Field>
          <Field label="Zustand"><Input value={form.zustand ?? "ok"} onChange={(e) => set("zustand", e.target.value)} placeholder="ok / defekt / verloren" /></Field>
          <Field label="Schrank"><Input value={form.schrank ?? ""} onChange={(e) => set("schrank", e.target.value)} /></Field>
          <Field label="Fach"><Input value={form.fach ?? ""} onChange={(e) => set("fach", e.target.value)} /></Field>
          <Field label="Anzahl (Soll)"><Input type="number" min={0} value={form.anzahl_soll} onChange={(e) => set("anzahl_soll", e.target.value)} /></Field>
          <Field label="Etiketten-Code (optional)"><Input value={form.label_code ?? ""} onChange={(e) => set("label_code", e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Notiz"><Textarea rows={2} value={form.notiz ?? ""} onChange={(e) => set("notiz", e.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={!!form.aktiv} onCheckedChange={(v) => set("aktiv", !!v)} /> aktiv (im Umlauf)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setKey(null); onClose(); }}>Abbrechen</Button>
          <Button onClick={() => onSave(form)} disabled={!form.key_number?.trim()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function InventurTab() {
  const qc = useQueryClient();
  const listInv = useServerFn(listInventuren);
  const start = useServerFn(startInventur);
  const listPos = useServerFn(listInventurPositionen);
  const setPos = useServerFn(setInventurPosition);
  const finish = useServerFn(abschliessenInventur);

  const [active, setActive] = useState<string | null>(null);

  const { data: inventuren } = useQuery({ queryKey: ["schluessel-inventuren"], queryFn: () => listInv({ data: {} } as any) });
  const { data: positionen } = useQuery({
    queryKey: ["schluessel-inventur-pos", active],
    queryFn: () => listPos({ data: { inventur_id: active! } } as any),
    enabled: !!active,
  });

  async function handleStart() {
    const titel = prompt("Titel der Inventur", `Inventur ${new Date().toLocaleDateString("de-DE")}`);
    if (!titel) return;
    try {
      const inv: any = await start({ data: { titel } } as any);
      toast.success("Inventur gestartet");
      qc.invalidateQueries({ queryKey: ["schluessel-inventuren"] });
      setActive(inv.id);
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  async function count(id: string, value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    try {
      await setPos({ data: { id, anzahl_ist: n } } as any);
      qc.invalidateQueries({ queryKey: ["schluessel-inventur-pos", active] });
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  async function handleFinish() {
    if (!active) return;
    try {
      await finish({ data: { id: active } } as any);
      toast.success("Inventur abgeschlossen");
      qc.invalidateQueries({ queryKey: ["schluessel-inventuren"] });
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">Inventuren</CardTitle>
          <Button size="sm" variant="outline" onClick={handleStart}><Plus className="size-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {(inventuren ?? []).length === 0 && <div className="text-sm text-muted-foreground">Noch keine Inventur.</div>}
          {(inventuren ?? []).map((i: any) => (
            <button key={i.id} onClick={() => setActive(i.id)}
              className={"w-full text-left rounded px-2 py-1.5 text-sm hover:bg-muted " + (active === i.id ? "bg-muted" : "")}>
              <div className="font-medium">{i.titel}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(i.gestartet_at).toLocaleDateString("de-DE")} · {i.status}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="size-4" />Zählliste</CardTitle>
          {active && <Button size="sm" variant="outline" onClick={handleFinish}>Abschließen</Button>}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {!active && <div className="p-4 text-sm text-muted-foreground">Inventur auswählen oder neu starten.</div>}
          {active && (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="p-2">Nummer</th><th className="p-2 text-right">Soll</th><th className="p-2 w-32">Gezählt</th><th className="p-2">Ergebnis</th></tr>
              </thead>
              <tbody>
                {(positionen ?? []).map((p: any) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2 font-medium">{p.key_number}</td>
                    <td className="p-2 text-right">{p.anzahl_soll}</td>
                    <td className="p-2">
                      <Input type="number" min={0} defaultValue={p.anzahl_ist ?? ""} className="h-8"
                        onBlur={(e) => e.target.value !== "" && count(p.id, e.target.value)} />
                    </td>
                    <td className="p-2">
                      <Badge variant={p.ergebnis === "ok" ? "secondary" : p.ergebnis === "offen" ? "outline" : "destructive"}>
                        {p.ergebnis}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {(positionen ?? []).length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-muted-foreground">Keine Positionen (Bestand ist leer).</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
