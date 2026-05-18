import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Plus, FileText, Image as ImageIcon, Trash2, Pencil, Loader2, Paperclip, X, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { listIntrahubPosts, createIntrahubPost, updateIntrahubPost, deleteIntrahubPost } from "@/lib/intrahub.functions";

export const Route = createFileRoute("/_authenticated/intrahub")({
  component: IntraHubPage,
});

type Attachment = { path: string; name: string; mime?: string | null; size?: number | null };
type Post = {
  id: string;
  title: string;
  content: string;
  attachments: Attachment[];
  created_by: string;
  created_at: string;
  updated_at: string;
  author: { display_name: string | null; avatar_url: string | null } | null;
};

function publicUrl(path: string) {
  return supabase.storage.from("intrahub").getPublicUrl(path).data.publicUrl;
}

function IntraHubPage() {
  const { user } = useAuth();
  const { role } = useRole();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const list = useServerFn(listIntrahubPosts);
  const { data, isLoading } = useQuery({ queryKey: ["intrahub-posts"], queryFn: () => list() });
  const posts = (data?.posts ?? []) as Post[];

  const [editing, setEditing] = useState<Post | null>(null);
  const [open, setOpen] = useState(false);

  const del = useServerFn(deleteIntrahubPost);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Beitrag gelöscht"); qc.invalidateQueries({ queryKey: ["intrahub-posts"] }); },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">IntraHub</h1>
          <p className="text-sm text-muted-foreground mt-1">Wissensband der Domäne — teile dein Wissen mit dem Team.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="size-4" /> Neuer Beitrag
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Lade…
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm text-muted-foreground">Noch keine Beiträge. Erstelle den ersten Wissensbeitrag.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => {
            const canEdit = isAdmin || p.created_by === user?.id;
            return (
              <article key={p.id} className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{p.title}</h2>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.author?.display_name ?? "Unbekannt"} · {new Date(p.created_at).toLocaleString("de-DE")}
                      {p.updated_at !== p.created_at && <span> · bearbeitet</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => {
                        if (confirm("Beitrag wirklich löschen?")) delMut.mutate(p.id);
                      }}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                {p.content && (
                  <p className="mt-3 text-sm whitespace-pre-wrap text-foreground/90">{p.content}</p>
                )}
                {p.attachments?.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {p.attachments.map((a) => {
                      const url = publicUrl(a.path);
                      const isImg = (a.mime ?? "").startsWith("image/");
                      return isImg ? (
                        <a key={a.path} href={url} target="_blank" rel="noopener" className="block rounded-lg overflow-hidden border border-border bg-muted/30 aspect-square">
                          <img src={url} alt={a.name} className="size-full object-cover" />
                        </a>
                      ) : (
                        <a key={a.path} href={url} target="_blank" rel="noopener"
                          className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 hover:bg-muted transition-colors">
                          <FileText className="size-5 text-muted-foreground shrink-0" />
                          <span className="text-xs truncate flex-1">{a.name}</span>
                          <Download className="size-4 text-muted-foreground shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <PostDialog open={open} onClose={() => setOpen(false)} editing={editing} />
    </div>
  );
}

function PostDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Post | null }) {
  const qc = useQueryClient();
  const create = useServerFn(createIntrahubPost);
  const update = useServerFn(updateIntrahubPost);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(editing?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // reset when dialog opens
  const lastKey = useRef<string | null>(null);
  const key = open ? (editing?.id ?? "new") : null;
  if (key !== lastKey.current) {
    lastKey.current = key;
    if (open) {
      setTitle(editing?.title ?? "");
      setContent(editing?.content ?? "");
      setAttachments(editing?.attachments ?? []);
    }
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const next: Attachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 25 * 1024 * 1024) { toast.error(`${f.name}: max. 25 MB`); continue; }
        const ext = f.name.split(".").pop() ?? "bin";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("intrahub").upload(path, f, { contentType: f.type, upsert: false });
        if (error) { toast.error(`${f.name}: ${error.message}`); continue; }
        next.push({ path, name: f.name, mime: f.type, size: f.size });
      }
      setAttachments((prev) => [...prev, ...next]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAttachment(a: Attachment) {
    setAttachments((prev) => prev.filter((x) => x.path !== a.path));
    // best-effort remove from storage if it was newly uploaded; ignore errors
    await supabase.storage.from("intrahub").remove([a.path]).catch(() => {});
  }

  async function onSave() {
    if (!title.trim()) { toast.error("Titel ist erforderlich"); return; }
    setSaving(true);
    try {
      if (editing) {
        await update({ data: { id: editing.id, title: title.trim(), content, attachments } });
        toast.success("Beitrag aktualisiert");
      } else {
        await create({ data: { title: title.trim(), content, attachments } });
        toast.success("Beitrag erstellt");
      }
      qc.invalidateQueries({ queryKey: ["intrahub-posts"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Beitrag bearbeiten" : "Neuer Beitrag"}</DialogTitle>
          <DialogDescription>Teile dein Wissen mit dem Team. Bilder und PDFs können angehängt werden.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="z. B. Vorgehen bei Schlüsselverlust" />
          </div>
          <div className="space-y-1.5">
            <Label>Inhalt</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Beschreibe ausführlich…" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Anhänge (Bilder, PDF)</Label>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
                Datei wählen
              </Button>
              <input ref={fileRef} type="file" multiple accept="image/*,application/pdf"
                className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
            </div>
            {attachments.length > 0 && (
              <ul className="space-y-1.5">
                {attachments.map((a) => (
                  <li key={a.path} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                    {(a.mime ?? "").startsWith("image/") ? <ImageIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
                    <span className="text-xs flex-1 truncate">{a.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{a.size ? `${(a.size / 1024).toFixed(0)} KB` : ""}</Badge>
                    <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => removeAttachment(a)}>
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button onClick={onSave} disabled={saving || uploading}>
            {saving && <Loader2 className="size-4 animate-spin mr-2" />} Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}