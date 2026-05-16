import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, X } from "lucide-react";
import { getImpersonation, stopImpersonation } from "@/lib/superadmin.functions";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const { isSuperAdmin } = useRole();
  const getFn = useServerFn(getImpersonation);
  const stopFn = useServerFn(stopImpersonation);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["impersonation"],
    queryFn: () => getFn(),
    enabled: isSuperAdmin,
    refetchInterval: 30_000,
  });
  if (!isSuperAdmin || !data?.domain) return null;
  return (
    <div className="bg-warning text-warning-foreground px-4 py-2 text-sm flex items-center gap-3 border-b border-warning/40">
      <Crown className="size-4 shrink-0" />
      <span className="flex-1">
        Du agierst aktuell als Domain <strong>{data.domain.name}</strong> ({data.domain.slug})
      </span>
      <button
        onClick={async () => {
          try {
            await stopFn();
            await qc.invalidateQueries();
            toast.success("Impersonation beendet");
          } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
        }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-warning-foreground/10 hover:bg-warning-foreground/20 transition"
      >
        <X className="size-3.5" /> Beenden
      </button>
    </div>
  );
}
