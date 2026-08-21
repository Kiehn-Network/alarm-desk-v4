INSERT INTO public.app_versions (version, changelog, released_at)
VALUES (
  '4.0.21',
  'Einsätze nachträglich als storniert markierbar (mit Grund, Zeitpunkt und Benutzer); Startzeit (Erstellzeitpunkt) im Einsatz-Bearbeiten editierbar inkl. Historien-Eintrag; Schlüsselbuch: Zwangsrücknahme sowie manuelles Aus-/Einbuchen durch die Zentrale mit Namens- und Begründungspflicht; Homepage auf hellen Light-Mode umgestellt; Lutz PisaWeb-Link auf desktop.pisa.lutz-aufzuege.de aktualisiert; Passwort-Mindestlänge auf 4 Zeichen gesenkt; Einführung/Tour komplett ausgeblendet.',
  now() - interval '1 minute'
), (
  '4.0.22',
  'Stempelzeiten für Fahrer: 2-Sekunden-Halten ersetzt durch einfachen Klick, gesetzte Zeiten lassen sich nachträglich korrigieren; ERP-Übertragung: Zeitstempel werden nicht mehr fälschlich auf den Zuweisungszeitpunkt hochgeklemmt (keine 0-Minuten-Einsätze mehr); einsatzDatum entspricht jetzt exakt beginnBrutto in Europa/Berlin-Ortszeit mit korrektem Offset.',
  now()
);

UPDATE public.platform_settings
SET current_version = '4.0.22',
    updated_at = now()
WHERE id = 1;