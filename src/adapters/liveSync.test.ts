import { describe, expect, it } from "vitest";
import { applyLiveSnapshot } from "./liveSync";
import type { LiveApplyDeps, LiveProviderResult } from "./liveTypes";
import type { ResetCycle } from "@/db/schema";

type PoolRow = {
  id: string;
  name: string;
  quota_used: number;
  quota_total: number;
  reset_at: string | null;
  reset_cycle: ResetCycle;
  unit: string;
};

function mockDeps(initial: PoolRow[]) {
  const pools = initial.map((item) => ({ ...item }));
  const usages: Array<{ poolId: string; amount: number; note: string | null; recordedAt?: string }> = [];
  const deps: LiveApplyDeps = {
    listPools: () => pools,
    getPool: (id) => pools.find((item) => item.id === id) ?? null,
    updatePoolFields: (id, patch) => {
      const target = pools.find((item) => item.id === id);
      if (!target) return;
      if (patch.quota_used != null) target.quota_used = patch.quota_used;
      if (patch.quota_total != null) target.quota_total = patch.quota_total;
      if (patch.reset_at !== undefined) target.reset_at = patch.reset_at;
      if (patch.reset_cycle) target.reset_cycle = patch.reset_cycle;
      if (patch.unit) target.unit = patch.unit;
    },
    insertUsageRecord: (poolId, amount, note, recordedAt) => {
      usages.push({ poolId, amount, note, recordedAt });
    },
  };
  return { pools, usages, deps };
}

function liveOk(used: number, hint = "cursor_models"): LiveProviderResult {
  return {
    ok: true,
    code: "ok",
    message: "ok",
    pools: [
      {
        poolHint: hint,
        quotaUsed: used,
        quotaTotal: 100,
        resetAt: "2026-08-19T00:00:00.000Z",
        resetCycle: "monthly",
        unit: "%",
        note: "Cursor live sync",
        recordedAt: "2026-08-19T10:00:00.000Z",
      },
    ],
  };
}

describe("applyLiveSnapshot", () => {
  it("sets absolute used and writes a sync record only when used increases", () => {
    const { deps, pools, usages } = mockDeps([
      {
        id: "preset-cursor-models",
        name: "Cursor Models",
        quota_used: 10,
        quota_total: 500,
        reset_at: null,
        reset_cycle: "monthly",
        unit: "requests",
      },
    ]);
    const first = applyLiveSnapshot(liveOk(42.5), deps);
    expect(first.updated).toBe(1);
    expect(first.recordsAdded).toBe(1);
    expect(pools[0]?.quota_used).toBe(42.5);
    expect(pools[0]?.quota_total).toBe(100);
    expect(pools[0]?.unit).toBe("%");
    expect(usages).toEqual([
      {
        poolId: "preset-cursor-models",
        amount: 32.5,
        note: "Cursor live sync",
        recordedAt: "2026-08-19T10:00:00.000Z",
      },
    ]);

    const second = applyLiveSnapshot(liveOk(42.5), deps);
    expect(second.recordsAdded).toBe(0);
    expect(usages).toHaveLength(1);
  });

  it("updates the pool when used decreases but skips a negative usage record", () => {
    const { deps, pools, usages } = mockDeps([
      {
        id: "preset-cursor-models",
        name: "Cursor Models",
        quota_used: 80,
        quota_total: 100,
        reset_at: null,
        reset_cycle: "monthly",
        unit: "%",
      },
    ]);
    const report = applyLiveSnapshot(liveOk(20), deps);
    expect(pools[0]?.quota_used).toBe(20);
    expect(report.recordsAdded).toBe(0);
    expect(usages).toEqual([]);
  });

  it("skips apply on error and does not wipe pools", () => {
    const { deps, pools, usages } = mockDeps([
      {
        id: "preset-cursor-models",
        name: "Cursor Models",
        quota_used: 12,
        quota_total: 100,
        reset_at: null,
        reset_cycle: "monthly",
        unit: "%",
      },
    ]);
    const report = applyLiveSnapshot(
      { ok: false, code: "expired", message: "expired", pools: [] },
      deps,
    );
    expect(report.skipped).toBe(true);
    expect(pools[0]?.quota_used).toBe(12);
    expect(usages).toEqual([]);
  });
});
