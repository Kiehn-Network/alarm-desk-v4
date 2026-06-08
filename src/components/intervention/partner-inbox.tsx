import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Network, Check, X, UserPlus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listSharedToMe, partnerRespond, partnerAssignFahrer,
} from "@/lib/intervention.functions";
import { listFahrer } from "@/lib/einsaetze.functions";

export function PartnerInbox() {
  const list = useServerFn(listSharedToMe);
  const respond = useServerFn(partnerRespond);
  const assign = useServerFn(partnerAssignFahrer);
  const listF = useServerFn(listFahrer);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["intervention-inbox"],
    queryFn: () => list(),
    refetchInterval: 30000,
  });
  const { data: fData } = useQuery({ queryKey: ["fahrer"], queryFn: () => listF() });
  const fahrer = (fData?.fahrer ?? []) as Array<{ id: string; display_name: string | null }>;

  const [pickFahrer, setPickFahrer] = useState<Record<string, string>>({});

  const shares = (data?.shares ?? []) as any[];
  const einsaetze = (data?.einsaetze ?? {}) as Record<string, any>;
  const owners = (data?.owners ?? {}) as Record<string, string>;

  if (shares.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
        Keine eingehenden Partner-Einsätze.
      </div>
    );
  }

  async function act(share_id: string, action: "accept" | "decline") {
    try {
      const grund = action === "decline" ? (prompt("Ablehnungsgrund (optional)") ?? null) : null;
      await respond({ data: { share_id, action, grund } });
      toast.success(action === "accept" ? "Angenommen" : "Abgelehnt");
      qc.invalidateQueries({ queryKey: ["intervention-inbox"] });
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  async function assignFahrer(share_id: string) {
    const fid = pickFahrer[share_id];
    if (!fid) { toast.error("Bitte Fahrer wählen"); return; }
    try {
      await assign({ data: { share_id, fahrer_id: fid } });
      toast.success("Fahrer zugewiesen");
      qc.invalidateQueries({ queryKey: ["intervention-inbox"] });
      qc.invalidateQueries({ queryKey: ["meine-einsaetze"] });
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  return (
    <div className="space-y-3">
      {shares.map((s: any) => {
        const e = einsaetze[s.einsatz_id];
        const ownerName = owners[s.owner_domain_id] ?? "Partner";
        const statusColor = s.status === "offen" ? "bg-amber-500/10 text-amber-500"
          : s.status === "angenommen" ? "bg-primary/10 text-primary"
          : s.status === "in_bearbeitung" ? "bg-blue-500/10 text-blue-500"
          : s.status === "abgelehnt" ? "bg-destructive/10 text-destructive"
          : "bg-success/10 text-success";
        return (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Network className="size-4 text-primary" />
                  <span className="text-xs text-muted-foreground">von {ownerName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>{s.status}</span>
                </div>
                <div className="font-semibold mt-1">{e?.einsatzgrund ?? "—"}</div>
                <div className="text-sm text-muted-foreground">
                  {e?.kunden_name}{e?.address ? ` · ${e.address}` : ""}
                </div>
                {e?.key_number && <div className="text-xs text-muted-foreground mt-0.5">🔑 {e.key_number}</div>}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <Clock className="size-3" />
                {new Date(s.created_at).toLocaleString("de-DE")}
              </div>
            </div>

            {s.status === "offen" && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => act(s.id, "accept")} className="gap-1.5">
                  <Check className="size-4" /> Annehmen
                </Button>
                <Button size="sm" variant="outline" onClick={() => act(s.id, "decline")} className="gap-1.5">
                  <X className="size-4" /> Ablehnen
                </Button>
              </div>
            )}

            {(s.status === "angenommen" || s.status === "in_bearbeitung") && (
              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    value={pickFahrer[s.id] ?? s.partner_assigned_to ?? ""}
                    onValueChange={(v) => setPickFahrer((p) => ({ ...p, [s.id]: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Fahrer wählen" /></SelectTrigger>
                    <SelectContent>
                      {fahrer.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.display_name ?? f.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={() => assignFahrer(s.id)} className="gap-1.5">
                  <UserPlus className="size-4" /> {s.partner_assigned_to ? "Wechseln" : "Zuweisen"}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
