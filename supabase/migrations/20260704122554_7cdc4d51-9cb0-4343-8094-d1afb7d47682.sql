
INSERT INTO public.app_versions (version, changelog, released_at)
VALUES (
  '4.0.16',
  E'### Neu\n- E-Mail-Branding pro Domäne: eigenes Logo, Markenfarbe, Begrüßung, Signatur, Fußtext und Absender-Name je Domäne.\n- E-Mail-Themes: vorgefertigte Design-Presets als Startpunkt.\n- E-Mail-Layouts: vier Varianten (Card, Banner, Minimal, Sidebar).\n- Live-Vorschau der E-Mail direkt im Admin-Panel.\n\n### Geändert\n- Header-Label unter dem Firmennamen ist jetzt optional.\n- PDF-Download-Links in versendeten E-Mails (Einsatzberichte, Abrechnungen, Budeko, Rohrservice) laufen jetzt über die eigene Domain data.alarmdesk-software.de.\n\n### Behoben\n- Header-Label fällt nicht mehr automatisch auf den Standardtext zurück, wenn es bewusst geleert wird.',
  now()
);

UPDATE public.platform_settings SET current_version = '4.0.16' WHERE id = 1;
