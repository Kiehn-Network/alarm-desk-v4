import { jsPDF } from "jspdf";

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function yn(v?: string | boolean | null) {
  if (v === true || v === "ja") return "Ja";
  if (v === false || v === "nein") return "Nein";
  if (typeof v === "string" && v) return v;
  return "–";
}

export type { PdfZeitenConfig, PdfZeitenSettings } from "@/lib/pdf-zeiten";
import {
  resolvePdfZeiten,
  type PdfZeitenSettings,
} from "@/lib/pdf-zeiten";
export {
  resolvePdfZeiten,
  DEFAULT_PDF_ZEITEN_HAUSNOTRUF,
  DEFAULT_PDF_ZEITEN_AV,
} from "@/lib/pdf-zeiten";


export function buildEinsatzPdf(e: any, fahrerName: string | null, zeiten?: PdfZeitenSettings | null) {
  const cfg = resolvePdfZeiten(zeiten, e?.bericht_typ);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  const line = (text: string, opts: { size?: number; bold?: boolean; color?: number; gap?: number } = {}) => {
    const { size = 10, bold = false, color = 30, gap = 14 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
    const wrapped = doc.splitTextToSize(text, W - margin * 2);
    if (y + wrapped.length * gap > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage(); y = margin;
    }
    doc.text(wrapped, margin, y);
    y += wrapped.length * gap;
  };

  const sep = (extra = 4) => {
    y += extra;
    doc.setDrawColor(220);
    doc.line(margin, y, W - margin, y);
    y += 12;
  };

  doc.setFillColor(20, 30, 50);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Einsatzbericht", margin, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Einsatz-ID: ${String(e.id).slice(0, 8)}`, W - margin, 44, { align: "right" });
  y = 90;

  line(e.einsatzgrund ?? "Einsatz", { size: 14, bold: true });
  sep(2);

  line("Stammdaten", { size: 11, bold: true, gap: 16 });
  if (e.kunden_name) line(`Kunde: ${e.kunden_name}`);
  if (e.address) line(`Adresse: ${e.address}`);
  if (e.key_number) line(`Schlüssel-Nr.: ${e.key_number}`);
  if (e.anlagen_nr) line(`Anlagen-Nr.: ${e.anlagen_nr}`);
  if (e.teilnehmer_id) line(`Teilnehmer-ID: ${e.teilnehmer_id}`);
  // Wenn der Einsatz von einem Sub-Unternehmen gefahren wurde, den Fahrer
  // im offiziellen Bericht bewusst weglassen (weder Fahrername noch Sub-Name).
  if (fahrerName && !e.sub_unternehmen) line(`Fahrer: ${fahrerName}`);
  if (e.beschreibung) line(`Beschreibung: ${e.beschreibung}`);
  sep();

  const istAv = e.bericht_typ === "av_einsatz";
  const zeilen: Array<[boolean, string, any]> = [
    [!!cfg.alarmierung, "Alarmierung", e.assigned_at ?? e.created_at],
    [!!cfg.created, istAv ? "Startzeit (Erstellung)" : "Erstellt", e.created_at],
    [!!cfg.abfahrt_zentrale, "Abfahrt Zentrale", e.abfahrt_zentrale_am],
    [!!cfg.vor_ort, "Vor Ort", e.vor_ort_am],
    [!!cfg.abfahrt_objekt, "Abfahrt Objekt", e.abfahrt_am],
    [!!cfg.einsatz_ende, "Einsatz-Ende", e.einsatz_ende_am],
    [!!cfg.abgeschlossen, "Abgeschlossen", e.abgeschlossen_am],
  ];

  const visible = zeilen.filter(([on]) => on);
  if (visible.length > 0) {
    line("Zeiten", { size: 11, bold: true, gap: 16 });
    for (const [, label, v] of visible) line(`${label}: ${fmt(v)}`);
    sep();
  }


  line("Bericht", { size: 11, bold: true, gap: 16 });
  if (e.bericht_typ === "hausnotruf") {
    line("Typ: Hausnotruf", { bold: true });
    line(`Problem: ${e.hausnotruf_problem ?? "–"}`);
    line(`Problemlösung: ${e.hausnotruf_loesung ?? "–"}`);
  } else if (e.bericht_typ === "av_einsatz") {
    line("Typ: AV-Einsatz", { bold: true });
    const d = e.bericht_data ?? {};
    line(`Alarm auf Linie: ${yn(d.alarm_linie)}`);
    line(`Störung auf Linie: ${yn(d.stoerung_linie)}`);
    if (d.linie_nr) line(`Linien-Nr. / Details: ${d.linie_nr}`);
    line(`Fremdeinwirkung erkennbar: ${yn(d.fremdeinwirkung)}`);
    if (d.fremdeinwirkung === "sonstiges" && d.fremdeinwirkung_text) {
      line(`  Sonstiges: ${d.fremdeinwirkung_text}`);
    }
    line(`Meldung an Zentrale: ${yn(d.meldung_zentrale)}`);
    line(`Innenkontrolle: ${yn(d.innenkontrolle)}`);
    line(`Rückstellung des Alarms: ${yn(d.rueckstellung)}`);
    if (d.weitere_massnahmen) line(`Weitere Maßnahmen: ${d.weitere_massnahmen}`);
    line(`Scharfschaltung durchgeführt: ${yn(d.scharfschaltung)}`);
    if (d.scharfschaltung) line(`  Errichter: ${d.errichter === "mit" ? "Mit Errichter" : d.errichter === "ohne" ? "Ohne Errichter" : "–"}`);
    line(`Außenkontrolle negativ: ${yn(d.aussenkontrolle_negativ)}`);
  } else {
    line("Kein Bericht erfasst.");
  }
  sep();

  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(`Erstellt am ${fmt(new Date().toISOString())}`, margin, doc.internal.pageSize.getHeight() - 24);

  return doc;
}

export function downloadEinsatzPdf(e: any, fahrerName: string | null, zeiten?: PdfZeitenSettings | null) {
  const doc = buildEinsatzPdf(e, fahrerName, zeiten);
  const name = `Einsatzbericht_${String(e.id).slice(0, 8)}.pdf`;
  doc.save(name);
}

export function einsatzPdfBase64(e: any, fahrerName: string | null, zeiten?: PdfZeitenSettings | null) {
  const doc = buildEinsatzPdf(e, fahrerName, zeiten);
  const uri = doc.output("datauristring");
  const base64 = uri.split(",")[1] ?? "";
  return base64;
}