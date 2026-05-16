import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createBericht, getRohrserviceConfig } from "@/lib/rohrservice.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notdienst/rohrservice/neu")({
  component: NeuerBericht,
});

type Form = Record<string, any>;

function NeuerBericht() {
  const navigate = useNavigate();
  const createFn = useServerFn(createBericht);
  const cfgFn = useServerFn(getRohrserviceConfig);
  const { data: cfg } = useQuery({ queryKey: ["rs-config"], queryFn: () => cfgFn() });
  const isBudeko = cfg?.variante === "budeko";
  const [f, setF] = useState<Form>({});

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: (data: Form) => createFn({ data: data as any }),
    onSuccess: () => {
      toast.success("Bericht gespeichert");
      navigate({ to: "/notdienst/rohrservice/nachbearbeitung" });
    },
    onError: (e: any) => toast.error(e.message ?? "Speichern fehlgeschlagen"),
  });

  return (
    <div className="max-w-3xl">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const toIso = (v: any) => (v ? new Date(v).toISOString() : null);
          mut.mutate({
            ...f,
            zeit_kundenanruf: toIso(f.zeit_kundenanruf),
            zeit_weitergabe: toIso(f.zeit_weitergabe),
            zeit_rueckmeldung: toIso(f.zeit_rueckmeldung),
          });
        }}
      >
        <Section title="Anruf von:">
          <Field label="Name"><Input value={f.anrufer_name ?? ""} onChange={(e) => set("anrufer_name", e.target.value)} /></Field>
          <Field label="Telefonnummer"><Input value={f.anrufer_telefon ?? ""} onChange={(e) => set("anrufer_telefon", e.target.value)} /></Field>
          <Field label="Adresse"><Input value={f.anrufer_adresse ?? ""} onChange={(e) => set("anrufer_adresse", e.target.value)} /></Field>
          <Field label="Firma"><Input value={f.anrufer_firma ?? ""} onChange={(e) => set("anrufer_firma", e.target.value)} /></Field>
        </Section>

        {!isBudeko && (
          <Section title="Rechnungsempfänger:">
            <Field label="Name"><Input value={f.rechnung_name ?? ""} onChange={(e) => set("rechnung_name", e.target.value)} /></Field>
            <Field label="Adresse"><Input value={f.rechnung_adresse ?? ""} onChange={(e) => set("rechnung_adresse", e.target.value)} /></Field>
            <Field label="Telefonnummer"><Input value={f.rechnung_telefon ?? ""} onChange={(e) => set("rechnung_telefon", e.target.value)} /></Field>
          </Section>
        )}

        <Section title={isBudeko ? "Objekt / Mieter:" : "Mieter und Standort:"}>
          <Field label="Name"><Input value={f.mieter_name ?? ""} onChange={(e) => set("mieter_name", e.target.value)} /></Field>
          <Field label="Telefonnummer"><Input value={f.mieter_telefon ?? ""} onChange={(e) => set("mieter_telefon", e.target.value)} /></Field>
          <Field label="Straße/Hausnummer"><Input value={f.mieter_strasse ?? ""} onChange={(e) => set("mieter_strasse", e.target.value)} /></Field>
          <Field label="Ort"><Input value={f.mieter_ort ?? ""} onChange={(e) => set("mieter_ort", e.target.value)} /></Field>
        </Section>

        <Section title="Störungsart:" cols={1}>
          <Field label=""><Textarea rows={4} value={f.stoerungsart ?? ""} onChange={(e) => set("stoerungsart", e.target.value)} /></Field>
        </Section>

        <Section title="Sofortweiterleitung der Daten:" cols={1}>
          <div className="flex flex-wrap gap-4">
            {[
              ["mail", "Ja, per Mail"],
              ["mobil", "Ja, per Mobil"],
              ["mail_naechster_tag", "Nein, per Mail am nächsten Werktag"],
            ].map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="weiterleitung"
                  value={v}
                  checked={f.weiterleitung === v}
                  onChange={() => set("weiterleitung", v)}
                />
                {label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Zeitangaben:" cols={3}>
          <Field label="Datum des Kundenanrufes">
            <Input type="datetime-local" value={f.zeit_kundenanruf ?? ""} onChange={(e) => set("zeit_kundenanruf", e.target.value)} />
          </Field>
          <Field label="Datum der Weitergabe an">
            <Input type="datetime-local" value={f.zeit_weitergabe ?? ""} onChange={(e) => set("zeit_weitergabe", e.target.value)} />
          </Field>
          <Field label={isBudeko ? "Name der Bereitschaft" : "Name des Monteurs"}>
            <Input value={f.monteur_weitergabe ?? ""} onChange={(e) => set("monteur_weitergabe", e.target.value)} />
          </Field>
          {!isBudeko && (
            <>
              <Field label="Datum der Rückmeldung von">
                <Input type="datetime-local" value={f.zeit_rueckmeldung ?? ""} onChange={(e) => set("zeit_rueckmeldung", e.target.value)} />
              </Field>
              <Field label="Name des Monteurs">
                <Input value={f.monteur_rueckmeldung ?? ""} onChange={(e) => set("monteur_rueckmeldung", e.target.value)} />
              </Field>
            </>
          )}
        </Section>

        <Section title="" cols={1}>
          <Field label="Diensthabender Alarmzentrale">
            <Input value={f.diensthabender_alarmzentrale ?? ""} onChange={(e) => set("diensthabender_alarmzentrale", e.target.value)} />
          </Field>
        </Section>

        <Button type="submit" className="w-full" disabled={mut.isPending}>
          {mut.isPending ? "Speichern…" : "Speichern"}
        </Button>
      </form>
    </div>
  );
}

function Section({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const grid = cols === 1 ? "" : cols === 2 ? "grid sm:grid-cols-2 gap-4" : "grid sm:grid-cols-3 gap-4";
  return (
    <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      {title && (
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{title}</div>
      )}
      <div className={grid}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      {children}
    </div>
  );
}