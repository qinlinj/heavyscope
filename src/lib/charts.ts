import type { Pool, UsageRecord, UsageSource } from "@/db/schema";

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

export type RecordFilters = {
  poolId?: string;
  from?: string;
  to?: string;
  source?: UsageSource | "all";
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
  const { poolId, from, to, source } = filters;
  return records.filter((record) => {
    if (poolId && poolId !== "all" && record.pool_id !== poolId) return false;
    if (source && source !== "all" && record.source !== source) return false;
    const ts = new Date(record.recorded_at).getTime();
    if (Number.isNaN(ts)) return false;
    if (from && ts < startOfLocalDay(from).getTime()) return false;
    if (to && ts > endOfLocalDay(to).getTime()) return false;
    return true;
  });
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
export function poolShare(poolsOrRecords: Pool[] | UsageRecord[], pools?: Pool[]): SharePoint[] {
  if (isPoolList(poolsOrRecords)) {
    return poolsOrRecords
      .filter((pool) => pool.quota_used > 0)
      .map((pool) => ({
        name: pool.name,
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
        name: pool?.name ?? id,
        value,
        color: pool?.color ?? FALLBACK_COLOR,
      };
    });
}

export function seriesHasUsage(points: Array<{ total: number }>): boolean {
  return points.some((point) => point.total > 0);
}
