# Interventions-Modul

Ermöglicht es, einen Einsatz an einen externen **Interventionspartner** (eigene AlarmDesk-Domain) zu übergeben. Beide Seiten sehen den Einsatz und arbeiten parallel daran.

## Datenmodell (Migration)

**`app_modules`-Eintrag**: `key='intervention'`, `name='Intervention'`.

**`intervention_partners`** (vom Admin gepflegte Partner-Liste pro Domain)
- `id`, `domain_id` (FK domains, der Besitzer der Liste), `partner_domain_id` (FK domains, das Ziel), `display_name` (Anzeige im Dialog), `kontakt_email`, `kontakt_telefon`, `notiz`, `aktiv` (bool), `created_at`, `updated_at`.
- UNIQUE `(domain_id, partner_domain_id)`.
- RLS: SELECT/INSERT/UPDATE/DELETE nur Domain-Admin der `domain_id` oder Superadmin.

**`einsatz_partner_shares`** (Verknüpfung „Einsatz X wurde an Partner Y geteilt")
- `id`, `einsatz_id` (FK einsaetze), `owner_domain_id` (der Sender), `partner_domain_id` (der Empfänger), `status` enum `offen|angenommen|in_bearbeitung|abgeschlossen|abgelehnt`, `partner_assigned_to` (FK auth.users, Fahrer des Partners), `partner_notiz`, `created_by`, `created_at`, `updated_at`.
- UNIQUE `(einsatz_id, partner_domain_id)`.
- Index `(partner_domain_id, status)` für Dashboard-Query des Partners.
- RLS: SELECT/UPDATE wenn `current_effective_domain_id() IN (owner_domain_id, partner_domain_id)`. INSERT nur Admin/Dispatcher der `owner_domain_id`.

**`einsaetze` erweitern**: keine Schema-Änderung. Sichtbarkeit für Partner via zusätzlicher RLS-Policy auf `einsaetze`:
```
USING (
  current_effective_domain_id() = domain_id  -- bisherige Regel
  OR EXISTS (
    SELECT 1 FROM einsatz_partner_shares s
    WHERE s.einsatz_id = einsaetze.id
      AND s.partner_domain_id = current_effective_domain_id()
  )
)
```
Analog für `einsatz_historie` und `dateien`-Verknüpfung (über `datei_verknuepfungen`), damit der Partner Bericht/Anhänge sieht. UPDATE auf `einsaetze` bleibt auf `owner_domain_id` beschränkt — Partner schreibt nur in `einsatz_partner_shares` (`partner_assigned_to`, `status`, `partner_notiz`) und in eigene Felder wie `vor_ort_am`/`abfahrt_am` über Server-Fn (siehe unten).

## Server-Funktionen — `src/lib/intervention.functions.ts`

- `listMyPartners()` — Partner der eigenen Domain (für Dialog beim Einsatz-Erstellen).
- `listAvailablePartnerDomains()` — Admin-only; alle Domains außer eigener, für Auswahl beim Anlegen eines Partners.
- `upsertPartner({ id?, partner_domain_id, display_name, kontakt_email?, kontakt_telefon?, notiz?, aktiv })` — Admin-only.
- `deletePartner({ id })` — Admin-only.
- `shareEinsatzWithPartner({ einsatz_id, partner_id })` — Admin/Dispatcher; legt `einsatz_partner_shares` an, schreibt `einsatz_historie`-Eintrag.
- `unshareEinsatz({ share_id })` — Admin/Dispatcher der Owner-Domain; entfernt Share.
- `partnerAcceptEinsatz({ share_id })` / `partnerDeclineEinsatz({ share_id, grund? })` — Partner-Admin/Dispatcher.
- `partnerAssignFahrer({ share_id, fahrer_id })` — setzt `partner_assigned_to`, Status `in_bearbeitung`.
- `listSharedToMe()` — Einsätze, die meiner Domain als Partner geteilt wurden (für Partner-Dashboard).
- `listSharesForEinsatz({ einsatz_id })` — Status pro Share (für Owner-Sicht / Status-Lampe).

## UI

**1) Admin-Seite — `src/routes/_authenticated/intervention.tsx`** (Admin/Superadmin):
- Tabelle der Interventionspartner mit Spalten Name, Partner-Domain, Kontakt, Aktiv.
- Dialog „Partner hinzufügen": Combobox aller anderen Domains (`listAvailablePartnerDomains`) + Anzeige-Name, Kontaktdaten, Notiz.
- Bearbeiten / Aktivieren-Toggle / Löschen.

**2) Sidebar-Eintrag** „Intervention" unter Center, sichtbar wenn Modul `intervention` für Domain aktiv ist.

**3) Einsatz-Erstellen** — `src/routes/_authenticated/einsatz-erstellen.tsx`:
- Im Fahrer-Auswahl-Bereich neuer Tab/Toggle „Eigene Fahrer" ↔ „Partner".
- „Partner": Liste aus `listMyPartners()` (nur aktive). Auswahl speichert nach Einsatz-Create direkt `shareEinsatzWithPartner`. `assigned_to` bleibt leer beim Owner.
- Nur sichtbar wenn Modul aktiv.

**4) Owner-Sicht im Einsatz**:
- In Einsatz-Liste (Dashboard / Meine Einsätze): kleine Komponente `<PartnerShareBadge einsatzId />` zeigt „Partner: <Name> · <Status>".
- Im Bericht-Dialog: Sektion mit Partner-Status + zugewiesenem Partner-Fahrer (read-only).

**5) Partner-Dashboard** — Erweiterung `src/routes/_authenticated/dashboard.tsx`:
- Neue Section „Von Partnern erhaltene Einsätze" — Query `listSharedToMe()` (nur wenn Modul aktiv).
- Pro Eintrag: Annehmen/Ablehnen-Buttons; nach Annahme „Fahrer zuweisen"-Combobox (`partnerAssignFahrer`).
- Angenommene Einsätze landen zusätzlich in „Meine Einsätze" des zugewiesenen Fahrers (über erweiterte RLS-Sicht + Filter auf `partner_assigned_to`).

**6) Fahrer-Sicht (Partner)**:
- In `meine-einsaetze.tsx` Query erweitern: Einsätze, bei denen entweder `assigned_to = me` ODER ein `einsatz_partner_shares.partner_assigned_to = me`. Beide Seiten sehen Vor-Ort-/Abfahrt-/Ende-Zeiten in Echtzeit (Realtime auf `einsaetze` ist bereits aktiv).

## Berechtigungs-Detail

- Partner-Fahrer schreibt `abfahrt_am`/`vor_ort_am`/`einsatz_ende_am` über bestehende Server-Fn → diese muss erweitert werden, sodass auch der zugewiesene Partner-Fahrer schreiben darf (Check: existiert Share mit `partner_assigned_to = userId`).
- Bericht-Schreiben (Owner-only) bleibt beim Owner. Diskussion: oder darf Partner-Fahrer den Bericht schreiben? **Default: Partner-Fahrer schreibt den Bericht**, Owner sieht ihn nur (typischer Fall: Partner fährt tatsächlich raus). → Update-Policy auf `einsaetze` für Bericht-Felder analog erweitern.

## Schritte

1. Migration: `app_modules`-Eintrag, Tabellen `intervention_partners`, `einsatz_partner_shares`, RLS-Policies, Erweiterung der `einsaetze`-Policies.
2. Server-Funktionen + Erweiterung bestehender Einsatz-Update-Fns für Partner-Fahrer.
3. Admin-Route + Sidebar-Eintrag.
4. Einsatz-Erstellen-Dialog: Partner-Tab.
5. Partner-Dashboard-Section + `meine-einsaetze` erweitern.
6. PartnerShareBadge in Listen.

## Offene Fragen

- **Bericht**: Soll der Partner-Fahrer den Bericht schreiben (Default oben) oder nur der Owner?
- **Sichtbarkeit Kunde**: Sieht der Partner die vollen Kundendaten (Adresse/Telefon)? Default: ja, sonst kann er nicht hinfahren.
- **Abrechnung**: Soll der geteilte Einsatz beim Partner in seiner Abrechnung auftauchen, oder nur beim Owner? Default: nur Owner.

Soll ich diese Defaults so umsetzen oder anpassen?
