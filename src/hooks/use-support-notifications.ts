import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";

const STATUS_LABEL: Record<string, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  closed: "Geschlossen",
};

/**
 * Realtime toasts for support tickets:
 * - new message from someone other than the current user
 * - status change on a ticket
 * RLS scopes events to tickets the user may see (own domain or superadmin).
 */
export function useSupportNotifications() {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin } = useRole();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  useEffect(() => {
    if (!user) return;
    if (!isAdmin && !isSuperAdmin) return;

    const target = isSuperAdmin ? "/superadmin?tab=tickets" : "/admin?tab=hilfe";

    const channel = supabase
      .channel(`support-notify-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_ticket_messages" },
        (payload) => {
          const row: any = payload.new;
          if (!row || row.author_id === userIdRef.current) return;
          qc.invalidateQueries({ queryKey: ["support-tickets"] });
          qc.invalidateQueries({ queryKey: ["support-open-count"] });
          if (row.ticket_id) qc.invalidateQueries({ queryKey: ["support-ticket", row.ticket_id] });
          toast.message("Neue Antwort auf Support-Ticket", {
            description: row.body ? String(row.body).slice(0, 120) : undefined,
            action: { label: "Öffnen", onClick: () => navigate({ to: target }) },
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets" },
        (payload) => {
          const oldRow: any = payload.old;
          const newRow: any = payload.new;
          if (!newRow) return;
          if (oldRow && oldRow.status === newRow.status) return;
          // Don't notify the actor of their own change (best-effort: created_by)
          // We can't know who changed it without an audit; still inform everyone
          // because either party benefits from status visibility.
          qc.invalidateQueries({ queryKey: ["support-tickets"] });
          qc.invalidateQueries({ queryKey: ["support-open-count"] });
          toast.message("Ticket-Status geändert", {
            description: `„${newRow.subject ?? "Ticket"}" → ${STATUS_LABEL[newRow.status] ?? newRow.status}`,
            action: { label: "Öffnen", onClick: () => navigate({ to: target }) },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin, isSuperAdmin, qc, navigate]);
}