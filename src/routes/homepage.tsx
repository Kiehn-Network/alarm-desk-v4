import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield, Radar, MapPin, FileText, Bell, Users, KeyRound, Activity,
  CheckCircle2, ArrowRight, Sparkles, Lock, Zap,
} from "lucide-react";
import logo from "@/assets/alarmdesk-logo.png";

export const Route = createFileRoute("/homepage")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
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

        <div className="mt-16 mx-auto max-w-5xl rounded-2xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-elegant, 0 30px 80px -30px rgba(0,0,0,0.4))" }}>
          <div className="h-10 border-b border-border flex items-center gap-1.5 px-4 bg-muted/30">
            <span className="size-2.5 rounded-full bg-destructive/60" />
            <span className="size-2.5 rounded-full bg-warning/60" />
            <span className="size-2.5 rounded-full bg-success/60" />
            <span className="ml-3 text-xs text-muted-foreground">app.alarmdesk-software.de/dashboard</span>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l: "Aktive Einsätze", v: "12", i: Activity, tone: "text-success" },
              { l: "Monat", v: "248", i: Radar, tone: "text-info" },
              { l: "Objekte", v: "84", i: MapPin, tone: "text-warning" },
              { l: "Schlüssel", v: "31", i: KeyRound, tone: "text-primary" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-border p-4">
                <s.i className={`size-5 ${s.tone}`} />
                <div className="mt-3 text-2xl font-bold tabular-nums">{s.v}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
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
    { t: "Einsatzverwaltung", d: "Erstellen, Bearbeiten, Hold-Button, Statusampel, Berichte." },
    { t: "Revier-Center / OWKS", d: "Objekte, NFC-Punkte, Rundgänge, Zeitstrahl, Bestreifungspläne." },
    { t: "ESRP", d: "Automatischer und manueller Versand an Drittsysteme, Outbox & Wiederholung." },
    { t: "Notdienste", d: "Kundenspezifische Module — individuelle Formulare und PDF-Vorlagen." },
    { t: "Abrechnung", d: "Pro Auftraggeber, mit PDF-Versand und Dienstplänen." },
    { t: "Stammdaten", d: "Kunden, Schlüsselbuch, Import, Dateien — alles an einem Ort." },
  ];
  return (
    <section id="module" className="py-24 bg-muted/20 border-y border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-primary">Module</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Eine Plattform, viele Spezialisten.</h2>
          <p className="mt-4 text-muted-foreground">Aktivieren Sie nur, was Ihre Domäne braucht — wir erweitern AlarmDesk individuell für Ihre Abläufe.</p>
        </div>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {mods.map((m) => (
            <div key={m.t} className="rounded-2xl border border-border bg-card p-6">
              <div className="font-semibold">{m.t}</div>
              <div className="text-sm text-muted-foreground mt-2 leading-relaxed">{m.d}</div>
            </div>
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
          <a href="https://v4.alarmdesk-software.de" className="hover:text-foreground transition">Website</a>
          <Link to="/login" className="hover:text-foreground transition">Anmelden</Link>
        </div>
      </div>
    </footer>
  );
}
