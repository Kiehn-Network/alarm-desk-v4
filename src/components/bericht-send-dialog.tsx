import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Download, Loader2, Cable } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadEinsatzPdf, einsatzPdfBase64 } from "@/lib/einsatz-pdf";
import { sendBerichtEmail } from "@/lib/bericht-email.functions";
import { updateKundenEmail } from "@/lib/einsaetze.functions";
import { enqueueEinsatzToErp, getEsrpSettings } from "@/lib/esrp.functions";
import { useDomainModules } from "@/hooks/use-domain-modules";

export function BerichtSendDialog({
  einsatz, fahrerName, open, onClose,
}: {
  einsatz: any | null;
  fahrerName: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const send = useServerFn(sendBerichtEmail);
  const saveEmail = useServerFn(updateKundenEmail);
  const sendErp = useServerFn(enqueueEinsatzToErp);
  const getErp = useServerFn(getEsrpSettings);
  const { data: modules } = useDomainModules();
  const esrpEnabled = !!modules?.has("esrp");
  const { data: erpSettings } = useQuery({
    queryKey: ["esrp-settings", "dialog"],
    queryFn: () => getErp(),
    enabled: esrpEnabled && open,
  });
  const erpAvailable = esrpEnabled && !!erpSettings?.aktiv;

  const [email, setEmail] = useState("");
  const [sendPdf, setSendPdf] = useState(true);
  const [sendErpFlag, setSendErpFlag] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (einsatz) setEmail(einsatz.kunden_email ?? "");
  }, [einsatz?.id, open]);

  useEffect(() => {
    if (open) {
      setSendPdf(true);
      setSendErpFlag(erpAvailable);
    }
  }, [open, erpAvailable]);

  if (!einsatz) return null;

  function handleDownload() {
    downloadEinsatzPdf(einsatz, fahrerName);
  }

  async function handleSend() {
    if (!sendPdf && !sendErpFlag) {
      toast.error("Bitte mindestens eine Versand-Option wählen");
      return;
    }
    if (sendPdf && !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Bitte gültige E-Mail-Adresse eingeben");
      return;
    }
    setBusy(true);
    try {
      if (sendPdf) {
        const base64 = einsatzPdfBase64(einsatz, fahrerName);
        const filename = `Einsatzbericht_${String(einsatz.id).slice(0, 8)}.pdf`;
        await send({
          data: {
            einsatz_id: einsatz.id,
            recipient_email: email,
            pdf_base64: base64,
            filename,
          },
        });
        if (einsatz.kunden_email !== email) {
          await saveEmail({ data: { id: einsatz.id, email } }).catch(() => null);
        }
        toast.success("Bericht per Mail versendet");
      }
      if (sendErpFlag) {
        try {
          await sendErp({ data: { einsatz_id: einsatz.id } });
          toast.success("An ERP übergeben");
        } catch (e: any) {
          toast.error("ERP-Versand: " + (e?.message ?? "Fehler"));
        }
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Versand fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bericht senden / herunterladen</DialogTitle>
          <DialogDescription className="truncate">
            {einsatz.einsatzgrund}{einsatz.kunden_name ? ` · ${einsatz.kunden_name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kunden-email">E-Mail des Kunden</Label>
            <Input
              id="kunden-email"
              type="email"
              autoComplete="email"
              placeholder="kunde@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!sendPdf}
            />
            <p className="text-xs text-muted-foreground">
              Der Bericht wird als PDF im Anhang-Link verschickt (30 Tage gültig).
            </p>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Versand-Optionen</div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={sendPdf} onCheckedChange={(v) => setSendPdf(!!v)} />
              <Mail className="size-4" />
              <span>PDF an Kunde per E-Mail</span>
            </label>
            <label className={`flex items-center gap-2 text-sm ${erpAvailable ? "cursor-pointer" : "opacity-50"}`}>
              <Checkbox
                checked={sendErpFlag && erpAvailable}
                disabled={!erpAvailable}
                onCheckedChange={(v) => setSendErpFlag(!!v)}
              />
              <Cable className="size-4" />
              <span>
                An ERP übermitteln
                {esrpEnabled && !erpSettings?.aktiv && (
                  <span className="ml-2 text-xs text-muted-foreground">(nicht aktiviert)</span>
                )}
                {!esrpEnabled && (
                  <span className="ml-2 text-xs text-muted-foreground">(Modul nicht freigeschaltet)</span>
                )}
              </span>
            </label>
          </div>

          <Button variant="outline" onClick={handleDownload} className="w-full gap-2">
            <Download className="size-4" /> PDF herunterladen
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSend} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}