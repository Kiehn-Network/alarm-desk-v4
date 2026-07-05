# Pflicht-Einführung + Geführte Testläufe + Onboarding-Splash

## Ziel

Neue Nutzer werden nach dem ersten Login zwingend durch die interaktive Einführung geleitet. Während dieser Einführung sehen sie ausschließlich **Demo-Daten**; ihre echten Daten werden erst nach Abschluss sichtbar. Jeder relevante Bereich (Schlüsselbuch, Notdienst, Einsätze, Dateien, …) bekommt einen „Geführter Testlauf"-Button, so wie er heute nur im Schlüsselbuch existiert. Am Ende der Einführung – **nur beim allerersten Mal** – erscheint ein Windows-artiger Vollbild-Splash („Wir bereiten alles vor, bitte einen Moment…"), bevor der Nutzer im echten Dashboard landet.

## Verhalten aus Nutzersicht

1. **Erster Login** → Einführungs-Dialog öffnet sich automatisch und lässt sich **nicht** schließen (kein ESC, kein X, kein Klick außerhalb). Ein Hinweis-Banner oben in der App erklärt: „Bitte schließen Sie zuerst die Einführung ab."
2. Solange die Einführung läuft, wird in allen Listen (Schlüsselbuch, Notdienst-Berichte, Einsätze, Dateien, Dienstpläne, Chat, …) ein **Demo-Modus** aktiviert: nur die `[DEMO]`-Einträge sind sichtbar, echte Daten sind ausgeblendet. Oben in der App zeigt ein deutlich sichtbares Band: „Demo-Modus aktiv – Sie klicken sich gerade durch Beispiel-Daten."
3. In jedem Schritt der Einführung gibt es einen **„Geführter Testlauf"**-Button, der den passenden Bereich mit Demo-Daten befüllt und den Spotlight-Rundgang startet (Bewegungshistorie öffnen, Status setzen, Bericht anlegen, Notdienst zuweisen usw.). Der Fertig-Knopf des Einführungs-Schrittes wird erst freigegeben, wenn der Testlauf einmal komplett durchgespielt wurde.
4. Nach dem letzten Schritt kommt der **Vollbild-Splash**: „Wir bereiten nun alles für Sie vor. Bitte einen Moment – wir laden Ihre Firmen-Daten." mit Fortschrittsbalken (~4–6 s). Im Hintergrund werden dabei alle Demo-Daten aufgeräumt und die echten Daten sichtbar geschaltet.
5. Ab jetzt: normale App mit echten Daten. Der Testlauf-Button bleibt in jedem Bereich als jederzeit nutzbare Auffrischung erhalten.

## Was gebaut wird

### Backend (Migration + Server-Funktionen)

- **Spalten in `profiles`**: `onboarding_completed_at timestamptz`, `onboarding_demo_mode boolean default false`.
  Solange `onboarding_demo_mode = true`, filtern Listen echte Daten aus und zeigen nur `[DEMO]`-Einträge.
- **Demo-Seeder pro Bereich** (Server-Funktionen, Admin-only bzw. self-service innerhalb der eigenen Domain):
  `seedSchluesselDemo` (existiert), neu: `seedEinsatzDemo`, `seedRohrserviceDemo`, `seedBudekoDemo`, `seedDateienDemo`, `seedDienstplanDemo`, `seedChatDemo`.
  Alle setzen ein `[DEMO]`-Präfix / Marker-Feld, damit sie klar identifizierbar sind.
- **`cleanupAllDemo`**: löscht domain-weit alle `[DEMO]`-Einträge in einem Aufruf, wird am Ende des Splashs aufgerufen.
- **`setOnboardingState`**: schaltet `onboarding_demo_mode` und `onboarding_completed_at`.
- Bestehende `list*`-Server-Funktionen bekommen einen Zusatz-Filter: wenn `profiles.onboarding_demo_mode = true`, dann nur Zeilen mit `[DEMO]`-Marker zurückgeben (bzw. umgekehrt im Normalbetrieb: `[DEMO]`-Zeilen ausblenden, damit übrig gebliebene Demo-Reste die reale Ansicht nicht verschmutzen).

### Frontend

- **`TourDialog`**: nicht mehr schließbar solange `onboarding_completed_at IS NULL`. Jeder Schritt bekommt neben „Interaktiv ausprobieren" verpflichtend einen „Geführter Testlauf starten"-Button; erst wenn der Testlauf einmal als „erledigt" markiert ist (Ende-Callback aus `driver.js`), wird „Weiter" aktiv.
- **`DemoModeBanner`**: neuer Balken ganz oben (unter der Topbar) mit Icon + Text „Demo-Modus – nur Beispiel-Daten sichtbar". Nur wenn `onboarding_demo_mode = true`.
- **Testlauf-Buttons überall**: an jeder Bereichs-Startseite (`schluesselbuch`, `notdienst/rohrservice`, `notdienst/budeko`, `einsaetze`, `dateien`, `dienstplaene`, `chat`) analog zum bestehenden Schlüsselbuch-Testlauf ein einheitlicher „Geführter Testlauf"-Button plus „Demo aufräumen"-Button, wenn Demo-Daten existieren.
- **`OnboardingSplash`**: Vollbild-Overlay (blaugrauer Hintergrund, Logo, Spinner, Fortschrittsbalken 0–100 %, Statuszeilen „Firmen-Stammdaten werden geladen…", „Berechtigungen werden geprüft…", „Bereiche werden vorbereitet…"). Läuft mind. 3 s, ruft im Hintergrund `cleanupAllDemo` + `setOnboardingState({demo:false, completed:now()})`, invalidiert alle Queries, blendet sich dann aus.
- **Route-Guard im `_authenticated`-Layout**: wenn `onboarding_completed_at IS NULL`, wird der `TourDialog` erzwungen geöffnet und der Splash nach Abschluss angezeigt.

## Technische Details

- Neuer Hook `useOnboardingStatus()` liest `profiles.onboarding_completed_at` + `onboarding_demo_mode`, cached via TanStack Query.
- `WALKTHROUGHS` in `src/lib/walkthroughs.ts` wird um Demo-Rundgänge für jeden Bereich ergänzt (`einsaetze-demo`, `rohrservice-demo`, `budeko-demo`, `dateien-demo`, `dienstplaene-demo`, `chat-demo`) analog zum bestehenden `schluesselbuch-demo`.
- Migration: Spalten hinzufügen + Backfill (`onboarding_completed_at = now()` für alle bereits existierenden Nutzer, damit sie den Splash nicht sehen).
- Listen-Filter passiert in bestehenden `list*`-Handlern über einen kleinen Helper `applyDemoFilter(supabase, userId, query, markerColumn)`.
- Alle Demo-Marker: `[DEMO]` im primären Text-Feld (Name/Titel) und/oder ein neues `is_demo boolean default false` je Tabelle (sauberer, wird bevorzugt).

## Reihenfolge der Umsetzung

1. Migration: `profiles.onboarding_*` + `is_demo` auf allen relevanten Tabellen (`schluessel_buch`, `einsaetze`, `rohrservice_berichte`, `budeko_berichte`, `dateien`, `dienstplaene`, `chat_conversations`).
2. Server-Funktionen: alle `seed*Demo`, `cleanupAllDemo`, `setOnboardingState`; Listen-Filter erweitern.
3. Frontend: `useOnboardingStatus`, `DemoModeBanner`, `OnboardingSplash`, `TourDialog` hart gaten, Testlauf-Buttons in allen Bereichen ausrollen.
4. Walkthroughs pro Bereich definieren.

## Offene Punkte

- **Umfang der Testläufe pro Bereich**: heute ist nur der Schlüsselbuch-Testlauf ausformuliert (5 Schritte). Soll ich für jeden weiteren Bereich einen vergleichbar ausführlichen 4–6-Schritte-Rundgang bauen, oder reicht dir jeweils ein kürzerer 2–3-Schritte-Rundgang, um Zeit zu sparen?
- **Splash-Dauer**: fix 5 s oder erst weiterschalten, wenn die echten Daten wirklich geladen sind (kann bei großen Domains länger dauern)?
- **Bestehende Nutzer**: sollen die den neuen Ablauf ebenfalls einmal durchlaufen, oder wirklich nur echte Neuanmeldungen? Standard oben ist „nur Neuanmeldungen".
