import { useTranslation } from "react-i18next";
import { persistLanguage } from "@/i18n";
import { useDatabase } from "@/hooks/useDatabase";
import { cn } from "@/lib/utils";

type Props = {
  compact?: boolean;
};

export function LanguageToggle({ compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const { setSetting } = useDatabase();
  const current = i18n.resolvedLanguage ?? "zh-CN";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl bg-card/80 ring-1 ring-foreground/10 backdrop-blur",
        compact ? "p-0.5 text-[10px]" : "p-1 text-xs",
      )}
      role="group"
      aria-label={t("settings.language")}
    >
      {[
        { value: "en", label: t("settings.langShortEn") },
        { value: "zh-CN", label: t("settings.langShortZh") },
      ].map((item) => {
        const active = current === item.value || (item.value === "zh-CN" && current.startsWith("zh"));
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => persistLanguage(item.value, setSetting)}
            className={cn(
              "rounded-lg font-medium transition-colors",
              compact ? "px-1.5 py-1" : "px-2.5 py-1.5",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
