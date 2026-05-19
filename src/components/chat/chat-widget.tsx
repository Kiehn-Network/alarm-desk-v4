import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, X, Send, Paperclip, Hash,
  Pencil, Trash2, Check, Download,
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
  const { data: modules } = useDomainModules();
  const chatEnabled = modules?.has("chat") ?? false;
  const [open, setOpen] = useState(false);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user || !domainId || !chatEnabled) return;
    let cancel = false;
    (async () => {
      const { data: cid } = await supabase.rpc("get_or_create_domain_channel");
      if (cancel || !cid) return;
      const { data: c } = await supabase
        .from("chat_conversations")
        .select("id,kind,title,domain_id")
        .eq("id", cid as string)
        .maybeSingle();
      if (cancel || !c) return;
      setConv(c as any);

      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .eq("domain_id", domainId);
      const pmap: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => { pmap[p.id] = p; });
      setProfiles(pmap);

      const { data: part } = await supabase
        .from("chat_participants")
        .select("last_read_at")
        .eq("conversation_id", cid as string)
        .eq("user_id", user.id)
        .maybeSingle();
      const since = (part as any)?.last_read_at ?? null;
      setLastReadAt(since);
      if (since) {
        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", cid as string)
          .neq("sender_id", user.id)
          .is("deleted_at", null)
          .gt("created_at", since);
        setUnread(count ?? 0);
      }
    })();
    return () => { cancel = true; };
  }, [user, domainId, chatEnabled]);

  useEffect(() => {
    if (!user || !conv) return;
    const ch = supabase
      .channel("chat-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conv.id}` }, (payload) => {
        const m = payload.new as Message;
        if (m.sender_id !== user.id) {
          if (!open) {
            setUnread((u) => u + 1);
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
  }, [user, open, conv, profiles]);

  useEffect(() => {
    if (open && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [open]);

  async function openChat() {
    setOpen(true);
    setUnread(0);
    if (user && conv) {
      const now = new Date().toISOString();
      setLastReadAt(now);
      await supabase.from("chat_participants").upsert(
        { conversation_id: conv.id, user_id: user.id, domain_id: conv.domain_id, last_read_at: now },
        { onConflict: "conversation_id,user_id" }
      );
    }
  }

  if (!user || !domainId || !chatEnabled) return null;

  return (
    <>
      {!open && (
        <button
          onClick={openChat}
          aria-label="Chat öffnen"
          className="fixed bottom-4 right-4 z-50 size-14 rounded-full grid place-items-center text-primary-foreground shadow-lg hover:scale-105 transition"
          style={{ background: "var(--gradient-primary)" }}
        >
          <MessageCircle className="size-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[600px] max-h-[calc(100vh-2rem)] rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          <header className="h-12 shrink-0 border-b border-border flex items-center gap-2 px-3 bg-card">
            <Hash className="size-4 text-primary" />
            <div className="font-semibold text-sm truncate flex-1">
              {conv?.title ?? "Allgemein"}
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-muted">
              <X className="size-4" />
            </button>
          </header>

          {conv ? (
            <Thread
              conv={conv}
              meId={user.id}
              profiles={profiles}
              onNewLastMsg={() => {}}
            />
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Lade Chat…</div>
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