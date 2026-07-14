import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, X, Send, Paperclip, Hash, Shield, Users,
  Pencil, Trash2, Check, Download, ArrowLeft, Search, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useDomainModules } from "@/hooks/use-domain-modules";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  kind: "channel" | "dm";
  title: string | null;
  domain_id: string;
  restricted_roles?: string[] | null;
};
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};
type Profile = { id: string; display_name: string | null; avatar_url: string | null };

const SOUND_KEY = "chat:sound";

function SignedAttachment({
  path, name, mime,
}: { path: string; name: string | null; mime: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrl(path, 60 * 60);
      if (!cancel) setUrl(data?.signedUrl ?? null);
    })();
    return () => { cancel = true; };
  }, [path]);
  if (!url) return null;
  const isImage = mime?.startsWith("image/");
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={name ?? ""} className="mt-1 rounded-lg max-h-48" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="mt-1 inline-flex items-center gap-1.5 text-xs underline opacity-90">
      <Download className="size-3" /> {name}
    </a>
  );
}

function playPing() {
  if (localStorage.getItem(SOUND_KEY) === "0") return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.08;
    o.start(); o.stop(ctx.currentTime + 0.12);
  } catch {}
}

type UnreadMap = Record<string, number>;
type View = "list" | "thread" | "newdm";

export function ChatWidget() {
  const { user } = useAuth();
  const { domainId, roles } = useRole();
  const { data: modules } = useDomainModules();
  const chatEnabled = modules?.has("chat") ?? false;

  const canAccessZentrale = useMemo(() => {
    if (!roles) return false;
    return roles.includes("superadmin") || roles.includes("admin") || roles.includes("dispatcher");
  }, [roles]);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [unreadMap, setUnreadMap] = useState<UnreadMap>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchDm, setSearchDm] = useState("");

  const totalUnread = useMemo(
    () => Object.values(unreadMap).reduce((a, b) => a + b, 0),
    [unreadMap],
  );

  // Load: profiles + ensure Allgemein/Zentrale channels + list DMs + unread counts
  useEffect(() => {
    if (!user || !domainId || !chatEnabled) return;
    let cancel = false;
    setLoadError(null);
    (async () => {
      try {
        // profiles for the domain
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,display_name,avatar_url")
          .eq("domain_id", domainId);
        if (cancel) return;
        const pmap: Record<string, Profile> = {};
        (profs ?? []).forEach((p: any) => { pmap[p.id] = p; });
        setProfiles(pmap);

        // Ensure Allgemein
        const gen = await supabase.rpc("get_or_create_domain_channel");
        if (gen.error) throw gen.error;
        const genId = gen.data as string;

        // Ensure Zentrale (only if user has access)
        let zenId: string | null = null;
        if (canAccessZentrale) {
          const zen = await supabase.rpc("get_or_create_zentrale_channel");
          if (!zen.error && zen.data) zenId = zen.data as string;
        }

        // Load conversation rows visible to user
        const { data: convs } = await supabase
          .from("chat_conversations")
          .select("id,kind,title,domain_id,restricted_roles")
          .eq("domain_id", domainId)
          .order("updated_at", { ascending: false });
        if (cancel) return;
        const list = ((convs ?? []) as any[]).map((c) => c as Conversation);

        // Sort: Allgemein → Zentrale → DMs
        list.sort((a, b) => {
          const rank = (c: Conversation) =>
            c.id === genId ? 0 : c.id === zenId ? 1 : c.kind === "channel" ? 2 : 3;
          return rank(a) - rank(b);
        });
        setConversations(list);

        // Compute unread per conversation
        const partsRes = await supabase
          .from("chat_participants")
          .select("conversation_id,last_read_at")
          .eq("user_id", user.id);
        const partMap: Record<string, string | null> = {};
        (partsRes.data ?? []).forEach((p: any) => { partMap[p.conversation_id] = p.last_read_at; });

        const nextUnread: UnreadMap = {};
        await Promise.all(list.map(async (c) => {
          const since = partMap[c.id];
          const q = supabase
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", c.id)
            .neq("sender_id", user.id)
            .is("deleted_at", null);
          const { count } = since ? await q.gt("created_at", since) : await q;
          if (count && count > 0) nextUnread[c.id] = count;
        }));
        if (!cancel) setUnreadMap(nextUnread);
      } catch (err: any) {
        console.error("[chat] load:", err);
        if (!cancel) setLoadError(err?.message ?? "Chat konnte nicht geladen werden");
      }
    })();
    return () => { cancel = true; };
  }, [user, domainId, chatEnabled, canAccessZentrale]);

  // Global realtime for badge + ping
  useEffect(() => {
    if (!user || !domainId || !chatEnabled) return;
    const ch = supabase
      .channel("chat-global-inbox")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `domain_id=eq.${domainId}` },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id === user.id) return;
          // only notify for conversations we know (participant-accessible)
          if (!conversations.some((c) => c.id === m.conversation_id)) return;
          const isActive = view === "thread" && activeConv?.id === m.conversation_id && open;
          if (isActive) return;
          setUnreadMap((u) => ({ ...u, [m.conversation_id]: (u[m.conversation_id] ?? 0) + 1 }));
          if (!open) {
            playPing();
            if ("Notification" in window && Notification.permission === "granted") {
              const sender = profiles[m.sender_id]?.display_name ?? "Neue Nachricht";
              try { new Notification(sender, { body: m.body ?? "Anhang", silent: true }); } catch {}
            }
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, domainId, chatEnabled, conversations, view, activeConv, open, profiles]);

  useEffect(() => {
    if (open && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [open]);

  async function openConv(c: Conversation) {
    setActiveConv(c);
    setView("thread");
    setUnreadMap((u) => { const n = { ...u }; delete n[c.id]; return n; });
    if (user) {
      await supabase.from("chat_participants").upsert(
        { conversation_id: c.id, user_id: user.id, domain_id: c.domain_id, last_read_at: new Date().toISOString() },
        { onConflict: "conversation_id,user_id" },
      );
    }
  }

  async function startDm(otherUserId: string) {
    const { data, error } = await supabase.rpc("get_or_create_dm", { _other_user: otherUserId });
    if (error || !data) { toast.error(error?.message ?? "DM konnte nicht erstellt werden"); return; }
    const cid = data as string;
    // Ensure the row is in our list
    let conv = conversations.find((c) => c.id === cid);
    if (!conv) {
      const { data: c } = await supabase
        .from("chat_conversations")
        .select("id,kind,title,domain_id,restricted_roles")
        .eq("id", cid).maybeSingle();
      if (c) {
        conv = c as Conversation;
        setConversations((prev) => [...prev, conv!]);
      }
    }
    if (conv) openConv(conv);
  }

  const dmOtherId = (c: Conversation) => {
    // Best-effort: match by title? Title is null for DMs. We'll fetch per-DM other user via participants below.
    return null;
  };

  if (!user || !domainId || !chatEnabled) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat öffnen"
          className="fixed bottom-4 right-4 z-50 size-14 rounded-full grid place-items-center text-primary-foreground shadow-lg hover:scale-105 transition"
          style={{ background: "var(--gradient-primary)" }}
        >
          <MessageCircle className="size-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[26rem] h-[620px] max-h-[calc(100vh-2rem)] rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          <header className="h-12 shrink-0 border-b border-border flex items-center gap-2 px-3 bg-card">
            {view !== "list" && (
              <button onClick={() => { setView("list"); setActiveConv(null); }} className="p-1.5 rounded hover:bg-muted">
                <ArrowLeft className="size-4" />
              </button>
            )}
            {view === "list" && <MessageCircle className="size-4 text-primary" />}
            {view === "thread" && activeConv?.kind === "channel" && (
              activeConv.title === "Zentrale"
                ? <Shield className="size-4 text-primary" />
                : <Hash className="size-4 text-primary" />
            )}
            <div className="font-semibold text-sm truncate flex-1">
              {view === "list" && "Chat"}
              {view === "newdm" && "Neue Direktnachricht"}
              {view === "thread" && activeConv && (
                activeConv.kind === "channel"
                  ? (activeConv.title ?? "Kanal")
                  : <DmTitle conv={activeConv} meId={user.id} profiles={profiles} />
              )}
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-muted">
              <X className="size-4" />
            </button>
          </header>

          {loadError && (
            <div className="flex-1 grid place-items-center text-sm text-destructive p-4 text-center">
              Chat konnte nicht geladen werden:<br />
              <span className="text-xs text-muted-foreground mt-1">{loadError}</span>
            </div>
          )}

          {!loadError && view === "list" && (
            <ConversationList
              conversations={conversations}
              unreadMap={unreadMap}
              meId={user.id}
              profiles={profiles}
              onOpen={openConv}
              onNewDm={() => setView("newdm")}
            />
          )}

          {!loadError && view === "newdm" && (
            <NewDmView
              meId={user.id}
              profiles={profiles}
              search={searchDm}
              setSearch={setSearchDm}
              onPick={startDm}
            />
          )}

          {!loadError && view === "thread" && activeConv && (
            <Thread
              conv={activeConv}
              meId={user.id}
              profiles={profiles}
              onNewLastMsg={() => {}}
            />
          )}
        </div>
      )}
    </>
  );
}

function DmTitle({ conv, meId, profiles }: { conv: Conversation; meId: string; profiles: Record<string, Profile> }) {
  const [otherId, setOtherId] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("chat_participants")
        .select("user_id")
        .eq("conversation_id", conv.id);
      if (cancel) return;
      const other = (data ?? []).map((r: any) => r.user_id).find((id: string) => id !== meId) ?? null;
      setOtherId(other);
    })();
    return () => { cancel = true; };
  }, [conv.id, meId]);
  const name = otherId ? (profiles[otherId]?.display_name ?? "Direktnachricht") : "Direktnachricht";
  return <>{name}</>;
}

function ConversationList({
  conversations, unreadMap, meId, profiles, onOpen, onNewDm,
}: {
  conversations: Conversation[];
  unreadMap: UnreadMap;
  meId: string;
  profiles: Record<string, Profile>;
  onOpen: (c: Conversation) => void;
  onNewDm: () => void;
}) {
  const channels = conversations.filter((c) => c.kind === "channel");
  const dms = conversations.filter((c) => c.kind === "dm");
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-2">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kanäle</div>
        {channels.map((c) => {
          const isZentrale = c.title === "Zentrale";
          const unread = unreadMap[c.id] ?? 0;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted text-left"
            >
              <div className="size-8 rounded-md grid place-items-center bg-primary/10 text-primary shrink-0">
                {isZentrale ? <Shield className="size-4" /> : <Hash className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.title ?? "Kanal"}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {isZentrale ? "Disponenten & Admins" : "Alle in der Domäne"}
                </div>
              </div>
              {unread > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-2 border-t border-border">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Direktnachrichten</div>
          <button onClick={onNewDm} className="p-1 rounded hover:bg-muted text-primary" title="Neue Direktnachricht">
            <Plus className="size-3.5" />
          </button>
        </div>
        {dms.length === 0 && (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            Noch keine privaten Chats.
            <button onClick={onNewDm} className="mt-2 mx-auto flex items-center gap-1 text-primary hover:underline">
              <Plus className="size-3" /> Person auswählen
            </button>
          </div>
        )}
        {dms.map((c) => (
          <DmRow key={c.id} conv={c} meId={meId} profiles={profiles} unread={unreadMap[c.id] ?? 0} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function DmRow({
  conv, meId, profiles, unread, onOpen,
}: {
  conv: Conversation; meId: string; profiles: Record<string, Profile>;
  unread: number; onOpen: (c: Conversation) => void;
}) {
  const [otherId, setOtherId] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("chat_participants")
        .select("user_id")
        .eq("conversation_id", conv.id);
      if (cancel) return;
      const other = (data ?? []).map((r: any) => r.user_id).find((id: string) => id !== meId) ?? null;
      setOtherId(other);
    })();
    return () => { cancel = true; };
  }, [conv.id, meId]);
  const p = otherId ? profiles[otherId] : undefined;
  return (
    <button
      onClick={() => onOpen(conv)}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted text-left"
    >
      <Avatar p={p} size={32} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{p?.display_name ?? "Unbekannt"}</div>
        <div className="text-[10px] text-muted-foreground truncate">Direktnachricht</div>
      </div>
      {unread > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

function NewDmView({
  meId, profiles, search, setSearch, onPick,
}: {
  meId: string;
  profiles: Record<string, Profile>;
  search: string;
  setSearch: (s: string) => void;
  onPick: (userId: string) => void;
}) {
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.values(profiles)
      .filter((p) => p.id !== meId)
      .filter((p) => !q || (p.display_name ?? "").toLowerCase().includes(q))
      .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
  }, [profiles, meId, search]);
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Person suchen…"
            className="w-full pl-8 pr-3 py-2 rounded-md bg-input/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {list.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">Keine Personen gefunden.</div>
        )}
        {list.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted text-left"
          >
            <Avatar p={p} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.display_name ?? "Unbekannt"}</div>
            </div>
            <Users className="size-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Avatar({ p, size = 40 }: { p?: Profile; size?: number }) {
  return (
    <div
      className="rounded-full grid place-items-center bg-muted text-muted-foreground shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {p?.avatar_url ? (
        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs font-semibold">{(p?.display_name ?? "?").slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function Thread({
  conv, meId, profiles, onNewLastMsg,
}: {
  conv: Conversation;
  meId: string;
  profiles: Record<string, Profile>;
  onNewLastMsg: (m: Message) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancel) setMessages((data ?? []) as any);
      // mark read on open
      await supabase.from("chat_participants").upsert(
        { conversation_id: conv.id, user_id: meId, domain_id: conv.domain_id, last_read_at: new Date().toISOString() },
        { onConflict: "conversation_id,user_id" }
      );
    })();
    const ch = supabase
      .channel(`chat-thread-${conv.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const m = payload.new as Message;
            setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
            onNewLastMsg(m);
            supabase.from("chat_participants").upsert(
              { conversation_id: conv.id, user_id: meId, domain_id: conv.domain_id, last_read_at: new Date().toISOString() },
              { onConflict: "conversation_id,user_id" }
            );
          } else if (payload.eventType === "UPDATE") {
            const m = payload.new as Message;
            setMessages((prev) => prev.map((x) => x.id === m.id ? m : x));
          } else if (payload.eventType === "DELETE") {
            const m = payload.old as Message;
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
          }
        })
      .subscribe();
    return () => { cancel = true; supabase.removeChannel(ch); };
  }, [conv.id, meId, conv.domain_id, onNewLastMsg]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: conv.id, domain_id: conv.domain_id, sender_id: meId, body,
    });
    if (error) toast.error(error.message);
  }

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10 MB"); return; }
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${meId}/${conv.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type });
    if (upErr) { toast.error(upErr.message); return; }
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: conv.id, domain_id: conv.domain_id, sender_id: meId,
      attachment_path: path, attachment_name: file.name, attachment_mime: file.type, attachment_size: file.size,
    });
    if (error) toast.error(error.message);
  }

  async function saveEdit(id: string) {
    const body = editText.trim();
    if (!body) return;
    const { error } = await supabase.from("chat_messages")
      .update({ body, edited_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    setEditing(null);
  }

  async function del(id: string) {
    if (!confirm("Nachricht löschen?")) return;
    const { error } = await supabase.from("chat_messages")
      .update({ deleted_at: new Date().toISOString(), body: null, attachment_path: null }).eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">Noch keine Nachrichten.</div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          const sender = profiles[m.sender_id];
          return (
            <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              {!mine && <Avatar p={sender} size={32} />}
              <div className={cn("max-w-[75%] group flex flex-col", mine && "items-end")}>
                {!mine && conv.kind === "channel" && (
                  <div className="text-[10px] text-muted-foreground mb-0.5">{sender?.display_name ?? "Unbekannt"}</div>
                )}
                <div className={cn(
                  "rounded-2xl px-3 py-2 text-sm break-words",
                  mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {m.deleted_at ? (
                    <em className="opacity-60">Nachricht gelöscht</em>
                  ) : editing === m.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(m.id)}
                        className="bg-transparent border-b border-current/40 outline-none text-sm min-w-[120px]"
                      />
                      <button onClick={() => saveEdit(m.id)} className="p-0.5"><Check className="size-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                      {m.attachment_path && (
                        <SignedAttachment
                          path={m.attachment_path}
                          name={m.attachment_name}
                          mime={m.attachment_mime}
                        />
                      )}
                      {m.edited_at && <div className="text-[9px] opacity-60 mt-0.5">bearbeitet</div>}
                    </>
                  )}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 px-1">
                  {new Date(m.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </div>
                {mine && !m.deleted_at && editing !== m.id && (
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 mt-0.5 transition">
                    {m.body && (
                      <button onClick={() => { setEditing(m.id); setEditText(m.body ?? ""); }}
                        className="p-1 rounded hover:bg-muted"><Pencil className="size-3" /></button>
                    )}
                    <button onClick={() => del(m.id)} className="p-1 rounded hover:bg-muted text-destructive">
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border p-2 flex items-end gap-1.5">
        <input
          ref={fileRef} type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
        <button onClick={() => fileRef.current?.click()} className="p-2 rounded hover:bg-muted shrink-0">
          <Paperclip className="size-4" />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Nachricht…"
          className="flex-1 resize-none min-h-9 max-h-24 px-3 py-2 rounded-md bg-input/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="sm" onClick={send} disabled={!text.trim()} className="shrink-0">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}