import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { createSuperadmin } from "@/lib/superadmin-setup.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/kiehn-systeme-login")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Kiehn Systeme" },
    ],
  }),
  component: KiehnSystemeLogin,
});

function KiehnSystemeLogin() {
  const create = useServerFn(createSuperadmin);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await create({ data: { token, email, password, display_name: displayName } });
      toast.success("SuperAdmin wurde angelegt. Du kannst dich jetzt einloggen.");
      setToken(""); setEmail(""); setDisplayName(""); setPassword("");
    } catch (err: any) {
      toast.error(err?.message ?? "Fehler beim Anlegen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kiehn Systeme — SuperAdmin anlegen</CardTitle>
          <CardDescription>
            Geschützter Bereich. Setup-Token erforderlich.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Setup-Token</Label>
              <Input id="token" type="password" autoComplete="off" value={token}
                onChange={(e) => setToken(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Anzeigename</Label>
              <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" autoComplete="off" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Passwort (min. 8 Zeichen)</Label>
              <Input id="pw" type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird angelegt…" : "SuperAdmin anlegen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
