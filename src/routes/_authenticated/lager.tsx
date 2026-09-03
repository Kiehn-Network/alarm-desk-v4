import { createFileRoute } from "@tanstack/react-router";
import { Boxes, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LagerArtikelPanel } from "@/components/admin/lager-artikel-panel";
import { LagerBenutzerPanel } from "@/components/admin/lager-benutzer-panel";
import { LagerAdminsPanel } from "@/components/admin/lager-admins-panel";
import { useRole } from "@/hooks/use-role";
import { useLagerAccess } from "@/hooks/use-lager-access";


export const Route = createFileRoute("/_authenticated/lager")({
  component: LagerAdminPage,
  head: () => ({
    meta: [
      { title: "Lagerverwaltung – AlarmDesk" },
      { name: "description", content: "Lagerartikel anlegen, bearbeiten, Etiketten drucken sowie Lager-Benutzer und Meldebestände verwalten." },
      { property: "og:title", content: "Lagerverwaltung – AlarmDesk" },
      { property: "og:description", content: "Lagerartikel anlegen, bearbeiten, Etiketten drucken sowie Lager-Benutzer und Meldebestände verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function LagerAdminPage() {
  const { isAdmin } = useRole();
  const { data: lagerAccess, isPending } = useLagerAccess();

  if (isPending) {
    return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Lagerberechtigung wird geprüft…</div>;
  }

  if (!lagerAccess?.allowed) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Boxes className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Kein Zugriff</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dieser Bereich ist ausschließlich für Lager-Admins freigeschaltet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="size-11 rounded-xl bg-primary/10 grid place-items-center">
          <Boxes className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Lagerverwaltung</h1>
          <p className="text-sm text-muted-foreground">
            Artikel anlegen, bearbeiten, löschen und Etiketten drucken. Techniker buchen an der Lager-Station.
          </p>
        </div>
        <Button variant="outline" className="ml-auto" asChild>
          <a href="/lager-station" target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> Lager-Station öffnen
          </a>
        </Button>
      </div>

      <Tabs defaultValue="artikel">
        <TabsList>
          <TabsTrigger value="artikel">Artikel &amp; Bestände</TabsTrigger>
          <TabsTrigger value="benutzer">Lager-Benutzer</TabsTrigger>
          {isAdmin && <TabsTrigger value="admins">Lager-Admins</TabsTrigger>}
        </TabsList>

        <TabsContent value="artikel" className="mt-4">
          <LagerArtikelPanel />
        </TabsContent>
        <TabsContent value="benutzer" className="mt-4">
          <LagerBenutzerPanel />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="admins" className="mt-4">
            <LagerAdminsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
