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

export type LiveProviderResult = {
  ok: boolean;
  code: LiveErrorCode;
  message: string;
  pools: LivePoolUpdate[];
  resetAt?: string | null;
  /** Grok Bot / Agents segment could not be mapped from the proto. */
  botUnavailable?: boolean;
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
};
