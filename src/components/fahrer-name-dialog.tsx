import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Fragt Fahrer nach jedem Login nach ihrem Namen (wird im ERP-Bericht übertragen). */
export function FahrerNameDialog() {
  const { user } = useAuth();
  const { isFahrer, loading } = useRole();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Marker ändert sich bei jedem neuen Login (last_sign_in_at), nicht bei Token-Refresh.
  const loginId = (user as any)?.last_sign_in_at ?? "";
  const key = user ? `schicht-name:${user.id}` : "";

  useEffect(() => {
    if (!user || loading || !isFahrer) return;
    if (localStorage.getItem(key) === loginId) return;
    supabase.from("profiles").select("schicht_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        setName(((data as any)?.schicht_name as string) ?? "");
        setOpen(true);
      });
  }, [user?.id, loading, isFahrer, loginId]);

  async function save() {
    const n = name.trim();
    if (n.length < 2 || n.length > 120) {
      toast.error("Bitte vollständigen Namen eintippen.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ schicht_name: n } as any).eq("id", user!.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    localStorage.setItem(key, loginId);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* Pflichtfeld */ }}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Wer fährt heute?</DialogTitle>
          <DialogDescription>
            Bitte tippe deinen Namen ein. Er wird im Einsatzbericht ans ERP übertragen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="schicht-name">Vor- und Nachname</Label>
          <Input id="schicht-name" autoFocus value={name} maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy}>Weiter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
