import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listBestreifungsplaene, listRundgaenge, listObjekte } from "@/lib/owks.functions";
import { Building2, MapPin, Wrench, Radar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/revier-center/owks/")({
  component: OwksDashboard,
});

function OwksDashboard() {
  const listObj = useServerFn(listObjekte);
  const listRg = useServerFn(listRundgaenge);
  const listBp = useServerFn(listBestreifungsplaene);
  const objQ = useQuery({ queryKey: ["owks-objekte"], queryFn: () => listObj() });
  const rgQ = useQuery({ queryKey: ["owks-rundgaenge"], queryFn: () => listRg() });
  const bpQ = useQuery({ queryKey: ["owks-plaene"], queryFn: () => listBp() });

  const kpis = [
    { label: "Objekte", value: objQ.data?.length ?? 0, icon: Building2, to: "/revier-center/owks/objekte" },
    { label: "Rundgänge", value: rgQ.data?.length ?? 0, icon: MapPin, to: "/revier-center/owks/rundgaenge" },
    { label: "Bestreifungspläne", value: bpQ.data?.length ?? 0, icon: Wrench, to: "/revier-center/owks/bestreifungsplaene" },
    { label: "Zeitstrahl", value: "→", icon: Radar, to: "/revier-center/owks/zeitstrahl" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">OWKS · Objekt-Wach-Kontroll-System</h2>
        <p className="text-sm text-muted-foreground">
          Bestreifungen planen, NFC-Kontrollpunkte verwalten und Fahrer-Scans nachverfolgen.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to}
            className="rounded-xl border border-border bg-card p-5 hover:border-primary/60 transition">
            <div className="flex items-center justify-between">
              <k.icon className="size-5 text-primary" />
              <div className="text-2xl font-bold tabular-nums">{k.value}</div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{k.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
