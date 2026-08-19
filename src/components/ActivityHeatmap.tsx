import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UsageRecord } from "@/db/schema";
import type { HeatmapCell } from "@/lib/heatmap";
import { heatmapGrid, heatmapLevel } from "@/lib/heatmap";
import { cn } from "@/lib/utils";

type Props = {
  records: UsageRecord[];
  weeks?: number;
};

const LEVEL_CLASS = [
  "bg-foreground/10",
  "bg-emerald-900",
  "bg-emerald-700",
  "bg-emerald-500",
  "bg-emerald-300",
] as const;

export function ActivityHeatmap({ records, weeks }: Props) {
  const { t, i18n } = useTranslation();
  const autoWeeks = useHeatmapWeeks();
  const resolvedWeeks = weeks ?? autoWeeks;
  const grid = useMemo(() => heatmapGrid(records, resolvedWeeks), [records, resolvedWeeks]);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [tip, setTip] = useState<{ date: string; total: number } | null>(null);
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
  const months = useMemo(() => monthLabels(grid.cells, grid.weeks, locale), [grid, locale]);
  const today = useMemo(() => localTodayKey(), []);

  return (
    <div className="w-fit max-w-full overflow-x-auto">
      <div
        className="mb-1 grid gap-[3px] pl-[14px] text-[9px] leading-none text-muted-foreground"
        style={{ gridTemplateColumns: `repeat(${grid.weeks}, 10px)` }}
      >
        {Array.from({ length: grid.weeks }, (_, weekIndex) => (
          <span key={weekIndex} className="truncate">
            {months.get(weekIndex) ?? ""}
          </span>
        ))}
      </div>
      <div className="flex gap-[3px]">
        <div className="grid grid-rows-7 gap-[3px] text-[9px] leading-[10px] text-muted-foreground">
          {weekdays.map((label, weekday) => (
            <span key={label + weekday} className={cn("w-3 text-right", weekday % 2 === 0 && "invisible")}>
              {label}
            </span>
          ))}
        </div>
        <div
          className="grid grid-rows-7 grid-flow-col gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${grid.weeks}, 10px)` }}
        >
          {grid.cells.map((cell) => {
            const level = heatmapLevel(cell.count, grid.maxCount);
            const label = t("charts.heatmapTooltip", { date: cell.date, total: cell.total });
            return (
              <button
                key={cell.date}
                type="button"
                className={cn(
                  "size-[10px] rounded-[2px]",
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
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="min-h-4 tabular-nums">
          {tip ? t("charts.heatmapTooltip", { date: tip.date, total: tip.total }) : t("charts.heatmapLegend")}
        </span>
        <span className="flex items-center gap-1">
          <span>{t("charts.less")}</span>
          {LEVEL_CLASS.map((className) => (
            <span key={className} className={cn("size-[10px] rounded-[2px]", className)} />
          ))}
          <span>{t("charts.more")}</span>
        </span>
      </div>
    </div>
  );
}

function useHeatmapWeeks(): number {
  const [weeks, setWeeks] = useState(17);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWeeks(media.matches ? 17 : 12);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
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
