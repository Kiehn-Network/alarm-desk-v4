import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Palette, Save, Loader2, Upload, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getDomainEmailBranding, upsertDomainEmailBranding,
} from "@/lib/email-settings.functions";
import {
  DEFAULT_BRANDING, EMAIL_LAYOUTS, normalizeBranding, renderBrandedEmail,
  type EmailLayout,
} from "@/lib/email-brand";
import { EMAIL_THEMES, type EmailThemePreset } from "@/lib/email-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Form = {
  brand_logo_url: string;
  brand_primary_color: string;
  brand_header_label: string;
  brand_greeting: string;
  brand_signature: string;
  brand_footer_html: string;
  brand_layout: EmailLayout;
};

const EMPTY: Form = {
  brand_logo_url: "",
  brand_primary_color: DEFAULT_BRANDING.primary_color,
  brand_header_label: DEFAULT_BRANDING.header_label,
  brand_greeting: DEFAULT_BRANDING.greeting,
  brand_signature: DEFAULT_BRANDING.signature,
  brand_footer_html: DEFAULT_BRANDING.footer_html,
  brand_layout: DEFAULT_BRANDING.layout,
};

export function EmailBrandingPanel() {
  const get = useServerFn(getDomainEmailBranding);
  const upsert = useServerFn(upsertDomainEmailBranding);
  const qc = useQueryClient();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["domain-email-branding"],
    queryFn: () => get(),
  });

  const [form, setForm] = useState<Form>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fromName = q.data?.branding?.from_name ?? null;

  useEffect(() => {
    const b = q.data?.branding;
    if (!b) return;
    setForm({
      brand_logo_url: b.brand_logo_url ?? "",
      brand_primary_color: b.brand_primary_color || DEFAULT_BRANDING.primary_color,
      brand_header_label: b.brand_header_label || DEFAULT_BRANDING.header_label,
      brand_greeting: b.brand_greeting || DEFAULT_BRANDING.greeting,
      brand_signature: b.brand_signature || DEFAULT_BRANDING.signature,
      brand_footer_html: b.brand_footer_html || DEFAULT_BRANDING.footer_html,
      brand_layout: (b as any).brand_layout || DEFAULT_BRANDING.layout,
    });
  }, [q.data?.branding]);

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          brand_logo_url: form.brand_logo_url.trim() || null,
          brand_primary_color: form.brand_primary_color || null,
          brand_header_label: form.brand_header_label.trim() || null,
          brand_greeting: form.brand_greeting.trim() || null,
          brand_signature: form.brand_signature.trim() || null,
          brand_footer_html: form.brand_footer_html.trim() || null,
          brand_layout: form.brand_layout,
        },
      }),
    onSuccess: () => {
      toast.success("E-Mail-Design gespeichert");
      qc.invalidateQueries({ queryKey: ["domain-email-branding"] });
    },
    onError: (e: any) => toast.error("Speichern fehlgeschlagen: " + (e?.message ?? e)),
  });

  async function onPickLogo(f: File) {
    if (!user) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Logo max. 2 MB");
      return;
    }
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/i.test(f.type)) {
      toast.error("Nur Bilddateien (PNG, JPG, WEBP, SVG, GIF)");
      return;
    }
    setUploading(true);
    try {
      const ext = (f.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `email-branding/${user.id}/logo-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("logos").upload(path, f, {
        contentType: f.type, upsert: true, cacheControl: "3600",
      });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      setForm((s) => ({ ...s, brand_logo_url: data.publicUrl }));
      toast.success("Logo hochgeladen");
    } catch (e: any) {
      toast.error("Upload fehlgeschlagen: " + (e?.message ?? e));
    } finally {
      setUploading(false);
    }
  }

  const previewHtml = useMemo(() => {
    const branding = normalizeBranding({
      logo_url: form.brand_logo_url || null,
      primary_color: form.brand_primary_color,
      header_label: form.brand_header_label,
      greeting: form.brand_greeting,
      signature: form.brand_signature,
      footer_html: form.brand_footer_html,
      from_name: fromName,
      layout: form.brand_layout,
    });
    return renderBrandedEmail({
      branding,
      brandName: branding.from_name || "AlarmDesk",
      statusPill: "Einsatzbericht",
      heading: "Ihr Einsatzbericht",
      greetingName: "Max Mustermann",
      intro: 'anbei erhalten Sie den Bericht zu Ihrem Einsatz "Alarm Objekt 12" als PDF-Dokument.',
      metaTitle: "Alarm Objekt 12",
      metaSubtitle: "PDF · Download 30 Tage gültig",
      ctaLabel: "Bericht herunterladen",
      ctaUrl: "https://example.com/bericht.pdf",
      closingNote: "Bei Rückfragen wenden Sie sich bitte an die zuständige Ansprechperson.",
      previewText: "Ihr Einsatzbericht als PDF",
    });
  }, [form, fromName]);

  function applyPreset(p: EmailThemePreset) {
    setForm((s) => ({
      ...s,
      brand_layout: p.values.brand_layout,
      brand_primary_color: p.values.brand_primary_color,
      brand_header_label: p.values.brand_header_label,
      brand_greeting: p.values.brand_greeting,
      brand_signature: p.values.brand_signature,
      brand_footer_html: p.values.brand_footer_html,
    }));
    toast.success(`Theme "${p.name}" übernommen — nicht vergessen zu speichern`);
  }

  if (q.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lädt Design-Einstellungen …
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-6 border-b border-border flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Palette className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">E-Mail-Design & Branding</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Passe Logo, Farbe, Begrüßung, Signatur und Fußtext für alle E-Mails deiner Domäne an
            (Einsatzbericht, Monatsabrechnung, Testmail).
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 p-6">
        {/* --- Form --- */}
        <div className="space-y-5">
          {/* Themes / Presets */}
          <div className="space-y-2">
            <Label>Themes</Label>
            <p className="text-xs text-muted-foreground">
              Wähle ein vorgefertigtes Design als Startpunkt. Alle Felder bleiben danach frei anpassbar.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EMAIL_THEMES.map((p) => {
                const active =
                  form.brand_primary_color.toLowerCase() === p.values.brand_primary_color.toLowerCase();
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`text-left rounded-lg border p-3 transition hover:border-primary/60 hover:bg-accent/40 ${
                      active ? "border-primary ring-1 ring-primary/40 bg-accent/30" : "border-border bg-background"
                    }`}
                    title={p.description}
                  >
                    <div className="flex items-center gap-1 mb-2">
                      {p.swatches.map((c, i) => (
                        <span
                          key={i}
                          className="h-4 w-4 rounded-full border border-border/60"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="text-sm font-medium leading-tight">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {p.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
                {form.brand_logo_url ? (
                  <img src={form.brand_logo_url} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">kein Logo</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickLogo(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => fileRef.current?.click()} disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {form.brand_logo_url ? "Logo ersetzen" : "Logo hochladen"}
              </Button>
              {form.brand_logo_url && (
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => setForm((s) => ({ ...s, brand_logo_url: "" }))}
                >
                  Entfernen
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Wird links im E-Mail-Header angezeigt. Empfohlen: quadratisch, ≥ 128 px. Max. 2 MB.
            </p>
          </div>

          {/* Layout */}
          <div className="space-y-2">
            <Label>Layout</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EMAIL_LAYOUTS.map((l) => {
                const active = form.brand_layout === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, brand_layout: l.id }))}
                    className={`text-left rounded-lg border p-3 transition hover:border-primary/60 hover:bg-accent/40 ${
                      active ? "border-primary ring-1 ring-primary/40 bg-accent/30" : "border-border bg-background"
                    }`}
                    title={l.description}
                  >
                    <div className="text-sm font-medium leading-tight">{l.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {l.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Farbe */}
          <div className="space-y-2">
            <Label>Markenfarbe</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.brand_primary_color}
                onChange={(e) => setForm((s) => ({ ...s, brand_primary_color: e.target.value }))}
                className="h-10 w-14 rounded-md border border-border bg-transparent cursor-pointer"
                aria-label="Markenfarbe wählen"
              />
              <Input
                value={form.brand_primary_color}
                onChange={(e) => setForm((s) => ({ ...s, brand_primary_color: e.target.value }))}
                placeholder="#2563eb"
                className="max-w-[140px] font-mono"
              />
              <span className="text-xs text-muted-foreground">
                Wird für Header-Kachel, CTA-Button und Akzente verwendet.
              </span>
            </div>
          </div>

          {/* Header-Label */}
          <div className="space-y-2">
            <Label>Header-Label (kleiner Text unter Firmenname, optional)</Label>
            <Input
              value={form.brand_header_label}
              onChange={(e) => setForm((s) => ({ ...s, brand_header_label: e.target.value }))}
              placeholder={DEFAULT_BRANDING.header_label}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Kann leer gelassen werden — dann erscheint nur der Firmenname im Header.
            </p>
          </div>

          {/* Begrüßung */}
          <div className="space-y-2">
            <Label>Begrüßung</Label>
            <Input
              value={form.brand_greeting}
              onChange={(e) => setForm((s) => ({ ...s, brand_greeting: e.target.value }))}
              placeholder={DEFAULT_BRANDING.greeting}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              Platzhalter <code className="text-xs">{"{{kunde}}"}</code> wird durch den Kundennamen ersetzt
              (oder weggelassen, wenn kein Kunde bekannt ist).
            </p>
          </div>

          {/* Signatur */}
          <div className="space-y-2">
            <Label>Signatur</Label>
            <Textarea
              value={form.brand_signature}
              onChange={(e) => setForm((s) => ({ ...s, brand_signature: e.target.value }))}
              placeholder={DEFAULT_BRANDING.signature}
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Fußtext */}
          <div className="space-y-2">
            <Label>Fußtext</Label>
            <Textarea
              value={form.brand_footer_html}
              onChange={(e) => setForm((s) => ({ ...s, brand_footer_html: e.target.value }))}
              placeholder={DEFAULT_BRANDING.footer_html}
              rows={3}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              Erscheint unten in jeder E-Mail. Zeilenumbrüche werden übernommen.
            </p>
          </div>

          {/* Info: Absender */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Absender-Name & -Adresse</strong> werden weiter oben unter
            „E-Mail-Versand“ eingestellt. Aktuell:{" "}
            <span className="font-mono">{fromName ?? "— nicht gesetzt —"}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Speichern
            </Button>
            <Button
              variant="outline"
              onClick={() => setForm(EMPTY)}
              disabled={save.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Auf Standard zurücksetzen
            </Button>
          </div>
        </div>

        {/* --- Preview --- */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> Live-Vorschau (Beispiel: Einsatzbericht)
          </Label>
          <div className="rounded-lg border border-border bg-[#f8fafc] overflow-hidden">
            <iframe
              title="E-Mail-Vorschau"
              srcDoc={previewHtml}
              sandbox=""
              className="w-full h-[720px] border-0 bg-white"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Änderungen erscheinen sofort in der Vorschau. Der Versand nutzt genau dieses Design.
          </p>
        </div>
      </div>
    </div>
  );
}