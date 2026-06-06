import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/alarmdesk-logo.png";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Impressum — AlarmDesk" },
      { name: "description", content: "Anbieterkennzeichnung gemäß § 5 DDG für AlarmDesk und Kiehn Dienstleistungen." },
      { property: "og:title", content: "Impressum — AlarmDesk" },
      { property: "og:description", content: "Anbieterkennzeichnung gemäß § 5 DDG." },
      { property: "og:url", content: "https://v4.alarmdesk-software.de/impressum" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://v4.alarmdesk-software.de/impressum" }],
  }),
  component: ImpressumPage,
});

function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LegalHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-primary">Rechtliches</div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Impressum</h1>
        <p className="mt-2 text-sm text-muted-foreground">Angaben gemäß § 5 DDG</p>

        <Section title="Anbieter">
          <p>Kiehn Dienstleistungen (Einzelunternehmen)</p>
          <p>Léon Kiehn</p>
          <p>Hardingstr 6</p>
          <p>21481 Lauenburg</p>
          <p>Deutschland</p>
        </Section>

        <Section title="Markenhinweis">
          <p>
            Kiehn Network ist die Dachseite für die Marken/Projekte:
            Kiehn-Systeme, Niftly und AlarmDesk. Die rechtliche Abwicklung
            (Rechnungen/Zahlungen/Verträge) erfolgt über Kiehn Dienstleistungen
            (Einzelunternehmen).
          </p>
        </Section>

        <Section title="Vertreten durch">
          <p>Léon Kiehn (Inhaber)</p>
        </Section>

        <Section title="Verantwortlich i. S. d. § 18 Abs. 2 MStV">
          <p>Léon Kiehn (Anschrift wie oben)</p>
        </Section>

        <Section title="Kontakt">
          <p>
            E-Mail:{" "}
            <a className="text-primary hover:underline" href="mailto:service@kiehn-systeme.de">
              service@kiehn-systeme.de
            </a>
          </p>
          <p>Support: Ticket Support oder Discord</p>
        </Section>

        <Section title="Verbraucherstreitbeilegung">
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
            vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>

        <h2 className="mt-12 text-2xl font-bold tracking-tight">Haftung & Urheberrecht</h2>

        <Section title="Haftung für Inhalte">
          <p>
            Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach
            den allgemeinen Gesetzen verantwortlich. Eine Gewähr für die
            Richtigkeit, Vollständigkeit und Aktualität der Inhalte übernehmen wir
            jedoch nicht.
          </p>
        </Section>

        <Section title="Haftung für Links">
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren
            Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte
            übernehmen wir keine Gewähr. Verantwortlich ist stets der jeweilige
            Betreiber der Seiten.
          </p>
        </Section>

        <Section title="Urheberrecht">
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
            Seiten unterliegen dem deutschen Urheberrecht. Eine Verwendung
            außerhalb der Grenzen des Urheberrechts bedarf der schriftlichen
            Zustimmung des jeweiligen Autors.
          </p>
        </Section>

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