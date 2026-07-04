# E-Mail-Branding pro Domäne

Jede Domäne kann im Admin-Bereich das Aussehen ihrer ausgehenden E-Mails selbst festlegen. Alle E-Mails (Einsatzbericht, Monatsabrechnung, Testmail) verwenden dann automatisch das Branding dieser Domäne.

## Was der Domänen-Admin einstellen kann

- **Logo** (Bild-Upload in den bereits vorhandenen `logos`-Bucket, öffentlich zugänglich für E-Mail-Clients)
- **Markenfarbe** (Farb-Picker, wird für Header-Kachel, CTA-Button und Akzente verwendet)
- **Header-Label** (kleine Zeile unter dem Firmennamen, z. B. „EINSATZVERWALTUNG“)
- **Absender-Name & -Adresse** (nutzt die bereits vorhandenen Felder `from_name` / `from_email`)
- **Begrüßung** (Vorlage mit Platzhalter `{{kunde}}`, Fallback wenn kein Kunde bekannt ist)
- **Signatur** (z. B. „Mit freundlichen Grüßen · Ihr AlarmDesk-Team“)
- **Fußtext** (mehrzeiliger Text unter der Trennlinie, z. B. Firmenanschrift, Impressum-Kurzform)

Sinnvolle Defaults, damit ohne Konfiguration weiterhin das aktuelle AlarmDesk-Design gerendert wird.

## Live-Vorschau

Im Panel wird rechts eine Live-Vorschau der Bericht-E-Mail gezeigt, die sich beim Tippen sofort aktualisiert — so sieht der Admin genau, was der Kunde erhalten wird, ohne eine Testmail zu senden.

Zusätzlich bleibt der bestehende „Testmail senden“-Knopf: verschickt jetzt eine gebrandete Beispiel-E-Mail an eine beliebige Adresse.

## Wo im UI

Im Admin-Bereich unter dem Tab **E-Mail** entsteht ein neuer Bereich **„E-Mail-Design & Branding“** unterhalb der bestehenden Versand-Einstellungen. Nur Domänen-Admins (und Superadmins) sehen und bearbeiten ihn.

## Welche E-Mails werden gebrandet

Alle vom System an Kunden versendeten transaktionalen E-Mails:

- Einsatzbericht (mit PDF-Download-Link)
- Monats-Abrechnung Hausnotruf (mit PDF-Download-Link)
- Testmail (Vorschau des Brandings)

Auth-E-Mails (Login, Passwort-Reset …) sind ausdrücklich nicht Teil dieses Schritts.

## Technische Umsetzung

Nur zur Referenz.

- **Schema**: neue Spalten in `domain_email_settings` — `brand_logo_url`, `brand_primary_color`, `brand_header_label`, `brand_greeting`, `brand_signature`, `brand_footer_html`. Alle optional mit sinnvollen Defaults im Renderer.
- **Neue Server-Fns** in `src/lib/email-settings.functions.ts`: `getDomainEmailBranding`, `upsertDomainEmailBranding` (beide gated per `assertDomainAdmin`).
- **Neuer gemeinsamer Renderer** `src/lib/email-brand.ts` (pure, browserfähig für Live-Preview) mit Funktion `renderBrandedEmail({ branding, heading, intro, metaTitle, metaSubtitle, ctaLabel, ctaUrl, greetingName, signature, footerHint })`. Kapselt das gesamte HTML-Shell inkl. Header (Logo/Farbe), Card, Info-Panel, Gradient-CTA und Footer.
- **Neuer Server-Helper** `src/lib/email-brand.server.ts`: `loadDomainBranding(domainId)` — liest `domain_email_settings` mit `supabaseAdmin` und liefert ein normalisiertes Branding-Objekt.
- **Refactor** `src/lib/bericht-email.functions.ts` und `src/lib/abrechnung.functions.ts`: laden Branding, rufen `renderBrandedEmail(...)` auf — kein Inline-HTML mehr.
- **Refactor Testmail** in `email-settings.functions.ts`: nutzt ebenfalls den gemeinsamen Renderer.
- **UI**: neue Komponente `src/components/admin/email-branding-panel.tsx` mit Formfeldern, Logo-Upload in `logos`-Bucket (Pfad `email-branding/{domain_id}/logo-{ts}.{ext}`), Farb-Picker (native `<input type="color">`), Textarea für Fußtext, plus Live-Preview via `dangerouslySetInnerHTML` aus `renderBrandedEmail(...)`. Panel wird in `src/routes/_authenticated/admin.tsx` im `email`-Tab unter dem bestehenden Panel eingefügt.
- **Rechte**: Bearbeitung nur für Domänen-Admins der eigenen Domäne (bestehendes `assertDomainAdmin`). Superadmins können via Impersonation bearbeiten (bereits durch `requireEffectiveDomainId` abgedeckt).

Nach Freigabe implementiere ich das direkt.
