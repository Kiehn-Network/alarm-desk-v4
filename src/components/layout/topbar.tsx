import { Search, Menu, Radio, Sun, Moon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar";
import { useState } from "react";
import { useThemeMode } from "@/hooks/use-theme-mode";

export function Topbar({ title, displayName }: { title?: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const { mode, toggle } = useThemeMode();
  return (
    <header className="h-14 md:h-16 shrink-0 border-b border-border bg-card/50 backdrop-blur-xl flex items-center gap-3 px-3 md:px-6 sticky top-0 z-30">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="Menü öffnen"
            className="md:hidden inline-flex items-center justify-center size-10 rounded-lg hover:bg-muted text-foreground"
          >
            <Menu className="size-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent displayName={displayName} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="md:hidden flex items-center gap-2">
        <div className="size-8 rounded-lg grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
          <Radio className="size-4 text-primary-foreground" />
        </div>
      </div>

      <div className="hidden md:block text-sm text-muted-foreground">{title}</div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={toggle}
        aria-label={mode === "dark" ? "Light Mode" : "Dark Mode"}
        title={mode === "dark" ? "Light Mode" : "Dark Mode"}
        className="inline-flex items-center justify-center size-9 rounded-lg hover:bg-muted text-foreground transition"
      >
        {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
      <div className="relative w-40 sm:w-56 md:w-72 max-w-full">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Suchen…"
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-input/60 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>
    </header>
  );
}
