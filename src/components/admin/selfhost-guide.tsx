import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Server, Database, Globe, Shield, Terminal, Package, AlertTriangle, CheckCircle2, BarChart3, RefreshCw } from "lucide-react";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-muted text-foreground rounded-md p-3 text-xs overflow-x-auto border">
      <code>{children}</code>
    </pre>
  );
}

export function SelfHostGuide() {
  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Nur für SuperAdmins / Systemadministratoren</AlertTitle>
        <AlertDescription>
          Diese Anleitung beschreibt die komplette Migration der Anwendung (Frontend + Backend +
          Datenbank + Dateispeicher) auf einen eigenen Server. Erforderliche Kenntnisse: Linux,
          Docker, DNS, TLS-Zertifikate, PostgreSQL.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Architektur-Überblick
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Die Anwendung besteht aus drei Schichten, die alle auf einem eigenen Server laufen können:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Frontend + Backend (TanStack Start):</b> React + Server Functions, läuft als Node.js / Cloudflare Worker-kompatibler Server.</li>
            <li><b>Datenbank + Auth + Storage (Supabase Self-Hosted):</b> PostgreSQL, GoTrue (Auth), Storage-API, Realtime, PostgREST.</li>
            <li><b>Reverse Proxy (Nginx / Caddy / Traefik):</b> TLS-Terminierung und Routing.</li>
            <li><b>MySQL (optional, nur zur Visualisierung):</b> Read-Only-Spiegel der Postgres-Daten für BI- und Reporting-Tools wie phpMyAdmin, MySQL Workbench, DBeaver oder Metabase.</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary">Node.js 20+</Badge>
            <Badge variant="secondary">Docker + Docker Compose</Badge>
            <Badge variant="secondary">PostgreSQL 15</Badge>
            <Badge variant="secondary">MySQL 8 (optional)</Badge>
            <Badge variant="secondary">≥ 4 GB RAM</Badge>
            <Badge variant="secondary">≥ 40 GB SSD</Badge>
          </div>
          <Alert className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warum nicht MySQL als Hauptdatenbank?</AlertTitle>
            <AlertDescription>
              Die Anwendung nutzt Supabase-Funktionen, die zwingend PostgreSQL voraussetzen: Row-Level-Security
              (RLS), <code>auth</code>-/<code>storage</code>-Schemas, Realtime über logische Replikation, Triggers
              und SQL-Funktionen mit <code>pgcrypto</code>. Ein Wechsel auf MySQL würde Auth, Dateispeicher und
              Live-Updates brechen. MySQL kann jedoch problemlos <b>parallel</b> betrieben werden — als
              schreibgeschützter Spiegel für Auswertungen (siehe Schritt 9).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={["step-1"]} className="space-y-2">
        <AccordionItem value="step-1" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Server className="h-4 w-4" /> 1. Server vorbereiten</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p>Empfohlen: Ubuntu 22.04 LTS / Debian 12 mit Root- oder Sudo-Zugriff.</p>
            <Code>{`# System aktualisieren
sudo apt update && sudo apt upgrade -y

# Docker + Compose installieren
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Node.js 20 (für Frontend-Build)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Firewall
sudo ufw allow 22,80,443/tcp
sudo ufw enable`}</Code>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step-2" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Database className="h-4 w-4" /> 2. Supabase Self-Hosted aufsetzen</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p>Supabase liefert ein offizielles Docker-Compose-Setup mit Postgres, Auth, Storage, Realtime und Studio.</p>
            <Code>{`git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env

# WICHTIG: alle Secrets in .env ändern!
#   POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
#   DASHBOARD_USERNAME, DASHBOARD_PASSWORD, SITE_URL, SMTP_*

docker compose up -d`}</Code>
            <p>Anschließend ist Supabase Studio unter <code>http://SERVER:8000</code> erreichbar.</p>
            <p className="text-muted-foreground">Doku: <code>supabase.com/docs/guides/self-hosting/docker</code></p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step-3" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Database className="h-4 w-4" /> 3. Datenbank migrieren</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p><b>Export aus aktueller Cloud-Datenbank:</b></p>
            <Code>{`# Connection-String aus Lovable Cloud (Backend → Database → Connection)
pg_dump "postgresql://postgres:PWD@db.PROJECT.supabase.co:5432/postgres" \\
  --no-owner --no-privileges --schema=public --schema=auth --schema=storage \\
  -f backup.sql`}</Code>
            <p><b>Import in den neuen Server:</b></p>
            <Code>{`psql "postgresql://postgres:NEW_PWD@localhost:5432/postgres" -f backup.sql`}</Code>
            <p><b>Storage-Buckets</b> (PDFs, Logos, Avatare etc.) separat sichern:</p>
            <Code>{`# Mit Supabase CLI
supabase storage download --recursive --bucket dateien ./backup/dateien
supabase storage download --recursive --bucket logos ./backup/logos
# ... für jeden Bucket: dateien, logos, avatars, chat-attachments,
#                       intrahub, budeko-notizen, rohrservice-notizen

# Upload auf neuen Server analog mit "supabase storage upload"`}</Code>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step-4" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Terminal className="h-4 w-4" /> 4. Frontend + Backend bauen</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p>Quellcode via GitHub-Integration in Lovable exportieren und auf den Server klonen:</p>
            <Code>{`git clone https://github.com/DEINE-ORG/DEIN-REPO.git app
cd app

# Environment-Variablen setzen (.env)
cat > .env <<EOF
VITE_SUPABASE_URL=https://api.deine-domain.de
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY aus supabase/.env>
VITE_SUPABASE_PROJECT_ID=self-hosted
SUPABASE_URL=https://api.deine-domain.de
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
LOVABLE_API_KEY=<optional, falls AI-Features genutzt werden>
EOF

# Abhängigkeiten + Build
npm install -g bun
bun install
bun run build`}</Code>
            <p>Das Build-Ergebnis liegt in <code>.output/</code> (Node-Server).</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step-5" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Server className="h-4 w-4" /> 5. App als Dienst starten</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p>Mit <b>PM2</b> als Daemon:</p>
            <Code>{`sudo npm install -g pm2
pm2 start .output/server/index.mjs --name alarmdesk -i max
pm2 save
pm2 startup   # Autostart nach Reboot`}</Code>
            <p>Die App lauscht standardmäßig auf Port <code>3000</code>.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step-6" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Globe className="h-4 w-4" /> 6. Reverse Proxy + TLS (Caddy)</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p>Caddy holt sich Let's-Encrypt-Zertifikate automatisch.</p>
            <Code>{`# /etc/caddy/Caddyfile
app.deine-domain.de {
    reverse_proxy localhost:3000
}

api.deine-domain.de {
    reverse_proxy localhost:8000   # Supabase Kong-Gateway
}`}</Code>
            <Code>{`sudo systemctl reload caddy`}</Code>
            <p>DNS-A-Records für <code>app</code> und <code>api</code> auf die Server-IP setzen.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step-7" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> 7. Sicherheit &amp; Backups</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <ul className="list-disc pl-5 space-y-1">
              <li>SSH nur per Public Key, root-Login deaktivieren.</li>
              <li>Postgres-Port <code>5432</code> niemals öffentlich exponieren – nur intern.</li>
              <li>Tägliches <code>pg_dump</code>-Backup via Cron + Off-Site-Kopie.</li>
              <li>Storage-Verzeichnis (<code>./volumes/storage</code>) ebenfalls sichern.</li>
              <li>Fail2ban + automatische Sicherheitsupdates (<code>unattended-upgrades</code>).</li>
              <li>Server-Standort innerhalb der EU für DSGVO-Konformität.</li>
            </ul>
            <Code>{`# Backup-Cron (täglich 03:00)
0 3 * * * pg_dump -Fc -f /backups/db-$(date +\\%F).dump \\
  "postgresql://postgres:PWD@localhost:5432/postgres"`}</Code>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step-8" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> 8. Funktionstest</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm">
            <ol className="list-decimal pl-5 space-y-1">
              <li>App im Browser unter <code>https://app.deine-domain.de</code> aufrufen.</li>
              <li>Mit SuperAdmin-Account (aus migrierter <code>auth.users</code>) anmelden.</li>
              <li>Domains, Nutzer, Einsätze und Dateien prüfen – alle Daten sichtbar?</li>
              <li>Neue PDF erstellen (z.B. Einsatzbericht) → Upload landet im lokalen Storage.</li>
              <li>Chat-Funktion + Realtime testen (zwei Browser-Fenster).</li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step-9" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> 9. MySQL-Spiegelung zur Visualisierung</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p>
              Für Reporting, Dashboards oder Anbindung bestehender BI-Tools kann eine <b>MySQL-Instanz</b>
              parallel betrieben werden, die regelmäßig aus PostgreSQL befüllt wird. Die App selbst bleibt
              auf PostgreSQL — MySQL ist <b>read-only Visualisierungsschicht</b>.
            </p>

            <p><b>a) MySQL + phpMyAdmin via Docker:</b></p>
            <Code>{`# docker-compose.mysql.yml
services:
  mysql:
    image: mysql:8
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PWD}
      MYSQL_DATABASE: alarmdesk_view
      MYSQL_USER: alarmdesk
      MYSQL_PASSWORD: \${MYSQL_PWD}
    volumes:
      - ./mysql-data:/var/lib/mysql
    ports:
      - "127.0.0.1:3306:3306"

  phpmyadmin:
    image: phpmyadmin:latest
    restart: unless-stopped
    environment:
      PMA_HOST: mysql
      PMA_PORT: 3306
    ports:
      - "127.0.0.1:8081:80"
    depends_on: [mysql]

# Starten:
docker compose -f docker-compose.mysql.yml up -d`}</Code>

            <p><b>b) Sync von PostgreSQL → MySQL (täglich via Cron):</b></p>
            <p className="text-muted-foreground">
              Mit <code>pgloader</code> lassen sich Schema + Daten automatisch konvertieren
              (UUID → CHAR(36), JSONB → JSON, Arrays → JSON, Booleans → TINYINT(1)).
            </p>
            <Code>{`# /etc/alarmdesk/sync.load
LOAD DATABASE
  FROM postgresql://postgres:PG_PWD@localhost:5432/postgres
  INTO mysql://alarmdesk:MYSQL_PWD@localhost:3306/alarmdesk_view

  WITH include drop, create tables, create indexes, reset sequences,
       data only when matches,
       workers = 4, concurrency = 2

  INCLUDING ONLY TABLE NAMES MATCHING ~/^(profiles|domains|einsaetze|kunden|dateien|schluessel|user_roles|licenses)$/
    IN SCHEMA 'public'

  SET MySQL PARAMETERS net_read_timeout = '120', net_write_timeout = '120'

  ALTER SCHEMA 'public' RENAME TO 'alarmdesk_view'

  CAST type uuid to char(36) drop typemod,
       type jsonb to json drop typemod,
       type timestamptz to datetime drop typemod;

# Cron (alle 15 Min)
*/15 * * * * pgloader /etc/alarmdesk/sync.load >> /var/log/alarmdesk-sync.log 2>&1`}</Code>

            <p><b>c) Alternative: Metabase direkt auf PostgreSQL</b></p>
            <p className="text-muted-foreground">
              Falls keine MySQL-Pflicht besteht, ist <b>Metabase</b> einfacher: liest direkt aus Postgres,
              keine Sync-Pipeline nötig.
            </p>
            <Code>{`docker run -d -p 127.0.0.1:3001:3000 --name metabase metabase/metabase`}</Code>

            <p><b>d) Zugriff absichern</b> – niemals MySQL/phpMyAdmin/Metabase öffentlich exponieren:</p>
            <Code>{`# Caddyfile – mit Basic-Auth + TLS
mysql.deine-domain.de {
    basicauth {
        admin $2a$14$<bcrypt-hash>
    }
    reverse_proxy localhost:8081
}`}</Code>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Wichtig</AlertTitle>
              <AlertDescription>
                Schreibzugriffe auf den MySQL-Spiegel werden beim nächsten Sync überschrieben.
                Änderungen <b>immer</b> in der App bzw. PostgreSQL vornehmen.
              </AlertDescription>
            </Alert>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step-10" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> 10. AlarmDesk aktualisieren / neu deployen</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p><b>1. In Projektordner wechseln</b></p>
            <Code>{`cd ~/alarm-desk-v4`}</Code>

            <p><b>2. Aktuelle GitHub-Version laden</b></p>
            <Code>{`git pull origin main

# Falls lokale Änderungen blockieren:
git stash
git pull origin main
git stash pop`}</Code>

            <p><b>3. .env prüfen</b></p>
            <Code>{`cat .env`}</Code>
            <p>Muss auf dein Supabase-Projekt zeigen:</p>
            <Code>{`VITE_SUPABASE_PROJECT_ID="vmqvnckdynrhrdgwkork"
VITE_SUPABASE_URL="https://vmqvnckdynrhrdgwkork.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_OAL_zjGcFqGBP0iTIjaxdw_qUMRhSfs"

SUPABASE_URL="https://vmqvnckdynrhrdgwkork.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_OAL_zjGcFqGBP0iTIjaxdw_qUMRhSfs"`}</Code>

            <p><b>4. Dependencies installieren</b></p>
            <Code>{`npm install`}</Code>

            <p><b>5. Supabase-Migrationen einspielen</b></p>
            <Code>{`supabase db push

# Falls gen_random_bytes Fehler kommt:
sed -i 's/gen_random_bytes(/extensions.gen_random_bytes(/g' supabase/migrations/*.sql
supabase db push`}</Code>

            <p><b>6. TanStack-Fix prüfen</b></p>
            <p>In <code>src/integrations/supabase/auth-middleware.ts</code> muss oben stehen:</p>
            <Code>{`import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

# und:
createMiddleware().server(...)`}</Code>
            <p>In <code>src/integrations/supabase/auth-attacher.ts</code> muss stehen:</p>
            <Code>{`import { createMiddleware } from '@tanstack/react-start'

# und:
createMiddleware().client(...)`}</Code>

            <p><b>7. Build erstellen</b></p>
            <Code>{`NODE_OPTIONS="--max-old-space-size=2048" npm run build`}</Code>

            <p><b>8. App starten / neu starten</b></p>
            <p>Wenn PM2 schon eingerichtet ist:</p>
            <Code>{`pm2 restart alarmdesk`}</Code>
            <p>Wenn noch nicht:</p>
            <Code>{`PORT=8080 HOST=0.0.0.0 pm2 start dist/server/index.js --name alarmdesk
pm2 save
pm2 startup`}</Code>

            <p><b>9. Status prüfen</b></p>
            <Code>{`pm2 status
pm2 logs alarmdesk`}</Code>
            <p>Seite öffnen: <code>http://185.129.87.14:8080</code></p>

            <p><b>Komplettbefehl für Updates</b></p>
            <Code>{`cd ~/alarm-desk-v4 \\
&& git pull origin main \\
&& npm install \\
&& supabase db push \\
&& NODE_OPTIONS="--max-old-space-size=2048" npm run build \\
&& pm2 restart alarmdesk`}</Code>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle>Hinweise &amp; Einschränkungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <b>Lovable AI Gateway:</b> Funktioniert nur mit gültigem <code>LOVABLE_API_KEY</code>.
            Alternativ können AI-Aufrufe auf OpenAI/Gemini-API direkt umgestellt werden.
          </p>
          <p>
            <b>Google-Login:</b> Provider in Supabase Studio neu konfigurieren (Client-ID/Secret).
          </p>
          <p>
            <b>Updates:</b> Bei neuen Releases <code>git pull && bun install && bun run build && pm2 restart alarmdesk</code>.
          </p>
          <p>
            Bei Problemen Lovable-Support kontaktieren – die offizielle Self-Hosting-Doku findest du
            unter <code>docs.lovable.dev/tips-tricks/self-hosting</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
