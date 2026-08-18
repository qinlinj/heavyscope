import { describe, expect, it } from "vitest";
import type { Pool, UsageRecord } from "@/db/schema";
import { dailySeries, filterRecords, poolShare, weeklySeries } from "@/lib/charts";

function record(
  poolId: string,
  amount: number,
  recordedAt: Date | string,
  source: UsageRecord["source"] = "manual",
): UsageRecord {
  const iso = typeof recordedAt === "string" ? recordedAt : recordedAt.toISOString();
  return {
    id: `${poolId}-${iso}-${amount}`,
    pool_id: poolId,
    amount,
    recorded_at: iso,
    note: null,
    source,
  };
}

function pool(partial: Partial<Pool> & Pick<Pool, "id" | "name">): Pool {
  const now = "2026-08-01T00:00:00.000Z";
  return {
    type: "credits",
    quota_total: 100,
    quota_used: 0,
    reset_at: null,
    reset_cycle: "weekly",
    unit: "req",
    color: "#22c55e",
    is_preset: 0,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

describe("dailySeries", () => {
  const now = new Date(2026, 7, 18, 12, 0, 0);

  it("fills the requested window and sums amounts by local date and pool", () => {
    const records = [
      record("p1", 5, new Date(2026, 7, 18, 9, 0, 0)),
      record("p1", 1, new Date(2026, 7, 18, 18, 0, 0)),
      record("p2", 2, new Date(2026, 7, 17, 9, 0, 0)),
      record("p1", 99, new Date(2026, 7, 1, 9, 0, 0)),
    ];
    const series = dailySeries(records, undefined, 3, now);
    expect(series).toHaveLength(3);
    expect(series.map((point) => point.date)).toEqual([
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
    ]);
    expect(series[0]).toMatchObject({ total: 0, p1: 0, p2: 0 });
    expect(series[1]).toMatchObject({ total: 2, p2: 2, p1: 0 });
    expect(series[2]).toMatchObject({ total: 6, p1: 6, p2: 0 });
  });
});

describe("weeklySeries", () => {
  const now = new Date(2026, 7, 18, 12, 0, 0);

  it("buckets records into Monday-started weeks", () => {
    const records = [
      record("p1", 4, new Date(2026, 7, 18, 10, 0, 0)),
      record("p1", 3, new Date(2026, 7, 10, 10, 0, 0)),
    ];
    const series = weeklySeries(records, 3, undefined, now);
    expect(series).toHaveLength(3);
    expect(series.map((point) => point.week)).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
    ]);
    expect(series[1]).toMatchObject({ total: 3, p1: 3 });
    expect(series[2]).toMatchObject({ total: 4, p1: 4 });
  });
});

describe("poolShare", () => {
  it("uses quota_used from pools and skips empty pools", () => {
    const share = poolShare([
      pool({ id: "p1", name: "Models", quota_used: 12, color: "#111111" }),
      pool({ id: "p2", name: "Empty", quota_used: 0 }),
      pool({ id: "p3", name: "Other", quota_used: 8, color: "#222222" }),
    ]);
    expect(share).toEqual([
      { name: "Models", value: 12, color: "#111111" },
      { name: "Other", value: 8, color: "#222222" },
    ]);
  });

  it("falls back to summed record amounts when pools are not passed as the first argument", () => {
    const share = poolShare(
      [record("p1", 5, new Date(2026, 7, 18)), record("p1", 1, new Date(2026, 7, 17))],
      [pool({ id: "p1", name: "Models", color: "#333333" })],
    );
    expect(share).toEqual([{ name: "Models", value: 6, color: "#333333" }]);
  });
});

describe("filterRecords", () => {
  const records = [
    record("p1", 1, new Date(2026, 7, 16, 12, 0, 0), "manual"),
    record("p1", 2, new Date(2026, 7, 18, 12, 0, 0), "sync"),
    record("p2", 3, new Date(2026, 7, 18, 12, 0, 0), "manual"),
  ];

  it("filters by pool, inclusive local date range, and source", () => {
    expect(filterRecords(records, { poolId: "p1" }).map((item) => item.amount)).toEqual([1, 2]);
    expect(filterRecords(records, { source: "sync" }).map((item) => item.amount)).toEqual([2]);
    expect(
      filterRecords(records, { from: "2026-08-17", to: "2026-08-18" }).map((item) => item.amount),
    ).toEqual([2, 3]);
  });

  it("treats poolId=all and source=all as no filter", () => {
    expect(filterRecords(records, { poolId: "all", source: "all" })).toHaveLength(3);
  });
});
