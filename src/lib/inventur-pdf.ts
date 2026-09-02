import { jsPDF } from "jspdf";

export type InventurPosition = {
  key_number?: string | null;
  kategorie?: string | null;
  kunden_name?: string | null;
  anzahl_soll?: number | null;
  anzahl_ist?: number | null;
  ergebnis?: string | null;
};

export type InventurPdfParams = {
  titel: string;
  gestartet_at?: string | null;
  abgeschlossen_at?: string | null;
  status?: string | null;
  positionen: InventurPosition[];
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function buildInventurPdf(p: InventurPdfParams) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 36;

  const cols = [
    { key: "nr", label: "Nummer", x: margin, w: 70 },
    { key: "kat", label: "Kategorie", x: margin + 70, w: 80 },
    { key: "kunde", label: "Kunde", x: margin + 150, w: 190 },
    { key: "soll", label: "Soll", x: margin + 340, w: 45 },
    { key: "ist", label: "Gezählt", x: margin + 385, w: 60 },
    { key: "erg", label: "Ergebnis", x: margin + 445, w: 78 },
  ];

  let y = margin;

  function header() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(20);
    doc.text("Schlüssel-Inventur", margin, y + 12);
    y += 26;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(p.titel, margin, y);
    y += 13;
    doc.text(
      `Gestartet: ${fmtDate(p.gestartet_at)}   ·   Abgeschlossen: ${fmtDate(p.abgeschlossen_at)}   ·   Status: ${p.status ?? "—"}`,
      margin, y,
    );
    y += 18;
    tableHead();
  }

  function tableHead() {
    doc.setFillColor(240, 242, 245);
    doc.rect(margin, y, W - margin * 2, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40);
    for (const c of cols) doc.text(c.label, c.x + 4, y + 12);
    y += 18;
  }

  header();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const rows = p.positionen ?? [];
  let okCount = 0, diffCount = 0, offenCount = 0;

  for (const r of rows) {
    if (y > H - margin - 60) {
      doc.addPage();
      y = margin;
      tableHead();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }
    const erg = (r.ergebnis ?? "offen").toString();
    if (erg === "ok") okCount++;
    else if (erg === "offen") offenCount++;
    else diffCount++;

    doc.setTextColor(30);
    const kunde = (r.kunden_name ?? "—").toString();
    const kundeLines = doc.splitTextToSize(kunde, cols[2].w - 8);
    const rowH = Math.max(16, kundeLines.length * 11 + 5);

    doc.text(String(r.key_number ?? "—"), cols[0].x + 4, y + 11);
    doc.text(String(r.kategorie ?? "—"), cols[1].x + 4, y + 11);
    doc.text(kundeLines, cols[2].x + 4, y + 11);
    doc.text(String(r.anzahl_soll ?? 0), cols[3].x + 4, y + 11);
    doc.text(r.anzahl_ist === null || r.anzahl_ist === undefined ? "____" : String(r.anzahl_ist), cols[4].x + 4, y + 11);
    doc.text(erg, cols[5].x + 4, y + 11);

    y += rowH;
    doc.setDrawColor(225);
    doc.line(margin, y, W - margin, y);
  }

  if (rows.length === 0) {
    doc.setTextColor(120);
    doc.text("Keine Positionen vorhanden.", margin + 4, y + 12);
    y += 20;
  }

  y += 16;
  if (y > H - margin - 60) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(
    `Positionen gesamt: ${rows.length}   ·   OK: ${okCount}   ·   Abweichung: ${diffCount}   ·   Offen: ${offenCount}`,
    margin, y,
  );

  y += 40;
  if (y > H - margin - 40) { doc.addPage(); y = margin + 40; }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.line(margin, y, margin + 180, y);
  doc.line(W - margin - 180, y, W - margin, y);
  doc.text("Datum, Unterschrift Zähler", margin, y + 12);
  doc.text("Datum, Unterschrift Prüfer", W - margin - 180, y + 12);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Seite ${i} / ${pages}`, W - margin, H - 18, { align: "right" });
  }

  return doc;
}

export function downloadInventurPdf(p: InventurPdfParams) {
  const doc = buildInventurPdf(p);
  const safe = (p.titel || "Inventur").replace(/[^\w\-]+/g, "_");
  doc.save(`${safe}.pdf`);
}
