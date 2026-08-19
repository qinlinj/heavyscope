import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { type ChartModuleId, type ChartPrefs } from "@/lib/charts";

type Props = {
  prefs: ChartPrefs;
  onToggle: (id: ChartModuleId, show: boolean) => void;
  onMove: (id: ChartModuleId, direction: "up" | "down") => void;
};

export function ChartLayoutControls({ prefs, onToggle, onMove }: Props) {
  const { t } = useTranslation();

  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-heading text-base font-semibold">{t("charts.modules")}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("charts.modulesHint")}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {prefs.order.map((id, index) => (
          <li
            key={id}
            className="flex items-center gap-1 rounded-lg bg-card/90 px-2 py-1 ring-1 ring-foreground/10"
          >
            <label className="flex cursor-pointer items-center gap-1.5 pr-1 text-xs font-medium">
              <input
                type="checkbox"
                className="size-3.5 accent-emerald-400"
                checked={prefs.show[id]}
                onChange={(event) => onToggle(id, event.target.checked)}
              />
              {t(`charts.module.${id}`)}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={index === 0}
              onClick={() => onMove(id, "up")}
              aria-label={t("charts.moveUp")}
            >
              <ChevronUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={index === prefs.order.length - 1}
              onClick={() => onMove(id, "down")}
              aria-label={t("charts.moveDown")}
            >
              <ChevronDown />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
