import { MapPin, KeyRound, Phone, AlertTriangle, Radio, Wrench, Clock, DoorOpen, FileText, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DossierRow, KontaktRow } from "@/lib/objektdossier.functions";

const SEKTOEN = [
  { key: "anfahrt", label: "Anfahrt & Zufahrt", icon: MapPin },
  { key: "parken", label: "Parken & Wendemöglichkeiten", icon: Car },
  { key: "schluessel", label: "Schlüssellage & Übergabe", icon: KeyRound },
  { key: "alarm_plan", label: "Alarm- & Aufschaltplan", icon: Radio },
  { key: "gefahren", label: "Gefahren & besondere Hinweise", icon: AlertTriangle, warnung: true },
  { key: "technik", label: "Technik im Objekt", icon: Wrench },
  { key: "oeffnungszeiten", label: "Verfügbarkeit & Öffnungszeiten", icon: Clock },
  { key: "notiz", label: "Weitere Hinweise", icon: FileText },
] as const;

/**
 * Einheitliche, schreibgeschützte Anzeige eines Objektdossiers.
 * Wird vom Detailbereich der Zentrale und vom Fahrer-Dialog genutzt.
 */
export function DossierAnsicht({
  dossier,
  kontakte,
  dicht = false,
}: {
  dossier: DossierRow;
  kontakte: KontaktRow[];
  dicht?: boolean;
}) {
  const meta = [
    dossier.address ? { label: "Adresse", value: dossier.address } : null,
    dossier.key_number ? { label: "Schlüssel-Nr.", value: dossier.key_number } : null,
    dossier.anlagen_nr ? { label: "Anlagen-Nr.", value: dossier.anlagen_nr } : null,
    dossier.teilnehmer_id ? { label: "Teilnehmer-Nr.", value: dossier.teilnehmer_id } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const inhalt = SEKTOEN.map((s) => ({
    ...s,
    text: String((dossier as any)[s.key] ?? "").trim(),
  })).filter((s) => s.text.length > 0);

  const aktiveKontakte = kontakte.filter((k) => k.aktiv);

  return (
    <div className={dicht ? "space-y-3" : "space-y-5"}>
      <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
            <DoorOpen className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold leading-tight">{dossier.kunden_name}</div>
            {meta.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {meta.map((m) => (
                  <span key={m.label}>
                    <span className="uppercase tracking-wider text-[10px]">{m.label}</span>{" "}
                    <b className="text-foreground font-medium">{m.value}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Badge variant={dossier.fahrer_sichtbar ? "secondary" : "outline"} className="shrink-0">
            {dossier.fahrer_sichtbar ? "Für Fahrer freigegeben" : "Nur Zentrale"}
          </Badge>
        </div>
      </div>

      {aktiveKontakte.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Notfallkontakte
          </div>
          <ul className="space-y-2">
            {aktiveKontakte.map((k) => (
              <li key={k.id} className="flex items-center gap-3 flex-wrap">
                <a
                  href={`tel:${k.telefon.replace(/[^+\d]/g, "")}`}
                  className="size-9 rounded-lg bg-emerald-500/15 text-emerald-500 grid place-items-center shrink-0 hover:bg-emerald-500/25 transition-colors"
                  aria-label={`Anrufen: ${k.name}`}
                >
                  <Phone className="size-4" />
                </a>
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">
                    {k.name}
                    {k.rolle ? <span className="text-muted-foreground font-normal"> · {k.rolle}</span> : ""}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{k.telefon}</div>
                  {k.notiz ? <div className="text-[11px] text-muted-foreground">{k.notiz}</div> : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inhalt.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Für dieses Objekt sind noch keine Angaben hinterlegt.
        </div>
      )}

      <div className={dicht ? "space-y-3" : "grid md:grid-cols-2 gap-4"}>
        {inhalt.map((s) => {
          const Icon = s.icon;
          const warnung = "warnung" in s && s.warnung;
          return (
            <div
              key={s.key}
              className={[
                "rounded-xl border bg-card p-4",
                warnung ? "border-amber-500/40 bg-amber-500/5" : "border-border",
              ].join(" ")}
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={["size-4", warnung ? "text-amber-500" : "text-primary"].join(" ")} />
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{s.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
