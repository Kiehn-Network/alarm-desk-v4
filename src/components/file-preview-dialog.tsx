import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Loader2, ExternalLink } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getDateiSignedUrl } from "@/lib/dateien.functions";

function extOf(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "";
}

export function FilePreviewDialog({
  open, onClose, storagePath, filename, mimeType,
}: {
  open: boolean;
  onClose: () => void;
  storagePath: string;
  filename: string;
  mimeType?: string | null;
}) {
  const sign = useServerFn(getDateiSignedUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !storagePath) return;
    let cancelled = false;
    setLoading(true);
    setUrl(null);
    sign({ data: { storage_path: storagePath } })
      .then((res) => {
        if (cancelled) return;
        // append inline=1 so server returns inline disposition
        const u = res.url + (res.url.includes("?") ? "&" : "?") + "inline=1";
        setUrl(u);
      })
      .catch((e: any) => { if (!cancelled) toast.error(e?.message ?? "Fehler"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, storagePath, sign]);

  const ext = extOf(filename);
  const mt = (mimeType ?? "").toLowerCase();
  const isImage = mt.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg","bmp","avif"].includes(ext);
  const isPdf = mt === "application/pdf" || ext === "pdf";
  const isVideo = mt.startsWith("video/") || ["mp4","webm","mov","m4v"].includes(ext);
  const isAudio = mt.startsWith("audio/") || ["mp3","wav","ogg","m4a"].includes(ext);
  const isText = mt.startsWith("text/") || ["txt","md","csv","log","json","xml"].includes(ext);
  const previewable = isImage || isPdf || isVideo || isAudio || isText;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate text-base">{filename}</DialogTitle>
            <div className="flex items-center gap-1.5 mr-6">
              {url && (
                <>
                  <Button asChild size="sm" variant="ghost" className="gap-1.5">
                    <a href={url} target="_blank" rel="noopener">
                      <ExternalLink className="size-4" /> Neuer Tab
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="gap-1.5">
                    <a href={url.replace("inline=1", "inline=0")} download={filename}>
                      <Download className="size-4" /> Download
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="bg-muted/30 h-[78vh] overflow-auto flex items-center justify-center">
          {loading || !url ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Lade Vorschau…
            </div>
          ) : isImage ? (
            <img src={url} alt={filename} className="max-w-full max-h-full object-contain" />
          ) : isPdf ? (
            <iframe src={url} title={filename} className="w-full h-full bg-white" />
          ) : isVideo ? (
            <video src={url} controls className="max-w-full max-h-full" />
          ) : isAudio ? (
            <audio src={url} controls className="w-[80%]" />
          ) : isText ? (
            <iframe src={url} title={filename} className="w-full h-full bg-white" />
          ) : (
            <div className="text-center p-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                Für diesen Dateityp ist keine Vorschau verfügbar.
              </p>
              <Button asChild variant="outline" className="gap-2">
                <a href={url.replace("inline=1", "inline=0")} download={filename}>
                  <Download className="size-4" /> Herunterladen
                </a>
              </Button>
            </div>
          )}
          {!previewable && false}
        </div>
      </DialogContent>
    </Dialog>
  );
}