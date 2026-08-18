import type { Pool } from "@/db/schema";
import type { AdapterResult, ApplyReport } from "./types";

export const HINT_TO_POOL_ID: Record<string, string> = {
  grok_heavy: "preset-grok-heavy",
  grok_bot: "preset-grok-bot",
  cursor_models: "preset-cursor-models",
  cursor_other: "preset-cursor-other",
};

export function resolvePoolId(hint: string, pools: Pool[]): string | null {
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
  listPools: () => Pool[];
  getPool: (id: string) => Pool | null;
  addUsage: (
    poolId: string,
    amount: number,
    note: string | null,
    recordedAt?: string,
  ) => void;
  setQuotaTotal: (id: string, total: number) => void;
};

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
