INSERT INTO public.app_versions (version, changelog, released_at)
VALUES (
  '4.0.20',
  'Chat-System erweitert (Allgemein-Kanal, rollen-geschützter Zentrale-Kanal, private DMs, Ungelesen-Badges, Push-/Sound-Benachrichtigungen); Benutzer-Export als CSV für Domänen-Admins nach Rolle; ESRP Payload-Preview mit JSON- und PDF-Metadaten; Homepage-Redesign (Enterprise Indigo, Sora/Manrope); ESRP aenderPersonalNr-Default 999 statt 0; ESRP Zeitangaben in Europa/Berlin-Ortszeit mit korrektem Offset statt UTC; kompakteres responsives Versions-Badge im Login-Footer.',
  now()
);

UPDATE public.platform_settings
SET current_version = '4.0.20',
    updated_at = now()
WHERE id = 1;