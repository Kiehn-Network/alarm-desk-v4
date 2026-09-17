import { useEffect } from "react";
import { useAppSettings } from "@/hooks/use-app-settings";
import { applyThemeToDom, useThemeMode } from "@/hooks/use-theme-mode";
import { applyUiSizeToDom, useUiSize } from "@/hooks/use-ui-size";

/**
 * Mounts once inside the authenticated layout. Syncs:
 * - per-domain theme from app_settings → <html data-theme>
 * - per-user mode from localStorage    → <html class="light|dark">
 * - per-user UI size from localStorage → <html data-ui-size>
 */
export function ThemeApplier() {
  const { data } = useAppSettings();
  const { mode } = useThemeMode();
  const { size } = useUiSize();
  const theme = ((data as any)?.theme as string) ?? "midnight";

  useEffect(() => {
    applyThemeToDom(theme, mode);
    applyUiSizeToDom(size);
  }, [theme, mode, size]);

  return null;
}