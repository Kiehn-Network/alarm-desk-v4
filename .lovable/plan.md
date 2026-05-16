## Ziel

Bestehende Single-Tenant App in eine **Multi-Tenant-Plattform** umbauen. Jede „Alarmzentrale" ist eine eigene **Domain (Mandant)**. Daten sind strikt isoliert — durchgesetzt per Row Level Security (RLS) in der Datenbank, nicht nur im Frontend.

---

## 1. Rollenmodell

Neuer Enum `app_role`: `superadmin`, `admin`, `user`
(ersetzt das aktuelle `admin / dispatcher / fahrer` Schema — siehe Migration unten)

| Rolle | Scope | Rechte |
|---|---|---|
| **SuperAdmin** | global, gehört zu keiner Domain | Domains/Lizenzen/Module CRUD, Impersonation, sieht alles |
| **Domain-Admin** | genau 1 Domain | User & Daten der eigenen Domain verwalten, eigene Module/Lizenz sehen |
| **User** | genau 1 Domain | nur lesen/arbeiten innerhalb der eigenen Domain |

---

## 2. Datenmodell (neue/geänderte Tabellen)

**Neu:**
- `domains` — `id, slug, name, status (active/disabled), created_at`
- `licenses` — `id, domain_id, key, valid_from, valid_until, status, max_users`
- `domain_modules` — `domain_id, module_key, enabled` (ersetzt globales `app_modules.enabled`)
- `profiles.domain_id` (uuid, nullable nur für SuperAdmin)
- `user_roles.domain_id` (uuid, nullable für SuperAdmin)

**Erweitert um `domain_id NOT NULL`:**
`einsaetze, einsatz_gruende, dateien, datei_historie, datei_verknuepfungen, einsatz_historie, einsatz_email_log, app_settings (pro Domain), app_modules`

**Bestehendes `app_modules`** wird zum globalen Modul-Katalog (verfügbare Module); die pro-Domain Aktivierung wandert in `domain_modules`.

---

## 3. Security (RLS)

Neue SECURITY DEFINER Funktionen:
- `current_domain_id()` → liest `profiles.domain_id` des eingeloggten Users
- `is_superadmin()` → `has_role(auth.uid(), 'superadmin')`
- `is_domain_admin(_domain uuid)` → admin der angegebenen Domain
- `current_effective_domain_id()` → respektiert Impersonation (JWT claim oder Session-Tabelle `superadmin_impersonation`)

**RLS-Schema pro Tabelle:**
```
SELECT: is_superadmin() OR domain_id = current_effective_domain_id()
INSERT/UPDATE/DELETE: is_superadmin() OR (is_domain_admin(domain_id) AND ...)
```
User dürfen je nach Tabelle Daten lesen/teilweise erstellen; nur Admins mutieren Stammdaten.

`domains`, `licenses`, `domain_modules`: nur SuperAdmin schreibt; Admin/User lesen nur die eigene Zeile.

---

## 4. Impersonation

Tabelle `superadmin_impersonation (superadmin_id, target_domain_id, started_at)`.
`current_effective_domain_id()` prüft erst Impersonation, fällt sonst auf eigene `domain_id` zurück.
ServerFn `startImpersonation(domainId)` / `stopImpersonation()` — nur für SuperAdmins.
Banner „Du arbeitest als Domain X" im UI.

---

## 5. Onboarding-Flow

- Beim Signup: User bekommt **keine Domain & keine Rolle**. SuperAdmin muss zuweisen.
- Migration des ersten existierenden Users → `superadmin`.
- Bestehende Daten werden einer initialen Default-Domain zugeordnet.

---

## 6. UI

**Neue Routen:**
- `/_authenticated/superadmin` — Domains, Lizenzen, Module, User-Zuweisung, Impersonation
- `/_authenticated/admin` (bestehend, refactored) — nur eigene Domain
- Layout-Guard: `superadmin` Routen prüfen Rolle via `beforeLoad`

**SuperAdmin-Dashboard Tabs:**
1. Domains (Liste, anlegen, deaktivieren)
2. Lizenzen (generieren, zuordnen, widerrufen)
3. Module pro Domain (Toggle-Matrix)
4. User (alle Domains, Rolle/Domain ändern)
5. Impersonation-Button pro Domain

**Domain-Admin Dashboard** (Refactor des bestehenden `/admin`):
- Eigene Domain-Info + Lizenzstatus-Karte
- User der Domain verwalten
- Aktive Module anzeigen (read-only — Aktivierung macht SuperAdmin)
- Einsätze & Einstellungen (wie bisher, aber gefiltert)

---

## 7. Server Functions

Neu in `src/lib/`:
- `domains.functions.ts` — list/create/update/disable
- `licenses.functions.ts` — generate/revoke/list
- `domain-modules.functions.ts` — toggle
- `impersonation.functions.ts` — start/stop
- `tenant-users.functions.ts` — assign user to domain, change role

Alle nutzen `requireSupabaseAuth` + interne Rollencheck.

---

## 8. Migration Strategie

1. **Migration 1**: neuer Enum, neue Tabellen (`domains`, `licenses`, `domain_modules`, `superadmin_impersonation`)
2. **Migration 2**: `domain_id` Spalten zu allen relevanten Tabellen (zunächst nullable)
3. **Migration 3**: Default-Domain anlegen, alle existierenden Rows damit befüllen, ersten User → superadmin, alle anderen → admin der Default-Domain
4. **Migration 4**: `domain_id NOT NULL` setzen, alte RLS-Policies droppen, neue RLS-Policies erstellen, neue Helper-Funktionen
5. **Code-Refactor**: serverFns + UI in einem zweiten Schritt

---

## 9. Was bleibt unverändert

- Auth-System (Email/Password + Google)
- E-Mail-Infrastruktur (queue läuft weiter, bekommt `domain_id`)
- Storage-Buckets bleiben, Pfade kriegen `domain_id/...` Präfix bei neuen Uploads
- Bestehende Einsatz-/Datei-Funktionalität (nur scoped)

---

## Reihenfolge der Umsetzung

1. **DB-Migration** (Schritt 8.1 – 8.4) — eine zusammenhängende Migration, dann zur Freigabe vorlegen
2. Helper-Hooks (`useCurrentDomain`, `useIsSuperAdmin`)
3. SuperAdmin-Dashboard
4. Domain-Admin-Dashboard Refactor
5. Impersonation-Banner + Logik
6. Bestehende ServerFns auf `domain_id` Scoping prüfen

---

## Offene Punkte (Annahmen, falls nicht widersprochen)

- **Lizenzschlüssel-Format:** zufälliger 24-Zeichen Key (`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`), Validierung über Ablaufdatum + Status. Keine Online-Aktivierung.
- **Was passiert bei abgelaufener Lizenz?** → Domain wird read-only (kein Insert/Update auf `einsaetze`), Admin sieht Warnung.
- **Self-Service Signup?** → Nein, nur SuperAdmin legt User an (oder Domain-Admin innerhalb seiner Domain).
- **Default-Domain für Bestandsdaten** heißt „AlarmDesk" (slug `default`).

Wenn das passt, starte ich mit der Migration.
