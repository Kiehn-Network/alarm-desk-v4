import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings } from "@/lib/settings.functions";

export function useAppSettings() {
  const fn = useServerFn(getAppSettings);
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}