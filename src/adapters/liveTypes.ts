import type { ResetCycle } from "@/db/schema";

export type LiveErrorCode = "ok" | "expired" | "invalid" | "http" | "cors" | "network" | "unavailable";

export type LivePoolUpdate = {
  poolHint: string;
  quotaUsed: number;
  quotaTotal: number;
  resetAt?: string | null;
  resetCycle?: ResetCycle;
  unit?: string;
  note?: string;
  recordedAt?: string;
};

export type LiveHistoryPoint = {
  poolHint: string;
  quotaUsed: number;
  recordedAt: string;
  note?: string;
};

export type LiveBillingMeta = {
  onDemandCapUsd: number;
  onDemandUsedUsd: number;
  prepaidBalanceUsd: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  history: Array<{
    recordedAt?: string;
    year?: number;
    month?: number;
    percent?: number;
    onDemandUsedUsd?: number;
    includedUsedUsd?: number;
  }>;
};

export type LiveProviderResult = {
  ok: boolean;
  code: LiveErrorCode;
  message: string;
  pools: LivePoolUpdate[];
  resetAt?: string | null;
  /** Grok Bot / Agents segment could not be mapped from the proto. */
  botUnavailable?: boolean;
  /** Product names + percents walked from the proto (for Settings diagnostics). */
  parsedProducts?: Array<{ name: string; percent: number }>;
  /** On-demand / prepaid / period history (Settings diagnostics; $ is not Bot). */
  billing?: LiveBillingMeta;
  /**
   * Honest Heavy % history points only. Applied as heatmap/trend seed deltas.
   * Cents-only history must not appear here.
   */
  historyPoints?: LiveHistoryPoint[];
};

export type LiveApplyReport = {
  updated: number;
  recordsAdded: number;
  unmatched: string[];
  message: string;
  skipped: boolean;
};

export type LiveApplyDeps = {
  listPools: () => Array<{ id: string; name: string; quota_used: number }>;
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
  /** Skip history-seed inserts when this recordedAt already exists for the pool. */
  hasUsageAt?: (poolId: string, recordedAt: string) => boolean;
};
