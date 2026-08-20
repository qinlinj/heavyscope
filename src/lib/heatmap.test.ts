import { describe, expect, it } from "vitest";
import type { Pool, UsageRecord } from "@/db/schema";
import { HEATMAP_GITHUB_COLORS, clampSquareCellPx, heatmapGrid, heatmapLevel, squareCellPx } from "@/lib/heatmap";

function record(poolId: string, amount: number, recordedAt: Date): UsageRecord {
  const iso = recordedAt.toISOString();
  return {
    id: `${poolId}-${iso}-${amount}`,
    pool_id: poolId,
    amount,
    recorded_at: iso,
    note: null,
    source: "manual",
  };
}

function pool(id: string, unit: string): Pick<Pool, "id" | "unit"> {
  return { id, unit };
}

describe("heatmapGrid", () => {
  const now = new Date(2026, 7, 19, 15, 0, 0); // Wednesday

  it("builds a Sunday-aligned GitHub-style grid for the requested weeks", () => {
    const grid = heatmapGrid([], 26, now);
    expect(grid.weeks).toBe(26);
    expect(grid.cells).toHaveLength(26 * 7);
    expect(grid.cells[0]?.weekday).toBe(0);
    expect(grid.maxCount).toBe(0);
    expect(grid.intensityMetric).toBe("record_count");
  });

  it("can shrink to 12 weeks when space is tight", () => {
    const grid = heatmapGrid([], 12, now);
    expect(grid.weeks).toBe(12);
    expect(grid.cells).toHaveLength(84);
    expect(grid.cells[0]?.date).toBe("2026-05-31");
  });

  it("uses daily record count when pool units are mixed", () => {
    const records = [
      record("usd", 40, new Date(2026, 7, 18, 9, 0, 0)),
      record("usd", 10, new Date(2026, 7, 18, 18, 0, 0)),
      record("pct", 1, new Date(2026, 7, 17, 9, 0, 0)),
      record("usd", 99, new Date(2026, 3, 1, 9, 0, 0)),
    ];
    const grid = heatmapGrid(records, 17, now, [pool("usd", "USD"), pool("pct", "%")]);
    const aug18 = grid.cells.find((cell) => cell.date === "2026-08-18");
    const aug17 = grid.cells.find((cell) => cell.date === "2026-08-17");
    expect(grid.intensityMetric).toBe("record_count");
    expect(aug18).toMatchObject({ count: 2, amount: 50, weekday: 2 });
    expect(aug17).toMatchObject({ count: 1, amount: 1, weekday: 1 });
    expect(grid.maxCount).toBe(2);
  });

  it("uses that day's usage amount when every contributing record shares one unit", () => {
    const records = [
      record("heavy", 5, new Date(2026, 7, 18, 9, 0, 0)),
      record("heavy", 3, new Date(2026, 7, 18, 18, 0, 0)),
      record("bot", 2, new Date(2026, 7, 17, 9, 0, 0)),
    ];
    const grid = heatmapGrid(records, 12, now, [pool("heavy", "%"), pool("bot", "%")]);
    const aug18 = grid.cells.find((cell) => cell.date === "2026-08-18");
    expect(grid.intensityMetric).toBe("amount");
    expect(grid.unit).toBe("%");
    expect(aug18).toMatchObject({ count: 2, amount: 8, unit: "%" });
    expect(grid.maxAmount).toBe(8);
  });
});

describe("HEATMAP_GITHUB_COLORS", () => {
  it("matches GitHub contribution greens for light and dark", () => {
    expect(HEATMAP_GITHUB_COLORS.light).toEqual(["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"]);
    expect(HEATMAP_GITHUB_COLORS.dark).toEqual(["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]);
  });
});

describe("squareCellPx", () => {
  it("uses the tighter of width/weeks and height/7 and never stretches wide cards", () => {
    expect(squareCellPx(260, 70, 26, 0)).toBe(10);
    expect(squareCellPx(800, 70, 26, 0)).toBe(10);
    expect(squareCellPx(260, 400, 26, 0)).toBe(10);
  });

  it("accounts for a 3px gap so cells stay square", () => {
    expect(squareCellPx(260, 70, 26, 3)).toBe(7);
    expect(squareCellPx(0, 70, 26)).toBe(0);
    expect(squareCellPx(100, 20, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe("clampSquareCellPx", () => {
  it("caps tall/wide leftovers so squares never grow past max", () => {
    expect(clampSquareCellPx(54, 8, 10)).toBe(10);
    expect(clampSquareCellPx(5, 8, 10)).toBe(8);
    expect(clampSquareCellPx(0, 8, 10)).toBe(8);
    expect(clampSquareCellPx(12)).toBe(12);
  });
});

describe("heatmapLevel", () => {
  it("maps empty / quartile buckets to GitHub-style 0-4 levels", () => {
    expect(heatmapLevel(0, 8)).toBe(0);
    expect(heatmapLevel(1, 0)).toBe(0);
    expect(heatmapLevel(1, 8)).toBe(1);
    expect(heatmapLevel(2, 8)).toBe(1);
    expect(heatmapLevel(3, 8)).toBe(2);
    expect(heatmapLevel(4, 8)).toBe(2);
    expect(heatmapLevel(5, 8)).toBe(3);
    expect(heatmapLevel(6, 8)).toBe(3);
    expect(heatmapLevel(7, 8)).toBe(4);
    expect(heatmapLevel(8, 8)).toBe(4);
  });
});
