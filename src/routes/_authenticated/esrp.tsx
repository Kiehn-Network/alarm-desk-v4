import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send, Network, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/hooks/use-role";
import { AccessDenied } from "@/components/layout/access-denied";
import { EsrpStatusLamp } from "@/components/esrp/esrp-status-lamp";
import {
  getEsrpSettings,
  updateEsrpSettings,
  listErpOutbox,
  retryErpOutbox,
} from "@/lib/esrp.functions";

export const Route = createFileRoute("/_authenticated/esrp")({
  component: EsrpPage,
});

function firstLine(s?: string | null): string {
  if (!s) return "";
  const i = s.indexOf(" | ");
  return i > 0 ? s.slice(0, i) : s;
}

function parseErrorParts(error: string) {
  // Format aus esrp.server.ts: "ERP HTTP 400 | Titel: ... | Detail: ... | Betroffene Felder: a, b | ⚠ Im Payload leer/null: a | Body: {...}"
  const parts = error.split(" | ");
  const out: Record<string, string> = {};
  for (const p of parts) {
    const idx = p.indexOf(":");
    if (idx > 0) {
      const k = p.slice(0, idx).trim();
      const v = p.slice(idx + 1).trim();
      out[k] = v;
    } else {
      out["_"] = p;
    }
  }
  return out;
}

function ErrorDetails({ error, payload }: { error: string; payload: any }) {
  const p = parseErrorParts(error);
  const status = p["_"] ?? "";
  const fields = (p["Betroffene Felder"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const empty = (p["⚠ Im Payload leer/null"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const body = p["Body"] ?? "";
  let prettyBody = body;
  try { prettyBody = JSON.stringify(JSON.parse(body), null, 2); } catch { /* keep raw */ }

  const emptyPayloadKeys = payload && typeof payload === "object"
    ? Object.keys(payload).filter((k) => {
        const v = (payload as any)[k];
        return v === null || v === undefined || v === "";
      })
    : [];

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive">{status || "Fehler"}</Badge>
        {p["Titel"] && <span className="font-medium">{p["Titel"]}</span>}
        {p["Detail"] && <span className="text-muted-foreground">— {p["Detail"]}</span>}
      </div>

      {fields.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
          <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400 mb-1">
            <AlertTriangle className="size-3.5" /> Vom ERP beanstandete Felder
          </div>
          <div className="flex flex-wrap gap-1">
            {fields.map((f) => (
              <Badge key={f} variant={empty.includes(f) ? "destructive" : "outline"} className="text-[10px]">
                {f}{empty.includes(f) ? " · leer" : ""}
              </Badge>
            ))}
          </div>
          {empty.length > 0 && (
            <p className="mt-1.5 text-muted-foreground">
              Diese Felder sind im gesendeten Payload <code>null</code>/leer — wahrscheinlich Datenproblem im Einsatz.
            </p>
          )}
        </div>
      )}

      {emptyPayloadKeys.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Alle leeren Payload-Felder ({emptyPayloadKeys.length})
          </summary>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {emptyPayloadKeys.map((k) => (
              <Badge key={k} variant="outline" className="text-[10px] font-mono">{k}</Badge>
            ))}
          </div>
        </details>
      )}

      {body && (
        <details>
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">ERP-Response-Body</summary>
          <pre className="mt-1.5 p-2 rounded bg-background border border-border overflow-x-auto text-[11px] max-h-64">{prettyBody}</pre>
        </details>
      )}

      {payload && (
        <details>
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Gesendeter Payload</summary>
          <pre className="mt-1.5 p-2 rounded bg-background border border-border overflow-x-auto text-[11px] max-h-64">{JSON.stringify(payload, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

function EsrpPage() {
  const { isAdmin, loading } = useRole();
  if (loading) return null;
  if (!isAdmin) return <AccessDenied />;
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Network className="size-6 text-primary" />
        <h1 className="text-2xl font-bold">ESRP – ERP-Anbindung</h1>
      </div>
      <SettingsCard />
      <OutboxCard />
    </div>
  );
}

function SettingsCard() {
  const getFn = useServerFn(getEsrpSettings);
  const updateFn = useServerFn(updateEsrpSettings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["esrp-settings"], queryFn: () => getFn() });
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [tokenChanged, setTokenChanged] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        api_base: data.api_base ?? "",
        api_user: data.api_user ?? "",
        api_token: "",
        token_display: data.api_token ?? "",
        endpoint_path: data.endpoint_path ?? "/azs-av-einsaetze",
        use_api_prefix: !!data.use_api_prefix,
        aktiv: !!data.aktiv,
        auto_on_abschluss: !!data.auto_on_abschluss,
      });
      setTokenChanged(false);
    }
  }, [data]);

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      await updateFn({
        data: {
          api_base: form.api_base,
          api_user: form.api_user,
          api_token: tokenChanged ? form.api_token : undefined,
          endpoint_path: form.endpoint_path,
          use_api_prefix: form.use_api_prefix,
          aktiv: form.aktiv,
          auto_on_abschluss: form.auto_on_abschluss,
        },
      });
      toast.success("Einstellungen gespeichert");
      qc.invalidateQueries({ queryKey: ["esrp-settings"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !form) {
    return <Card><CardContent className="p-6"><Loader2 className="size-5 animate-spin" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konfiguration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>API Base URL</Label>
            <Input
              value={form.api_base}
              onChange={(e) => setForm({ ...form, api_base: e.target.value })}
              placeholder="http://213.209.109.18:5000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Endpoint Pfad</Label>
            <Input
              value={form.endpoint_path}
              onChange={(e) => setForm({ ...form, endpoint_path: e.target.value })}
              placeholder="/azs-av-einsaetze"
            />
          </div>
          <div className="space-y-1.5">
            <Label>API Benutzer</Label>
            <Input
              value={form.api_user}
              onChange={(e) => setForm({ ...form, api_user: e.target.value })}
              placeholder="AZS_Alarmdesk"
            />
          </div>
          <div className="space-y-1.5">
            <Label>API Token</Label>
            <Input
              type="password"
              value={tokenChanged ? form.api_token : ""}
              onChange={(e) => { setTokenChanged(true); setForm({ ...form, api_token: e.target.value }); }}
              placeholder={form.token_display || "Token eingeben"}
            />
            {!tokenChanged && form.token_display && (
              <p className="text-xs text-muted-foreground">Gespeichert: {form.token_display}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">/api Präfix verwenden</div>
            <p className="text-xs text-muted-foreground">POST an <code>/api{form.endpoint_path}</code> statt direkt <code>{form.endpoint_path}</code></p>
          </div>
          <Switch checked={form.use_api_prefix} onCheckedChange={(v) => setForm({ ...form, use_api_prefix: v })} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Auto-Versand bei Abschluss</div>
            <p className="text-xs text-muted-foreground">Sobald ein Einsatz auf "abgeschlossen" gesetzt wird, automatisch ans ERP senden.</p>
          </div>
          <Switch checked={form.auto_on_abschluss} onCheckedChange={(v) => setForm({ ...form, auto_on_abschluss: v })} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">ESRP aktiv</div>
            <p className="text-xs text-muted-foreground">Nur wenn aktiviert, werden Einsätze tatsächlich versendet.</p>
          </div>
          <Switch checked={form.aktiv} onCheckedChange={(v) => setForm({ ...form, aktiv: v })} />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={busy} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />} Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OutboxCard() {
  const listFn = useServerFn(listErpOutbox);
  const retryFn = useServerFn(retryErpOutbox);
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["esrp-outbox"],
    queryFn: () => listFn(),
    refetchInterval: 10_000,
  });

  async function retry(id: string) {
    try {
      const r: any = await retryFn({ data: { outbox_id: id } });
      if (r?.ok) toast.success("Erneut gesendet");
      else toast.error(r?.error ?? "Versand fehlgeschlagen");
      qc.invalidateQueries({ queryKey: ["esrp-outbox"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Outbox (letzte 100)</CardTitle>
        <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["esrp-outbox"] })} className="gap-1.5">
          <RefreshCw className="size-3.5" /> Aktualisieren
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6"><Loader2 className="size-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Einsatz-ID</th>
                  <th className="text-left px-3 py-2">Erstellt</th>
                  <th className="text-left px-3 py-2">Versuche</th>
                  <th className="text-left px-3 py-2">Fehler</th>
                  <th className="text-right px-3 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {(data?.jobs ?? []).map((j: any) => (
                  <React.Fragment key={j.id}>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {j.last_error && (
                          <button
                            onClick={() => setExpanded((s) => ({ ...s, [j.id]: !s[j.id] }))}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Details"
                          >
                            {expanded[j.id] ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </button>
                        )}
                        <EsrpStatusLamp entry={{ status: j.status, tries: j.tries, last_error: j.last_error, sent_at: j.sent_at }} />
                        <Badge variant="outline" className="text-xs">{j.status}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{j.external_id}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString("de-DE")}</td>
                    <td className="px-3 py-2">{j.tries}</td>
                    <td className="px-3 py-2 text-xs text-red-500 max-w-[300px] truncate" title={j.last_error ?? ""}>
                      {firstLine(j.last_error)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {j.status !== "sent" && (
                        <Button size="sm" variant="ghost" onClick={() => retry(j.id)} className="gap-1.5">
                          <Send className="size-3.5" /> Erneut
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expanded[j.id] && j.last_error && (
                    <tr className="bg-muted/30 border-t border-border">
                      <td colSpan={6} className="px-4 py-3">
                        <ErrorDetails error={j.last_error} payload={j.payload} />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
                {(data?.jobs ?? []).length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground p-6">Keine Einträge</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}