import { useEffect, useState } from "react";
import {
  getQueue,
  subscribeQueue,
  flush,
  installOfflineQueueRunner,
  type QueueEntry,
} from "@/lib/offline-queue";

export function useOfflineQueue() {
  const [entries, setEntries] = useState<QueueEntry[]>(() => getQueue());
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    installOfflineQueueRunner();
    const unsub = subscribeQueue(setEntries);
    const onOn = () => { setOnline(true); void flush(); };
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      unsub();
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  return { entries, count: entries.length, online, flush };
}