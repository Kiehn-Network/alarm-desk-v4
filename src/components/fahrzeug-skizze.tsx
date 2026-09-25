import { useState } from "react";
import { cn } from "@/lib/utils";

export type SkizzenSeite = "front" | "heck" | "links" | "rechts";

export type SkizzenMarker = {
  seite: SkizzenSeite;
  x: number; // 0–100 (%)
  y: number; // 0–100 (%)
};

const SEITEN: { value: SkizzenSeite; label: string }[] = [
  { value: "front", label: "Vorne" },
  { value: "heck", label: "Hinten" },
  { value: "links", label: "Links" },
  { value: "rechts", label: "Rechts" },
];

// Einfache Fahrzeug-Umrisse als SVG-Pfade (viewBox 0 0 200 120)
function FahrzeugUmriss({ seite }: { seite: SkizzenSeite }) {
  const stroke = "currentColor";
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 2.5,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };

  if (seite === "front" || seite === "heck") {
    // Front-/Heckansicht: symmetrische Karosserie
    return (
      <g {...common}>
        {/* Karosserie */}
        <path d="M45 95 L45 60 Q45 45 60 42 L70 28 Q75 20 85 20 L115 20 Q125 20 130 28 L140 42 Q155 45 155 60 L155 95" />
        {/* Unterkante */}
        <line x1="45" y1="95" x2="155" y2="95" />
        {/* Windschutzscheibe / Heckscheibe */}
        <path d="M75 32 Q100 26 125 32 L122 44 Q100 40 78 44 Z" />
        {/* Scheinwerfer / Rückleuchten */}
        <rect x="52" y="62" width="18" height="8" rx="3" />
        <rect x="130" y="62" width="18" height="8" rx="3" />
        {/* Kühlergrill / Kennzeichen */}
        <rect x="85" y="66" width="30" height="12" rx="2" />
        {/* Räder */}
        <rect x="38" y="88" width="14" height="18" rx="4" />
        <rect x="148" y="88" width="14" height="18" rx="4" />
        {/* Spiegel */}
        <rect x="38" y="46" width="8" height="6" rx="2" />
        <rect x="154" y="46" width="8" height="6" rx="2" />
      </g>
    );
  }

  // Seitenansicht (links/rechts gespiegelt)
  const flip = seite === "rechts";
  return (
    <g {...common} transform={flip ? "translate(200 0) scale(-1 1)" : undefined}>
      {/* Karosserie */}
      <path d="M15 85 L18 62 Q20 52 32 50 L55 46 L78 26 Q84 20 95 20 L125 20 Q136 20 142 28 L158 48 Q178 52 182 62 L185 85" />
      {/* Unterkante zwischen den Rädern */}
      <line x1="45" y1="85" x2="80" y2="85" />
      <line x1="120" y1="85" x2="155" y2="85" />
      {/* Fenster */}
      <path d="M82 30 L60 46 L96 46 L96 30 Z" />
      <path d="M102 30 L102 46 L148 46 L134 30 Z" />
      {/* Türen */}
      <line x1="98" y1="48" x2="98" y2="82" />
      {/* Türgriffe */}
      <line x1="86" y1="56" x2="94" y2="56" />
      <line x1="106" y1="56" x2="114" y2="56" />
      {/* Scheinwerfer vorne / Rücklicht hinten */}
      <rect x="170" y="58" width="12" height="7" rx="2" />
      <rect x="18" y="58" width="10" height="7" rx="2" />
      {/* Räder */}
      <circle cx="45" cy="85" r="14" />
      <circle cx="45" cy="85" r="6" />
      <circle cx="155" cy="85" r="14" />
      <circle cx="155" cy="85" r="6" />
    </g>
  );
}

export function FahrzeugSkizze({
  marker,
  onChange,
  readOnly = false,
  className,
}: {
  marker: SkizzenMarker | null;
  onChange?: (m: SkizzenMarker | null) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const [seite, setSeite] = useState<SkizzenSeite>(marker?.seite ?? "links");
  const aktivSeite = readOnly && marker ? marker.seite : seite;

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (readOnly || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    onChange({ seite: aktivSeite, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }

  const zeigeMarker = marker && marker.seite === aktivSeite ? marker : null;

  return (
    <div className={cn("space-y-2", className)}>
      {!readOnly && (
        <div className="flex flex-wrap gap-1">
          {SEITEN.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSeite(s.value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                aktivSeite === s.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="relative rounded-lg border bg-muted/30 p-2">
        <svg
          viewBox="0 0 200 120"
          className={cn("w-full text-foreground/70", !readOnly && "cursor-crosshair")}
          onClick={handleClick}
        >
          <FahrzeugUmriss seite={aktivSeite} />
          {zeigeMarker && (
            <g>
              <circle
                cx={(zeigeMarker.x / 100) * 200}
                cy={(zeigeMarker.y / 100) * 120}
                r="9"
                className="fill-destructive/25 stroke-destructive"
                strokeWidth="2"
              />
              <line
                x1={(zeigeMarker.x / 100) * 200 - 5}
                y1={(zeigeMarker.y / 100) * 120 - 5}
                x2={(zeigeMarker.x / 100) * 200 + 5}
                y2={(zeigeMarker.y / 100) * 120 + 5}
                className="stroke-destructive"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1={(zeigeMarker.x / 100) * 200 + 5}
                y1={(zeigeMarker.y / 100) * 120 - 5}
                x2={(zeigeMarker.x / 100) * 200 - 5}
                y2={(zeigeMarker.y / 100) * 120 + 5}
                className="stroke-destructive"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          )}
        </svg>
        {readOnly && marker && (
          <div className="absolute right-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {SEITEN.find((s) => s.value === marker.seite)?.label}
          </div>
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{marker ? "Position markiert — erneut klicken zum Verschieben" : "Auf die Skizze klicken, um den Schaden zu markieren (optional)"}</span>
          {marker && onChange && (
            <button type="button" className="text-destructive hover:underline" onClick={() => onChange(null)}>
              Markierung entfernen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
