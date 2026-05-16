## Ziel
Fahrer-Dashboard um Zeit-Tracking, Datei-Ansicht und Einsatzberichte erweitern.

## 1. Datenbank-Migration

Neue Spalten in `einsaetze`:
- `vor_ort_am` (timestamptz)
- `abfahrt_am` (timestamptz)
- `einsatz_ende_am` (timestamptz)
- `bericht_typ` (text: `hausnotruf` | `av_einsatz` | null) — wird automatisch aus Einsatzgrund abgeleitet
- `bericht_data` (jsonb) — flexibles Formular-Storage
- `hausnotruf_problem` (text)
- `hausnotruf_loesung` (text)

RLS bleibt: Fahrer kann eigene Einsätze updaten (Policy `einsaetze_update_fahrer_assigned` existiert).

Historie-Tracking für die neuen Zeit-Felder ergänzen (via Server-Funktion, kein Trigger).

## 2. Server-Funktionen (`src/lib/einsaetze.functions.ts`)

Neue Funktionen:
- `setEinsatzZeit({ id, feld: 'vor_ort'|'abfahrt'|'ende' })` — setzt Zeit auf `now()`, schreibt Historie. Fahrer-Auth.
- `updateEinsatzBericht({ id, bericht_typ, bericht_data, hausnotruf_problem?, hausnotruf_loesung? })` — speichert Formular. Nur solange Status != `abgeschlossen`.
- `abschliessenEinsatz` erweitern: setzt automatisch `einsatz_ende_am` falls leer.
- `listDateienForEinsatz({ einsatz_id })` — sucht Dateien anhand `kunden_name`, `address`, `key_number`, `anlagen_nr`, `teilnehmer_id` (matching auf Datei-Felder).

## 3. UI — `meine-einsaetze.tsx`

Pro Einsatz-Karte neu:

**Hold-Button Komponente** (`src/components/hold-button.tsx`):
- 2-Sekunden Press-and-Hold mit Progress-Ring
- Funktioniert für Touch & Maus
- Wandelt sich nach Auslösung in Zeit-Anzeige (formatierte Uhrzeit)
- Drei Buttons untereinander: Vor Ort / Abfahrt / Einsatz Ende
- Reihenfolge nicht erzwungen, jeder ist einzeln setzbar
- Bereits gesetzte Zeiten erscheinen als Badge mit Uhrzeit (read-only nach Setzen)

**Aktions-Bereich erweitert**:
- "Dateien" Button → öffnet `DateienDialog` mit gefilterten Kunden-Dateien (View/Download via Signed URL aus bestehender `dateien.functions.ts`)
- "Bericht" Button → öffnet `BerichtDialog`

**BerichtDialog**:
- Bestimmt Formular-Typ über Einsatzgrund-Name (Heuristik: enthält "Hausnotruf" → Hausnotruf, sonst AV)
- Manuelles Override per Tabs möglich
- **Hausnotruf**: 2 Textareas (Problem, Lösung)
- **AV-Einsatz**: Strukturierter Fragenkatalog:
  - Auslösung: Checkboxen (Alarm auf Linie / Störung auf Linie)
  - Linien-Nummer (Text)
  - Fremdeinwirkung: Ja/Nein/Sonstiges + Sonstiges-Text
  - Maßnahmen: Meldung Zentrale, Innenkontrolle, Rückstellung (jeweils Ja/Nein)
  - Weitere Maßnahmen (Textarea)
  - Scharfschaltung Checkbox
  - Mit/Ohne Errichter
  - Außenkontrolle negativ: Ja/Nein
- Speichert in `bericht_data` (jsonb), `hausnotruf_problem`/`hausnotruf_loesung` separat für bessere Suche
- Read-only sobald Einsatz `abgeschlossen`

**Abschließen-Button**:
- Bleibt, ruft `abschliessenEinsatz`. Server setzt automatisch `einsatz_ende_am`.

## 4. Alarmierungs-Übersicht (Dispatcher/Admin)

In `alarmierung.tsx` Detail-Anzeige der Zeiten und Bericht (read-only) — kompakt unter den Meta-Infos.

## 5. Historie

Bei Zeit-Buttons & Bericht-Save: Einträge in `einsatz_historie` (Feld-Name: `vor_ort_am`, `abfahrt_am`, `einsatz_ende_am`, `bericht`).

## Technische Details

- Hold-Button: `onPointerDown`/`onPointerUp`, `requestAnimationFrame` für Progress, `setTimeout` 2000ms zur Auslösung. SVG Stroke-Dasharray für Ring.
- Dateien-Filter Server-Seite: `or()` Query auf Datei-Spalten matching beliebigem der Einsatz-Identifier (case-insensitive).
- Bericht-Daten als jsonb gibt maximale Flexibilität für spätere Formular-Änderungen ohne Migration.

## Geänderte/Neue Dateien

- **Migration**: `supabase/migrations/..._einsatz_zeiten_bericht.sql`
- **Neu**: `src/components/hold-button.tsx`
- **Neu**: `src/components/einsatz-bericht-dialog.tsx`
- **Neu**: `src/components/einsatz-dateien-dialog.tsx`
- **Geändert**: `src/lib/einsaetze.functions.ts`
- **Geändert**: `src/routes/_authenticated/meine-einsaetze.tsx`
- **Geändert**: `src/routes/_authenticated/alarmierung.tsx` (Anzeige der Zeiten/Bericht)
