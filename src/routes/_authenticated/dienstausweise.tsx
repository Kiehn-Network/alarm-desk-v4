import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, Plus, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AusweisKarte, AusweisRueckseite, type AusweisPerson } from "@/components/dienstausweis/ausweis-karte";
import { STANDARD_DESIGNS, type AusweisDesign, type AusweisStil } from "@/components/dienstausweis/designs";

export const Route = createFileRoute("/_authenticated/dienstausweise")({
  head: () => ({
    meta: [
      { title: "Dienstausweise – AlarmDesk" },
      { name: "description", content: "Dienstausweise mit Foto und QR-Code gestalten und drucken." },
      { property: "og:title", content: "Dienstausweise – AlarmDesk" },
      { property: "og:description", content: "Dienstausweise mit Foto und QR-Code gestalten und drucken." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Mitarbeiter = { id: string; display_name: string | null; daten?: any };

const STILE: { value: AusweisStil; label: string }[] = [
  { value: "band", label: "Kopfband" },
  { value: "streifen", label: "Streifen" },
  { value: "verlauf", label: "Farbverlauf" },
  { value: "diagonal", label: "Diagonal" },
  { value: "rahmen", label: "Rahmen" },
  { value: "seite", label: "Seitenleiste" },
  { value: "schlicht", label: "Schlicht · Firmenausweis" },
];

async function bildVerkleinern(file: File, logo = false): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const max = logo ? 800 : 360;
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
  const context = cv.getContext("2d");
  if (!context) { URL.revokeObjectURL(url); throw new Error("Bild konnte nicht verarbeitet werden"); }
  context.drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  return cv.toDataURL(logo ? "image/png" : "image/jpeg", 0.82);
}

function Page() {
  const { isAdmin, loading, domainId } = useRole() as any;
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;
  if (!isAdmin || !domainId) return <div className="p-6 text-sm text-muted-foreground">Nur Admins haben Zugriff auf die Dienstausweise.</div>;
  return <Inhalt domainId={domainId} />;
}

function Inhalt({ domainId }: { domainId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [designId, setDesignId] = useState("std-1");
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [bearbeiten, setBearbeiten] = useState<Mitarbeiter | null>(null);
  const [designEdit, setDesignEdit] = useState<AusweisDesign | null>(null);
  const [suche, setSuche] = useState("");

  const ma = useQuery({
    queryKey: ["dienstausweise-ma", domainId],
    queryFn: async () => {
      const [{ data: ps, error }, { data: dd }] = await Promise.all([
        supabase.from("profiles").select("id, display_name").eq("domain_id", domainId).order("display_name"),
        supabase.from("dienstausweis_daten").select("*").eq("domain_id", domainId),
      ]);
      if (error) throw error;
      let rows: any[] = dd ?? [];
      const fehlend = (ps ?? []).filter((p: any) => !rows.some((d) => d.user_id === p.id));
      if (fehlend.length) {
        const { data: neu } = await supabase.from("dienstausweis_daten").insert(fehlend.map((p: any) => ({ domain_id: domainId, user_id: p.id }))).select("*");
        rows = [...rows, ...(neu ?? [])];
      }
      const map = new Map(rows.map((d: any) => [d.user_id, d]));
      return (ps ?? []).map((p: any) => ({ ...p, daten: map.get(p.id) })) as Mitarbeiter[];
    },
  });
  const eigene = useQuery({
    queryKey: ["dienstausweis-designs", domainId],
    queryFn: async () => {
      const { data, error } = await supabase.from("dienstausweis_designs").select("*").eq("domain_id", domainId).order("created_at");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, eigen: true, config: { ...STANDARD_DESIGNS[0].config, ...(r.config ?? {}) } })) as AusweisDesign[];
    },
  });
  const alle = useMemo(() => [...STANDARD_DESIGNS, ...(eigene.data ?? [])], [eigene.data]);
  const design = alle.find((d) => d.id === designId) ?? STANDARD_DESIGNS[0];

  const person = (m: Mitarbeiter): AusweisPerson => ({
    name: m.display_name || "Unbekannt",
    funktion: m.daten?.funktion, ausweisNr: m.daten?.ausweis_nr, gueltigBis: m.daten?.gueltig_bis, foto: m.daten?.foto, pruefToken: m.daten?.pruef_token,
  });
  const liste = (ma.data ?? []).filter((m) => (m.display_name ?? "").toLowerCase().includes(suche.toLowerCase()));
  const druckListe = (ma.data ?? []).filter((m) => auswahl.includes(m.id));

  const speichereDaten = async (m: Mitarbeiter, v: any) => {
    const { error } = await supabase.from("dienstausweis_daten").upsert(
      { domain_id: domainId, user_id: m.id, foto: v.foto || null, ausweis_nr: v.ausweis_nr || null, funktion: v.funktion || null, gueltig_bis: v.gueltig_bis || null },
      { onConflict: "domain_id,user_id" },
    );
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
    setBearbeiten(null);
    qc.invalidateQueries({ queryKey: ["dienstausweise-ma", domainId] });
  };

  const speichereDesign = async (d: AusweisDesign) => {
    if (!d.name.trim()) return toast.error("Bitte einen Namen eingeben");
    const row = { domain_id: domainId, name: d.name.trim(), config: d.config as any, created_by: user?.id };
    const res = d.eigen && !d.id.startsWith("neu")
      ? await supabase.from("dienstausweis_designs").update({ name: row.name, config: row.config }).eq("id", d.id)
      : await supabase.from("dienstausweis_designs").insert(row);
    if (res.error) return toast.error(res.error.message);
    toast.success("Design gespeichert");
    setDesignEdit(null);
    qc.invalidateQueries({ queryKey: ["dienstausweis-designs", domainId] });
  };
  const loescheDesign = async (id: string) => {
    if (!confirm("Design löschen?")) return;
    const { error } = await supabase.from("dienstausweis_designs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (designId === id) setDesignId("std-1");
    qc.invalidateQueries({ queryKey: ["dienstausweis-designs", domainId] });
  };

  const drucken = () => {
    if (!druckListe.length) return toast.error("Bitte zuerst Mitarbeiter auswählen");
    window.print();
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Dienstausweise</h1>
          <p className="text-sm text-muted-foreground">Ausweise mit Foto und QR-Code gestalten und drucken (Scheckkartenformat).</p>
        </div>
        <Button onClick={drucken}><Printer className="h-4 w-4 mr-2" />Auswahl drucken ({auswahl.length})</Button>
      </div>

      <Tabs defaultValue="mitarbeiter" className="print:hidden">
        <TabsList>
          <TabsTrigger value="mitarbeiter">Mitarbeiter</TabsTrigger>
          <TabsTrigger value="designs">Designs ({alle.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mitarbeiter" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label>Design</Label>
              <Select value={designId} onValueChange={setDesignId}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>{alle.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{d.eigen ? " (eigenes)" : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Mitarbeiter suchen…" value={suche} onChange={(e) => setSuche(e.target.value)} className="w-60" />
            <Button variant="outline" onClick={() => setAuswahl(auswahl.length ? [] : (ma.data ?? []).map((m) => m.id))}>
              {auswahl.length ? "Auswahl aufheben" : "Alle auswählen"}
            </Button>
          </div>
          {ma.isLoading ? <p className="text-sm text-muted-foreground">Lade…</p> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {liste.map((m) => (
                <div key={m.id} className="rounded-lg border bg-card p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox checked={auswahl.includes(m.id)} onCheckedChange={(v) => setAuswahl((a) => v ? [...a, m.id] : a.filter((x) => x !== m.id))} />
                      {m.display_name || "Unbekannt"}
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => setBearbeiten(m)}><Pencil className="h-4 w-4 mr-1" />Daten</Button>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2"><AusweisKarte design={design} person={person(m)} scale={0.8} /><AusweisRueckseite design={design} person={person(m)} scale={0.8} /></div>
                </div>
              ))}
              {!liste.length && <p className="text-sm text-muted-foreground">Keine Mitarbeiter gefunden.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="designs" className="space-y-4">
          <Button onClick={() => setDesignEdit({ ...structuredClone(STANDARD_DESIGNS[0]), id: "neu", name: "Mein Design", eigen: true })}>
            <Plus className="h-4 w-4 mr-2" />Neues Design
          </Button>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {alle.map((d) => (
              <div key={d.id} className={`rounded-lg border bg-card p-3 space-y-3 ${d.id === designId ? "ring-2 ring-primary" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{d.name}{d.eigen && <span className="text-muted-foreground"> · eigenes</span>}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDesignEdit(d.eigen ? structuredClone(d) : { ...structuredClone(d), id: "neu", name: `${d.name} (Kopie)`, eigen: true })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {d.eigen && <Button size="sm" variant="ghost" onClick={() => loescheDesign(d.id)}><Trash2 className="h-4 w-4" /></Button>}
                    <Button size="sm" variant={d.id === designId ? "default" : "outline"} onClick={() => setDesignId(d.id)}>Wählen</Button>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-2"><AusweisKarte design={d} scale={0.8} person={{ name: "Max Mustermann", funktion: "Sicherheitsmitarbeiter", ausweisNr: "0001", gueltigBis: "2027-12-31" }} /><AusweisRueckseite design={d} scale={0.8} person={{ name: "Max Mustermann", ausweisNr: "0001" }} /></div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Druckbereich */}
      <div className="hidden print:block ausweis-druck">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6mm" }}>
          {druckListe.map((m) => (
            <div key={m.id} style={{ display: "flex", gap: "4mm", breakInside: "avoid" }}>
              <AusweisKarte design={design} person={person(m)} />
              <AusweisRueckseite design={design} person={person(m)} />
            </div>
          ))}
        </div>
      </div>

      {bearbeiten && <DatenDialog m={bearbeiten} design={design} onClose={() => setBearbeiten(null)} onSave={(v) => speichereDaten(bearbeiten, v)} />}
      {designEdit && <DesignDialog d={designEdit} onClose={() => setDesignEdit(null)} onSave={speichereDesign} />}
    </div>
  );
}

function DatenDialog({ m, design, onClose, onSave }: { m: Mitarbeiter; design: AusweisDesign; onClose: () => void; onSave: (v: any) => void }) {
  const [v, setV] = useState({
    foto: m.daten?.foto ?? "", ausweis_nr: m.daten?.ausweis_nr ?? "", funktion: m.daten?.funktion ?? "", gueltig_bis: m.daten?.gueltig_bis ?? "",
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader><DialogTitle>Ausweisdaten: {m.display_name}</DialogTitle></DialogHeader>
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <div className="flex flex-wrap justify-center gap-2"><AusweisKarte design={design} scale={0.8} person={{ name: m.display_name || "Unbekannt", funktion: v.funktion, ausweisNr: v.ausweis_nr, gueltigBis: v.gueltig_bis, foto: v.foto, pruefToken: m.daten?.pruef_token }} /><AusweisRueckseite design={design} scale={0.8} person={{ name: m.display_name || "Unbekannt", ausweisNr: v.ausweis_nr }} /></div>
          <div className="space-y-1">
            <Label>Foto</Label>
            <div className="flex gap-2">
              <Input type="file" accept="image/*" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                try { setV({ ...v, foto: await bildVerkleinern(f) }); } catch { toast.error("Bild konnte nicht gelesen werden"); }
              }} />
              {v.foto && <Button variant="outline" onClick={() => setV({ ...v, foto: "" })}>Entfernen</Button>}
            </div>
          </div>
          <div className="space-y-1"><Label>Funktion</Label><Input value={v.funktion} maxLength={60} onChange={(e) => setV({ ...v, funktion: e.target.value })} placeholder="z. B. Sicherheitsmitarbeiter" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Ausweis-Nr.</Label><Input value={v.ausweis_nr} maxLength={30} onChange={(e) => setV({ ...v, ausweis_nr: e.target.value })} /></div>
            <div className="space-y-1"><Label>Gültig bis</Label><Input type="date" value={v.gueltig_bis} onChange={(e) => setV({ ...v, gueltig_bis: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Abbrechen</Button><Button onClick={() => onSave(v)}>Speichern</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DesignDialog({ d, onClose, onSave }: { d: AusweisDesign; onClose: () => void; onSave: (d: AusweisDesign) => void }) {
  const [x, setX] = useState<AusweisDesign>(d);
  const set = (k: keyof AusweisDesign["config"], val: any) => setX({ ...x, config: { ...x.config, [k]: val } });
  const farbe = (k: "bg" | "akzent" | "akzent2" | "text", label: string) => (
    <div className="space-y-1"><Label>{label}</Label><Input type="color" value={x.config[k]} onChange={(e) => set(k, e.target.value)} className="h-9 p-1" /></div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader><DialogTitle>Design gestalten</DialogTitle></DialogHeader>
        <div className="grid min-h-0 gap-4 overflow-y-auto pr-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={x.name} maxLength={60} onChange={(e) => setX({ ...x, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Format</Label>
                <Select value={x.config.format} onValueChange={(v) => set("format", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="quer">Querformat</SelectItem><SelectItem value="hoch">Hochformat</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Stil</Label>
                <Select value={x.config.stil} onValueChange={(v) => set("stil", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STILE.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Titel</Label><Input value={x.config.titel} maxLength={30} onChange={(e) => set("titel", e.target.value)} /></div>
            <div className="space-y-1"><Label>Firmenname</Label><Input value={x.config.firma} maxLength={40} onChange={(e) => set("firma", e.target.value)} /></div>
            {x.config.stil === "schlicht" && <>
              <div className="space-y-1"><Label htmlFor="ausweis-logo">Firmenlogo</Label>
                <div className="flex gap-2">
                  <Input id="ausweis-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    try {
                      const logo = await bildVerkleinern(file, true);
                      setX((prev) => ({ ...prev, config: { ...prev.config, logo } }));
                    } catch { toast.error("Logo konnte nicht gelesen werden"); }
                  }} />
                  {x.config.logo && <Button variant="outline" onClick={() => set("logo", "")}>Entfernen</Button>}
                </div>
              </div>
              <div className="space-y-1"><Label htmlFor="ausweis-vorderkontakt">Vorderseite: Kontakt / Adresse</Label><Textarea id="ausweis-vorderkontakt" rows={3} maxLength={160} value={x.config.vorderKontakt ?? ""} onChange={(e) => set("vorderKontakt", e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="ausweis-standort">Rückseite: Niederlassung / Standort</Label><Input id="ausweis-standort" maxLength={50} value={x.config.rueckStandort ?? ""} onChange={(e) => set("rueckStandort", e.target.value)} /></div>
            </>}
            <div className="grid grid-cols-4 gap-2">
              {farbe("bg", "Hintergrund")}{farbe("akzent", "Farbe 1")}{farbe("akzent2", "Farbe 2")}{farbe("text", "Schrift")}
            </div>
            <div className="space-y-1"><Label>Rückseite: Text</Label><Textarea rows={3} value={x.config.rueckText} maxLength={400} onChange={(e) => set("rueckText", e.target.value)} /></div>
            <div className="space-y-1"><Label>Rückseite: Kontakt / Adresse</Label><Textarea rows={2} value={x.config.rueckKontakt} maxLength={200} onChange={(e) => set("rueckKontakt", e.target.value)} placeholder="z. B. Musterstraße 1, 12345 Musterstadt · Tel. 0123 456789" /></div>
            <div className="space-y-3 rounded-md border p-3">
              <div className="text-sm font-semibold">Rückseite: Anordnung & Felder</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Ausrichtung</Label>
                  <Select value={x.config.rueckAusrichtung ?? "links"} onValueChange={(v) => set("rueckAusrichtung", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="links">Links</SelectItem><SelectItem value="mitte">Mittig</SelectItem><SelectItem value="rechts">Rechts</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Reihenfolge</Label>
                  <Select value={x.config.rueckReihenfolge ?? "text-zuerst"} onValueChange={(v) => set("rueckReihenfolge", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="text-zuerst">Text, dann Kontakt</SelectItem><SelectItem value="kontakt-zuerst">Kontakt, dann Text</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Schriftgröße: {x.config.rueckSchrift ?? 100} %</Label>
                <input type="range" min={70} max={140} step={5} value={x.config.rueckSchrift ?? 100} onChange={(e) => set("rueckSchrift", Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Notrufnummer</Label><Input value={x.config.rueckNotruf ?? ""} maxLength={40} onChange={(e) => set("rueckNotruf", e.target.value)} placeholder="z. B. 0800 123456" /></div>
                <div className="space-y-1"><Label>Webseite</Label><Input value={x.config.rueckWebseite ?? ""} maxLength={60} onChange={(e) => set("rueckWebseite", e.target.value)} placeholder="www.beispiel.de" /></div>
                <div className="space-y-1"><Label>Eigenes Feld: Name</Label><Input value={x.config.rueckFeldName ?? ""} maxLength={25} onChange={(e) => set("rueckFeldName", e.target.value)} placeholder="z. B. Bewacher-ID" /></div>
                <div className="space-y-1"><Label>Eigenes Feld: Wert</Label><Input value={x.config.rueckFeldWert ?? ""} maxLength={60} onChange={(e) => set("rueckFeldWert", e.target.value)} /></div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!x.config.rueckZeigeGueltig} onCheckedChange={(v) => set("rueckZeigeGueltig", v)} />„Gültig bis" zeigen</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={x.config.rueckZeigeUnterschrift !== false} onCheckedChange={(v) => set("rueckZeigeUnterschrift", v)} />Unterschriften</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={x.config.rueckZeigeNummer !== false} onCheckedChange={(v) => set("rueckZeigeNummer", v)} />Ausweis-Nr.</label>
              </div>
            </div>
            {x.config.stil !== "schlicht" && <label className="flex items-center gap-2 text-sm"><Switch checked={x.config.fotoRund} onCheckedChange={(v) => set("fotoRund", v)} />Rundes Foto</label>}
          </div>
          <div className="flex flex-col items-center gap-3 self-start rounded-md bg-muted p-4 lg:sticky lg:top-0">
            <AusweisKarte design={x} person={{ name: "Max Mustermann", funktion: "Sicherheitsmitarbeiter", ausweisNr: "0001", gueltigBis: "2027-12-31" }} />
            <AusweisRueckseite design={x} person={{ name: "Max Mustermann", ausweisNr: "0001" }} />
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Abbrechen</Button><Button onClick={() => onSave(x)}>Speichern</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
