import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileWarning, CheckCircle2 } from "lucide-react";
import { parseInserts, toRowObjects } from "@/lib/sql-insert-parser";
import { importNotdienstBerichte } from "@/lib/notdienst-import.functions";

type Variant = "rohrservice" | "budeko";

const KNOWN: Record<Variant, string[]> = {
  rohrservice: [
    "caller_name","caller_phone","caller_address","caller_company",
    "billing_name","billing_address","billing_phone",
    "tenant_name","tenant_phone","street","city","issue_type","data_forwarding",
    "call_date","forward_date","response_date","forwarded_technician",
    "response_technician","dispatcher","created_at",
  ],
  budeko: [
    "caller_name","caller_phone","caller_address","caller_company",
    "tenant_name","tenant_phone","street","city","issue_type","data_forwarding",
    "call_date","forward_date","forwarded_technician","dispatcher","created_at",
  ],
};

export function ImportPanel({ variant, title }: { variant: Variant; title: string }) {
  const [sql, setSql] = useState("");
  const [rows, setRows] = useState<Record<string, string | null>[] | null>(null);
  const [detected, setDetected] = useState<string[]>([]);
  const importFn = useServerFn(importNotdienstBerichte);

  const analyze = () => {
    try {
      const inserts = parseInserts(sql);
      if (inserts.length === 0) {
        toast.error("Keine INSERT-Anweisung gefunden");
        return;
      }
      const all: Record<string, string | null>[] = [];
      const cols = new Set<string>();
      for (const ins of inserts) {
        ins.columns.forEach((c) => cols.add(c));
        all.push(...toRowObjects(ins));
      }
      setRows(all);
      setDetected(Array.from(cols));
      toast.success(`${all.length} Datensätze erkannt`);
    } catch (e: any) {
      toast.error(e?.message ?? "Konnte SQL nicht auswerten");
    }
  };

  const known = KNOWN[variant];
  const mapped = useMemo(() => detected.filter((c) => known.includes(c)), [detected, known]);
  const ignored = useMemo(() => detected.filter((c) => !known.includes(c)), [detected, known]);

  const runImport = useMutation({
    mutationFn: async () => importFn({ data: { variant, rows: rows ?? [] } }),
    onSuccess: (res: any) => {
      toast.success(`${res.inserted} Berichte importiert`);
      setSql(""); setRows(null); setDetected([]);
    },
    onError: (e: any) => toast.error(e?.message ?? "Import fehlgeschlagen"),
  });

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="size-5" /> {title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Fügen Sie einen SQL-Export (INSERT-Anweisungen) aus dem Altsystem ein. Bekannte Spalten
          werden automatisch zugeordnet, unbekannte Spalten werden ignoriert.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>SQL-Dump einfügen</Label>
        <textarea
          value={sql}
          onChange={(e) => { setSql(e.target.value); setRows(null); setDetected([]); }}
          placeholder="INSERT INTO `tabelle` (`caller_name`, ...) VALUES ('...', ...), (...);"
          className="w-full min-h-[220px] font-mono text-xs rounded-md border border-border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={analyze} variant="secondary" disabled={!sql.trim()}>Analysieren</Button>
        <Button
          onClick={() => runImport.mutate()}
          disabled={!rows || rows.length === 0 || runImport.isPending}
        >
          {runImport.isPending ? "Importiere..." : rows ? `${rows.length} Berichte importieren` : "Importieren"}
        </Button>
      </div>

      {rows && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-success/10 text-success p-3">
              <div className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="size-4" /> Zugeordnet ({mapped.length})</div>
              <div className="text-xs mt-1 font-mono opacity-80 break-all">{mapped.join(", ") || "-"}</div>
            </div>
            <div className="rounded-md bg-warning/10 text-warning p-3">
              <div className="font-semibold flex items-center gap-1.5"><FileWarning className="size-4" /> Ignoriert ({ignored.length})</div>
              <div className="text-xs mt-1 font-mono opacity-80 break-all">{ignored.join(", ") || "-"}</div>
            </div>
          </div>
          <div className="rounded-md border border-border overflow-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>{mapped.map((c) => <th key={c} className="px-2 py-1.5 text-left font-medium">{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {mapped.map((c) => (
                      <td key={c} className="px-2 py-1 max-w-[180px] truncate" title={r[c] ?? ""}>{r[c] ?? "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && (
              <div className="text-xs text-muted-foreground p-2 text-center border-t border-border">
                ... und {rows.length - 20} weitere Datensätze
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}