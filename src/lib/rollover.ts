import { computeResetAt } from "@/db/defaults";
import type { Pool, ResetCycle, UsageSource } from "@/db/schema";

export const ROLLOVER_NOTE = "Cycle reset";
export const ROLLOVER_SOURCE: UsageSource = "sync";

export type RolloverPlan = {
  poolId: string;
  nextResetAt: string | null;
  quotaUsed: 0;
  amount: 0;
  source: UsageSource;
  note: string;
};

export function isResetDue(
  pool: Pick<Pool, "reset_at" | "reset_cycle">,
  now = new Date(),
): boolean {
  if (pool.reset_cycle === "none") return false;
  if (!pool.reset_at) return false;
  const reset = Date.parse(pool.reset_at);
  if (Number.isNaN(reset)) return false;
  return reset < now.getTime();
}

export function nextCycleResetAt(cycle: ResetCycle, from = new Date()): string | null {
  return computeResetAt(cycle, from);
}

export function planRollover(pool: Pool, now = new Date()): RolloverPlan | null {
  if (!isResetDue(pool, now)) return null;
  return {
    poolId: pool.id,
    nextResetAt: nextCycleResetAt(pool.reset_cycle, now),
    quotaUsed: 0,
    amount: 0,
    source: ROLLOVER_SOURCE,
    note: ROLLOVER_NOTE,
  };
}

export function planRollovers(pools: Pool[], now = new Date()): RolloverPlan[] {
  const plans: RolloverPlan[] = [];
  for (const pool of pools) {
    const plan = planRollover(pool, now);
    if (plan) plans.push(plan);
  }
  return plans;
}
