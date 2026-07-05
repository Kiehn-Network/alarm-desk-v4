import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

// ---------------------------------------------------------------
// Interaktive „An-die-Hand"-Rundgänge pro Bereich.
// Jeder Rundgang zeigt Popover-Spots auf echten UI-Elementen.
// Elemente werden per data-tour="…" markiert (Sidebar automatisch,
// einzelne Seiten selektiv). Fehlt ein Element, wird der Schritt
// übersprungen, damit fehlende Selektoren den Rundgang nicht abbrechen.
// ---------------------------------------------------------------

type Step = {
  selector: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
};

const WALKTHROUGHS: Record<string, Step[]> = {
  dashboard: [
    {
      selector: '[data-tour="nav-/dashboard"]',
      title: "Dashboard öffnen",
      description: "Hier siehst du alle laufenden Einsätze und Schlüssel-Übersicht auf einen Blick. Klicke, um zum Dashboard zu wechseln.",
      side: "right",
    },
    {
      selector: '[data-tour="nav-/monitor"]',
      title: "Live-Monitor",
      description: "Hier findest du die Live-Karte deiner Fahrer und aller laufenden Einsätze.",
      side: "right",
    },
  ],
  "meine-einsaetze": [
    {
      selector: '[data-tour="nav-/meine-einsaetze"]',
      title: "Meine Einsätze",
      description: "Hier siehst du alle dir zugewiesenen Einsätze. Von hier startest du Abfahrt, meldest 'Vor Ort' und beendest den Einsatz.",
      side: "right",
    },
  ],
  "einsatz-erstellen": [
    {
      selector: '[data-tour="nav-/einsatz-erstellen"]',
      title: "Einsatz erstellen",
      description: "Klicke hier, um einen neuen Einsatz für einen Kunden anzulegen.",
      side: "right",
    },
  ],
  alarmierung: [
    {
      selector: '[data-tour="nav-/alarmierung"]',
      title: "Alarmierung",
      description: "Hier laufen eingehende Alarme ein. Du kannst sie freigeben oder ablehnen.",
      side: "right",
    },
  ],
  kunden: [
    {
      selector: '[data-tour="nav-/kunden"]',
      title: "Kundenstamm",
      description: "Klicke hier, um den Kundenstamm zu öffnen. Du kannst nach Name, Anlagen-Nr. oder Adresse suchen.",
      side: "right",
    },
  ],
  dateien: [
    {
      selector: '[data-tour="nav-/dateien"]',
      title: "Datei-Verwaltung",
      description: "Alle Kundendateien zentral – 10 pro Seite, mit Suche über alle Kunden.",
      side: "right",
    },
  ],
  schluesselbuch: [
    {
      selector: '[data-tour="nav-/schluesselbuch"]',
      title: "Schlüsselbuch öffnen",
      description: "Hier siehst du alle Schlüsselbewegungen. Wir starten mit dem Buch.",
      side: "right",
    },
    {
      selector: '[data-tour="nav-/schluesseluebergabe"]',
      title: "Schlüssel ausgeben",
      description: "Neue Ausgaben dokumentierst du über die Schlüsselübergabe.",
      side: "right",
    },
    {
      selector: '[data-tour="sb-tabs"]',
      title: "Status filtern",
      description: "Über die Reiter siehst du offene, übernommene oder abgeschlossene Vorgänge.",
      side: "bottom",
    },
    {
      selector: '[data-tour="sb-liste"]',
      title: "Bewegungs-Historie",
      description: "Jede Zeile zeigt Träger, Status und Zeitstempel. Bei 'Rückgabe offen' bestätigt die Zentrale rechts.",
      side: "top",
    },
  ],
  notdienst: [
    {
      selector: '[data-tour="nav-/notdienst/rohrservice"]',
      title: "Notdienst öffnen",
      description: "Hier erfasst du eingehende Notrufe – Anrufer, Mieter, Monteur und Diensthabender.",
      side: "right",
    },
  ],
  dienstplaene: [
    {
      selector: '[data-tour="nav-/dienstplaene"]',
      title: "Dienstpläne",
      description: "Plane hier die Notdienst-Schichten deiner Mitarbeiter.",
      side: "right",
    },
  ],
  chat: [
    {
      selector: '[data-tour="nav-/service-center"]',
      title: "Chat & Service-Center",
      description: "Hier findest du den internen Chat mit Kanal und Direktnachrichten.",
      side: "right",
    },
  ],
};

const PENDING_KEY = "lovable_pending_walkthrough";

/** Merkt sich einen Rundgang, der nach der nächsten Navigation gestartet werden soll. */
export function schedulePendingWalkthrough(key: string): boolean {
  if (typeof window === "undefined") return false;
  if (!WALKTHROUGHS[key]) return false;
  sessionStorage.setItem(PENDING_KEY, key);
  return true;
}

export function hasWalkthrough(key: string): boolean {
  return !!WALKTHROUGHS[key];
}

/** Auf der Zielseite: wenn ein Rundgang wartet, starte ihn. */
export function consumePendingWalkthrough() {
  if (typeof window === "undefined") return;
  const key = sessionStorage.getItem(PENDING_KEY);
  if (!key) return;
  sessionStorage.removeItem(PENDING_KEY);
  void startWalkthrough(key);
}

/** Sofort starten – wartet kurz, bis Elemente im DOM sind. */
export async function startWalkthrough(key: string): Promise<void> {
  const raw = WALKTHROUGHS[key];
  if (!raw || raw.length === 0) return;

  // Warte auf das erste Element (max. 2 s).
  const firstEl = await waitFor(raw[0].selector, 2000);
  if (!firstEl) return;

  // Nur Schritte behalten, deren Element aktuell existiert.
  const steps: DriveStep[] = raw
    .filter((s) => !!document.querySelector(s.selector))
    .map((s) => ({
      element: s.selector,
      popover: {
        title: s.title,
        description: s.description,
        side: s.side ?? "bottom",
        align: s.align ?? "start",
      },
    }));

  if (steps.length === 0) return;

  const d = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    smoothScroll: true,
    nextBtnText: "Weiter →",
    prevBtnText: "← Zurück",
    doneBtnText: "Fertig",
    progressText: "{{current}} / {{total}}",
    steps,
  });
  d.drive();
}

function waitFor(selector: string, timeoutMs: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector);
    if (found) return resolve(found);
    const start = Date.now();
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      } else if (Date.now() - start > timeoutMs) {
        obs.disconnect();
        resolve(null);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(document.querySelector(selector)); }, timeoutMs);
  });
}