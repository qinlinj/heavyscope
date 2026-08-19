import type { Pool, ResetCycle, UsageRecord } from "@/db/schema";
import { remaining, usagePercent } from "@/lib/format";

export const MIN_DAY_FRACTION = 1 / 24;

export type RiskLevel = "overspend" | "waste" | "ok";

export type CrossPoolAdvice = {
  fromPoolId: string;
  toPoolId: string;
};

export type PoolAdvice = {
  poolId: string;
  daysLeft: number;
  daysElapsed: number;
  recommendedDaily: number;
  todayUsedAmount: number;
  todaySafeRemaining: number;
  averageDaily: number;
  risk: RiskLevel;
  projectionAtReset: number;
  usagePercent: number;
  remaining: number;
};

/** Days until reset. Past or missing reset => 0. Imminent reset uses max(hours/24, 1/24). */
export function daysUntilReset(resetAt: string | null | undefined, now: Date = new Date()): number {
  if (!resetAt) return 0;
  const target = new Date(resetAt).getTime();
  if (Number.isNaN(target)) return 0;
  const diffMs = target - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.max(diffMs / 86_400_000, MIN_DAY_FRACTION);
}

export function recommendedDaily(remainingQuota: number, daysLeft: number): number {
  return remainingQuota / Math.max(daysLeft, MIN_DAY_FRACTION);
}

function sameLocalDay(iso: string, now: Date): boolean {
  const recorded = new Date(iso);
  return (
    recorded.getFullYear() === now.getFullYear() &&
    recorded.getMonth() === now.getMonth() &&
    recorded.getDate() === now.getDate()
  );
}

export function todayUsed(records: UsageRecord[], now: Date, poolId: string): number {
  return records
    .filter((record) => record.pool_id === poolId && sameLocalDay(record.recorded_at, now))
    .reduce((sum, record) => sum + record.amount, 0);
}

export function todaySafeRemaining(recommended: number, usedToday: number): number {
  return Math.max(0, recommended - usedToday);
}

export function averageDailyUsed(usedSoFar: number, daysElapsedInCycle: number): number {
  return usedSoFar / Math.max(daysElapsedInCycle, MIN_DAY_FRACTION);
}

export function risk(input: {
  averageDaily: number;
  recommendedDaily: number;
  usedFraction: number;
  timeElapsedFraction: number;
  daysLeft: number;
}): RiskLevel {
  if (input.averageDaily > input.recommendedDaily * 1.05) return "overspend";
  if (input.usedFraction < 0.4 * input.timeElapsedFraction && input.daysLeft > 2) {
    return "waste";
  }
  return "ok";
}

export function projectionAtReset(
  quotaUsed: number,
  averageDaily: number,
  daysLeft: number,
): number {
  return quotaUsed + averageDaily * daysLeft;
}

export function cycleStartAt(
  resetAt: string | null,
  resetCycle: ResetCycle,
  createdAt?: string,
): Date | null {
  if (resetAt && resetCycle === "weekly") {
    return new Date(new Date(resetAt).getTime() - 7 * 86_400_000);
  }
  if (resetAt && resetCycle === "monthly") {
    const reset = new Date(resetAt);
    return new Date(Date.UTC(reset.getUTCFullYear(), reset.getUTCMonth() - 1, 1, 0, 0, 0));
  }
  if (createdAt) {
    const created = new Date(createdAt);
    return Number.isNaN(created.getTime()) ? null : created;
  }
  return null;
}

export function daysElapsedInCycle(
  resetAt: string | null,
  resetCycle: ResetCycle,
  now: Date = new Date(),
  createdAt?: string,
): number {
  const start = cycleStartAt(resetAt, resetCycle, createdAt);
  if (!start) return MIN_DAY_FRACTION;
  const elapsed = (now.getTime() - start.getTime()) / 86_400_000;
  return Math.max(elapsed, MIN_DAY_FRACTION);
}

export function advisePool(
  pool: Pool,
  records: UsageRecord[],
  now: Date = new Date(),
): PoolAdvice {
  const daysLeft = daysUntilReset(pool.reset_at, now);
  const daysElapsed = daysElapsedInCycle(pool.reset_at, pool.reset_cycle, now, pool.created_at);
  const leftover = remaining(pool);
  const recDaily = recommendedDaily(leftover, daysLeft);
  const usedToday = todayUsed(records, now, pool.id);
  const avgDaily = averageDailyUsed(pool.quota_used, daysElapsed);
  const cycleLength = daysElapsed + daysLeft;
  const usedFraction = pool.quota_total > 0 ? pool.quota_used / pool.quota_total : 0;
  const timeElapsedFraction = cycleLength > 0 ? daysElapsed / cycleLength : 1;
  return {
    poolId: pool.id,
    daysLeft,
    daysElapsed,
    recommendedDaily: recDaily,
    todayUsedAmount: usedToday,
    todaySafeRemaining: todaySafeRemaining(recDaily, usedToday),
    averageDaily: avgDaily,
    risk: risk({
      averageDaily: avgDaily,
      recommendedDaily: recDaily,
      usedFraction,
      timeElapsedFraction,
      daysLeft,
    }),
    projectionAtReset: projectionAtReset(pool.quota_used, avgDaily, daysLeft),
    usagePercent: usagePercent(pool),
    remaining: leftover,
  };
}

export function crossPoolAdvice(advices: PoolAdvice[]): CrossPoolAdvice | null {
  const stressed = advices.find(
    (item) => item.risk === "overspend" || item.usagePercent >= 80,
  );
  if (!stressed) return null;
  const target = advices.find(
    (item) => item.poolId !== stressed.poolId && item.usagePercent < 60 && item.remaining > 0,
  );
  if (!target) return null;
  return { fromPoolId: stressed.poolId, toPoolId: target.poolId };
}

function tightnessRank(item: PoolAdvice): number {
  return item.risk === "overspend" ? 0 : item.risk === "waste" ? 2 : 1;
}

export function compareAdviceTightness(a: PoolAdvice, b: PoolAdvice): number {
  const byRisk = tightnessRank(a) - tightnessRank(b);
  if (byRisk !== 0) return byRisk;
  if (b.usagePercent !== a.usagePercent) return b.usagePercent - a.usagePercent;
  return a.todaySafeRemaining - b.todaySafeRemaining;
}

export function tightestAdvice(advices: PoolAdvice[]): PoolAdvice | null {
  if (advices.length === 0) return null;
  return [...advices].sort(compareAdviceTightness)[0];
}

/** Tightest pools first, capped at `limit` (menu-bar /tray uses 1–2). */
export function tightestAdvices(advices: PoolAdvice[], limit = 2): PoolAdvice[] {
  return [...advices].sort(compareAdviceTightness).slice(0, Math.max(0, limit));
}

export function riskTone(level: RiskLevel): "ok" | "warn" | "crit" {
  if (level === "overspend") return "crit";
  if (level === "waste") return "warn";
  return "ok";
}
