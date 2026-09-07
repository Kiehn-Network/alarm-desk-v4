import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importLagerArtikel, LAGER_KATEGORIEN, type LagerImportRow } from "@/lib/lager.functions";

type Encoding = "auto" | "utf-8" | "windows-1252" | "iso-8859-1";

type PreviewRow = LagerImportRow & { _zeile: number; _fehler: string | null };

const FELDER: { key: keyof LagerImportRow; labels: string[] }[] = [
  { key: "kategorie", labels: ["kategorie", "category"] },
  { key: "bezeichnung", labels: ["bezeichnung", "artikel", "name", "titel"] },
  { key: "beschreibung", labels: ["beschreibung", "description", "info"] },
  { key: "barcode", labels: ["barcode", "ean", "code", "artikelnummer", "art-nr", "artnr"] },
  { key: "einheit", labels: ["einheit", "unit", "me"] },
  { key: "lagerort", labels: ["lagerort", "ort", "regal", "platz"] },
  { key: "bestand", labels: ["bestand", "menge", "anzahl", "stück", "stueck"] },
  { key: "mindestbestand", labels: ["mindestbestand", "meldebestand", "min", "minimum"] },
];

function splitLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseCsv(text: string): PreviewRow[] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("Die Datei enthält keine Datenzeilen.");
  const sep = [";", ",", "\t"].sort(
    (a, b) => lines[0].split(b).length - lines[0].split(a).length,
  )[0];
  const header = splitLine(lines[0], sep).map((h) => h.toLowerCase().replace(/[^a-zäöüß-]/g, ""));
  const index: Partial<Record<keyof LagerImportRow, number>> = {};
  FELDER.forEach((f) => {
    const i = header.findIndex((h) => f.labels.some((l) => h === l.replace(/[^a-zäöüß-]/g, "")));
    if (i >= 0) index[f.key] = i;
  });
  if (index.bezeichnung === undefined) {
    throw new Error("Spalte „Bezeichnung“ wurde nicht gefunden.");
  }

  return lines.slice(1).map((line, i) => {
    const cells = splitLine(line, sep);
    const get = (k: keyof LagerImportRow) =>
      index[k] === undefined ? "" : (cells[index[k]!] ?? "").trim();
    const num = (k: keyof LagerImportRow) => {
      const raw = get(k).replace(/\./g, "").replace(",", ".");
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    };
    const bezeichnung = get("bezeichnung");
    const katRaw = get("kategorie");
    const kategorie = (LAGER_KATEGORIEN as readonly string[]).find(
      (k) => k.toLowerCase() === katRaw.toLowerCase(),
    ) ?? "Sonstiges";
    return {
      _zeile: i + 2,
      _fehler: bezeichnung ? null : "Bezeichnung fehlt",
      kategorie,
      bezeichnung,
      beschreibung: get("beschreibung") || null,
      barcode: get("barcode") || null,
      einheit: get("einheit") || "Stk",
      lagerort: get("lagerort") || null,
      bestand: num("bestand"),
      mindestbestand: num("mindestbestand"),
    } satisfies PreviewRow;
  });
}

export function LagerImportPanel() {
  const qc = useQueryClient();
  const run = useServerFn(importLagerArtikel);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dateiname, setDateiname] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [modus, setModus] = useState<"aktualisieren" | "ueberspringen">("aktualisieren");
  const [busy, setBusy] = useState(false);
  const [ergebnis, setErgebnis] = useState<null | {
    total: number; inserted: number; updated: number; skipped: number;
    errors: { row: number; message: string }[];
  }>(null);

  const gueltige = useMemo(() => rows.filter((r) => !r._fehler), [rows]);
  const fehlerhafte = rows.length - gueltige.length;

  async function onFile(file: File) {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setRows(parsed);
      setDateiname(file.name);
      setErgebnis(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Datei konnte nicht gelesen werden.");
    }
  }

  async function onImport() {
    if (gueltige.length === 0) return;
    setBusy(true);
    try {
      const res: any = await run({
        data: {
          modus,
          rows: gueltige.map(({ _zeile, _fehler, ...r }) => r),
        },
      });
      setErgebnis(res);
      qc.invalidateQueries({ queryKey: ["lager-artikel"] });
      toast.success(`Import fertig: ${res.inserted} neu, ${res.updated} aktualisiert.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  function vorlage() {
    const csv = [
      "Kategorie;Bezeichnung;Beschreibung;Barcode;Einheit;Lagerort;Bestand;Mindestbestand",
      "EMA;Bewegungsmelder PIR;Innenbereich;4001234567890;Stk;Regal A1;25;5",
      "Kleinmaterial;Dübel 8mm;;;Pkg;Regal C3;120;20",
    ].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "lager-import-vorlage.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4" /> CSV-Import
          </CardTitle>
          <Button variant="outline" size="sm" onClick={vorlage}>
            <Download className="size-4" /> Vorlage herunterladen
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Spalten: Kategorie, Bezeichnung, Beschreibung, Barcode, Einheit, Lagerort, Bestand,
            Mindestbestand. Trennzeichen Semikolon, Komma oder Tabulator. Fehlt ein Barcode, wird
            beim Import automatisch einer erzeugt.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> CSV auswählen
            </Button>
            {dateiname && <span className="text-sm text-muted-foreground">{dateiname}</span>}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Label className="text-sm">Bereits vorhandene Barcodes:</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={modus === "aktualisieren" ? "default" : "outline"}
                onClick={() => setModus("aktualisieren")}
              >
                Aktualisieren
              </Button>
              <Button
                type="button"
                size="sm"
                variant={modus === "ueberspringen" ? "default" : "outline"}
                onClick={() => setModus("ueberspringen")}
              >
                Überspringen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Vorschau</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{gueltige.length} importierbar</Badge>
              {fehlerhafte > 0 && (
                <Badge variant="destructive">{fehlerhafte} fehlerhaft</Badge>
              )}
              <Button onClick={onImport} disabled={busy || gueltige.length === 0}>
                {busy ? "Import läuft…" : `${gueltige.length} Artikel importieren`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[480px] overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Zeile</th>
                    <th className="p-2 font-medium">Kategorie</th>
                    <th className="p-2 font-medium">Bezeichnung</th>
                    <th className="p-2 font-medium">Barcode</th>
                    <th className="p-2 font-medium">Einheit</th>
                    <th className="p-2 font-medium">Lagerort</th>
                    <th className="p-2 text-right font-medium">Bestand</th>
                    <th className="p-2 text-right font-medium">Melde&shy;bestand</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r._zeile}
                      className={`border-t border-border ${r._fehler ? "bg-destructive/10" : ""}`}
                    >
                      <td className="p-2 text-muted-foreground">{r._zeile}</td>
                      <td className="p-2">{r.kategorie}</td>
                      <td className="p-2">
                        {r.bezeichnung || <span className="text-destructive">{r._fehler}</span>}
                      </td>
                      <td className="p-2 font-mono text-xs">
                        {r.barcode || <span className="text-muted-foreground">wird erzeugt</span>}
                      </td>
                      <td className="p-2">{r.einheit}</td>
                      <td className="p-2">{r.lagerort ?? "–"}</td>
                      <td className="p-2 text-right">{r.bestand}</td>
                      <td className="p-2 text-right">{r.mindestbestand}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {ergebnis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-primary" /> Ergebnis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{ergebnis.inserted} neu angelegt</Badge>
              <Badge variant="secondary">{ergebnis.updated} aktualisiert</Badge>
              <Badge variant="secondary">{ergebnis.skipped} übersprungen</Badge>
            </div>
            {ergebnis.errors.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-medium text-destructive">
                  <AlertTriangle className="size-4" /> {ergebnis.errors.length} Fehler
                </p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {ergebnis.errors.slice(0, 20).map((e) => (
                    <li key={e.row}>Zeile {e.row}: {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
