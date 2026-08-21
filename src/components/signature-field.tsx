import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PenLine, Eraser, Tablet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { captureSignotecSignature, isSignotecAvailable } from "@/lib/signotec";

type Props = {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null, source: "pad" | "touch" | null) => void;
  who?: string;
};

export function SignatureField({ label, value, onChange, who }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const sized = useRef(false);
  const [padAvailable, setPadAvailable] = useState(false);
  const [padBusy, setPadBusy] = useState(false);
  // "draw" = Leinwand aktiv (weiterzeichnen möglich), "image" = fertiges Bild anzeigen
  const [mode, setMode] = useState<"draw" | "image">(value ? "image" : "draw");

  useEffect(() => {
    let alive = true;
    isSignotecAvailable().then((v) => { if (alive) setPadAvailable(v); });
    return () => { alive = false; };
  }, []);

  // Externes Bild (z. B. Pad oder geladener Datensatz) anzeigen,
  // aber niemals während/nach eigenem Zeichnen die Leinwand ersetzen.
  useEffect(() => {
    if (!value) { setMode("draw"); return; }
    if (!dirty.current) setMode("image");
  }, [value]);

  function setupCanvas() {
    const c = canvasRef.current;
    if (!c || sized.current) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    sized.current = true;
  }

  useEffect(() => {
    if (mode === "draw") setupCanvas();
    else sized.current = false;
  }, [mode]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    setupCanvas();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirty.current = true;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const c = canvasRef.current;
    if (!c || !dirty.current) return;
    // Zwischenstand speichern, Leinwand bleibt aktiv → weiterzeichnen möglich
    onChange(c.toDataURL("image/png"), "touch");
  }

  function clear() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    setMode("draw");
    onChange(null, null);
  }

  async function capturePad() {
    setPadBusy(true);
    try {
      const img = await captureSignotecSignature({ who, reason: "Schlüsselübergabe" });
      dirty.current = false;
      setMode("image");
      onChange(img, "pad");
      toast.success("Unterschrift vom Pad übernommen");
    } catch (e: any) {
      toast.error(e?.message ?? "Pad-Unterschrift fehlgeschlagen");
      setPadAvailable(false);
    } finally {
      setPadBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5"><PenLine className="size-3.5" /> {label}</Label>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="outline" onClick={capturePad} disabled={padBusy}>
            {padBusy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Tablet className="size-3.5 mr-1" />}
            signotec Pad
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clear}>
            <Eraser className="size-3.5 mr-1" /> Löschen
          </Button>
        </div>
      </div>

      {mode === "image" && value ? (
        <div className="rounded-lg border border-border bg-white h-28 flex items-center justify-center overflow-hidden">
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full h-28 rounded-lg border border-dashed border-border bg-white touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        {padAvailable
          ? "signotec Sigma LITE erkannt – oder direkt hier mit Finger/Maus unterschreiben."
          : "Mit Finger/Maus unterschreiben – Sie können nach dem Absetzen beliebig weiterschreiben."}
      </p>
    </div>
  );
}

