# Kundenakte – alles zu einem Kunden an einem Ort

## Was du bekommst
Neuer Menüpunkt **„Kundenakte"** (für Admins und Disponenten).

1. **Suchleiste oben**: Name, Adresse, Teilnehmer-, Anlagen- oder Schlüsselnummer eintippen → Trefferliste der Kunden.
2. **Kunde anklicken** → eine Seite mit Kopfbereich (Name, Adresse, Nummern, Hinweise) und Reitern:
   - **Übersicht** – Eckdaten, Anzahl Dateien/Schlüssel/Einsätze, letzte Aktivität
   - **Dateien** – alle Dateien des Kunden ansehen, hochladen, bearbeiten, löschen
   - **Schlüssel** – Schlüsselbestand ansehen, anlegen, bearbeiten; Schlüsselbuch-Verlauf und Übergabeprotokolle
   - **Objektdossier** – anzeigen oder direkt neu anlegen/bearbeiten (Zufahrt, Kontakte, Gefahren usw.)
   - **Einsätze** – bisherige Einsätze mit Status und Bericht
3. **„Neuer Kunde"**-Knopf: Kunde anlegen, danach direkt Dateien, Schlüssel und Dossier hinzufügen.

Die bisherigen Einzelseiten (Dateien, Schlüsselbestand, Objektdossier, Kunden) bleiben erhalten – die Kundenakte bündelt sie nur.

## Technische Details
- Es gibt keine eigene Kundentabelle; Kunden werden aus Dateien, Schlüsselbestand, Dossiers und Einsätzen zusammengeführt. Zuordnung mit derselben strengen Regel wie `dateiGehoertZuKunde` (Teilnehmer-/Anlagennummer vorrangig, Name; Schlüsselnummer allein nie).
- Neue Server-Funktion `kundenakte.functions.ts`: `searchKunden(q)` (gruppierte Treffer aus allen Quellen, pro Domain) und `getKundenakte(kennung)` (bündelt Dateien, Schlüssel, Dossier, Einsätze).
- Route `/_authenticated/kundenakte` (Suche) und `/_authenticated/kundenakte/$kunde` (Akte, Kennung als URL-Parameter).
- Wiederverwendung vorhandener Komponenten/Funktionen: `DateiEditDialog`, Upload aus Dateien-Seite, Schlüsselbestand-CRUD, `ObjektDossierView` + Dossier-Formular, Einsatz-Historie.
- „Neuer Kunde" legt einen Grund-Datensatz als Objektdossier an (keine neue Tabelle nötig).
- Sidebar-Eintrag mit Icon, roadmap.md ergänzen, Browser-Test mit Test-Admin, Testdaten danach löschen.
