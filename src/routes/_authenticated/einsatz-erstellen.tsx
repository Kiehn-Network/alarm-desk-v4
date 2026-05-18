import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Search, Send, User, MapPin, KeyRound, Hash, Check, X, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/hooks/use-role";
import {
  createEinsatz, listEinsatzGruende, listFahrer, searchKundenDateien,
} from "@/lib/einsaetze.functions";

export const Route = createFileRoute("/_authenticated/einsatz-erstellen")({
  component: EinsatzErstellenPage,
});

type DateiHit = {
  id: string;
  kunden_name: string | null;
  address: string | null;
  key_number: string | null;
  anlagen_nr: string | null;
  teilnehmer_id: string | null;
  notiz: string | null;
  filename: string;
};

function EinsatzErstellenPage() {
  const navigate = useNavigate();
  const { canManage, loading: roleLoading } = useRole();

  const searchFn = useServerFn(searchKundenDateien);
  const listG = useServerFn(listEinsatzGruende);
  const listF = useServerFn(listFahrer);
  const create = useServerFn(createEinsatz);

  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [picked, setPicked] = useState<DateiHit | null>(null);
  const [grund, setGrund] = useState("");
  const [grundId, setGrundId] = useState<string | null>(null);
  const [fahrerId, setFahrerId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: searchData, isFetching } = useQuery({
    queryKey: ["kunden-search", activeQuery],
    queryFn: () => searchFn({ data: { q: activeQuery } }),
    enabled: activeQuery.length >= 2 && !picked,
  });
  const results: DateiHit[] = searchData?.results ?? [];

  const { data: gData } = useQuery({ queryKey: ["einsatz-gruende"], queryFn: () => listG() });
  const gruende = gData?.gruende ?? [];

  const { data: fData } = useQuery({ queryKey: ["fahrer"], queryFn: () => listF() });
  const fahrer = (fData?.fahrer ?? []) as Array<{ id: string; display_name: string | null }>;

  useEffect(() => { setActiveQuery(query.trim()); }, [query]);

  function pickGrund(name: string, id: string | null) {
    setGrund(name); setGrundId(id);
  }

  if (!roleLoading && !canManage) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-xl border border-border bg-card p-8 max-w-xl">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle className="size-5" />
            <h2 className="font-semibold">Keine Berechtigung</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Nur Dispatcher und Admins dürfen Einsätze erstellen.
          </p>
        </div>
      </div>
    );
  }

  async function submit() {
    if (!picked) { toast.error("Bitte zuerst einen Kunden suchen und auswählen"); return; }
    if (!grund.trim()) { toast.error("Bitte Einsatzgrund eingeben oder auswählen"); return; }
    if (!fahrerId) { toast.error("Bitte einen Fahrer wählen"); return; }
    setSaving(true);
    try {
      await create({ data: {
        einsatzgrund: grund.trim(),
        einsatzgrund_id: grundId,
        kunden_name: picked.kunden_name,
        address: picked.address,
        key_number: picked.key_number,
        anlagen_nr: picked.anlagen_nr,
        teilnehmer_id: picked.teilnehmer_id,
        beschreibung: null,
        assigned_to: fahrerId,
        datei_id: picked.id,
      }});
      const f = fahrer.find((x) => x.id === fahrerId);
      toast.success(`Einsatz an ${f?.display_name ?? "Fahrer"} übergeben`);
      navigate({ to: "/alarmierung" });
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Erstellen");
    } finally { setSaving(false); }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Einsatz erstellen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kunde suchen, Einsatzgrund festlegen, Fahrer zuweisen.
        </p>
      </div>

      {/* Schritt 1: Suche */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center">1</span>
          <h2 className="font-semibold">Kunde / Objekt suchen</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
            placeholder="Kunde, Straße, Schlüssel-Nr., Anlagen-Nr., Teilnehmer-ID..."
            className="pl-9"
            autoFocus
          />
        </div>

        {picked ? (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 flex items-start gap-3">
            <Check className="size-5 text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{picked.kunden_name || "Ohne Kundennamen"}</div>
              <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                {picked.address && <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {picked.address}</span>}
                {picked.key_number && <span className="inline-flex items-center gap-1"><KeyRound className="size-3" /> {picked.key_number}</span>}
                {picked.anlagen_nr && <span className="inline-flex items-center gap-1"><Hash className="size-3" /> {picked.anlagen_nr}</span>}
                {picked.teilnehmer_id && <span>TN: {picked.teilnehmer_id}</span>}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setQuery(""); }}>
              <X className="size-4" /> Ändern
            </Button>
          </div>
        ) : activeQuery.length < 2 ? (
          <p className="text-xs text-muted-foreground">Mindestens 2 Zeichen eingeben.</p>
        ) : isFetching ? (
          <p className="text-xs text-muted-foreground">Suche läuft...</p>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Keine Treffer. Lege die Datei zuerst unter <b>Datei-Verwaltung</b> an.
          </div>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border max-h-80 overflow-y-auto">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setPicked(r)}
                  className="w-full text-left p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <User className="size-4 text-muted-foreground" />
                    {r.kunden_name || <span className="text-muted-foreground">Ohne Kundennamen</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {r.address && <span>📍 {r.address}</span>}
                    {r.key_number && <span>🔑 {r.key_number}</span>}
                    {r.anlagen_nr && <span>🏷️ {r.anlagen_nr}</span>}
                    {r.teilnehmer_id && <span>TN: {r.teilnehmer_id}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Schritt 2: Objektdaten (read-only autofill) */}
      {picked && (
        <section className="rounded-xl border border-border bg-card p-6 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2">
            <span className="size-6 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center">2</span>
            <h2 className="font-semibold">Objektdaten</h2>
            <span className="text-xs text-muted-foreground">automatisch ausgefüllt</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadField label="Kunde" value={picked.kunden_name} />
            <ReadField label="Adresse" value={picked.address} />
            <ReadField label="Schlüssel-Nr." value={picked.key_number} />
            <ReadField label="Anlagen-Nr." value={picked.anlagen_nr} />
            <ReadField label="Teilnehmer-ID" value={picked.teilnehmer_id} />
          </div>
          {picked.notiz && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2">
              <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-amber-500 mb-0.5">Hinweis zum Kunden</div>
                <p className="text-sm whitespace-pre-wrap text-foreground/90">{picked.notiz}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Schritt 3: Einsatzgrund */}
      {picked && (
        <section className="rounded-xl border border-border bg-card p-6 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2">
            <span className="size-6 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center">3</span>
            <h2 className="font-semibold">Einsatzgrund</h2>
          </div>
          <Textarea
            value={grund}
            onChange={(e) => { setGrund(e.target.value); setGrundId(null); }}
            rows={3}
            maxLength={200}
            placeholder="Einsatzgrund eingeben..."
          />
          {gruende.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {gruende.map((g: any) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pickGrund(g.name, g.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    grundId === g.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 hover:bg-muted border-border text-foreground/80"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Schritt 4: Fahrer */}
      {picked && (
        <section className="rounded-xl border border-border bg-card p-6 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2">
            <span className="size-6 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center">4</span>
            <h2 className="font-semibold">Fahrer zuweisen</h2>
          </div>
          {fahrer.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Nutzer mit Rolle "Fahrer" gefunden. Rollen können im Admin Center vergeben werden.
            </p>
          ) : (
            <div>
              <Label>Fahrer</Label>
              <Select value={fahrerId} onValueChange={setFahrerId}>
                <SelectTrigger><SelectValue placeholder="Fahrer wählen" /></SelectTrigger>
                <SelectContent>
                  {fahrer.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.display_name ?? f.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
            <Button onClick={submit} disabled={saving || !fahrerId || !grund.trim()} className="gap-2">
              <Send className="size-4" /> Einsatz an Fahrer übergeben
            </Button>
            <Button onClick={() => navigate({ to: "/alarmierung" })} variant="ghost" className="ml-auto">
              Abbrechen
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/30 text-sm min-h-[2.25rem]">
        {value || <span className="text-muted-foreground italic">—</span>}
      </div>
    </div>
  );
}
