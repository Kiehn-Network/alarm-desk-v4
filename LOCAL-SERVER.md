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
git clone https://github.com/DEINE-ORG/DEIN-REPO.git alarmdesk
cd alarmdesk
```

> Ersetze `DEINE-ORG/DEIN-REPO` durch das tatsächliche Repository, das du aus Lovable exportiert hast.

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

Das Ergebnis liegt anschließend unter `.output/` oder `dist/`, je nach Build-Einstellung.

## 6. App starten

### Direkt im Vordergrund (zum Testen)

```bash
PORT=8080 HOST=0.0.0.0 bun run start
# oder: PORT=8080 HOST=0.0.0.0 npm run start
```

Die App ist dann unter `http://<SERVER-IP>:8080` erreichbar.

### Als Dienst mit PM2 (empfohlen für Produktion)

```bash
sudo npm install -g pm2

pm2 start .output/server/index.mjs --name alarmdesk
# Falls der Pfad abweicht, prüfe den Inhalt von .output/server/

pm2 save
pm2 startup
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
