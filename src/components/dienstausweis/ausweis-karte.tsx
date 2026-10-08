import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { AusweisDesign } from "./designs";

export type AusweisPerson = {
  name: string;
  funktion?: string | null;
  ausweisNr?: string | null;
  gueltigBis?: string | null;
  foto?: string | null;
  pruefToken?: string | null;
};

function useAusweisQr(person: AusweisPerson) {
  const [qr, setQr] = useState("");
  const qrText = person.pruefToken && typeof window !== "undefined"
    ? `${window.location.origin}/ausweis/${person.pruefToken}`
    : `AlarmDesk Dienstausweis\n${person.name}\nNr: ${person.ausweisNr || "-"}\nGültig bis: ${person.gueltigBis || "-"}`;
  useEffect(() => {
    QRCode.toDataURL(qrText, { margin: 0, width: 200, color: { dark: "#000000", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [qrText]);
  return qr;
}

/* Farben kommen bewusst aus dem frei gestaltbaren Design (Inline-Styles). */
export function AusweisKarte({ design, person, scale = 1 }: { design: AusweisDesign; person: AusweisPerson; scale?: number }) {
  const c = design.config;
  const quer = c.format === "quer";
  const w = (quer ? 85.6 : 54) * scale;
  const h = (quer ? 54 : 85.6) * scale;
  const qr = useAusweisQr(person);
  if (c.stil === "schlicht") {
    const mm = (v: number) => `${v * scale}mm`;
    return (
      <div className="ausweis-karte" style={{ width: mm(quer ? 85.6 : 54), height: mm(quer ? 54 : 85.6), background: c.bg, color: c.text, borderRadius: mm(3), boxSizing: "border-box", overflow: "hidden", padding: mm(4), display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontFamily: "Arial, Helvetica, sans-serif", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        <div style={{ height: mm(10), width: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {c.logo ? <img src={c.logo} alt="Firmenlogo" style={{ maxWidth: "85%", maxHeight: "100%", objectFit: "contain" }} /> : <div style={{ fontSize: mm(4.4), fontWeight: 700, overflowWrap: "anywhere" }}>{c.firma}</div>}
        </div>
        <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: mm(2), overflowWrap: "anywhere" }}>
          <div style={{ fontSize: mm(5), fontWeight: 700, lineHeight: 1.1 }}>{c.titel || "Dienstausweis"}</div>
          <div style={{ fontSize: mm(4.2), fontWeight: 700, lineHeight: 1.15 }}>{person.name}</div>
          {person.funktion && <div style={{ fontSize: mm(3.5), fontWeight: 700, lineHeight: 1.15 }}>{person.funktion}</div>}
        </div>
        <div style={{ width: "100%", fontSize: mm(2.5), fontWeight: 600, lineHeight: 1.25, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
          {c.logo && c.firma && <div>{c.firma}</div>}
          {c.vorderKontakt}
        </div>
      </div>
    );
  }

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

export function AusweisRueckseite({ design, person, scale = 1 }: { design: AusweisDesign; person: AusweisPerson; scale?: number }) {
  const c = design.config;
  const quer = c.format === "quer";
  const mm = (v: number) => `${v * scale}mm`;
  const qr = useAusweisQr(person);
  if (c.stil === "schlicht") {
    const f = Math.min(1.4, Math.max(0.7, (c.rueckSchrift ?? 100) / 100));
    const align = c.rueckAusrichtung === "links" ? "left" : c.rueckAusrichtung === "rechts" ? "right" : "center";
    const text = c.rueckText && <div style={{ whiteSpace: "pre-line" }}>{c.rueckText}</div>;
    const kontakt = c.rueckKontakt && <div style={{ whiteSpace: "pre-line" }}>{c.rueckKontakt}</div>;
    return (
      <div className="ausweis-karte" style={{ width: mm(quer ? 85.6 : 54), height: mm(quer ? 54 : 85.6), background: c.bg, color: c.text, borderRadius: mm(3), boxSizing: "border-box", overflow: "hidden", padding: mm(4), display: "flex", flexDirection: "column", fontFamily: "Arial, Helvetica, sans-serif", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        <div style={{ height: mm(10), display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>
          {c.logo ? <img src={c.logo} alt="Firmenlogo" style={{ maxWidth: "65%", maxHeight: "100%", objectFit: "contain" }} /> : <div style={{ fontSize: mm(3.4), fontWeight: 700, overflowWrap: "anywhere" }}>{c.firma}</div>}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: mm(1), fontSize: mm(2.4 * f), lineHeight: 1.25, textAlign: align, overflowWrap: "anywhere" }}>
          {c.logo && c.firma && <div>{c.firma}</div>}
          {c.rueckReihenfolge === "kontakt-zuerst" ? <>{kontakt}{text}</> : <>{text}{kontakt}</>}
          {c.rueckNotruf && <div>Notruf: {c.rueckNotruf}</div>}
          {c.rueckWebseite && <div>{c.rueckWebseite}</div>}
          {c.rueckFeldName && c.rueckFeldWert && <div>{c.rueckFeldName}: {c.rueckFeldWert}</div>}
          {c.rueckZeigeGueltig && <div>Gültig bis: {person.gueltigBis ? new Date(person.gueltigBis).toLocaleDateString("de-DE") : "—"}</div>}
          {c.rueckZeigeUnterschrift && <div style={{ marginTop: mm(2), borderTop: `${mm(0.2)} solid ${c.text}`, fontSize: mm(1.8) }}>Unterschrift Inhaber / Unternehmen</div>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: mm(2), fontSize: mm(2), lineHeight: 1.25 }}>
          <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{c.rueckZeigeNummer !== false && <>Ausweis-Nr.: {person.ausweisNr || "—"}</>}</div>
          {c.rueckStandort && <div style={{ flex: 1, minWidth: 0, textAlign: "right", overflowWrap: "anywhere" }}>{c.rueckStandort}</div>}
          {qr && <img src={qr} alt="QR-Code zur Ausweisprüfung" style={{ width: mm(10), height: mm(10), flexShrink: 0 }} />}
        </div>
      </div>
    );
  }
  const band = c.stil === "verlauf" ? `linear-gradient(90deg, ${c.akzent}, ${c.akzent2})` : c.akzent;
  const f = Math.min(1.4, Math.max(0.7, (c.rueckSchrift ?? 100) / 100));
  const align = c.rueckAusrichtung === "mitte" ? "center" : c.rueckAusrichtung === "rechts" ? "right" : "left";
  const kontaktZuerst = c.rueckReihenfolge === "kontakt-zuerst";
  const text = c.rueckText ? <div style={{ opacity: 0.9 }}>{c.rueckText}</div> : null;
  const kontakt = c.rueckKontakt ? <div style={{ whiteSpace: "pre-line", fontWeight: 600 }}>{c.rueckKontakt}</div> : null;
  const extras: [string, string][] = [];
  if (c.rueckNotruf) extras.push(["Notruf", c.rueckNotruf]);
  if (c.rueckWebseite) extras.push(["Web", c.rueckWebseite]);
  if (c.rueckFeldName && c.rueckFeldWert) extras.push([c.rueckFeldName, c.rueckFeldWert]);
  if (c.rueckZeigeGueltig) extras.push(["Gültig bis", person.gueltigBis ? new Date(person.gueltigBis).toLocaleDateString("de-DE") : "—"]);
  return (
    <div
      className="ausweis-karte"
      style={{
        width: mm(quer ? 85.6 : 54), height: mm(quer ? 54 : 85.6), background: c.bg, borderRadius: mm(3), overflow: "hidden",
        fontFamily: "Arial, Helvetica, sans-serif", boxShadow: "0 1px 4px rgba(0,0,0,.25)", boxSizing: "border-box",
        border: c.stil === "rahmen" ? `${mm(1.2)} solid ${c.akzent}` : "none", display: "flex", flexDirection: "column",
        color: c.text, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
      }}
    >
      <div style={{ height: mm(4), background: band }} />
      <div style={{ flex: 1, padding: mm(3), display: "flex", flexDirection: "column", gap: mm(1.2 * f), fontSize: mm(2.1 * f), lineHeight: 1.35, textAlign: align }}>
        {c.firma && <div style={{ fontWeight: 700, fontSize: mm(2.8 * f), color: c.stil === "rahmen" ? c.akzent : c.text }}>{c.firma}</div>}
        {kontaktZuerst ? <>{kontakt}{text}</> : <>{text}{kontakt}</>}
        {extras.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: mm(0.3) }}>
            {extras.map(([k, v]) => <div key={k}><span style={{ opacity: 0.7 }}>{k}: </span><b>{v}</b></div>)}
          </div>
        )}
        {c.rueckZeigeUnterschrift !== false && (
          <div style={{ marginTop: "auto", display: "flex", gap: mm(4), fontSize: mm(1.9 * f), textAlign: "left" }}>
            <div style={{ flex: 1, borderTop: `${mm(0.3)} solid ${c.text}`, paddingTop: mm(0.6), opacity: 0.8 }}>Unterschrift Inhaber</div>
            <div style={{ flex: 1, borderTop: `${mm(0.3)} solid ${c.text}`, paddingTop: mm(0.6), opacity: 0.8 }}>Unterschrift Unternehmen</div>
          </div>
        )}
        {c.rueckZeigeNummer !== false && <div style={{ fontSize: mm(1.8 * f), opacity: 0.7, marginTop: c.rueckZeigeUnterschrift === false ? "auto" : undefined }}>Ausweis-Nr.: {person.ausweisNr || "—"}</div>}
      </div>
      <div style={{ height: mm(2), background: band }} />
    </div>
  );
}
