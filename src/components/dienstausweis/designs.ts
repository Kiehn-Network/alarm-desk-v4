export type AusweisStil = "streifen" | "band" | "verlauf" | "rahmen" | "diagonal" | "seite" | "schlicht";
export type AusweisDesign = {
  id: string;
  name: string;
  eigen?: boolean;
  config: {
    format: "quer" | "hoch";
    stil: AusweisStil;
    bg: string;
    akzent: string;
    akzent2: string;
    text: string;
    titel: string;
    firma: string;
    logo?: string;
    vorderKontakt?: string;
    rueckStandort?: string;
    fotoRund: boolean;
    rueckText: string;
    rueckKontakt: string;
    rueckAusrichtung?: "links" | "mitte" | "rechts";
    rueckReihenfolge?: "text-zuerst" | "kontakt-zuerst";
    rueckSchrift?: number; // Prozent, 70–140
    rueckNotruf?: string;
    rueckWebseite?: string;
    rueckFeldName?: string;
    rueckFeldWert?: string;
    rueckZeigeGueltig?: boolean;
    rueckZeigeUnterschrift?: boolean;
    rueckZeigeNummer?: boolean;
  };
};

const d = (id: string, name: string, c: Partial<AusweisDesign["config"]>): AusweisDesign => ({
  id, name,
  config: {
    format: "quer", stil: "band", bg: "#ffffff", akzent: "#1e3a8a", akzent2: "#3b82f6",
    text: "#0f172a", titel: "DIENSTAUSWEIS", firma: "", fotoRund: false,
    rueckText: "Der Inhaber dieses Ausweises ist berechtigt, im Auftrag des Unternehmens tätig zu werden. Der Ausweis ist nicht übertragbar und bei Verlust sofort zu melden. Finder werden gebeten, ihn an die unten genannte Adresse zurückzusenden.",
    rueckKontakt: "", rueckAusrichtung: "links", rueckReihenfolge: "text-zuerst", rueckSchrift: 100,
    rueckNotruf: "", rueckWebseite: "", rueckFeldName: "", rueckFeldWert: "",
    rueckZeigeGueltig: false, rueckZeigeUnterschrift: true, rueckZeigeNummer: true, ...c,
  },
});

export const STANDARD_DESIGNS: AusweisDesign[] = [
  d("std-1", "Klassik Blau", { stil: "band" }),
  d("std-2", "Sicherheit Rot", { stil: "streifen", akzent: "#b91c1c", akzent2: "#f87171" }),
  d("std-3", "Nachtwache", { stil: "verlauf", bg: "#0f172a", text: "#f8fafc", akzent: "#1e293b", akzent2: "#38bdf8" }),
  d("std-4", "Signal Gelb", { stil: "diagonal", akzent: "#111827", akzent2: "#facc15" }),
  d("std-5", "Waldgrün", { stil: "seite", akzent: "#14532d", akzent2: "#22c55e" }),
  d("std-6", "Schwarz Gold", { stil: "rahmen", bg: "#111111", text: "#f5f5f4", akzent: "#ca8a04", akzent2: "#fde68a" }),
  d("std-7", "Polizei-Stil", { stil: "streifen", akzent: "#1e40af", akzent2: "#cbd5e1" }),
  d("std-8", "Minimal Grau", { stil: "rahmen", akzent: "#475569", akzent2: "#e2e8f0", fotoRund: true }),
  d("std-9", "Orange Einsatz", { stil: "band", akzent: "#c2410c", akzent2: "#fb923c" }),
  d("std-10", "Hochformat Blau", { format: "hoch", stil: "band" }),
  d("std-11", "Hochformat Rot", { format: "hoch", stil: "verlauf", akzent: "#7f1d1d", akzent2: "#ef4444" }),
  d("std-12", "Hochformat Dunkel", { format: "hoch", stil: "diagonal", bg: "#18181b", text: "#fafafa", akzent: "#27272a", akzent2: "#a3e635", fotoRund: true }),
  d("std-13", "Petrol", { stil: "verlauf", akzent: "#134e4a", akzent2: "#14b8a6" }),
  d("std-14", "Violett Modern", { stil: "seite", akzent: "#4c1d95", akzent2: "#a78bfa", fotoRund: true }),
  d("std-15", "Hochformat Grün", { format: "hoch", stil: "rahmen", akzent: "#166534", akzent2: "#86efac" }),
  d("std-16", "Schlicht · Firmenausweis", {
    stil: "schlicht", titel: "Dienstausweis", bg: "#ffffff", text: "#202522",
    akzent: "#202522", akzent2: "#202522", logo: "", vorderKontakt: "",
    rueckText: "", rueckKontakt: "", rueckStandort: "", rueckAusrichtung: "mitte",
    rueckZeigeUnterschrift: false, rueckZeigeNummer: true,
  }),
];
