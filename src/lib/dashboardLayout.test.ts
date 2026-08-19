import { describe, expect, it } from "vitest";
import {
  defaultDashboardLayout,
  defaultTrayLayout,
  ensureAllPools,
  hideTile,
  migrateFromChartPrefs,
  parseLayout,
  pruneMissingPools,
  reorderTiles,
  resolveLayout,
  serializeLayout,
  setTileSize,
  setTileVisible,
  showTile,
  tileColumnSpan,
  visibleTiles,
} from "./dashboardLayout";

const POOLS = ["preset-cursor-models", "preset-grok-heavy"];

describe("default layouts", () => {
  it("uses full-width system tiles and half-width pools on the dashboard", () => {
    const layout = defaultDashboardLayout(POOLS);
    expect(layout.version).toBe(1);
    expect(layout.tiles.map((tile) => tile.id)).toEqual([
      "advisor",
      "heatmap",
      "trend",
      "pool:preset-cursor-models",
      "pool:preset-grok-heavy",
    ]);
    expect(layout.tiles.filter((tile) => tile.type !== "pool").every((tile) => tile.size === "lg")).toBe(true);
    expect(layout.tiles.filter((tile) => tile.type === "pool").every((tile) => tile.size === "md" && tile.visible)).toBe(
      true,
    );
  });

  it("keeps the tray compact: two pools, one-line advisor, small heatmap, hidden trend", () => {
    const layout = defaultTrayLayout(["a", "b", "c"]);
    expect(layout.tiles.find((tile) => tile.id === "advisor")).toMatchObject({ size: "md", visible: true });
    expect(layout.tiles.find((tile) => tile.id === "heatmap")).toMatchObject({ size: "md", visible: true });
    expect(layout.tiles.find((tile) => tile.id === "trend")).toMatchObject({ size: "lg", visible: false });
    expect(layout.tiles.filter((tile) => tile.type === "pool").map((tile) => tile.visible)).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe("parse / serialize", () => {
  it("round-trips a valid v1 layout and skips duplicate / invalid tiles", () => {
    const raw = serializeLayout({
      version: 1,
      tiles: [
        { id: "advisor", type: "advisor", size: "lg", visible: true },
        { id: "advisor", type: "advisor", size: "sm", visible: false },
        { id: "pool:p1", type: "pool", size: "md", visible: true, poolId: "p1" },
        { id: "nope", type: "pool", size: "md", visible: true },
      ],
    });
    const parsed = parseLayout(raw);
    expect(parsed?.tiles).toEqual([
      { id: "advisor", type: "advisor", size: "lg", visible: true },
      { id: "pool:p1", type: "pool", size: "md", visible: true, poolId: "p1" },
    ]);
    expect(parseLayout(serializeLayout(parsed!))).toEqual(parsed);
  });

  it("returns null for missing, blank, or invalid JSON so callers can migrate", () => {
    expect(parseLayout(undefined)).toBeNull();
    expect(parseLayout("")).toBeNull();
    expect(parseLayout("nope")).toBeNull();
    expect(parseLayout('{"version":2,"tiles":[]}')).toBeNull();
    expect(parseLayout('{"version":1,"tiles":[]}')).toBeNull();
  });

  it("defaults a missing size and treats visible !== false as shown", () => {
    const parsed = parseLayout(
      JSON.stringify({
        version: 1,
        tiles: [{ type: "heatmap" }, { type: "pool", poolId: "x", visible: false }],
      }),
    );
    expect(parsed?.tiles[0]).toMatchObject({ id: "heatmap", type: "heatmap", size: "lg", visible: true });
    expect(parsed?.tiles[1]).toMatchObject({ id: "pool:x", visible: false, poolId: "x" });
  });
});

describe("migrateFromChartPrefs", () => {
  it("preserves chart module hide/order and appends pools at md", () => {
    const layout = migrateFromChartPrefs(
      {
        chart_show_heatmap: "false",
        chart_show_trend: "0",
        chart_module_order: '["trend","heatmap"]',
      },
      POOLS,
    );
    expect(layout.tiles.map((tile) => [tile.id, tile.visible])).toEqual([
      ["trend", false],
      ["heatmap", false],
      ["advisor", true],
      ["pool:preset-cursor-models", true],
      ["pool:preset-grok-heavy", true],
    ]);
    expect(layout.tiles.find((tile) => tile.id === "advisor")?.size).toBe("lg");
    expect(layout.tiles.find((tile) => tile.type === "pool")?.size).toBe("md");
  });

  it("uses the default advisor → heatmap → trend stack when prefs are empty", () => {
    expect(migrateFromChartPrefs({}, []).tiles.map((tile) => tile.id)).toEqual(["advisor", "heatmap", "trend"]);
  });
});

describe("reorder / size / hide", () => {
  const base = defaultDashboardLayout(["p1", "p2"]);

  it("inserts the dragged tile before the drop target, including hidden tiles", () => {
    const hidden = hideTile(base, "heatmap");
    const moved = reorderTiles(hidden, "trend", "advisor");
    expect(moved.tiles.map((tile) => tile.id)).toEqual([
      "trend",
      "advisor",
      "heatmap",
      "pool:p1",
      "pool:p2",
    ]);
    expect(moved.tiles.find((tile) => tile.id === "heatmap")?.visible).toBe(false);
    expect(reorderTiles(base, "advisor", "advisor").tiles.map((tile) => tile.id)).toEqual(
      base.tiles.map((tile) => tile.id),
    );
  });

  it("sets size and toggles visibility without dropping the tile", () => {
    const sized = setTileSize(base, "pool:p1", "sm");
    expect(sized.tiles.find((tile) => tile.id === "pool:p1")?.size).toBe("sm");
    const hidden = hideTile(sized, "pool:p1");
    expect(visibleTiles(hidden).map((tile) => tile.id)).not.toContain("pool:p1");
    expect(hidden.tiles.find((tile) => tile.id === "pool:p1")).toMatchObject({ visible: false, size: "sm" });
    expect(showTile(hidden, "pool:p1").tiles.find((tile) => tile.id === "pool:p1")?.visible).toBe(true);
    expect(setTileVisible(base, "missing", false)).toEqual(base);
  });
});

describe("ensureAllPools / pruneMissingPools", () => {
  it("appends new pools at md and drops deleted ones", () => {
    const layout = defaultDashboardLayout(["p1"]);
    const withNew = ensureAllPools(layout, ["p1", "p2"]);
    expect(withNew.tiles.at(-1)).toMatchObject({
      id: "pool:p2",
      type: "pool",
      size: "md",
      visible: true,
      poolId: "p2",
    });
    const pruned = pruneMissingPools(withNew, ["p2"]);
    expect(pruned.tiles.some((tile) => tile.poolId === "p1")).toBe(false);
    expect(pruned.tiles.some((tile) => tile.poolId === "p2")).toBe(true);
    expect(pruned.tiles.some((tile) => tile.id === "advisor")).toBe(true);
  });

  it("hides newly created pools on the tray so the 380x520 panel stays dense", () => {
    const tray = defaultTrayLayout(["a"]);
    const next = ensureAllPools(tray, ["a", "b"], "tray");
    expect(next.tiles.find((tile) => tile.poolId === "b")).toMatchObject({ size: "md", visible: false });
  });
});

describe("resolveLayout", () => {
  it("migrates dashboard prefs when dashboard_layout is absent", () => {
    const layout = resolveLayout(
      { chart_show_trend: "false", chart_module_order: '["heatmap","advisor","trend"]' },
      ["p1"],
      "dashboard",
    );
    expect(layout.tiles.map((tile) => tile.id)).toEqual(["heatmap", "advisor", "trend", "pool:p1"]);
    expect(layout.tiles.find((tile) => tile.id === "trend")?.visible).toBe(false);
  });

  it("does not reuse the web layout for the tray", () => {
    const saved = serializeLayout(defaultDashboardLayout(["p1", "p2", "p3"]));
    const tray = resolveLayout({ dashboard_layout: saved }, ["p1", "p2", "p3"], "tray");
    expect(tray.tiles.find((tile) => tile.id === "trend")?.visible).toBe(false);
    expect(tray.tiles.filter((tile) => tile.type === "pool" && tile.visible)).toHaveLength(2);
  });

  it("prunes and fills against a stored dashboard_layout", () => {
    const stored = serializeLayout(defaultDashboardLayout(["gone"]));
    const layout = resolveLayout({ dashboard_layout: stored }, ["fresh"], "dashboard");
    expect(layout.tiles.some((tile) => tile.poolId === "gone")).toBe(false);
    expect(layout.tiles.some((tile) => tile.poolId === "fresh")).toBe(true);
  });
});

describe("tileColumnSpan", () => {
  it("maps sm/md/lg to 1/2/4 on the dashboard and 1/2/2 on the tray", () => {
    expect(tileColumnSpan("sm", 4)).toBe(1);
    expect(tileColumnSpan("md", 4)).toBe(2);
    expect(tileColumnSpan("lg", 4)).toBe(4);
    expect(tileColumnSpan("xl", 4)).toBe(4);
    expect(tileColumnSpan("sm", 2)).toBe(1);
    expect(tileColumnSpan("md", 2)).toBe(2);
    expect(tileColumnSpan("lg", 2)).toBe(2);
  });
});
