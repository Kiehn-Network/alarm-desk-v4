# AlarmDesk lokal auf eigenem Server betreiben

Diese Anleitung beschreibt, wie du das Projekt auf einem eigenen Linux-Server startest und dabei die bestehende Supabase-Datenbank unter `https://vmqvnckdynrhrdgwkork.supabase.co` verwendest.

## Voraussetzungen

- Ubuntu 22.04 LTS / Debian 12 (empfohlen)
- Node.js 20+ und `npm` oder `bun`
- `git`
- Einen Supabase-Account mit Zugriff auf das Projekt `vmqvnckdynrhrdgwkork`, um die API-Schlüssel abzurufen

## 1. Server vorbereiten

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 installieren
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Bun installieren (alternativ geht auch npm)
sudo npm install -g bun

# Firewall
sudo ufw allow 22,80,443/tcp
sudo ufw enable
```

## 2. Projekt klonen

```bash
cd ~
git clone https://github.com/Kiehn-Network/alarm-desk-v4.git alarmdesk
cd alarmdesk
```

> Das Repository ist privat. Stelle sicher, dass dein Server-Zugriff (z.B. ein deploy key oder persönlicher SSH-Key) dafür berechtigt ist.


## 3. Umgebungsvariablen konfigurieren

Lege im Projektstamm eine `.env`-Datei an:

```bash
cat > .env <<'EOF'
# Verbindung zu deinem Supabase-Projekt
VITE_SUPABASE_PROJECT_ID="vmqvnckdynrhrdgwkork"
VITE_SUPABASE_URL="https://vmqvnckdynrhrdgwkork.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<Anon/Publishable Key aus deinem Supabase-Projekt>"

# Serverseitige Werte (gleiches Projekt)
SUPABASE_URL="https://vmqvnckdynrhrdgwkork.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<Anon/Publishable Key>"
SUPABASE_SERVICE_ROLE_KEY="<Service Role Key aus deinem Supabase-Projekt>"

# Optional: Lovable AI Gateway (nur nötig, wenn du Lovable-KI-Features nutzt)
LOVABLE_API_KEY=""
EOF
```

Wichtig:

- Den **Publishable/Anon Key** findest du in den API-Einstellungen deines Supabase-Projekts.
- Den **Service Role Key** benötigen serverseitige Admin-Operationen. Behandle diesen Schlüssel wie ein Passwort und gib ihn niemals an den Client weiter.

## 4. Abhängigkeiten installieren

```bash
bun install
# oder: npm install
```

## 5. Build erstellen

```bash
NODE_OPTIONS="--max-old-space-size=2048" bun run build
# oder: NODE_OPTIONS="--max-old-space-size=2048" npm run build
```

Der Build erzeugt ein **Cloudflare-Worker-Bundle** (Vite + `@cloudflare/vite-plugin`).
Das Ergebnis liegt unter `dist/` (bzw. `.output/`) und ist **kein Node.js-Server** —
es läuft nur in der Worker-Runtime (`workerd`). Deshalb kann der Build nicht mit
`node` oder `bun run` als klassischer Server gestartet werden.

> Typischer Fehler beim Versuch, das Bundle mit Node zu starten:
> `Could not resolve "cloudflare:sockets"` — kommt von `worker-mailer`, das
> ausschließlich in `workerd` läuft. Lösung: lokal mit **Wrangler** (workerd)
> ausführen, nicht mit Node.

## 6. App lokal starten

**Wichtig:** Die App benutzt TanStack Start mit virtuellen Modulen
(`#tanstack-router-entry`, `#tanstack-start-entry`, `tanstack-start-manifest:v`).
Diese werden **nur vom Vite-Plugin** aufgelöst. Wrangler direkt auf
`src/server.ts` zu starten schlägt deshalb mit
`Could not resolve "#tanstack-router-entry"` fehl.

Korrekter Ablauf: **immer über Vite starten** — entweder im Dev-Modus oder
nach `vite build` über das fertige Worker-Bundle.

### Variante A: Dev-Modus (nur zum Testen, NICHT für den Dauerbetrieb)

`@cloudflare/vite-plugin` führt SSR automatisch in `workerd` aus, sodass
`cloudflare:sockets` & Co. funktionieren. `.env` wird von Vite automatisch
geladen.

```bash
bun run dev -- --host 0.0.0.0 --port 8080
# oder: npm run dev -- --host 0.0.0.0 --port 8080
```

Die App ist unter `http://<SERVER-IP>:8080` erreichbar.

> **Wichtig:** Im Dev-Modus lädt der Browser jede Seite als einzelne
> Quelldatei nach (`/src/routes/....tsx?tsr-split=component`). Startet der
> Dev-Server neu oder ändert sich eine Datei, sind diese Adressen ungültig
> und es erscheint im Browser:
> `Failed to fetch dynamically imported module: .../admin.tsx?tsr-split=component`.
> Auch ein Reverse Proxy ohne WebSocket-Weiterleitung (HMR) verstärkt das.
> Für den echten Betrieb deshalb immer **Variante B** (Produktions-Bundle)
> verwenden. Als Sofort-Hilfe hilft ein Hard-Reload (Strg+Shift+R).

#### Dev-Modus stabil hinter Reverse Proxy betreiben

Wenn du den Dev-Modus dauerhaft nutzen willst, muss der Live-Reload-Kanal
(WebSocket) über deine Domain funktionieren — sonst merkt der Browser einen
Neustart nicht und meldet
`Failed to fetch dynamically imported module: ...?tsr-split=component`.

1. In der `.env` die öffentliche Adresse eintragen:

   ```
   PUBLIC_DEV_HOST=alarmdesk4.alarmzentrale-steinberg.de
   PUBLIC_DEV_PROTOCOL=ws     # bei HTTPS: wss
   PUBLIC_DEV_PORT=80         # bei HTTPS: 443
   ```

   Damit erlaubt Vite den Host und schickt den Live-Reload an die richtige
   Adresse.

2. Caddy leitet WebSockets automatisch weiter — wichtig ist nur, dass kein
   Caching/Buffering dazwischen liegt:

   ```
   alarmdesk4.alarmzentrale-steinberg.de {
       reverse_proxy localhost:8080 {
           flush_interval -1
       }
   }
   ```

3. Nach jedem Neustart des Dev-Servers im Browser einmal hart neu laden
   (Strg+Shift+R). Danach hält die Verbindung.

### Variante B: Produktions-Bundle (empfohlen für den Server)


1. Build erzeugen:

   ```bash
   NODE_OPTIONS="--max-old-space-size=2048" bun run build
   ls dist/
   ```

   Das Worker-Bundle landet typischerweise unter `dist/_worker.js/index.js`
   oder `dist/server/index.js` — den genauen Pfad mit `ls dist/` prüfen.

2. Mit Wrangler ausliefern (das **gebaute** Bundle, nicht `src/server.ts`):

   ```bash
   wrangler dev dist/_worker.js/index.js \
     --ip 0.0.0.0 --port 8080 \
     --compatibility-date 2025-09-24 \
     --compatibility-flags nodejs_compat
   ```

   Wrangler liest `.env` automatisch (sichtbar an
   `Using secrets defined in .env` im Startlog).

### Variante C: Als Dienst mit PM2

```bash
sudo npm install -g pm2 wrangler

# Produktions-Bundle dauerhaft laufen lassen (empfohlen)
NODE_OPTIONS="--max-old-space-size=2048" bun run build

pm2 start --name alarmdesk \
  --interpreter none \
  "$(which wrangler)" -- dev dist/_worker.js/index.js \
  --ip 0.0.0.0 --port 8080 \
  --compatibility-date 2025-09-24 \
  --compatibility-flags nodejs_compat

pm2 save
pm2 startup
```


### Hinweise zu `.env`

- Wrangler/Vite laden die `.env` **selbst**. Du brauchst kein
  `set -a; . ./.env; set +a` davorzusetzen.
- Bash bricht beim manuellen `source ./.env` mit
  `unexpected EOF while looking for matching '"'` ab, wenn ein Wert ein
  unmaskiertes Anführungszeichen enthält. Empfohlene Schreibweise pro Zeile:

  ```
  KEY=einfacher_wert_ohne_anführungszeichen
  KEY2="wert mit leerzeichen"
  KEY3='wert mit "anführungszeichen" innen'
  ```

  Mehrzeilige Werte (z.B. ganze PEM-Keys) gehören nicht in `.env`.

## 7. Reverse Proxy + TLS (Caddy)

Installiere Caddy:

```bash
sudo apt install -y caddy
```

Erstelle die Caddyfile:

```bash
sudo tee /etc/caddy/Caddyfile <<'EOF'
alarmdesk.deine-domain.de {
    reverse_proxy localhost:8080
}
EOF
```

Lade Caddy neu:

```bash
sudo systemctl reload caddy
```

Setze einen DNS-A-Record für `alarmdesk.deine-domain.de` auf die Server-IP. Caddy holt sich das Let's-Encrypt-Zertifikat automatisch.

## 8. CORS für externe Aufrufer

Falls dein ERP-Server oder AlarmDesk-Client von einer anderen Domain (z.B. `alarmdesk.alarmzentrale-steinberg.de`) auf die öffentlichen Endpunkte zugreift, sind die CORS-Header bereits in `src/lib/cors.ts` und den Routen unter `src/routes/api/public/` hinterlegt.

Falls du eine weitere Domain erlauben möchtest, ergänze sie in `src/lib/cors.ts` im Array `ALLOWED_ORIGINS` und führe anschließend einen neuen Build durch:

```bash
bun run build && pm2 restart alarmdesk
```

## 9. Datenbank-Migrationen

Wenn das Supabase-Projekt noch nicht das aktuelle Schema enthält, spiele die Migrationen ein:

```bash
supabase db push
```

> Dazu muss die Supabase CLI installiert und mit deinem Projekt verbunden sein.

## 10. Update nach neuen Änderungen

```bash
cd ~/alarmdesk
git pull origin main
bun install
supabase db push
NODE_OPTIONS="--max-old-space-size=2048" bun run build
pm2 restart alarmdesk
```

## Hinweise

- Die App nutzt weiterhin die **Supabase-Cloud-Datenbank**; du betreibst also nur das Frontend/Backend auf deinem Server, nicht die Datenbank selbst.
- Für Dateien (PDFs, Bilder) greift die App auf die Supabase-Storage-Buckets deines Projekts zu. Stelle sicher, dass die Buckets und RLS-Richtlinien im Projekt korrekt eingerichtet sind.
- Google-Login und andere OAuth-Provider müssen in deinem Supabase-Projekt konfiguriert werden, falls du sie nutzen möchtest.
- Lass den Server-Port (3000/8080) niemals ungeschützt öffentlich erreichbar; nutze immer einen Reverse Proxy mit TLS.
