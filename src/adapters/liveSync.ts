import { applyAbsoluteUsage } from "./apply";
import type { LiveApplyDeps, LiveApplyReport, LiveProviderResult } from "./liveTypes";

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
    recordsAdded: report.added,
    unmatched: report.unmatched,
    skipped: report.skipped,
    message: report.message,
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
