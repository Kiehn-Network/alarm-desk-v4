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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { useDomainModules } from "@/hooks/use-domain-modules";
import {
  createEinsatz, listEinsatzGruende, listFahrer, searchKundenDateien,
} from "@/lib/einsaetze.functions";
import { ausgebenSchluessel } from "@/lib/schluesselbuch.functions";
import { listMyPartners, createEinsatzForPartner } from "@/lib/intervention.functions";
import { Network } from "lucide-react";

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
  const { data: modules } = useDomainModules();
  const hausnotrufEnabled = modules?.has("hausnotruf") ?? false;

  const searchFn = useServerFn(searchKundenDateien);
  const listG = useServerFn(listEinsatzGruende);
  const listF = useServerFn(listFahrer);
  const create = useServerFn(createEinsatz);
  const ausgeben = useServerFn(ausgebenSchluessel);
  const schluesselbuchOn = modules?.has("schluesselbuch") ?? false;
  const interventionOn = modules?.has("intervention") ?? false;
  const listPartnersFn = useServerFn(listMyPartners);
  const createForPartner = useServerFn(createEinsatzForPartner);
  const { data: partnerData } = useQuery({
    queryKey: ["intervention-partners-active"],
    queryFn: () => listPartnersFn(),
    enabled: interventionOn,
  });
  const partners = ((partnerData?.partners ?? []) as Array<any>).filter((p) => p.aktiv);
  const [zielMode, setZielMode] = useState<"fahrer" | "partner" | "sub">("fahrer");
  const [partnerId, setPartnerId] = useState("");
  const [subName, setSubName] = useState("");

  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [picked, setPicked] = useState<DateiHit | null>(null);
  const [grund, setGrund] = useState("");
  const [grundId, setGrundId] = useState<string | null>(null);
  const [fahrerId, setFahrerId] = useState("");
  const [einsatzTyp, setEinsatzTyp] = useState<"av_einsatz" | "hausnotruf">("av_einsatz");
  const [alarmAm, setAlarmAm] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [hausnotrufProvider, setHausnotrufProvider] = useState<"malteser" | "johanniter" | "lgwa" | "">("");
  const [saving, setSaving] = useState(false);

  // Schlüsselübergabe nach Einsatz-Erstellung
  const [handover, setHandover] = useState<null | {
    einsatzId: string;
    keyNumber: string;
    fahrerId: string;
    fahrerName: string;
  }>(null);
  const [traegerMode, setTraegerMode] = useState<"fahrer" | "andere">("fahrer");
  const [traegerName, setTraegerName] = useState("");
  const [traegerUserId, setTraegerUserId] = useState<string>("");
  const [handoverNote, setHandoverNote] = useState("");
  const [handoverBusy, setHandoverBusy] = useState(false);

  const malteserOn = modules?.has("malteser") ?? false;
  const johanniterOn = modules?.has("johanniter") ?? false;
  const lgwaOn = modules?.has("lgwa") ?? false;
  const providerOptions = [
    malteserOn && { key: "malteser" as const, label: "Malteser" },
    johanniterOn && { key: "johanniter" as const, label: "Johanniter" },
    lgwaOn && { key: "lgwa" as const, label: "LüWa" },
  ].filter(Boolean) as { key: "malteser" | "johanniter" | "lgwa"; label: string }[];

  const { data: searchData, isFetching } = useQuery({
    queryKey: ["kunden-search", activeQuery],
    queryFn: () => searchFn({ data: { q: activeQuery } }),
    enabled: activeQuery.length >= 2 && !picked,
  });
  const results: DateiHit[] = searchData?.results ?? [];

  const { data: gData } = useQuery({ queryKey: ["einsatz-gruende"], queryFn: () => listG() });
  const allGruende = (gData?.gruende ?? []) as Array<any>;
  const activeTyp = hausnotrufEnabled ? einsatzTyp : "av_einsatz";
  const gruende = allGruende.filter((g) => !g.einsatz_typ || g.einsatz_typ === activeTyp);

  const { data: fData } = useQuery({ queryKey: ["fahrer"], queryFn: () => listF() });
  const fahrer = (fData?.fahrer ?? []) as Array<{ id: string; display_name: string | null }>;

  useEffect(() => { setActiveQuery(query.trim()); }, [query]);

  function pickGrund(name: string, id: string | null) {
    setGrund(name); setGrundId(id);
  }

  // Wenn beim Wechsel des Einsatztyps ein Grund gewählt ist, der zum neuen Typ nicht passt → zurücksetzen
  useEffect(() => {
    if (!grundId) return;
    const g = allGruende.find((x) => x.id === grundId);
    if (g && g.einsatz_typ && g.einsatz_typ !== activeTyp) {
      setGrund(""); setGrundId(null);
    }
  }, [activeTyp, grundId, allGruende]);

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
    if (zielMode === "fahrer" && !fahrerId) { toast.error("Bitte einen Fahrer wählen"); return; }
    if (zielMode === "partner" && !partnerId) { toast.error("Bitte einen Partner wählen"); return; }
    if (zielMode === "sub" && !subName.trim()) { toast.error("Bitte Sub-Unternehmen angeben"); return; }
    if (activeTyp === "av_einsatz" && !alarmAm) {
      toast.error("Bitte die Alarmierungszeit eintragen"); return;
    }
    if (hausnotrufEnabled && einsatzTyp === "hausnotruf" && providerOptions.length > 0 && !hausnotrufProvider) {
      toast.error("Bitte einen Hausnotruf-Anbieter wählen"); return;
    }
    setSaving(true);
    try {
      if (zielMode === "partner") {
        await createForPartner({ data: {
          partner_id: partnerId,
          einsatzgrund: grund.trim(),
          einsatzgrund_id: grundId,
          kunden_name: picked.kunden_name,
          address: picked.address,
          key_number: picked.key_number,
          anlagen_nr: picked.anlagen_nr,
          teilnehmer_id: picked.teilnehmer_id,
          beschreibung: null,
        }});
        const p = partners.find((x) => x.id === partnerId);
        toast.success(`Einsatz an ${p?.display_name ?? "Partner"} übergeben`);
        navigate({ to: "/alarmierung" });
        return;
      }
      const created: any = await create({ data: {
        einsatzgrund: grund.trim(),
        einsatzgrund_id: grundId,
        einsatz_typ: hausnotrufEnabled ? einsatzTyp : "av_einsatz",
        hausnotruf_provider: einsatzTyp === "hausnotruf" ? (hausnotrufProvider || null) : null,
        kunden_name: picked.kunden_name,
        address: picked.address,
        key_number: picked.key_number,
        anlagen_nr: picked.anlagen_nr,
        teilnehmer_id: picked.teilnehmer_id,
        beschreibung: null,
        assigned_to: zielMode === "sub" ? null : fahrerId,
        sub_unternehmen: zielMode === "sub" ? subName.trim() : null,
        datei_id: picked.id,
        alarm_am: activeTyp === "av_einsatz" && alarmAm ? new Date(alarmAm).toISOString() : null,
      }});
      const f = fahrer.find((x) => x.id === fahrerId);
      if (zielMode === "sub") {
        toast.success(`Einsatz an Sub-Unternehmen ${subName.trim()} übergeben`);
      } else {
        toast.success(`Einsatz an ${f?.display_name ?? "Fahrer"} übergeben`);
      }
      // Wenn Schlüsselbuch aktiv und Schlüssel-Nr. vorhanden → Übergabe-Dialog öffnen
      if (zielMode !== "sub" && schluesselbuchOn && picked.key_number && created?.id) {
        setHandover({
          einsatzId: created.id,
          keyNumber: picked.key_number,
          fahrerId,
          fahrerName: f?.display_name ?? "Fahrer",
        });
        setTraegerMode("fahrer");
        setTraegerUserId(fahrerId);
        setTraegerName(f?.display_name ?? "");
        setHandoverNote("");
      } else {
        navigate({ to: "/alarmierung" });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Erstellen");
    } finally { setSaving(false); }
  }

  async function submitHandover() {
    if (!handover) return;
    const name = traegerMode === "fahrer" ? handover.fahrerName : traegerName.trim();
    if (!name) { toast.error("Bitte Träger-Namen angeben"); return; }
    setHandoverBusy(true);
    try {
      await ausgeben({ data: {
        einsatz_id: handover.einsatzId,
        key_number: handover.keyNumber,
        traeger_user_id: traegerMode === "fahrer" ? handover.fahrerId : (traegerUserId || null),
        traeger_name: name,
        notiz: handoverNote.trim() || null,
      }});
      toast.success("Schlüssel ins Schlüsselbuch eingetragen");
      setHandover(null);
      navigate({ to: "/alarmierung" });
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Eintragen");
    } finally { setHandoverBusy(false); }
  }

  function skipHandover() {
    setHandover(null);
    navigate({ to: "/alarmierung" });
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
        hausnotrufEnabled && (
          <section className="rounded-xl border border-border bg-card p-6 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2">
              <span className="size-6 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center">2</span>
              <h2 className="font-semibold">Einsatz-Typ</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEinsatzTyp("av_einsatz")}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  einsatzTyp === "av_einsatz"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30 hover:bg-muted/50"
                }`}
              >
                <div className="font-medium">AV-Einsatz</div>
                <div className="text-xs text-muted-foreground mt-0.5">Alarm-/Wachdienst-Einsatz</div>
              </button>
              <button
                type="button"
                onClick={() => setEinsatzTyp("hausnotruf")}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  einsatzTyp === "hausnotruf"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30 hover:bg-muted/50"
                }`}
              >
                <div className="font-medium">Hausnotruf</div>
                <div className="text-xs text-muted-foreground mt-0.5">Hausnotruf-Einsatz</div>
              </button>
            </div>
            {einsatzTyp === "hausnotruf" && providerOptions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs">Anbieter</Label>
                <div className="flex flex-wrap gap-2">
                  {providerOptions.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setHausnotrufProvider(p.key)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        hausnotrufProvider === p.key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 hover:bg-muted border-border text-foreground/80"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )
      )}

      {picked && activeTyp === "av_einsatz" && (
        <section className="rounded-xl border border-border bg-card p-6 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
          <h2 className="font-semibold">Alarmierungszeit</h2>
          <p className="text-xs text-muted-foreground">
            Zeitpunkt, zu dem der Alarm eingegangen ist. Erscheint im Einsatzbericht.
          </p>
          <Input
            type="datetime-local"
            value={alarmAm}
            onChange={(e) => setAlarmAm(e.target.value)}
            className="max-w-xs"
          />
        </section>
      )}

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
            <h2 className="font-semibold">Zuweisen</h2>
          </div>
          <div className="inline-flex rounded-lg border border-border overflow-hidden flex-wrap">
              <button
                type="button"
                onClick={() => setZielMode("fahrer")}
                className={`px-3 py-1.5 text-sm ${zielMode === "fahrer" ? "bg-primary text-primary-foreground" : "bg-muted/30 hover:bg-muted"}`}
              >Eigener Fahrer</button>
              {interventionOn && <button
                type="button"
                onClick={() => setZielMode("partner")}
                className={`px-3 py-1.5 text-sm inline-flex items-center gap-1.5 ${zielMode === "partner" ? "bg-primary text-primary-foreground" : "bg-muted/30 hover:bg-muted"}`}
              ><Network className="size-3.5" /> Partner</button>}
              <button
                type="button"
                onClick={() => setZielMode("sub")}
                className={`px-3 py-1.5 text-sm ${zielMode === "sub" ? "bg-primary text-primary-foreground" : "bg-muted/30 hover:bg-muted"}`}
              >Sub-Unternehmen</button>
          </div>
          {zielMode === "sub" ? (
            <div>
              <Label>Sub-Unternehmen</Label>
              <Input
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="Name des Sub-Unternehmens"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Der Einsatz wird ohne eigenen Fahrer angelegt. Im offiziellen Bericht wird kein Fahrer ausgewiesen.
              </p>
            </div>
          ) : zielMode === "partner" ? (
            partners.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Interventionspartner angelegt. Lege sie unter <b>Intervention</b> an.
              </p>
            ) : (
              <div>
                <Label>Partner</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue placeholder="Partner wählen" /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          ) : fahrer.length === 0 ? (
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
            <Button
              onClick={submit}
              disabled={
                saving || !grund.trim() ||
                (zielMode === "fahrer" ? !fahrerId : zielMode === "partner" ? !partnerId : !subName.trim())
              }
              className="gap-2"
            >
              <Send className="size-4" /> {zielMode === "partner" ? "Einsatz an Partner übergeben" : zielMode === "sub" ? "Einsatz an Sub-Unternehmen übergeben" : "Einsatz an Fahrer übergeben"}
            </Button>
            <Button onClick={() => navigate({ to: "/alarmierung" })} variant="ghost" className="ml-auto">
              Abbrechen
            </Button>
          </div>
        </section>
      )}

      {/* Schlüsselübergabe-Dialog */}
      <Dialog open={!!handover} onOpenChange={(o) => { if (!o) skipHandover(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" /> Schlüsselübergabe
            </DialogTitle>
            <DialogDescription>
              Trag den Schlüssel ins Schlüsselbuch ein. Der Träger bestätigt die Übernahme.
            </DialogDescription>
          </DialogHeader>
          {handover && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-center gap-3">
                <KeyRound className="size-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Schlüssel-Nr.</div>
                  <div className="text-lg font-bold tabular-nums">{handover.keyNumber}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Träger</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={traegerMode === "fahrer" ? "default" : "outline"}
                    onClick={() => { setTraegerMode("fahrer"); setTraegerUserId(handover.fahrerId); setTraegerName(handover.fahrerName); }}
                  >Fahrer ({handover.fahrerName})</Button>
                  <Button type="button" size="sm" variant={traegerMode === "andere" ? "default" : "outline"}
                    onClick={() => { setTraegerMode("andere"); setTraegerUserId(""); setTraegerName(""); }}
                  >Anderer Mitarbeiter</Button>
                </div>
              </div>

              {traegerMode === "andere" && (
                <div className="space-y-2">
                  <Label>Aus Team wählen (optional)</Label>
                  <Select value={traegerUserId} onValueChange={(v) => {
                    setTraegerUserId(v);
                    const f = fahrer.find((x) => x.id === v);
                    if (f?.display_name) setTraegerName(f.display_name);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
                    <SelectContent>
                      {fahrer.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.display_name ?? f.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="mt-2">Name (frei eintragbar)</Label>
                  <Input value={traegerName} onChange={(e) => setTraegerName(e.target.value)} placeholder="z.B. externer Subunternehmer" />
                </div>
              )}

              <div className="space-y-2">
                <Label>Notiz (optional)</Label>
                <Textarea value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)} rows={2} placeholder="…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={skipHandover} disabled={handoverBusy}>Überspringen</Button>
            <Button onClick={submitHandover} disabled={handoverBusy} className="gap-2">
              <Check className="size-4" /> Schlüssel ausgeben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
