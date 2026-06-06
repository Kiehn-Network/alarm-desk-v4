import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  listSupportTickets, createSupportTicket, getSupportTicket,
  addSupportTicketMessage, updateSupportTicket,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportPage,
});

const STATUS_LABEL: Record<string, string> = { open: "Offen", in_progress: "In Bearbeitung", closed: "Geschlossen" };
const PRIO_LABEL: Record<string, string> = { low: "Niedrig", normal: "Normal", high: "Hoch" };

function StatusBadge({ s }: { s: string }) {
  const variant: any = s === "open" ? "default" : s === "in_progress" ? "secondary" : "outline";
  return <Badge variant={variant}>{STATUS_LABEL[s] ?? s}</Badge>;
}
function PrioBadge({ p }: { p: string }) {
  const cls = p === "high" ? "border-red-500 text-red-600" : p === "low" ? "border-muted text-muted-foreground" : "";
  return <Badge variant="outline" className={cls}>{PRIO_LABEL[p] ?? p}</Badge>;
}

function SupportPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSupportTickets);
  const createFn = useServerFn(createSupportTicket);
  const lq = useQuery({ queryKey: ["my-tickets"], queryFn: () => listFn({ data: {} }) });

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [activeId, setActiveId] = useState<string | null>(null);

  const createM = useMutation({
    mutationFn: () => createFn({ data: { subject, description, priority } }),
    onSuccess: (r) => {
      toast.success("Ticket erstellt");
      setOpen(false); setSubject(""); setDescription(""); setPriority("normal");
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      setActiveId((r as any).id);
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <LifeBuoy className="size-3.5" /> Support
          </div>
          <h1 className="text-3xl font-bold mt-1">Hilfe anfordern</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stelle eine Anfrage an die SuperAdmins. Du siehst hier alle Tickets deines Mandanten.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Neues Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neues Support-Ticket</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Betreff</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Kurz worum geht's?" />
              </div>
              <div className="space-y-1.5">
                <Label>Beschreibung</Label>
                <Textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Was ist passiert? Was hast du erwartet?" />
              </div>
              <div className="space-y-1.5">
                <Label>Priorität</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button disabled={subject.length < 3 || description.length < 5 || createM.isPending}
                onClick={() => createM.mutate()}>Absenden</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader><CardTitle>Meine Tickets</CardTitle></CardHeader>
        <CardContent>
          {lq.isLoading ? <div className="text-sm text-muted-foreground">Lädt …</div> :
            (lq.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Noch keine Tickets erstellt.</div>
            ) : (
              <div className="divide-y">
                {(lq.data ?? []).map((t: any) => (
                  <button key={t.id} onClick={() => setActiveId(t.id)}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-muted/40 px-2 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.last_message_at).toLocaleString("de-DE")} · {t.creator?.display_name ?? "—"}
                      </div>
                    </div>
                    <PrioBadge p={t.priority} />
                    <StatusBadge s={t.status} />
                  </button>
                ))}
              </div>
            )}
        </CardContent>
      </Card>

      <TicketDialog id={activeId} onClose={() => setActiveId(null)} canChangeStatus />
    </div>
  );
}

export function TicketDialog({
  id, onClose, canChangeStatus,
}: { id: string | null; onClose: () => void; canChangeStatus?: boolean }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getSupportTicket);
  const addFn = useServerFn(addSupportTicketMessage);
  const updFn = useServerFn(updateSupportTicket);
  const tq = useQuery({
    queryKey: ["ticket", id], queryFn: () => getFn({ data: { id: id! } }), enabled: !!id,
  });
  const [reply, setReply] = useState("");
  const addM = useMutation({
    mutationFn: () => addFn({ data: { ticket_id: id!, body: reply } }),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      qc.invalidateQueries({ queryKey: ["sa-tickets"] });
      qc.invalidateQueries({ queryKey: ["sa-open-tickets"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });
  const updM = useMutation({
    mutationFn: (v: { status?: any; priority?: any }) => updFn({ data: { id: id!, ...v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      qc.invalidateQueries({ queryKey: ["sa-tickets"] });
      qc.invalidateQueries({ queryKey: ["sa-open-tickets"] });
    },
  });

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="truncate">{tq.data?.ticket?.subject ?? "Ticket"}</span>
          </DialogTitle>
        </DialogHeader>
        {tq.isLoading || !tq.data ? <div className="text-sm text-muted-foreground">Lädt …</div> : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <StatusBadge s={tq.data.ticket.status} />
              <PrioBadge p={tq.data.ticket.priority} />
              <span>Erstellt {new Date(tq.data.ticket.created_at).toLocaleString("de-DE")}</span>
              <span>· von {tq.data.ticket.creator?.display_name ?? "—"}</span>
            </div>
            {canChangeStatus && (
              <div className="flex items-center gap-2">
                <Select value={tq.data.ticket.status}
                  onValueChange={(v) => updM.mutate({ status: v })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Offen</SelectItem>
                    <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                    <SelectItem value="closed">Geschlossen</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tq.data.ticket.priority}
                  onValueChange={(v) => updM.mutate({ priority: v })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-3 max-h-[40vh] overflow-auto border rounded-md p-3 bg-muted/20">
              {tq.data.messages.map((m: any) => (
                <div key={m.id} className="space-y-0.5">
                  <div className="text-xs text-muted-foreground">
                    {m.author?.display_name ?? "—"} · {new Date(m.created_at).toLocaleString("de-DE")}
                  </div>
                  <div className="text-sm whitespace-pre-wrap rounded bg-card border px-3 py-2">{m.body}</div>
                </div>
              ))}
            </div>
            {tq.data.ticket.status !== "closed" && (
              <div className="space-y-2">
                <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Antwort schreiben …" />
                <div className="flex justify-end">
                  <Button onClick={() => addM.mutate()} disabled={reply.trim().length === 0 || addM.isPending}>
                    <Send className="size-4 mr-2" />Antworten
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="size-4 mr-2" />Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}