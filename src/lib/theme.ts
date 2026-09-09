export const THEME_STORAGE_KEY = "heavyscope.theme";
export const SETTING_THEME = "theme";

export const THEMES = ["dark", "light", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];
export type ResolvedTheme = "dark" | "light";

/** Default stays the current dark panel look. */
export const DEFAULT_THEME: ThemePreference = "dark";

export function parseTheme(value: string | null | undefined): ThemePreference {
  if (value === "light" || value === "system" || value === "dark") return value;
  return DEFAULT_THEME;
}

export function prefersDarkScheme(
  query: { matches: boolean } | null = typeof window === "undefined"
    ? null
    : window.matchMedia("(prefers-color-scheme: dark)"),
): boolean {
  return query?.matches ?? true;
}

export function resolvedTheme(
  preference: ThemePreference,
  prefersDark = prefersDarkScheme(),
): ResolvedTheme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const resolved = resolvedTheme(preference);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

export function readStoredTheme(): ThemePreference {
  if (typeof localStorage === "undefined") return DEFAULT_THEME;
  return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
}

export function persistTheme(
  next: string,
  persistSetting?: (key: string, value: string) => void,
): void {
  const theme = parseTheme(next);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  persistSetting?.(SETTING_THEME, theme);
}
