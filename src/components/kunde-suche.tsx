import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchKundenDateien } from "@/lib/einsaetze.functions";

export type KundeHit = {
  id: string;
  kunden_name: string | null;
  address: string | null;
  key_number: string | null;
  anlagen_nr: string | null;
  teilnehmer_id: string | null;
  folder: string | null;
};

/**
 * Wiederverwendbare Kundensuche über die Dateiverwaltung.
 * Wird u. a. vom Schlüsselbestand, dem Objektdossier und dem Service Center genutzt.
 */
export function KundeSuche({
  onPick,
  label = "Kunde / Objekt suchen",
  kompakt = false,
}: {
  onPick: (hit: KundeHit) => void;
  label?: string;
  kompakt?: boolean;
}) {
  const searchFn = useServerFn(searchKundenDateien);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<KundeHit | null>(null);
  const term = q.trim();

  const { data, isFetching } = useQuery({
    queryKey: ["kunde-suche", term],
    queryFn: () => searchFn({ data: { q: term } }),
    enabled: term.length >= 2 && !picked,
  });

  const results: KundeHit[] = (data as any)?.results ?? [];

  return (
    <div className={kompakt ? "space-y-1.5" : "rounded-lg border border-border p-3 space-y-2"}>
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-9"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPicked(null);
          }}
          placeholder="Kunde, Straße, Schlüssel-Nr., Anlagen-Nr. ..."
        />
      </div>

      {picked ? (
        <div className="text-xs text-muted-foreground">
          Übernommen: <b className="text-foreground">{picked.kunden_name || "Ohne Kundennamen"}</b>
          {picked.key_number ? ` · 🔑 ${picked.key_number}` : ""}
          {picked.address ? ` · 📍 ${picked.address}` : ""}
        </div>
      ) : term.length < 2 ? (
        <p className="text-[11px] text-muted-foreground">Mindestens 2 Zeichen eingeben.</p>
      ) : isFetching ? (
        <p className="text-[11px] text-muted-foreground">Suche läuft ...</p>
      ) : results.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Keine Treffer.</p>
      ) : (
        <ul className="rounded-md border border-border divide-y divide-border max-h-52 overflow-y-auto">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="w-full text-left p-2 hover:bg-muted/40 transition-colors"
                onClick={() => {
                  setPicked(r);
                  onPick(r);
                }}
              >
                <div className="text-sm font-medium">{r.kunden_name || "Ohne Kundennamen"}</div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                  {r.address && <span>📍 {r.address}</span>}
                  {r.key_number && <span>🔑 {r.key_number}</span>}
                  {r.anlagen_nr && <span>🏷️ {r.anlagen_nr}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
