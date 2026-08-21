import type { Pool } from "@/db/schema";
import { DEFAULT_CRIT_PERCENT, DEFAULT_WARN_PERCENT } from "@/lib/settings";

export function usagePercent(pool: Pool): number {
  if (pool.quota_total <= 0) return 0;
  return Math.min(100, Math.max(0, (pool.quota_used / pool.quota_total) * 100));
}

export function remaining(pool: Pool): number {
  return Math.max(0, pool.quota_total - pool.quota_used);
}

export function usageTone(
  percent: number,
  warn: number = DEFAULT_WARN_PERCENT,
  crit: number = DEFAULT_CRIT_PERCENT,
): "ok" | "warn" | "crit" {
  if (percent >= crit) return "crit";
  if (percent >= warn) return "warn";
  return "ok";
}

function normalizeUnitKey(unit: string): string {
  return unit.trim().toLowerCase();
}

export function isUsdUnit(unit: string): boolean {
  const normalized = normalizeUnitKey(unit);
  return normalized === "usd" || normalized === "$";
}

function isMoneyUnit(unit: string): boolean {
  return isUsdUnit(unit);
}

/** Used / limit as dollars. Never prints “0%” — that is not a dollar line. */
export function formatUsdQuotaLine(used: number, total: number): string {
  return `${formatAmount(used, "USD")} / ${formatAmount(total, "USD")}`;
}

export type OtherUsdView = {
  used: number;
  remaining: number;
  total: number;
  usedPercent: number;
  dollarLine: string;
  remainingLine: string;
};

/**
 * Honest Other Models dollars from stored quota. Null when the pool is not USD
 * (a leftover % seed must be rewritten by live apply before this applies).
 */
export function otherUsdView(
  pool: Pick<Pool, "unit" | "quota_used" | "quota_total">,
): OtherUsdView | null {
  if (!isUsdUnit(pool.unit)) return null;
  const used = Number(pool.quota_used);
  const total = Number(pool.quota_total);
  if (!Number.isFinite(used) || !Number.isFinite(total) || !(total > 0)) return null;
  const leftover = Math.max(0, total - used);
  return {
    used,
    remaining: leftover,
    total,
    usedPercent: usagePercent({ ...pool, quota_used: used, quota_total: total } as Pool),
    dollarLine: formatUsdQuotaLine(used, total),
    remainingLine: formatAmount(leftover, "USD"),
  };
}

/** Indicator width is used%. Never stretch a partial fill to 100%. */
export function progressFillPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

export function progressIndicatorStyle(
  color: string,
  percent: number,
): { width: string; backgroundColor: string } {
  return {
    width: `${progressFillPercent(percent)}%`,
    backgroundColor: color,
  };
}

function isPercentUnit(unit: string): boolean {
  const normalized = normalizeUnitKey(unit);
  return normalized === "%" || normalized === "percent" || normalized === "pct";
}

function amountFractionDigits(value: number, unit: string): number {
  if (!Number.isFinite(value)) return 0;
  const integer = Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9;
  if (integer) return 0;
  const isCount = /request|count/i.test(normalizeUnitKey(unit));
  if (isCount) return 0;
  return 2;
}

/** At most `maxDp` places, trailing zeros stripped (21.40 → 21.4, 21.00 → 21). */
export function formatAtMostDecimals(value: number, maxDp: number): string {
  if (!Number.isFinite(value)) return "0";
  const factor = 10 ** Math.max(0, maxDp);
  const rounded = Math.round(value * factor) / factor;
  return String(rounded);
}

/**
 * Dashboard Usage/trend hover. Does not change stored amounts.
 * USD/$ always 2 decimal places; percent at most 2dp; never a raw float tail.
 */
export function formatTrendHoverValue(value: number, unit = ""): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "+0";
  if (isMoneyUnit(unit)) return `+${n.toFixed(2)}`;
  if (isPercentUnit(unit)) return `+${formatAtMostDecimals(n, 2)}`;
  return `+${formatAtMostDecimals(n, 2)}`;
}

export function formatAmount(value: number, unit: string): string {
  const digits = amountFractionDigits(value, unit);
  if (unit === "USD") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits === 0 ? 0 : undefined,
      maximumFractionDigits: digits,
    }).format(value);
  }
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
  return `${formatted} ${unit}`;
}

/** Recent-record amounts: plus for increases, still routed through formatAmount. */
export function formatSignedAmount(value: number, unit: string): string {
  const formatted = formatAmount(value, unit);
  if (value > 0) return `+${formatted}`;
  return formatted;
}

export function formatCountdown(resetAt: string | null, locale: string): string {
  if (!resetAt) return "—";
  const target = new Date(resetAt).getTime();
  const diff = target - Date.now();
  if (Number.isNaN(target)) return "—";
  if (diff <= 0) return locale.startsWith("zh") ? "待重置" : "Due";
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days > 0) {
    return locale.startsWith("zh") ? `${days} 天 ${remHours} 小时` : `${days}d ${remHours}h`;
  }
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return locale.startsWith("zh") ? `${hours} 小时 ${minutes} 分` : `${hours}h ${minutes}m`;
}

export function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
