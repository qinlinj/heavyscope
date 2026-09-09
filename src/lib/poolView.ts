import type { Pool } from "@/db/schema";
import { remaining, usagePercent } from "@/lib/format";

/** Fields a 1/4 (`sm`) pool card must still show. Recent records and long advice are dropped. */
export type CompactPoolView = {
  name: string;
  unit: string;
  percent: number;
  remaining: number;
  used: number;
  total: number;
  resetAt: string | null;
};

export function compactPoolView(pool: Pick<Pool, "name" | "unit" | "quota_used" | "quota_total" | "reset_at">): CompactPoolView {
  const asPool = pool as Pool;
  return {
    name: pool.name,
    unit: pool.unit,
    percent: usagePercent(asPool),
    remaining: remaining(asPool),
    used: pool.quota_used,
    total: pool.quota_total,
    resetAt: pool.reset_at,
  };
}
