import type { UsageRecord } from "@/db/schema";
import { toLocalDateKey } from "@/lib/charts";

/**
 * Heatmap intensity uses daily **record count**, not summed amounts.
 * Cursor USD and Grok percent pools would otherwise be incomparable on one scale.
 * Tooltip total is that same daily count.
 */
export const HEATMAP_INTENSITY_METRIC = "record_count" as const;

/** GitHub contribution greens. Mirrored as `--heat-0`…`--heat-4` in `src/index.css`. */
export const HEATMAP_GITHUB_COLORS = {
  light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
} as const;

export type HeatmapCell = {
  date: string;
  /** Daily usage-record count; also the tooltip total. */
  count: number;
  total: number;
  weekday: number;
  weekIndex: number;
};

export type HeatmapGrid = {
  weeks: number;
  cells: HeatmapCell[];
  maxCount: number;
  intensityMetric: typeof HEATMAP_INTENSITY_METRIC;
};

/** Sunday of the local week containing `date` (GitHub contribution-graph alignment). */
export function startOfWeekSunday(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * GitHub-style daily activity grid.
 * Default window is 17 weeks; pass 12 when the charts card is narrow.
 */
export function heatmapGrid(
  records: UsageRecord[],
  weeks = 17,
  now: Date = new Date(),
): HeatmapGrid {
  const count = Math.max(1, Math.round(weeks));
  const thisSunday = startOfWeekSunday(now);
  const start = addDays(thisSunday, -(count - 1) * 7);
  const totals = new Map<string, number>();

  for (const record of records) {
    const key = toLocalDateKey(record.recorded_at);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  let maxCount = 0;

  for (let weekIndex = 0; weekIndex < count; weekIndex += 1) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = toLocalDateKey(addDays(start, weekIndex * 7 + weekday));
      const value = totals.get(date) ?? 0;
      maxCount = Math.max(maxCount, value);
      cells.push({
        date,
        count: value,
        total: value,
        weekday,
        weekIndex,
      });
    }
  }

  return {
    weeks: count,
    cells,
    maxCount,
    intensityMetric: HEATMAP_INTENSITY_METRIC,
  };
}

/** Quartile buckets against the busiest day in the window (0 = empty). */
export function heatmapLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}
