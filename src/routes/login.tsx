import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import logo from "@/assets/alarmdesk-logo.png";
import { Mail, Lock, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import hero1 from "@/assets/login-hero-1.jpg";
import hero2 from "@/assets/login-hero-2.jpg";
import hero3 from "@/assets/login-hero-3.jpg";
import hero4 from "@/assets/login-hero-4.jpg";
import { toAuthPassword } from "@/lib/password-compat";

const HERO_IMAGES = [hero1, hero2, hero3, hero4];

function getRandomHero() {
  return HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)];
}

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
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.classList.contains("light") ? "light" : html.classList.contains("dark") ? "dark" : null;
    const prevTheme = html.getAttribute("data-theme");
    html.classList.remove("light", "dark");
    html.classList.add("light");
    if (!html.getAttribute("data-theme")) html.setAttribute("data-theme", "midnight");
    return () => {
      html.classList.remove("light", "dark");
      if (prev) html.classList.add(prev);
      if (prevTheme === null) html.removeAttribute("data-theme");
      else html.setAttribute("data-theme", prevTheme);
    };
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [heroImage] = useState(getRandomHero);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);
  const [dbStatus, setDbStatus] = useState<"connecting" | "online" | "offline">("connecting");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!cancelled) setDbStatus((s) => (s === "online" ? s : "connecting"));
      try {
        const r = await fetch("/api/public/version", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        if (cancelled) return;
        setInfo(data);
        setDbStatus("online");
      } catch {
        if (!cancelled) setDbStatus("offline");
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: toAuthPassword(password),
      });
      if (error) throw error;
      toast.success("Willkommen!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Anmelden");
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("E-Mail wurde versendet");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Senden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground antialiased">
      {/* Left: Visual + Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={heroImage}
          alt="AlarmDesk Leitstelle"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, oklch(0.68 0.17 255 / 30%) 0, transparent 50%), radial-gradient(circle at 80% 80%, oklch(0.78 0.13 235 / 25%) 0, transparent 50%)",
        }} />

        <div className="relative z-10 p-16 flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center" style={{ boxShadow: "var(--shadow-glow)" }}>
              <img src={logo} alt="AlarmDesk" className="size-6 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AlarmDesk</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] leading-none mt-1">Einsatzverwaltung</p>
            </div>
          </div>

          <div className="max-w-md">
            <div className="flex gap-2 mb-8">
              <StatusBadge status={dbStatus} />
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-primary/15 text-primary border border-primary/20 uppercase tracking-wider">
                v{info?.current_version ?? "…"}
              </span>
            </div>
            <h2 className="text-5xl font-bold mb-6 leading-[1.15]">
              Schnell.<br/>Übersichtlich.<br/>
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>Im Einsatz bereit.</span>
            </h2>
            <p className="text-lg text-muted-foreground font-medium">
              Verwalte Einsätze, Fahrer, Schlüssel und Notdienste an einem zentralen Ort.
            </p>
          </div>

          <VersionBadge info={info} />
        </div>
      </div>

      {/* Right: Login Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[440px]">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center">
              <img src={logo} alt="AlarmDesk" className="size-6 object-contain" />
            </div>
            <div>
              <div className="font-bold">AlarmDesk</div>
              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Einsatzverwaltung</div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 md:p-10 relative" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="mb-10">
              <h2 className="text-3xl font-bold tracking-tight">
                {mode === "login" ? "Anmelden" : resetSent ? "E-Mail versendet" : "Passwort vergessen"}
              </h2>
              <p className="text-muted-foreground mt-2">
                {mode === "login"
                  ? "Willkommen zurück im Dashboard"
                  : resetSent
                    ? "Prüfe dein Postfach für den Reset-Link."
                    : "Wir senden dir einen Link zum Zurücksetzen."}
              </p>
            </div>

            {mode === "forgot" && resetSent ? (
              <div className="space-y-6">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
                  <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">Link gesendet an</p>
                    <p className="text-muted-foreground break-all">{email}</p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Der Link ist 60 Minuten gültig. Schaue auch im Spam-Ordner nach.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setMode("login"); setResetSent(false); }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
                >
                  <ArrowLeft className="size-4" /> Zurück zur Anmeldung
                </button>
              </div>
            ) : mode === "forgot" ? (
              <form onSubmit={submitForgot} className="space-y-6">
                <div className="space-y-2.5">
                  <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">E-Mail</label>
                  <div className="relative">
                    <Mail className="absolute inset-y-0 left-4 my-auto size-[18px] text-muted-foreground pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nutzer@organisation.de"
                      className="w-full bg-input border border-border rounded-xl py-4 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full group relative flex items-center justify-center py-4 px-6 rounded-xl text-primary-foreground font-bold transition-all overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ boxShadow: "var(--shadow-glow)" }}
                >
                  <div className="absolute inset-0 transition-transform group-hover:scale-105" style={{ background: "var(--gradient-primary)" }} />
                  <span className="relative flex items-center gap-2">
                    {loading ? "Wird gesendet…" : "Reset-Link senden"}
                    {!loading && <ArrowRight className="size-[18px] group-hover:translate-x-0.5 transition-transform" />}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="size-4" /> Zurück zur Anmeldung
                </button>
              </form>
            ) : (
            <form onSubmit={submit} className="space-y-6">
              <div className="space-y-2.5">
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">E-Mail</label>
                <div className="relative">
                  <Mail className="absolute inset-y-0 left-4 my-auto size-[18px] text-muted-foreground pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nutzer@organisation.de"
                    className="w-full bg-input border border-border rounded-xl py-4 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Passwort</label>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setResetSent(false); }}
                    className="text-[12px] font-semibold text-primary hover:underline"
                  >
                    Vergessen?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute inset-y-0 left-4 my-auto size-[18px] text-muted-foreground pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-input border border-border rounded-xl py-4 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full group relative flex items-center justify-center py-4 px-6 rounded-xl text-primary-foreground font-bold transition-all overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ boxShadow: "var(--shadow-glow)" }}
              >
                <div className="absolute inset-0 transition-transform group-hover:scale-105" style={{ background: "var(--gradient-primary)" }} />
                <span className="relative flex items-center gap-2">
                  {loading ? "Bitte warten…" : "Anmelden"}
                  {!loading && <ArrowRight className="size-[18px] group-hover:translate-x-0.5 transition-transform" />}
                </span>
              </button>
            </form>
            )}

            <div className="mt-10 pt-8 border-t border-border">
              <p className="text-center text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                Zugänge werden ausschließlich durch den zuständigen Administrator verwaltet.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center lg:hidden">
            <VersionBadge info={info} />
          </div>
        </div>
      </div>
    </div>
  );
}

function VersionBadge({ info }: { info: VersionInfo | null }) {
  const version = info?.current_version ?? "…";
  return (
    <div className="inline-flex flex-col lg:flex-row items-center gap-0.5 lg:gap-2 px-3 py-1.5 rounded-lg bg-card/60 border border-border/50 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground tracking-tight">
        <span>© 2026 AlarmDesk</span>
        <span className="text-border">·</span>
        <Dialog>
          <DialogTrigger asChild>
            <button className="text-primary hover:underline">v{version}</button>
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
      <div className="text-[9px] text-muted-foreground leading-none lg:pl-2 lg:border-l lg:border-border/50">
        Ein Produkt vom <span className="font-medium text-foreground/80">Kiehn Network</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "connecting" | "online" | "offline" }) {
  const cfg = {
    online: { label: "System Online", cls: "bg-success/15 text-success border-success/20", dot: "bg-success", ping: true },
    connecting: { label: "Verbindungsaufbau…", cls: "bg-warning/15 text-warning border-warning/20", dot: "bg-warning", ping: true },
    offline: { label: "Keine Verbindung möglich", cls: "bg-destructive/15 text-destructive border-destructive/20", dot: "bg-destructive", ping: false },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border uppercase tracking-wider ${cfg.cls}`}>
      <span className="relative flex h-1.5 w-1.5">
        {cfg.ping && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dot}`} />}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
      </span>
      {cfg.label}
    </span>
  );
}
