import { Search } from "lucide-react";

export function Topbar({ title }: { title?: string }) {
  return (
    <header className="h-16 shrink-0 border-b border-border bg-card/50 backdrop-blur-xl flex items-center gap-4 px-6 sticky top-0 z-30">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="flex-1" />
      <div className="relative w-72 max-w-full">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Suchen…"
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-input/60 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>
    </header>
  );
}
