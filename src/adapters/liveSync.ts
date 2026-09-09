import { applyAbsoluteUsage, resolvePoolId } from "./apply";
import type { LiveApplyDeps, LiveApplyReport, LiveHistoryPoint, LiveProviderResult } from "./liveTypes";

const USED_EPSILON = 1e-6;

function seedHistoryDeltas(points: LiveHistoryPoint[] | undefined, deps: LiveApplyDeps): number {
  if (!points || points.length === 0) return 0;
  const pools = deps.listPools();
  const grouped = new Map<string, LiveHistoryPoint[]>();
  for (const point of points) {
    const poolId = resolvePoolId(point.poolHint, pools);
    if (!poolId) continue;
    const list = grouped.get(poolId) ?? [];
    list.push(point);
    grouped.set(poolId, list);
  }

  let added = 0;
  for (const [poolId, rows] of grouped) {
    const sorted = [...rows].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    let previous = 0;
    for (const row of sorted) {
      if (deps.hasUsageAt?.(poolId, row.recordedAt)) {
        previous = row.quotaUsed;
        continue;
      }
      const dropped = row.quotaUsed + USED_EPSILON < previous;
      const delta = dropped ? row.quotaUsed : row.quotaUsed - previous;
      previous = row.quotaUsed;
      if (delta <= USED_EPSILON) continue;
      deps.insertUsageRecord(poolId, delta, row.note ?? "Grok history seed", row.recordedAt);
      deps.updatePoolFields(poolId, { quota_used: row.quotaUsed });
      added += 1;
    }
  }
  return added;
}

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

  const seeded = seedHistoryDeltas(result.historyPoints, deps);
  const report = applyAbsoluteUsage(
    result.pools.map((item) => ({
      poolHint: item.poolHint,
      quotaUsed: item.quotaUsed,
      quotaTotal: item.quotaTotal,
      resetAt: item.resetAt,
      resetCycle: item.resetCycle,
      unit: item.unit,
      note: item.note,
      recordedAt: item.recordedAt,
    })),
    deps,
  );

  return {
    updated: result.pools.length - report.unmatched.length,
    recordsAdded: report.added + seeded,
    unmatched: report.unmatched,
    skipped: report.skipped,
    message:
      seeded > 0
        ? `${report.message} Seeded ${seeded} history delta(s).`
        : report.message,
  };
}

export function mergeLiveReports(
  reports: Array<{ provider: string; result: LiveProviderResult; apply: LiveApplyReport }>,
): {
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
