import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";
const KEY = "alarmdesk:theme-mode";

function readMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = localStorage.getItem(KEY);
  if (v === "light" || v === "dark") return v;
  return "dark";
}

export function applyThemeToDom(theme: string | null | undefined, mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.setAttribute("data-theme", theme || "midnight");
  html.classList.remove("light", "dark");
  html.classList.add(mode);
}

export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>(() => readMode());

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("light", "dark");
    html.classList.add(mode);
    localStorage.setItem(KEY, mode);
  }, [mode]);

  return {
    mode,
    setMode: setModeState,
    toggle: () => setModeState((m) => (m === "dark" ? "light" : "dark")),
  };
}