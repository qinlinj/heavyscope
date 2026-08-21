import type { Pool, UsageRecord } from "@/db/schema";
import {
  SETTING_CURSOR_LAST_SYNCED_AT,
  SETTING_GROK_BOT_LIVE,
  SETTING_GROK_LAST_SYNCED_AT,
} from "@/lib/settings";

/** Pool ids that have received a successful live or snapshot apply. */
export const SETTING_APPLIED_POOL_IDS = "applied_pool_ids";

export function parseAppliedPoolIds(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

export function mergeAppliedPoolIds(current: string[], extra: string[]): string[] {
  return [...new Set([...current, ...extra.filter((id) => id.length > 0)])];
}

/**
 * True after a successful live or snapshot apply for this pool.
 * Seed rows and placeholder totals do not count.
 */
export function hasSuccessfulApply(
  poolId: string,
  records: Array<Pick<UsageRecord, "pool_id" | "source" | "amount">>,
  settings: Record<string, string>,
): boolean {
  if (parseAppliedPoolIds(settings[SETTING_APPLIED_POOL_IDS]).includes(poolId)) return true;
  if (
    records.some(
      (row) =>
        row.pool_id === poolId &&
        (row.source === "sync" || row.source === "import") &&
        row.amount > 0,
    )
  ) {
    return true;
  }
  if (
    (poolId === "preset-cursor-models" || poolId === "preset-cursor-other") &&
    Boolean(settings[SETTING_CURSOR_LAST_SYNCED_AT]?.trim())
  ) {
    return true;
  }
  if (poolId === "preset-grok-heavy" && Boolean(settings[SETTING_GROK_LAST_SYNCED_AT]?.trim())) {
    return true;
  }
  if (poolId === "preset-grok-bot" && settings[SETTING_GROK_BOT_LIVE] === "ok") {
    return true;
  }
  return false;
}

/** Preset still showing seed totals — do not draw those as a synced usage bar. */
export function isUnsyncedPreset(
  pool: Pick<Pool, "id" | "is_preset">,
  records: Array<Pick<UsageRecord, "pool_id" | "source" | "amount">>,
  settings: Record<string, string>,
): boolean {
  return pool.is_preset === 1 && !hasSuccessfulApply(pool.id, records, settings);
}
