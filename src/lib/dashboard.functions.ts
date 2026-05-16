import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Placeholder: real metrics will come from einsaetze/dateien tables in next iteration
    return {
      userId,
      stats: {
        monatEinsaetze: 0,
        aktiveEinsaetze: 0,
        gesamtEinsaetze: 0,
        storniert: 0,
        datensaetze: 0,
      },
      recent: [] as Array<{ id: string; dateiname: string; fahrer: string; start: string; ende: string; dauer: string; status: string }>,
    };
  });
