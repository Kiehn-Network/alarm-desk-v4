import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, ArrowUpFromLine, History, Search, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLagerStatistik, type LagerBuchung, type LagerPersonStat } from "@/lib/lager.functions";

function fmt(value: string | null) {
  if (!value) return "–";
  return new Date(value).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export function LagerStatistikPanel() {
  const load = useServerFn(getLagerStatistik);
  const [search, setSearch] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lager-statistik", von, bis],
    queryFn: () => load({ data: { von: von ? new Date(von).toISOString() : null, bis: bis ? new Date(`${bis}T23:59:59`).toISOString() : null } }),
  });

  const personen = (data?.personen ?? []) as LagerPersonStat[];
  const buchungen = (data?.buchungen ?? []) as LagerBuchung[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personen;
    return personen.filter((p) => p.person_name.toLowerCase().includes(q));
  }, [personen, search]);

  const detail = useMemo(() => {
    if (!selected) return [];
    return buchungen.filter((b) => (b.person_id ?? b.person_name ?? "unbekannt") === selected);
  }, [buchungen, selected]);

  const selectedPerson = filtered.find((p) => (p.person_id ?? p.person_name ?? "unbekannt") === selected) ?? personen.find((p) => (p.person_id ?? p.person_name ?? "unbekannt") === selected);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Statistik nach Benutzer</CardTitle>
          <p className="text-sm text-muted-foreground">Suche einen Benutzer und sieh, was er ein- und ausgebucht hat.</p>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_170px_170px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Benutzer suchen …" aria-label="Benutzer suchen" />
          </div>
          <Input type="date" value={von} onChange={(e) => setVon(e.target.value)} aria-label="Von" />
          <Input type="date" value={bis} onChange={(e) => setBis(e.target.value)} aria-label="Bis" />
          <Button variant="ghost" onClick={() => { setSearch(""); setVon(""); setBis(""); setSelected(null); }} disabled={!search && !von && !bis && !selected}>Zurücksetzen</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Benutzer</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="py-6 text-sm text-muted-foreground">Lade Statistik …</div> : filtered.length === 0 ? <div className="py-6 text-sm text-muted-foreground">Keine Buchungen für diese Auswahl.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Benutzer</th>
                    <th className="py-2 pr-3">Eingebucht</th>
                    <th className="py-2 pr-3">Ausgebucht</th>
                    <th className="py-2 pr-3">Buchungen</th>
                    <th className="py-2 pr-3">Letzte Buchung</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const key = p.person_id ?? p.person_name ?? "unbekannt";
                    return (
                      <tr key={key} className="border-t border-border">
                        <td className="py-2 pr-3 font-medium"><span className="inline-flex items-center gap-2"><User className="size-3.5 text-muted-foreground" />{p.person_name}</span></td>
                        <td className="py-2 pr-3 text-success">+{p.eingang}</td>
                        <td className="py-2 pr-3 text-warning">−{p.ausgang}</td>
                        <td className="py-2 pr-3">{p.buchungen}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{fmt(p.letzte_buchung)}</td>
                        <td className="py-2 text-right"><Button size="sm" variant={selected === key ? "secondary" : "outline"} onClick={() => setSelected(selected === key ? null : key)}>Details</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><History className="size-4 text-primary" />Buchungen – {selectedPerson?.person_name ?? "Benutzer"}</CardTitle></CardHeader>
          <CardContent>
            {detail.length === 0 ? <div className="py-4 text-sm text-muted-foreground">Keine Buchungen.</div> : (
              <div className="max-h-[55vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3">Zeitpunkt</th>
                      <th className="py-2 pr-3">Artikel</th>
                      <th className="py-2 pr-3">Richtung</th>
                      <th className="py-2 pr-3">Menge</th>
                      <th className="py-2 pr-3">Bestand danach</th>
                      <th className="py-2 pr-3">Notiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="py-2 pr-3 text-muted-foreground">{fmt(b.created_at)}</td>
                        <td className="py-2 pr-3">{b.artikel_bezeichnung ?? "–"}</td>
                        <td className="py-2 pr-3"><Badge variant={b.richtung === "eingang" ? "secondary" : "outline"}>{b.richtung === "eingang" ? <><ArrowDownToLine className="mr-1 size-3" />Eingang</> : <><ArrowUpFromLine className="mr-1 size-3" />Ausgang</>}</Badge></td>
                        <td className="py-2 pr-3">{b.menge}</td>
                        <td className="py-2 pr-3">{b.bestand_nachher}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{b.notiz ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
