import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type PresenceEntry = {
  user_id: string;
  role: string | null;
  display_name: string | null;
  joined_at: string;
};

function channelName(domainId: string | null | undefined) {
  return `presence-domain-${domainId ?? "none"}`;
}

// Module-level registry: one channel per domain, shared between broadcaster + listeners.
// All .on() handlers MUST be attached BEFORE .subscribe() — Supabase rejects them otherwise.
type Entry = {
  channel: RealtimeChannel;
  listeners: Set<(list: PresenceEntry[]) => void>;
  refCount: number;
  subscribed: boolean;
};
const registry = new Map<string, Entry>();

function snapshot(channel: RealtimeChannel): PresenceEntry[] {
  const state = channel.presenceState() as Record<string, PresenceEntry[]>;
  const map = new Map<string, PresenceEntry>();
  Object.values(state).forEach((arr) =>
    arr.forEach((e) => {
      if (e && (e as any).user_id) map.set(e.user_id, e);
    }),
  );
  return Array.from(map.values());
}

function acquire(domainId: string, presenceKey: string): Entry {
  const name = channelName(domainId);
  let entry = registry.get(name);
  if (!entry) {
    const channel = supabase.channel(name, { config: { presence: { key: presenceKey } } });
    entry = { channel, listeners: new Set(), refCount: 0, subscribed: false };
    const notify = () => {
      const snap = snapshot(channel);
      entry!.listeners.forEach((cb) => cb(snap));
    };
    // Register ALL handlers before subscribe.
    channel.on("presence", { event: "sync" }, notify);
    channel.on("presence", { event: "join" }, notify);
    channel.on("presence", { event: "leave" }, notify);
    registry.set(name, entry);
  }
  entry.refCount++;
  return entry;
}

function release(domainId: string) {
  const name = channelName(domainId);
  const entry = registry.get(name);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    registry.delete(name);
  }
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
    const entry = acquire(domainId, userId);
    const ch = entry.channel;
    const trackSelf = () =>
      ch.track({
        user_id: userId,
        role: role ?? null,
        display_name: displayName ?? null,
        joined_at: new Date().toISOString(),
      } satisfies PresenceEntry);
    if (entry.subscribed) {
      void trackSelf();
    } else {
      entry.subscribed = true;
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") void trackSelf();
      });
    }
    return () => {
      try { void ch.untrack(); } catch {}
      release(domainId);
    };
  }, [enabled, domainId, userId, role, displayName]);
}

/** Read presence list (without tracking self) for the domain channel. */
export function usePresenceList(domainId: string | null | undefined): PresenceEntry[] {
  const [list, setList] = useState<PresenceEntry[]>([]);
  useEffect(() => {
    if (!domainId) { setList([]); return; }
    const viewerKey = `viewer-${Math.random().toString(36).slice(2, 9)}`;
    const entry = acquire(domainId, viewerKey);
    const cb = (snap: PresenceEntry[]) => setList(snap);
    entry.listeners.add(cb);
    if (!entry.subscribed) {
      entry.subscribed = true;
      entry.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") cb(snapshot(entry.channel));
      });
    } else {
      cb(snapshot(entry.channel));
    }
    return () => {
      entry.listeners.delete(cb);
      release(domainId);
    };
  }, [domainId]);
  return list;
}