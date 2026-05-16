import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MaintenanceBanner } from "@/components/layout/maintenance-banner";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { supabase } from "@/integrations/supabase/client";
import { useLocationTracker } from "@/hooks/use-location-tracker";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  useLocationTracker(!!user);
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="size-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  const name = (user?.user_metadata?.display_name as string) ?? user?.email?.split("@")[0] ?? "User";
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar displayName={name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar displayName={name} />
        <ImpersonationBanner />
        <MaintenanceBanner />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
