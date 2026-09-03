import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLagerZugriff } from "@/lib/lager.functions";

/**
 * Whether the current user may open the Lager administration page.
 * Only domain admins, superadmins and assigned Lager-Admins are allowed.
 */
export function useLagerAccess() {
  const fn = useServerFn(getLagerZugriff);
  return useQuery({
    queryKey: ["lager-zugriff"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
