INSERT INTO public.app_versions (version, changelog, released_at)
VALUES (
  '4.0.19',
  'Login-Splash mit Blur-Effekt; Pflicht-Einführung mit Demo-Modus; geführter Testlauf Schlüsselbuch; Lutz PisaWeb-Untermenü; Echtzeit-Updates für Fahrer und Zentrale; Admin-Verwaltung für Einführungs-Status und Fahrer-Auswahl; Datum-Filter in Alarmierung.',
  now()
);

UPDATE public.platform_settings
SET current_version = '4.0.19',
    updated_at = now()
WHERE id = 1;
