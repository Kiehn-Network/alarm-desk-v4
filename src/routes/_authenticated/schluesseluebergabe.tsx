import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Download, Trash2, Search, ArrowDownToLine, ArrowUpFromLine, KeySquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useRole } from "@/hooks/use-role";
import {
  listSchluesselProtokolle, createSchluesselProtokoll,
  deleteSchluesselProtokoll, getSchluesselSettings,
} from "@/lib/schluesseluebergabe.functions";
import { searchKundenDateien } from "@/lib/einsaetze.functions";
import { downloadSchluesselPdf } from "@/lib/schluesseluebergabe-pdf";
import { SignatureField } from "@/components/signature-field";

export const Route = createFileRoute("/_authenticated/schluesseluebergabe")({
  component: Page,
});

type Item = { anzahl: string; art: string; beschreibung: string };

function fmt(d: string) {
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Page() {
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const listFn = useServerFn(listSchluesselProtokolle);
  const settingsFn = useServerFn(getSchluesselSettings);
  const delFn = useServerFn(deleteSchluesselProtokoll);

  const lq = useQuery({ queryKey: ["schluessel-protokolle"], queryFn: () => listFn() });
  const sq = useQuery({ queryKey: ["schluessel-settings"], queryFn: () => settingsFn() });

  const [open, setOpen] = useState(false);

  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Protokoll gelöscht");
      qc.invalidateQueries({ queryKey: ["schluessel-protokolle"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const protokolle = (lq.data?.protokolle ?? []) as any[];
  const footer = sq.data?.settings ?? { firmenname: null, footer_adresse: null, footer_kontakt: null };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><KeySquare className="size-7" /> Schlüsselübergabe</h1>
          <p className="text-sm text-muted-foreground mt-1">Protokolle für Eingang & Ausgang erstellen und als PDF ausgeben.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-2" /> Neues Protokoll</Button>
      </header>

      {!footer.firmenname && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          Hinweis: Der PDF-Footer ist noch nicht gepflegt. Bitte im <b>Admin Center → Schlüsselübergabe</b> Firmenname und Footer-Zeilen hinterlegen.
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Nr.</th>
              <th className="text-left px-3 py-2">Richtung</th>
              <th className="text-left px-3 py-2">Kunde</th>
              <th className="text-left px-3 py-2">Adresse</th>
              <th className="text-left px-3 py-2">Erstellt</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lq.isLoading ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Lade…</td></tr>
            ) : protokolle.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Noch keine Protokolle.</td></tr>
            ) : protokolle.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono">#{p.protokoll_nr}</td>
                <td className="px-3 py-2">
                  {p.richtung === "ausgang" ? (
                    <Badge variant="outline" className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 gap-1">
                      <ArrowUpFromLine className="size-3" /> Ausgang
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
                      <ArrowDownToLine className="size-3" /> Eingang
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">{p.kunden_name ?? "–"}</td>
                <td className="px-3 py-2 text-muted-foreground">{[p.strasse, p.ort].filter(Boolean).join(", ") || "–"}</td>
                <td className="px-3 py-2 text-muted-foreground">{fmt(p.created_at)}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => downloadSchluesselPdf(p, footer)}>
                    <Download className="size-4 mr-1" /> PDF
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={() => { if (confirm(`Protokoll #${p.protokoll_nr} löschen?`)) mDel.mutate(p.id); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <NewDialog onClose={() => setOpen(false)} footer={footer} />}
    </div>
  );
}

function NewDialog({ onClose, footer }: { onClose: () => void; footer: any }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createSchluesselProtokoll);
  const searchFn = useServerFn(searchKundenDateien);

  const [richtung, setRichtung] = useState<"ausgang" | "eingang">("ausgang");
  const [kunde, setKunde] = useState("");
  const [strasse, setStrasse] = useState("");
  const [ort, setOrt] = useState("");
  const [vonName, setVonName] = useState("");
  const [anName, setAnName] = useState("");
  const [items, setItems] = useState<Item[]>([{ anzahl: "", art: "", beschreibung: "" }]);
  const [notiz, setNotiz] = useState("");
  const [sigVon, setSigVon] = useState<string | null>(null);
  const [sigAn, setSigAn] = useState<string | null>(null);
  const [srcVon, setSrcVon] = useState<"pad" | "touch" | null>(null);
  const [srcAn, setSrcAn] = useState<"pad" | "touch" | null>(null);

  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const sq = useQuery({
    queryKey: ["kunden-search-schluessel", q],
    queryFn: () => searchFn({ data: { q } }),
    enabled: q.trim().length >= 2,
  });

  const mCreate = useMutation({
    mutationFn: () => createFn({
      data: {
        richtung,
        kunden_name: kunde || null,
        strasse: strasse || null,
        ort: ort || null,
        uebergeben_von_name: vonName || null,
        uebergeben_an_name: anName || null,
        items: items.filter((i) => i.anzahl || i.art || i.beschreibung),
        notiz: notiz || null,
        signatur_von: sigVon,
        signatur_an: sigAn,
        signatur_quelle:
          srcVon && srcAn ? (srcVon === srcAn ? srcVon : "gemischt") : (srcVon ?? srcAn ?? null),
      },
    }),
    onSuccess: (row: any) => {
      toast.success(`Protokoll #${row.protokoll_nr} angelegt`);
      qc.invalidateQueries({ queryKey: ["schluessel-protokolle"] });
      // direkt PDF anbieten
      downloadSchluesselPdf(row, footer);
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Neues Schlüsselprotokoll</DialogTitle>
          <DialogDescription>Kunde aus der Datei-Verwaltung wählen oder manuell ausfüllen.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Richtung */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button"
              onClick={() => setRichtung("ausgang")}
              className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${richtung === "ausgang" ? "border-cyan-500 bg-cyan-500/10" : "border-border"}`}>
              <ArrowUpFromLine className="size-4" />
              <div className="text-left">
                <div className="font-semibold">Ausgang</div>
                <div className="text-xs text-muted-foreground">Wir geben Schlüssel an den Kunden</div>
              </div>
            </button>
            <button type="button"
              onClick={() => setRichtung("eingang")}
              className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${richtung === "eingang" ? "border-emerald-500 bg-emerald-500/10" : "border-border"}`}>
              <ArrowDownToLine className="size-4" />
              <div className="text-left">
                <div className="font-semibold">Eingang</div>
                <div className="text-xs text-muted-foreground">Kunde übergibt uns Schlüssel</div>
              </div>
            </button>
          </div>

          {/* Kunde Suche */}
          <div className="space-y-1.5">
            <Label>Kunde suchen (aus Datei-Verwaltung)</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Name, Adresse, Schlüssel-Nr…"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
                  />
                </div>
              </PopoverTrigger>
              {q.trim().length >= 2 && (
                <PopoverContent className="p-0 w-[min(640px,90vw)]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <div className="max-h-72 overflow-y-auto">
                    {sq.isLoading ? (
                      <div className="p-3 text-sm text-muted-foreground">Suche…</div>
                    ) : (sq.data?.results ?? []).length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">Keine Treffer.</div>
                    ) : (sq.data!.results as any[]).map((r) => (
                      <button key={r.id} type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b border-border last:border-b-0"
                        onClick={() => {
                          setKunde(r.kunden_name ?? "");
                          const parts = String(r.address ?? "").split(",").map((s: string) => s.trim());
                          setStrasse(parts[0] ?? "");
                          setOrt(parts.slice(1).join(", "));
                          setQ("");
                          setSearchOpen(false);
                        }}>
                        <div className="font-medium">{r.kunden_name ?? "–"}</div>
                        <div className="text-xs text-muted-foreground">{r.address ?? ""}{r.key_number ? ` · 🔑 ${r.key_number}` : ""}</div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          </div>

          {/* Stammdaten */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kunde</Label>
              <Input value={kunde} onChange={(e) => setKunde(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Straße</Label>
              <Input value={strasse} onChange={(e) => setStrasse(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Ort</Label>
              <Input value={ort} onChange={(e) => setOrt(e.target.value)} />
            </div>
          </div>

          {/* Schlüssel-Liste */}
          <div className="space-y-2">
            <Label>Schlüssel</Label>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left px-2 py-1.5 w-24">Anzahl</th>
                    <th className="text-left px-2 py-1.5 w-40">Art</th>
                    <th className="text-left px-2 py-1.5">Beschreibung/Hersteller</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-1"><Input value={it.anzahl} onChange={(e) => updateItem(i, { anzahl: e.target.value })} /></td>
                      <td className="p-1"><Input value={it.art} onChange={(e) => updateItem(i, { art: e.target.value })} /></td>
                      <td className="p-1"><Input value={it.beschreibung} onChange={(e) => updateItem(i, { beschreibung: e.target.value })} /></td>
                      <td className="p-1 text-center">
                        <Button type="button" size="icon" variant="ghost"
                          onClick={() => setItems((arr) => arr.filter((_, x) => x !== i))}
                          disabled={items.length === 1}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((a) => [...a, { anzahl: "", art: "", beschreibung: "" }])}>
              <Plus className="size-4 mr-1" /> Zeile hinzufügen
            </Button>
          </div>

          {/* Übergabe */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{richtung === "ausgang" ? "Ausgehändigt von (Name)" : "Übergeben von (Name)"}</Label>
              <Input value={vonName} onChange={(e) => setVonName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Übergeben an (Name)</Label>
              <Input value={anName} onChange={(e) => setAnName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notiz (intern)</Label>
            <Textarea rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => mCreate.mutate()} disabled={mCreate.isPending}>
            {mCreate.isPending ? "Speichern…" : "Speichern & PDF erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}