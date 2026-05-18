import { useEffect } from "react";
import { useAppSettings } from "@/hooks/use-app-settings";
import { applyThemeToDom, useThemeMode } from "@/hooks/use-theme-mode";

/**
 * Mounts once inside the authenticated layout. Syncs:
 * - per-domain theme from app_settings → <html data-theme>
 * - per-user mode from localStorage    → <html class="light|dark">
 */
export function ThemeApplier() {
  const { data } = useAppSettings();
  const { mode } = useThemeMode();
  const theme = ((data as any)?.theme as string) ?? "midnight";

  useEffect(() => {
    applyThemeToDom(theme, mode);
  }, [theme, mode]);

  return null;
}