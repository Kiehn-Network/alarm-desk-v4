import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOnboardingStatus } from "@/lib/onboarding.functions";
import { useAuth } from "@/hooks/use-auth";

export function useOnboardingStatus() {
  const { session } = useAuth();
  const fn = useServerFn(getOnboardingStatus);
  return useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => fn(),
    enabled: !!session,
    staleTime: 30_000,
  });
}