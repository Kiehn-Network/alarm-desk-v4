# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [4.0.22] - 2026-08-21

### Changed

- **Stempelzeiten für Fahrer**: Das 2-Sekunden-Festhalten entfällt – Zeiten werden jetzt per einfachem Klick gesetzt. Eine bereits gesetzte Zeit kann über das Stift-Symbol nachträglich korrigiert werden.

### Fixed

- **ERP-Zeitstempel**: Zeitpunkte werden nicht mehr fälschlich auf den Zeitpunkt der Fahrerzuweisung hochgeklemmt – dadurch entstehen keine Einsätze mit 0 Minuten Dauer mehr.
- **ERP `einsatzDatum`**: Entspricht jetzt exakt `beginnBrutto` (gleiche Quelle, Europa/Berlin-Ortszeit mit korrektem Offset).

## [4.0.21] - 2026-08-20

### Added

- **Stornierung im Nachgang**: Einsätze lassen sich nachträglich als storniert markieren – inklusive Grund, Zeitpunkt und ausführendem Benutzer.
- **Schlüsselbuch – Zwangsrücknahme**: Schlüssel können zwangsweise zurückgenommen werden; zusätzlich kann die Zentrale Schlüssel manuell aus- und einbuchen (Name und Begründung sind Pflicht).

### Changed

- **Startzeit bearbeitbar**: Beim Bearbeiten eines Einsatzes kann der Erstellzeitpunkt (Startzeit) angepasst werden, inklusive Eintrag in der Historie.
- **Homepage im Light-Mode**: Die Startseite wurde auf ein helles Design umgestellt.
- **Lutz PisaWeb-Link**: Zeigt jetzt auf `https://desktop.pisa.lutz-aufzuege.de/pisaexternal/pisasales`.
- **Passwort-Mindestlänge**: Auf 4 Zeichen gesenkt (Profil, Passwort-Reset, Admin- und Superadmin-Nutzerverwaltung).

### Removed

- **Einführung/Tour**: Die geführte Einführung inkl. Demo-Modus und Login-Splash ist ausgeblendet.

## [4.0.20] - 2026-07-14

### Added

- **Chat-System erweitert**: Persistenter Kanal „#Allgemein“ für alle Nutzer, rollen-geschützter Kanal „#Zentrale“ für Admins und Disponenten sowie private Direktnachrichten mit beliebigen Personen der eigenen Domäne. Inklusive Ungelesen-Badges pro Konversation und Push-/Sound-Benachrichtigungen.
- **Benutzer-Export für Domänen-Admins**: Admins können die Benutzerliste ihrer Domäne gefiltert nach Rolle als CSV exportieren.
- **ESRP Payload-Preview**: Neue Vorschau-Karte in der ESRP-Ansicht zeigt das exakt gebaute JSON inklusive Metadaten zur Base64-PDF vor dem Versand.
- **Homepage-Redesign („Enterprise Indigo“)**: Neue Landing-Page mit Midnight-Indigo-Palette, Sora/Manrope-Typografie und überarbeiteten Sektionen (Hero, Features, Module, Security, CTA).

### Changed

- **ESRP `aenderPersonalNr`**: Default auf `999` gesetzt (positive ERP-Personalnummer), der bisher mögliche Wert `0` wird nicht mehr übergeben.
- **ESRP Zeitangaben**: Alle Zeitpunkte (Arbeitszeit, `einsatzDatum`) werden jetzt in Europa/Berlin-Ortszeit mit korrektem Offset (`+01:00` / `+02:00`, inkl. Sommerzeit) statt in UTC (`Z`) übergeben.
- **Login-Footer**: Kompakteres, responsives Versions-Badge mit dem Hinweis „Ein Produkt vom Kiehn Network“.

## [4.0.19] - 2026-07-13

### Added

- **Login-Splash mit Blur-Effekt**: Nach dem Anmelden erscheint kurzzeitig ein Ladebildschirm („Hole Daten aus der Datenbank…“, „Prüfe Daten auf Vollständigkeit…“) über einem stark verschwommenen Hintergrund.
- **Pflicht-Einführung mit Demo-Modus**: Neue Benutzer müssen die Einführung einmalig mit reinen Demo-Daten durchspielen. Erst danach werden echte Daten angezeigt.
- **Geführter Testlauf Schlüsselbuch**: Interaktive Schritt-für-Schritt-Anleitung im Schlüsselbuch mit Beispiel-Daten (Bewegungshistorie öffnen, Status setzen, Übergabe/Rückgabe bestätigen).
- **Lutz PisaWeb-Untermenü**: Im Notdienst-Bereich wurde ein direkter Link zu `https://pisaweb.lutz-aufzuege.de/pisasales/pisasales` hinzugefügt.
- **Echtzeit-Updates für Fahrer**: Schlüssel-Übergaben der Zentrale erscheinen jetzt live in „Meine Einsätze“ ohne manuelles Neuladen.
- **Echtzeit-Updates für Zentrale**: Sobald ein Fahrer einen Bericht abschließt, wird die Alarmierungs-Liste automatisch aktualisiert und die Zentrale erhält eine Benachrichtigung.
- **Admin: Einführungs-Status verwalten**: Admins können für einzelne Benutzer festlegen, ob die Einführung als abgeschlossen gilt.
- **Admin: Fahrer-Auswahl für Einsatz-Erstellung**: Admins können pro Fahrer steuern, ob dieser beim Erstellen eines Einsatzes auswählbar ist.

### Changed

- **Datum-Filter in Alarmierung**: Einsätze lassen sich jetzt zusätzlich nach einem Zeitraum (von/bis) filtern.

## [4.0.18] - 2026-07-05

### Added

- **E-Mail-Branding pro Domäne**: Jede Domäne kann jetzt ihr eigenes E-Mail-Design anpassen – inklusive Logo, Markenfarbe, Begrüßung, Signatur, Fußtext und Absender-Name.
- **E-Mail-Themes**: Vorgefertigte Design-Presets als Startpunkt, die Farben und Textbausteine auf einmal übernehmen.
- **E-Mail-Layouts**: Vier unterschiedliche Layout-Varianten für E-Mails: Card, Banner, Minimal und Sidebar.
- **Live-Vorschau**: Das Admin-Panel zeigt eine Echtzeit-Vorschau der E-Mail direkt neben den Einstellungen an.

### Changed

- **Header-Label optional**: Der kleine Text unter dem Firmennamen im E-Mail-Header kann jetzt leer gelassen werden. Ist das Feld leer, wird im Versand nur der Firmenname ohne Unterzeile angezeigt.
- **PDF-Download-Links in E-Mails**: Signed URLs aus dem Supabase Storage werden jetzt für versendete E-Mails (Einsatzberichte, Abrechnungen, Budeko-Berichte, Rohrservice-Berichte) auf die eigene Domain `data.alarmdesk-software.de` umgeschrieben. Steuerbar über die Umgebungsvariable `PUBLIC_STORAGE_URL`.
- **Budeko-Bericht-Versand**: Budeko-Berichte werden jetzt über die domänenspezifischen E-Mail-Einstellungen versendet – inklusive Branding, Absender-Name und BCC. Zuvor war der Versand auf die feste Adresse `notify.einsatz-bericht.de` eingestellt.
- **Abrechnung Hausnotruf-Versand**: Die monatlichen Einsatzberichte für Malteser, Johanniter und LüWa werden jetzt ebenfalls über die domänenspezifischen E-Mail-Einstellungen versendet – inklusive Branding, Absender-Name und BCC.

### Fixed

- Header-Label fällt nicht mehr automatisch auf den Standardtext zurück, wenn es bewusst geleert wird.

## [Unreleased]
