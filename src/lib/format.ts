import type { Pool } from "@/db/schema";

export function usagePercent(pool: Pool): number {
  if (pool.quota_total <= 0) return 0;
  return Math.min(100, Math.max(0, (pool.quota_used / pool.quota_total) * 100));
}

export function remaining(pool: Pool): number {
  return Math.max(0, pool.quota_total - pool.quota_used);
}

export function usageTone(percent: number): "ok" | "warn" | "crit" {
  if (percent >= 90) return "crit";
  if (percent >= 70) return "warn";
  return "ok";
}

export function formatAmount(value: number, unit: string): string {
  if (unit === "USD") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${unit}`;
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
