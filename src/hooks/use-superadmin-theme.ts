import { useEffect, useState } from "react";

export type SuperAdminTheme = "lime" | "tailadmin" | "hope" | "modern";
const KEY = "superadmin-theme";
const EVT = "superadmin-theme-changed";

export function getSuperAdminTheme(): SuperAdminTheme {
  if (typeof window === "undefined") return "lime";
  const v = window.localStorage.getItem(KEY) as SuperAdminTheme | null;
  return v === "tailadmin" || v === "hope" || v === "modern" || v === "lime" ? v : "lime";
}

export function setSuperAdminTheme(t: SuperAdminTheme) {
  window.localStorage.setItem(KEY, t);
  window.dispatchEvent(new Event(EVT));
}

export function useSuperAdminTheme(): [SuperAdminTheme, (t: SuperAdminTheme) => void] {
  const [t, setT] = useState<SuperAdminTheme>(() => getSuperAdminTheme());
  useEffect(() => {
    const h = () => setT(getSuperAdminTheme());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [t, (v) => { setSuperAdminTheme(v); setT(v); }];
}