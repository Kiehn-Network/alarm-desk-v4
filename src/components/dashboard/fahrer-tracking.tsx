import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Car, Phone, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { getEinsatzTracking, type EinsatzTracking } from "@/lib/driver-locations.functions";

const PHASE: Record<EinsatzTracking["phase"], { label: string; cls: string }> = {
  zugewiesen: { label: "Zugewiesen", cls: "bg-warning/20 text-warning" },
  anfahrt: { label: "Anfahrt", cls: "bg-primary/20 text-primary" },
  vor_ort: { label: "Vor Ort", cls: "bg-success/20 text-success" },
  ende: { label: "Einsatzende", cls: "bg-muted text-muted-foreground" },
};

export function FahrerTrackingSection() {
  const fn = useServerFn(getEinsatzTracking);
  const { data = [] } = useQuery({ queryKey: ["einsatz-tracking"], queryFn: () => fn(), refetchInterval: 20_000 });
  if (data.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Fahrer unterwegs</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((t) => <TrackingCard key={t.einsatz_id} t={t} />)}
      </div>
    </section>
  );
}

function TrackingCard({ t }: { t: EinsatzTracking }) {
  const ph = PHASE[t.phase];
  const initials = (t.fahrer_name ?? "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="rounded-3xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="size-12 rounded-2xl border border-border grid place-items-center shrink-0"><Car className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{t.einsatzgrund}</div>
          <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${ph.cls}`}>{ph.label}</span>
        </div>
        <Link to="/alarmierung" className="size-10 rounded-full bg-muted grid place-items-center hover:bg-accent" aria-label="Zur Alarmierung">
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-6 items-center">
        <div>
          <div className="text-xs text-muted-foreground">Ankunft in</div>
          <div className="text-3xl font-bold leading-tight">
            {t.eta_min == null ? "–" : t.eta_min === 0 ? "da" : `${t.eta_min} min`}
          </div>
          <div className="text-sm text-muted-foreground">{t.distance_km == null ? "keine Position" : `${t.distance_km} km`}</div>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="size-3 rounded-full bg-primary" />
            <span className="w-px flex-1 bg-primary/60 my-1 min-h-6" />
            <span className="size-3 rounded-full border-2 border-foreground" />
          </div>
          <div className="min-w-0 space-y-3 text-sm">
            <div>
              <div className="font-medium">Fahrer-Position</div>
              <div className="text-xs text-muted-foreground">
                {t.position_at ? formatDistanceToNow(new Date(t.position_at), { addSuffix: true, locale: de }) : "nicht verfügbar"}
              </div>
            </div>
            <div>
              <div className="font-medium truncate">{t.kunden_name ?? "Kunde"}</div>
              <div className="text-xs text-muted-foreground truncate">{t.address ?? "–"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
        {t.fahrer_avatar ? (
          <img src={t.fahrer_avatar} alt="" className="size-11 rounded-full object-cover" />
        ) : (
          <div className="size-11 rounded-full bg-primary/20 text-primary grid place-items-center font-semibold">{initials}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{t.fahrer_name ?? "Unbekannt"}</div>
          <div className="text-xs text-muted-foreground">{t.fahrer_telefon ? (t.telefon_name ? `${t.telefon_name} · ${t.fahrer_telefon}` : t.fahrer_telefon) : "Keine Rufnummer hinterlegt"}</div>
        </div>
        {t.fahrer_telefon && (
          <a href={`tel:${t.fahrer_telefon.replace(/[^\d+]/g, "")}`} aria-label="Fahrer anrufen"
            className="size-12 rounded-full bg-success text-success-foreground grid place-items-center shadow-lg hover:opacity-90">
            <Phone className="size-5" />
          </a>
        )}
      </div>
    </div>
  );
}
