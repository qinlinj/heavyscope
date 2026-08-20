import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { Pool, UsageRecord } from "@/db/schema";
import { formatAmount } from "@/lib/format";
import type { HeatmapCell } from "@/lib/heatmap";
import {
  HEATMAP_CELL_GAP_PX,
  heatmapCellIntensity,
  heatmapGrid,
  heatmapLevel,
  squareCellPx,
} from "@/lib/heatmap";
import { cn } from "@/lib/utils";

type Props = {
  records: UsageRecord[];
  pools?: Pick<Pool, "id" | "unit">[];
  weeks?: number;
  compact?: boolean;
};

const HEAT_LEVELS = [0, 1, 2, 3, 4] as const;
const WEEKDAY_COL_PX = 12;
const MONTH_ROW_PX = 12;

export function ActivityHeatmap({ records, pools, weeks, compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const autoWeeks = useHeatmapWeeks(compact);
  const resolvedWeeks = weeks ?? autoWeeks;
  const grid = useMemo(() => heatmapGrid(records, resolvedWeeks, new Date(), pools), [records, resolvedWeeks, pools]);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [tip, setTip] = useState<HeatmapCell | null>(null);
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
  const months = useMemo(() => monthLabels(grid.cells, grid.weeks, locale), [grid, locale]);
  const today = useMemo(() => localTodayKey(), []);
  const maxValue = grid.intensityMetric === "amount" ? grid.maxAmount : grid.maxCount;
  const { boxRef, width, height } = usePlotBox();
  const cell = squareCellPx(Math.max(0, width - WEEKDAY_COL_PX), Math.max(0, height - MONTH_ROW_PX), grid.weeks);
  const gap = HEATMAP_CELL_GAP_PX;
  const gridW = cell > 0 ? grid.weeks * cell + (grid.weeks - 1) * gap : 0;
  const gridH = cell > 0 ? 7 * cell + 6 * gap : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div ref={boxRef} className="min-h-0 w-full flex-1">
        <div className="flex h-full min-h-0 w-full justify-start">
          <div
            className="grid shrink-0 grid-cols-[auto_auto] grid-rows-[auto_auto] gap-x-1"
            style={{ width: gridW + WEEKDAY_COL_PX + 4 }}
          >
            <div aria-hidden="true" />
            <div
              className={cn("mb-1 grid text-[9px] leading-none text-muted-foreground", compact && "mb-0.5")}
              style={{
                gridTemplateColumns: `repeat(${grid.weeks}, ${cell}px)`,
                columnGap: gap,
                width: gridW,
              }}
            >
              {Array.from({ length: grid.weeks }, (_, weekIndex) => (
                <span key={weekIndex} className="min-w-0 truncate">
                  {months.get(weekIndex) ?? ""}
                </span>
              ))}
            </div>
            <div
              className="grid text-[9px] leading-none text-muted-foreground"
              style={{ gridTemplateRows: `repeat(7, ${cell}px)`, rowGap: gap, height: gridH }}
            >
              {weekdays.map((label, weekday) => (
                <span
                  key={label + weekday}
                  className={cn("flex w-3 items-center justify-end", weekday % 2 === 0 && "invisible")}
                >
                  {label}
                </span>
              ))}
            </div>
            <div
              className="grid grid-flow-col grid-rows-7"
              style={{
                width: gridW,
                height: gridH,
                gridTemplateColumns: `repeat(${grid.weeks}, ${cell}px)`,
                gap,
              }}
            >
              {grid.cells.map((cellItem) => {
                const intensity = heatmapCellIntensity(cellItem, grid);
                const level = heatmapLevel(intensity, maxValue);
                const tooltip = heatmapTooltip(t, cellItem);
                return (
                  <button
                    key={cellItem.date}
                    type="button"
                    className={cn("rounded-[2px]", cellItem.date === today && "ring-1 ring-foreground/50")}
                    style={{
                      width: cell,
                      height: cell,
                      backgroundColor: `var(--heat-${level})`,
                      boxShadow: "inset 0 0 0 1px var(--heat-outline)",
                    }}
                    title={tooltip}
                    onMouseEnter={() => setTip(cellItem)}
                    onMouseLeave={() => setTip(null)}
                    onFocus={() => setTip(cellItem)}
                    onBlur={() => setTip(null)}
                  >
                    <span className="sr-only">{tooltip}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground",
          compact && "mt-1.5",
        )}
      >
        <span className="min-h-4 min-w-0 truncate tabular-nums">
          {tip
            ? heatmapTooltip(t, tip)
            : t("charts.heatmapPeriod", {
                weeks: grid.weeks,
                metric:
                  grid.intensityMetric === "amount"
                    ? t("charts.heatmapMetricAmount")
                    : t("charts.heatmapMetricCount"),
              })}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span>{t("charts.less")}</span>
          {HEAT_LEVELS.map((level) => (
            <span
              key={level}
              className="size-2.5 rounded-[2px]"
              style={{
                backgroundColor: `var(--heat-${level})`,
                boxShadow: "inset 0 0 0 1px var(--heat-outline)",
              }}
            />
          ))}
          <span>{t("charts.more")}</span>
        </span>
      </div>
    </div>
  );
}

function heatmapTooltip(
  t: (key: string, opts?: Record<string, unknown>) => string,
  cell: HeatmapCell,
): string {
  if (cell.unit && cell.count > 0) {
    return t("charts.heatmapTooltipAmount", {
      date: cell.date,
      count: cell.count,
      amount: formatAmount(cell.amount, cell.unit === "usd" ? "USD" : cell.unit),
    });
  }
  return t("charts.heatmapTooltip", { date: cell.date, total: cell.count });
}

function usePlotBox(): { boxRef: RefObject<HTMLDivElement | null>; width: number; height: number } {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const apply = (width: number, height: number) => {
      setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    apply(node.clientWidth, node.clientHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      apply(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { boxRef, ...box };
}

function useHeatmapWeeks(compact: boolean): number {
  const [weeks, setWeeks] = useState(compact ? 10 : 26);
  useEffect(() => {
    if (compact) {
      setWeeks(10);
      return;
    }
    const wide = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWeeks(wide.matches ? 26 : 12);
    apply();
    wide.addEventListener("change", apply);
    return () => wide.removeEventListener("change", apply);
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
