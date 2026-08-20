import { describe, expect, it, vi } from "vitest";
import type { Pool, UsageRecord } from "@/db/schema";
import type { PoolAdvice } from "@/lib/burnRate";
import type { LayoutTile } from "@/lib/dashboardLayout";
import { clampSquareCellPx, squareCellPx } from "@/lib/heatmap";
import {
  highlightedTrayPoolIds,
  parseTrayPane,
  recentPoolDeltas,
  runTrayRefresh,
  selectTrayDashboardPools,
  shouldShowTrayHeatmap,
  toggleExpandedPoolId,
  trayHeatmapCellPx,
  trayProviderSync,
  TRAY_HEATMAP_MAX_CELL_PX,
  TRAY_HEATMAP_MIN_CELL_PX,
  TRAY_HEATMAP_WEEKS,
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
  it("returns every visible pool from tray_layout, including more than three", () => {
    const selected = selectTrayDashboardPools(
      [pool("cool"), pool("hot"), pool("mid"), pool("fourth"), pool("hidden")],
      ["cool", "hot", "mid", "fourth"],
    );
    expect(selected.map((item) => item.id)).toEqual(["cool", "hot", "mid", "fourth"]);
  });

  it("keeps layout order, drops hidden and deleted pools, and picks up new ones", () => {
    const selected = selectTrayDashboardPools(
      [pool("new"), pool("kept"), pool("gone-from-layout")],
      ["kept", "missing-deleted", "new"],
    );
    expect(selected.map((item) => item.id)).toEqual(["kept", "new"]);
  });
});

describe("highlightedTrayPoolIds", () => {
  it("marks only the tightest 1–2 visible pools", () => {
    expect(
      highlightedTrayPoolIds(
        [
          advice({ poolId: "cool", usagePercent: 20, risk: "ok" }),
          advice({ poolId: "hot", usagePercent: 91, risk: "overspend" }),
          advice({ poolId: "mid", usagePercent: 70, risk: "ok" }),
          advice({ poolId: "hidden", usagePercent: 99, risk: "overspend" }),
        ],
        ["cool", "hot", "mid"],
      ),
    ).toEqual(["hot", "mid"]);
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
  it("shows the heatmap on the dashboard when the layout tile is visible", () => {
    expect(
      shouldShowTrayHeatmap({
        heatmapVisible: true,
        pane: "dashboard",
        editing: false,
      }),
    ).toBe(true);
    expect(
      shouldShowTrayHeatmap({
        heatmapVisible: true,
        pane: "settings",
        editing: false,
      }),
    ).toBe(false);
    expect(
      shouldShowTrayHeatmap({
        heatmapVisible: true,
        pane: "dashboard",
        editing: true,
      }),
    ).toBe(false);
  });
});

describe("trayHeatmapCellPx", () => {
  it("uses squareCellPx and never stretches squares on a tall tray panel", () => {
    const wide = trayHeatmapCellPx(800, 400, TRAY_HEATMAP_WEEKS);
    expect(wide).toBe(
      clampSquareCellPx(
        squareCellPx(800, 400, TRAY_HEATMAP_WEEKS),
        TRAY_HEATMAP_MIN_CELL_PX,
        TRAY_HEATMAP_MAX_CELL_PX,
      ),
    );
    expect(wide).toBe(TRAY_HEATMAP_MAX_CELL_PX);
    expect(wide).toBeLessThan(squareCellPx(800, 400, TRAY_HEATMAP_WEEKS));
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
