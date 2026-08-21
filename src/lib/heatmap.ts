import type { Pool, UsageRecord } from "@/db/schema";
import type { TileSize } from "@/lib/dashboardLayout";
import { toLocalDateKey } from "@/lib/charts";

export type HeatIntensityMetric = "record_count" | "amount";

export type PlotBox = { width: number; height: number };

export type HeatmapPoolUsage = {
  poolId: string;
  amount: number;
  unit: string;
};

export type HeatmapDayTotal =
  | { kind: "amount"; amount: number; unit: string }
  | { kind: "count"; count: number };

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

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
  /** Every pool that has at least one record that day. Not a hardcoded set. */
  pools: HeatmapPoolUsage[];
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

  type DayAgg = {
    count: number;
    amount: number;
    units: Set<string>;
    byPool: Map<string, HeatmapPoolUsage>;
  };
  const byDate = new Map<string, DayAgg>();
  for (const record of records) {
    const key = toLocalDateKey(record.recorded_at);
    const current =
      byDate.get(key) ?? { count: 0, amount: 0, units: new Set<string>(), byPool: new Map<string, HeatmapPoolUsage>() };
    current.count += 1;
    current.amount += record.amount;
    const unit = unitForRecord(record, pools);
    if (unit) current.units.add(unit);
    const poolMeta = pools?.find((item) => item.id === record.pool_id);
    const displayUnit = poolMeta?.unit ?? unit ?? "";
    const poolUsage = current.byPool.get(record.pool_id) ?? {
      poolId: record.pool_id,
      amount: 0,
      unit: displayUnit,
    };
    poolUsage.amount += record.amount;
    if (displayUnit) poolUsage.unit = displayUnit;
    current.byPool.set(record.pool_id, poolUsage);
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
        pools: day ? poolBreakdown(day.byPool, pools) : [],
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

function poolBreakdown(
  byPool: Map<string, HeatmapPoolUsage>,
  pools?: Pick<Pool, "id" | "unit">[],
): HeatmapPoolUsage[] {
  const lines: HeatmapPoolUsage[] = [];
  const seen = new Set<string>();
  for (const pool of pools ?? []) {
    const usage = byPool.get(pool.id);
    if (!usage) continue;
    lines.push(usage);
    seen.add(pool.id);
  }
  for (const [poolId, usage] of byPool) {
    if (seen.has(poolId)) continue;
    lines.push(usage);
  }
  return lines;
}

/**
 * Same-day total. Sum amounts only when every contributing pool shares one
 * unit. Mixed $ and % become a record count — never one combined number.
 */
export function heatmapDayTotal(cell: Pick<HeatmapCell, "count" | "pools">): HeatmapDayTotal {
  if (cell.pools.length === 0) return { kind: "count", count: cell.count };
  const units = new Set(cell.pools.map((item) => normalizeUnit(item.unit)));
  if (units.size !== 1) return { kind: "count", count: cell.count };
  const unit = cell.pools[0]?.unit ?? "";
  const amount = cell.pools.reduce((sum, item) => sum + item.amount, 0);
  return { kind: "amount", amount, unit };
}

/** Gap between GitHub-style heatmap cells (px). */
export const HEATMAP_CELL_GAP_PX = 3;
export const HEATMAP_WEEKDAY_COL_PX = 12;
export const HEATMAP_MONTH_ROW_PX = 12;
export const HEATMAP_WEB_MIN_CELL_PX = 11;
export const HEATMAP_MAX_WEEKS = 26;

const WEB_CELL_RANGE: Record<TileSize, { min: number; max: number }> = {
  sm: { min: 11, max: 16 },
  md: { min: 12, max: 14 },
  lg: { min: 13, max: 16 },
  xl: { min: 13, max: 16 },
};

export function heatmapCellRange(size: TileSize): { min: number; max: number } {
  return WEB_CELL_RANGE[size];
}

export function heatmapFallbackBox(size: TileSize = "lg"): PlotBox {
  if (size === "sm") return { width: 220, height: 168 };
  if (size === "md") return { width: 400, height: 200 };
  if (size === "xl") return { width: 720, height: 280 };
  return { width: 720, height: 240 };
}

function fittedSquareCell(width: number, height: number, weeks: number, gap: number): number {
  const cols = Math.max(1, Math.round(weeks));
  const innerW = width - gap * Math.max(0, cols - 1);
  const innerH = height - gap * 6;
  if (innerW <= 0 || innerH <= 0) return 0;
  return Math.max(0, Math.floor(Math.min(innerW / cols, innerH / 7)));
}

/**
 * Perfect-square cell size. Never stretches to fill leftover card width/height.
 * `width` / `height` are the box for the week×7 grid, including gaps.
 * When the measured box is empty and a fallback box exists, size from the
 * fallback instead of returning 0.
 */
export function squareCellPx(
  width: number,
  height: number,
  weeks: number,
  gap = HEATMAP_CELL_GAP_PX,
  fallbackBox?: PlotBox,
): number {
  const fitted = fittedSquareCell(width, height, weeks, gap);
  if (fitted > 0) return fitted;
  if (!fallbackBox) return 0;
  const fallbackWidth = width > 0 ? width : fallbackBox.width;
  const fallbackHeight = height > 0 ? height : fallbackBox.height;
  const fallbackFitted = fittedSquareCell(fallbackWidth, fallbackHeight, weeks, gap);
  return Math.max(1, fallbackFitted);
}

/** How many Sunday-aligned weeks fit at `cellPx` given the card width. */
export function weeksFromWidth(
  width: number,
  cellPx: number,
  gap = HEATMAP_CELL_GAP_PX,
  weekdayColPx = HEATMAP_WEEKDAY_COL_PX,
): number {
  const plotW = Math.max(0, width - weekdayColPx);
  const step = Math.max(1, cellPx + gap);
  return Math.max(1, Math.floor((plotW + gap) / step));
}

/**
 * Web heatmap fit: cell size from width (clamped per tile size). Week count
 * shrinks with width. Height never stretches squares. Cell is never 0.
 */
export function fitWebHeatmap(
  width: number,
  size: TileSize,
  fallbackWidth = heatmapFallbackBox(size).width,
): { weeks: number; cell: number } {
  const { min, max } = heatmapCellRange(size);
  const usableWidth = width > 0 ? width : fallbackWidth;
  const weeks = Math.min(HEATMAP_MAX_WEEKS, weeksFromWidth(usableWidth, min));
  const plotW = Math.max(0, usableWidth - HEATMAP_WEEKDAY_COL_PX);
  const raw = Math.floor((plotW - Math.max(0, weeks - 1) * HEATMAP_CELL_GAP_PX) / Math.max(1, weeks));
  const cell = clampSquareCellPx(raw, min, max);
  return { weeks, cell: cell > 0 ? cell : min };
}

export function flipTooltipPosition(
  anchor: { x: number; y: number; width: number; height: number },
  tip: { width: number; height: number },
  viewport: PlotBox,
  gap = 8,
): { top: number; left: number; placement: TooltipPlacement } {
  const candidates: Record<TooltipPlacement, { top: number; left: number }> = {
    top: { top: anchor.y - tip.height - gap, left: anchor.x + anchor.width / 2 - tip.width / 2 },
    bottom: { top: anchor.y + anchor.height + gap, left: anchor.x + anchor.width / 2 - tip.width / 2 },
    left: { top: anchor.y + anchor.height / 2 - tip.height / 2, left: anchor.x - tip.width - gap },
    right: { top: anchor.y + anchor.height / 2 - tip.height / 2, left: anchor.x + anchor.width + gap },
  };

  const order: TooltipPlacement[] = ["top", "bottom", "left", "right"];
  const chosen =
    order
      .map((placement) => ({ placement, ...candidates[placement] }))
      .find((pos) => fitsViewport(pos, tip, viewport)) ?? { placement: "top" as const, ...candidates.top };

  return {
    placement: chosen.placement,
    top: clampAxis(chosen.top, tip.height, viewport.height),
    left: clampAxis(chosen.left, tip.width, viewport.width),
  };
}

function fitsViewport(
  pos: { top: number; left: number },
  tip: { width: number; height: number },
  viewport: PlotBox,
): boolean {
  return pos.top >= 0 && pos.left >= 0 && pos.top + tip.height <= viewport.height && pos.left + tip.width <= viewport.width;
}

function clampAxis(start: number, size: number, max: number): number {
  if (max <= 0) return Math.max(0, start);
  return Math.min(Math.max(0, start), Math.max(0, max - size));
}

/**
 * Keep squares inside an optional min/max. Used by the compact tray so a
 * tall panel cannot grow cells, and a narrow panel scrolls instead of
 * shrinking below a readable square.
 */
export function clampSquareCellPx(cell: number, minPx?: number, maxPx?: number): number {
  const min = minPx != null && minPx > 0 ? minPx : 0;
  const max = maxPx != null && maxPx > 0 ? maxPx : Number.POSITIVE_INFINITY;
  if (cell <= 0) return min > 0 ? Math.min(min, max) : 0;
  return Math.min(max, Math.max(min, cell));
}

export function heatmapLevel(value: number, maxValue: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || maxValue <= 0) return 0;
  const ratio = value / maxValue;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}
