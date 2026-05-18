import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText, ShieldAlert, Phone, StickyNote, Plus, Trash2, Pencil,
  Bold, Italic, Underline as UnderlineIcon, Link2, Paperclip, Download,
} from "lucide-react";
import {
  getCurrentBudekoNotdienst,
  listBudekoNotdienst,
  listBudekoMitarbeiter,
  upsertBudekoNotdienst,
  deleteBudekoNotdienst,
  getBudekoConfig,
  updateBudekoConfig,
  uploadBudekoNotizDatei,
  deleteBudekoNotizDatei,
} from "@/lib/budeko.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "isomorphic-dompurify";

export const Route = createFileRoute("/_authenticated/notdienst/budeko/")({
  component: Dashboard,
});

function fmtDe(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Dashboard() {
  const currentFn = useServerFn(getCurrentBudekoNotdienst);
  const cfgFn = useServerFn(getBudekoConfig);
  const { data: current } = useQuery({
    queryKey: ["bk-notdienst-current"],
    queryFn: () => currentFn(),
    refetchInterval: 60_000,
  });
  const { data: cfg } = useQuery({
    queryKey: ["bk-config"],
    queryFn: () => cfgFn(),
  });

  const aktiv = current?.eintrag as any;

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Tile
        icon={FileText}
        tone="info"
        title="Neuer Bericht"
        desc="Erfassen Sie ein neues Einsatzformular schnell und unkompliziert."
        cta={<Link to="/notdienst/budeko/neu"><Button>Bericht erstellen</Button></Link>}
      />
      <Tile
        icon={ShieldAlert}
        tone="success"
        title="Nachbearbeitung"
        desc="Anzeigen, bearbeiten oder löschen Sie bestehende Berichte."
        cta={<Link to="/notdienst/budeko/nachbearbeitung"><Button variant="secondary">Berichte verwalten</Button></Link>}
      />
      <Tile
        icon={Phone}
        tone="destructive"
        title="Notdienst"
        desc={
          aktiv ? (
            <div className="text-sm space-y-1">
              <KV label="Zuständig" value={aktiv.mitarbeiter?.name ?? "–"} />
              {aktiv.mitarbeiter?.telefon_1 && (
                <KV label="Telefon" value={aktiv.mitarbeiter.telefon_1} />
              )}
              <KV label="Zeitraum" value={`${fmtDe(aktiv.von)} – ${fmtDe(aktiv.bis)}`} />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Aktuell kein aktiver Notdienst hinterlegt.</span>
          )
        }
        cta={<NotdienstDialog />}
      />
      <Tile
        icon={StickyNote}
        tone="warning"
        title="Notizen"
        desc={
          <NotizContent
            html={cfg?.notiz ?? null}
            dateien={(cfg?.dateien ?? []) as any[]}
          />
        }
        cta={<NotizDialog cfg={cfg} />}
      />
    </div>
  );
}

function NotizContent({ html, dateien }: { html: string | null; dateien: any[] }) {
  return (
    <div className="space-y-3">
      {html ? (
        <div
          className="text-sm prose-sm max-w-none [&_a]:text-primary [&_a]:underline whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
        />
      ) : (
        <span className="text-sm text-muted-foreground">Noch keine Notiz hinterlegt.</span>
      )}
      {dateien.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {dateien.map((d) => {
            const url = supabase.storage.from("budeko-notizen").getPublicUrl(d.storage_path).data.publicUrl;
            return (
              <a
                key={d.id}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-muted hover:bg-accent transition-colors"
              >
                <Download className="size-3" /> {d.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotizDialog({ cfg }: { cfg: any }) {
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const updFn = useServerFn(updateBudekoConfig);
  const upFn = useServerFn(uploadBudekoNotizDatei);
  const delFn = useServerFn(deleteBudekoNotizDatei);

  useEffect(() => {
    if (open && editorRef.current) editorRef.current.innerHTML = cfg?.notiz ?? "";
  }, [open, cfg]);

  const save = useMutation({
    mutationFn: async () => {
      const html = editorRef.current?.innerHTML ?? "";
      return updFn({ data: { notiz: html } });
    },
    onSuccess: () => {
      toast.success("Notiz gespeichert");
      qc.invalidateQueries({ queryKey: ["bk-config"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return upFn({
        data: {
          label: file.name.replace(/\.[^.]+$/, ""),
          filename: file.name,
          mime_type: file.type || null,
          file_base64: b64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Datei hochgeladen");
      qc.invalidateQueries({ queryKey: ["bk-config"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Upload fehlgeschlagen"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bk-config"] }),
  });

  if (!isAdmin) return null;

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary"><Pencil className="size-4 mr-1.5" /> Notiz bearbeiten</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><StickyNote className="size-4" /> Notiz & Anhänge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Notiz-Text</Label>
            <div className="rounded-lg border border-border bg-background">
              <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
                <ToolbarBtn onClick={() => exec("bold")} title="Fett"><Bold className="size-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => exec("italic")} title="Kursiv"><Italic className="size-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => exec("underline")} title="Unterstrichen"><UnderlineIcon className="size-3.5" /></ToolbarBtn>
                <div className="w-px h-5 bg-border mx-1" />
                <ToolbarBtn onClick={() => exec("foreColor", "#dc2626")} title="Rot"><span className="size-3.5 rounded-full bg-destructive" /></ToolbarBtn>
                <ToolbarBtn onClick={() => exec("foreColor", "inherit")} title="Standard"><span className="size-3.5 rounded-full border border-border" /></ToolbarBtn>
                <div className="w-px h-5 bg-border mx-1" />
                <ToolbarBtn
                  onClick={() => {
                    const url = prompt("Link-URL");
                    if (url) exec("createLink", url);
                  }}
                  title="Link"
                ><Link2 className="size-3.5" /></ToolbarBtn>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[140px] max-h-[300px] overflow-y-auto p-3 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Paperclip className="size-3.5" /> Datei-Anhänge</Label>
            <div className="space-y-1.5">
              {(cfg?.dateien ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground">Keine Anhänge.</div>
              )}
              {(cfg?.dateien ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-sm border border-border rounded-md px-3 py-1.5">
                  <span className="truncate">{d.label}</span>
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(d.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button asChild size="sm" variant="secondary" disabled={upload.isPending}>
                <span><Plus className="size-3.5 mr-1" /> {upload.isPending ? "Lade…" : "Datei hinzufügen"}</span>
              </Button>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolbarBtn({
  onClick, title, children,
}: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="size-7 grid place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  );
}

const TONE_MAP: Record<string, string> = {
  info: "bg-info/15 text-info",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

function Tile({
  icon: Icon, tone, title, desc, cta,
}: { icon: any; tone: string; title: string; desc: React.ReactNode; cta?: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-6 transition hover:border-primary/40 flex flex-col"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`size-10 rounded-lg grid place-items-center ${TONE_MAP[tone]}`}>
          <Icon className="size-5" />
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="text-sm text-muted-foreground mb-5 flex-1">{desc}</div>
      {cta && <div>{cta}</div>}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function NotdienstDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listBudekoNotdienst);
  const mitFn = useServerFn(listBudekoMitarbeiter);
  const upsertFn = useServerFn(upsertBudekoNotdienst);
  const delFn = useServerFn(deleteBudekoNotdienst);

  const { data: list } = useQuery({
    queryKey: ["bk-notdienst-list"], queryFn: () => listFn(), enabled: open,
  });
  const { data: mit } = useQuery({
    queryKey: ["bk-mitarbeiter"], queryFn: () => mitFn(), enabled: open,
  });
  const mitarbeiter = (mit?.mitarbeiter ?? []) as any[];
  const eintraege = (list?.eintraege ?? []) as any[];

  const [mid, setMid] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const selected = mitarbeiter.find((m) => m.id === mid);

  const upsert = useMutation({
    mutationFn: (input: any) => upsertFn({ data: input }),
    onSuccess: () => {
      toast.success("Notdienst gespeichert");
      setMid(""); setVon(""); setBis("");
      qc.invalidateQueries({ queryKey: ["bk-notdienst-current"] });
      qc.invalidateQueries({ queryKey: ["bk-notdienst-list"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Eintrag gelöscht");
      qc.invalidateQueries({ queryKey: ["bk-notdienst-current"] });
      qc.invalidateQueries({ queryKey: ["bk-notdienst-list"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Notdienst eintragen</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-4" /> Notdienst bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mitarbeiter auswählen</Label>
            <Select value={mid} onValueChange={setMid}>
              <SelectTrigger><SelectValue placeholder="Bitte auswählen" /></SelectTrigger>
              <SelectContent>
                {mitarbeiter.length === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    Keine Mitarbeiter – bitte zuerst unter „Mitarbeiter" anlegen.
                  </div>
                )}
                {mitarbeiter.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Von</Label>
              <Input type="datetime-local" value={von} onChange={(e) => setVon(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bis</Label>
              <Input type="datetime-local" value={bis} onChange={(e) => setBis(e.target.value)} />
            </div>
          </div>
          {selected && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="font-semibold mb-1">Vorschau:</div>
              <div><b>Name:</b> {selected.name}</div>
              <div><b>Telefon 1:</b> {selected.telefon_1 ?? "–"}</div>
              <div><b>Telefon 2:</b> {selected.telefon_2 ?? "–"}</div>
            </div>
          )}
          <div className="border-t pt-3">
            <div className="text-sm font-semibold mb-2">Aktuelle Einträge</div>
            <div className="max-h-48 overflow-auto space-y-1.5">
              {eintraege.length === 0 && <div className="text-sm text-muted-foreground">Keine Einträge.</div>}
              {eintraege.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2">
                  <div>
                    <div className="font-medium">{e.mitarbeiter?.name ?? "–"}</div>
                    <div className="text-xs text-muted-foreground">{fmtDe(e.von)} – {fmtDe(e.bis)}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(e.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              upsert.mutate({
                mitarbeiter_id: mid,
                von: new Date(von).toISOString(),
                bis: new Date(bis).toISOString(),
              })
            }
            disabled={!mid || !von || !bis || upsert.isPending}
          >
            <Plus className="size-4 mr-1" /> Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}