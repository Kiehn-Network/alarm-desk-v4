import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, FileJson, Database, AlertTriangle, CheckCircle2, Loader2, Files, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRole } from "@/hooks/use-role";
import { AccessDenied } from "@/components/layout/access-denied";
import { importDateien, attachFilesToDateien } from "@/lib/datei-import.functions";
import { importLegacyEinsaetze, listImportDomains } from "@/lib/legacy-einsaetze-import.functions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeUUID } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/daten-import")({
  component: DatenImportPage,
});

type Row = {
  filename: string;
  address?: string | null;
  key_number?: string | null;
  folder?: string | null;
  kunden_name?: string | null;
  notiz?: string | null;
  teilnehmer_id?: string | null;
  anlagen_nr?: string | null;
};

const FIELD_ALIASES: Record<string, keyof Row> = {
  filename: "filename",
  file: "filename",
  dateiname: "filename",
  address: "address",
  adresse: "address",
  key_number: "key_number",
  keynumber: "key_number",
  schluessel: "key_number",
  folder: "folder",
  ordner: "folder",
  kunden_name: "kunden_name",
  kunde: "kunden_name",
  customer: "kunden_name",
  notiz: "notiz",
  note: "notiz",
  notes: "notiz",
  teilnehmer_id: "teilnehmer_id",
  teilnehmerid: "teilnehmer_id",
  anlagen_nr: "anlagen_nr",
  anlagennr: "anlagen_nr",
};

function normalizeKey(k: string): keyof Row | null {
  const clean = k.trim().toLowerCase().replace(/[\s_-]/g, "").replace(/[^a-z0-9]/g, "");
  const lookup: Record<string, keyof Row> = {};
  for (const [a, v] of Object.entries(FIELD_ALIASES)) {
    lookup[a.replace(/[\s_-]/g, "").replace(/[^a-z0-9]/g, "")] = v;
  }
  return lookup[clean] ?? null;
}

function parseCSV(text: string): Row[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === "," || c === ";" || c === "\t") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); lines.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); lines.push(cur); }
  if (lines.length < 2) return [];
  const headers = lines[0].map((h) => normalizeKey(h));
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.every((v) => !v.trim())) continue;
    const r: any = {};
    headers.forEach((h, idx) => { if (h) r[h] = l[idx]?.trim() || null; });
    if (!r.filename) r.filename = r.kunden_name || r.anlagen_nr || `Import-${i}`;
    rows.push(r as Row);
  }
  return rows;
}

function parseJSON(text: string): Row[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : (data.rows ?? data.data ?? []);
  return arr.map((item: any, i: number) => {
    const r: any = {};
    for (const [k, v] of Object.entries(item)) {
      const nk = normalizeKey(k);
      if (nk) r[nk] = v == null ? null : String(v);
    }
    if (!r.filename) r.filename = r.kunden_name || r.anlagen_nr || `Import-${i + 1}`;
    return r as Row;
  });
}

function parseSQL(text: string): Row[] {
  // Parse INSERT INTO ... (col1, col2, ...) VALUES (...), (...);
  const rows: Row[] = [];
  const re = /INSERT\s+INTO\s+`?\w+`?\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+?);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const cols = m[1].split(",").map((s) => normalizeKey(s.trim().replace(/`/g, "")));
    const valuesPart = m[2];
    // split tuples
    const tuples: string[][] = [];
    let cur: string[] = [];
    let field = "";
    let inStr = false;
    let depth = 0;
    for (let i = 0; i < valuesPart.length; i++) {
      const c = valuesPart[i];
      if (inStr) {
        if (c === "\\" && i + 1 < valuesPart.length) { field += valuesPart[i + 1]; i++; }
        else if (c === "'") {
          if (valuesPart[i + 1] === "'") { field += "'"; i++; }
          else inStr = false;
        } else field += c;
      } else {
        if (c === "'") inStr = true;
        else if (c === "(") { if (depth === 0) { cur = []; field = ""; } depth++; }
        else if (c === ")") { depth--; if (depth === 0) { cur.push(field.trim()); tuples.push(cur); field = ""; } }
        else if (c === "," && depth === 1) { cur.push(field.trim()); field = ""; }
        else if (depth > 0) field += c;
      }
    }
    for (const t of tuples) {
      const r: any = {};
      cols.forEach((c, idx) => {
        if (!c) return;
        let v: any = t[idx];
        if (v === undefined) v = null;
        else if (/^null$/i.test(v)) v = null;
        else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
        r[c] = v;
      });
      if (!r.filename) r.filename = r.kunden_name || r.anlagen_nr || `Import-${rows.length + 1}`;
      rows.push(r as Row);
    }
  }
  return rows;
}

function detectAndParse(text: string, format: "auto" | "csv" | "json" | "sql"): Row[] {
  const t = text.trim();
  if (!t) return [];
  if (format === "auto") {
    if (t.startsWith("[") || t.startsWith("{")) format = "json";
    else if (/insert\s+into/i.test(t)) format = "sql";
    else format = "csv";
  }
  if (format === "json") return parseJSON(t);
  if (format === "sql") return parseSQL(t);
  return parseCSV(t);
}

function DatenImportPage() {
  const { isAdmin, loading } = useRole();
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"auto" | "csv" | "json" | "sql">("auto");
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "overwrite" | "insert">("skip");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const importFn = useServerFn(importDateien);

  const rows = useMemo(() => {
    setParseError(null);
    if (!text.trim()) return [];
    try {
      return detectAndParse(text, format);
    } catch (e: any) {
      setParseError(e?.message ?? "Parser-Fehler");
      return [];
    }
  }, [text, format]);

  const mutation = useMutation({
    mutationFn: async () => importFn({ data: { rows: rows as any, duplicate_strategy: duplicateStrategy } }),
    onSuccess: (res) => {
      setResult(res);
      toast.success(`Import abgeschlossen: ${res.inserted} neu, ${res.updated} aktualisiert, ${res.skipped} übersprungen`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Import fehlgeschlagen"),
  });

  const onFile = async (f: File) => {
    const t = await f.text();
    setText(t);
    const name = f.name.toLowerCase();
    if (name.endsWith(".json")) setFormat("json");
    else if (name.endsWith(".sql")) setFormat("sql");
    else if (name.endsWith(".csv")) setFormat("csv");
    else setFormat("auto");
  };

  if (loading) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (!isAdmin) return <AccessDenied />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Upload className="size-6 text-primary" /> Daten-Import</h1>
        <p className="text-sm text-muted-foreground mt-1">Importiere Altbestände (Kunden-Dateien) aus CSV, JSON oder SQL-Dump direkt in die Datei-Verwaltung.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Daten einfügen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,.json,.sql,.txt"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              className="text-sm"
            />
            <div className="flex items-center gap-2 ml-auto">
              <Label className="text-xs">Format:</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="text-sm rounded-md border bg-background px-2 py-1"
              >
                <option value="auto">Auto</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="sql">SQL-Dump</option>
              </select>
            </div>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"CSV, JSON oder SQL-INSERT hier einfügen…\n\nErkannte Spalten: filename, address, key_number, folder, kunden_name, notiz, teilnehmer_id, anlagen_nr"}
            className="font-mono text-xs min-h-[200px]"
          />
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><FileText className="size-3" /> CSV: erste Zeile = Spaltennamen</div>
            <div className="flex items-center gap-1"><FileJson className="size-3" /> JSON: Array von Objekten</div>
            <div className="flex items-center gap-1"><Database className="size-3" /> SQL: <code>INSERT INTO …</code></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. Duplikate</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={duplicateStrategy} onValueChange={(v) => setDuplicateStrategy(v as any)}>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="skip" id="dup-skip" />
              <Label htmlFor="dup-skip" className="cursor-pointer">
                <div className="font-medium">Überspringen</div>
                <div className="text-xs text-muted-foreground">Existierende Einträge (gleiche Anlagen-Nr. oder Teilnehmer-ID) bleiben unverändert.</div>
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="overwrite" id="dup-over" />
              <Label htmlFor="dup-over" className="cursor-pointer">
                <div className="font-medium">Überschreiben</div>
                <div className="text-xs text-muted-foreground">Existierende Einträge werden mit den Import-Daten aktualisiert.</div>
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="insert" id="dup-ins" />
              <Label htmlFor="dup-ins" className="cursor-pointer">
                <div className="font-medium">Trotzdem einfügen</div>
                <div className="text-xs text-muted-foreground">Alle Zeilen werden als neue Einträge angelegt (kann Duplikate erzeugen).</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>3. Vorschau</span>
            <span className="text-sm font-normal text-muted-foreground">{rows.length} Zeile{rows.length === 1 ? "" : "n"} erkannt</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {parseError && (
            <div className="flex items-center gap-2 text-sm text-destructive mb-3">
              <AlertTriangle className="size-4" /> {parseError}
            </div>
          )}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Daten erkannt.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Kunde</th>
                    <th className="p-2 text-left">Adresse</th>
                    <th className="p-2 text-left">Anlagen-Nr.</th>
                    <th className="p-2 text-left">Teilnehmer</th>
                    <th className="p-2 text-left">Schlüssel</th>
                    <th className="p-2 text-left">Notiz</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2">{r.kunden_name || "—"}</td>
                      <td className="p-2">{r.address || "—"}</td>
                      <td className="p-2">{r.anlagen_nr || "—"}</td>
                      <td className="p-2">{r.teilnehmer_id || "—"}</td>
                      <td className="p-2">{r.key_number || "—"}</td>
                      <td className="p-2 max-w-[200px] truncate">{r.notiz || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">… und {rows.length - 50} weitere</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button
          size="lg"
          disabled={rows.length === 0 || mutation.isPending}
          onClick={() => { setResult(null); mutation.mutate(); }}
        >
          {mutation.isPending ? (
            <><Loader2 className="size-4 mr-2 animate-spin" /> Importiere…</>
          ) : (
            <><Upload className="size-4 mr-2" /> {rows.length} Zeile{rows.length === 1 ? "" : "n"} importieren</>
          )}
        </Button>
      </div>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="size-5 text-success" /> Import-Ergebnis</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Gesamt" value={result.total} />
              <Stat label="Neu" value={result.inserted} tone="success" />
              <Stat label="Aktualisiert" value={result.updated} tone="info" />
              <Stat label="Übersprungen" value={result.skipped} tone="muted" />
            </div>
            {result.errors?.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <div className="text-sm font-medium text-destructive mb-2 flex items-center gap-2"><AlertTriangle className="size-4" /> {result.errors.length} Fehler</div>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 20).map((e: any, i: number) => (
                    <li key={i}><span className="font-mono text-muted-foreground">Zeile {e.row}:</span> {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <BulkFileAttachSection />

      <LegacyEinsaetzeImportSection />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "info" | "muted" }) {
  const color =
    tone === "success" ? "text-success" :
    tone === "info" ? "text-primary" :
    tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function BulkFileAttachSection() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<any>(null);
  const attachFn = useServerFn(attachFilesToDateien);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      setProgress({ done: 0, total: files.length });
      const uploaded: { upload_filename: string; storage_path: string; mime_type: string | null; size_bytes: number | null }[] = [];
      const uploadErrors: { filename: string; message: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        try {
          const ext = f.name.split(".").pop() ?? "bin";
          const path = `${user.id}/${safeUUID()}.${ext}`;
          const up = await supabase.storage.from("dateien").upload(path, f, {
            contentType: f.type || "application/octet-stream",
          });
          if (up.error) throw up.error;
          uploaded.push({
            upload_filename: f.name,
            storage_path: path,
            mime_type: f.type || null,
            size_bytes: f.size,
          });
        } catch (e: any) {
          uploadErrors.push({ filename: f.name, message: e?.message ?? String(e) });
        }
        setProgress({ done: i + 1, total: files.length });
      }
      if (uploaded.length === 0) {
        return { total: files.length, matched: 0, attached: 0, versioned: 0, unmatched: [], errors: uploadErrors };
      }
      const res = await attachFn({ data: { files: uploaded } });
      return { ...res, errors: [...uploadErrors, ...(res.errors ?? [])] };
    },
    onSuccess: (res) => {
      setResult(res);
      toast.success(`${res.matched} zugeordnet (${res.attached} angeh\u00e4ngt, ${res.versioned} neue Versionen), ${res.unmatched.length} ohne Treffer`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Upload fehlgeschlagen"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Files className="size-5 text-primary" /> Dateien zuordnen (PDF, Bilder, …)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          L\u00e4dt mehrere Originaldateien hoch und ordnet sie den bereits importierten Eintr\u00e4gen automatisch zu.
          Match erfolgt prim\u00e4r \u00fcber den Dateinamen (Spalte <code>filename</code>); fehlt ein Treffer,
          wird zus\u00e4tzlich versucht, die <strong>Anlagen-Nr.</strong> oder <strong>Teilnehmer-ID</strong>
          im Dateinamen zu erkennen. Existiert bereits eine Datei, wird eine neue Version angeh\u00e4ngt
          und mit dem Original verkn\u00fcpft.
        </p>

        <input
          type="file"
          multiple
          onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setResult(null); }}
          className="text-sm"
        />

        {files.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {files.length} Datei{files.length === 1 ? "" : "en"} ausgew\u00e4hlt
            {" "}({(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB gesamt)
          </div>
        )}

        {progress && mutation.isPending && (
          <div className="text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground">Upload l\u00e4uft…</span>
              <span className="font-mono">{progress.done} / {progress.total}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            disabled={files.length === 0 || mutation.isPending}
            onClick={() => { setResult(null); mutation.mutate(); }}
          >
            {mutation.isPending ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Verarbeite…</>
            ) : (
              <><Upload className="size-4 mr-2" /> {files.length} Datei{files.length === 1 ? "" : "en"} hochladen &amp; zuordnen</>
            )}
          </Button>
        </div>

        {result && (
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Gesamt" value={result.total} />
              <Stat label="Zugeordnet" value={result.matched} tone="success" />
              <Stat label="Neue Versionen" value={result.versioned} tone="info" />
              <Stat label="Ohne Treffer" value={result.unmatched.length} tone="muted" />
            </div>
            {result.unmatched.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                <div className="text-sm font-medium text-warning mb-2 flex items-center gap-2">
                  <Link2 className="size-4" /> {result.unmatched.length} Datei{result.unmatched.length === 1 ? "" : "en"} ohne Treffer
                </div>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto font-mono">
                  {result.unmatched.slice(0, 50).map((u: any, i: number) => (
                    <li key={i}>{u.filename}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.errors?.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <div className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                  <AlertTriangle className="size-4" /> {result.errors.length} Fehler
                </div>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 20).map((e: any, i: number) => (
                    <li key={i}><span className="font-mono text-muted-foreground">{e.filename}:</span> {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}