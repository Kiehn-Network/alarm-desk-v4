import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { getDomainDrivers, type DriverOnMap } from "@/lib/driver-locations.functions";

const PHASE_META: Record<
  NonNullable<DriverOnMap["einsatz"]>["phase"] | "frei",
  { label: string; color: string; ring: string }
> = {
  frei:       { label: "Verfügbar",   color: "#6b7280", ring: "#9ca3af" },
  zugewiesen: { label: "Zugewiesen",  color: "#eab308", ring: "#facc15" },
  anfahrt:    { label: "Anfahrt",     color: "#f97316", ring: "#fb923c" },
  vor_ort:    { label: "Vor Ort",     color: "#3b82f6", ring: "#60a5fa" },
  ende:       { label: "Einsatzende", color: "#a855f7", ring: "#c084fc" },
};

function driverIcon(phase: keyof typeof PHASE_META, initials: string) {
  const meta = PHASE_META[phase];
  const html = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:${meta.color};opacity:.25;animation:dl-pulse 2s ease-out infinite;"></div>
      <div style="position:relative;width:32px;height:32px;border-radius:9999px;background:${meta.color};color:white;font-weight:600;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid ${meta.ring};box-shadow:0 2px 6px rgba(0,0,0,.4);">
        ${initials}
      </div>
    </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -16],
  });
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function LiveMap() {
  const fetchDrivers = useServerFn(getDomainDrivers);
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["domain-drivers"],
    queryFn: () => fetchDrivers(),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });

  // Inject pulse keyframes once
  useEffect(() => {
    if (document.getElementById("dl-pulse-style")) return;
    const style = document.createElement("style");
    style.id = "dl-pulse-style";
    style.textContent = `@keyframes dl-pulse { 0%{transform:scale(1);opacity:.45} 100%{transform:scale(2);opacity:0} }`;
    document.head.appendChild(style);
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (drivers.length === 0) return [51.1657, 10.4515]; // Germany
    const lat = drivers.reduce((s, d) => s + d.lat, 0) / drivers.length;
    const lng = drivers.reduce((s, d) => s + d.lng, 0) / drivers.length;
    return [lat, lng];
  }, [drivers]);

  const mapRef = useRef<L.Map | null>(null);
  // Refit when driver set changes substantially
  useEffect(() => {
    const m = mapRef.current;
    if (!m || drivers.length === 0) return;
    const bounds = L.latLngBounds(drivers.map((d) => [d.lat, d.lng] as [number, number]));
    m.fitBounds(bounds.pad(0.3), { animate: true, maxZoom: 14 });
  }, [drivers.length]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[500px]">
      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-border bg-card relative" style={{ minHeight: 500 }}>
        <MapContainer
          center={center}
          zoom={6}
          style={{ height: "100%", width: "100%", minHeight: 500 }}
          ref={(m) => { if (m) mapRef.current = m; }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {drivers.map((d) => {
            const phase = d.einsatz?.phase ?? "frei";
            const meta = PHASE_META[phase];
            return (
              <div key={d.user_id}>
                {d.accuracy && d.accuracy < 1000 ? (
                  <CircleMarker
                    center={[d.lat, d.lng]}
                    radius={Math.min(40, Math.max(8, d.accuracy / 10))}
                    pathOptions={{ color: meta.color, fillColor: meta.color, fillOpacity: 0.08, weight: 1, opacity: 0.4 }}
                  />
                ) : null}
                <Marker position={[d.lat, d.lng]} icon={driverIcon(phase, getInitials(d.display_name))}>
                  <Popup>
                    <div className="text-sm" style={{ minWidth: 200 }}>
                      <div className="font-semibold text-base">{d.display_name ?? "Unbekannt"}</div>
                      <div className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: meta.color, color: "white" }}>
                        {meta.label}
                      </div>
                      {d.einsatz ? (
                        <div className="mt-2 space-y-0.5">
                          <div className="font-medium">{d.einsatz.einsatzgrund}</div>
                          {d.einsatz.kunden_name && <div className="text-muted-foreground">{d.einsatz.kunden_name}</div>}
                          {d.einsatz.address && <div className="text-muted-foreground">{d.einsatz.address}</div>}
                        </div>
                      ) : (
                        <div className="mt-2 text-muted-foreground">Kein aktiver Einsatz.</div>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground">
                        Letzte Position: {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true, locale: de })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </div>
            );
          })}
        </MapContainer>
        {isLoading && (
          <div className="absolute top-3 right-3 rounded-md bg-card/90 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground border border-border">
            Lade…
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="lg:w-80 flex flex-col gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Legende</h3>
          <div className="grid gap-2">
            {(Object.keys(PHASE_META) as Array<keyof typeof PHASE_META>).map((k) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="size-3 rounded-full" style={{ background: PHASE_META[k].color }} />
                <span>{PHASE_META[k].label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex-1 overflow-auto">
          <h3 className="text-sm font-semibold mb-3">Fahrer ({drivers.length})</h3>
          {drivers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Noch keine GPS-Positionen empfangen. Fahrer müssen eingeloggt sein und der Standortfreigabe im Browser zustimmen.
            </p>
          ) : (
            <ul className="space-y-2">
              {drivers.map((d) => {
                const phase = d.einsatz?.phase ?? "frei";
                const meta = PHASE_META[phase];
                return (
                  <li
                    key={d.user_id}
                    className="rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/50 transition"
                    onClick={() => mapRef.current?.flyTo([d.lat, d.lng], 15)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                      <span className="text-sm font-medium truncate">{d.display_name ?? "Unbekannt"}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {meta.label}
                      {d.einsatz?.address ? ` · ${d.einsatz.address}` : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}