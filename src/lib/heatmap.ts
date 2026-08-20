import type { Pool, UsageRecord } from "@/db/schema";
import { toLocalDateKey } from "@/lib/charts";

export type HeatIntensityMetric = "record_count" | "amount";

/** GitHub contribution greens. Mirrored as `--heat-0`…`--heat-4` in `src/index.css`. */
export const HEATMAP_GITHUB_COLORS = {
  light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
} as const;

export type HeatmapCell = {
  date: string;
  /** Daily usage-record count. */
  count: number;
  /** Sum of amounts when `unit` is set; otherwise 0. */
  amount: number;
  /** Shared unit for that day's contributing records, or null when mixed / count mode. */
  unit: string | null;
  weekday: number;
  weekIndex: number;
};

export type HeatmapGrid = {
  weeks: number;
  cells: HeatmapCell[];
  maxCount: number;
  maxAmount: number;
  intensityMetric: HeatIntensityMetric;
  unit: string | null;
};

function normalizeUnit(unit: string): string {
  const trimmed = unit.trim().toLowerCase();
  if (trimmed === "$" || trimmed === "usd") return "usd";
  if (trimmed === "%" || trimmed === "percent" || trimmed === "pct") return "%";
  return trimmed;
}

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

function unitForRecord(record: UsageRecord, pools?: Pick<Pool, "id" | "unit">[]): string | null {
  const pool = pools?.find((item) => item.id === record.pool_id);
  return pool ? normalizeUnit(pool.unit) : null;
}

/**
 * GitHub-style daily activity grid.
 * Default window is 26 weeks; pass 12 when the card is narrow, 10 for compact tray.
 *
 * Intensity prefers that day's summed usage amount when every contributing
 * record (in the whole window) shares one unit. Mixed $ and % stay on
 * record-count intensity so the two never mix on one scale.
 */
export function heatmapGrid(
  records: UsageRecord[],
  weeks = 26,
  now: Date = new Date(),
  pools?: Pick<Pool, "id" | "unit">[],
): HeatmapGrid {
  const count = Math.max(1, Math.round(weeks));
  const thisSunday = startOfWeekSunday(now);
  const start = addDays(thisSunday, -(count - 1) * 7);
  const windowStart = toLocalDateKey(start);
  const windowEnd = toLocalDateKey(addDays(thisSunday, 6));

  const inWindow = records.filter((record) => {
    const key = toLocalDateKey(record.recorded_at);
    return key >= windowStart && key <= windowEnd;
  });

  const units = new Set<string>();
  for (const record of inWindow) {
    const unit = unitForRecord(record, pools);
    if (unit) units.add(unit);
  }
  const sharedUnit = units.size === 1 ? [...units][0]! : null;
  const intensityMetric: HeatIntensityMetric = sharedUnit && pools ? "amount" : "record_count";

  const byDate = new Map<string, { count: number; amount: number; units: Set<string> }>();
  for (const record of records) {
    const key = toLocalDateKey(record.recorded_at);
    const current = byDate.get(key) ?? { count: 0, amount: 0, units: new Set<string>() };
    current.count += 1;
    current.amount += record.amount;
    const unit = unitForRecord(record, pools);
    if (unit) current.units.add(unit);
    byDate.set(key, current);
  }

  const cells: HeatmapCell[] = [];
  let maxCount = 0;
  let maxAmount = 0;

  for (let weekIndex = 0; weekIndex < count; weekIndex += 1) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = toLocalDateKey(addDays(start, weekIndex * 7 + weekday));
      const day = byDate.get(date);
      const dayCount = day?.count ?? 0;
      const dayAmount = day?.amount ?? 0;
      const dayUnit = day && day.units.size === 1 ? [...day.units][0]! : null;
      maxCount = Math.max(maxCount, dayCount);
      maxAmount = Math.max(maxAmount, dayAmount);
      cells.push({
        date,
        count: dayCount,
        amount: dayAmount,
        unit: intensityMetric === "amount" ? sharedUnit : dayUnit,
        weekday,
        weekIndex,
      });
    }
  }

  return {
    weeks: count,
    cells,
    maxCount,
    maxAmount,
    intensityMetric,
    unit: sharedUnit,
  };
}

export function heatmapCellIntensity(cell: HeatmapCell, grid: HeatmapGrid): number {
  return grid.intensityMetric === "amount" ? cell.amount : cell.count;
}

/** Quartile buckets against the busiest day in the window (0 = empty). */
/** Gap between GitHub-style heatmap cells (px). */
export const HEATMAP_CELL_GAP_PX = 3;

/**
 * Perfect-square cell size. Never stretches to fill leftover card width/height.
 * `width` / `height` are the box for the week×7 grid, including gaps.
 */
export function squareCellPx(width: number, height: number, weeks: number, gap = HEATMAP_CELL_GAP_PX): number {
  const cols = Math.max(1, Math.round(weeks));
  const innerW = width - gap * Math.max(0, cols - 1);
  const innerH = height - gap * 6;
  if (innerW <= 0 || innerH <= 0) return 0;
  return Math.max(0, Math.floor(Math.min(innerW / cols, innerH / 7)));
}

export function heatmapLevel(value: number, maxValue: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || maxValue <= 0) return 0;
  const ratio = value / maxValue;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}
