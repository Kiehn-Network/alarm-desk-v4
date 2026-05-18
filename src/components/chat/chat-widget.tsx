import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, X, Send, Paperclip, ArrowLeft, Hash, User as UserIcon,
  Pencil, Trash2, Check, Download, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  kind: "channel" | "dm";
  title: string | null;
  domain_id: string;
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

export function ChatWidget() {
  const { user } = useAuth();
  const { domainId } = useRole();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "thread" | "newDm">("list");
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [participants, setParticipants] = useState<Record<string, string[]>>({});
  const [lastRead, setLastRead] = useState<Record<string, string>>({});
  const [lastMsg, setLastMsg] = useState<Record<string, Message | null>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user || !domainId) return;
    let cancel = false;
    (async () => {
      await supabase.rpc("get_or_create_domain_channel");
      const { data: cs } = await supabase
        .from("chat_conversations")
        .select("id,kind,title,domain_id")
        .order("updated_at", { ascending: false });
      if (cancel || !cs) return;
      setConvs(cs as any);

      const ids = cs.map((c) => c.id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .eq("domain_id", domainId);
      const pmap: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => { pmap[p.id] = p; });
      setProfiles(pmap);

      if (ids.length) {
        const { data: parts } = await supabase
          .from("chat_participants")
          .select("conversation_id,user_id,last_read_at")
          .in("conversation_id", ids);
        const partsMap: Record<string, string[]> = {};
        const lr: Record<string, string> = {};
        (parts ?? []).forEach((p: any) => {
          (partsMap[p.conversation_id] ||= []).push(p.user_id);
          if (p.user_id === user.id) lr[p.conversation_id] = p.last_read_at;
        });
        setParticipants(partsMap);
        setLastRead(lr);

        await Promise.all(ids.map(async (cid) => {
          const { data: lm } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("conversation_id", cid)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          setLastMsg((m) => ({ ...m, [cid]: (lm as any) ?? null }));
          const since = lr[cid];
          if (since) {
            const { count } = await supabase
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", cid)
              .neq("sender_id", user.id)
              .is("deleted_at", null)
              .gt("created_at", since);
            setUnread((u) => ({ ...u, [cid]: count ?? 0 }));
          }
        }));
      }
    })();
    return () => { cancel = true; };
  }, [user, domainId]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as Message;
        setLastMsg((prev) => ({ ...prev, [m.conversation_id]: m }));
        if (m.sender_id !== user.id) {
          const isOpenThread = open && activeConv?.id === m.conversation_id;
          if (!isOpenThread) {
            setUnread((u) => ({ ...u, [m.conversation_id]: (u[m.conversation_id] ?? 0) + 1 }));
            playPing();
            if ("Notification" in window && Notification.permission === "granted") {
              const sender = profiles[m.sender_id]?.display_name ?? "Neue Nachricht";
              try { new Notification(sender, { body: m.body ?? "Anhang", silent: true }); } catch {}
            }
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, open, activeConv?.id, profiles]);

  useEffect(() => {
    if (open && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [open]);

  const totalUnread = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread]);

  function convTitle(c: Conversation): string {
    if (c.kind === "channel") return c.title ?? "Allgemein";
    const other = (participants[c.id] ?? []).find((u) => u !== user?.id);
    return (other && profiles[other]?.display_name) || "Direktnachricht";
  }

  async function openConversation(c: Conversation) {
    setActiveConv(c);
    setView("thread");
    setUnread((u) => ({ ...u, [c.id]: 0 }));
    const now = new Date().toISOString();
    setLastRead((l) => ({ ...l, [c.id]: now }));
    if (user) {
      await supabase.from("chat_participants").upsert(
        { conversation_id: c.id, user_id: user.id, domain_id: c.domain_id, last_read_at: now },
        { onConflict: "conversation_id,user_id" }
      );
    }
  }

  if (!user || !domainId) return null;

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
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[600px] max-h-[calc(100vh-2rem)] rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          <header className="h-12 shrink-0 border-b border-border flex items-center gap-2 px-3 bg-card">
            {view === "thread" || view === "newDm" ? (
              <button onClick={() => { setView("list"); setActiveConv(null); }} className="p-1.5 rounded hover:bg-muted">
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <MessageCircle className="size-4 text-primary" />
            )}
            <div className="font-semibold text-sm truncate flex-1">
              {view === "thread" && activeConv ? convTitle(activeConv) : view === "newDm" ? "Neue Direktnachricht" : "Chat"}
            </div>
            {view === "list" && (
              <button onClick={() => setView("newDm")} className="p-1.5 rounded hover:bg-muted" title="Neue DM">
                <Plus className="size-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-muted">
              <X className="size-4" />
            </button>
          </header>

          {view === "list" && (
            <ConvList
              convs={convs}
              unread={unread}
              lastMsg={lastMsg}
              titleOf={convTitle}
              onPick={openConversation}
            />
          )}
          {view === "newDm" && (
            <NewDm
              domainId={domainId}
              meId={user.id}
              onCreated={async (convId) => {
                const existing = convs.find((x) => x.id === convId);
                if (existing) { openConversation(existing); return; }
                const { data } = await supabase.from("chat_conversations")
                  .select("id,kind,title,domain_id").eq("id", convId).maybeSingle();
                if (data) {
                  setConvs((prev) => [data as any, ...prev]);
                  // also reload participants
                  const { data: parts } = await supabase.from("chat_participants")
                    .select("conversation_id,user_id").eq("conversation_id", convId);
                  setParticipants((p) => ({ ...p, [convId]: (parts ?? []).map((x: any) => x.user_id) }));
                  openConversation(data as any);
                }
              }}
            />
          )}
          {view === "thread" && activeConv && (
            <Thread
              conv={activeConv}
              meId={user.id}
              profiles={profiles}
              onNewLastMsg={(m) => setLastMsg((prev) => ({ ...prev, [activeConv.id]: m }))}
            />
          )}
        </div>
      )}
    </>
  );
}

function ConvList({
  convs, unread, lastMsg, titleOf, onPick,
}: {
  convs: Conversation[];
  unread: Record<string, number>;
  lastMsg: Record<string, Message | null>;
  titleOf: (c: Conversation) => string;
  onPick: (c: Conversation) => void;
}) {
  const sorted = [...convs].sort((a, b) => {
    const ta = lastMsg[a.id]?.created_at ?? "";
    const tb = lastMsg[b.id]?.created_at ?? "";
    return tb.localeCompare(ta);
  });
  return (
    <div className="flex-1 overflow-y-auto divide-y divide-border">
      {sorted.length === 0 && (
        <div className="p-6 text-sm text-muted-foreground text-center">Keine Konversationen.</div>
      )}
      {sorted.map((c) => {
        const u = unread[c.id] ?? 0;
        const lm = lastMsg[c.id];
        return (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className="w-full px-3 py-3 flex items-center gap-3 hover:bg-muted/50 text-left"
          >
            <div className={cn(
              "size-10 rounded-full grid place-items-center shrink-0",
              c.kind === "channel" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {c.kind === "channel" ? <Hash className="size-5" /> : <UserIcon className="size-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-sm truncate flex-1">{titleOf(c)}</div>
                {lm && (
                  <div className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(lm.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {lm?.deleted_at ? <em>gelöscht</em> : lm?.body || (lm?.attachment_name ? `📎 ${lm.attachment_name}` : "Noch keine Nachrichten")}
              </div>
            </div>
            {u > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
                {u > 99 ? "99+" : u}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NewDm({
  domainId, meId, onCreated,
}: { domainId: string; meId: string; onCreated: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles").select("id,display_name,avatar_url")
        .eq("domain_id", domainId).neq("id", meId).order("display_name");
      setUsers((data ?? []) as any);
    })();
  }, [domainId, meId]);
  const filtered = users.filter((u) => (u.display_name ?? "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-border">
        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Nutzer suchen…"
          className="w-full h-9 px-3 rounded-md bg-input/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Keine Nutzer.</div>}
        {filtered.map((u) => (
          <button
            key={u.id}
            onClick={async () => {
              const { data, error } = await supabase.rpc("get_or_create_dm", { _other_user: u.id });
              if (error) { toast.error(error.message); return; }
              onCreated(data as string);
            }}
            className="w-full px-3 py-3 flex items-center gap-3 hover:bg-muted/50 text-left"
          >
            <Avatar p={u} />
            <div className="text-sm font-medium">{u.display_name ?? "Unbekannt"}</div>
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
          const url = m.attachment_path
            ? supabase.storage.from("chat-attachments").getPublicUrl(m.attachment_path).data.publicUrl
            : null;
          const isImage = m.attachment_mime?.startsWith("image/");
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
                      {url && isImage && (
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={m.attachment_name ?? ""} className="mt-1 rounded-lg max-h-48" />
                        </a>
                      )}
                      {url && !isImage && (
                        <a href={url} target="_blank" rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 text-xs underline opacity-90">
                          <Download className="size-3" /> {m.attachment_name}
                        </a>
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