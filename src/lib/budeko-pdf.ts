import { jsPDF } from "jspdf";

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
  });
}

const WEITERLEITUNG_LABEL: Record<string, string> = {
  mail: "Ja, per Mail",
  mobil: "Ja, per Mobil",
  mail_naechster_tag: "Nein, per Mail am nächsten Werktag",
};

export function buildBudekoPdf(b: any, firmenname: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const line = (text: string, opts: { size?: number; bold?: boolean; color?: number; gap?: number } = {}) => {
    const { size = 10, bold = false, color = 30, gap = 14 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
    const wrapped = doc.splitTextToSize(text, W - margin * 2);
    if (y + wrapped.length * gap > H - margin) { doc.addPage(); y = margin; }
    doc.text(wrapped, margin, y);
    y += wrapped.length * gap;
  };

  const sep = (extra = 6) => {
    y += extra;
    doc.setDrawColor(220);
    doc.line(margin, y, W - margin, y);
    y += 12;
  };

  const kv = (label: string, value?: string | null) => {
    if (!value) return;
    line(`${label}: ${value}`);
  };

  doc.setFillColor(76, 56, 217);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(firmenname || "Budeko", margin, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Bericht #${b.bericht_nr}`, W - margin, 44, { align: "right" });
  y = 90;

  line("Einsatzbericht", { size: 14, bold: true });
  line(`Erstellt am: ${fmt(b.created_at)}`, { color: 100 });
  sep();

  line("Anruf von", { size: 11, bold: true });
  kv("Name", b.anrufer_name);
  kv("Telefon", b.anrufer_telefon);
  kv("Adresse", b.anrufer_adresse);
  kv("Firma", b.anrufer_firma);
  sep();

  line("Objekt / Mieter", { size: 11, bold: true });
  kv("Name", b.mieter_name);
  kv("Telefon", b.mieter_telefon);
  kv("Straße/Hausnummer", b.mieter_strasse);
  kv("Ort", b.mieter_ort);
  sep();

  line("Störungsart", { size: 11, bold: true });
  line(b.stoerungsart || "–");
  sep();

  line("Sofortweiterleitung", { size: 11, bold: true });
  line(b.weiterleitung ? (WEITERLEITUNG_LABEL[b.weiterleitung] ?? b.weiterleitung) : "–");
  sep();

  line("Zeitangaben", { size: 11, bold: true });
  kv("Datum des Kundenanrufes", fmt(b.zeit_kundenanruf));
  kv("Datum der Weitergabe an", fmt(b.zeit_weitergabe));
  kv("Name der Bereitschaft", b.monteur_weitergabe);
  kv("Diensthabender Alarmzentrale", b.diensthabender_alarmzentrale);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Seite ${i} / ${pageCount}`, W - margin, H - 20, { align: "right" });
  }

  return doc;
}