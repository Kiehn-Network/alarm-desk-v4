import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformSettings } from "@/lib/superadmin.functions";

export function usePlatformSettings() {
  const fn = useServerFn(getPlatformSettings);
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}
