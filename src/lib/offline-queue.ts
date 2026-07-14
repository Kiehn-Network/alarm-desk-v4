// Offline-Queue für Fahrer-Aktionen.
// Speichert Aktionen in localStorage und sendet sie ab, sobald wieder online.

import {
  setEinsatzZeit,
  abschliessenEinsatz,
  updateEinsatzBericht,
} from "@/lib/einsaetze.functions";

export type QueuedAction =
  | { kind: "setEinsatzZeit"; data: { id: string; feld: "abfahrt_zentrale" | "vor_ort" | "abfahrt" | "ende" } }
  | { kind: "abschliessenEinsatz"; data: { id: string } }
  | {
      kind: "updateEinsatzBericht";
      data: {
        id: string;
        bericht_typ: "hausnotruf" | "av_einsatz";
        bericht_data?: Record<string, unknown> | null;
        hausnotruf_problem?: string | null;
        hausnotruf_loesung?: string | null;
      };
    };

export type QueueEntry = {
  id: string;
  ts: number;
  tries: number;
  lastError?: string;
  action: QueuedAction;
};

const STORAGE_KEY = "alarmdesk.offline-queue.v1";

type Listener = (entries: QueueEntry[]) => void;
const listeners = new Set<Listener>();

function read(): QueueEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueueEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: QueueEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
  for (const l of listeners) l(entries);
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try { return crypto.randomUUID(); } catch {}
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getQueue(): QueueEntry[] {
  return read();
}

export function subscribeQueue(l: Listener): () => void {
  listeners.add(l);
  l(read());
  return () => { listeners.delete(l); };
}

export function enqueue(action: QueuedAction): QueueEntry {
  const entries = read();
  // Bei Zeit-Aktionen: gleiches (id, feld) zusammenführen → letzter gewinnt
  if (action.kind === "setEinsatzZeit") {
    const filtered = entries.filter(
      (e) =>
        !(e.action.kind === "setEinsatzZeit"
          && e.action.data.id === action.data.id
          && e.action.data.feld === action.data.feld),
    );
    const entry: QueueEntry = { id: newId(), ts: Date.now(), tries: 0, action };
    write([...filtered, entry]);
    void flush();
    return entry;
  }
  // Bei Bericht: pro Einsatz nur letzten Stand behalten
  if (action.kind === "updateEinsatzBericht") {
    const filtered = entries.filter(
      (e) =>
        !(e.action.kind === "updateEinsatzBericht" && e.action.data.id === action.data.id),
    );
    const entry: QueueEntry = { id: newId(), ts: Date.now(), tries: 0, action };
    write([...filtered, entry]);
    void flush();
    return entry;
  }
  const entry: QueueEntry = { id: newId(), ts: Date.now(), tries: 0, action };
  write([...entries, entry]);
  void flush();
  return entry;
}

function remove(id: string) {
  write(read().filter((e) => e.id !== id));
}

function updateEntry(id: string, patch: Partial<QueueEntry>) {
  write(read().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

async function execute(action: QueuedAction): Promise<void> {
  if (action.kind === "setEinsatzZeit") {
    await setEinsatzZeit({ data: action.data });
    return;
  }
  if (action.kind === "abschliessenEinsatz") {
    await abschliessenEinsatz({ data: action.data });
    return;
  }
  if (action.kind === "updateEinsatzBericht") {
    await updateEinsatzBericht({ data: action.data });
    return;
  }
}

let flushing = false;
let pendingFlush = false;

export async function flush(): Promise<{ sent: number; failed: number }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sent: 0, failed: 0 };
  }
  if (flushing) {
    pendingFlush = true;
    return { sent: 0, failed: 0 };
  }
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    // Snapshot der Reihenfolge nach ts
    const ordered = [...read()].sort((a, b) => a.ts - b.ts);
    for (const entry of ordered) {
      // Re-check ob Eintrag noch da ist (kann durch Merge entfernt worden sein)
      if (!read().some((x) => x.id === entry.id)) continue;
      try {
        await execute(entry.action);
        remove(entry.id);
        sent++;
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        // Netzwerkfehler → später erneut versuchen, Eintrag behalten
        const isNetwork = /network|fetch|failed to fetch|load failed|offline/i.test(msg);
        updateEntry(entry.id, {
          tries: entry.tries + 1,
          lastError: msg.slice(0, 200),
        });
        failed++;
        if (isNetwork) {
          // Abbruch des Durchlaufs – wenn keine Verbindung, andere werden auch scheitern
          break;
        }
        // Persistente Fehler nach 5 Versuchen aufgeben
        if (entry.tries + 1 >= 5) {
          remove(entry.id);
        }
      }
    }
  } finally {
    flushing = false;
  }
  if (pendingFlush) {
    pendingFlush = false;
    void flush();
  }
  return { sent, failed };
}

let installed = false;
export function installOfflineQueueRunner() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("online", () => { void flush(); });
  // Periodischer Retry alle 30 s
  setInterval(() => { void flush(); }, 30_000);
  // Initialer Versuch beim Start
  void flush();
}