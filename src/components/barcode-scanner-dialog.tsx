import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
};

/** Kamera-Scanner für Handy/Tablet – erkennt Barcodes und QR-Codes. */
export function BarcodeScannerDialog({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let controls: { stop: () => void } | null = null;

    (async () => {
      setStarting(true);
      setError(null);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video,
          (result) => {
            if (cancelled || !result) return;
            const text = result.getText?.() ?? "";
            if (!text) return;
            cancelled = true;
            try { controls?.stop(); } catch { /* ignore */ }
            onDetected(text.trim());
            onOpenChange(false);
          },
        );
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Kamera konnte nicht gestartet werden.");
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      try { controls?.stop(); } catch { /* ignore */ }
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5" /> Mit Kamera scannen
          </DialogTitle>
          <DialogDescription>
            Barcode oder QR-Code in den Rahmen halten. Die Erkennung erfolgt automatisch.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-xl border border-border bg-black aspect-video">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-primary/70" />
          {starting && (
            <div className="absolute inset-0 grid place-items-center text-primary-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button variant="outline" onClick={() => onOpenChange(false)}>
          <X className="size-4" /> Abbrechen
        </Button>
      </DialogContent>
    </Dialog>
  );
}
