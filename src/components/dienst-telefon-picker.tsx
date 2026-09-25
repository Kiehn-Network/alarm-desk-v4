import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listDienstTelefone, selectMyDienstTelefon } from "@/lib/dienst-telefone.functions";

export function DienstTelefonPicker() {
  const qc = useQueryClient();
  const list = useServerFn(listDienstTelefone);
  const select = useServerFn(selectMyDienstTelefon);
  const { data } = useQuery({ queryKey: ["dienst-telefone"], queryFn: () => list() });
  const aktive = (data?.telefone ?? []).filter((t) => t.aktiv);
  if (aktive.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
      <Phone className="size-5 text-primary shrink-0" />
      <div className="text-sm font-medium">Welches Telefon hast du dabei?</div>
      <Select
        value={data?.selectedId ?? "none"}
        onValueChange={async (v) => {
          try {
            await select({ data: { id: v === "none" ? null : v } });
            qc.invalidateQueries({ queryKey: ["dienst-telefone"] });
            toast.success("Telefon gespeichert");
          } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
        }}
      >
        <SelectTrigger className="flex-1 min-w-48"><SelectValue placeholder="Telefon wählen" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Kein Diensttelefon</SelectItem>
          {aktive.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.nummer}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
