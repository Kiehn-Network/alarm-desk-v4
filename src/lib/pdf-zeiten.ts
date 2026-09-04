// Konfiguration, welche Zeitangaben im Einsatzbericht (PDF + Klartext-Mail) erscheinen.

export type PdfZeitenConfig = {
  alarmierung?: boolean;
  created?: boolean;
  abfahrt_zentrale?: boolean;
  vor_ort?: boolean;
  abfahrt_objekt?: boolean;
  einsatz_ende?: boolean;
  abgeschlossen?: boolean;
};

export type PdfZeitenSettings = PdfZeitenConfig & {
  hausnotruf?: PdfZeitenConfig;
  av?: PdfZeitenConfig;
};

export const DEFAULT_PDF_ZEITEN_HAUSNOTRUF: Required<PdfZeitenConfig> = {
  alarmierung: false,
  created: true,
  abfahrt_zentrale: false,
  vor_ort: true,
  abfahrt_objekt: true,
  einsatz_ende: true,
  abgeschlossen: true,
};

export const DEFAULT_PDF_ZEITEN_AV: Required<PdfZeitenConfig> = {
  alarmierung: true,
  created: true,
  abfahrt_zentrale: false,
  vor_ort: true,
  abfahrt_objekt: true,
  einsatz_ende: true,
  abgeschlossen: true,
};

/** Ermittelt die Zeit-Konfiguration passend zum Berichtstyp (mit Legacy-Fallback auf die flache Struktur). */
export function resolvePdfZeiten(
  settings: PdfZeitenSettings | null | undefined,
  berichtTyp?: string | null,
): Required<PdfZeitenConfig> {
  const isAv = berichtTyp === "av_einsatz";
  const base = isAv ? DEFAULT_PDF_ZEITEN_AV : DEFAULT_PDF_ZEITEN_HAUSNOTRUF;
  const s = settings ?? {};
  const { hausnotruf, av, ...legacy } = s as any;
  const specific = isAv ? av : hausnotruf;
  if (specific) return { ...base, ...legacy, ...specific };
  return { ...base, ...legacy };
}
