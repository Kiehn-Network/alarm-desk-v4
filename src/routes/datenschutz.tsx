import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/alarmdesk-logo.png";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { title: "Datenschutz — AlarmDesk" },
      { name: "description", content: "Datenschutzerklärung gemäß DSGVO für AlarmDesk und Kiehn Dienstleistungen." },
      { property: "og:title", content: "Datenschutz — AlarmDesk" },
      { property: "og:description", content: "Datenschutzerklärung gemäß DSGVO." },
      { property: "og:url", content: "https://v4.alarmdesk-software.de/datenschutz" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://v4.alarmdesk-software.de/datenschutz" }],
  }),
  component: DatenschutzPage,
});

function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LegalHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-primary">Rechtliches</div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Datenschutz</h1>
        <p className="mt-2 text-sm text-muted-foreground">Datenschutzerklärung gemäß DSGVO</p>

        <Section title="1. Datenschutz auf einen Blick">
          <p className="font-medium text-foreground">Allgemeine Hinweise</p>
          <p>
            Die folgenden Hinweise geben einen einfachen Überblick darüber, was
            mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website
            besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie
            persönlich identifiziert werden können.
          </p>
        </Section>

        <Section title="2. Verantwortliche Stelle">
          <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
          <div className="mt-2">
            <p>Kiehn Dienstleistungen (Einzelunternehmen)</p>
            <p>Léon Kiehn</p>
            <p>Hardingstr 6</p>
            <p>21481 Lauenburg</p>
            <p>Deutschland</p>
            <p className="mt-2">
              E-Mail:{" "}
              <a className="text-primary hover:underline" href="mailto:service@kiehn-systeme.de">
                service@kiehn-systeme.de
              </a>
            </p>
          </div>
        </Section>

        <Section title="3. Wie erfassen wir Ihre Daten?">
          <p className="font-medium text-foreground">a) Durch Ihren Besuch der Website</p>
          <p>
            Beim Aufruf dieser Website werden durch den Webserver automatisch
            Informationen erfasst (sog. Server-Logfiles). Dies sind z. B.
            Browsertyp/-version, verwendetes Betriebssystem, Referrer-URL,
            Datum/Uhrzeit des Zugriffs sowie die IP-Adresse.
          </p>
          <p className="font-medium text-foreground mt-3">b) Durch Kontaktaufnahme</p>
          <p>
            Wenn Sie uns per E-Mail oder über ein Kontaktformular kontaktieren,
            verarbeiten wir die von Ihnen übermittelten Angaben (z. B. Name,
            E-Mail-Adresse, Inhalt der Nachricht) zur Bearbeitung Ihrer Anfrage.
          </p>
        </Section>

        <Section title="4. Zwecke und Rechtsgrundlagen">
          <ul className="list-disc pl-5 space-y-1">
            <li>Art. 6 Abs. 1 lit. b DSGVO – Verarbeitung zur Erfüllung (vor-)vertraglicher Maßnahmen (z. B. Angebot/Anfrage).</li>
            <li>Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse (z. B. sichere, stabile Bereitstellung der Website, Missbrauchs-/Fehleranalyse).</li>
            <li>Art. 6 Abs. 1 lit. a DSGVO – Einwilligung (nur falls/wo Sie diese erteilen, z. B. bei optionalen Tools).</li>
          </ul>
        </Section>

        <Section title="5. Hosting">
          <p>
            Diese Website wird auf Servern betrieben, um eine sichere und
            schnelle Bereitstellung zu gewährleisten. Dabei können die oben
            genannten Server-Logdaten verarbeitet werden.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Hosting-Anbieter: Niftly.de</li>
            <li>Standort der Server: Deutschland/EU</li>
            <li>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Sicherheit/Betrieb) und ggf. Art. 6 Abs. 1 lit. b DSGVO (Vertrag/Anfrage).</li>
          </ul>
        </Section>

        <Section title="6. Empfänger der Daten">
          <p>
            Eine Weitergabe Ihrer personenbezogenen Daten erfolgt nur, wenn dies
            zur Bearbeitung Ihrer Anfrage erforderlich ist, wir rechtlich dazu
            verpflichtet sind oder Sie eingewilligt haben. Sofern Dienstleister
            eingesetzt werden (z. B. Hosting), erfolgt dies im Rahmen der
            Auftragsverarbeitung nach Art. 28 DSGVO (sofern anwendbar).
          </p>
        </Section>

        <Section title="7. Speicherdauer">
          <p>
            Personenbezogene Daten werden nur so lange gespeichert, wie dies für
            die jeweiligen Zwecke erforderlich ist oder gesetzliche
            Aufbewahrungspflichten bestehen. Server-Logdaten werden in der Regel
            zeitnah gelöscht bzw. anonymisiert.
          </p>
        </Section>

        <Section title="8. Ihre Rechte">
          <ul className="list-disc pl-5 space-y-1">
            <li>Auskunft (Art. 15 DSGVO)</li>
            <li>Berichtigung (Art. 16 DSGVO)</li>
            <li>Löschung (Art. 17 DSGVO)</li>
            <li>Einschränkung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruch (Art. 21 DSGVO), sofern Verarbeitung auf Art. 6 Abs. 1 lit. f DSGVO beruht</li>
            <li>Widerruf von Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
            <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
          </ul>
        </Section>

        <Section title="9. SSL-/TLS-Verschlüsselung">
          <p>
            Diese Seite nutzt aus Sicherheitsgründen eine SSL-/TLS-Verschlüsselung.
            Dadurch können übermittelte Daten nicht von Dritten mitgelesen werden.
          </p>
        </Section>

        <Section title="10. Widerspruch gegen Werbe-E-Mails">
          <p>
            Der Nutzung der im Rahmen der Impressumspflicht veröffentlichten
            Kontaktdaten zur Übersendung von nicht ausdrücklich angeforderter
            Werbung wird widersprochen.
          </p>
        </Section>

        <Section title="11. Änderungen dieser Datenschutzerklärung">
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit
            sie stets den aktuellen rechtlichen Anforderungen entspricht oder um
            Änderungen unserer Leistungen umzusetzen.
          </p>
        </Section>

        <p className="mt-8 text-xs text-muted-foreground">Stand dieser Datenschutzerklärung: 18.01.2026</p>

        <BackLink />
      </main>
      <LegalFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm text-muted-foreground leading-relaxed space-y-1">{children}</div>
    </section>
  );
}

function LegalHeader() {
  return (
    <header className="border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/homepage" className="flex items-center gap-2.5">
          <img src={logo} alt="AlarmDesk" className="size-8 rounded-md" />
          <span className="font-semibold tracking-tight">AlarmDesk</span>
        </Link>
        <Link to="/login" className="h-9 px-4 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 transition inline-flex items-center">
          Anmelden
        </Link>
      </div>
    </header>
  );
}

function BackLink() {
  return (
    <div className="mt-12 pt-6 border-t border-border">
      <Link to="/homepage" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" /> Zurück zur Startseite
      </Link>
    </div>
  );
}

function LegalFooter() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} Kiehn Dienstleistungen · AlarmDesk</div>
        <div className="flex items-center gap-5">
          <Link to="/impressum" className="hover:text-foreground transition">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-foreground transition">Datenschutz</Link>
        </div>
      </div>
    </footer>
  );
}