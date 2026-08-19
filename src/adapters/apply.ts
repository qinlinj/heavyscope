import type { Pool, ResetCycle } from "@/db/schema";
import type { AdapterResult, ApplyReport } from "./types";

export const HINT_TO_POOL_ID: Record<string, string> = {
  grok_heavy: "preset-grok-heavy",
  grok_bot: "preset-grok-bot",
  cursor_models: "preset-cursor-models",
  cursor_other: "preset-cursor-other",
};

export function resolvePoolId(hint: string, pools: Array<Pick<Pool, "id" | "name">>): string | null {
  const mapped = HINT_TO_POOL_ID[hint];
  if (mapped && pools.some((pool) => pool.id === mapped)) return mapped;
  const exact = pools.find((pool) => pool.id === hint);
  if (exact) return exact.id;
  if (hint.startsWith("custom:")) {
    const name = hint.slice("custom:".length).trim().toLowerCase();
    const byName = pools.find((pool) => pool.name.toLowerCase() === name);
    if (byName) return byName.id;
  }
  const byName = pools.find((pool) => pool.name.toLowerCase() === hint.toLowerCase());
  return byName?.id ?? null;
}

export type ApplyDeps = {
  listPools: () => Array<Pick<Pool, "id" | "name">>;
  getPool: (id: string) => Pool | null;
  addUsage: (
    poolId: string,
    amount: number,
    note: string | null,
    recordedAt?: string,
  ) => void;
  setQuotaTotal: (id: string, total: number) => void;
};

export type AbsoluteUsageDraft = {
  poolHint: string;
  quotaUsed: number;
  quotaTotal?: number;
  resetAt?: string | null;
  resetCycle?: ResetCycle;
  unit?: string;
  note?: string | null;
  recordedAt?: string;
};

export type ApplyAbsoluteDeps = {
  listPools: () => Array<Pick<Pool, "id" | "name" | "quota_used">>;
  getPool: (id: string) => {
    id: string;
    name: string;
    quota_used: number;
    quota_total: number;
    reset_at: string | null;
    reset_cycle: ResetCycle;
    unit: string;
  } | null;
  updatePoolFields: (
    id: string,
    patch: {
      quota_used?: number;
      quota_total?: number;
      reset_at?: string | null;
      reset_cycle?: ResetCycle;
      unit?: string;
    },
  ) => void;
  insertUsageRecord: (
    poolId: string,
    amount: number,
    note: string | null,
    recordedAt?: string,
  ) => void;
};

const USED_EPSILON = 1e-6;

/**
 * Apply adapter records as sync usage.
 * `record.amount` is treated as absolute used from a snapshot.
 * Only the positive delta vs current quota_used is recorded.
 * Manual history is never deleted or reduced.
 */
export function applyAdapterResult(result: AdapterResult, deps: ApplyDeps): ApplyReport {
  if (!result.ok) {
    return {
      added: 0,
      totalsUpdated: 0,
      skipped: true,
      unmatched: [],
      message: result.message ?? "Adapter failed; manual entry remains the source of truth",
    };
  }

  const unmatched: string[] = [];
  let added = 0;
  let totalsUpdated = 0;
  const pools = deps.listPools();

  for (const record of result.records) {
    const poolId = resolvePoolId(record.poolHint, pools);
    if (!poolId) {
      unmatched.push(record.poolHint);
      continue;
    }
    const total = result.totals?.[record.poolHint];
    if (total != null && Number.isFinite(total) && total > 0) {
      const current = deps.getPool(poolId);
      if (current && current.quota_total !== total) {
        deps.setQuotaTotal(poolId, total);
        totalsUpdated += 1;
      }
    }
    const pool = deps.getPool(poolId);
    if (!pool) continue;
    const snapshotUsed = Number(record.amount);
    if (!Number.isFinite(snapshotUsed)) continue;
    const delta = snapshotUsed - pool.quota_used;
    if (delta > 0) {
      deps.addUsage(
        poolId,
        delta,
        record.note ?? "Cursor snapshot",
        record.recordedAt,
      );
      added += 1;
    }
  }

  const unmatchedNote =
    unmatched.length > 0 ? ` Unmatched hints: ${unmatched.join(", ")}.` : "";
  return {
    added,
    totalsUpdated,
    skipped: false,
    unmatched,
    message:
      added === 0 && totalsUpdated === 0
        ? `Snapshot applied; no quota increase.${unmatchedNote}`
        : `Added ${added} sync record(s), updated ${totalsUpdated} total(s).${unmatchedNote}`,
  };
}

/**
 * Live usage-summary values are absolute remaining-quota percents.
 * Always write quota_used / quota_total / reset_at (including a lower used
 * after a cycle reset). Insert a source=sync record only when used changed.
 */
export function applyAbsoluteUsage(
  drafts: AbsoluteUsageDraft[],
  deps: ApplyAbsoluteDeps,
): ApplyReport {
  const unmatched: string[] = [];
  let added = 0;
  let totalsUpdated = 0;
  const pools = deps.listPools();

  for (const item of drafts) {
    const poolId = resolvePoolId(item.poolHint, pools);
    if (!poolId) {
      unmatched.push(item.poolHint);
      continue;
    }
    const pool = deps.getPool(poolId);
    if (!pool) continue;
    const used = Number(item.quotaUsed);
    if (!Number.isFinite(used)) continue;

    const previousUsed = pool.quota_used;
    const patch: Parameters<ApplyAbsoluteDeps["updatePoolFields"]>[1] = { quota_used: used };
    if (item.quotaTotal != null && Number.isFinite(item.quotaTotal) && item.quotaTotal > 0) {
      if (pool.quota_total !== item.quotaTotal) totalsUpdated += 1;
      patch.quota_total = item.quotaTotal;
    }
    if (item.resetAt !== undefined) patch.reset_at = item.resetAt;
    if (item.resetCycle) patch.reset_cycle = item.resetCycle;
    if (item.unit) patch.unit = item.unit;
    deps.updatePoolFields(poolId, patch);

    const delta = used - previousUsed;
    if (Math.abs(delta) > USED_EPSILON) {
      deps.insertUsageRecord(poolId, delta, item.note ?? "Live sync", item.recordedAt);
      added += 1;
    }
  }

  const unmatchedNote =
    unmatched.length > 0 ? ` Unmatched hints: ${unmatched.join(", ")}.` : "";
  return {
    added,
    totalsUpdated,
    skipped: false,
    unmatched,
    message:
      added === 0 && totalsUpdated === 0
        ? `Live snapshot applied; no quota change.${unmatchedNote}`
        : `Set absolute quota on ${drafts.length - unmatched.length} pool(s), wrote ${added} sync record(s).${unmatchedNote}`,
  };
}
