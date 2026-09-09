import { describe, expect, it } from "vitest";
import { nextMonthlyReset, nextWeeklyReset } from "@/db/defaults";
import type { Pool } from "@/db/schema";
import {
  isResetDue,
  nextCycleResetAt,
  planRollover,
  planRollovers,
  ROLLOVER_NOTE,
  ROLLOVER_SOURCE,
} from "@/lib/rollover";

function pool(partial: Partial<Pool> & Pick<Pool, "id">): Pool {
  const now = "2026-08-01T00:00:00.000Z";
  return {
    name: partial.id,
    type: "credits",
    quota_total: 100,
    quota_used: 42,
    reset_at: "2026-08-10T00:00:00.000Z",
    reset_cycle: "weekly",
    unit: "credits",
    color: "#38bdf8",
    is_preset: 1,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

describe("isResetDue", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("is due when reset_at is in the past", () => {
    expect(isResetDue(pool({ id: "a", reset_at: "2026-08-17T00:00:00.000Z" }), now)).toBe(true);
  });

  it("is not due when reset_at is now or in the future", () => {
    expect(isResetDue(pool({ id: "a", reset_at: "2026-08-18T12:00:00.000Z" }), now)).toBe(false);
    expect(isResetDue(pool({ id: "a", reset_at: "2026-08-25T00:00:00.000Z" }), now)).toBe(false);
  });

  it("skips missing, invalid, or none-cycle resets", () => {
    expect(isResetDue(pool({ id: "a", reset_at: null }), now)).toBe(false);
    expect(isResetDue(pool({ id: "a", reset_at: "not-a-date" }), now)).toBe(false);
    expect(
      isResetDue(pool({ id: "a", reset_cycle: "none", reset_at: "2026-08-01T00:00:00.000Z" }), now),
    ).toBe(false);
  });
});

describe("planRollover", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("zeros quota and advances a weekly pool to the next Monday", () => {
    const due = pool({
      id: "weekly-overdue",
      reset_cycle: "weekly",
      reset_at: "2026-07-27T00:00:00.000Z",
      quota_used: 88,
    });
    expect(planRollover(due, now)).toEqual({
      poolId: "weekly-overdue",
      nextResetAt: nextWeeklyReset(now),
      quotaUsed: 0,
      amount: 0,
      source: ROLLOVER_SOURCE,
      note: ROLLOVER_NOTE,
    });
    expect(nextWeeklyReset(now)).toBe("2026-08-24T00:00:00.000Z");
  });

  it("advances a monthly pool to the first of next month", () => {
    const due = pool({
      id: "monthly-overdue",
      reset_cycle: "monthly",
      reset_at: "2026-08-01T00:00:00.000Z",
    });
    expect(planRollover(due, now)?.nextResetAt).toBe(nextMonthlyReset(now));
    expect(nextMonthlyReset(now)).toBe("2026-09-01T00:00:00.000Z");
  });

  it("returns null when the cycle is still open", () => {
    expect(planRollover(pool({ id: "open", reset_at: "2026-08-24T00:00:00.000Z" }), now)).toBeNull();
  });

  it("reuses nextWeeklyReset / nextMonthlyReset helpers", () => {
    expect(nextCycleResetAt("weekly", now)).toBe(nextWeeklyReset(now));
    expect(nextCycleResetAt("monthly", now)).toBe(nextMonthlyReset(now));
    expect(nextCycleResetAt("none", now)).toBeNull();
  });
});

describe("planRollovers", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("plans only overdue pools and keeps history records untouched", () => {
    const due = pool({ id: "due", reset_at: "2026-08-10T00:00:00.000Z", quota_used: 15 });
    const open = pool({ id: "open", reset_at: "2026-08-24T00:00:00.000Z", quota_used: 9 });
    const history = [
      { id: "usage-1", pool_id: "due", amount: 15, recorded_at: "2026-08-09T00:00:00.000Z" },
    ];

    const plans = planRollovers([due, open], now);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.poolId).toBe("due");
    expect(plans[0]?.quotaUsed).toBe(0);
    expect(plans[0]?.amount).toBe(0);
    expect(plans[0]?.source).toBe("sync");
    expect(plans[0]?.note).toBe("Cycle reset");
    expect(history).toHaveLength(1);
    expect(history[0]?.amount).toBe(15);
  });
});
