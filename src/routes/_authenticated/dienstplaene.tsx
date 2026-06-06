import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Upload, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/dienstplaene")({
  component: DienstplaenePage,
});

function fmtSize(n?: number | null) {
  if (!n) return "–";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DienstplaenePage() {
  const { isAdmin, domainId } = useRole();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const list = useQuery({
    queryKey: ["dienstplaene", domainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dienstplaene")
        .select("id,title,file_path,file_size,created_at,uploaded_by")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!domainId,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !domainId) throw new Error("Datei und Domäne erforderlich");
      if (file.type !== "application/pdf") throw new Error("Nur PDF-Dateien sind erlaubt");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${domainId}/${Date.now()}_${safe}`;
      const up = await supabase.storage.from("dienstplaene").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) throw up.error;
      const ins = await supabase.from("dienstplaene").insert({
        domain_id: domainId,
        title: title.trim() || file.name.replace(/\.pdf$/i, ""),
        file_path: path,
        file_size: file.size,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      });
      if (ins.error) {
        await supabase.storage.from("dienstplaene").remove([path]);
        throw ins.error;
      }
    },
    onSuccess: () => {
      toast.success("Dienstplan hochgeladen");
      setTitle(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["dienstplaene"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Upload fehlgeschlagen"),
  });

  const remove = useMutation({
    mutationFn: async (row: { id: string; file_path: string }) => {
      await supabase.storage.from("dienstplaene").remove([row.file_path]);
      const { error } = await supabase.from("dienstplaene").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dienstplan gelöscht");
      qc.invalidateQueries({ queryKey: ["dienstplaene"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Löschen fehlgeschlagen"),
  });

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("dienstplaene").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error("Konnte Datei nicht öffnen"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <CalendarDays className="size-3.5" /> Dienstpläne
        </div>
        <h1 className="text-3xl font-bold mt-1">Dienstpläne</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? "Lade die aktuellen Dienstpläne als PDF hoch — alle Mitarbeiter deiner Domäne können sie öffnen."
            : "Hier findest du die von deiner Leitung hochgeladenen Dienstpläne."}
        </p>
      </div>

      {isAdmin && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <h2 className="font-semibold flex items-center gap-2"><Upload className="size-4" /> Neuer Dienstplan</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Titel (optional)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. KW 24/2026" />
            </div>
            <div className="space-y-1.5">
              <Label>PDF-Datei</Label>
              <Input ref={fileRef} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending} className="gap-2">
              {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Hochladen
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Verfügbare Dienstpläne</h2>
        </div>
        {list.isLoading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Lade…</div>
        ) : (list.data ?? []).length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Noch keine Dienstpläne vorhanden.</div>
        ) : (
          <ul className="divide-y divide-border">
            {(list.data ?? []).map((r: any) => (
              <li key={r.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(r.created_at)} · {fmtSize(r.file_size)}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openFile(r.file_path)} className="gap-2">
                  <Download className="size-4" /> Öffnen
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { if (confirm("Diesen Dienstplan wirklich löschen?")) remove.mutate({ id: r.id, file_path: r.file_path }); }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
