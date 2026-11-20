import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Radar, MapPin, Bell, KeyRound, ArrowRight, Lock, Truck, Shirt, IdCard, Search,
  FolderOpen, MessageSquare, ClipboardList, Package, ListChecks, Smartphone, FileText,
  Activity, Server, ShieldCheck, Clock, Phone, Users, CheckCircle2, Radio, Tag,
} from "lucide-react";
import logo from "@/assets/alarmdesk-logo.png";
import shotDashboard from "@/assets/app-dashboard.webp.asset.json";
import shotAlarmierung from "@/assets/app-alarmierung.webp.asset.json";
import shotEinsatz from "@/assets/app-einsatz-erstellen.webp.asset.json";

export const Route = createFileRoute("/homepage")({
  head: () => ({
    meta: [
      { title: "AlarmDesk – Leitstelle, Interventionsdienst & Revier in einer Plattform" },
      { name: "description", content: "AlarmDesk steuert Alarmierung, Fahrer, Schlüssel, Fuhrpark, Kundenakten und ERP-Abrechnung für Sicherheitsdienste – in Echtzeit." },
      { property: "og:title", content: "AlarmDesk – Die Plattform für Sicherheitsdienste" },
      { property: "og:description", content: "Alarmierung, Fahrer-App, Schlüsselbuch, Fuhrpark, Kundenakte und ERP – alles in einer Leitstellen-Software." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const display = { fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif" };

function LandingPage() {
  return (
    <div className="min-h-screen bg-hp-bg text-hp-text selection:bg-hp-signal/30" style={{ fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif" }}>
      <Header />
      <Hero />
      <Einblicke />
      <Ablauf />
      <Module />
      <Rollen />
      <Sicherheit />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-hp-line/60 bg-hp-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/homepage" className="flex items-center gap-2.5">
          <img src={logo} alt="AlarmDesk" className="h-8 w-8 rounded-md" />
          <span className="text-lg font-bold tracking-tight" style={display}>AlarmDesk</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-hp-muted md:flex">
          <a href="#ablauf" className="transition hover:text-hp-text">Ablauf</a>
          <a href="#module" className="transition hover:text-hp-text">Module</a>
          <a href="#rollen" className="transition hover:text-hp-text">Rollen</a>
          <a href="#sicherheit" className="transition hover:text-hp-text">Sicherheit</a>
        </nav>
        <Link to="/login" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-hp-signal px-4 text-sm font-semibold text-hp-signal-ink transition hover:brightness-110">
          Anmelden <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="hp-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-20 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-hp-line bg-hp-surface px-3 py-1 text-xs text-hp-muted">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hp-ok opacity-70" /><span className="relative h-2 w-2 rounded-full bg-hp-ok" /></span>
            Leitstelle online · Version 4
          </div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl" style={display}>
            Vom Alarm bis zur Rechnung.<br />
            <span className="text-hp-signal">Ohne Medienbruch.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-hp-muted">
            AlarmDesk ist die Leitstellen-Software für Interventions- und Revierdienste: Einsätze disponieren, Fahrer live begleiten, Schlüssel lückenlos nachweisen und sauber ans ERP übergeben.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-full bg-hp-signal px-7 font-semibold text-hp-signal-ink transition hover:brightness-110">
              Zur Anmeldung <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#module" className="inline-flex h-12 items-center rounded-full border border-hp-line px-7 font-semibold transition hover:bg-hp-surface">
              Module ansehen
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-hp-muted">
            {["Push-Alarmierung", "DSGVO-konform in der EU", "Mandantenfähig"].map((t) => (
              <span key={t} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-hp-ok" />{t}</span>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-hp-signal/15 blur-3xl" />
          <AppFenster src={shotDashboard.url} alt="AlarmDesk Dashboard" />
        </div>
      </div>
    </section>
  );
}

function AppFenster({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-hp-line bg-hp-surface shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-hp-line px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-hp-alarm/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-hp-signal/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-hp-ok/70" />
        <span className="ml-3 font-mono text-xs text-hp-muted">alarmdesk-software.de</span>
      </div>
      <img src={src} alt={alt} loading="lazy" className="block w-full" />
    </div>
  );
}

function Einblicke() {
  const bilder = [
    { src: shotAlarmierung.url, t: "Alarmierung", d: "Alle aktiven Einsätze mit Status, Fahrer und Zeiten – 20 pro Seite." },
    { src: shotEinsatz.url, t: "Einsatz erstellen", d: "Kunde per Name, Schlüssel-, Anlagen- oder Teilnehmernummer finden." },
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHead kicker="Einblicke" title="So sieht AlarmDesk im Alltag aus" sub="Echte Ansichten aus der App – mit Demo-Daten, ohne Kundendaten." />
        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          {bilder.map((b) => (
            <figure key={b.t}>
              <AppFenster src={b.src} alt={b.t} />
              <figcaption className="mt-4"><span className="font-semibold">{b.t}</span> <span className="text-hp-muted">– {b.d}</span></figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Ablauf() {
  const steps = [
    { icon: Bell, t: "Alarm eingehen", d: "Einsatz anlegen, Kunde per Teilnehmer- oder Anlagennummer finden, Fahrer zuweisen – Push geht sofort raus." },
    { icon: Truck, t: "Fahrer begleiten", d: "Live-Status, Ankunftszeit und Anruf-Button. Der Fahrer sieht nur Dateien und Schlüssel seines Kunden." },
    { icon: ClipboardList, t: "Leitstelle prüft", d: "Protokoll kontrollieren, Zeiten und Texte korrigieren, PDF-Bericht an den Kunden senden." },
    { icon: Server, t: "Einmal ans ERP", d: "Mit einem Klick übertragen – Personalnummer und Schichtname inklusive. Danach gesperrt." },
  ];
  return (
    <section id="ablauf" className="border-y border-hp-line/60 bg-hp-surface/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHead kicker="Ablauf" title="Ein Einsatz, vier klare Schritte" />
        <div className="mt-14 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.t} className="relative rounded-2xl border border-hp-line bg-hp-bg p-6">
              <span className="absolute right-5 top-5 font-mono text-xs text-hp-muted">0{i + 1}</span>
              <s.icon className="h-6 w-6 text-hp-signal" />
              <h3 className="mt-5 text-lg font-semibold" style={display}>{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-hp-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const MODULE = [
  { g: "Einsatz", icon: Radar, t: "Alarmierung", d: "Einsätze mit Storno-Grund, Neuzuweisung und Einsatzprotokoll." },
  { g: "Einsatz", icon: Smartphone, t: "Fahrer-App", d: "Meine Einsätze, Stempelzeiten per Klick, Notizen zum Objekt." },
  { g: "Einsatz", icon: Bell, t: "Push-Benachrichtigung", d: "Pro Gerät steuerbar – für Fahrer und Zentrale." },
  { g: "Einsatz", icon: MessageSquare, t: "Chat", d: "#Allgemein, #Zentrale und Direktnachrichten." },
  { g: "Kunde", icon: FolderOpen, t: "Kundenakte", d: "Dateien, Schlüssel, Objektdossier und Einsätze an einem Ort." },
  { g: "Kunde", icon: KeyRound, t: "Schlüsselbuch", d: "Ausgabe, Rücknahme, Zwangsrücknahme und Inventur mit PDF." },
  { g: "Kunde", icon: ListChecks, t: "Checklisten", d: "Feste Abläufe je Objekt und Einsatzart." },
  { g: "Kunde", icon: Tag, t: "Findo-ID", d: "Fundanhänger mit QR – Finder melden ohne Anmeldung." },
  { g: "Betrieb", icon: Truck, t: "Fuhrpark", d: "Fahrzeuge, Termine, KM-Log und Schadensskizze vom Fahrer." },
  { g: "Betrieb", icon: Package, t: "Lager", d: "Bestände und Ausgabe über die Lager-Station." },
  { g: "Betrieb", icon: Shirt, t: "Dienstkleidung", d: "Größe, Zustand, Rückgabe und Verbleib je Mitarbeiter." },
  { g: "Betrieb", icon: Phone, t: "Diensttelefone", d: "Geräte zuordnen und nachverfolgen." },
  { g: "Verwaltung", icon: IdCard, t: "Dienstausweise", d: "Vorder- und Rückseite, eigene Vorlagen, QR-Prüfseite." },
  { g: "Verwaltung", icon: FileText, t: "Abrechnung & ERP", d: "PDF-Export, Sonderabrechnungen und einmaliger ERP-Versand." },
  { g: "Verwaltung", icon: Activity, t: "Logs live", d: "Aktionen in Echtzeit, 7 Tage gespeichert." },
  { g: "Verwaltung", icon: Search, t: "Dashboard", d: "Anpassbare Kacheln pro Nutzer." },
];

function Module() {
  const gruppen = ["Einsatz", "Kunde", "Betrieb", "Verwaltung"];
  return (
    <section id="module" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHead kicker="Module" title="Alles, was ein Sicherheitsdienst täglich braucht" sub={`${MODULE.length} Module – je nach Rolle sichtbar.`} />
        <div className="mt-14 grid gap-10 lg:grid-cols-4">
          {gruppen.map((g) => (
            <div key={g}>
              <div className="mb-4 font-mono text-xs uppercase tracking-widest text-hp-signal">{g}</div>
              <div className="space-y-3">
                {MODULE.filter((m) => m.g === g).map((m) => (
                  <div key={m.t} className="group rounded-xl border border-hp-line bg-hp-surface/60 p-4 transition hover:border-hp-signal/60">
                    <div className="flex items-center gap-2.5 font-semibold"><m.icon className="h-4 w-4 text-hp-muted transition group-hover:text-hp-signal" />{m.t}</div>
                    <p className="mt-1.5 text-sm text-hp-muted">{m.d}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Rollen() {
  const rollen = [
    { icon: Truck, t: "Fahrer", d: "Eigene Einsätze, Schichtname beim Login, Fahrzeugschäden melden, Objektnotizen." },
    { icon: Radio, t: "Disponent", d: "Alarmierung, Kundenakte, Schlüsselbuch, Fuhrpark und Chat." },
    { icon: Users, t: "Service", d: "Disponenten-Rechte plus Benutzer, Einstellungen/ERP, Ausweise und Fuhrpark." },
    { icon: ShieldCheck, t: "Admin", d: "Volle Kontrolle über Firma, Rollen, Abrechnung und Logs live." },
  ];
  return (
    <section id="rollen" className="border-y border-hp-line/60 bg-hp-surface/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHead kicker="Rollen" title="Jeder sieht genau, was er braucht" />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rollen.map((r) => (
            <div key={r.t} className="rounded-2xl border border-hp-line bg-hp-bg p-6">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-hp-signal/15"><r.icon className="h-5 w-5 text-hp-signal" /></div>
              <h3 className="mt-5 text-lg font-semibold" style={display}>{r.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-hp-muted">{r.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sicherheit() {
  const punkte = [
    { icon: Lock, t: "Strikte Mandantentrennung", d: "Jede Firma sieht ausschließlich ihre eigenen Daten." },
    { icon: KeyRound, t: "Kundengebundene Dateien", d: "Fahrer erhalten nur Unterlagen, die zum Kunden passen." },
    { icon: Clock, t: "Nachvollziehbar", d: "Aktionsprotokoll mit automatischer Löschung nach 7 Tagen." },
    { icon: Server, t: "Hosting in der EU", d: "Verschlüsselte Übertragung, ERP-Anbindung nur über HTTPS." },
  ];
  return (
    <section id="sicherheit" className="py-24">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[1fr_1.3fr]">
        <SectionHead kicker="Sicherheit" title="Gebaut für sensible Kundendaten" sub="Schlüssel, Alarmpläne und Objektdaten verdienen mehr als eine Tabelle." align="left" />
        <div className="grid gap-4 sm:grid-cols-2">
          {punkte.map((p) => (
            <div key={p.t} className="rounded-2xl border border-hp-line bg-hp-surface/60 p-6">
              <p.icon className="h-5 w-5 text-hp-ok" />
              <h3 className="mt-4 font-semibold">{p.t}</h3>
              <p className="mt-1.5 text-sm text-hp-muted">{p.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-hp-signal/40 bg-hp-surface p-10 md:p-16">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl" style={display}>Bereit für die nächste Schicht?</h2>
            <p className="mt-3 text-hp-muted">Melde dich an oder schreib uns für einen Zugang für deine Firma.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-full bg-hp-signal px-7 font-semibold text-hp-signal-ink transition hover:brightness-110">Anmelden <ArrowRight className="h-4 w-4" /></Link>
            <a href="mailto:info@alarmdesk-software.de" className="inline-flex h-12 items-center rounded-full border border-hp-line px-7 font-semibold transition hover:bg-hp-bg">Kontakt</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hp-line/60">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-hp-muted md:flex-row">
        <span>AlarmDesk – ein Produkt des Kiehn Network © {new Date().getFullYear()}</span>
        <div className="flex gap-6">
          <Link to="/impressum" className="hover:text-hp-text">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-hp-text">Datenschutz</Link>
          <Link to="/login" className="hover:text-hp-text">Anmelden</Link>
        </div>
      </div>
    </footer>
  );
}

function SectionHead({ kicker, title, sub, align = "center" }: { kicker: string; title: string; sub?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : ""}>
      <div className="font-mono text-xs uppercase tracking-widest text-hp-signal">{kicker}</div>
      <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl" style={display}>{title}</h2>
      {sub && <p className="mt-4 text-hp-muted">{sub}</p>}
    </div>
  );
}
