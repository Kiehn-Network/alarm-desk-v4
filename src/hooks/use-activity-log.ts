import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Eintrag = { user_id: string; user_name: string | null; seite: string; aktion: string; ziel: string | null };

/** Protokolliert Seitenaufrufe und Klicks des angemeldeten Nutzers (ohne Eingabewerte). */
export function useActivityLog(userId: string | null) {
  const pfad = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!userId) return;
    let name: string | null = null;
    let queue: Eintrag[] = [];
    supabase.from("profiles").select("display_name,schicht_name").eq("id", userId).maybeSingle()
      .then(({ data }) => {
        const d = data as any;
        name = d ? [d.display_name, d.schicht_name && d.schicht_name !== d.display_name ? `(${d.schicht_name})` : null].filter(Boolean).join(" ") : null;
        queue.forEach((e) => { if (!e.user_name) e.user_name = name; });
      });
    const flush = () => {
      if (!queue.length) return;
      const batch = queue; queue = [];
      supabase.from("nutzer_aktivitaet").insert(batch as never).then(() => {});
    };
    const push = (aktion: string, ziel: string | null) => {
      queue.push({ user_id: userId, user_name: name, seite: window.location.pathname, aktion, ziel: ziel?.slice(0, 200) ?? null });
      if (queue.length >= 20) flush();
    };
    (window as any).__adLog = push;

    const onClick = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null;
      const el = t?.closest("button,a,[role=button],[role=tab],[role=menuitem],[role=option],[role=checkbox],[role=switch],input[type=checkbox],input[type=radio],select,summary,label") as HTMLElement | null;
      if (!el) return;
      if (el.closest("[data-no-log]")) return;
      const text = (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || "").replace(/\s+/g, " ").trim();
      const tag = el.tagName.toLowerCase();
      const art = tag === "a" ? "Link" : el.getAttribute("role") === "tab" ? "Reiter" : el.getAttribute("role") === "option" ? "Auswahl" : "Klick";
      const href = tag === "a" ? (el as HTMLAnchorElement).getAttribute("href") : null;
      push(art, text || href || tag);
    };
    const onSubmit = (ev: Event) => {
      const f = ev.target as HTMLFormElement;
      push("Formular gesendet", f.getAttribute("aria-label") || f.id || null);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    const iv = window.setInterval(flush, 3000);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      flush();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("visibilitychange", onHide);
      window.clearInterval(iv);
      delete (window as any).__adLog;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const t = window.setTimeout(() => (window as any).__adLog?.("Seite geöffnet", pfad), 300);
    return () => window.clearTimeout(t);
  }, [pfad, userId]);
}
