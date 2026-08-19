import { describe, expect, it } from "vitest";
import type { Pool } from "@/db/schema";
import { trayPercentLabel, traySummary } from "@/lib/desktop";

function pool(partial: Partial<Pool> & Pick<Pool, "id" | "name" | "quota_used" | "quota_total">): Pool {
  return {
    type: "credits",
    reset_at: null,
    reset_cycle: "weekly",
    unit: "req",
    color: "#22c55e",
    is_preset: 0,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("traySummary", () => {
  it("returns the product name when there are no pools", () => {
    expect(traySummary([])).toBe("HeavyScope");
    expect(trayPercentLabel([])).toBeNull();
  });

  it("uses the hottest pool name and rounded percent", () => {
    const pools = [
      pool({ id: "a", name: "Cool", quota_used: 10, quota_total: 100 }),
      pool({ id: "b", name: "Hot", quota_used: 82.4, quota_total: 100 }),
    ];
    expect(traySummary(pools)).toBe("Hot 82%");
    expect(trayPercentLabel(pools)).toBe("82%");
  });
});
