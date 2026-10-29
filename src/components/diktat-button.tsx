import { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const ZIEL_RATE = 16000;

function encodeWav(chunks: Float32Array[], inRate: number): Blob {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  const ratio = inRate / ZIEL_RATE;
  const len = Math.floor(total / ratio);
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const tag = (p: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i)); };
  tag(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); tag(8, "WAVE"); tag(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, ZIEL_RATE, true); v.setUint32(28, ZIEL_RATE * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); tag(36, "data"); v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const a = Math.floor(i * ratio), b = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0; for (let j = a; j < b; j++) sum += all[j];
    const s = Math.max(-1, Math.min(1, sum / Math.max(1, b - a)));
    v.setInt16(44 + i * 2, s * (s < 0 ? 32768 : 32767), true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** Mikrofon-Knopf: aufnehmen → Text (grammatikalisch korrigiert) wird angehängt. */
export function DiktatButton({ feld, onText, disabled }: { feld: string; onText: (t: string) => void; disabled?: boolean }) {
  const [phase, setPhase] = useState<"idle" | "rec" | "busy">("idle");
  const [sek, setSek] = useState(0);
  const stopRef = useRef<null | (() => Blob)>(null);
  const timer = useRef<number | null>(null);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) { toast.error("Dieses Gerät unterstützt keine Sprachaufnahme."); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { toast.error("Kein Mikrofon-Zugriff. Bitte in den Browser-Einstellungen erlauben."); return; }
    const ctx = new AudioContext();
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(node); node.connect(ctx.destination);
    stopRef.current = () => {
      stream.getTracks().forEach((t) => t.stop());
      node.disconnect(); src.disconnect(); node.onaudioprocess = null;
      const blob = encodeWav(chunks, ctx.sampleRate);
      void ctx.close();
      return blob;
    };
    setSek(0); setPhase("rec");
    timer.current = window.setInterval(() => setSek((s) => {
      if (s + 1 >= 600) void stop();
      return s + 1;
    }), 1000);
  }

  async function stop() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    const fn = stopRef.current; stopRef.current = null;
    if (!fn) return;
    const blob = fn();
    if (blob.size < 8000) { setPhase("idle"); toast.error("Aufnahme zu kurz – bitte länger sprechen."); return; }
    setPhase("busy");
    try {
      const { data } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append("file", new File([blob], "aufnahme.wav", { type: "audio/wav" }));
      fd.append("feld", feld);
      const res = await fetch("/api/diktat", {
        method: "POST", body: fd,
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.text) throw new Error(j.error ?? "Spracherkennung fehlgeschlagen");
      onText(j.text);
      toast.success(j.korrigiert ? "Text erkannt und korrigiert – bitte kurz prüfen." : "Text erkannt – bitte kurz prüfen.");
    } catch (e: any) {
      toast.error(e?.message ?? "Spracherkennung fehlgeschlagen");
    } finally { setPhase("idle"); }
  }

  if (phase === "rec") return (
    <Button type="button" size="sm" variant="destructive" onClick={stop} className="gap-1">
      <Square className="h-3.5 w-3.5" /> Stopp {Math.floor(sek / 60)}:{String(sek % 60).padStart(2, "0")}
    </Button>
  );
  return (
    <Button type="button" size="sm" variant="outline" disabled={disabled || phase === "busy"} onClick={start} className="gap-1">
      {phase === "busy" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Wird geschrieben…</> : <><Mic className="h-3.5 w-3.5" /> Diktieren</>}
    </Button>
  );
}
