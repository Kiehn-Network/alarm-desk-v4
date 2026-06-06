import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyTourSettings } from "@/lib/tour.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { TourDialog } from "./tour-dialog";

/** Mountet sich global; öffnet die Tour automatisch beim ersten Login,
 *  wenn `tour_enabled` true ist und `completed_at` noch nicht gesetzt wurde. */
export function TourLauncher() {
  const { session } = useAuth();
  const { isSuperAdmin, isImpersonating } = useRole();
  const fn = useServerFn(getMyTourSettings);
  const { data, isFetched } = useQuery({
    queryKey: ["my-tour"],
    queryFn: () => fn(),
    enabled: !!session && !(isSuperAdmin && !isImpersonating),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isSuperAdmin && !isImpersonating) return;
    if (!isFetched) return;
    // null → noch nie gesehen → zeigen
    if (data == null) { setOpen(true); return; }
    if (data.tour_enabled && !data.completed_at) setOpen(true);
  }, [data, isFetched, isSuperAdmin, isImpersonating]);

  // global Listener: erlaubt anderen Komponenten, die Tour zu öffnen
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-tour", onOpen);
    return () => window.removeEventListener("open-tour", onOpen);
  }, []);

  if (!session) return null;
  if (isSuperAdmin && !isImpersonating) return null;
  return (
    <TourDialog
      open={open}
      onOpenChange={setOpen}
      enabledKeys={data?.enabled_steps && data.enabled_steps.length > 0 ? data.enabled_steps : null}
    />
  );
}