// Inline-HTML-Rendering für Einsatz-/Rohrservice-/Budeko-Berichte.
// Wird verwendet, wenn der Domänen-Admin den Versandmodus "inline"
// (Klartext direkt in der E-Mail) gewählt hat. Der Inhalt ersetzt den
// PDF-Download-Button im gebrandeten Layout.

function esc(s: any): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(d?: string | null) {
  if (!d) return "–";
  try {
    return new Date(d).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "–"; }
}

function yn(v?: string | boolean | null) {
  if (v === true || v === "ja") return "Ja";
  if (v === false || v === "nein") return "Nein";
  if (typeof v === "string" && v) return v;
  return "–";
}

type Row = [string, string | null | undefined];

function section(title: string, rows: Row[]): string {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (visible.length === 0) return "";
  const body = visible.map(([k, v]) =>
    `<tr>
      <td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;vertical-align:top;white-space:nowrap;">${esc(k)}</td>
      <td style="padding:6px 0;color:#0f172a;font-size:13px;vertical-align:top;">${esc(v)}</td>
    </tr>`,
  ).join("");
  return `
  <div style="margin:0 0 16px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#475569;margin:0 0 6px;">${esc(title)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;">
      ${body}
    </table>
  </div>`;
}

export function renderEinsatzInlineHtml(e: any, fahrerName: string | null): string {
  const stamm: Row[] = [
    ["Einsatzgrund", e.einsatzgrund],
    ["Kunde", e.kunden_name],
    ["Adresse", e.address],
    ["Schlüssel-Nr.", e.key_number],
    ["Anlagen-Nr.", e.anlagen_nr],
    ["Teilnehmer-ID", e.teilnehmer_id],
    ["Fahrer", fahrerName && !e.sub_unternehmen ? fahrerName : null],
    ["Beschreibung", e.beschreibung],
  ];

  const zeiten: Row[] = [
    ["Erstellt", fmt(e.created_at)],
    ["Abfahrt Zentrale", e.abfahrt_zentrale_am ? fmt(e.abfahrt_zentrale_am) : null],
    ["Vor Ort", e.vor_ort_am ? fmt(e.vor_ort_am) : null],
    ["Abfahrt Objekt", e.abfahrt_am ? fmt(e.abfahrt_am) : null],
    ["Einsatz-Ende", e.einsatz_ende_am ? fmt(e.einsatz_ende_am) : null],
    ["Abgeschlossen", e.abgeschlossen_am ? fmt(e.abgeschlossen_am) : null],
  ];

  let bericht: Row[] = [];
  if (e.bericht_typ === "hausnotruf") {
    bericht = [
      ["Typ", "Hausnotruf"],
      ["Problem", e.hausnotruf_problem],
      ["Problemlösung", e.hausnotruf_loesung],
    ];
  } else if (e.bericht_typ === "av_einsatz") {
    const d = e.bericht_data ?? {};
    bericht = [
      ["Typ", "AV-Einsatz"],
      ["Alarm auf Linie", yn(d.alarm_linie)],
      ["Störung auf Linie", yn(d.stoerung_linie)],
      ["Linien-Nr. / Details", d.linie_nr],
      ["Fremdeinwirkung", yn(d.fremdeinwirkung)],
      ["  Sonstiges", d.fremdeinwirkung === "sonstiges" ? d.fremdeinwirkung_text : null],
      ["Meldung an Zentrale", yn(d.meldung_zentrale)],
      ["Innenkontrolle", yn(d.innenkontrolle)],
      ["Rückstellung des Alarms", yn(d.rueckstellung)],
      ["Weitere Maßnahmen", d.weitere_massnahmen],
      ["Scharfschaltung", yn(d.scharfschaltung)],
      ["  Errichter", d.scharfschaltung ? (d.errichter === "mit" ? "Mit Errichter" : d.errichter === "ohne" ? "Ohne Errichter" : null) : null],
      ["Außenkontrolle negativ", yn(d.aussenkontrolle_negativ)],
    ];
  }

  return [
    section("Stammdaten", stamm),
    section("Zeiten", zeiten),
    bericht.length ? section("Bericht", bericht) : "",
  ].join("");
}

const WEITERLEITUNG_LABEL: Record<string, string> = {
  mail: "Ja, per Mail",
  mobil: "Ja, per Mobil",
  mail_naechster_tag: "Nein, per Mail am nächsten Werktag",
};

export function renderRohrserviceInlineHtml(b: any, variante: "standard" | "budeko" = "standard"): string {
  const anruf: Row[] = [
    ["Name", b.anrufer_name],
    ["Telefon", b.anrufer_telefon],
    ["Adresse", b.anrufer_adresse],
    ["Firma", b.anrufer_firma],
  ];
  const rechnung: Row[] = variante === "standard" ? [
    ["Name", b.rechnung_name],
    ["Adresse", b.rechnung_adresse],
    ["Telefon", b.rechnung_telefon],
  ] : [];
  const mieter: Row[] = [
    ["Name", b.mieter_name],
    ["Telefon", b.mieter_telefon],
    ["Straße/Hausnummer", b.mieter_strasse],
    ["Ort", b.mieter_ort],
  ];
  const stoerung: Row[] = [["Störungsart", b.stoerungsart]];
  const weiter: Row[] = [
    ["Sofortweiterleitung", b.weiterleitung ? (WEITERLEITUNG_LABEL[b.weiterleitung] ?? b.weiterleitung) : null],
  ];
  const zeiten: Row[] = [
    ["Kundenanruf", b.zeit_kundenanruf ? fmt(b.zeit_kundenanruf) : null],
    ["Weitergabe an", b.zeit_weitergabe ? fmt(b.zeit_weitergabe) : null],
    [variante === "budeko" ? "Name der Bereitschaft" : "Name des Monteurs (Weitergabe)", b.monteur_weitergabe],
    ...(variante === "standard" ? [
      ["Rückmeldung von", b.zeit_rueckmeldung ? fmt(b.zeit_rueckmeldung) : null] as Row,
      ["Name des Monteurs (Rückmeldung)", b.monteur_rueckmeldung] as Row,
    ] : []),
    ["Diensthabender Alarmzentrale", b.diensthabender_alarmzentrale],
  ];

  return [
    `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#475569;margin:0 0 8px;">Bericht #${esc(b.bericht_nr)}</div>`,
    section("Anruf von", anruf),
    rechnung.length ? section("Rechnungsempfänger", rechnung) : "",
    section(variante === "budeko" ? "Objekt / Mieter" : "Mieter / Standort", mieter),
    section("Störungsart", stoerung),
    section("Sofortweiterleitung", weiter),
    section("Zeitangaben", zeiten),
  ].join("");
}

export function renderBudekoInlineHtml(b: any): string {
  return renderRohrserviceInlineHtml(b, "budeko");
}