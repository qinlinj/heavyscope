import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDatabase } from "@/hooks/useDatabase";
import { parseTheme, persistTheme, readStoredTheme, THEMES, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

type Props = {
  compact?: boolean;
};

const ICONS = {
  dark: Moon,
  light: Sun,
  system: Monitor,
} as const;

export function ThemeToggle({ compact = false }: Props) {
  const { t } = useTranslation();
  const { settings, setSetting } = useDatabase();
  const current = parseTheme(settings.theme ?? readStoredTheme());

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl bg-card/80 ring-1 ring-foreground/10 backdrop-blur",
        compact ? "p-0.5" : "p-1",
      )}
      role="group"
      aria-label={t("settings.theme")}
    >
      {THEMES.map((value) => {
        const Icon = ICONS[value];
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => persistTheme(value, setSetting)}
            title={t(`settings.theme${capitalize(value)}`)}
            aria-label={t(`settings.theme${capitalize(value)}`)}
            aria-pressed={active}
            className={cn(
              "rounded-lg font-medium transition-colors",
              compact ? "p-1" : "p-1.5",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={compact ? "size-3" : "size-3.5"} />
          </button>
        );
      })}
    </div>
  );
}

function capitalize(value: ThemePreference): "Dark" | "Light" | "System" {
  if (value === "dark") return "Dark";
  if (value === "light") return "Light";
  return "System";
}
