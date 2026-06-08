import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Send, Save, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getDomainEmailSettings, upsertDomainEmailSettings, sendDomainTestEmail,
} from "@/lib/email-settings.functions";
import { useAuth } from "@/hooks/use-auth";

export function EmailSettingsPanel() {
  const get = useServerFn(getDomainEmailSettings);
  const upsert = useServerFn(upsertDomainEmailSettings);
  const test = useServerFn(sendDomainTestEmail);
  const qc = useQueryClient();
  const { user } = useAuth();

  const q = useQuery({ queryKey: ["domain-email-settings"], queryFn: () => get() });
  const s = q.data?.settings;
  const platformAvailable = q.data?.platform_available ?? false;

  const [mode, setMode] = useState<"platform" | "own">("platform");
  const [provider, setProvider] = useState<"resend" | "mailgun" | "sendgrid">("resend");
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [mgDomain, setMgDomain] = useState("");
  const [mgRegion, setMgRegion] = useState<"us" | "eu">("eu");
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (!s) return;
    setMode((s.mode as any) ?? "platform");
    setProvider((s.provider as any) ?? "resend");
    setFromEmail(s.from_email ?? "");
    setFromName(s.from_name ?? "");
    setMgDomain(s.mailgun_domain ?? "");
    setMgRegion((s.mailgun_region as any) ?? "eu");
    setApiKey("");
  }, [s?.mode, s?.provider, s?.from_email, s?.from_name, s?.mailgun_domain, s?.mailgun_region]);

  useEffect(() => { if (user?.email && !testTo) setTestTo(user.email); }, [user?.email]);

  const m_save = useMutation({
    mutationFn: () => upsert({
      data: {
        mode,
        provider: mode === "own" ? provider : null,
        api_key: apiKey || undefined,
        from_email: mode === "own" ? fromEmail : null,
        from_name: mode === "own" ? (fromName || null) : null,
        mailgun_domain: mode === "own" && provider === "mailgun" ? mgDomain : null,
        mailgun_region: mode === "own" && provider === "mailgun" ? mgRegion : null,
      },
    }),
    onSuccess: () => { toast.success("E-Mail-Einstellungen gespeichert"); qc.invalidateQueries({ queryKey: ["domain-email-settings"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const m_test = useMutation({
    mutationFn: () => test({ data: { to: testTo } }),
    onSuccess: (r: any) => toast.success(`Testmail gesendet (${r?.source}/${r?.provider})`),
    onError: (e: any) => toast.error(e?.message ?? "Test fehlgeschlagen"),
  });

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="size-5 text-primary" />
          <h2 className="font-semibold">E-Mail-Versand</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Wähle, ob du den zentralen AlarmDesk-Versand oder eigene Zugangsdaten (Resend, Mailgun oder SendGrid) verwenden möchtest.
        </p>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30">
            <RadioGroupItem value="platform" className="mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm">AlarmDesk-Versand verwenden</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {platformAvailable
                  ? `Zentraler Absender (${q.data?.platform_from})`
                  : "Derzeit nicht verfügbar – Superadmin muss Plattform-Versand konfigurieren."}
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30">
            <RadioGroupItem value="own" className="mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm">Eigene Zugangsdaten verwenden</div>
              <div className="text-xs text-muted-foreground mt-0.5">Versand erfolgt von deinem Absender, über deinen Provider.</div>
            </div>
          </label>
        </RadioGroup>

        {mode === "own" && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="mailgun">Mailgun</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><KeyRound className="size-3" /> API-Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={s?.has_api_key ? "•••• gespeichert (zum Ändern neu eingeben)" : "API-Key einfügen"}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Absender E-Mail</Label>
                <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="versand@deine-domain.de" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Absender-Name (optional)</Label>
                <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="z.B. Sicherheitsdienst Müller" />
              </div>
              {provider === "mailgun" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mailgun-Domain</Label>
                    <Input value={mgDomain} onChange={(e) => setMgDomain(e.target.value)} placeholder="mg.deine-domain.de" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mailgun-Region</Label>
                    <Select value={mgRegion} onValueChange={(v) => setMgRegion(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eu">EU</SelectItem>
                        <SelectItem value="us">US</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-6">
          <Button onClick={() => m_save.mutate()} disabled={m_save.isPending} className="gap-2">
            {m_save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Speichern
          </Button>
          <div className="flex-1" />
          <Input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Testmail an…"
            className="max-w-xs"
          />
          <Button variant="outline" onClick={() => m_test.mutate()} disabled={m_test.isPending || !testTo} className="gap-2">
            {m_test.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Testmail senden
          </Button>
        </div>
      </div>
    </div>
  );
}