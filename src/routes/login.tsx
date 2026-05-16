import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

type VersionInfo = {
  current_version: string;
  versions: { id: string; version: string; changelog: string | null; released_at: string }[];
};

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch("/api/public/version")
      .then((r) => r.json())
      .then((d) => setInfo(d))
      .catch(() => {});
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Willkommen zurück!");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account erstellt. Bitte E-Mail bestätigen.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Anmelden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative overflow-hidden" style={{ background: "var(--gradient-surface)" }}>
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, oklch(0.72 0.18 155 / 40%) 0, transparent 50%), radial-gradient(circle at 80% 80%, oklch(0.68 0.15 240 / 30%) 0, transparent 50%)",
        }} />
        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl grid place-items-center" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              <Radio className="size-6 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-semibold">AlarmDesk</div>
              <div className="text-xs text-muted-foreground">Einsatzleitstand</div>
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold leading-tight">Schnell.<br/>Übersichtlich.<br/><span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>Im Einsatz bereit.</span></h1>
            <p className="mt-4 text-muted-foreground max-w-md">Verwalte Einsätze, Fahrer, Schlüssel und Notdienste an einem Ort.</p>
          </div>
          <VersionBadge info={info} />
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="size-10 rounded-xl grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
              <Radio className="size-5 text-primary-foreground" />
            </div>
            <div className="font-semibold">AlarmDesk</div>
          </div>
          <h2 className="text-2xl font-bold">{mode === "login" ? "Anmelden" : "Konto erstellen"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Mit deinem Konto anmelden." : "Erstelle deinen Zugang."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Max Mustermann" />
              </Field>
            )}
            <Field label="E-Mail">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="du@firma.de" />
            </Field>
            <Field label="Passwort">
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••" />
            </Field>
            <button disabled={loading} className="w-full h-11 rounded-lg font-medium text-primary-foreground transition disabled:opacity-50" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              {loading ? "Bitte warten…" : mode === "login" ? "Anmelden" : "Konto erstellen"}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Noch kein Konto?" : "Bereits registriert?"}{" "}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary hover:underline font-medium">
              {mode === "login" ? "Registrieren" : "Anmelden"}
            </button>
          </div>
          <div className="mt-8 text-center lg:hidden">
            <VersionBadge info={info} />
          </div>
        </div>
      </div>
      <style>{`.input{width:100%;height:44px;padding:0 14px;border-radius:10px;background:var(--color-input);border:1px solid var(--color-border);color:var(--color-foreground);font-size:14px;transition:all .15s}.input:focus{outline:none;border-color:var(--color-primary);box-shadow:0 0 0 3px var(--color-ring)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function VersionBadge({ info }: { info: VersionInfo | null }) {
  const version = info?.current_version ?? "…";
  return (
    <div className="text-xs text-muted-foreground">
      © 2026 AlarmDesk ·{" "}
      <Dialog>
        <DialogTrigger asChild>
          <button className="text-primary hover:underline font-medium">v{version}</button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Changelog</DialogTitle>
            <DialogDescription>Aktuelle Version: v{version}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            {(info?.versions ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>
            )}
            {info?.versions.map((v) => (
              <div key={v.id} className="border-l-2 border-primary/40 pl-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold text-sm">v{v.version}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(v.released_at).toLocaleDateString("de-DE")}
                  </div>
                </div>
                {v.changelog && (
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground font-sans">
                    {v.changelog}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
