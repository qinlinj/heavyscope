import { describe, expect, it } from "vitest";
import { PRESET_POOL_IDS } from "@/lib/poolName";
import {
  DEMO_SEED_DAYS,
  buildDemoUsageRecords,
  shouldApplyDemoSeed,
} from "@/lib/demoSeed";

const NOW = new Date("2026-08-18T15:00:00.000Z");

describe("buildDemoUsageRecords", () => {
  const records = buildDemoUsageRecords(NOW);

  it("returns one record per preset pool per day across 10 days", () => {
    expect(records).toHaveLength(PRESET_POOL_IDS.length * DEMO_SEED_DAYS);
  });

  it("uses only the four preset pool ids", () => {
    const ids = [...new Set(records.map((item) => item.pool_id))].sort();
    expect(ids).toEqual([...PRESET_POOL_IDS].sort());
    for (const id of PRESET_POOL_IDS) {
      expect(records.filter((item) => item.pool_id === id)).toHaveLength(DEMO_SEED_DAYS);
    }
  });

  it("keeps recorded_at on the last 10 UTC days including today", () => {
    const start = Date.UTC(2026, 7, 9, 0, 0, 0, 0);
    const end = Date.UTC(2026, 7, 18, 23, 59, 59, 999);
    const days = new Set<string>();
    for (const record of records) {
      const ts = Date.parse(record.recorded_at);
      expect(Number.isNaN(ts)).toBe(false);
      expect(ts).toBeGreaterThanOrEqual(start);
      expect(ts).toBeLessThanOrEqual(end);
      days.add(record.recorded_at.slice(0, 10));
    }
    expect(days.size).toBe(DEMO_SEED_DAYS);
    expect(days.has("2026-08-09")).toBe(true);
    expect(days.has("2026-08-18")).toBe(true);
    expect(days.has("2026-08-08")).toBe(false);
  });

  it("varies amounts and uses English notes", () => {
    const amounts = new Set(records.map((item) => item.amount));
    expect(amounts.size).toBeGreaterThan(8);
    for (const record of records) {
      expect(record.amount).toBeGreaterThan(0);
      expect(record.note).toMatch(/Demo seed:/);
      expect(record.note).toMatch(/[A-Za-z]/);
      expect(record.source).toBe("import");
    }
  });
});

describe("shouldApplyDemoSeed", () => {
  it("skips when demo_seeded=1 unless forced", () => {
    expect(shouldApplyDemoSeed({ demo_seeded: "1" })).toBe(false);
    expect(shouldApplyDemoSeed({ demo_seeded: "1" }, true)).toBe(true);
    expect(shouldApplyDemoSeed({})).toBe(true);
    expect(shouldApplyDemoSeed(null)).toBe(true);
    expect(shouldApplyDemoSeed("1")).toBe(false);
    expect(shouldApplyDemoSeed("1", true)).toBe(true);
  });
});
