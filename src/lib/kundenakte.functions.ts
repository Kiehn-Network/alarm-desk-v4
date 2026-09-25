import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Kennung eines Kunden – es gibt keine eigene Kundentabelle. */
export type KundenKennung = {
  name: string;
  tn?: string | null;
  anl?: string | null;
  key?: string | null;
  addr?: string | null;
};

export type KundenTreffer = KundenKennung & {
  dateien: number;
  schluessel: number;
  einsaetze: number;
  dossier: boolean;
};

const n = (s: any) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const nameKey = (s: any) => n(s).replace(/[^a-z0-9äöüß]/g, "").split("").sort().join("");
/** Für PostgREST .or() unschädlich machen. */
const clean = (s: string) => s.replace(/[%_,()*"\\]/g, " ").trim();

/**
 * Strenge Zuordnung einer Zeile zum Kunden:
 * Teilnehmer-/Anlagennummer vorrangig, dann Name; Schlüsselnummer allein zählt nie.
 */
function gehoertZuKunde(k: KundenKennung, r: any): boolean {
  const pairs: Array<[string, string]> = [
    [n(k.tn), n(r.teilnehmer_id)],
    [n(k.anl), n(r.anlagen_nr)],
  ];
  for (const [a, b] of pairs) if (a && b && a !== b) return false;
  if (pairs.some(([a, b]) => a && a === b)) return true;
  const kName = nameKey(k.name), rName = nameKey(r.kunden_name);
  if (kName && rName) return kName === rName;
  // Kein Name an der Zeile: nur Schlüsselnummer + Adresse gemeinsam
  const kKey = n(k.key), rKey = n(r.key_number);
  const kAddr = n(k.addr), rAddr = n(r.address);
  return !!(kKey && kKey === rKey && kAddr && kAddr === rAddr);
}

const kennungSchema = z.object({
  name: z.string().trim().max(200).default(""),
  tn: z.string().trim().max(100).nullish(),
  anl: z.string().trim().max(100).nullish(),
  key: z.string().trim().max(100).nullish(),
  addr: z.string().trim().max(300).nullish(),
});

export const searchKunden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ q: z.string().trim().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = clean(data.q);
    if (!q) return { treffer: [] as KundenTreffer[] };
    const p = `%${q}%`;
    const orStd = ["kunden_name", "address", "key_number", "anlagen_nr", "teilnehmer_id"]
      .map((f) => `${f}.ilike.${p}`).join(",");
    const [d, ds, e, s] = await Promise.all([
      supabase.from("dateien").select("kunden_name,address,key_number,anlagen_nr,teilnehmer_id")
        .is("deleted_at", null).or(orStd).limit(400),
      supabase.from("objekt_dossiers").select("kunden_name,address,key_number,anlagen_nr,teilnehmer_id")
        .or(orStd).limit(100),
      supabase.from("einsaetze").select("kunden_name,address,key_number,anlagen_nr,teilnehmer_id")
        .or(orStd).limit(400),
      supabase.from("schluessel_bestand").select("kunden_name,address,key_number")
        .or(["kunden_name", "address", "key_number"].map((f) => `${f}.ilike.${p}`).join(",")).limit(200),
    ]);

    const map = new Map<string, KundenTreffer>();
    const add = (r: any, feld: "dateien" | "schluessel" | "einsaetze" | "dossier") => {
      const name = String(r.kunden_name ?? "").trim();
      if (!name && !r.teilnehmer_id) return;
      const id = n(r.teilnehmer_id) ? `tn:${n(r.teilnehmer_id)}` : `n:${nameKey(name)}`;
      let t = map.get(id);
      if (!t) {
        t = { name, tn: r.teilnehmer_id ?? null, anl: r.anlagen_nr ?? null, key: r.key_number ?? null,
          addr: r.address ?? null, dateien: 0, schluessel: 0, einsaetze: 0, dossier: false };
        map.set(id, t);
      }
      if (!t.name && name) t.name = name;
      if (!t.anl && r.anlagen_nr) t.anl = r.anlagen_nr;
      if (!t.key && r.key_number) t.key = r.key_number;
      if (!t.addr && r.address) t.addr = r.address;
      if (feld === "dossier") t.dossier = true; else t[feld]++;
    };
    (ds.data ?? []).forEach((r) => add(r, "dossier"));
    (d.data ?? []).forEach((r) => add(r, "dateien"));
    (e.data ?? []).forEach((r) => add(r, "einsaetze"));
    (s.data ?? []).forEach((r) => add(r, "schluessel"));

    // Name-Gruppen ohne TN mit TN-Gruppe gleichen Namens zusammenführen
    const byName = new Map<string, KundenTreffer>();
    for (const [id, t] of map) if (id.startsWith("tn:")) byName.set(nameKey(t.name), t);
    for (const [id, t] of Array.from(map)) {
      if (!id.startsWith("n:")) continue;
      const ziel = byName.get(nameKey(t.name));
      if (ziel) {
        ziel.dateien += t.dateien; ziel.einsaetze += t.einsaetze; ziel.schluessel += t.schluessel;
        ziel.dossier = ziel.dossier || t.dossier; map.delete(id);
      }
    }
    const treffer = Array.from(map.values())
      .filter((t) => t.name)
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .slice(0, 80);
    return { treffer };
  });

export const getKundenakte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => kennungSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const k: KundenKennung = data;
    const ors: string[] = [];
    const name = clean(k.name ?? "");
    if (name) ors.push(`kunden_name.ilike.%${name}%`);
    if (k.tn && clean(k.tn)) ors.push(`teilnehmer_id.eq.${clean(k.tn)}`);
    if (k.anl && clean(k.anl)) ors.push(`anlagen_nr.eq.${clean(k.anl)}`);
    if (ors.length === 0) throw new Error("Keine Kundenkennung angegeben.");
    const orStd = ors.join(",");
    const keyOrs = [name ? `kunden_name.ilike.%${name}%` : "", k.key && clean(k.key) ? `key_number.eq.${clean(k.key)}` : ""]
      .filter(Boolean).join(",");

    const [d, e, ds, sb, buch, prot] = await Promise.all([
      supabase.from("dateien").select("*").is("deleted_at", null).or(orStd)
        .order("created_at", { ascending: false }).limit(500),
      supabase.from("einsaetze")
        .select("id,einsatzgrund,status,created_at,abgeschlossen_am,kunden_name,address,key_number,anlagen_nr,teilnehmer_id,assigned_to")
        .or(orStd).order("created_at", { ascending: false }).limit(300),
      supabase.from("objekt_dossiers").select("*").or(orStd).limit(20),
      keyOrs ? supabase.from("schluessel_bestand").select("*").or(keyOrs).limit(100) : Promise.resolve({ data: [] as any[] }),
      keyOrs ? supabase.from("schluessel_buch").select("*").or(keyOrs).order("ausgegeben_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] as any[] }),
      name ? supabase.from("schluesseluebergabe_protokolle")
        .select("id,protokoll_nr,richtung,kunden_name,kunden_nr,created_at,uebergeben_an_name,uebergeben_von_name")
        .ilike("kunden_name", `%${name}%`).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] as any[] }),
    ]);
    if (d.error) throw new Error(d.error.message);

    const dateien = (d.data ?? []).filter((r) => gehoertZuKunde(k, r));
    const einsaetze = (e.data ?? []).filter((r) => gehoertZuKunde(k, r));
    const dossier = (ds.data ?? []).find((r) => gehoertZuKunde(k, r)) ?? null;
    const schluessel = ((sb as any).data ?? []).filter((r: any) => gehoertZuKunde(k, r));
    const schluesselbuch = ((buch as any).data ?? []).filter((r: any) => gehoertZuKunde(k, r));
    const protokolle = ((prot as any).data ?? []).filter((r: any) => nameKey(r.kunden_name) === nameKey(k.name));

    const fahrerIds = Array.from(new Set(einsaetze.map((x) => x.assigned_to).filter(Boolean))) as string[];
    let fahrer: Record<string, string> = {};
    if (fahrerIds.length) {
      const { data: ps } = await supabase.from("profiles").select("id, display_name").in("id", fahrerIds);
      fahrer = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
    }

    // Kopfdaten aus allen Quellen ergänzen
    const quelle = [dossier, ...dateien, ...einsaetze].filter(Boolean) as any[];
    const pick = (f: string) => quelle.find((r) => r[f])?.[f] ?? null;
    const kopf = {
      name: k.name || pick("kunden_name") || "",
      tn: k.tn || pick("teilnehmer_id"),
      anl: k.anl || pick("anlagen_nr"),
      key: k.key || pick("key_number"),
      addr: k.addr || pick("address"),
      hinweise: dateien.map((x) => x.notiz).filter(Boolean).slice(0, 5) as string[],
    };

    return { kopf, dateien, einsaetze, dossier, schluessel, schluesselbuch, protokolle, fahrer };
  });
