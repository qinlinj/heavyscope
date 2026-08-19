import { useEffect } from "react";
import { useDatabase } from "@/hooks/useDatabase";
import { applyTheme, parseTheme, readStoredTheme } from "@/lib/theme";

/** Keep `document.documentElement` in sync with settings + system preference. */
export function ThemeSync() {
  const { ready, settings } = useDatabase();
  const preference = parseTheme(ready ? settings.theme : readStoredTheme());

  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  return null;
}
