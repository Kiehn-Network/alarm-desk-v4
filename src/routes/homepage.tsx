import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
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
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.classList.contains("light") ? "light" : html.classList.contains("dark") ? "dark" : null;
    html.classList.remove("dark");
    html.classList.add("light");
    return () => {
      html.classList.remove("light");
      if (prev) html.classList.add(prev);
    };
  }, []);
  return (
    <div
      className="min-h-screen text-[#0f172a] selection:bg-[#4f46e5]/30"
      style={{ backgroundColor: "#f8fafc", fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif" }}
    >
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
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#f8fafc]/80 border-b border-[#e2e8f0]/60">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="AlarmDesk Logo" className="size-8 rounded-md" />
          <span className="font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>AlarmDesk</span>
          <span className="ml-1 text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#4f46e5]/15 text-[#4338ca] border border-[#4f46e5]/30">v4</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600">
          <a href="#features" className="hover:text-slate-900 transition">Funktionen</a>
          <a href="#module" className="hover:text-slate-900 transition">Module</a>
          <a href="#sicherheit" className="hover:text-slate-900 transition">Sicherheit</a>
          <Link to="/hilfe" className="hover:text-slate-900 transition">Hilfe</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="h-9 px-3 rounded-lg text-sm text-slate-700 hover:bg-[#ffffff] hover:text-slate-900 transition inline-flex items-center">
            Anmelden
          </Link>
          <Link to="/login" className="h-9 px-4 rounded-lg text-sm font-medium bg-[#4f46e5] text-white hover:bg-[#4338ca] transition inline-flex items-center gap-1.5 shadow-lg shadow-[#4f46e5]/20">
            Demo starten <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-16 lg:pt-28 lg:pb-24 px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[80%] h-[520px] rounded-full opacity-70"
        style={{ background: "radial-gradient(60% 60% at 50% 40%, rgba(79,70,229,0.28), transparent 70%)", filter: "blur(120px)" }}
      />
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#e2e8f0]/50 border border-[#4f46e5]/30 text-[#4f46e5]">
          <span className="flex h-2 w-2 rounded-full bg-[#4f46e5]" />
          <Sparkles className="size-3.5 text-[#4338ca]" /> Version 4 ist da
        </span>
        <h1
          className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-700"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          Einsatzmanagement,<br className="hidden sm:block" /> neu definiert.
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-slate-600 leading-relaxed">
          AlarmDesk bündelt Einsätze, Revier-Center, Notdienste, Abrechnung und Kundendaten in einer modernen, mandantenfähigen Plattform — live, mobil und sicher.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/login" className="h-12 px-7 rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold transition-all shadow-lg shadow-[#4f46e5]/25 inline-flex items-center gap-2">
            Jetzt anmelden <ArrowRight className="size-4" />
          </Link>
          <a href="#features" className="h-12 px-7 rounded-lg bg-[#ffffff] border border-[#e2e8f0] hover:bg-[#e2e8f0] text-slate-900 font-semibold transition-all inline-flex items-center">
            Funktionen entdecken
          </a>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-400" /> DSGVO-konform</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-400" /> Hosting in DE</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-400" /> Mandantenfähig</span>
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
    <div className="mt-20 mx-auto max-w-6xl relative text-left">
      <div aria-hidden className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-[#4f46e5]/20 to-transparent blur-lg opacity-60" />
      <div className="relative rounded-2xl border border-[#e2e8f0] bg-[#ffffff] overflow-hidden shadow-2xl">
      <div className="h-10 border-b border-[#e2e8f0] flex items-center gap-1.5 px-4 bg-[#f8fafc]/60">
        <span className="size-2.5 rounded-full bg-[#e2e8f0]" />
        <span className="size-2.5 rounded-full bg-[#e2e8f0]" />
        <span className="size-2.5 rounded-full bg-[#e2e8f0]" />
        <span className="ml-3 text-xs text-slate-600">v4.alarmdesk-software.de/dashboard</span>
      </div>
      <div className="grid grid-cols-[200px_1fr]">
        {/* Sidebar */}
        <aside className="border-r border-[#e2e8f0] bg-[#f8fafc]/40 p-3 hidden sm:block">
          <div className="flex items-center gap-2 px-2 py-2">
            <img src={logo} alt="" className="size-6 rounded" />
            <span className="text-sm font-semibold" style={{ fontFamily: "'Sora', sans-serif" }}>AlarmDesk</span>
          </div>
          <nav className="mt-3 space-y-0.5">
            {nav.map((n) => (
              <div key={n.l} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${n.active ? "bg-[#4f46e5]/15 text-[#4f46e5] border border-[#4f46e5]/30" : "text-slate-600"}`}>
                <n.i className="size-3.5" /> {n.l}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="p-5 space-y-5 min-w-0">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-600">Dashboard</div>
            <div className="text-lg font-bold mt-0.5 text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Guten Tag, Tim 👋</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.map((s) => (
              <div key={s.l} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc]/40 p-3">
                <div className="size-7 rounded-md grid place-items-center bg-[#4f46e5]/15 text-[#4f46e5] border border-[#4f46e5]/30">
                  <s.i className="size-3.5" />
                </div>
                <div className="mt-2 text-lg font-bold tabular-nums text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>{s.v.toLocaleString("de-DE")}</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-600 mt-0.5 truncate">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Letzte Einsätze</div>
                  <div className="text-[10px] text-slate-600">Übersicht der jüngsten Aktivitäten</div>
                </div>
                <TrendingUp className="size-4 text-[#4338ca]" />
              </div>
              <table className="w-full text-xs">
                <thead className="text-[9px] uppercase tracking-wider text-slate-600">
                  <tr className="border-b border-[#e2e8f0]">
                    <th className="text-left font-medium py-1.5">Datei</th>
                    <th className="text-left font-medium py-1.5 hidden md:table-cell">Fahrer</th>
                    <th className="text-left font-medium py-1.5 hidden md:table-cell">Start</th>
                    <th className="text-left font-medium py-1.5">Dauer</th>
                    <th className="text-left font-medium py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recents.map((r, i) => (
                    <tr key={i} className="border-b border-[#e2e8f0]/50 last:border-0">
                      <td className="py-2 truncate max-w-[180px] text-slate-800">{r.d}</td>
                      <td className="py-2 text-slate-600 hidden md:table-cell">{r.f}</td>
                      <td className="py-2 text-slate-600 hidden md:table-cell">{r.s}</td>
                      <td className="py-2 text-slate-600 tabular-nums">{r.du}</td>
                      <td className="py-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] ${statusTone[r.st]}`}>{r.st}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc]/40 p-4">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-600">
                  <Clock className="size-3" /> Durchschnitt (Monat)
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-600">Einsatzdauer</span><span className="font-medium tabular-nums text-slate-900">52m</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Anfahrt</span><span className="font-medium tabular-nums text-slate-900">14m</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Reaktionszeit</span><span className="font-medium tabular-nums text-slate-900">6m</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc]/40 p-4">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-600">
                  <Users className="size-3" /> Top Teilnehmer
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  {[
                    { n: "T. Schneider", v: 48 },
                    { n: "K. Bauer", v: 36 },
                    { n: "A. Yilmaz", v: 29 },
                  ].map((p) => (
                    <div key={p.n} className="flex items-center justify-between">
                      <span className="text-slate-800">{p.n}</span>
                      <span className="text-slate-600 tabular-nums">{p.v}</span>
                    </div>
                  ))}
                </div>
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
    <div className="border-y border-[#e2e8f0] bg-[#ffffff]/40">
      <div className="max-w-7xl mx-auto px-6 py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-slate-600">
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
    <section id="features" className="py-24 bg-[#ffffff] border-y border-[#e2e8f0]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4338ca] font-semibold">Funktionen</div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Alles, was Ihr Team im Einsatz braucht.</h2>
          <p className="mt-4 text-slate-600 leading-relaxed">Von der Disposition bis zur Abrechnung — in einer einzigen, schnellen Oberfläche.</p>
        </div>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((f) => (
            <div key={f.t} className="group rounded-2xl border border-[#e2e8f0] bg-[#f8fafc]/60 p-6 hover:border-[#4f46e5]/60 hover:bg-[#f8fafc] transition-all">
              <div className="size-11 rounded-lg grid place-items-center bg-[#4f46e5]/10 text-[#4338ca] border border-[#4f46e5]/20 group-hover:bg-[#4f46e5]/20 transition-colors">
                <f.i className="size-5" />
              </div>
              <div className="mt-5 font-semibold text-slate-900 text-lg" style={{ fontFamily: "'Sora', sans-serif" }}>{f.t}</div>
              <div className="text-sm text-slate-600 mt-2 leading-relaxed">{f.d}</div>
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
    <section id="module" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4338ca] font-semibold">Module</div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Eine Plattform, viele Spezialisten.</h2>
          <p className="mt-4 text-slate-600 leading-relaxed">Aktivieren Sie nur, was Ihre Domäne braucht — wir erweitern AlarmDesk individuell für Ihre Abläufe.</p>
        </div>
        <div className="mt-14 grid md:grid-cols-2 gap-6">
          {mods.map((m) => (
            <div key={m.t} className="rounded-2xl border border-[#e2e8f0] bg-[#ffffff] p-7 hover:border-[#4f46e5]/60 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="size-11 rounded-lg grid place-items-center bg-[#4f46e5]/10 text-[#4338ca] border border-[#4f46e5]/20 shrink-0">
                  <m.i className="size-5" />
                </div>
                {m.badge && (
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-[#4f46e5] text-white font-semibold">{m.badge}</span>
                )}
              </div>
              <div className="mt-5 font-semibold text-lg text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>{m.t}</div>
              <div className="text-sm text-slate-600 mt-2 leading-relaxed">{m.d}</div>
              {m.tags && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {m.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f8fafc] text-slate-700 border border-[#e2e8f0]">{tag}</span>
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
    <section id="hnr" className="py-24 bg-[#ffffff] border-y border-[#e2e8f0]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[#4338ca] font-semibold">Modul</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">✓ Vollständig entwickelt</span>
            </div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>HNR-Modul – Hausnotruf</h2>
            <p className="mt-2 text-sm text-slate-600">Für Fahrer & Disponenten im Hausnotruf-Betrieb</p>
            <p className="mt-6 text-slate-600 leading-relaxed">
              Das HNR-Modul digitalisiert den Hausnotruf-Einsatz vollständig — vom Abruf der Stammdaten beim Fahrer über die Zeiterfassung vor Ort bis zum abschließenden PDF-Bericht. Kein Zettelwirtschaft, kein nachträgliches Tippen.
            </p>

            <div className="mt-8">
              <div className="text-sm font-semibold mb-4 text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Ablauf im Einsatz</div>
              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="size-7 rounded-full bg-[#4f46e5] text-white text-xs font-bold grid place-items-center shrink-0 shadow-lg shadow-[#4f46e5]/20">{i + 1}</span>
                    <span className="text-sm text-slate-700 pt-1 leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc]/60 p-7">
              <div className="flex items-center gap-2">
                <Phone className="size-5 text-[#4338ca]" />
                <div className="font-semibold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Was das Modul liefert</div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="size-4 mt-0.5 text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                {badges.map((b) => (
                  <span key={b.l} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ffffff] border border-[#e2e8f0] text-xs text-slate-700">
                    <b.i className="size-3.5 text-[#4338ca]" /> {b.l}
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
    <section id="bewertungen" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4338ca] font-semibold">Stimmen aus der Praxis</div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Was Kunden sagen.</h2>
          <p className="mt-4 text-slate-600 leading-relaxed">Frühe Nutzer über ihre Erfahrung mit AlarmDesk im täglichen Betrieb.</p>
        </div>
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <figure key={r.n} className="rounded-2xl border border-[#e2e8f0] bg-[#ffffff] p-6 flex flex-col hover:border-[#4f46e5]/60 transition-all">
              <Quote className="size-5 text-[#4f46e5]/70" />
              <div className="mt-3 flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 text-sm leading-relaxed text-slate-800 flex-1">
                „{r.t}"
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 pt-4 border-t border-[#e2e8f0]">
                <div className="size-9 rounded-full bg-[#4f46e5]/15 text-[#4f46e5] border border-[#4f46e5]/30 grid place-items-center text-xs font-bold">
                  {r.n.split(" ").map((p) => p[0]).join("")}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.n}</div>
                  <div className="text-xs text-slate-600">{r.r}</div>
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
    <section id="sicherheit" className="py-24 bg-[#ffffff] border-y border-[#e2e8f0]">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#4338ca] font-semibold">Sicherheit</div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Schutz, der zu Ihrer Branche passt.</h2>
          <p className="mt-4 text-slate-600 leading-relaxed">Strikte Mandantentrennung, private Dokumenten-Speicher, signierte Download-Links, Row-Level-Security und Google-Login.</p>
          <ul className="mt-8 space-y-3 text-sm text-slate-800">
            {[
              "Domain-Scoped Rollen & Berechtigungen",
              "Verschlüsselte Speicherung sensibler Dokumente",
              "Audit-fähige Aktivitätsprotokolle",
              "DSGVO-konformes Hosting in Deutschland",
            ].map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 mt-0.5 text-emerald-400 shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc]/60 p-8">
          <div className="grid grid-cols-2 gap-4">
            {[
              { i: Shield, t: "RLS", d: "Row-Level-Security" },
              { i: Lock, t: "Privat", d: "Storage-Buckets" },
              { i: Zap, t: "Schnell", d: "Edge-deployed" },
              { i: Users, t: "Multi-Tenant", d: "Mandantenfähig" },
            ].map((b) => (
              <div key={b.t} className="rounded-xl border border-[#e2e8f0] bg-[#ffffff]/60 p-5 hover:border-[#4f46e5]/50 transition-colors">
                <b.i className="size-5 text-[#4338ca]" />
                <div className="mt-3 font-semibold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>{b.t}</div>
                <div className="text-xs text-slate-600 mt-1">{b.d}</div>
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
        <div className="rounded-3xl border border-[#e2e8f0] p-10 sm:p-14 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(79,70,229,0.18), #ffffff 60%)" }}>
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-3/4 h-48 bg-[#4f46e5]/25 blur-[100px] rounded-full" />
          <h2 className="relative text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Bereit, Ihre Einsätze zu modernisieren?</h2>
          <p className="relative mt-4 text-slate-700 max-w-xl mx-auto leading-relaxed">Loggen Sie sich ein und entdecken Sie AlarmDesk v4 — oder kontaktieren Sie uns für eine maßgeschneiderte Einführung.</p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className="h-11 px-6 rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold transition-all inline-flex items-center gap-2 shadow-lg shadow-[#4f46e5]/25">
              Zur Anmeldung <ArrowRight className="size-4" />
            </Link>
            <a href="mailto:info@alarmdesk-software.de" className="h-11 px-6 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] hover:bg-[#e2e8f0] text-slate-900 font-semibold transition-all inline-flex items-center">
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
    <footer className="border-t border-[#e2e8f0] bg-[#f8fafc]">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <img src={logo} alt="AlarmDesk" className="size-6 rounded" />
          <span>© {new Date().getFullYear()} AlarmDesk Software · Ein Produkt vom Kiehn Network</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/impressum" className="hover:text-slate-900 transition">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-slate-900 transition">Datenschutz</Link>
          <Link to="/login" className="hover:text-slate-900 transition">Anmelden</Link>
        </div>
      </div>
    </footer>
  );
}
