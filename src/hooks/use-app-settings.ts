import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings } from "@/lib/settings.functions";
import { useAuth } from "@/hooks/use-auth";

export function useAppSettings() {
  const fn = useServerFn(getAppSettings);
  const { session } = useAuth();
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: () => fn(),
    staleTime: 30_000,
    enabled: !!session,
  });
}