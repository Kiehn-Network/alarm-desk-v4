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
  const [padAvailable, setPadAvailable] = useState(false);
  const [padBusy, setPadBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    isSignotecAvailable().then((v) => { if (alive) setPadAvailable(v); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, [value]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
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
    onChange(c.toDataURL("image/png"), "touch");
  }

  function clear() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(null, null);
  }

  async function capturePad() {
    setPadBusy(true);
    try {
      const img = await captureSignotecSignature({ who, reason: "Schlüsselübergabe" });
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

      {value ? (
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
          onPointerLeave={end}
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        {padAvailable
          ? "signotec Sigma LITE erkannt – oder direkt hier mit Finger/Maus unterschreiben."
          : "Kein signotec-Dienst erkannt – bitte mit Finger/Maus unterschreiben."}
      </p>
    </div>
  );
}
