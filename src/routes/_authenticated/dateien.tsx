import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload, Search, Link2, Trash2, Download, FileText, Loader2,
  X, Eye, Link as LinkIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { supabase } from "@/integrations/supabase/client";
import {
  listDateien, createDatei, softDeleteDatei,
  linkDateien, unlinkDateien, getDateiSignedUrl,
} from "@/lib/dateien.functions";

type Datei = Awaited<ReturnType<typeof listDateien>>["dateien"][number];
type Link = Awaited<ReturnType<typeof listDateien>>["links"][number];

export const Route = createFileRoute("/_authenticated/dateien")({
  component: DateienPage,
});

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DateienPage() {
  const qc = useQueryClient();
  const list = useServerFn(listDateien);
  const { data, isLoading } = useQuery({
    queryKey: ["dateien"],
    queryFn: () => list(),
  });

  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<Datei | null>(null);
  const [detailFor, setDetailFor] = useState<Datei | null>(null);

  const dateien = data?.dateien ?? [];
  const links = data?.links ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return dateien;
    return dateien.filter((d) =>
      [d.filename, d.address, d.key_number, d.kunden_name, d.folder, d.anlagen_nr, d.teilnehmer_id]
        .filter(Boolean).some((v) => v!.toLowerCase().includes(s)),
    );
  }, [dateien, search]);

  const linkCount = (id: string) =>
    links.filter((l) => l.datei_a_id === id || l.datei_b_id === id).length;

  const refresh = () => qc.invalidateQueries({ queryKey: ["dateien"] });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Datei-Verwaltung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dateien.length} {dateien.length === 1 ? "Datei" : "Dateien"} gespeichert
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche nach Datei, Adresse, Kunde…"
              className="pl-9 w-[320px]"
            />
          </div>
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="size-4" /> Hochladen
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto size-14 rounded-full bg-muted grid place-items-center">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {dateien.length === 0 ? "Noch keine Dateien hochgeladen." : "Keine Treffer für deine Suche."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datei</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Schlüssel-Nr.</TableHead>
                <TableHead>Anlagen-Nr.</TableHead>
                <TableHead>Ordner</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => setDetailFor(d)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-primary shrink-0" />
                      <span className="truncate max-w-[260px]">{d.filename}</span>
                      {linkCount(d.id) > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <Link2 className="size-3" /> {linkCount(d.id)}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatSize(d.size_bytes)}</div>
                  </TableCell>
                  <TableCell>{d.kunden_name ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{d.address ?? "—"}</TableCell>
                  <TableCell>{d.key_number ?? "—"}</TableCell>
                  <TableCell>{d.anlagen_nr ?? "—"}</TableCell>
                  <TableCell>{d.folder ?? "—"}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setLinkFor(d)} title="Verknüpfen">
                        <Link2 className="size-4" />
                      </Button>
                      <DownloadBtn path={d.storage_path} filename={d.filename} />
                      <DeleteBtn id={d.id} onDone={refresh} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onDone={refresh} />
      {linkFor && (
        <LinkDialog
          datei={linkFor} all={dateien} links={links}
          onClose={() => setLinkFor(null)} onDone={refresh}
        />
      )}
      {detailFor && (
        <DetailDialog
          datei={detailFor} all={dateien} links={links}
          onClose={() => setDetailFor(null)}
        />
      )}
    </div>
  );
}

function DownloadBtn({ path, filename }: { path: string; filename: string }) {
  const sign = useServerFn(getDateiSignedUrl);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm" variant="ghost" title="Herunterladen" disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { url } = await sign({ data: { storage_path: path } });
          const a = document.createElement("a");
          a.href = url; a.download = filename; a.target = "_blank";
          document.body.appendChild(a); a.click(); a.remove();
        } catch (e: any) {
          toast.error(e.message);
        } finally { setBusy(false); }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
    </Button>
  );
}

function DeleteBtn({ id, onDone }: { id: string; onDone: () => void }) {
  const del = useServerFn(softDeleteDatei);
  const m = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => { toast.success("Datei gelöscht"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Button
      size="sm" variant="ghost" title="Löschen"
      onClick={() => { if (confirm("Diese Datei wirklich löschen?")) m.mutate(); }}
    >
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}

function UploadDialog({
  open, onOpenChange, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const create = useServerFn(createDatei);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    address: "", key_number: "", folder: "", kunden_name: "",
    notiz: "", teilnehmer_id: "", anlagen_nr: "",
  });
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setForm({ address: "", key_number: "", folder: "", kunden_name: "", notiz: "", teilnehmer_id: "", anlagen_nr: "" });
  };

  const upload = async () => {
    if (!file) return toast.error("Bitte eine Datei auswählen");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("dateien").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (up.error) throw up.error;

      await create({
        data: {
          filename: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          address: form.address || null,
          key_number: form.key_number || null,
          folder: form.folder || null,
          kunden_name: form.kunden_name || null,
          notiz: form.notiz || null,
          teilnehmer_id: form.teilnehmer_id || null,
          anlagen_nr: form.anlagen_nr || null,
        },
      });
      toast.success("Datei hochgeladen");
      reset(); onOpenChange(false); onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Upload fehlgeschlagen");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Datei hochladen</DialogTitle>
          <DialogDescription>Ergänze Metadaten zur besseren Auffindbarkeit.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center">
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="size-5 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <Upload className="size-6 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Klicken zum Auswählen</p>
                <input
                  type="file" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kunde" value={form.kunden_name} onChange={(v) => setForm({ ...form, kunden_name: v })} />
            <Field label="Adresse" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <Field label="Schlüssel-Nr." value={form.key_number} onChange={(v) => setForm({ ...form, key_number: v })} />
            <Field label="Anlagen-Nr." value={form.anlagen_nr} onChange={(v) => setForm({ ...form, anlagen_nr: v })} />
            <Field label="Teilnehmer-ID" value={form.teilnehmer_id} onChange={(v) => setForm({ ...form, teilnehmer_id: v })} />
            <Field label="Ordner" value={form.folder} onChange={(v) => setForm({ ...form, folder: v })} />
          </div>
          <div className="grid gap-2">
            <Label>Notiz</Label>
            <Textarea
              value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })}
              rows={3} maxLength={2000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Abbrechen</Button>
          <Button onClick={upload} disabled={busy || !file} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Hochladen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={255} />
    </div>
  );
}

function LinkDialog({
  datei, all, links, onClose, onDone,
}: { datei: Datei; all: Datei[]; links: Link[]; onClose: () => void; onDone: () => void }) {
  const link = useServerFn(linkDateien);
  const unlink = useServerFn(unlinkDateien);
  const [search, setSearch] = useState("");

  const linked = links.filter((l) => l.datei_a_id === datei.id || l.datei_b_id === datei.id);
  const linkedIds = new Set(linked.map((l) => (l.datei_a_id === datei.id ? l.datei_b_id : l.datei_a_id)));

  const s = search.trim().toLowerCase();
  const candidates = all
    .filter((d) => d.id !== datei.id && !linkedIds.has(d.id))
    .filter((d) => !s || [d.filename, d.kunden_name, d.address].some((v) => v?.toLowerCase().includes(s)))
    .slice(0, 50);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-5" /> Verknüpfungen
          </DialogTitle>
          <DialogDescription className="truncate">{datei.filename}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Verknüpft ({linked.length})</h3>
            {linked.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Verknüpfungen.</p>
            ) : (
              <div className="space-y-1">
                {linked.map((l) => {
                  const otherId = l.datei_a_id === datei.id ? l.datei_b_id : l.datei_a_id;
                  const other = all.find((d) => d.id === otherId);
                  if (!other) return null;
                  return (
                    <div key={l.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="size-4 text-primary shrink-0" />
                        <span className="text-sm truncate">{other.filename}</span>
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        onClick={async () => {
                          try { await unlink({ data: { id: l.id } }); toast.success("Verknüpfung entfernt"); onDone(); }
                          catch (e: any) { toast.error(e.message); }
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Neue Verknüpfung hinzufügen</h3>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Datei suchen…" className="pl-9" />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border border-border">
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Keine Dateien gefunden.</p>
              ) : candidates.map((d) => (
                <button
                  key={d.id}
                  className="w-full text-left flex items-center justify-between px-3 py-2 hover:bg-muted transition"
                  onClick={async () => {
                    try { await link({ data: { a: datei.id, b: d.id } }); toast.success("Verknüpft"); onDone(); }
                    catch (e: any) { toast.error(e.message); }
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.filename}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[d.kunden_name, d.address].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <LinkIcon className="size-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({
  datei, all, links, onClose,
}: { datei: Datei; all: Datei[]; links: Link[]; onClose: () => void }) {
  const sign = useServerFn(getDateiSignedUrl);
  const linkedItems = links
    .filter((l) => l.datei_a_id === datei.id || l.datei_b_id === datei.id)
    .map((l) => all.find((d) => d.id === (l.datei_a_id === datei.id ? l.datei_b_id : l.datei_a_id)))
    .filter((d): d is Datei => !!d);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" /> {datei.filename}
          </DialogTitle>
          <DialogDescription>{formatSize(datei.size_bytes)} · {datei.mime_type ?? "unbekannter Typ"}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Info label="Kunde" value={datei.kunden_name} />
          <Info label="Adresse" value={datei.address} />
          <Info label="Schlüssel-Nr." value={datei.key_number} />
          <Info label="Anlagen-Nr." value={datei.anlagen_nr} />
          <Info label="Teilnehmer-ID" value={datei.teilnehmer_id} />
          <Info label="Ordner" value={datei.folder} />
        </div>
        {datei.notiz && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Notiz</div>
            <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/40 p-3">{datei.notiz}</p>
          </div>
        )}
        {linkedItems.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">Verknüpft mit ({linkedItems.length})</div>
            <div className="space-y-1">
              {linkedItems.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                  <Link2 className="size-3.5 text-muted-foreground" />
                  <span className="truncate">{d.filename}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline" className="gap-2"
            onClick={async () => {
              try {
                const { url } = await sign({ data: { storage_path: datei.storage_path } });
                window.open(url, "_blank");
              } catch (e: any) { toast.error(e.message); }
            }}
          >
            <Eye className="size-4" /> Öffnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}
