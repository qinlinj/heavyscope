import { describe, expect, it } from "vitest";
import type { UsageRecord } from "@/db/schema";
import {
  DASHBOARD_RECENT_LIMIT,
  dashboardRecentListHeightPx,
  dashboardRecentRecords,
} from "@/lib/recentRecords";

function record(id: string, recordedAt: string): UsageRecord {
  return {
    id,
    pool_id: "p1",
    amount: 1,
    recorded_at: recordedAt,
    note: null,
    source: "manual",
  };
}

describe("dashboardRecentRecords", () => {
  it("keeps only the latest 2 rows newest-first", () => {
    const rows = [
      record("old", "2026-08-01T10:00:00.000Z"),
      record("mid", "2026-08-10T10:00:00.000Z"),
      record("new", "2026-08-20T10:00:00.000Z"),
    ];
    expect(dashboardRecentRecords(rows).map((item) => item.id)).toEqual(["new", "mid"]);
    expect(DASHBOARD_RECENT_LIMIT).toBe(2);
    expect(dashboardRecentRecords(rows, 2)).toHaveLength(2);
  });

  it("does not grow past two when more exist and keeps a 0/1 input short", () => {
    expect(dashboardRecentRecords([])).toEqual([]);
    expect(dashboardRecentRecords([record("only", "2026-08-20T10:00:00.000Z")])).toHaveLength(1);
    expect(dashboardRecentRecords([record("a", "2026-08-21T00:00:00.000Z"), record("b", "2026-08-20T00:00:00.000Z"), record("c", "2026-08-19T00:00:00.000Z")])).toHaveLength(2);
  });
});

describe("dashboardRecentListHeightPx", () => {
  it("is fixed for two rows and does not depend on how many items are shown", () => {
    const two = dashboardRecentListHeightPx(2);
    expect(two).toBe(44);
    expect(dashboardRecentListHeightPx(DASHBOARD_RECENT_LIMIT)).toBe(two);
    expect(two).toBeGreaterThan(dashboardRecentListHeightPx(1));
  });
});
