import type { AppRole } from "@/hooks/use-role";
import {
  LayoutDashboard, Bell, Users, FolderOpen, KeyRound, Wrench,
  MessageCircle, Truck, PlusCircle, Monitor, CalendarDays, type LucideIcon,
} from "lucide-react";

export type TourStep = {
  key: string;
  title: string;
  description: string;
  details: string[];
  icon: LucideIcon;
  /** Wenn leer → für alle Rollen sichtbar */
  roles?: AppRole[];
  /** Optionale Route zum „Hinspringen". */
  route?: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    description: "Dein Überblick über laufende Einsätze, Schlüssel und wichtige Hinweise.",
    details: [
      "Zeigt offene und laufende Einsätze in Echtzeit.",
      "Sichtbar: wie viele Schlüssel aktuell ausgegeben wurden (Info-Symbol für Details).",
      "Wartungs- und Status-Hinweise erscheinen oben als Banner.",
    ],
    icon: LayoutDashboard,
    roles: ["admin", "dispatcher"],
    route: "/dashboard",
  },
  {
    key: "meine-einsaetze",
    title: "Meine Einsätze",
    description: "Deine zugewiesenen Einsätze als Fahrer.",
    details: [
      "Übersicht aller dir zugewiesenen Einsätze.",
      "Status setzen: Abfahrt, Vor Ort, Einsatz-Ende.",
      "Bericht direkt nach Einsatz-Ende erstellen.",
    ],
    icon: Truck,
    roles: ["fahrer", "admin"],
    route: "/meine-einsaetze",
  },
  {
    key: "einsatz-erstellen",
    title: "Einsatz erstellen",
    description: "Neuen Einsatz für einen Kunden anlegen.",
    details: [
      "Kunden auswählen oder neu erfassen.",
      "Einsatzgrund, Priorität und Beschreibung setzen.",
      "Optional direkt einem Fahrer zuweisen.",
    ],
    icon: PlusCircle,
    roles: ["admin", "dispatcher"],
    route: "/einsatz-erstellen",
  },
  {
    key: "monitor",
    title: "Monitor",
    description: "Live-Karte mit allen Fahrern und laufenden Einsätzen.",
    details: [
      "Sieh in Echtzeit, wo deine Fahrer sind.",
      "Laufende Einsätze auf der Karte.",
    ],
    icon: Monitor,
    roles: ["admin", "dispatcher"],
    route: "/monitor",
  },
  {
    key: "alarmierung",
    title: "Alarmierung",
    description: "Eingehende Alarme verwalten und Einsätze freigeben.",
    details: [
      "Alarme freigeben oder ablehnen.",
      "Nur Domänen-Admins dürfen Einsätze löschen.",
    ],
    icon: Bell,
    roles: ["admin", "dispatcher"],
    route: "/alarmierung",
  },
  {
    key: "kunden",
    title: "Kunden",
    description: "Kundenstamm verwalten – mit Suche und Bearbeitung.",
    details: [
      "Suche nach Name, Anlagen-Nr., Adresse oder Teilnehmer-ID.",
      "Kunden direkt aus der Liste bearbeiten.",
      "Verknüpfte Dateien und Schlüssel pro Kunde einsehen.",
    ],
    icon: Users,
    roles: ["admin", "dispatcher"],
    route: "/kunden",
  },
  {
    key: "dateien",
    title: "Datei-Verwaltung",
    description: "Alle Kundendateien zentral – mit Paginierung.",
    details: [
      "Liste mit 10 Einträgen pro Seite.",
      "Suche über alle Kunden und Dateien.",
      "Bearbeiten von Stammdaten und Notizen direkt im Dialog.",
    ],
    icon: FolderOpen,
    roles: ["admin", "dispatcher"],
    route: "/dateien",
  },
  {
    key: "schluesselbuch",
    title: "Schlüsselbuch & Übergabe",
    description: "Schlüssel ausgeben, zurückführen und protokollieren.",
    details: [
      "Schlüsselbuch: zeigt den aktuellen Stand aller Schlüssel.",
      "Schlüsselübergabe: Ausgabe an einen Mitarbeiter oder Fahrer dokumentieren.",
      "Ablauf: Ausgabe → Übernahme durch den Träger → Rückgabe an die Zentrale.",
      "Wenn der Träger den Schlüssel zurückgeben möchte, markiert er ihn als 'Rückgabe offen'.",
      "Die Zentrale bestätigt die Rückgabe im Schlüsselbuch – dann ist der Schlüssel wieder 'Zurück'.",
      "Fahrer sehen im Schlüsselbuch nur ihre eigenen ausgegebenen Schlüssel.",
    ],
    icon: KeyRound,
    roles: ["admin", "dispatcher"],
    route: "/schluesselbuch",
  },
  {
    key: "notdienst",
    title: "Notdienste (Rohrservice, Budeko, Lutz)",
    description: "Notdienst-Berichte erfassen und versenden.",
    details: [
      "Anrufer- und Mieter-Daten erfassen.",
      "Monteur und Diensthabender hinterlegen.",
      "Bericht als PDF generieren und versenden.",
    ],
    icon: Wrench,
    route: "/notdienst/rohrservice",
  },
  {
    key: "dienstplaene",
    title: "Dienstpläne",
    description: "Notdienst-Schichten planen.",
    details: [
      "Mitarbeiter pro Zeitraum eintragen.",
      "Wer wann erreichbar ist.",
    ],
    icon: CalendarDays,
  },
  {
    key: "chat",
    title: "Chat",
    description: "Interner Chat – Kanal & direkte Nachrichten.",
    details: [
      "Allgemeiner Kanal für deine Domäne.",
      "Direktnachrichten an einzelne Kollegen.",
      "Dateianhänge möglich.",
    ],
    icon: MessageCircle,
  },
];

export function stepsForRole(role: AppRole | null, enabledKeys: string[] | null): TourStep[] {
  return TOUR_STEPS.filter((s) => {
    if (s.roles && (!role || !s.roles.includes(role))) return false;
    if (enabledKeys && enabledKeys.length > 0 && !enabledKeys.includes(s.key)) return false;
    return true;
  });
}