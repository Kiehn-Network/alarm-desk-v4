# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [4.0.16] - 2026-07-04

### Added

- **E-Mail-Branding pro Domäne**: Jede Domäne kann jetzt ihr eigenes E-Mail-Design anpassen – inklusive Logo, Markenfarbe, Begrüßung, Signatur, Fußtext und Absender-Name.
- **E-Mail-Themes**: Vorgefertigte Design-Presets als Startpunkt, die Farben und Textbausteine auf einmal übernehmen.
- **E-Mail-Layouts**: Vier unterschiedliche Layout-Varianten für E-Mails: Card, Banner, Minimal und Sidebar.
- **Live-Vorschau**: Das Admin-Panel zeigt eine Echtzeit-Vorschau der E-Mail direkt neben den Einstellungen an.

### Changed

- **Header-Label optional**: Der kleine Text unter dem Firmennamen im E-Mail-Header kann jetzt leer gelassen werden. Ist das Feld leer, wird im Versand nur der Firmenname ohne Unterzeile angezeigt.
- **PDF-Download-Links in E-Mails**: Signed URLs aus dem Supabase Storage werden jetzt für versendete E-Mails (Einsatzberichte, Abrechnungen, Budeko-Berichte, Rohrservice-Berichte) auf die eigene Domain `data.alarmdesk-software.de` umgeschrieben. Steuerbar über die Umgebungsvariable `PUBLIC_STORAGE_URL`.
- **Budeko-Bericht-Versand**: Budeko-Berichte werden jetzt über die domänenspezifischen E-Mail-Einstellungen versendet – inklusive Branding, Absender-Name und BCC. Zuvor war der Versand auf die feste Adresse `notify.einsatz-bericht.de` eingestellt.

### Fixed

- Header-Label fällt nicht mehr automatisch auf den Standardtext zurück, wenn es bewusst geleert wird.

## [Unreleased]

### Added

- **Datum-Filter in Alarmierung**: Einsätze lassen sich jetzt zusätzlich nach einem Zeitraum (von/bis) filtern.
