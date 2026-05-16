import { Lock } from "lucide-react";

export function AccessDenied({ title = "Kein Zugriff", message }: { title?: string; message?: string }) {
  return (
    <div className="p-6 lg:p-8">
      <div
        className="rounded-xl border border-border bg-card p-12 text-center"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="mx-auto size-14 rounded-full bg-muted grid place-items-center">
          <Lock className="size-6 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          {message ?? "Dieser Bereich ist für deine Rolle nicht freigegeben."}
        </p>
      </div>
    </div>
  );
}