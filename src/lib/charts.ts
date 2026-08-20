import type { Pool, UsageRecord, UsageSource } from "@/db/schema";
import { remaining, usagePercent } from "@/lib/format";
import { isDemoRecord, matchesHistorySource, type HistorySourceFilter } from "@/lib/usageSource";

export type DailyPoint = {
  date: string;
  total: number;
  [poolId: string]: string | number;
};

export type WeeklyPoint = {
  week: string;
  total: number;
  [poolId: string]: string | number;
};

export type SharePoint = {
  name: string;
  value: number;
  color: string;
};

export type MonthlyPoint = {
  month: string;
  total: number;
  [poolId: string]: string | number;
};

export type ScalePoint = {
  key: string;
  total: number;
  [poolId: string]: string | number;
};

export type ChartScale = "day" | "week" | "month";

export type ScaleLengths = {
  days?: number;
  weeks?: number;
  months?: number;
};

export type UsageBarPoint = {
  id: string;
  name: string;
  percent: number;
  color: string;
  unit: string;
};

export const CHART_MODULE_IDS = ["advisor", "heatmap", "trend"] as const;
export type ChartModuleId = (typeof CHART_MODULE_IDS)[number];

export const DEFAULT_CHART_MODULE_ORDER: ChartModuleId[] = [...CHART_MODULE_IDS];

/** @deprecated Migrated into `dashboard_layout` by `migrateFromChartPrefs`. Kept for existing installs. */
export const SETTING_CHART_SHOW_HEATMAP = "chart_show_heatmap";
/** @deprecated Migrated into `dashboard_layout`. */
export const SETTING_CHART_SHOW_TREND = "chart_show_trend";
/** @deprecated Migrated into `dashboard_layout`. */
export const SETTING_CHART_SHOW_ADVISOR = "chart_show_advisor";
/** @deprecated Migrated into `dashboard_layout`. */
export const SETTING_CHART_MODULE_ORDER = "chart_module_order";

export type ChartShowMap = Record<ChartModuleId, boolean>;

export type ChartPrefs = {
  show: ChartShowMap;
  order: ChartModuleId[];
};

export type ChartModuleGroup =
  | { type: "advisor"; ids: ["advisor"] }
  | { type: "heatmap"; ids: ["heatmap"] }
  | { type: "trend"; ids: ["trend"] };

export type RecordFilters = {
  poolId?: string;
  from?: string;
  to?: string;
  /** `live` = manual + import + sync (hides demo). Default chart aggregations use this. */
  source?: UsageSource | "all" | "live";
};

const FALLBACK_COLOR = "#94a3b8";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local calendar date as YYYY-MM-DD. */
export function toLocalDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfLocalDay(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function endOfLocalDay(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday of the local week containing `date`. */
export function startOfWeekMonday(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = start.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + offset);
  return start;
}

function poolIdsFrom(records: UsageRecord[], pools?: Pool[]): string[] {
  if (pools && pools.length > 0) return pools.map((pool) => pool.id);
  return [...new Set(records.map((record) => record.pool_id))];
}

export function filterRecords(records: UsageRecord[], filters: RecordFilters = {}): UsageRecord[] {
  const { poolId, from, to, source = "live" } = filters;
  return records.filter((record) => {
    if (poolId && poolId !== "all" && record.pool_id !== poolId) return false;
    if (!matchesHistorySource(record, source as HistorySourceFilter)) return false;
    const ts = new Date(record.recorded_at).getTime();
    if (Number.isNaN(ts)) return false;
    if (from && ts < startOfLocalDay(from).getTime()) return false;
    if (to && ts > endOfLocalDay(to).getTime()) return false;
    return true;
  });
}

/** Default chart aggregations hide demo-seeded sample rows. */
export function chartRecords(records: UsageRecord[]): UsageRecord[] {
  return records.filter((record) => !isDemoRecord(record));
}

export function dailySeries(
  records: UsageRecord[],
  pools?: Pool[],
  days = 14,
  now: Date = new Date(),
): DailyPoint[] {
  const poolIds = poolIdsFrom(records, pools);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = addDays(end, -(Math.max(1, days) - 1));
  const points: DailyPoint[] = [];

  for (let i = 0; i < Math.max(1, days); i += 1) {
    const date = toLocalDateKey(addDays(start, i));
    const point: DailyPoint = { date, total: 0 };
    for (const id of poolIds) point[id] = 0;
    points.push(point);
  }

  const index = new Map(points.map((point) => [point.date, point]));
  for (const record of records) {
    const point = index.get(toLocalDateKey(record.recorded_at));
    if (!point) continue;
    point.total += record.amount;
    point[record.pool_id] = Number(point[record.pool_id] ?? 0) + record.amount;
  }
  return points;
}

export function weeklySeries(
  records: UsageRecord[],
  weeks = 8,
  pools?: Pool[],
  now: Date = new Date(),
): WeeklyPoint[] {
  const poolIds = poolIdsFrom(records, pools);
  const thisMonday = startOfWeekMonday(now);
  const count = Math.max(1, weeks);
  const points: WeeklyPoint[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const week = toLocalDateKey(addDays(thisMonday, -i * 7));
    const point: WeeklyPoint = { week, total: 0 };
    for (const id of poolIds) point[id] = 0;
    points.push(point);
  }

  const index = new Map(points.map((point) => [point.week, point]));
  for (const record of records) {
    const week = toLocalDateKey(startOfWeekMonday(new Date(record.recorded_at)));
    const point = index.get(week);
    if (!point) continue;
    point.total += record.amount;
    point[record.pool_id] = Number(point[record.pool_id] ?? 0) + record.amount;
  }
  return points;
}

function isPoolList(items: Pool[] | UsageRecord[]): items is Pool[] {
  const first = items[0];
  return Boolean(first && "quota_used" in first && "name" in first);
}

/** Pool share of quota_used (preferred) or summed record amounts. */
export function poolShare(
  poolsOrRecords: Pool[] | UsageRecord[],
  pools?: Pool[],
  labelFor?: (pool: Pool) => string,
): SharePoint[] {
  if (isPoolList(poolsOrRecords)) {
    return poolsOrRecords
      .filter((pool) => pool.quota_used > 0)
      .map((pool) => ({
        name: labelFor ? labelFor(pool) : pool.name,
        value: pool.quota_used,
        color: pool.color || FALLBACK_COLOR,
      }));
  }

  const lookup = new Map((pools ?? []).map((pool) => [pool.id, pool]));
  const totals = new Map<string, number>();
  for (const record of poolsOrRecords) {
    totals.set(record.pool_id, (totals.get(record.pool_id) ?? 0) + record.amount);
  }

  return [...totals.entries()]
    .filter(([, value]) => value > 0)
    .map(([id, value]) => {
      const pool = lookup.get(id);
      return {
        name: pool ? (labelFor ? labelFor(pool) : pool.name) : id,
        value,
        color: pool?.color ?? FALLBACK_COLOR,
      };
    });
}

export function seriesHasUsage(points: Array<{ total: number }>): boolean {
  return points.some((point) => point.total > 0);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthlySeries(
  records: UsageRecord[],
  months = 6,
  pools?: Pool[],
  now: Date = new Date(),
): MonthlyPoint[] {
  const poolIds = poolIdsFrom(records, pools);
  const count = Math.max(1, months);
  const thisMonth = startOfMonth(now);
  const points: MonthlyPoint[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - i, 1);
    const month = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    const point: MonthlyPoint = { month, total: 0 };
    for (const id of poolIds) point[id] = 0;
    points.push(point);
  }

  const index = new Map(points.map((point) => [point.month, point]));
  for (const record of records) {
    const recorded = new Date(record.recorded_at);
    if (Number.isNaN(recorded.getTime())) continue;
    const month = `${recorded.getFullYear()}-${pad(recorded.getMonth() + 1)}`;
    const point = index.get(month);
    if (!point) continue;
    point.total += record.amount;
    point[record.pool_id] = Number(point[record.pool_id] ?? 0) + record.amount;
  }
  return points;
}

export function scaleSeries(
  records: UsageRecord[],
  scale: ChartScale,
  pools?: Pool[],
  now: Date = new Date(),
  lengths: ScaleLengths = {},
): ScalePoint[] {
  if (scale === "week") {
    return weeklySeries(records, lengths.weeks ?? 8, pools, now).map(({ week, ...rest }) => ({
      key: week,
      ...rest,
    }));
  }
  if (scale === "month") {
    return monthlySeries(records, lengths.months ?? 6, pools, now).map(({ month, ...rest }) => ({
      key: month,
      ...rest,
    }));
  }
  return dailySeries(records, pools, lengths.days ?? 14, now).map(({ date, ...rest }) => ({
    key: date,
    ...rest,
  }));
}

/** Per-pool used% so Cursor $ and Grok % never share one pie. */
export function poolUsageBars(
  pools: Pool[],
  labelFor?: (pool: Pool) => string,
): UsageBarPoint[] {
  return pools.map((pool) => ({
    id: pool.id,
    name: labelFor ? labelFor(pool) : pool.name,
    percent: usagePercent(pool),
    color: pool.color || FALLBACK_COLOR,
    unit: pool.unit,
  }));
}

export type PieSlice = SharePoint & {
  remaining: number;
  unit: string;
  id: string;
};

export type RemainingPie = {
  mode: "absolute" | "remaining_percent";
  unit: string | null;
  slices: PieSlice[];
};

function normalizeUnit(unit: string): string {
  const trimmed = unit.trim().toLowerCase();
  if (trimmed === "$" || trimmed === "usd") return "usd";
  if (trimmed === "%" || trimmed === "percent" || trimmed === "pct") return "%";
  if (/(token|credit|req|request)/i.test(trimmed)) return "token";
  return trimmed;
}

function isPercentUnit(unit: string): boolean {
  return normalizeUnit(unit) === "%";
}

/** Pie A: each pool's used percent. Mixed $ / % is safe because every slice is 0–100. */
export function usedPercentPies(pools: Pool[], labelFor?: (pool: Pool) => string): PieSlice[] {
  return pools.map((pool) => ({
    id: pool.id,
    name: labelFor ? labelFor(pool) : pool.name,
    value: usagePercent(pool),
    remaining: remaining(pool),
    unit: pool.unit,
    color: pool.color || FALLBACK_COLOR,
  }));
}

/**
 * Pie B: remaining share among pools that share a comparable absolute unit
 * (`usd` / token-like). Percent-only pools are omitted from that grouping.
 * If no shared absolute unit exists, fall back to remaining % of each pool
 * (a second percent pie — still never mixes $ and %).
 */
export function remainingSharePie(pools: Pool[], labelFor?: (pool: Pool) => string): RemainingPie {
  const groups = new Map<string, Pool[]>();
  for (const pool of pools) {
    if (isPercentUnit(pool.unit)) continue;
    const key = normalizeUnit(pool.unit);
    const list = groups.get(key) ?? [];
    list.push(pool);
    groups.set(key, list);
  }

  const comparable = [...groups.entries()].find(([, items]) => items.length >= 2);
  if (comparable) {
    const [unitKey, items] = comparable;
    return {
      mode: "absolute",
      unit: items[0]?.unit ?? unitKey,
      slices: items.map((pool) => ({
        id: pool.id,
        name: labelFor ? labelFor(pool) : pool.name,
        value: remaining(pool),
        remaining: remaining(pool),
        unit: pool.unit,
        color: pool.color || FALLBACK_COLOR,
      })),
    };
  }

  return {
    mode: "remaining_percent",
    unit: "%",
    slices: pools.map((pool) => ({
      id: pool.id,
      name: labelFor ? labelFor(pool) : pool.name,
      value: Math.max(0, 100 - usagePercent(pool)),
      remaining: remaining(pool),
      unit: pool.unit,
      color: pool.color || FALLBACK_COLOR,
    })),
  };
}

function parseBoolSetting(value: string | undefined, fallback = true): boolean {
  if (value == null || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0";
}

export function parseChartModuleOrder(value: string | undefined): ChartModuleId[] {
  if (!value) return [...DEFAULT_CHART_MODULE_ORDER];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_CHART_MODULE_ORDER];
    const seen = new Set<ChartModuleId>();
    const order: ChartModuleId[] = [];
    for (const item of parsed) {
      if ((CHART_MODULE_IDS as readonly string[]).includes(item) && !seen.has(item)) {
        seen.add(item);
        order.push(item);
      }
    }
    for (const id of CHART_MODULE_IDS) {
      if (!seen.has(id)) order.push(id);
    }
    return order.length > 0 ? order : [...DEFAULT_CHART_MODULE_ORDER];
  } catch {
    return [...DEFAULT_CHART_MODULE_ORDER];
  }
}

export function parseChartPrefs(settings: Record<string, string>): ChartPrefs {
  return {
    show: {
      advisor: parseBoolSetting(settings[SETTING_CHART_SHOW_ADVISOR]),
      heatmap: parseBoolSetting(settings[SETTING_CHART_SHOW_HEATMAP]),
      trend: parseBoolSetting(settings[SETTING_CHART_SHOW_TREND]),
    },
    order: parseChartModuleOrder(settings[SETTING_CHART_MODULE_ORDER]),
  };
}

export function isChartModuleId(value: string): value is ChartModuleId {
  return (CHART_MODULE_IDS as readonly string[]).includes(value);
}

export function moveChartModule(
  order: ChartModuleId[],
  id: ChartModuleId,
  direction: "up" | "down",
): ChartModuleId[] {
  const next = [...order];
  const index = next.indexOf(id);
  if (index < 0) return next;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= next.length) return next;
  const current = next[index];
  const other = next[swapWith];
  if (current === undefined || other === undefined) return next;
  next[index] = other;
  next[swapWith] = current;
  return next;
}

/** Insert `fromId` before `toId`. Hidden modules stay in the array. */
export function reorderChartModules(
  order: ChartModuleId[],
  fromId: ChartModuleId,
  toId: ChartModuleId,
): ChartModuleId[] {
  if (fromId === toId) return [...order];
  if (!order.includes(fromId) || !order.includes(toId)) return [...order];
  const next = order.filter((id) => id !== fromId);
  const insertAt = next.indexOf(toId);
  if (insertAt < 0) return [...order];
  next.splice(insertAt, 0, fromId);
  return next;
}

/** Visible dashboard stack. Hidden ids stay in `order` so they restore position. */
export function visibleChartModules(order: ChartModuleId[], show: ChartShowMap): ChartModuleId[] {
  return order.filter((id) => show[id]);
}

export function groupChartModules(order: ChartModuleId[], show: ChartShowMap): ChartModuleGroup[] {
  return visibleChartModules(order, show).map((id) => ({ type: id, ids: [id] }) as ChartModuleGroup);
}

/** Latest bucket total for day / week / month (one period). */
export function periodTotal(
  records: UsageRecord[],
  scale: ChartScale,
  poolId?: string,
  now: Date = new Date(),
): number {
  const filtered = poolId ? records.filter((record) => record.pool_id === poolId) : records;
  const series = scaleSeries(filtered, scale, undefined, now, { days: 1, weeks: 1, months: 1 });
  return Number(series.at(-1)?.total ?? 0);
}
