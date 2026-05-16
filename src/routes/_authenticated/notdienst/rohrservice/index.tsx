import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Wrench, Phone, StickyNote, Plus, Trash2 } from "lucide-react";
import {
  getCurrentNotdienst,
  listNotdienst,
  listMitarbeiter,
  upsertNotdienst,
  deleteNotdienst,
} from "@/lib/rohrservice.functions";
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

export const Route = createFileRoute("/_authenticated/notdienst/rohrservice/")({
  component: Dashboard,
});

function fmtDe(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Dashboard() {
  const currentFn = useServerFn(getCurrentNotdienst);
  const { data: current } = useQuery({
    queryKey: ["rs-notdienst-current"],
    queryFn: () => currentFn(),
    refetchInterval: 60_000,
  });

  const aktiv = current?.eintrag as any;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-primary">Willkommen beim Rohrservice</h1>
        <p className="text-muted-foreground mt-2">
          Hier können Sie neue Berichte erfassen, bestehende Einsätze bearbeiten oder verwalten.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Tile
          icon={<FileText className="size-5 text-primary" />}
          title="Neuer Bericht"
          desc="Erfassen Sie ein neues Einsatzformular schnell und unkompliziert."
          cta={<Link to="/notdienst/rohrservice/neu"><Button>Bericht erstellen</Button></Link>}
        />
        <Tile
          icon={<Wrench className="size-5 text-primary" />}
          title="Nachbearbeitung"
          desc="Anzeigen, bearbeiten oder löschen Sie bestehende Berichte."
          cta={<Link to="/notdienst/rohrservice/nachbearbeitung"><Button>Berichte verwalten</Button></Link>}
        />
        <Tile
          icon={<Phone className="size-5 text-rose-500" />}
          title="Notdienst"
          desc={
            aktiv ? (
              <div className="text-sm space-y-0.5">
                <div><b>Zuständig:</b> {aktiv.mitarbeiter?.name ?? "–"}</div>
                {aktiv.mitarbeiter?.telefon_1 && (
                  <div><b>Telefon:</b> {aktiv.mitarbeiter.telefon_1}</div>
                )}
                <div><b>Zeitraum:</b> {fmtDe(aktiv.von)} – {fmtDe(aktiv.bis)}</div>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Aktuell kein aktiver Notdienst hinterlegt.</span>
            )
          }
          cta={<NotdienstDialog />}
        />
        <Tile
          icon={<StickyNote className="size-5 text-amber-500" />}
          title="Notizen"
          desc={
            <div className="text-sm space-y-2">
              <div className="text-rose-600 font-semibold">Achtung!</div>
              <div>
                Es wird erst der Bericht versendet wenn wir die <b>Endzeit</b> haben!!
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

function Tile({
  icon, title, desc, cta,
}: { icon: React.ReactNode; title: string; desc: React.ReactNode; cta?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
      </div>
      <div className="text-muted-foreground mb-4">{desc}</div>
      {cta}
    </div>
  );
}

function NotdienstDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listNotdienst);
  const mitFn = useServerFn(listMitarbeiter);
  const upsertFn = useServerFn(upsertNotdienst);
  const delFn = useServerFn(deleteNotdienst);

  const { data: list } = useQuery({
    queryKey: ["rs-notdienst-list"], queryFn: () => listFn(), enabled: open,
  });
  const { data: mit } = useQuery({
    queryKey: ["rs-mitarbeiter"], queryFn: () => mitFn(), enabled: open,
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
      qc.invalidateQueries({ queryKey: ["rs-notdienst-current"] });
      qc.invalidateQueries({ queryKey: ["rs-notdienst-list"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Eintrag gelöscht");
      qc.invalidateQueries({ queryKey: ["rs-notdienst-current"] });
      qc.invalidateQueries({ queryKey: ["rs-notdienst-list"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Notdienst eintragen</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench className="size-4" /> Notdienst bearbeiten</DialogTitle>
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