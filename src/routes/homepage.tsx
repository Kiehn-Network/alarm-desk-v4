import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield, Radar, MapPin, FileText, Bell, Users, KeyRound, Activity,
  CheckCircle2, ArrowRight, Sparkles, Lock, Zap,
  BarChart3, ListChecks, XCircle, FolderOpen, TrendingUp, Clock, Home,
  ScanLine, Wrench, Bell as BellIcon, Settings,
  Star, Quote, Phone, ClipboardList, Smartphone, Archive, Timer,
} from "lucide-react";
import logo from "@/assets/alarmdesk-logo.png";

export const Route = createFileRoute("/homepage")({
  head: () => ({
    meta: [
      { title: "AlarmDesk — Einsatz- & Sicherheitsmanagement der nächsten Generation" },
      { name: "description", content: "AlarmDesk bündelt Einsatzleitung, Revier-Center, Notdienste und Abrechnung in einer modernen Plattform für Sicherheitsdienstleister." },
      { property: "og:title", content: "AlarmDesk — Einsatz- & Sicherheitsmanagement" },
      { property: "og:description", content: "Die zentrale Plattform für Wach- und Sicherheitsdienste: Einsätze, Revier, Notdienst, Abrechnung und mehr." },
      { property: "og:url", content: "https://v4.alarmdesk-software.de/homepage" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://v4.alarmdesk-software.de/homepage" }],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <LogosBar />
      <Features />
      <Modules />
      <HnrModule />
      <Testimonials />
      <SecuritySection />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="AlarmDesk Logo" className="size-8 rounded-md" />
          <span className="font-semibold tracking-tight">AlarmDesk</span>
          <span className="ml-1 text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary">v4</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition">Funktionen</a>
          <a href="#module" className="hover:text-foreground transition">Module</a>
          <a href="#sicherheit" className="hover:text-foreground transition">Sicherheit</a>
          <Link to="/hilfe" className="hover:text-foreground transition">Hilfe</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="h-9 px-3 rounded-lg text-sm hover:bg-accent transition inline-flex items-center">
            Anmelden
          </Link>
          <Link to="/login" className="h-9 px-4 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 transition inline-flex items-center gap-1.5">
            Demo starten <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--primary) 25%, transparent), transparent 70%)",
        }}
      />
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-card border border-border text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Version 4 ist da
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
            Einsatzmanagement, das mit Ihrem Sicherheitsdienst Schritt hält.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            AlarmDesk bündelt Einsätze, Revier-Center, Notdienste, Abrechnung
            und Kundendaten in einer modernen, mandantenfähigen Plattform — Live,
            mobil und sicher.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/login" className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition inline-flex items-center gap-2">
              Jetzt anmelden <ArrowRight className="size-4" />
            </Link>
            <a href="#features" className="h-11 px-6 rounded-xl border border-border hover:bg-accent font-medium transition inline-flex items-center">
              Funktionen ansehen
            </a>
          </div>
          <div className="mt-10 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> DSGVO-konform</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> Hosting in DE</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> Mandantenfähig</span>
          </div>
        </div>

        <DashboardPreview />
      </div>
    </section>
  );
}

function DashboardPreview() {
  const stats = [
    { l: "Monat Einsätze", v: 248, i: BarChart3, tone: "info" },
    { l: "Aktive Einsätze", v: 12, i: CheckCircle2, tone: "success" },
    { l: "Gesamt Einsätze", v: 1842, i: ListChecks, tone: "warning" },
    { l: "Storniert", v: 7, i: XCircle, tone: "destructive" },
    { l: "Datensätze", v: 5310, i: FolderOpen, tone: "muted" },
    { l: "Schlüssel unterwegs", v: 31, i: KeyRound, tone: "warning" },
  ] as const;
  const toneMap: Record<string, string> = {
    info: "bg-info/15 text-info",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  const recents = [
    { d: "Einbruchmeldung · Müller GmbH", f: "T. Schneider", s: "vor 4 Min", du: "32m", st: "in_bearbeitung" },
    { d: "Türöffnung · Praxis Dr. Weiß", f: "K. Bauer", s: "vor 18 Min", du: "1h 12m", st: "freigegeben" },
    { d: "Revier-Kontrolle · Lager Ost", f: "A. Yilmaz", s: "vor 41 Min", du: "48m", st: "in_bearbeitung" },
    { d: "Wasserschaden · Hotel Sonne", f: "M. Klein", s: "vor 1 Std", du: "2h 04m", st: "freigegeben" },
    { d: "Alarm · Filiale Mitte", f: "S. Roth", s: "vor 2 Std", du: "27m", st: "abgelehnt" },
  ];
  const statusTone: Record<string, string> = {
    in_bearbeitung: "bg-info/15 text-info",
    freigegeben: "bg-success/15 text-success",
    abgelehnt: "bg-destructive/15 text-destructive",
  };
  const nav = [
    { i: Home, l: "Dashboard", active: true },
    { i: BellIcon, l: "Alarmierung" },
    { i: ListChecks, l: "Meine Einsätze" },
    { i: Radar, l: "Revier-Center" },
    { i: ScanLine, l: "OWKS" },
    { i: Wrench, l: "Notdienst" },
    { i: KeyRound, l: "Schlüsselbuch" },
    { i: FolderOpen, l: "Dateien" },
    { i: Users, l: "Kunden" },
    { i: Settings, l: "Admin" },
  ];
  return (
    <div className="mt-16 mx-auto max-w-6xl rounded-2xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-elegant, 0 30px 80px -30px rgba(0,0,0,0.4))" }}>
      <div className="h-10 border-b border-border flex items-center gap-1.5 px-4 bg-muted/30">
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-warning/60" />
        <span className="size-2.5 rounded-full bg-success/60" />
        <span className="ml-3 text-xs text-muted-foreground">v4.alarmdesk-software.de/dashboard</span>
      </div>
      <div className="grid grid-cols-[200px_1fr]">
        {/* Sidebar */}
        <aside className="border-r border-border bg-muted/20 p-3 hidden sm:block">
          <div className="flex items-center gap-2 px-2 py-2">
            <img src={logo} alt="" className="size-6 rounded" />
            <span className="text-sm font-semibold">AlarmDesk</span>
          </div>
          <nav className="mt-3 space-y-0.5">
            {nav.map((n) => (
              <div key={n.l} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${n.active ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                <n.i className="size-3.5" /> {n.l}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="p-5 space-y-5 min-w-0">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Dashboard</div>
            <div className="text-lg font-bold mt-0.5">Guten Tag, Tim 👋</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.map((s) => (
              <div key={s.l} className="rounded-lg border border-border p-3">
                <div className={`size-7 rounded-md grid place-items-center ${toneMap[s.tone]}`}>
                  <s.i className="size-3.5" />
                </div>
                <div className="mt-2 text-lg font-bold tabular-nums">{s.v.toLocaleString("de-DE")}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 truncate">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">Letzte Einsätze</div>
                  <div className="text-[10px] text-muted-foreground">Übersicht der jüngsten Aktivitäten</div>
                </div>
                <TrendingUp className="size-4 text-muted-foreground" />
              </div>
              <table className="w-full text-xs">
                <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left font-medium py-1.5">Datei</th>
                    <th className="text-left font-medium py-1.5 hidden md:table-cell">Fahrer</th>
                    <th className="text-left font-medium py-1.5 hidden md:table-cell">Start</th>
                    <th className="text-left font-medium py-1.5">Dauer</th>
                    <th className="text-left font-medium py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recents.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 truncate max-w-[180px]">{r.d}</td>
                      <td className="py-2 text-muted-foreground hidden md:table-cell">{r.f}</td>
                      <td className="py-2 text-muted-foreground hidden md:table-cell">{r.s}</td>
                      <td className="py-2 text-muted-foreground tabular-nums">{r.du}</td>
                      <td className="py-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] ${statusTone[r.st]}`}>{r.st}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Clock className="size-3" /> Durchschnitt (Monat)
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Einsatzdauer</span><span className="font-medium tabular-nums">52m</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Anfahrt</span><span className="font-medium tabular-nums">14m</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reaktionszeit</span><span className="font-medium tabular-nums">6m</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Users className="size-3" /> Top Teilnehmer
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  {[
                    { n: "T. Schneider", v: 48 },
                    { n: "K. Bauer", v: 36 },
                    { n: "A. Yilmaz", v: 29 },
                  ].map((p) => (
                    <div key={p.n} className="flex items-center justify-between">
                      <span>{p.n}</span>
                      <span className="text-muted-foreground tabular-nums">{p.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogosBar() {
  return (
    <div className="border-y border-border bg-muted/20">
      <div className="max-w-7xl mx-auto px-6 py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Vertraut von Sicherheits- und Wachdiensten in ganz Deutschland
        </p>
      </div>
    </div>
  );
}

function Features() {
  const items = [
    { i: Activity, t: "Live-Monitor", d: "Standorte, Status und Einsätze in Echtzeit auf der Karte." },
    { i: FileText, t: "Berichte & PDFs", d: "Automatische Berichtsnummer, PDF-Versand per E-Mail, ERP-Anbindung." },
    { i: Bell, t: "Alarmierung", d: "Einsätze blitzschnell erstellen, halten und zuweisen." },
    { i: Users, t: "Mandantenfähig", d: "Saubere Trennung pro Domäne mit SuperAdmin-Konsole." },
    { i: KeyRound, t: "Schlüsselbuch", d: "Übergaben digital dokumentieren — wer hat was und seit wann." },
    { i: Lock, t: "Rechte & Rollen", d: "Feingranulare Rollen, sichere RLS-Policies, Audit-fähig." },
  ];
  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-primary">Funktionen</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Alles, was Ihr Team im Einsatz braucht.</h2>
          <p className="mt-4 text-muted-foreground">Von der Disposition bis zur Abrechnung — in einer einzigen, schnellen Oberfläche.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-6 hover:border-primary/50 transition">
              <div className="size-10 rounded-lg grid place-items-center bg-primary/15 text-primary">
                <f.i className="size-5" />
              </div>
              <div className="mt-4 font-semibold">{f.t}</div>
              <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modules() {
  const mods = [
    {
      i: Bell,
      t: "Einsatzverwaltung",
      d: "Das Herzstück von AlarmDesk: Einsätze in Sekunden anlegen, einem Fahrer zuweisen, mit Hold-Button pausieren und über die Statusampel jederzeit sehen, wo der Einsatz steht. Berichte werden mit automatischer Nummer generiert und per E-Mail oder ERP versendet.",
      tags: ["Hold-Button", "Statusampel", "Auto-Berichtsnummer", "PDF-Versand"],
    },
    {
      i: Radar,
      t: "Revier-Center / OWKS",
      badge: "Neu in v4",
      d: "Komplett neu in v4: Das Revier-Center bündelt das gesamte Objekt- und Wachschutz-Management an einem Ort. Verwalten Sie Objekte, kleben Sie NFC-Punkte an Kontrollstellen und planen Sie wiederkehrende Bestreifungen über den visuellen Zeitstrahl. Fahrer scannen vor Ort per NFC, die Leitstelle sieht jeden Kontrollpunkt live.",
      tags: ["Objektverwaltung", "NFC-Scans", "Zeitstrahl-Planung", "Bestreifungspläne", "Rundgangsverwaltung"],
    },
    {
      i: Zap,
      t: "ESRP-Anbindung",
      d: "Einmalig konfigurieren, dann läuft der Versand an Drittsysteme automatisch beim Abschluss eines Einsatzes — oder manuell aus dem Bericht-Dialog. Eine zentrale Outbox zeigt jeden Versand mit Statuslampe, fehlgeschlagene Übermittlungen lassen sich mit einem Klick wiederholen.",
      tags: ["Auto-Versand", "Outbox", "Wiederholung", "Statuslampe"],
    },
    {
      i: Wrench,
      t: "Notdienst-Module",
      d: "Individuell entwickelte Module für einzelne Auftraggeber: maßgeschneiderte Erfassungsmasken, eigene Mitarbeiter- und Verfügbarkeitsverwaltung, kundenspezifische PDF-Vorlagen und optionale Schnittstellen zu Drittsystemen. Weitere Notdienst-Module können jederzeit ergänzt werden.",
      tags: ["Individuelle Formulare", "Eigene PDFs", "Verfügbarkeiten"],
    },
    {
      i: FileText,
      t: "Abrechnung & Dienstpläne",
      d: "Abrechnungen pro Auftraggeber erstellen, mit Positionen aus erledigten Einsätzen, und direkt als PDF per E-Mail versenden. Dienstpläne ergänzen die Disposition um die Personalseite — wer wann wo ist.",
      tags: ["Pro Auftraggeber", "PDF-Versand", "Dienstpläne"],
    },
    {
      i: FolderOpen,
      t: "Stammdaten & Dateien",
      d: "Kundenverwaltung, Schlüsselbuch, Daten-Import und ein zentraler Dateien-Bereich — alle Stammdaten an einem Ort, sauber pro Mandant getrennt und mit Volltextsuche.",
      tags: ["Kunden", "Schlüsselbuch", "Import", "Dateien"],
    },
  ];
  return (
    <section id="module" className="py-24 bg-muted/20 border-y border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-primary">Module</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Eine Plattform, viele Spezialisten.</h2>
          <p className="mt-4 text-muted-foreground">Aktivieren Sie nur, was Ihre Domäne braucht — wir erweitern AlarmDesk individuell für Ihre Abläufe.</p>
        </div>
        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {mods.map((m) => (
            <div key={m.t} className="rounded-2xl border border-border bg-card p-6 hover:border-primary/50 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="size-10 rounded-lg grid place-items-center bg-primary/15 text-primary shrink-0">
                  <m.i className="size-5" />
                </div>
                {m.badge && (
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-primary text-primary-foreground">{m.badge}</span>
                )}
              </div>
              <div className="mt-4 font-semibold text-lg">{m.t}</div>
              <div className="text-sm text-muted-foreground mt-2 leading-relaxed">{m.d}</div>
              {m.tags && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {m.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HnrModule() {
  const steps = [
    "Einsatz abrufen – Stammdaten digital am Mobilgerät verfügbar.",
    "Ankunft & Zeiterfassung – Alle Ereignisse vor Ort strukturiert erfassen.",
    "Ereignisse dokumentieren – Zustand, Maßnahmen, Übergabe in vordefinierten Feldern.",
    "PDF-Bericht generieren – Vollständiger Bericht automatisch erstellt und archiviert.",
  ];
  const features = [
    "Digitale Stammdatenverwaltung pro Objekt",
    "Mobiler Zugriff für Fahrer",
    "Strukturierte Zeiterfassung",
    "Ereignisprotokoll mit Kategorien",
    "Automatischer PDF-Bericht pro Einsatz",
    "Archivierung & Suchfunktion",
    "Anbindung an Leitstelle-Übersicht",
  ];
  const badges = [
    { i: FileText, l: "PDF-Bericht" },
    { i: Smartphone, l: "Mobil" },
    { i: Archive, l: "Archiv" },
    { i: Timer, l: "Zeiterfassung" },
  ];
  return (
    <section id="hnr" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-primary">Modul</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-success/15 text-success">✓ Vollständig entwickelt</span>
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">HNR-Modul – Hausnotruf</h2>
            <p className="mt-2 text-sm text-muted-foreground">Für Fahrer & Disponenten im Hausnotruf-Betrieb</p>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Das HNR-Modul digitalisiert den Hausnotruf-Einsatz vollständig — vom Abruf der Stammdaten beim Fahrer über die Zeiterfassung vor Ort bis zum abschließenden PDF-Bericht. Kein Zettelwirtschaft, kein nachträgliches Tippen.
            </p>

            <div className="mt-8">
              <div className="text-sm font-semibold mb-4">Ablauf im Einsatz</div>
              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="size-7 rounded-full bg-primary text-primary-foreground text-xs font-bold grid place-items-center shrink-0">{i + 1}</span>
                    <span className="text-sm text-muted-foreground pt-1">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2">
                <Phone className="size-5 text-primary" />
                <div className="font-semibold">Was das Modul liefert</div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="size-4 mt-0.5 text-success shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                {badges.map((b) => (
                  <span key={b.l} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs">
                    <b.i className="size-3.5 text-primary" /> {b.l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const reviews = [
    {
      n: "Michael K.",
      r: "Leitstellenleiter, Sicherheitsdienst NRW",
      t: "Endlich eine Oberfläche, die unsere Leitstelle wirklich versteht. Einsätze zuweisen, Status updaten, Notizen hinterlegen — alles ohne Umwege. Das Team war nach einem Tag drin.",
    },
    {
      n: "Sandra B.",
      r: "Betriebsleiterin, Sicherheits- & Pflegedienst",
      t: "Das HNR-Modul hat unsere Hausnotruf-Abläufe komplett verändert. Die Fahrer haben alles auf dem Handy, der PDF-Bericht läuft automatisch. Wir sparen täglich mindestens eine Stunde Büroarbeit.",
    },
    {
      n: "Thomas H.",
      r: "Geschäftsführer, Objekt- & Revierdienst",
      t: "Wir nutzen das Notdienst-Modul für unseren Telefonservice. Anruf rein, Maske ausfüllen, PDF an den Kunden — fertig. Professionell und schnell. Unsere Auftraggeber sind begeistert.",
    },
    {
      n: "Jana W.",
      r: "Disponentin, Wachdienst Berlin",
      t: "Der Zeitstrahl im Revier-Center ist Gold wert. Ich plane Bestreifungen jetzt visuell statt in Excel-Listen und sehe Konflikte sofort. Die Fahrer scannen NFC vor Ort — kein Diskutieren mehr, ob jemand wirklich da war.",
    },
    {
      n: "Christian R.",
      r: "Inhaber, Sicherheitsdienst Süddeutschland",
      t: "Die Mandantentrennung läuft sauber, RLS-Policies und Rollen passen genau zu unserem Aufbau. Als Geschäftsführer schlafe ich ruhiger, seit wir auf AlarmDesk umgestiegen sind.",
    },
    {
      n: "Petra L.",
      r: "Buchhaltung, Sicherheits- & Servicegruppe",
      t: "Abrechnung pro Auftraggeber, automatischer PDF-Versand, fertige Positionen aus den Einsätzen — was früher zwei Tage Arbeit war, geht jetzt in zwei Stunden. Unbezahlbar.",
    },
  ];
  return (
    <section id="bewertungen" className="py-24 bg-muted/20 border-y border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-primary">Stimmen aus der Praxis</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Was Kunden sagen.</h2>
          <p className="mt-4 text-muted-foreground">Frühe Nutzer über ihre Erfahrung mit AlarmDesk im täglichen Betrieb.</p>
        </div>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reviews.map((r) => (
            <figure key={r.n} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <Quote className="size-5 text-primary/60" />
              <div className="mt-3 flex items-center gap-0.5 text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 text-sm leading-relaxed text-foreground flex-1">
                „{r.t}"
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 pt-4 border-t border-border">
                <div className="size-9 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold">
                  {r.n.split(" ").map((p) => p[0]).join("")}
                </div>
                <div>
                  <div className="text-sm font-semibold">{r.n}</div>
                  <div className="text-xs text-muted-foreground">{r.r}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section id="sicherheit" className="py-24">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary">Sicherheit</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Schutz, der zu Ihrer Branche passt.</h2>
          <p className="mt-4 text-muted-foreground">Strikte Mandantentrennung, private Dokumenten-Speicher, signierte Download-Links, Row-Level-Security und Google-Login.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Domain-Scoped Rollen & Berechtigungen",
              "Verschlüsselte Speicherung sensibler Dokumente",
              "Audit-fähige Aktivitätsprotokolle",
              "DSGVO-konformes Hosting in Deutschland",
            ].map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 mt-0.5 text-success shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { i: Shield, t: "RLS", d: "Row-Level-Security" },
              { i: Lock, t: "Privat", d: "Storage-Buckets" },
              { i: Zap, t: "Schnell", d: "Edge-deployed" },
              { i: Users, t: "Multi-Tenant", d: "Mandantenfähig" },
            ].map((b) => (
              <div key={b.t} className="rounded-xl border border-border p-5">
                <b.i className="size-5 text-primary" />
                <div className="mt-3 font-semibold">{b.t}</div>
                <div className="text-xs text-muted-foreground mt-1">{b.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="rounded-3xl border border-border p-10 sm:p-14 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--primary) 18%, var(--card)), var(--card))" }}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Bereit, Ihre Einsätze zu modernisieren?</h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Loggen Sie sich ein und entdecken Sie AlarmDesk v4 — oder kontaktieren Sie uns für eine maßgeschneiderte Einführung.</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/login" className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition inline-flex items-center gap-2">
              Zur Anmeldung <ArrowRight className="size-4" />
            </Link>
            <a href="mailto:info@alarmdesk-software.de" className="h-11 px-6 rounded-xl border border-border hover:bg-accent font-medium transition inline-flex items-center">
              Kontakt aufnehmen
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <img src={logo} alt="AlarmDesk" className="size-6 rounded" />
          <span>© {new Date().getFullYear()} AlarmDesk Software</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/impressum" className="hover:text-foreground transition">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-foreground transition">Datenschutz</Link>
          <Link to="/login" className="hover:text-foreground transition">Anmelden</Link>
        </div>
      </div>
    </footer>
  );
}
