import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Teilt eine Liste in Seiten (Standard 20). resetKey: Seite 1 bei Filterwechsel. */
export function useSeiten<T>(items: T[], size = 20, resetKey: unknown = null) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => items.slice((safePage - 1) * size, safePage * size), [items, safePage, size]);
  return { pageItems, page: safePage, totalPages, total: items.length, setPage };
}

export function ListenPager({ page, totalPages, total, setPage }: { page: number; totalPages: number; total: number; setPage: (p: number) => void }) {
  if (total === 0) return null;
  return (
    <div className="px-4 lg:px-5 py-3 border-t border-border flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">
        {total} {total === 1 ? "Eintrag" : "Einträge"} · Seite {page} von {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} className="gap-1">
          <ChevronLeft className="size-4" /> Zurück
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="gap-1">
          Weiter <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
