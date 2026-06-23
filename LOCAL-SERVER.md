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

## 6. App lokal starten (Wrangler / workerd)

Da die App ein Cloudflare Worker ist, brauchst du `wrangler`, um sie lokal
laufen zu lassen. Wrangler startet `workerd` (die Worker-Runtime) auf deinem
Server, sodass alle Worker-only-APIs (`cloudflare:sockets`, etc.) funktionieren.

### Wrangler installieren

```bash
sudo npm install -g wrangler
```

### Variante A: Dev-Modus (zum Testen)

```bash
# .env wird automatisch geladen (--env-file)
wrangler dev --ip 0.0.0.0 --port 8080
```

Die App ist unter `http://<SERVER-IP>:8080` erreichbar. `wrangler dev` führt
die Quellen direkt aus (kein vorheriger `bun run build` nötig).

### Variante B: Produktion mit gebautem Bundle

Nach `bun run build` liegt das fertige Worker-Bundle unter `dist/` (Hauptdatei
meist `dist/_worker.js/index.js` oder `dist/server/index.js`).

```bash
# Genauen Pfad prüfen:
ls dist/

# Bundle mit workerd ausliefern:
wrangler dev dist/_worker.js/index.js \
  --ip 0.0.0.0 --port 8080 \
  --compatibility-date 2025-09-24 \
  --compatibility-flags nodejs_compat
```

### Variante C: Als Dienst mit PM2

```bash
sudo npm install -g pm2

pm2 start --name alarmdesk \
  --interpreter none \
  "$(which wrangler)" -- dev --ip 0.0.0.0 --port 8080

pm2 save
pm2 startup
```

> Hinweis: Wenn du das Worker-Bundle stattdessen auf **Cloudflare Workers**
> deployen möchtest, geht das mit `wrangler deploy` (Account erforderlich) —
> dann läuft die App direkt im Cloudflare-Netz und du brauchst keinen
> eigenen Server.

### Umgebungsvariablen für Wrangler

Wrangler liest standardmäßig **keine** `.env` automatisch. Trage entweder die
Variablen in `wrangler.jsonc` unter `vars` ein, oder starte Wrangler mit
`--env-file .env` (neue Wrangler-Versionen) bzw. exportiere die Variablen vor
dem Start:

```bash
set -a; . ./.env; set +a
wrangler dev --ip 0.0.0.0 --port 8080
```

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
