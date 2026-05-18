import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { User as UserIcon, Upload, Save, Lock, Sun, Moon, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { useAppSettings } from "@/hooks/use-app-settings";

export const Route = createFileRoute("/_authenticated/profil")({
  component: ProfilPage,
});

function ProfilPage() {
  const { user } = useAuth();
  const { mode, setMode } = useThemeMode();
  const { data: settings } = useAppSettings();
  const theme = ((settings as any)?.theme as string) ?? "midnight";
  const themeLabel = ({ midnight: "Midnight Blue", emerald: "Emerald Pro", slate: "Slate Mono", sunset: "Sunset Warm" } as Record<string,string>)[theme] ?? theme;
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(data?.display_name ?? (user.user_metadata?.display_name as string) ?? "");
      setAvatarUrl(data?.avatar_url ?? null);
      setLoadingProfile(false);
    })();
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    const name = displayName.trim();
    if (!name || name.length > 120) {
      toast.error("Name darf nicht leer sein (max. 120 Zeichen).");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", user.id);
    if (!error) {
      await supabase.auth.updateUser({ data: { display_name: name } });
      toast.success("Profil gespeichert.");
    } else {
      toast.error(error.message);
    }
    setSavingProfile(false);
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte ein Bild auswählen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maximal 5 MB.");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);
    if (updErr) {
      toast.error(updErr.message);
    } else {
      setAvatarUrl(url);
      await supabase.auth.updateUser({ data: { avatar_url: url } });
      toast.success("Profilbild aktualisiert.");
    }
    setUploading(false);
  }

  async function changePassword() {
    if (pw1.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (pw1 !== pw2) {
      toast.error("Passwörter stimmen nicht überein.");
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Passwort geändert.");
      setPw1("");
      setPw2("");
    }
    setSavingPw(false);
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mein Profil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bearbeite deinen Namen, dein Profilbild und dein Passwort.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 md:p-6 space-y-5">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Palette className="size-4 text-primary" /> Darstellung
        </h2>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            <div className="font-medium">Modus</div>
            <p className="text-xs text-muted-foreground">Persönliche Einstellung – nur für dich gespeichert.</p>
          </div>
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
            <button type="button" onClick={() => setMode("light")}
              className={`inline-flex items-center gap-2 px-3 h-8 rounded-md text-sm transition ${mode === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Sun className="size-4" /> Light
            </button>
            <button type="button" onClick={() => setMode("dark")}
              className={`inline-flex items-center gap-2 px-3 h-8 rounded-md text-sm transition ${mode === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Moon className="size-4" /> Dark
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap pt-2 border-t border-border">
          <div className="text-sm">
            <div className="font-medium">Theme</div>
            <p className="text-xs text-muted-foreground">Wird vom Administrator deiner Domäne festgelegt.</p>
          </div>
          <span className="text-sm px-3 h-8 inline-flex items-center rounded-md bg-muted text-muted-foreground">{themeLabel}</span>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 md:p-6 space-y-5">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <UserIcon className="size-4 text-primary" /> Persönliche Daten
        </h2>

        <div className="flex items-center gap-4">
          <div className="size-20 rounded-full overflow-hidden bg-muted grid place-items-center border border-border">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
            ) : (
              <UserIcon className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-secondary text-secondary-foreground text-sm hover:opacity-90 disabled:opacity-50 transition"
            >
              <Upload className="size-4" />
              {uploading ? "Lädt hoch…" : "Bild ändern"}
            </button>
            <p className="text-xs text-muted-foreground">JPG/PNG, max. 5 MB.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">E-Mail</label>
          <input
            value={user?.email ?? ""}
            disabled
            className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Anzeigename</label>
          <input
            value={displayName}
            disabled={loadingProfile}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            className="w-full h-10 px-3 rounded-lg bg-input/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveProfile}
            disabled={savingProfile || loadingProfile}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            <Save className="size-4" />
            {savingProfile ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 md:p-6 space-y-5">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Lock className="size-4 text-primary" /> Passwort ändern
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Neues Passwort</label>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              autoComplete="new-password"
              className="w-full h-10 px-3 rounded-lg bg-input/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Wiederholen</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              className="w-full h-10 px-3 rounded-lg bg-input/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
        <div className="flex justify-end">
          <button
            onClick={changePassword}
            disabled={savingPw || !pw1 || !pw2}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            <Lock className="size-4" />
            {savingPw ? "Ändern…" : "Passwort ändern"}
          </button>
        </div>
      </section>
    </div>
  );
}