import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Send, Save, Loader2, KeyRound, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getPlatformEmailSettings, upsertPlatformEmailSettings, sendPlatformTestEmail,
} from "@/lib/email-settings.functions";
import { useAuth } from "@/hooks/use-auth";

export function PlatformEmailPanel() {
  const get = useServerFn(getPlatformEmailSettings);
  const upsert = useServerFn(upsertPlatformEmailSettings);
  const test = useServerFn(sendPlatformTestEmail);
  const qc = useQueryClient();
  const { user } = useAuth();

  const q = useQuery({ queryKey: ["platform-email-settings"], queryFn: () => get() });
  const s = q.data?.settings;

  const [provider, setProvider] = useState<"resend" | "mailgun" | "sendgrid" | "smtp">("resend");
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("AlarmDesk");
  const [mgDomain, setMgDomain] = useState("");
  const [mgRegion, setMgRegion] = useState<"us" | "eu">("eu");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number | "">(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecure, setSmtpSecure] = useState<"ssl" | "starttls" | "none">("starttls");
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (!s) return;
    setProvider((s.provider as any) ?? "resend");
    setFromEmail(s.from_email ?? "");
    setFromName(s.from_name ?? "AlarmDesk");
    setMgDomain(s.mailgun_domain ?? "");
    setMgRegion((s.mailgun_region as any) ?? "eu");
    setApiKey("");
    setSmtpHost((s as any).smtp_host ?? "");
    setSmtpPort((s as any).smtp_port ?? 587);
    setSmtpUser((s as any).smtp_username ?? "");
    setSmtpPass("");
    setSmtpSecure(((s as any).smtp_secure as any) ?? "starttls");
  }, [s?.provider, s?.from_email, s?.from_name, s?.mailgun_domain, s?.mailgun_region, (s as any)?.smtp_host, (s as any)?.smtp_port, (s as any)?.smtp_username, (s as any)?.smtp_secure]);

  useEffect(() => { if (user?.email && !testTo) setTestTo(user.email); }, [user?.email]);

  const m_save = useMutation({
    mutationFn: () => upsert({
      data: {
        provider,
        api_key: apiKey || undefined,
        from_email: fromEmail,
        from_name: fromName || null,
        mailgun_domain: provider === "mailgun" ? mgDomain : null,
        mailgun_region: provider === "mailgun" ? mgRegion : undefined,
        smtp_host: provider === "smtp" ? smtpHost : null,
        smtp_port: provider === "smtp" ? (smtpPort === "" ? null : Number(smtpPort)) : null,
        smtp_username: provider === "smtp" ? smtpUser : null,
        smtp_password: provider === "smtp" ? (smtpPass || undefined) : undefined,
        smtp_secure: provider === "smtp" ? smtpSecure : undefined,
      },
    }),
    onSuccess: () => { toast.success("Plattform-E-Mail-Einstellungen gespeichert"); qc.invalidateQueries({ queryKey: ["platform-email-settings"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const m_test = useMutation({
    mutationFn: () => test({ data: { to: testTo } }),
    onSuccess: () => toast.success("Testmail gesendet"),
    onError: (e: any) => toast.error(e?.message ?? "Test fehlgeschlagen"),
  });

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;

  return (
    <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Mail className="size-5 text-primary" />
        <h2 className="font-semibold">Plattform-E-Mail-Versand</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Zentrale Absender-Zugangsdaten für AlarmDesk. Diese werden verwendet, wenn eine Domäne keinen eigenen Versand konfiguriert hat und „AlarmDesk-Versand" wählt.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="resend">Resend</SelectItem>
              <SelectItem value="mailgun">Mailgun</SelectItem>
              <SelectItem value="sendgrid">SendGrid</SelectItem>
              <SelectItem value="smtp">SMTP (eigener Mailserver)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {provider !== "smtp" && <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><KeyRound className="size-3" /> API-Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={s?.has_api_key ? "•••• gespeichert (zum Ändern neu eingeben)" : "API-Key einfügen"}
          />
        </div>}
        <div className="space-y-1.5">
          <Label className="text-xs">Absender E-Mail</Label>
          <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="versand@alarmdesk-software.de" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Absender-Name</Label>
          <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="AlarmDesk" />
        </div>
        {provider === "mailgun" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Mailgun-Domain</Label>
              <Input value={mgDomain} onChange={(e) => setMgDomain(e.target.value)} placeholder="mg.alarmdesk-software.de" />
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
        {provider === "smtp" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Server className="size-3" /> SMTP-Host</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.deine-domain.de" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Port</Label>
              <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value === "" ? "" : Number(e.target.value))} placeholder="587" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Benutzername</Label>
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="user@deine-domain.de" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Passwort</Label>
              <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder={(s as any)?.has_smtp_password ? "•••• gespeichert" : "SMTP-Passwort"} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Verschlüsselung</Label>
              <Select value={smtpSecure} onValueChange={(v) => setSmtpSecure(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starttls">STARTTLS (Port 587)</SelectItem>
                  <SelectItem value="ssl">SSL/TLS (Port 465)</SelectItem>
                  <SelectItem value="none">Keine (nicht empfohlen)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

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
  );
}