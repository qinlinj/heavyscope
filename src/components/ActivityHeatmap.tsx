import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UsageRecord } from "@/db/schema";
import type { HeatmapCell } from "@/lib/heatmap";
import { heatmapGrid, heatmapLevel } from "@/lib/heatmap";
import { cn } from "@/lib/utils";

type Props = {
  records: UsageRecord[];
  weeks?: number;
  compact?: boolean;
};

const LEVEL_CLASS = [
  "bg-muted",
  "bg-emerald-200 dark:bg-emerald-900",
  "bg-emerald-400 dark:bg-emerald-700",
  "bg-emerald-600 dark:bg-emerald-500",
  "bg-emerald-800 dark:bg-emerald-300",
] as const;

const WEEK_COLUMNS = (weeks: number) => `repeat(${weeks}, minmax(0, 1fr))`;

export function ActivityHeatmap({ records, weeks, compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const autoWeeks = useHeatmapWeeks(compact);
  const resolvedWeeks = weeks ?? autoWeeks;
  const grid = useMemo(() => heatmapGrid(records, resolvedWeeks), [records, resolvedWeeks]);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [tip, setTip] = useState<{ date: string; total: number } | null>(null);
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
  const months = useMemo(() => monthLabels(grid.cells, grid.weeks, locale), [grid, locale]);
  const today = useMemo(() => localTodayKey(), []);
  const weekTemplate = WEEK_COLUMNS(grid.weeks);

  return (
    <div className="w-full">
      <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-1">
        <div aria-hidden="true" />
        <div
          className={cn(
            "mb-1 grid w-full gap-px text-[9px] leading-none text-muted-foreground",
            compact && "mb-0.5",
          )}
          style={{ gridTemplateColumns: weekTemplate }}
        >
          {Array.from({ length: grid.weeks }, (_, weekIndex) => (
            <span key={weekIndex} className="min-w-0 truncate">
              {months.get(weekIndex) ?? ""}
            </span>
          ))}
        </div>
        <div className="grid h-full grid-rows-7 gap-px text-[9px] leading-none text-muted-foreground">
          {weekdays.map((label, weekday) => (
            <span
              key={label + weekday}
              className={cn(
                "flex w-3 items-center justify-end",
                weekday % 2 === 0 && "invisible",
              )}
            >
              {label}
            </span>
          ))}
        </div>
        <div
          className="grid w-full grid-flow-col grid-rows-7 gap-px"
          style={{ gridTemplateColumns: weekTemplate }}
        >
          {grid.cells.map((cell) => {
            const level = heatmapLevel(cell.count, grid.maxCount);
            const label = t("charts.heatmapTooltip", { date: cell.date, total: cell.total });
            return (
              <button
                key={cell.date}
                type="button"
                className={cn(
                  "aspect-square w-full min-w-0 rounded-[2px]",
                  LEVEL_CLASS[level],
                  cell.date === today && "ring-1 ring-foreground/50",
                )}
                title={label}
                onMouseEnter={() => setTip({ date: cell.date, total: cell.total })}
                onMouseLeave={() => setTip(null)}
                onFocus={() => setTip({ date: cell.date, total: cell.total })}
                onBlur={() => setTip(null)}
              >
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        className={cn(
          "mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground",
          compact && "mt-1.5",
        )}
      >
        <span className="min-h-4 min-w-0 truncate tabular-nums">
          {tip ? t("charts.heatmapTooltip", { date: tip.date, total: tip.total }) : t("charts.heatmapLegend")}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span>{t("charts.less")}</span>
          {LEVEL_CLASS.map((className) => (
            <span key={className} className={cn("size-2.5 rounded-[2px]", className)} />
          ))}
          <span>{t("charts.more")}</span>
        </span>
      </div>
    </div>
  );
}

function useHeatmapWeeks(compact: boolean): number {
  const [weeks, setWeeks] = useState(compact ? 10 : 17);
  useEffect(() => {
    if (compact) {
      setWeeks(10);
      return;
    }
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWeeks(media.matches ? 17 : 12);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [compact]);
  return weeks;
}

function localTodayKey(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function weekdayLabels(locale: string): string[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const date = new Date(2026, 7, 16 + weekday);
    return date.toLocaleDateString(locale, { weekday: "narrow" });
  });
}

function monthLabels(cells: HeatmapCell[], weeks: number, locale: string): Map<number, string> {
  const labels = new Map<number, string>();
  for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
    const sunday = cells.find((cell) => cell.weekIndex === weekIndex && cell.weekday === 0);
    if (!sunday) continue;
    const prev = cells.find((cell) => cell.weekIndex === weekIndex - 1 && cell.weekday === 0);
    if (weekIndex === 0 || prev?.date.slice(0, 7) !== sunday.date.slice(0, 7)) {
      const [year, month] = sunday.date.split("-").map(Number);
      labels.set(
        weekIndex,
        new Date(year ?? 0, (month ?? 1) - 1, 1).toLocaleDateString(locale, { month: "short" }),
      );
    }
  }
  return labels;
}
