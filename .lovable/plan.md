## Ziel

Ausbau des **Revier Center** um ein vollständiges **OWKS-Modul** (Objekt-Wach-Kontroll-System) mit Bestreifungsplanung, Rundgangsverwaltung, NFC-Punkten und Zeitstrahl — strikt domain-scoped.

---

## Navigation

Im Sidebar-Bereich „Center" wird `Revier Center` zum Submenü mit:
- **Übersicht** (`/revier-center`)
- **OWKS** (`/revier-center/owks`) — Landing/Dashboard
  - Zeitstrahl (`/revier-center/owks/zeitstrahl`)
  - Bestreifungspläne (`/revier-center/owks/bestreifungsplaene`)
  - Rundgangsverwaltung (`/revier-center/owks/rundgaenge`)
  - NFC-Punkte (`/revier-center/owks/nfc-punkte`)
  - Kunden & Objekte (`/revier-center/owks/objekte`)
  - Ereignisse (`/revier-center/owks/ereignisse`)

Gating: Rollen `admin`, `dispatcher`, `superadmin`; Fahrer sehen nur das Scan-Interface (`/revier-center/owks/scan`).

---

## Datenmodell (neue Tabellen, alle mit `domain_id` + RLS)

- `owks_objekte` — Revier-Objekte (Name, Adresse, Kunden-Ref, Geo, aktiv). Import aus `kunden`/Stammdaten möglich.
- `owks_kunden_link` — Verknüpfung importierter Stammdaten-Kunden mit OWKS.
- `owks_rundgaenge` — Rundgang-Definitionen (Name, Objekt, Kunde, Notizen).
- `owks_kontrollpunkte` — NFC-Punkte pro Rundgang (Reihenfolge, Bezeichnung, NFC-UID/Tag-Typ wie NTAG213/NTAG215/NTAG216/MIFARE Classic/Ultralight/DESFire, Raum, GPS).
- `owks_bestreifungsplaene` — Pläne (Rundgang, Zeitfenster Start/Ende, Sollzeit, Durchgänge, Zeit-Limits Min/Max, Reihenfolge-Verhalten, manuelle Buchung, Ausführung (Wochentag/Intervall), Gültigkeit ab/bis, Ferien-Verhalten).
- `owks_bestreifungen` — generierte/instanziierte Einzel-Bestreifungen (Plan-Ref optional für Ad-hoc, Datum, Status: geplant/aktiv/erledigt/versäumt/storniert).
- `owks_durchgaenge` — pro Bestreifung mehrere Durchgänge mit Start/Ende, Fahrer-Ref.
- `owks_scans` — NFC-Scans (Durchgang, Kontrollpunkt, Fahrer, Timestamp, GPS, Notiz).
- `owks_ereignisse` — Vorkommnisse (Bestreifung, Typ, Beschreibung, Foto-URL).

RLS: alle Tabellen scopen via `current_effective_domain_id()`; Schreiben nur für `admin`/`dispatcher`/`superadmin`, Fahrer nur eigene Scans/Ereignisse.

---

## UI-Komponenten

1. **OWKS-Übersicht**: KPI-Kacheln (heute geplante Bestreifungen, offen, abgeschlossen, versäumt), Schnellzugriffe.
2. **Zeitstrahl** (analog Screenshot): horizontale Timeline, Zeilen = Reviere/Objekte, Balken = Bestreifungen mit Status-Farben (grün=ok, rot=versäumt, gestrichelt=geplant). Klick öffnet Dialog mit Tabs **Info / Bearbeiten / Rundgang**.
3. **Bestreifungspläne**: Tabelle gruppiert nach Revier/Rundgang, Filter, Anlegen/Bearbeiten-Dialog (Allgemein + Änderungen-Historie, Wiederholung, Gültigkeit).
4. **Rundgangsverwaltung**: Tabelle (Rundgangname, -nr., Kontrollpunkte-Anzahl, Kunde, Objekt). Anlegen → Punkte sortierbar zuweisen.
5. **NFC-Punkte**: Verwaltung aller Tags, Tag-Typ-Auswahl, UID-Eingabe oder Web-NFC-Scan-Button (Chrome Android), Zuordnung zu Objekt/Rundgang.
6. **Kunden & Objekte**: Liste + Button „Aus Stammdaten importieren" (öffnet Picker auf bestehende `kunden`-Tabelle).
7. **Fahrer-Scan-View** (`/revier-center/owks/scan`): mobile-first, große Buttons, Web-NFC-Reader (`NDEFReader`), Fallback manuelle UID-Eingabe, Live-Fortschritt Durchgang.

---

## Server-Layer

`createServerFn`-Module unter `src/lib/owks/`:
- `owks-objekte.functions.ts`, `owks-rundgaenge.functions.ts`, `owks-bestreifungsplaene.functions.ts`, `owks-zeitstrahl.functions.ts`, `owks-scans.functions.ts`, `owks-nfc.functions.ts`.
- Alle mit `requireSupabaseAuth` + Zod-Validierung; Domain-Scoping via `requireEffectiveDomainId`.
- Job zur Bestreifungs-Materialisierung (Plan → konkrete `owks_bestreifungen` für Zeitraum) als Server-Fn, getriggert beim Öffnen des Zeitstrahls und nach Plan-Save.

---

## Umsetzungsschritte

1. **Migration** für alle OWKS-Tabellen, Enums (`owks_tag_typ`, `owks_bestreifung_status`, `owks_reihenfolge_modus`), Indizes, RLS-Policies.
2. **Sidebar** umbauen: Untermenü-Support oder gruppierte Anzeige für Revier Center.
3. **Routes & Server-Fns** anlegen (Stub-Komponenten zuerst, dann Inhalt).
4. **Zeitstrahl-Komponente** (eigene leichtgewichtige Implementierung mit CSS-Grid, kein neues Heavy-Lib).
5. **Bestreifungsplan- & Rundgang-Dialoge** mit Tabs wie in Screenshots.
6. **NFC-Punkte-Seite** inkl. Web-NFC-Scan.
7. **Fahrer-Scan-Route** mit `NDEFReader`.
8. **Stammdaten-Import** für Kunden/Objekte.

---

## Hinweise

- Web-NFC funktioniert nur auf Chrome/Android über HTTPS. iOS/Desktop bekommen manuelle UID-Eingabe als Fallback.
- Zeitstrahl wird in V1 read-mostly: Klick → Dialog (Info/Bearbeiten/Rundgang) wie in den Screenshots; Drag-Resize folgt in V2.
- Alles strikt nach `current_effective_domain_id` getrennt; SuperAdmin sieht via Impersonation die jeweilige Domain.

Soll ich so loslegen?
