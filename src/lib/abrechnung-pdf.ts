import { jsPDF } from "jspdf";

function fmt(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
  });
}

function dauerMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / 60000);
}

function dauerLabel(min: number) {
  if (!min) return "–";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")} Std`;
}

export type AbrechnungEinsatz = {
  teilnehmer_id?: string | null;
  kunden_name?: string | null;
  address?: string | null;
  assigned_to?: string | null;
  status?: string | null;
  vor_ort_am?: string | null;
  einsatz_ende_am?: string | null;
  abgeschlossen_am?: string | null;
  created_at?: string | null;
};

export type AbrechnungParams = {
  providerLabel: string;
  monthLabel: string;
  einsaetze: AbrechnungEinsatz[];
  profiles: Record<string, string>;
  firmenname?: string;
  appVersion?: string;
};

export function buildAbrechnungPdf(p: AbrechnungParams) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = margin;

  // Titel
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(`Einsatzübersicht ${p.providerLabel}`, margin, y + 12);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `${p.firmenname ?? "AlarmDesk"} · Monatsbericht „${p.providerLabel}" · ${p.monthLabel}${p.appVersion ? ` · v${p.appVersion}` : ""}`,
    margin, y,
  );
  y += 8;
  doc.setDrawColor(220); doc.line(margin, y, W - margin, y); y += 18;

  // Stats
  const total = p.einsaetze.length;
  const totalMin = p.einsaetze.reduce(
    (s, e) => s + dauerMinutes(e.vor_ort_am ?? e.created_at, e.einsatz_ende_am ?? e.abgeschlossen_am),
    0,
  );
  const stats = [
    { l: "Einsätze", v: String(total) },
    { l: "Gesamtdauer", v: `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")} Std` },
    { l: "Monat", v: p.monthLabel },
  ];
  const cardW = (W - margin * 2 - 16) / 3;
  stats.forEach((s, i) => {
    const x = margin + i * (cardW + 8);
    doc.setDrawColor(225); doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardW, 56, 6, 6, "FD");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(s.l.toUpperCase(), x + 14, y + 18);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20);
    doc.text(s.v, x + 14, y + 42);
  });
  y += 56 + 22;

  // Tabelle
  const headers = ["Teilnehmer-ID", "Startzeit", "Endzeit", "Dauer", "Status", "Name", "Adresse"];
  const widths = [80, 90, 90, 60, 70, 130, 220];
  const rowH = 18;
  const headerH = 22;

  function drawHeader() {
    doc.setFillColor(238, 242, 247);
    doc.rect(margin, y, W - margin * 2, headerH, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(60, 90, 140);
    let x = margin + 8;
    headers.forEach((h, i) => {
      doc.text(h, x, y + 14);
      x += widths[i];
    });
    y += headerH;
  }
  drawHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40);

  p.einsaetze.forEach((e, idx) => {
    if (y + rowH > H - margin - 24) {
      doc.addPage("a4", "landscape");
      y = margin;
      drawHeader();
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
    }
    if (idx % 2 === 1) {
      doc.setFillColor(252, 253, 254);
      doc.rect(margin, y, W - margin * 2, rowH, "F");
    }
    const start = e.vor_ort_am ?? e.created_at ?? null;
    const end = e.einsatz_ende_am ?? e.abgeschlossen_am ?? null;
    const cells = [
      e.teilnehmer_id ?? "–",
      fmt(start),
      fmt(end),
      dauerLabel(dauerMinutes(start, end)),
      e.status === "abgeschlossen" ? "completed" : (e.status ?? "–"),
      e.kunden_name ?? "–",
      e.address ?? "–",
    ];
    let x = margin + 8;
    cells.forEach((c, i) => {
      const txt = String(c);
      const maxW = widths[i] - 10;
      const line = doc.splitTextToSize(txt, maxW)[0] ?? "";
      doc.text(line, x, y + 12);
      x += widths[i];
    });
    doc.setDrawColor(235);
    doc.line(margin, y + rowH, W - margin, y + rowH);
    y += rowH;
  });

  // Footer mit Seitenzahlen
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(140);
    doc.text(`Seite ${i} / ${pageCount}`, W - margin, H - 18, { align: "right" });
    doc.text(`© ${new Date().getFullYear()} · ${p.firmenname ?? "AlarmDesk"}`, margin, H - 18);
  }
  return doc;
}