import { describe, expect, it } from "vitest";
import type { UsageRecord } from "@/db/schema";
import {
  MIN_DAY_FRACTION,
  crossPoolAdvice,
  daysUntilReset,
  projectionAtReset,
  recommendedDaily,
  risk,
  todayUsed,
  type PoolAdvice,
} from "@/lib/burnRate";

function usage(
  poolId: string,
  amount: number,
  recordedAt: string,
  extras: Partial<UsageRecord> = {},
): UsageRecord {
  return {
    id: extras.id ?? `${poolId}-${recordedAt}-${amount}`,
    pool_id: poolId,
    amount,
    recorded_at: recordedAt,
    note: extras.note ?? null,
    source: extras.source ?? "manual",
  };
}

function advice(partial: Partial<PoolAdvice> & Pick<PoolAdvice, "poolId">): PoolAdvice {
  return {
    daysLeft: 4,
    daysElapsed: 3,
    recommendedDaily: 10,
    todayUsedAmount: 4,
    todaySafeRemaining: 6,
    averageDaily: 10,
    risk: "ok",
    projectionAtReset: 70,
    usagePercent: 50,
    remaining: 40,
    ...partial,
  };
}

describe("daysUntilReset", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("returns full days until a future reset", () => {
    expect(daysUntilReset("2026-08-25T12:00:00.000Z", now)).toBe(7);
  });

  it("returns 0 for a missing, invalid, or past reset", () => {
    expect(daysUntilReset(null, now)).toBe(0);
    expect(daysUntilReset(undefined, now)).toBe(0);
    expect(daysUntilReset("not-a-date", now)).toBe(0);
    expect(daysUntilReset("2026-08-17T12:00:00.000Z", now)).toBe(0);
  });

  it("clamps an imminent reset to one hour (1/24 day)", () => {
    expect(daysUntilReset("2026-08-18T12:30:00.000Z", now)).toBe(MIN_DAY_FRACTION);
    expect(daysUntilReset("2026-08-18T13:00:00.000Z", now)).toBe(MIN_DAY_FRACTION);
  });
});

describe("recommendedDaily", () => {
  it("divides remaining quota by days left", () => {
    expect(recommendedDaily(100, 4)).toBe(25);
  });

  it("uses the one-hour floor when days left is zero", () => {
    expect(recommendedDaily(100, 0)).toBe(100 / MIN_DAY_FRACTION);
  });
});

describe("todayUsed", () => {
  const now = new Date(2026, 7, 18, 15, 0, 0);
  const todayMorning = new Date(2026, 7, 18, 8, 0, 0).toISOString();
  const todayEvening = new Date(2026, 7, 18, 20, 0, 0).toISOString();
  const yesterday = new Date(2026, 7, 17, 15, 0, 0).toISOString();

  it("sums only this pool's records from the local calendar day", () => {
    const records = [
      usage("pool-a", 3, todayMorning),
      usage("pool-a", 2, todayEvening),
      usage("pool-b", 9, todayMorning),
      usage("pool-a", 7, yesterday),
    ];
    expect(todayUsed(records, now, "pool-a")).toBe(5);
  });

  it("returns 0 when nothing was recorded today", () => {
    expect(todayUsed([usage("pool-a", 4, yesterday)], now, "pool-a")).toBe(0);
  });
});

describe("risk", () => {
  it("flags overspend when average daily exceeds recommended by more than 5%", () => {
    expect(
      risk({
        averageDaily: 10.6,
        recommendedDaily: 10,
        usedFraction: 0.5,
        timeElapsedFraction: 0.5,
        daysLeft: 3,
      }),
    ).toBe("overspend");
  });

  it("flags waste when usage lags elapsed time and more than two days remain", () => {
    expect(
      risk({
        averageDaily: 2,
        recommendedDaily: 10,
        usedFraction: 0.1,
        timeElapsedFraction: 0.5,
        daysLeft: 3,
      }),
    ).toBe("waste");
  });

  it("stays ok when pace is close to recommended and usage is not lagging", () => {
    expect(
      risk({
        averageDaily: 10,
        recommendedDaily: 10,
        usedFraction: 0.5,
        timeElapsedFraction: 0.5,
        daysLeft: 3,
      }),
    ).toBe("ok");
  });

  it("does not flag waste when reset is two days or closer", () => {
    expect(
      risk({
        averageDaily: 2,
        recommendedDaily: 10,
        usedFraction: 0.1,
        timeElapsedFraction: 0.5,
        daysLeft: 2,
      }),
    ).toBe("ok");
  });
});

describe("crossPoolAdvice", () => {
  it("suggests switching off an overspent pool onto one with headroom", () => {
    expect(
      crossPoolAdvice([
        advice({ poolId: "hot", risk: "overspend", usagePercent: 92, remaining: 8 }),
        advice({ poolId: "cool", usagePercent: 20, remaining: 80 }),
      ]),
    ).toEqual({ fromPoolId: "hot", toPoolId: "cool" });
  });

  it("treats usage at or above 80% as stressed even without an overspend risk", () => {
    expect(
      crossPoolAdvice([
        advice({ poolId: "hot", risk: "ok", usagePercent: 80, remaining: 20 }),
        advice({ poolId: "cool", usagePercent: 10, remaining: 90 }),
      ]),
    ).toEqual({ fromPoolId: "hot", toPoolId: "cool" });
  });

  it("returns null when no target has both unused quota and usage under 60%", () => {
    expect(
      crossPoolAdvice([
        advice({ poolId: "hot", risk: "overspend", usagePercent: 90, remaining: 5 }),
        advice({ poolId: "also-hot", usagePercent: 70, remaining: 30 }),
      ]),
    ).toBeNull();
  });
});

describe("projectionAtReset", () => {
  it("adds remaining-cycle burn onto current used", () => {
    expect(projectionAtReset(40, 5, 3)).toBe(55);
  });
});
