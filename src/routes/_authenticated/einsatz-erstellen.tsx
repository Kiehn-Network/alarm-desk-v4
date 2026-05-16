import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus, Save, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/hooks/use-role";
import { createEinsatz, listEinsatzGruende, createEinsatzGrund } from "@/lib/einsaetze.functions";

export const Route = createFileRoute("/_authenticated/einsatz-erstellen")({
  component: EinsatzErstellenPage,
});

const CUSTOM = "__custom__";

function EinsatzErstellenPage() {
  const navigate = useNavigate();
  const { canManage, loading: roleLoading } = useRole();
  const list = useServerFn(listEinsatzGruende);
  const create = useServerFn(createEinsatz);
  const addGrund = useServerFn(createEinsatzGrund);

  const { data, refetch } = useQuery({ queryKey: ["einsatz-gruende"], queryFn: () => list() });
  const gruende = data?.gruende ?? [];

  const [grundId, setGrundId] = useState<string>("");
  const [customGrund, setCustomGrund] = useState("");
  const [form, setForm] = useState({
    kunden_name: "", address: "", key_number: "", anlagen_nr: "",
    teilnehmer_id: "", prioritaet: "normal", beschreibung: "", geplant_am: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!grundId && gruende.length > 0) setGrundId(gruende[0].id);
  }, [gruende, grundId]);

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

  async function submit(asEntwurf: boolean) {
    const isCustom = grundId === CUSTOM;
    const grundName = isCustom ? customGrund.trim() : (gruende.find((g: any) => g.id === grundId)?.name ?? "");
    if (!grundName) { toast.error("Bitte Einsatzgrund angeben"); return; }
    setSaving(true);
    try {
      let einsatzgrund_id: string | null = isCustom ? null : grundId || null;
      if (isCustom) {
        try {
          const r: any = await addGrund({ data: { name: grundName } });
          einsatzgrund_id = r?.id ?? null;
          await refetch();
        } catch {/* duplicate ok */}
      }
      await create({ data: {
        einsatzgrund: grundName,
        einsatzgrund_id,
        kunden_name: form.kunden_name || null,
        address: form.address || null,
        key_number: form.key_number || null,
        anlagen_nr: form.anlagen_nr || null,
        teilnehmer_id: form.teilnehmer_id || null,
        prioritaet: form.prioritaet as any,
        beschreibung: form.beschreibung || null,
        geplant_am: form.geplant_am ? new Date(form.geplant_am).toISOString() : null,
        status: asEntwurf ? "entwurf" : "wartet_freigabe",
      }});
      toast.success(asEntwurf ? "Als Entwurf gespeichert" : "Einsatz zur Freigabe eingereicht");
      navigate({ to: "/alarmierung" });
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Speichern");
    } finally { setSaving(false); }
  }

  const set = (k: keyof typeof form) => (e: any) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Einsatz erstellen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Neuer Einsatz – wird nach dem Einreichen vom Dispatcher/Admin freigegeben.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Einsatzgrund</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Grund auswählen</Label>
              <Select value={grundId} onValueChange={setGrundId}>
                <SelectTrigger><SelectValue placeholder="Grund wählen" /></SelectTrigger>
                <SelectContent>
                  {gruende.map((g: any) => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}
                  <SelectItem value={CUSTOM}>+ Eigenen Grund eingeben</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorität</Label>
              <Select value={form.prioritaet} onValueChange={(v) => setForm((p) => ({ ...p, prioritaet: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="niedrig">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="hoch">Hoch</SelectItem>
                  <SelectItem value="kritisch">Kritisch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {grundId === CUSTOM && (
            <div>
              <Label>Eigener Einsatzgrund</Label>
              <Input value={customGrund} onChange={(e) => setCustomGrund(e.target.value)} placeholder="z.B. Wartungseinsatz Sensor" maxLength={200} />
              <p className="text-xs text-muted-foreground mt-1">Wird auch in die Grund-Liste übernommen.</p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Objektdaten</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Kunde</Label><Input value={form.kunden_name} onChange={set("kunden_name")} maxLength={200} /></div>
            <div><Label>Adresse</Label><Input value={form.address} onChange={set("address")} maxLength={255} /></div>
            <div><Label>Schlüssel-Nr.</Label><Input value={form.key_number} onChange={set("key_number")} maxLength={100} /></div>
            <div><Label>Anlagen-Nr.</Label><Input value={form.anlagen_nr} onChange={set("anlagen_nr")} maxLength={100} /></div>
            <div><Label>Teilnehmer-ID</Label><Input value={form.teilnehmer_id} onChange={set("teilnehmer_id")} maxLength={100} /></div>
            <div><Label>Geplant am</Label><Input type="datetime-local" value={form.geplant_am} onChange={set("geplant_am")} /></div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Beschreibung</h2>
          <Textarea value={form.beschreibung} onChange={set("beschreibung")} rows={5} maxLength={4000} placeholder="Details zum Einsatz..." />
        </section>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
          <Button onClick={() => submit(false)} disabled={saving} className="gap-2">
            <Send className="size-4" /> Zur Freigabe einreichen
          </Button>
          <Button onClick={() => submit(true)} disabled={saving} variant="secondary" className="gap-2">
            <Save className="size-4" /> Als Entwurf speichern
          </Button>
          <Button onClick={() => navigate({ to: "/alarmierung" })} variant="ghost" className="ml-auto">
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}
