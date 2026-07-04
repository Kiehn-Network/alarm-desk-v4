import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload, Search, Link2, Trash2, Download, FileText, Loader2,
  X, Eye, Link as LinkIcon, Pencil, History, ArrowRight, Paperclip,
  Users, ChevronLeft, ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  updateDatei, listDateiHistorie, softDeleteDateienBulk,
  findDuplikate,
} from "@/lib/dateien.functions";
import { useRole } from "@/hooks/use-role";
import { AccessDenied } from "@/components/layout/access-denied";
import { DateiEditDialog } from "@/components/datei-edit-dialog";
import { safeUUID } from "@/lib/utils";
import { FilePreviewDialog } from "@/components/file-preview-dialog";

type Datei = Awaited<ReturnType<typeof listDateien>>["dateien"][number];
type Link = Awaited<ReturnType<typeof listDateien>>["links"][number];

export const Route = createFileRoute("/_authenticated/dateien")({
  component: DateienGate,
});

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DateienGate() {
  const { isFahrer, loading } = useRole();
  if (loading) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Lade…</div>;
  if (isFahrer)
    return <AccessDenied title="Kein Zugriff" message="Die Datei-Verwaltung ist nicht für Fahrer freigegeben." />;
  return <DateienPage />;
}

function DateienPage() {
  const qc = useQueryClient();
  const { isAdmin } = useRole();
  const list = useServerFn(listDateien);
  const bulkDelete = useServerFn(softDeleteDateienBulk);
  const { data, isLoading } = useQuery({
    queryKey: ["dateien"],
    queryFn: () => list(),
  });

  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<Datei | null>(null);
  const [detailFor, setDetailFor] = useState<Datei | null>(null);
  const [editFor, setEditFor] = useState<Datei | null>(null);
  const [tab, setTab] = useState<"dateien" | "kunden" | "duplikate">("dateien");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState<null | { mode: "selected" | "all"; count: number }>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  // Reset auf Seite 1 wenn Suche sich ändert
  useEffect(() => { setPage(1); }, [search, tab]);
  useEffect(() => { setSelected(new Set()); }, [search, tab]);

  const linkCount = (id: string) =>
    links.filter((l) => l.datei_a_id === id || l.datei_b_id === id).length;

  const refresh = () => qc.invalidateQueries({ queryKey: ["dateien"] });

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const allSelected = pageItems.every((d) => prev.has(d.id));
      const next = new Set(prev);
      if (allSelected) pageItems.forEach((d) => next.delete(d.id));
      else pageItems.forEach((d) => next.add(d.id));
      return next;
    });
  };
  const allVisibleSelected = pageItems.length > 0 && pageItems.every((d) => selected.has(d.id));
  const someVisibleSelected = pageItems.some((d) => selected.has(d.id)) && !allVisibleSelected;

  const runBulk = async () => {
    if (!bulkOpen) return;
    setBulkBusy(true);
    try {
      const res = bulkOpen.mode === "all"
        ? await bulkDelete({ data: { all: true } })
        : await bulkDelete({ data: { ids: Array.from(selected) } });
      toast.success(`${res.deleted} Datei(en) gelöscht`);
      setSelected(new Set());
      setBulkOpen(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Löschen fehlgeschlagen");
    } finally { setBulkBusy(false); }
  };

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
              placeholder={tab === "kunden" ? "Kunde, Adresse, Schlüssel-Nr.…" : "Suche nach Datei, Adresse, Kunde…"}
              className="pl-9 w-[320px]"
            />
          </div>
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="size-4" /> Hochladen
          </Button>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-card p-1 gap-1">
        <button
          onClick={() => setTab("dateien")}
          className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-2 transition ${tab === "dateien" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <FileText className="size-4" /> Dateien
        </button>
        <button
          onClick={() => setTab("kunden")}
          className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-2 transition ${tab === "kunden" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Users className="size-4" /> Kunden
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab("duplikate")}
            className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-2 transition ${tab === "duplikate" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <Trash2 className="size-4" /> Duplikate
          </button>
        )}
      </div>

      {tab === "duplikate" && isAdmin ? (
        <DuplikateTab onDone={refresh} />
      ) : tab === "kunden" ? (
        <KundenListe
          dateien={dateien}
          search={search}
          onEdit={(d) => setEditFor(d)}
          isAdmin={isAdmin}
          onDone={refresh}
        />
      ) : (
      <div className="rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
        {isAdmin && (
          <div className="px-4 lg:px-5 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? `${selected.size} ausgewählt` : "Keine Auswahl"}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm" variant="destructive" className="gap-2"
                disabled={selected.size === 0}
                onClick={() => setBulkOpen({ mode: "selected", count: selected.size })}
              >
                <Trash2 className="size-4" /> Auswahl löschen ({selected.size})
              </Button>
              <Button
                size="sm" variant="outline" className="gap-2"
                disabled={dateien.length === 0}
                onClick={() => setBulkOpen({ mode: "all", count: dateien.length })}
              >
                <Trash2 className="size-4" /> Alle löschen
              </Button>
            </div>
          </div>
        )}
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
                {isAdmin && (
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      onCheckedChange={() => toggleAllVisible()}
                      aria-label="Alle sichtbaren auswählen"
                    />
                  </TableHead>
                )}
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
              {pageItems.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => setDetailFor(d)}>
                  {isAdmin && (
                    <TableCell onClick={(e) => e.stopPropagation()} className="w-[40px]">
                      <Checkbox
                        checked={selected.has(d.id)}
                        onCheckedChange={() => toggleOne(d.id)}
                        aria-label="Auswählen"
                      />
                    </TableCell>
                  )}
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
                      <Button size="sm" variant="ghost" onClick={() => setEditFor(d)} title="Bearbeiten">
                        <Pencil className="size-4" />
                      </Button>
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
        {filtered.length > 0 && (
          <div className="px-4 lg:px-5 py-3 border-t border-border flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "Eintrag" : "Einträge"} · Seite {safePage} von {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="gap-1">
                <ChevronLeft className="size-4" /> Zurück
              </Button>
              <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="gap-1">
                Weiter <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

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
          onClose={() => setDetailFor(null)} onDone={refresh}
        />
      )}
      {editFor && (
        <DateiEditDialog datei={editFor} onClose={() => setEditFor(null)} onDone={refresh} />
      )}

      <Dialog open={!!bulkOpen} onOpenChange={(v) => !v && setBulkOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkOpen?.mode === "all" ? "Alle Dateien löschen" : "Auswahl löschen"}
            </DialogTitle>
            <DialogDescription>
              {bulkOpen?.mode === "all"
                ? `Damit werden alle ${dateien.length} Dateien der Domäne in den Papierkorb verschoben (Soft-Delete). Verknüpfungen bleiben bestehen.`
                : `${selected.size} Datei(en) werden in den Papierkorb verschoben (Soft-Delete).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(null)} disabled={bulkBusy}>Abbrechen</Button>
            <Button variant="destructive" onClick={runBulk} disabled={bulkBusy} className="gap-2">
              {bulkBusy && <Loader2 className="size-4 animate-spin" />}
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DownloadBtn({ path, filename }: { path: string | null; filename: string }) {
  const sign = useServerFn(getDateiSignedUrl);
  const [busy, setBusy] = useState(false);
  if (!path) return null;
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
    title: "", address: "", key_number: "", folder: "", kunden_name: "",
    notiz: "", teilnehmer_id: "", anlagen_nr: "",
  });
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setForm({ title: "", address: "", key_number: "", folder: "", kunden_name: "", notiz: "", teilnehmer_id: "", anlagen_nr: "" });
  };

  const upload = async () => {
    const fallbackName = form.title.trim() || form.kunden_name.trim() || form.address.trim();
    if (!file && !fallbackName) {
      return toast.error("Bitte eine Datei auswählen oder einen Titel angeben.");
    }
    setBusy(true);
    try {
      let path: string | null = null;
      let mime: string | null = null;
      let size: number | null = null;
      let filename = fallbackName || "Eintrag";
      if (file) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nicht angemeldet");
        const ext = file.name.split(".").pop() ?? "bin";
        path = `${user.id}/${safeUUID()}.${ext}`;
        const up = await supabase.storage.from("dateien").upload(path, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (up.error) throw up.error;
        filename = file.name;
        mime = file.type || null;
        size = file.size;
      }

      await create({
        data: {
          filename,
          storage_path: path,
          mime_type: mime,
          size_bytes: size,
          address: form.address || null,
          key_number: form.key_number || null,
          folder: form.folder || null,
          kunden_name: form.kunden_name || null,
          notiz: form.notiz || null,
          teilnehmer_id: form.teilnehmer_id || null,
          anlagen_nr: form.anlagen_nr || null,
        },
      });
      toast.success(file ? "Datei hochgeladen" : "Eintrag angelegt – Datei kann später ergänzt werden");
      reset(); onOpenChange(false); onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Upload fehlgeschlagen");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neuer Eintrag</DialogTitle>
          <DialogDescription>Datei optional – kann auch später ergänzt werden.</DialogDescription>
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
                <p className="mt-2 text-sm text-muted-foreground">Klicken zum Auswählen (optional)</p>
                <input
                  type="file" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>
          {!file && (
            <Field label="Titel / Bezeichnung" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          )}
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
          <Button onClick={upload} disabled={busy} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Speichern
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
  datei, all, links, onClose, onDone,
}: { datei: Datei; all: Datei[]; links: Link[]; onClose: () => void; onDone: () => void }) {
  const sign = useServerFn(getDateiSignedUrl);
  const update = useServerFn(updateDatei);
  const [attaching, setAttaching] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const linkedItems = links
    .filter((l) => l.datei_a_id === datei.id || l.datei_b_id === datei.id)
    .map((l) => all.find((d) => d.id === (l.datei_a_id === datei.id ? l.datei_b_id : l.datei_a_id)))
    .filter((d): d is Datei => !!d);

  const attach = async (file: File) => {
    setAttaching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${safeUUID()}.${ext}`;
      const up = await supabase.storage.from("dateien").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (up.error) throw up.error;
      await update({
        data: {
          id: datei.id,
          filename: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
        } as any,
      });
      toast.success("Datei angehängt");
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Anhängen fehlgeschlagen");
    } finally { setAttaching(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" /> {datei.filename}
          </DialogTitle>
          <DialogDescription>
            {datei.storage_path
              ? `${formatSize(datei.size_bytes)} · ${datei.mime_type ?? "unbekannter Typ"}`
              : "Noch keine Datei angehängt"}
          </DialogDescription>
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
          {datei.storage_path ? (
            <Button
              variant="outline" className="gap-2"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="size-4" /> Öffnen
            </Button>
          ) : (
            <label className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:opacity-90 transition ${attaching ? "opacity-50 pointer-events-none" : ""}`}>
              {attaching ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
              Datei anhängen
              <input type="file" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (f) attach(f);
              }} />
            </label>
          )}
        </DialogFooter>
      </DialogContent>
      {datei.storage_path && (
        <FilePreviewDialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          storagePath={datei.storage_path}
          filename={datei.filename}
          mimeType={datei.mime_type}
        />
      )}
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

function KundenListe({
  dateien, search, onEdit, isAdmin, onDone,
}: { dateien: Datei[]; search: string; onEdit: (d: Datei) => void; isAdmin: boolean; onDone: () => void }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const bulkDelete = useServerFn(softDeleteDateienBulk);
  const [confirm, setConfirm] = useState<null | { name: string; count: number }>(null);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Datei[]>();
    for (const d of dateien) {
      const key = (d.kunden_name ?? "").trim() || "(ohne Kunde)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dateien]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return grouped;
    return grouped.filter((g) =>
      g.name.toLowerCase().includes(s) ||
      g.items.some((d) =>
        [d.address, d.key_number, d.anlagen_nr, d.teilnehmer_id, d.folder, d.filename]
          .filter(Boolean).some((v) => v!.toLowerCase().includes(s)),
      ),
    );
  }, [grouped, search]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="px-4 lg:px-5 py-2.5 text-xs text-muted-foreground border-b border-border flex items-center justify-between">
        <span>{total} {total === 1 ? "Kunde" : "Kunden"}</span>
        <span>Seite {safePage} / {pages}</span>
      </div>
      {visible.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Keine Kunden gefunden.</div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((g) => (
            <li key={g.name} className="p-4 lg:p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                    <Users className="size-4 text-primary shrink-0" /> {g.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {g.items.length} {g.items.length === 1 ? "Eintrag" : "Einträge"}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setConfirm({ name: g.name, count: g.items.length })}
                  >
                    <Trash2 className="size-4" /> Kunde löschen
                  </Button>
                )}
              </div>
              <ul className="divide-y divide-border/60 rounded-md border border-border/60 bg-muted/20">
                {g.items.map((d) => (
                  <li key={d.id} className="px-3 py-2 flex items-center gap-3">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{d.filename}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[d.address, d.key_number && `🔑 ${d.key_number}`, d.anlagen_nr && `🏷️ ${d.anlagen_nr}`]
                          .filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => onEdit(d)}>
                      <Pencil className="size-4" /> Bearbeiten
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="px-4 lg:px-5 py-3 border-t border-border flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="gap-1">
            <ChevronLeft className="size-4" /> Zurück
          </Button>
          <span className="text-xs text-muted-foreground">Seite {safePage} von {pages}</span>
          <Button size="sm" variant="outline" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="gap-1">
            Weiter <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
      <Dialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kunden-Dateien löschen</DialogTitle>
            <DialogDescription>
              {confirm && `Alle ${confirm.count} Datei(en) des Kunden „${confirm.name}" werden in den Papierkorb verschoben (Soft-Delete).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>Abbrechen</Button>
            <Button
              variant="destructive" className="gap-2" disabled={busy}
              onClick={async () => {
                if (!confirm) return;
                setBusy(true);
                try {
                  const name = confirm.name === "(ohne Kunde)" ? "" : confirm.name;
                  const res = await bulkDelete({ data: { kunden_name: name } });
                  toast.success(`${res.deleted} Datei(en) gelöscht`);
                  setConfirm(null);
                  onDone();
                } catch (e: any) {
                  toast.error(e.message ?? "Löschen fehlgeschlagen");
                } finally { setBusy(false); }
              }}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  filename: "Dateiname",
  kunden_name: "Kunde",
  address: "Adresse",
  key_number: "Schlüssel-Nr.",
  anlagen_nr: "Anlagen-Nr.",
  teilnehmer_id: "Teilnehmer-ID",
  folder: "Ordner",
  notiz: "Notiz",
};

function EditDialog({
  datei, onClose, onDone,
}: { datei: Datei; onClose: () => void; onDone: () => void }) {
  const update = useServerFn(updateDatei);
  const history = useServerFn(listDateiHistorie);
  const qc = useQueryClient();

  const [form, setForm] = useState({
    filename: datei.filename ?? "",
    kunden_name: datei.kunden_name ?? "",
    address: datei.address ?? "",
    key_number: datei.key_number ?? "",
    anlagen_nr: datei.anlagen_nr ?? "",
    teilnehmer_id: datei.teilnehmer_id ?? "",
    folder: datei.folder ?? "",
    notiz: datei.notiz ?? "",
  });
  const [busy, setBusy] = useState(false);

  const { data: hist, isLoading: histLoading } = useQuery({
    queryKey: ["datei-historie", datei.id],
    queryFn: () => history({ data: { datei_id: datei.id } }),
  });

  const save = async () => {
    setBusy(true);
    try {
      await update({
        data: {
          id: datei.id,
          filename: form.filename,
          kunden_name: form.kunden_name || null,
          address: form.address || null,
          key_number: form.key_number || null,
          anlagen_nr: form.anlagen_nr || null,
          teilnehmer_id: form.teilnehmer_id || null,
          folder: form.folder || null,
          notiz: form.notiz || null,
        },
      });
      toast.success("Änderungen gespeichert");
      qc.invalidateQueries({ queryKey: ["datei-historie", datei.id] });
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Speichern fehlgeschlagen");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5" /> Datei bearbeiten
          </DialogTitle>
          <DialogDescription className="truncate">{datei.filename}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Dateiname</Label>
            <Input value={form.filename} onChange={(e) => setForm({ ...form, filename: e.target.value })} maxLength={255} />
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
            <Textarea value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} rows={3} maxLength={2000} />
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center gap-2 mb-3">
            <History className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Änderungs-Historie</h3>
            <Badge variant="secondary">{hist?.entries.length ?? 0}</Badge>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 max-h-72 overflow-y-auto">
            {histLoading ? (
              <div className="p-6 text-center"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : (hist?.entries.length ?? 0) === 0 ? (
              <p className="p-6 text-sm text-center text-muted-foreground">Noch keine Änderungen erfasst.</p>
            ) : (
              <ul className="divide-y divide-border">
                {hist!.entries.map((e) => (
                  <li key={e.id} className="p-3 text-sm">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">
                        {FIELD_LABELS[e.field_name] ?? e.field_name}
                      </span>
                      <span>
                        {e.changed_by_name ?? "Unbekannt"} · {new Date(e.changed_at).toLocaleString("de-DE")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-1 rounded bg-destructive/10 text-destructive text-xs line-through max-w-[45%] truncate">
                        {e.old_value ?? "—"}
                      </span>
                      <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs max-w-[45%] truncate">
                        {e.new_value ?? "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Abbrechen</Button>
          <Button onClick={save} disabled={busy} className="gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
