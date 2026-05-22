
# ESRP-Modul (ERP-Anbindung)

## Datenmodell (Migration)

**`erp_settings`** (pro Domain, Admin-only)
- `domain_id` (PK), `api_base`, `api_user`, `api_token`, `endpoint_path` (Default `/azs-av-einsaetze`), `use_api_prefix` (bool), `aktiv` (bool), `auto_on_abschluss` (bool, Default true).
- RLS: SELECT für eigene Domain (alle), INSERT/UPDATE nur Domain-Admin oder Superadmin. Token wird in Server-Fns nur an Admins zurückgegeben (bzw. maskiert für andere).

**`erp_outbox`**
- `id`, `domain_id`, `einsatz_id` (FK), `external_id` (z.B. `AD-{bericht_nr}`), `payload` (jsonb), `status` enum `pending|sent|failed`, `tries` int, `last_error` text, `next_retry_at`, `sent_at`, `created_by`, `created_at`, `updated_at`.
- Index auf `(domain_id, einsatz_id)`, `(status, next_retry_at)`.
- RLS: SELECT eigene Domain; INSERT/UPDATE/DELETE Admin+Dispatcher.

**App-Modul registrieren**: `app_modules` Eintrag `key='esrp'`, `name='ESRP'`.

## Server-Funktionen — `src/lib/esrp.functions.ts`

- `getEsrpSettings()` — gibt Settings zurück; Token nur an Admin/Superadmin, sonst maskiert (`••••`).
- `updateEsrpSettings({ api_base, api_user, api_token?, endpoint_path, use_api_prefix, aktiv, auto_on_abschluss })` — Admin-only, Zod-validiert.
- `enqueueEinsatzToErp({ einsatz_id })` — lädt Einsatz, baut Payload, INSERT in `erp_outbox` (Status `pending`), ruft direkt `processOutboxItem` auf.
- `processOutboxItem({ outbox_id })` — interner Worker: Holt Settings, führt `POST /login` aus, cached JWT in DB-Spalte oder pro Aufruf neu, POST an `endpoint`. Bei 200/201/409 → `sent`. Sonst `failed` mit `next_retry_at = now()+1min` (Retry-Backoff wie PHP).
- `retryOutbox({ outbox_id })` — Admin/Dispatcher; setzt `next_retry_at=now()` und ruft `processOutboxItem` auf.
- `listOutboxStatusForEinsaetze({ einsatz_ids })` — gibt letzten Status pro Einsatz zurück (für Lampen).

**Payload-Default** (kann später erweitert werden):
```
{ einsatz_id: "AD-{bericht_nr}", kunden_name, address, key_number,
  anlagen_nr, teilnehmer_id, einsatzgrund, beschreibung,
  geplant_am, vor_ort_am, abfahrt_am, abgeschlossen_am,
  bericht_data }
```

## Auto-Versand bei Abschluss

In `src/lib/einsaetze.functions.ts` an der Stelle, wo `status` auf `abgeschlossen` gesetzt wird: prüfen ob `erp_settings.aktiv && auto_on_abschluss` → `enqueueEinsatzToErp` (best-effort, Fehler nicht propagieren).

## Cron-Worker

`src/routes/api/public/hooks/esrp-worker.ts` — POST, holt bis zu 20 Outbox-Jobs (`pending` oder `failed` mit fälligem Retry), ruft pro Job `processOutboxItem` über `supabaseAdmin`. pg_cron Job alle 1 Minute.

## UI

**Admin-Einstellungsseite** — `src/routes/_authenticated/esrp.tsx` (Admin/Superadmin):
- Konfigurations-Card: API_BASE, API_USER, API_TOKEN, Endpoint, Auto-Versand bei Abschluss, Aktiv-Switch.
- Outbox-Tabelle: letzte 50 Jobs mit Status, Fehlermeldung, Retry-Button, Payload-Preview.
- Sidebar-Eintrag „ESRP" unter Center, sichtbar wenn Modul `esrp` für Domain aktiv ist.

**Bericht-Versand-Dialog** — `src/components/bericht-send-dialog.tsx`:
- Radio/Checkboxen: `Nur PDF`, `Nur ERP`, `PDF + ERP` (ERP-Optionen nur wenn ESRP aktiv).
- Bei ERP-Versand → `enqueueEinsatzToErp`, Erfolg/Fehler-Toast.

**Status-Lampe** — kleine Komponente `<EsrpStatusLamp einsatzId=… />` (grün=sent, orange=pending, rot=failed, grau=none). Eingebunden in Einsatz-Listen (Dashboard/Meine Einsätze) per `listOutboxStatusForEinsaetze` Batch-Query.

## Sicherheit

- Token verschlüsselt? Vorerst als Plaintext in DB (Lovable-Cloud Standard); RLS schützt vor anderen Domänen; SELECT der Token-Spalte in Server-Fn nur an Admins.
- Cron-Endpunkt unter `/api/public/hooks/` — keine sensiblen Daten, idempotent durch Outbox-IDs.

## Schritte

1. Migration (Tabellen, Enums, RLS, app_modules-Eintrag).
2. Server-Fns + Auto-Hook in `einsaetze.functions.ts`.
3. Cron-Route + pg_cron-Insert.
4. Sidebar + Admin-Route + Outbox-UI.
5. Bericht-Send-Dialog erweitern + Status-Lampe.

Soll ich starten?
