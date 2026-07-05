import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyTourSettings } from "@/lib/tour.functions";
import { startOnboardingDemo } from "@/lib/onboarding.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useOnboardingStatus } from "@/hooks/use-onboarding";
import { TourDialog } from "./tour-dialog";
import { OnboardingSplash } from "@/components/onboarding/onboarding-splash";
import { useQueryClient } from "@tanstack/react-query";

/** Mountet sich global; öffnet die Tour automatisch beim ersten Login,
 *  wenn `tour_enabled` true ist und `completed_at` noch nicht gesetzt wurde. */
export function TourLauncher() {
  const { session } = useAuth();
  const { isSuperAdmin, isImpersonating } = useRole();
  const fn = useServerFn(getMyTourSettings);
  const startDemoFn = useServerFn(startOnboardingDemo);
  const qc = useQueryClient();
  const { data: onb } = useOnboardingStatus();
  const mandatory = !!onb && !onb.completedAt && !(isSuperAdmin && !isImpersonating);
  const { data, isFetched } = useQuery({
    queryKey: ["my-tour"],
    queryFn: () => fn(),
    enabled: !!session && !(isSuperAdmin && !isImpersonating),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [splashOpen, setSplashOpen] = useState(false);
  const [demoStarted, setDemoStarted] = useState(false);

  // ---- Persistenter Einführungs-Fortschritt (überlebt Remount/Reload) ----
  const storageKey = useMemo(
    () => (session?.user?.id ? `onboarding-progress:${session.user.id}` : null),
    [session?.user?.id],
  );
  const [idx, setIdx] = useState(0);
  const [checked, setChecked] = useState<Record<string, number[]>>({});
  const [walkthroughsDone, setWalkthroughsDone] = useState<string[]>([]);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);

  // Beim Mount aus localStorage laden
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.idx === "number") setIdx(p.idx);
        if (p.checked && typeof p.checked === "object") setChecked(p.checked);
        if (Array.isArray(p.walkthroughsDone)) setWalkthroughsDone(p.walkthroughsDone);
      }
    } catch { /* ignore */ }
    setLoadedFromStorage(true);
  }, [storageKey]);

  // Jede Änderung persistieren
  useEffect(() => {
    if (!storageKey || !loadedFromStorage) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ idx, checked, walkthroughsDone }));
    } catch { /* ignore */ }
  }, [storageKey, loadedFromStorage, idx, checked, walkthroughsDone]);

  // Globaler Listener: Walkthrough abgeschlossen (auch wenn Dialog geschlossen ist)
  useEffect(() => {
    const onFinished = (e: Event) => {
      const key = (e as CustomEvent).detail?.key as string | undefined;
      if (!key) return;
      // Alias: der geführte Schlüsselbuch-Testlauf zählt auch für den Schritt "schluesselbuch".
      const keys = key === "schluesselbuch-demo" ? [key, "schluesselbuch"] : [key];
      setWalkthroughsDone((prev) => {
        const next = [...prev];
        for (const k of keys) if (!next.includes(k)) next.push(k);
        return next;
      });
      // Dialog danach wieder öffnen, damit der Nutzer den Fortschritt sieht
      setOpen(true);
    };
    window.addEventListener("walkthrough-finished", onFinished as EventListener);
    return () => window.removeEventListener("walkthrough-finished", onFinished as EventListener);
  }, []);

  useEffect(() => {
    if (isSuperAdmin && !isImpersonating) return;
    // Pflicht-Ablauf: Onboarding noch nicht abgeschlossen → sofort öffnen
    if (mandatory) { setOpen(true); return; }
    if (!isFetched) return;
    // null → noch nie gesehen → zeigen
    if (data == null) { setOpen(true); return; }
    if (data.tour_enabled && !data.completed_at) setOpen(true);
  }, [data, isFetched, isSuperAdmin, isImpersonating, mandatory]);

  // Beim Pflicht-Ablauf einmalig Demo-Modus aktivieren
  useEffect(() => {
    if (!mandatory || demoStarted) return;
    if (onb?.demoMode) { setDemoStarted(true); return; }
    setDemoStarted(true);
    startDemoFn()
      .then(() => qc.invalidateQueries({ queryKey: ["onboarding-status"] }))
      .catch(() => { /* nicht kritisch */ });
  }, [mandatory, onb?.demoMode, demoStarted, startDemoFn, qc]);

  // global Listener: erlaubt anderen Komponenten, die Tour zu öffnen
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-tour", onOpen);
    return () => window.removeEventListener("open-tour", onOpen);
  }, []);

  if (!session) return null;
  if (isSuperAdmin && !isImpersonating) return null;
  return (
    <>
      <TourDialog
        open={open}
        onOpenChange={setOpen}
        enabledKeys={data?.enabled_steps && data.enabled_steps.length > 0 ? data.enabled_steps : null}
        mandatory={mandatory}
        idx={idx}
        onIdxChange={setIdx}
        checked={checked}
        onCheckedChange={setChecked}
        walkthroughsDone={walkthroughsDone}
        onCompleted={() => {
          // Zuerst den Einführungs-Dialog sicher schließen, damit er beim Splash weg ist
          setOpen(false);
          // Fortschritt aufräumen
          if (storageKey) { try { localStorage.removeItem(storageKey); } catch { /* ignore */ } }
          if (mandatory) {
            // Kurze Verzögerung, damit der Dialog wirklich unmounted ist, bevor der Splash erscheint
            setTimeout(() => setSplashOpen(true), 250);
          }
        }}
      />
      {splashOpen && (
        <OnboardingSplash
          onDone={() => {
            setSplashOpen(false);
            qc.invalidateQueries({ queryKey: ["onboarding-status"] });
            qc.invalidateQueries();
          }}
        />
      )}
    </>
  );
}