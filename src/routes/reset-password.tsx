import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import logo from "@/assets/alarmdesk-logo.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hasRecovery, setHasRecovery] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasRecovery(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (data.session || hash.includes("type=recovery") || hash.includes("access_token")) {
        setHasRecovery(true);
      } else {
        setHasRecovery(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Passwort aktualisiert");
      setTimeout(() => navigate({ to: "/dashboard" }), 1500);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center gap-3 justify-center">
          <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center" style={{ boxShadow: "var(--shadow-glow)" }}>
            <img src={logo} alt="AlarmDesk" className="size-6 object-contain" />
          </div>
          <div>
            <div className="text-xl font-bold">AlarmDesk</div>
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Einsatzverwaltung</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 md:p-10" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight">
              {done ? "Erledigt" : "Neues Passwort"}
            </h2>
            <p className="text-muted-foreground mt-2">
              {done ? "Du wirst weitergeleitet…" : "Lege ein neues Passwort für deinen Zugang fest."}
            </p>
          </div>

          {hasRecovery === false ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Link ungültig oder abgelaufen</p>
                  <p className="text-muted-foreground mt-1">Bitte fordere einen neuen Reset-Link an.</p>
                </div>
              </div>
              <Link to="/login" className="block w-full text-center py-3 px-4 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors">
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : done ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
              <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">Passwort aktualisiert</p>
                <p className="text-muted-foreground mt-1">Du wirst zum Dashboard weitergeleitet.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div className="space-y-2.5">
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Neues Passwort</label>
                <div className="relative">
                  <Lock className="absolute inset-y-0 left-4 my-auto size-[18px] text-muted-foreground pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 8 Zeichen"
                    className="w-full bg-input border border-border rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Bestätigen</label>
                <div className="relative">
                  <Lock className="absolute inset-y-0 left-4 my-auto size-[18px] text-muted-foreground pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Passwort wiederholen"
                    className="w-full bg-input border border-border rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || hasRecovery === null}
                className="w-full group relative flex items-center justify-center py-4 px-6 rounded-xl text-primary-foreground font-bold transition-all overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ boxShadow: "var(--shadow-glow)" }}
              >
                <div className="absolute inset-0 transition-transform group-hover:scale-105" style={{ background: "var(--gradient-primary)" }} />
                <span className="relative flex items-center gap-2">
                  {loading ? "Wird gespeichert…" : "Passwort speichern"}
                  {!loading && <ArrowRight className="size-[18px] group-hover:translate-x-0.5 transition-transform" />}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}