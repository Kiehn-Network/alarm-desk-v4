// Vorgefertigte E-Mail-Themes (Presets) für das Domänen-Branding.
// Wendet Layout + Farbe + Header-Label + Begrüßung + Signatur + Fußtext an.

import type { EmailLayout } from "./email-brand";

export type EmailThemePreset = {
  id: string;
  name: string;
  description: string;
  swatches: string[]; // 2-3 Farben für die Preset-Karte
  values: {
    brand_layout: EmailLayout;
    brand_primary_color: string;
    brand_header_label: string;
    brand_greeting: string;
    brand_signature: string;
    brand_footer_html: string;
  };
};

export const EMAIL_THEMES: EmailThemePreset[] = [
  {
    id: "classic-blue",
    name: "Klassisch Blau (Card)",
    description: "Sachlich, seriös — weiße Karte auf grauem Hintergrund.",
    swatches: ["#2563eb", "#dbeafe", "#0f172a"],
    values: {
      brand_layout: "card",
      brand_primary_color: "#2563eb",
      brand_header_label: "EINSATZVERWALTUNG",
      brand_greeting: "Guten Tag {{kunde}},",
      brand_signature: "Mit freundlichen Grüßen",
      brand_footer_html:
        "Diese E-Mail wurde automatisch versendet. Bitte nicht antworten.",
    },
  },
  {
    id: "midnight",
    name: "Midnight Banner",
    description: "Dunkles Marineblau als großzügiger Header-Banner.",
    swatches: ["#0f172a", "#1e293b", "#94a3b8"],
    values: {
      brand_layout: "banner",
      brand_primary_color: "#0f172a",
      brand_header_label: "SICHERHEITSDIENST",
      brand_greeting: "Sehr geehrte Damen und Herren {{kunde}},",
      brand_signature: "Mit besten Grüßen",
      brand_footer_html:
        "Vertraulich · Diese E-Mail ist ausschließlich für den genannten Empfänger bestimmt.",
    },
  },
  {
    id: "emergency-red",
    name: "Alarm Rot (Banner)",
    description: "Signalfarbe für Notdienst — mit auffälligem Farbbanner.",
    swatches: ["#dc2626", "#fee2e2", "#7f1d1d"],
    values: {
      brand_layout: "banner",
      brand_primary_color: "#dc2626",
      brand_header_label: "NOTDIENST · 24/7",
      brand_greeting: "Guten Tag {{kunde}},",
      brand_signature: "Ihr Notdienst-Team",
      brand_footer_html:
        "Bei akuten Notfällen erreichen Sie uns rund um die Uhr unter Ihrer Notdienst-Nummer.",
    },
  },
  {
    id: "warm-orange",
    name: "Warm Orange (Sidebar)",
    description: "Freundlich, mit farbigem Seitenstreifen als Akzent.",
    swatches: ["#ea580c", "#ffedd5", "#7c2d12"],
    values: {
      brand_layout: "sidebar",
      brand_primary_color: "#ea580c",
      brand_header_label: "IHR SERVICE-TEAM",
      brand_greeting: "Hallo {{kunde}},",
      brand_signature: "Herzliche Grüße",
      brand_footer_html:
        "Fragen zu dieser E-Mail? Antworten Sie einfach — wir sind für Sie da.",
    },
  },
  {
    id: "forest-green",
    name: "Corporate Grün (Sidebar)",
    description: "Ruhig, vertrauenswürdig — mit grünem Seitenakzent.",
    swatches: ["#15803d", "#dcfce7", "#052e16"],
    values: {
      brand_layout: "sidebar",
      brand_primary_color: "#15803d",
      brand_header_label: "SERVICE & QUALITÄT",
      brand_greeting: "Guten Tag {{kunde}},",
      brand_signature: "Mit freundlichen Grüßen",
      brand_footer_html:
        "Diese E-Mail wurde automatisch versendet. Bitte nicht antworten.",
    },
  },
  {
    id: "minimal-graphite",
    name: "Minimal Graphit",
    description: "Reduziert, ohne Rahmen — nur Text, dünner Akzentstrich.",
    swatches: ["#334155", "#e2e8f0", "#0f172a"],
    values: {
      brand_layout: "minimal",
      brand_primary_color: "#334155",
      brand_header_label: "MITTEILUNG",
      brand_greeting: "Guten Tag {{kunde}},",
      brand_signature: "Freundliche Grüße",
      brand_footer_html:
        "Automatisch generierte Nachricht · Antworten werden nicht bearbeitet.",
    },
  },
];