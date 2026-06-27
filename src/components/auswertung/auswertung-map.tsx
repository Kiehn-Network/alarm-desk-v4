import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, MapPin, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Pin = {
  id: string;
  domain_id: string;
  created_by: string;
  kategorie: string;
  titel: string;
  adresse: string | null;
  lat: number;
  lng: number;
  ereignis_am: string;
  notiz: string | null;
};

const KATEGORIEN = [
  { value: "echteinbruch", label: "Echteinbruch", color: "#dc2626" },
  { value: "einbruchversuch", label: "Einbruchversuch", color: "#f97316" },
  { value: "vandalismus", label: "Vandalismus", color: "#a855f7" },
  { value: "sonstiges", label: "Sonstiges", color: "#6b7280" },
];

function pinIcon(color: string) {
  const html = `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
    <div style="width:28px;height:28px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>
    <div style="position:absolute;width:10px;height:10px;border-radius:9999px;background:white;"></div>
  </div>`;
  return L.divIcon({ html, className: "", iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -24] });
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AuswertungMap() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [form, setForm] = useState({
    kategorie: "echteinbruch",
    titel: "",
    adresse: "",
    ereignis_am: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notiz: "",
  });
  const mapRef = useRef<L.Map | null>(null);

  const { data: pins = [], isLoading } = useQuery({
    queryKey: ["auswertung-pins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auswertung_pins")
        .select("*")
        .order("ereignis_am", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pin[];
    },
  });

  const createPin = useMutation({
    mutationFn: async (input: { lat: number; lng: number; kategorie: string; titel: string; adresse: string; ereignis_am: string; notiz: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Nicht angemeldet");
      const { data: prof } = await supabase.from("profiles").select("domain_id").eq("id", userId).maybeSingle();
      if (!prof?.domain_id) throw new Error("Keine Domäne zugeordnet");
      const { error } = await supabase.from("auswertung_pins").insert({
        domain_id: prof.domain_id,
        created_by: userId,
        kategorie: input.kategorie,
        titel: input.titel,
        adresse: input.adresse || null,
        lat: input.lat,
        lng: input.lng,
        ereignis_am: new Date(input.ereignis_am).toISOString(),
        notiz: input.notiz || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auswertung-pins"] });
      setDraft(null);
      setForm((f) => ({ ...f, titel: "", adresse: "", notiz: "" }));
      toast.success("Pin gespeichert");
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Speichern"),
  });

  const deletePin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("auswertung_pins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auswertung-pins"] });
      toast.success("Pin gelöscht");
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Löschen"),
  });

  const center = useMemo<[number, number]>(() => {
    if (pins.length === 0) return [53.3711, 10.5562]; // Lauenburg-ish
    const lat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
    const lng = pins.reduce((s, p) => s + p.lng, 0) / pins.length;
    return [lat, lng];
  }, [pins]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || pins.length === 0) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    m.fitBounds(bounds.pad(0.3), { animate: true, maxZoom: 13 });
  }, [pins.length]);

  // Stats
  const stats = useMemo(() => {
    const total = pins.length;
    const byKat = new Map<string, number>();
    const byMonth = new Map<string, number>();
    const now = new Date();
    const last30 = pins.filter((p) => (now.getTime() - new Date(p.ereignis_am).getTime()) / 86400000 <= 30).length;
    const last365 = pins.filter((p) => (now.getTime() - new Date(p.ereignis_am).getTime()) / 86400000 <= 365).length;
    for (const p of pins) {
      byKat.set(p.kategorie, (byKat.get(p.kategorie) ?? 0) + 1);
      const m = format(new Date(p.ereignis_am), "yyyy-MM");
      byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    }
    const monthsSorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
    const echtCount = pins.filter((p) => p.kategorie === "echteinbruch").length;
    return { total, byKat, monthsSorted, last30, last365, echtCount };
  }, [pins]);

  const maxMonth = Math.max(1, ...stats.monthsSorted.map(([, v]) => v));

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-[600px]">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pins gesamt" value={stats.total} icon={<MapPin className="size-4" />} />
        <StatCard label="Echteinbrüche" value={stats.echtCount} icon={<AlertTriangle className="size-4 text-destructive" />} />
        <StatCard label="Letzte 30 Tage" value={stats.last30} />
        <StatCard label="Letzte 12 Monate" value={stats.last365} />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[500px]">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-border bg-card relative" style={{ minHeight: 500 }}>
          <MapContainer
            center={center}
            zoom={11}
            style={{ height: "100%", width: "100%", minHeight: 500 }}
            ref={(m) => { if (m) mapRef.current = m; }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onClick={(lat, lng) => setDraft({ lat, lng })} />
            {pins.map((p) => {
              const meta = KATEGORIEN.find((k) => k.value === p.kategorie) ?? KATEGORIEN[0];
              return (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(meta.color)}>
                  <Popup>
                    <div className="text-sm" style={{ minWidth: 220 }}>
                      <div className="font-semibold text-base">{p.titel}</div>
                      <div className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: meta.color, color: "white" }}>
                        {meta.label}
                      </div>
                      {p.adresse && <div className="mt-2 text-muted-foreground">{p.adresse}</div>}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(p.ereignis_am), "PPpp", { locale: de })}
                      </div>
                      {p.notiz && <div className="mt-2 whitespace-pre-wrap">{p.notiz}</div>}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Pin wirklich löschen?")) deletePin.mutate(p.id);
                        }}
                        className="mt-3 inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <Trash2 className="size-3" /> Löschen
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {draft && (
              <Marker position={[draft.lat, draft.lng]} icon={pinIcon("#0ea5e9")} />
            )}
          </MapContainer>
          {isLoading && (
            <div className="absolute top-3 right-3 rounded-md bg-card/90 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground border border-border">
              Lade…
            </div>
          )}
        </div>

        {/* Side panel: stats */}
        <div className="lg:w-80 flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Nach Kategorie</h3>
            <div className="grid gap-2">
              {KATEGORIEN.map((k) => {
                const v = stats.byKat.get(k.value) ?? 0;
                const pct = stats.total > 0 ? Math.round((v / stats.total) * 100) : 0;
                return (
                  <div key={k.value} className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: k.color }} />
                        {k.label}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{v} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, background: k.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex-1">
            <h3 className="text-sm font-semibold mb-3">Verlauf (12 Monate)</h3>
            {stats.monthsSorted.length === 0 ? (
              <p className="text-xs text-muted-foreground">Noch keine Daten.</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {stats.monthsSorted.map(([m, v]) => (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1 group" title={`${m}: ${v}`}>
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className="w-full rounded-t bg-primary group-hover:opacity-80 transition"
                        style={{ height: `${(v / maxMonth) * 100}%`, minHeight: 2 }}
                      />
                    </div>
                    <div className="text-[9px] text-muted-foreground tabular-nums">{m.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New pin dialog */}
      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Pin</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <div className="text-xs text-muted-foreground">
                Position: {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
              </div>
              <div className="grid gap-1.5">
                <Label>Kategorie</Label>
                <Select value={form.kategorie} onValueChange={(v) => setForm({ ...form, kategorie: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KATEGORIEN.map((k) => (
                      <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Titel *</Label>
                <Input value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} placeholder="z. B. Echteinbruch Bäckerei" />
              </div>
              <div className="grid gap-1.5">
                <Label>Adresse</Label>
                <Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} placeholder="Straße, PLZ Ort" />
              </div>
              <div className="grid gap-1.5">
                <Label>Ereignis am</Label>
                <Input type="datetime-local" value={form.ereignis_am} onChange={(e) => setForm({ ...form, ereignis_am: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Notiz</Label>
                <Textarea rows={3} value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Abbrechen</Button>
            <Button
              disabled={!form.titel.trim() || createPin.isPending || !draft}
              onClick={() => draft && createPin.mutate({ ...form, lat: draft.lat, lng: draft.lng })}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}