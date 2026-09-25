import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  getPushConfig, setPushPref, savePushSubscription, removePushSubscription, sendTestPush,
} from "@/lib/push.functions";

function urlB64ToUint8(b: string) {
  const pad = "=".repeat((4 - (b.length % 4)) % 4);
  const raw = atob((b + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushSettings() {
  const getCfg = useServerFn(getPushConfig);
  const setPref = useServerFn(setPushPref);
  const saveSub = useServerFn(savePushSubscription);
  const removeSub = useServerFn(removePushSubscription);
  const test = useServerFn(sendTestPush);
  const [supported, setSupported] = useState(true);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [deviceOn, setDeviceOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    getCfg().then((c) => { setPublicKey(c.publicKey); setEnabled(c.enabled); }).catch(() => {});
    if (ok) {
      navigator.serviceWorker.getRegistration("/push-sw.js")
        .then((r) => r?.pushManager.getSubscription())
        .then((s) => setDeviceOn(!!s)).catch(() => {});
    }
  }, []);

  async function activateDevice() {
    if (!publicKey) return toast.error("Push ist serverseitig nicht eingerichtet.");
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error("Benachrichtigungen wurden im Browser nicht erlaubt."); return; }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(publicKey) });
      const j = sub.toJSON() as any;
      await saveSub({ data: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 500) } });
      setDeviceOn(true);
      toast.success("Dieses Gerät erhält jetzt Benachrichtigungen.");
    } catch (e: any) {
      toast.error(e?.message ?? "Aktivierung fehlgeschlagen");
    } finally { setBusy(false); }
  }

  async function deactivateDevice() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removeSub({ data: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      setDeviceOn(false);
      toast.success("Benachrichtigungen auf diesem Gerät ausgeschaltet.");
    } finally { setBusy(false); }
  }

  async function togglePref(v: boolean) {
    setEnabled(v);
    try { await setPref({ data: { enabled: v } }); }
    catch (e: any) { setEnabled(!v); toast.error(e?.message ?? "Speichern fehlgeschlagen"); }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-6 space-y-5">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <Bell className="size-4 text-primary" /> Benachrichtigungen
      </h2>
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          <div className="font-medium">Bei neuen Einsätzen benachrichtigen</div>
          <p className="text-xs text-muted-foreground">Fahrer: zugewiesene Einsätze. Zentrale: alle neuen Einsätze der Domäne.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={togglePref} />
      </div>
      <div className="flex items-center justify-between gap-4 flex-wrap pt-2 border-t border-border">
        <div className="text-sm">
          <div className="font-medium">Dieses Gerät</div>
          <p className="text-xs text-muted-foreground">
            {!supported ? "Dieser Browser unterstützt keine Push-Benachrichtigungen (iPhone: App zum Home-Bildschirm hinzufügen)."
              : deviceOn ? "Aktiv – Mitteilungen kommen auch bei geschlossener App." : "Noch nicht aktiviert."}
          </p>
        </div>
        {supported && (
          <div className="flex gap-2">
            {deviceOn ? (
              <>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => test().then(() => toast.success("Test gesendet"))}>Test senden</Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={deactivateDevice}><BellOff className="size-4" /> Ausschalten</Button>
              </>
            ) : (
              <Button size="sm" disabled={busy} onClick={activateDevice}><Bell className="size-4" /> Aktivieren</Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
