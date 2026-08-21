import { describe, expect, it, vi } from "vitest";
import type { Pool, UsageRecord } from "@/db/schema";
import type { PoolAdvice } from "@/lib/burnRate";
import type { LayoutTile } from "@/lib/dashboardLayout";
import { defaultTrayLayout } from "@/lib/dashboardLayout";
import { clampSquareCellPx, squareCellPx, weeksFromWidth } from "@/lib/heatmap";
import en from "@/i18n/locales/en.json";
import zhCN from "@/i18n/locales/zh-CN.json";
import {
  applyTrayEditDone,
  defaultTrayVisibilityLayout,
  fitTrayHeatmap,
  hideTrayTileGuarded,
  highlightedTrayPoolIds,
  isProtectedTrayDefaultId,
  LINUX_DESKTOP_WINDOW,
  MACOS_TRAY_PANEL,
  parseTrayPane,
  recentPoolDeltas,
  runTrayRefresh,
  selectTrayDashboardPools,
  shouldShowTrayConnectBanner,
  shouldShowTrayHeatmap,
  shouldShowTraySettingsCta,
  toggleExpandedPoolId,
  trayExpandFacts,
  trayHeatFill,
  trayHeatmapCellPx,
  clampTrayHeatmapZoomWeeks,
  trayHeatmapWeeksFromDrag,
  trayHeroUsedPercent,
  TRAY_HEATMAP_MIN_ZOOM_WEEKS,
  trayProviderSync,
  TRAY_DEFAULT_POOL_IDS,
  TRAY_HEATMAP_MAX_CELL_PX,
  TRAY_HEATMAP_MIN_CELL_PX,
  TRAY_HEATMAP_WEEKS,
  TRAY_PROTECTED_DEFAULT_IDS,
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

  it("never leaves two ids expanded", () => {
    let current: string | null = null;
    current = toggleExpandedPoolId(current, "a");
    current = toggleExpandedPoolId(current, "b");
    current = toggleExpandedPoolId(current, "c");
    expect(current).toBe("c");
  });
});

describe("shouldShowTraySettingsCta", () => {
  it("shows a Settings CTA only for unsynced pools", () => {
    expect(shouldShowTraySettingsCta(true)).toBe(true);
    expect(shouldShowTraySettingsCta(false)).toBe(false);
  });
});

describe("shouldShowTrayConnectBanner", () => {
  it("shows the blocking banner only when neither token is pasted", () => {
    expect(shouldShowTrayConnectBanner({ cursorConfigured: false, grokConfigured: false })).toBe(true);
    expect(shouldShowTrayConnectBanner({ cursorConfigured: true, grokConfigured: false })).toBe(false);
    expect(shouldShowTrayConnectBanner({ cursorConfigured: false, grokConfigured: true })).toBe(false);
    expect(shouldShowTrayConnectBanner({ cursorConfigured: true, grokConfigured: true })).toBe(false);
  });
});

describe("tray connect and empty copy", () => {
  it("never claims four pools or a web app on /tray", () => {
    expect(en.tray.subtitleConnect.toLowerCase()).not.toMatch(/four pools/);
    expect(zhCN.tray.subtitleConnect).not.toMatch(/四个额度/);
    expect(en.tray.subtitleConnect.toLowerCase()).toMatch(/cursor/);
    expect(zhCN.tray.subtitleConnect).toMatch(/Cursor/);
    expect(en.tray.empty.toLowerCase()).not.toMatch(/web app/);
    expect(zhCN.tray.empty).not.toMatch(/网页应用/);
    expect(en.tray.empty.toLowerCase()).toMatch(/layout/);
    expect(zhCN.tray.empty).toMatch(/布局/);
  });
});

describe("trayExpandFacts", () => {
  it("returns used/total, remaining, reset, and at most two increments", () => {
    const facts = trayExpandFacts(pool("hot"), [
      record({ id: "1", pool_id: "hot", amount: 1, recorded_at: "2026-08-18T10:00:00.000Z" }),
      record({ id: "2", pool_id: "hot", amount: 3, recorded_at: "2026-08-19T10:00:00.000Z" }),
      record({ id: "3", pool_id: "hot", amount: 2, recorded_at: "2026-08-17T10:00:00.000Z" }),
    ]);
    expect(facts.used).toBe(10);
    expect(facts.total).toBe(100);
    expect(facts.remaining).toBe(90);
    expect(facts.resetAt).toBe("2026-08-24T00:00:00.000Z");
    expect(facts.increments.map((item) => item.id)).toEqual(["2", "1"]);
  });
});

describe("macOS tray panel size", () => {
  it("encodes about 400×660 and does not use the Linux 980×720 window", () => {
    expect(MACOS_TRAY_PANEL).toEqual({
      width: 400,
      height: 660,
      maxWidth: 420,
      maxHeight: 700,
    });
    expect(LINUX_DESKTOP_WINDOW).toEqual({ width: 980, height: 720 });
    expect(MACOS_TRAY_PANEL.width).not.toBe(LINUX_DESKTOP_WINDOW.width);
    expect(MACOS_TRAY_PANEL.height).not.toBe(LINUX_DESKTOP_WINDOW.height);
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
  it("does not highlight an unconnected Grok Heavy row", () => {
    expect(
      highlightedTrayPoolIds(
        [
          advice({ poolId: "preset-grok-heavy", usagePercent: 0, risk: "unconnected" }),
          advice({ poolId: "preset-cursor-models", usagePercent: 40, risk: "ok" }),
        ],
        ["preset-grok-heavy", "preset-cursor-models"],
      ),
    ).toEqual(["preset-cursor-models"]);
  });

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
        squareCellPx(800, 400, fitTrayHeatmap(800).weeks),
        TRAY_HEATMAP_MIN_CELL_PX,
        TRAY_HEATMAP_MAX_CELL_PX,
      ),
    );
    expect(wide).toBe(TRAY_HEATMAP_MAX_CELL_PX);
    expect(wide).toBeLessThan(squareCellPx(800, 400, TRAY_HEATMAP_WEEKS));
  });
});

describe("fitTrayHeatmap", () => {
  it("derives week count from width (~20–26), not a fixed 10", () => {
    const narrow = fitTrayHeatmap(80);
    const panel = fitTrayHeatmap(MACOS_TRAY_PANEL.width);
    const wide = fitTrayHeatmap(800);
    const fromWidth = weeksFromWidth(MACOS_TRAY_PANEL.width, TRAY_HEATMAP_MIN_CELL_PX);
    expect(narrow.weeks).toBeLessThan(panel.weeks);
    expect(panel.weeks).toBe(Math.min(TRAY_HEATMAP_WEEKS, fromWidth));
    expect(panel.weeks).toBeGreaterThan(10);
    expect(panel.weeks).toBeGreaterThanOrEqual(20);
    expect(panel.weeks).toBeLessThanOrEqual(26);
    expect(panel.weeks).not.toBe(10);
    expect(wide.weeks).toBe(TRAY_HEATMAP_WEEKS);
    expect(wide.weeks).toBeLessThan(40);
    expect(TRAY_HEATMAP_WEEKS).not.toBe(10);
    expect(narrow.cell).toBeGreaterThanOrEqual(TRAY_HEATMAP_MIN_CELL_PX);
    expect(panel.cell).toBeLessThanOrEqual(TRAY_HEATMAP_MAX_CELL_PX);
  });

  it("drag-zooms daily week-columns to a minimum of 2, never week/month buckets", () => {
    const fitted = fitTrayHeatmap(MACOS_TRAY_PANEL.width).weeks;
    expect(TRAY_HEATMAP_MIN_ZOOM_WEEKS).toBe(2);
    expect(clampTrayHeatmapZoomWeeks(1, fitted)).toBe(2);
    expect(clampTrayHeatmapZoomWeeks(fitted + 8, fitted)).toBe(fitted);
    const zoomed = trayHeatmapWeeksFromDrag(fitted, 200, 200, fitted);
    expect(zoomed).toBe(2);
    expect(zoomed).toBeGreaterThanOrEqual(2);
    const reset = trayHeatmapWeeksFromDrag(2, -200, 200, fitted);
    expect(reset).toBe(fitted);
    expect(typeof trayHeatmapWeeksFromDrag).toBe("function");
  });
});

describe("tray edit Done does not drop tiles", () => {
  const poolIds = [...TRAY_DEFAULT_POOL_IDS];

  it("keeps the heatmap visible when Done is pressed with no visibility change", () => {
    const entered = defaultTrayVisibilityLayout(poolIds);
    expect(entered.tiles.find((tile) => tile.type === "heatmap")?.visible).toBe(true);
    const after = applyTrayEditDone(entered, entered);
    expect(after.tiles.find((tile) => tile.type === "heatmap")?.visible).toBe(true);
    expect(after.tiles.filter((tile) => tile.visible).map((tile) => tile.id)).toEqual(
      entered.tiles.filter((tile) => tile.visible).map((tile) => tile.id),
    );
  });

  it("cannot hide all default four pools + heatmap with one accidental hide", () => {
    let layout = defaultTrayLayout(poolIds);
    const before = layout.tiles.filter((tile) => isProtectedTrayDefaultId(tile.id) && tile.visible);
    expect(before.length).toBe(5);

    layout = hideTrayTileGuarded(layout, "heatmap");
    expect(layout.tiles.find((tile) => tile.id === "heatmap")?.visible).toBe(false);
    expect(layout.tiles.some((tile) => tile.visible && isProtectedTrayDefaultId(tile.id))).toBe(true);

    for (const id of TRAY_PROTECTED_DEFAULT_IDS) {
      layout = hideTrayTileGuarded(layout, id);
    }
    const stillVisible = layout.tiles.filter((tile) => tile.visible && isProtectedTrayDefaultId(tile.id));
    expect(stillVisible.length).toBeGreaterThan(0);
    expect(stillVisible.length).toBe(1);
  });
});

describe("trayHeroUsedPercent", () => {
  const pools = [
    { id: "preset-grok-heavy", quota_total: 100, quota_used: 0 },
    { id: "preset-cursor-models", quota_total: 100, quota_used: 91 },
    { id: "preset-cursor-other", quota_total: 400, quota_used: 132.83 },
  ];
  const advices = [
    advice({ poolId: "preset-grok-heavy", risk: "unconnected", remaining: 100, usagePercent: 0 }),
    advice({ poolId: "preset-cursor-models", risk: "overspend", remaining: 9, usagePercent: 91 }),
    advice({ poolId: "preset-cursor-other", risk: "ok", remaining: 267.17, usagePercent: 33.2075 }),
  ];

  it("uses used% of the tightest connected pool for All", () => {
    const hero = trayHeroUsedPercent("all", advices, pools);
    expect(hero).toEqual({ poolId: "preset-cursor-models", usedPercent: 91, mode: "all" });
    expect(hero?.usedPercent).not.toBe(91 + 33.2075);
  });

  it("does not invent or sum mixed $ and % into one hero number", () => {
    const all = trayHeroUsedPercent("all", advices, pools, [
      "preset-cursor-models",
      "preset-cursor-other",
    ]);
    expect(all?.usedPercent).toBe(91);
    const other = trayHeroUsedPercent("preset-cursor-other", advices, pools);
    expect(other).toEqual({
      poolId: "preset-cursor-other",
      usedPercent: 33.2075,
      mode: "pool",
    });
    expect(other?.usedPercent).not.toBe(91 + 33.2075);
  });

  it("draws no hero when used% is unknown", () => {
    expect(
      trayHeroUsedPercent(
        "all",
        [advice({ poolId: "preset-grok-heavy", risk: "unconnected", usagePercent: 0 })],
        [{ id: "preset-grok-heavy", quota_total: 100, quota_used: 0 }],
      ),
    ).toBeNull();
    expect(
      trayHeroUsedPercent("hot", [advice({ poolId: "hot", risk: "ok", usagePercent: 12 })], [
        { id: "hot", quota_total: 0, quota_used: 0 },
      ]),
    ).toBeNull();
    expect(trayHeroUsedPercent("all", [], [])).toBeNull();
  });
});

describe("trayHeatFill", () => {
  it("mixes product purple into the panel, not GitHub greens", () => {
    expect(trayHeatFill(4)).toContain("var(--primary)");
    expect(trayHeatFill(0)).not.toMatch(/#0e4429|#39d353|#9be9a8|#216e39/i);
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

  it("does not invent a Cursor Spending mapper — existing live stack decides Cursor-only pools", async () => {
    const refreshLiveProviders = vi.fn(async (providers?: Array<"cursor" | "grok">) => {
      expect(providers).toBeUndefined();
      return { message: "cursor-only ok" };
    });
    await runTrayRefresh(refreshLiveProviders);
    expect(refreshLiveProviders.mock.calls[0]?.length ?? 0).toBe(0);
  });
});
