/** Shared types for usage data-source adapters. */

export type PoolHint =
  | "grok_heavy"
  | "grok_bot"
  | "cursor_models"
  | "cursor_other"
  | `custom:${string}`;

export type AdapterUsageDraft = {
  poolHint: PoolHint | string;
  amount: number;
  recordedAt: string;
  note?: string | null;
};

export type AdapterResult = {
  ok: boolean;
  records: AdapterUsageDraft[];
  message?: string;
  /** Optional absolute quota totals keyed by pool hint. */
  totals?: Record<string, number>;
};

export type AdapterContext = {
  /** Raw JSON or CSV snapshot supplied by the user. */
  snapshot?: string;
  settings?: Record<string, string>;
};

export type UsageAdapter = {
  id: string;
  labelKey: string;
  pull(ctx: AdapterContext): Promise<AdapterResult>;
};

export type ApplyReport = {
  added: number;
  totalsUpdated: number;
  skipped: boolean;
  unmatched: string[];
  message: string;
};
