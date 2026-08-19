import { resolvePoolId } from "./apply";
import type { LiveApplyDeps, LiveApplyReport, LiveProviderResult } from "./liveTypes";

const USED_EPSILON = 1e-6;

export function applyLiveSnapshot(result: LiveProviderResult, deps: LiveApplyDeps): LiveApplyReport {
  if (!result.ok) {
    return {
      updated: 0,
      recordsAdded: 0,
      unmatched: [],
      skipped: true,
      message: result.message || "Live sync failed; manual entry remains the source of truth",
    };
  }

  const unmatched: string[] = [];
  let updated = 0;
  let recordsAdded = 0;
  const pools = deps.listPools();

  for (const item of result.pools) {
    const poolId = resolvePoolId(item.poolHint, pools);
    if (!poolId) {
      unmatched.push(item.poolHint);
      continue;
    }
    const pool = deps.getPool(poolId);
    if (!pool) continue;

    const used = Number(item.quotaUsed);
    const total = Number(item.quotaTotal);
    if (!Number.isFinite(used)) continue;

    const previousUsed = pool.quota_used;
    const patch: Parameters<LiveApplyDeps["updatePoolFields"]>[1] = { quota_used: used };
    if (Number.isFinite(total) && total > 0) patch.quota_total = total;
    if (item.resetAt !== undefined) patch.reset_at = item.resetAt;
    if (item.resetCycle) patch.reset_cycle = item.resetCycle;
    if (item.unit) patch.unit = item.unit;
    deps.updatePoolFields(poolId, patch);
    updated += 1;

    const delta = used - previousUsed;
    if (Math.abs(delta) > USED_EPSILON) {
      deps.insertUsageRecord(poolId, delta, item.note ?? "Live sync", item.recordedAt);
      recordsAdded += 1;
    }
  }

  const unmatchedNote = unmatched.length > 0 ? ` Unmatched hints: ${unmatched.join(", ")}.` : "";
  return {
    updated,
    recordsAdded,
    unmatched,
    skipped: false,
    message:
      updated === 0
        ? `Live snapshot applied; no pools updated.${unmatchedNote}`
        : `Updated ${updated} pool(s), wrote ${recordsAdded} sync record(s).${unmatchedNote}`,
  };
}

export function mergeLiveReports(reports: Array<{ provider: string; result: LiveProviderResult; apply: LiveApplyReport }>): {
  message: string;
  anyOk: boolean;
} {
  if (reports.length === 0) {
    return { message: "No live connectors are configured", anyOk: false };
  }
  const parts = reports.map((item) => `${item.provider}: ${item.apply.message}`);
  return {
    message: parts.join(" "),
    anyOk: reports.some((item) => item.result.ok),
  };
}
