import { describe, expect, it, vi } from "vitest";
import type { Pool, UsageRecord } from "@/db/schema";
import type { PoolAdvice } from "@/lib/burnRate";
import type { LayoutTile } from "@/lib/dashboardLayout";
import {
  parseTrayPane,
  recentPoolDeltas,
  runTrayRefresh,
  selectTrayDashboardPools,
  shouldShowTrayHeatmap,
  toggleExpandedPoolId,
  trayProviderSync,
  visiblePoolIds,
} from "./trayView";

function pool(id: string): Pool {
  return {
    id,
    name: id,
    type: "credits",
    quota_total: 100,
    quota_used: 10,
    reset_at: "2026-08-24T00:00:00.000Z",
    reset_cycle: "weekly",
    unit: "%",
    color: "#22c55e",
    is_preset: 1,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
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

function record(partial: Partial<UsageRecord> & Pick<UsageRecord, "id" | "pool_id" | "amount" | "recorded_at">): UsageRecord {
  return {
    note: null,
    source: "sync",
    ...partial,
  };
}

describe("parseTrayPane", () => {
  it("treats settings as the only non-dashboard pane", () => {
    expect(parseTrayPane("settings")).toBe("settings");
    expect(parseTrayPane("dashboard")).toBe("dashboard");
    expect(parseTrayPane(null)).toBe("dashboard");
    expect(parseTrayPane("nope")).toBe("dashboard");
  });
});

describe("toggleExpandedPoolId", () => {
  it("expands one pool and collapses on a second click", () => {
    expect(toggleExpandedPoolId(null, "hot")).toBe("hot");
    expect(toggleExpandedPoolId("hot", "hot")).toBeNull();
    expect(toggleExpandedPoolId("hot", "mid")).toBe("mid");
  });
});

describe("selectTrayDashboardPools", () => {
  it("returns the 1–2 tightest visible pools and ignores hidden ones", () => {
    const selected = selectTrayDashboardPools(
      [pool("cool"), pool("hot"), pool("mid"), pool("hidden")],
      [
        advice({ poolId: "cool", usagePercent: 20, risk: "ok" }),
        advice({ poolId: "hot", usagePercent: 91, risk: "overspend" }),
        advice({ poolId: "mid", usagePercent: 70, risk: "ok" }),
        advice({ poolId: "hidden", usagePercent: 99, risk: "overspend" }),
      ],
      ["cool", "hot", "mid"],
    );
    expect(selected.map((item) => item.id)).toEqual(["hot", "mid"]);
  });
});

describe("visiblePoolIds", () => {
  it("keeps only visible pool tiles", () => {
    const tiles: LayoutTile[] = [
      { id: "advisor", type: "advisor", size: "md", visible: true },
      { id: "pool:a", type: "pool", size: "md", visible: true, poolId: "a" },
      { id: "pool:b", type: "pool", size: "md", visible: false, poolId: "b" },
    ];
    expect(visiblePoolIds(tiles)).toEqual(["a"]);
  });
});

describe("shouldShowTrayHeatmap", () => {
  it("hides the heatmap when a pool is expanded or Settings is open", () => {
    expect(
      shouldShowTrayHeatmap({
        heatmapVisible: true,
        expandedPoolId: null,
        pane: "dashboard",
        editing: false,
      }),
    ).toBe(true);
    expect(
      shouldShowTrayHeatmap({
        heatmapVisible: true,
        expandedPoolId: "hot",
        pane: "dashboard",
        editing: false,
      }),
    ).toBe(false);
    expect(
      shouldShowTrayHeatmap({
        heatmapVisible: true,
        expandedPoolId: null,
        pane: "settings",
        editing: false,
      }),
    ).toBe(false);
  });
});

describe("recentPoolDeltas", () => {
  it("returns the newest 1–2 non-demo records", () => {
    const deltas = recentPoolDeltas(
      [
        record({ id: "1", pool_id: "hot", amount: 1, recorded_at: "2026-08-18T10:00:00.000Z" }),
        record({ id: "2", pool_id: "hot", amount: 3, recorded_at: "2026-08-19T10:00:00.000Z" }),
        record({
          id: "3",
          pool_id: "hot",
          amount: 9,
          recorded_at: "2026-08-20T10:00:00.000Z",
          source: "demo",
          note: "Demo seed: skip",
        }),
        record({ id: "4", pool_id: "hot", amount: 2, recorded_at: "2026-08-17T10:00:00.000Z" }),
      ],
      2,
    );
    expect(deltas.map((item) => item.id)).toEqual(["2", "1"]);
  });
});

describe("trayProviderSync", () => {
  it("marks providers not connected when no token is stored", () => {
    const sync = trayProviderSync({});
    expect(sync.cursor.configured).toBe(false);
    expect(sync.grok.configured).toBe(false);
  });

  it("surfaces last-sync and expired from the same keys as Settings", () => {
    const sync = trayProviderSync({
      cursor_session_token: "tok",
      cursor_connected: "expired",
      cursor_last_synced_at: "2026-08-20T00:00:00.000Z",
      cursor_sync_message: "gRPC 16",
      grok_bearer_token: "bear",
      grok_last_synced_at: "2026-08-20T01:00:00.000Z",
    });
    expect(sync.cursor.configured).toBe(true);
    expect(sync.cursor.expired).toBe(true);
    expect(sync.cursor.message).toBe("gRPC 16");
    expect(sync.grok.configured).toBe(true);
    expect(sync.grok.lastSyncedAt).toBe("2026-08-20T01:00:00.000Z");
  });
});

describe("runTrayRefresh", () => {
  it("calls refreshLiveProviders with no provider filter", async () => {
    const refreshLiveProviders = vi.fn(async () => ({ message: "ok" }));
    const report = await runTrayRefresh(refreshLiveProviders);
    expect(refreshLiveProviders).toHaveBeenCalledTimes(1);
    expect(refreshLiveProviders).toHaveBeenCalledWith();
    expect(report).toEqual({ message: "ok" });
  });
});
