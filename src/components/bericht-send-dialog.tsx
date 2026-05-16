import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Download, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadEinsatzPdf, einsatzPdfBase64 } from "@/lib/einsatz-pdf";
import { sendBerichtEmail } from "@/lib/bericht-email.functions";
import { updateKundenEmail } from "@/lib/einsaetze.functions";

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
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (einsatz) setEmail(einsatz.kunden_email ?? "");
  }, [einsatz?.id, open]);

  if (!einsatz) return null;

  function handleDownload() {
    downloadEinsatzPdf(einsatz, fahrerName);
  }

  async function handleSend() {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Bitte gültige E-Mail-Adresse eingeben");
      return;
    }
    setBusy(true);
    try {
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
      // Adresse fürs nächste Mal merken
      if (einsatz.kunden_email !== email) {
        await saveEmail({ data: { id: einsatz.id, email } }).catch(() => null);
      }
      toast.success("Bericht per Mail versendet");
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
            />
            <p className="text-xs text-muted-foreground">
              Der Bericht wird als PDF im Anhang-Link verschickt (30 Tage gültig).
            </p>
          </div>

          <Button variant="outline" onClick={handleDownload} className="w-full gap-2">
            <Download className="size-4" /> PDF herunterladen
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSend} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Per Mail senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}