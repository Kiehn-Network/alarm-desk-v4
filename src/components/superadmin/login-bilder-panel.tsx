import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";

const BUCKET = "login-bilder";
const MAX = 1024 * 1024 * 1024;

export function LoginBilderPanel() {
  const [items, setItems] = useState<{ name: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.storage.from(BUCKET).list("", { limit: 50 });
    const files = (data ?? []).filter((f) => f.id);
    if (!files.length) return setItems([]);
    const { data: s } = await supabase.storage.from(BUCKET).createSignedUrls(files.map((f) => f.name), 3600);
    setItems((s ?? []).map((x, i) => ({ name: files[i]!.name, url: x.signedUrl ?? "" })));
  };
  useEffect(() => { load(); }, []);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(list)) {
        if (!f.type.startsWith("image/")) { toast.error(`${f.name}: kein Bild`); continue; }
        if (f.size > MAX) { toast.error(`${f.name}: größer als 1 GB`); continue; }
        const ext = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const { error } = await supabase.storage.from(BUCKET).upload(`${crypto.randomUUID()}.${ext}`, f, { contentType: f.type });
        if (error) toast.error(`${f.name}: ${error.message}`);
      }
      toast.success("Bilder hochgeladen");
      await load();
    } finally { setBusy(false); }
  };

  const remove = async (name: string) => {
    const { error } = await supabase.storage.from(BUCKET).remove([name]);
    if (error) return toast.error(error.message);
    toast.success("Bild gelöscht");
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Bilder der Anmeldeseite</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sind hier Bilder hinterlegt, zeigt die Anmeldeseite zufällig eines davon statt der Standardbilder. Max. 1 GB pro Bild.
        </p>
        <label className="inline-flex">
          <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            <Upload className="h-4 w-4" /> {busy ? "Lädt hoch…" : "Bilder hochladen"}
          </span>
        </label>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine eigenen Bilder – Standardbilder aktiv.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((it) => (
              <div key={it.name} className="group relative overflow-hidden rounded-lg border">
                <img src={it.url} alt="" className="aspect-video w-full object-cover" />
                <Button size="icon" variant="destructive" className="absolute right-2 top-2 h-8 w-8" onClick={() => remove(it.name)} aria-label="Bild löschen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
