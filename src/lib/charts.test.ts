import { describe, expect, it } from "vitest";
import type { Pool, UsageRecord } from "@/db/schema";
import {
  CHART_MODULE_IDS,
  dailySeries,
  filterRecords,
  groupChartModules,
  monthlySeries,
  moveChartModule,
  parseChartPrefs,
  periodTotal,
  poolShare,
  poolUsageBars,
  reorderChartModules,
  scaleSeries,
  visibleChartModules,
  weeklySeries,
} from "@/lib/charts";

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

describe("monthlySeries", () => {
  const now = new Date(2026, 7, 18, 12, 0, 0);

  it("buckets records into calendar months including the current month", () => {
    const records = [
      record("p1", 4, new Date(2026, 7, 18, 10, 0, 0)),
      record("p1", 3, new Date(2026, 6, 10, 10, 0, 0)),
      record("p2", 2, new Date(2026, 5, 2, 10, 0, 0)),
      record("p1", 99, new Date(2026, 1, 1, 10, 0, 0)),
    ];
    const series = monthlySeries(records, 3, undefined, now);
    expect(series).toHaveLength(3);
    expect(series.map((point) => point.month)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(series[0]).toMatchObject({ total: 2, p2: 2, p1: 0 });
    expect(series[1]).toMatchObject({ total: 3, p1: 3 });
    expect(series[2]).toMatchObject({ total: 4, p1: 4 });
  });
});

describe("scaleSeries", () => {
  const now = new Date(2026, 7, 18, 12, 0, 0);
  const records = [record("p1", 5, new Date(2026, 7, 18, 9, 0, 0))];

  it("normalizes day / week / month series onto a shared key field", () => {
    expect(scaleSeries(records, "day", undefined, now, { days: 2 }).map((point) => point.key)).toEqual([
      "2026-08-17",
      "2026-08-18",
    ]);
    expect(scaleSeries(records, "week", undefined, now, { weeks: 1 })[0]).toMatchObject({
      key: "2026-08-17",
      total: 5,
      p1: 5,
    });
    expect(scaleSeries(records, "month", undefined, now, { months: 1 })[0]).toMatchObject({
      key: "2026-08",
      total: 5,
    });
  });
});

describe("poolUsageBars", () => {
  it("uses each pool's own used percent so USD and percent pools are not mixed", () => {
    const bars = poolUsageBars([
      pool({ id: "usd", name: "Cursor $", quota_used: 100, quota_total: 400, unit: "USD", color: "#111" }),
      pool({ id: "pct", name: "Grok %", quota_used: 80, quota_total: 100, unit: "credits", color: "#222" }),
      pool({ id: "zero", name: "Empty", quota_used: 0, quota_total: 50 }),
    ]);
    expect(bars).toEqual([
      { id: "usd", name: "Cursor $", percent: 25, color: "#111", unit: "USD" },
      { id: "pct", name: "Grok %", percent: 80, color: "#222", unit: "credits" },
      { id: "zero", name: "Empty", percent: 0, color: "#22c55e", unit: "req" },
    ]);
  });
});

describe("chart module prefs", () => {
  it("defaults every module on and uses advisor → heatmap → trend order", () => {
    const prefs = parseChartPrefs({});
    expect(prefs.show).toEqual({ advisor: true, heatmap: true, trend: true });
    expect(prefs.order).toEqual(["advisor", "heatmap", "trend"]);
    expect(CHART_MODULE_IDS).toEqual(["advisor", "heatmap", "trend"]);
  });

  it("parses stored visibility and fills missing module ids", () => {
    const prefs = parseChartPrefs({
      chart_show_heatmap: "false",
      chart_show_trend: "0",
      chart_module_order: '["trend","heatmap"]',
    });
    expect(prefs.show).toEqual({ advisor: true, heatmap: false, trend: false });
    expect(prefs.order).toEqual(["trend", "heatmap", "advisor"]);
  });

  it("treats blank or unknown order JSON as the default list", () => {
    expect(parseChartPrefs({ chart_module_order: "nope" }).order).toEqual([
      "advisor",
      "heatmap",
      "trend",
    ]);
  });

  it("moves a module up or down and clamps at the edges", () => {
    const order = ["advisor", "heatmap", "trend"] as const;
    expect(moveChartModule([...order], "heatmap", "up")).toEqual(["heatmap", "advisor", "trend"]);
    expect(moveChartModule([...order], "heatmap", "down")).toEqual(["advisor", "trend", "heatmap"]);
    expect(moveChartModule([...order], "advisor", "up")).toEqual(["advisor", "heatmap", "trend"]);
    expect(moveChartModule([...order], "trend", "down")).toEqual(["advisor", "heatmap", "trend"]);
  });

  it("reorders by inserting the dragged module before the drop target", () => {
    const order = ["advisor", "heatmap", "trend"] as const;
    expect(reorderChartModules([...order], "trend", "advisor")).toEqual(["trend", "advisor", "heatmap"]);
    expect(reorderChartModules([...order], "advisor", "trend")).toEqual(["heatmap", "advisor", "trend"]);
    expect(reorderChartModules([...order], "heatmap", "heatmap")).toEqual(["advisor", "heatmap", "trend"]);
    expect(reorderChartModules([...order], "heatmap", "advisor")).toEqual(["heatmap", "advisor", "trend"]);
  });

  it("keeps hidden modules in the order array and skips them in the visible stack", () => {
    const order = ["advisor", "heatmap", "trend"] as const;
    const show = { advisor: false, heatmap: true, trend: true };
    expect(visibleChartModules([...order], show)).toEqual(["heatmap", "trend"]);
    expect(reorderChartModules([...order], "trend", "heatmap")).toEqual(["advisor", "trend", "heatmap"]);
    expect(visibleChartModules(["advisor", "trend", "heatmap"], show)).toEqual(["trend", "heatmap"]);
    expect(groupChartModules(["advisor", "heatmap", "trend"], show)).toEqual([
      { type: "heatmap", ids: ["heatmap"] },
      { type: "trend", ids: ["trend"] },
    ]);
  });

  it("renders advisor, heatmap, and trend as independent full-width modules", () => {
    expect(groupChartModules(["advisor", "heatmap", "trend"], { advisor: true, heatmap: true, trend: true })).toEqual([
      { type: "advisor", ids: ["advisor"] },
      { type: "heatmap", ids: ["heatmap"] },
      { type: "trend", ids: ["trend"] },
    ]);
    expect(groupChartModules(["heatmap", "advisor", "trend"], { advisor: true, heatmap: true, trend: true })).toEqual([
      { type: "heatmap", ids: ["heatmap"] },
      { type: "advisor", ids: ["advisor"] },
      { type: "trend", ids: ["trend"] },
    ]);
    expect(groupChartModules(["advisor", "heatmap", "trend"], { advisor: false, heatmap: true, trend: false })).toEqual([
      { type: "heatmap", ids: ["heatmap"] },
    ]);
  });
});

describe("periodTotal", () => {
  const now = new Date(2026, 7, 18, 12, 0, 0);

  it("sums the current day / week / month bucket for one pool", () => {
    const records = [
      record("p1", 5, new Date(2026, 7, 18, 9, 0, 0)),
      record("p1", 3, new Date(2026, 7, 17, 9, 0, 0)),
      record("p1", 2, new Date(2026, 6, 10, 9, 0, 0)),
      record("p2", 9, new Date(2026, 7, 18, 9, 0, 0)),
    ];
    expect(periodTotal(records, "day", "p1", now)).toBe(5);
    expect(periodTotal(records, "week", "p1", now)).toBe(8);
    expect(periodTotal(records, "month", "p1", now)).toBe(8);
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
