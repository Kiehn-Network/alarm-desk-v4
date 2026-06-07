import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PresenceEntry = {
  user_id: string;
  role: string | null;
  display_name: string | null;
  joined_at: string;
};

function channelName(domainId: string | null | undefined) {
  return `presence-domain-${domainId ?? "none"}`;
}

/** Broadcast the current user's presence on the domain channel. */
export function usePresenceBroadcast(opts: {
  enabled: boolean;
  domainId: string | null | undefined;
  userId: string | null | undefined;
  role: string | null | undefined;
  displayName: string | null | undefined;
}) {
  const { enabled, domainId, userId, role, displayName } = opts;
  useEffect(() => {
    if (!enabled || !domainId || !userId) return;
    const ch = supabase.channel(channelName(domainId), {
      config: { presence: { key: userId } },
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          user_id: userId,
          role: role ?? null,
          display_name: displayName ?? null,
          joined_at: new Date().toISOString(),
        } satisfies PresenceEntry);
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [enabled, domainId, userId, role, displayName]);
}

/** Read presence list (without tracking self) for the domain channel. */
export function usePresenceList(domainId: string | null | undefined): PresenceEntry[] {
  const [list, setList] = useState<PresenceEntry[]>([]);
  useEffect(() => {
    if (!domainId) { setList([]); return; }
    const ch = supabase.channel(channelName(domainId), {
      config: { presence: { key: `viewer-${Math.random().toString(36).slice(2, 9)}` } },
    });
    const sync = () => {
      const state = ch.presenceState() as Record<string, PresenceEntry[]>;
      const flat: PresenceEntry[] = [];
      Object.values(state).forEach((arr) => arr.forEach((e) => {
        if (e && (e as any).user_id) flat.push(e);
      }));
      // de-duplicate by user_id
      const map = new Map<string, PresenceEntry>();
      flat.forEach((e) => { map.set(e.user_id, e); });
      setList(Array.from(map.values()));
    };
    ch.on("presence", { event: "sync" }, sync);
    ch.on("presence", { event: "join" }, sync);
    ch.on("presence", { event: "leave" }, sync);
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [domainId]);
  return list;
}