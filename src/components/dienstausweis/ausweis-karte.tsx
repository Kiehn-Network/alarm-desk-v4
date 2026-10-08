import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { AusweisDesign } from "./designs";

export type AusweisPerson = {
  name: string;
  funktion?: string | null;
  ausweisNr?: string | null;
  gueltigBis?: string | null;
  foto?: string | null;
};

/* Farben kommen bewusst aus dem frei gestaltbaren Design (Inline-Styles). */
export function AusweisKarte({ design, person, scale = 1 }: { design: AusweisDesign; person: AusweisPerson; scale?: number }) {
  const c = design.config;
  const quer = c.format === "quer";
  const w = (quer ? 85.6 : 54) * scale;
  const h = (quer ? 54 : 85.6) * scale;
  const [qr, setQr] = useState("");
  const qrText = `AlarmDesk Dienstausweis\n${person.name}\nNr: ${person.ausweisNr || "-"}\nGültig bis: ${person.gueltigBis || "-"}`;
  useEffect(() => {
    QRCode.toDataURL(qrText, { margin: 0, width: 200, color: { dark: "#000000", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [qrText]);

  let deko: React.CSSProperties = {};
  if (c.stil === "verlauf") deko = { background: `linear-gradient(135deg, ${c.akzent}, ${c.akzent2})` };
  else if (c.stil === "diagonal") deko = { background: `linear-gradient(115deg, ${c.akzent} 0 55%, ${c.akzent2} 55% 100%)` };
  else if (c.stil === "streifen") deko = { background: `repeating-linear-gradient(90deg, ${c.akzent} 0 12mm, ${c.akzent2} 12mm 14mm)` };
  else deko = { background: c.akzent };
  const headerText = c.stil === "rahmen" ? c.akzent : "#ffffff";
  const fotoW = (quer ? 22 : 26) * scale;
  const fotoH = (quer ? 28 : 32) * scale;
  const mm = (v: number) => `${v * scale}mm`;

  const foto = (
    <div style={{ width: `${fotoW}mm`, height: `${fotoH}mm`, borderRadius: c.fotoRund ? "50%" : mm(1.5), overflow: "hidden", background: "#e5e7eb", border: `${mm(0.6)} solid ${c.akzent2}`, flexShrink: 0 }}>
      {person.foto ? <img src={person.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
    </div>
  );
  const infos = (
    <div style={{ minWidth: 0, color: c.text, fontSize: mm(2.4), lineHeight: 1.3, textAlign: quer ? "left" : "center" }}>
      <div style={{ fontWeight: 700, fontSize: mm(3.6), lineHeight: 1.1 }}>{person.name}</div>
      {person.funktion && <div style={{ color: c.stil === "rahmen" ? c.akzent : c.akzent2, fontWeight: 600 }}>{person.funktion}</div>}
      <div style={{ marginTop: mm(1.5), opacity: 0.85 }}>Ausweis-Nr.: {person.ausweisNr || "—"}</div>
      <div style={{ opacity: 0.85 }}>Gültig bis: {person.gueltigBis ? new Date(person.gueltigBis).toLocaleDateString("de-DE") : "—"}</div>
    </div>
  );
  const qrEl = qr ? <img src={qr} alt="QR" style={{ width: mm(quer ? 14 : 13), height: mm(quer ? 14 : 13), background: "#fff", padding: mm(0.6), borderRadius: mm(0.8) }} /> : null;

  return (
    <div
      className="ausweis-karte"
      style={{
        width: `${w}mm`, height: `${h}mm`, background: c.bg, borderRadius: mm(3), overflow: "hidden",
        position: "relative", fontFamily: "Arial, Helvetica, sans-serif", boxShadow: "0 1px 4px rgba(0,0,0,.25)",
        border: c.stil === "rahmen" ? `${mm(1.2)} solid ${c.akzent}` : "none", boxSizing: "border-box",
        display: "flex", flexDirection: c.stil === "seite" && quer ? "row" : "column",
        WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
      }}
    >
      <div style={{
        ...(c.stil === "rahmen" ? {} : deko),
        color: headerText,
        ...(c.stil === "seite" && quer
          ? { width: mm(9), writingMode: "vertical-rl", transform: "rotate(180deg)", display: "flex", alignItems: "center", justifyContent: "center" }
          : { padding: `${mm(2)} ${mm(3)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }),
        fontWeight: 800, letterSpacing: mm(0.3), fontSize: mm(2.6),
      }}>
        <span>{c.titel || "DIENSTAUSWEIS"}</span>
        {!(c.stil === "seite" && quer) && c.firma && <span style={{ fontWeight: 600, letterSpacing: 0, fontSize: mm(2.2) }}>{c.firma}</span>}
      </div>
      {quer ? (
        <div style={{ flex: 1, display: "flex", gap: mm(3), padding: mm(3), alignItems: "center", minWidth: 0 }}>
          {foto}
          <div style={{ flex: 1, minWidth: 0 }}>
            {c.stil === "seite" && c.firma && <div style={{ fontSize: mm(2.2), color: c.akzent, fontWeight: 700, marginBottom: mm(1) }}>{c.firma}</div>}
            {infos}
          </div>
          <div style={{ alignSelf: "flex-end" }}>{qrEl}</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: mm(2), padding: mm(3) }}>
          {foto}
          {infos}
          <div style={{ marginTop: "auto" }}>{qrEl}</div>
        </div>
      )}
    </div>
  );
}
