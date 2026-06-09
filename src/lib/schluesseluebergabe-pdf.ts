import { jsPDF } from "jspdf";

export type SchluesselProtokoll = {
  protokoll_nr: number;
  richtung: "ausgang" | "eingang";
  kunden_name?: string | null;
  strasse?: string | null;
  ort?: string | null;
  uebergeben_von_name?: string | null;
  uebergeben_an_name?: string | null;
  items: Array<{ anzahl?: string; art?: string; beschreibung?: string }>;
  notiz?: string | null;
  created_at: string;
};

export type SchluesselFooter = {
  firmenname?: string | null;
  footer_adresse?: string | null;
  footer_kontakt?: string | null;
};

function fmtDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function buildSchluesselPdf(p: SchluesselProtokoll, footer: SchluesselFooter) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 56;
  const firma = footer.firmenname || "Firma";
  let y = margin;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20);
  doc.text("Schlüsselprotokoll", margin, y);
  y += 28;

  // ID / Kunde / Straße / Ort
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40);
  const labelW = 70;
  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "", margin + labelW, y);
    y += 16;
  };
  row("ID:", String(p.protokoll_nr));
  row("Kunde:", p.kunden_name ?? "");
  row("Straße:", p.strasse ?? "");
  row("Ort:", p.ort ?? "");

  // Right-aligned date line under header
  y += 6;
  const ortLine = (footer.footer_adresse?.split(",")[1]?.trim().split(" ").slice(1).join(" ") || "");
  const dateLine = `${ortLine ? ortLine + ", den " : "Datum: "}${fmtDate(p.created_at)}`;
  doc.setFont("helvetica", "normal");
  doc.text(dateLine, W - margin, y, { align: "right" });
  y += 24;

  // Section heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Schlüsselübergabe", margin, y);
  y += 20;

  // Intro sentence
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const intro =
    p.richtung === "ausgang"
      ? `Folgende Schlüssel wurden durch die Firma ${firma} ausgehändigt:`
      : `Folgende Schlüssel wurden an die Firma ${firma} ausgehändigt:`;
  const wrapped = doc.splitTextToSize(intro, W - margin * 2);
  doc.text(wrapped, margin, y);
  y += wrapped.length * 14 + 8;

  // Table
  const colX = [margin, margin + 70, margin + 200];
  const colW = [70, 130, W - margin - (margin + 200)];
  const rowH = 24;
  // header
  doc.setFillColor(235, 235, 240);
  doc.rect(margin, y, W - margin * 2, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Anzahl", colX[0] + 6, y + 16);
  doc.text("Art", colX[1] + 6, y + 16);
  doc.text("Beschreibung/Hersteller", colX[2] + 6, y + 16);
  doc.setDrawColor(200);
  doc.rect(margin, y, W - margin * 2, rowH);
  y += rowH;

  doc.setFont("helvetica", "normal");
  const items = p.items && p.items.length > 0 ? p.items : Array.from({ length: 4 }, () => ({}));
  for (const it of items) {
    if (y + rowH > H - 140) {
      doc.addPage();
      y = margin;
    }
    doc.rect(margin, y, W - margin * 2, rowH);
    doc.line(colX[1], y, colX[1], y + rowH);
    doc.line(colX[2], y, colX[2], y + rowH);
    doc.text(String((it as any).anzahl ?? ""), colX[0] + 6, y + 16);
    doc.text(String((it as any).art ?? ""), colX[1] + 6, y + 16);
    doc.text(String((it as any).beschreibung ?? ""), colX[2] + 6, y + 16);
    y += rowH;
  }

  y += 30;

  // Übergabe section
  if (y > H - 200) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Übergabe", margin, y);
  y += 22;

  const halfW = (W - margin * 2 - 30) / 2;
  const leftX = margin;
  const rightX = margin + halfW + 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("wurden ausgehändigt von", leftX, y);
  doc.text("übergeben an", rightX, y);
  y += 22;

  // Name
  doc.setFont("helvetica", "bold");
  doc.text("Name:", leftX, y);
  doc.text("Name:", rightX, y);
  doc.setFont("helvetica", "normal");
  if (p.uebergeben_von_name) doc.text(p.uebergeben_von_name, leftX + 46, y);
  if (p.uebergeben_an_name) doc.text(p.uebergeben_an_name, rightX + 46, y);
  // underline
  doc.setDrawColor(160);
  doc.line(leftX + 40, y + 4, leftX + halfW, y + 4);
  doc.line(rightX + 40, y + 4, rightX + halfW, y + 4);
  y += 36;

  doc.setFont("helvetica", "bold");
  doc.text("Unterschrift:", leftX, y);
  doc.text("Unterschrift:", rightX, y);
  doc.line(leftX + 70, y + 4, leftX + halfW, y + 4);
  doc.line(rightX + 70, y + 4, rightX + halfW, y + 4);
  y += 24;

  // Footer
  const footerY = H - 70;
  doc.setDrawColor(210);
  doc.line(margin, footerY - 10, W - margin, footerY - 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(firma, W / 2, footerY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  if (footer.footer_adresse) doc.text(footer.footer_adresse, W / 2, footerY + 14, { align: "center" });
  if (footer.footer_kontakt) doc.text(footer.footer_kontakt, W / 2, footerY + 28, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    `Schlüsselprotokoll erstellt am ${new Date(p.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    W / 2,
    H - 24,
    { align: "center" },
  );

  return doc;
}

export function downloadSchluesselPdf(p: SchluesselProtokoll, footer: SchluesselFooter) {
  const doc = buildSchluesselPdf(p, footer);
  const suffix = p.richtung === "ausgang" ? "Ausgang" : "Eingang";
  doc.save(`Schluesselprotokoll_${suffix}_${p.protokoll_nr}.pdf`);
}