import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRole } from "@/hooks/use-role";
import { useDomainModules } from "@/hooks/use-domain-modules";
import { AccessDenied } from "@/components/layout/access-denied";
import {
  listMyPartners, listAvailablePartnerDomains, upsertPartner, deletePartner,
} from "@/lib/intervention.functions";

export const Route = createFileRoute("/_authenticated/intervention")({
  component: InterventionPage,
});

function InterventionPage() {
  const { isAdmin, loading } = useRole();
  const { data: modules } = useDomainModules();
  const moduleOn = modules?.has("intervention") ?? false;
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;
  if (!isAdmin) return <AccessDenied />;
  if (!moduleOn) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl">
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Intervention</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Das Modul „Intervention" ist für deine Domain nicht freigeschaltet. Bitte den SuperAdmin um Aktivierung.
          </p>
        </div>
      </div>
    );
  }
  return <InterventionAdmin />;
}

type Partner = {
  id: string;
  partner_domain_id: string;
  display_name: string;
  kontakt_email: string | null;
  kontakt_telefon: string | null;
  notiz: string | null;
  aktiv: boolean;
};

function InterventionAdmin() {
  const list = useServerFn(listMyPartners);
  const listDomains = useServerFn(listAvailablePartnerDomains);
  const save = useServerFn(upsertPartner);
  const del = useServerFn(deletePartner);
  const qc = useQueryClient();

  const { data: pData } = useQuery({ queryKey: ["intervention-partners"], queryFn: () => list() });
  const partners: Partner[] = (pData?.partners ?? []) as any;
  const { data: dData } = useQuery({ queryKey: ["intervention-available-domains"], queryFn: () => listDomains() });
  const domains: Array<{ id: string; name: string }> = (dData?.domains ?? []) as any;

  const [editing, setEditing] = useState<Partial<Partner> | null>(null);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setEditing({ display_name: "", partner_domain_id: "", kontakt_email: "", kontakt_telefon: "", notiz: "", aktiv: true });
  }

  async function submit() {
    if (!editing) return;
    if (!editing.partner_domain_id) { toast.error("Bitte Partner-Domain wählen"); return; }
    if (!editing.display_name?.trim()) { toast.error("Bitte Anzeige-Name eingeben"); return; }
    setBusy(true);
    try {
      await save({ data: {
        id: editing.id ?? null,
        partner_domain_id: editing.partner_domain_id,
        display_name: editing.display_name.trim(),
        kontakt_email: editing.kontakt_email ?? "",
        kontakt_telefon: editing.kontakt_telefon ?? "",
        notiz: editing.notiz ?? "",
        aktiv: editing.aktiv ?? true,
      }});
      toast.success("Gespeichert");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["intervention-partners"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Partner wirklich löschen?")) return;
    try {
      await del({ data: { id } });
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["intervention-partners"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Network className="size-7 text-primary" /> Intervention
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verwalte deine Interventionspartner. Beim Einsatz erstellen kannst du den Einsatz an einen Partner übergeben.
          </p>
        </div>
        <Button onClick={startNew} className="gap-2"><Plus className="size-4" /> Partner hinzufügen</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Anzeige-Name</th>
              <th className="px-4 py-2 font-medium">Partner-Domain</th>
              <th className="px-4 py-2 font-medium">Kontakt</th>
              <th className="px-4 py-2 font-medium">Aktiv</th>
              <th className="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {partners.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Noch keine Partner</td></tr>
            )}
            {partners.map((p) => {
              const dom = domains.find((d) => d.id === p.partner_domain_id);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium">{p.display_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{dom?.name ?? p.partner_domain_id.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {p.kontakt_email}{p.kontakt_email && p.kontakt_telefon ? " · " : ""}{p.kontakt_telefon}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.aktiv ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {p.aktiv ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Partner bearbeiten" : "Partner hinzufügen"}</DialogTitle>
            <DialogDescription>Verknüpfe eine andere AlarmDesk-Domain als Interventionspartner.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Partner-Domain</Label>
                <Select
                  value={editing.partner_domain_id ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, partner_domain_id: v })}
                  disabled={!!editing.id}
                >
                  <SelectTrigger><SelectValue placeholder="Domain wählen" /></SelectTrigger>
                  <SelectContent>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Anzeige-Name</Label>
                <Input value={editing.display_name ?? ""} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} placeholder="z. B. Wachdienst Müller" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Kontakt E-Mail</Label>
                  <Input type="email" value={editing.kontakt_email ?? ""} onChange={(e) => setEditing({ ...editing, kontakt_email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={editing.kontakt_telefon ?? ""} onChange={(e) => setEditing({ ...editing, kontakt_telefon: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notiz</Label>
                <Textarea rows={2} value={editing.notiz ?? ""} onChange={(e) => setEditing({ ...editing, notiz: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="text-sm">Aktiv</div>
                <Switch checked={editing.aktiv ?? true} onCheckedChange={(v) => setEditing({ ...editing, aktiv: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
            <Button onClick={submit} disabled={busy}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
