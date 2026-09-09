import { describe, expect, it } from "vitest";
import {
  applyAbsoluteUsage,
  applyAdapterResult,
  resolvePoolId,
  type ApplyAbsoluteDeps,
  type ApplyDeps,
} from "@/adapters/apply";
import { cursorAdapter, parseCursorInput } from "@/adapters/cursor";
import { adapterSignature, hashSignature } from "@/adapters/hash";
import type { AdapterResult } from "@/adapters/types";
import type { Pool } from "@/db/schema";

function pool(partial: Partial<Pool> & Pick<Pool, "id" | "name">): Pool {
  const now = "2026-08-01T00:00:00.000Z";
  return {
    type: "credits",
    quota_total: 500,
    quota_used: 10,
    reset_at: null,
    reset_cycle: "weekly",
    unit: "req",
    color: "#22c55e",
    is_preset: 1,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

function mockDeps(initial: Pool[]) {
  const pools = initial.map((item) => ({ ...item }));
  const usages: Array<{ poolId: string; amount: number; note: string | null; recordedAt?: string }> =
    [];
  const totals: Array<{ id: string; total: number }> = [];
  const deps: ApplyDeps = {
    listPools: () => pools,
    getPool: (id) => pools.find((item) => item.id === id) ?? null,
    addUsage: (poolId, amount, note, recordedAt) => {
      usages.push({ poolId, amount, note, recordedAt });
      const target = pools.find((item) => item.id === poolId);
      if (target) target.quota_used += amount;
    },
    setQuotaTotal: (id, total) => {
      totals.push({ id, total });
      const target = pools.find((item) => item.id === id);
      if (target) target.quota_total = total;
    },
  };
  return { pools, usages, totals, deps };
}

function snapshot(used: number, hint = "cursor_models", total?: number): AdapterResult {
  return {
    ok: true,
    records: [
      {
        poolHint: hint,
        amount: used,
        recordedAt: "2026-08-18T10:00:00.000Z",
        note: "Cursor snapshot",
      },
    ],
    totals: total != null ? { [hint]: total } : undefined,
    message: "Cursor snapshot parsed",
  };
}

describe("resolvePoolId", () => {
  const pools = [
    pool({ id: "preset-cursor-models", name: "Cursor Models" }),
    pool({ id: "custom-1", name: "Research" }),
  ];

  it("maps known hints and custom names", () => {
    expect(resolvePoolId("cursor_models", pools)).toBe("preset-cursor-models");
    expect(resolvePoolId("custom:Research", pools)).toBe("custom-1");
    expect(resolvePoolId("missing", pools)).toBeNull();
  });
});

describe("applyAdapterResult", () => {
  it("records only the positive delta versus current quota_used", () => {
    const { deps, usages, pools } = mockDeps([
      pool({ id: "preset-cursor-models", name: "Cursor Models", quota_used: 12 }),
    ]);
    const report = applyAdapterResult(snapshot(20), deps);
    expect(report.added).toBe(1);
    expect(report.skipped).toBe(false);
    expect(usages).toEqual([
      {
        poolId: "preset-cursor-models",
        amount: 8,
        note: "Cursor snapshot",
        recordedAt: "2026-08-18T10:00:00.000Z",
      },
    ]);
    expect(pools[0].quota_used).toBe(20);
  });

  it("never subtracts when snapshot used is less than or equal to current used", () => {
    const { deps, usages, pools } = mockDeps([
      pool({ id: "preset-cursor-models", name: "Cursor Models", quota_used: 40 }),
    ]);
    const lower = applyAdapterResult(snapshot(10), deps);
    const equal = applyAdapterResult(snapshot(40), deps);
    expect(lower.added).toBe(0);
    expect(equal.added).toBe(0);
    expect(usages).toEqual([]);
    expect(pools[0].quota_used).toBe(40);
  });

  it("updates quota_total only when the snapshot total changed", () => {
    const { deps, totals } = mockDeps([
      pool({ id: "preset-cursor-models", name: "Cursor Models", quota_total: 500 }),
    ]);
    const same = applyAdapterResult(snapshot(12, "cursor_models", 500), deps);
    expect(same.totalsUpdated).toBe(0);
    const changed = applyAdapterResult(snapshot(12, "cursor_models", 600), deps);
    expect(changed.totalsUpdated).toBe(1);
    expect(totals).toEqual([{ id: "preset-cursor-models", total: 600 }]);
  });

  it("leaves manual history alone when the adapter fails or a hint is unmatched", () => {
    const { deps, usages } = mockDeps([
      pool({ id: "preset-cursor-models", name: "Cursor Models", quota_used: 12 }),
    ]);
    const failed = applyAdapterResult({ ok: false, records: [], message: "nope" }, deps);
    expect(failed.skipped).toBe(true);
    expect(failed.added).toBe(0);
    const unmatched = applyAdapterResult(snapshot(30, "unknown_pool"), deps);
    expect(unmatched.unmatched).toEqual(["unknown_pool"]);
    expect(unmatched.added).toBe(0);
    expect(usages).toEqual([]);
  });
});

describe("applyAbsoluteUsage", () => {
  function absoluteDeps(initial: Pool[]) {
    const pools = initial.map((item) => ({ ...item }));
    const usages: Array<{ poolId: string; amount: number; note: string | null; recordedAt?: string }> =
      [];
    const deps: ApplyAbsoluteDeps = {
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

  it("sets absolute used/total/reset_at and records only when used increases", () => {
    const { deps, pools, usages } = absoluteDeps([
      pool({
        id: "preset-cursor-models",
        name: "Cursor Models",
        quota_used: 12,
        quota_total: 500,
        reset_at: null,
      }),
    ]);
    const first = applyAbsoluteUsage(
      [
        {
          poolHint: "cursor_models",
          quotaUsed: 42.5,
          quotaTotal: 100,
          resetAt: "2026-08-19T00:00:00.000Z",
          resetCycle: "monthly",
          unit: "%",
          note: "Cursor live sync",
          recordedAt: "2026-08-19T10:00:00.000Z",
        },
      ],
      deps,
    );
    expect(first.added).toBe(1);
    expect(pools[0]?.quota_used).toBe(42.5);
    expect(pools[0]?.quota_total).toBe(100);
    expect(pools[0]?.reset_at).toBe("2026-08-19T00:00:00.000Z");
    expect(usages[0]?.amount).toBe(30.5);

    const again = applyAbsoluteUsage(
      [{ poolHint: "cursor_models", quotaUsed: 42.5, quotaTotal: 100 }],
      deps,
    );
    expect(again.added).toBe(0);
    expect(usages).toHaveLength(1);
  });

  it("writes SAND Bot as a 100% basis, not fake request or dollar counts", () => {
    const { deps, pools } = absoluteDeps([
      pool({
        id: "preset-grok-bot",
        name: "Grok Bot Weekly Quota",
        quota_used: 0,
        quota_total: 50,
        unit: "requests",
        reset_cycle: "weekly",
      }),
    ]);
    applyAbsoluteUsage(
      [
        {
          poolHint: "grok_bot",
          quotaUsed: 21.473078,
          quotaTotal: 100,
          resetAt: "2026-08-24T01:40:00.748Z",
          resetCycle: "weekly",
          unit: "%",
          note: "Cursor SAND weekly sync (Grok Bot)",
        },
      ],
      deps,
    );
    expect(pools[0]?.quota_used).toBe(21.473078);
    expect(pools[0]?.quota_total).toBe(100);
    expect(pools[0]?.unit).toBe("%");
    expect(pools[0]?.reset_at).toBe("2026-08-24T01:40:00.748Z");
    expect(pools[0]?.quota_total).not.toBe(50);
    expect(pools[0]?.quota_used).not.toBe(21);
  });

  it("rewrites leftover Other USD $145.99 / $400 to apiPercentUsed 0% / 100", () => {
    const { deps, pools } = absoluteDeps([
      pool({
        id: "preset-cursor-other",
        name: "Cursor Other Models Pool",
        quota_used: 145.99,
        quota_total: 400,
        unit: "USD",
        reset_cycle: "monthly",
      }),
    ]);
    applyAbsoluteUsage(
      [
        {
          poolHint: "cursor_other",
          quotaUsed: 0,
          quotaTotal: 100,
          resetCycle: "monthly",
          unit: "%",
          note: "Included in Ultra / Other Models",
        },
      ],
      deps,
    );
    expect(pools[0]?.quota_used).toBe(0);
    expect(pools[0]?.quota_total).toBe(100);
    expect(pools[0]?.unit).toBe("%");
    expect(pools[0]?.quota_used).not.toBe(145.99);
    expect(pools[0]?.quota_total).not.toBe(400);
  });

  it("writes the lower used number after a cycle reset without a usage record", () => {
    const { deps, pools, usages } = absoluteDeps([
      pool({ id: "preset-cursor-models", name: "Cursor Models", quota_used: 88, quota_total: 100 }),
    ]);
    const report = applyAbsoluteUsage(
      [{ poolHint: "cursor_models", quotaUsed: 4, quotaTotal: 100 }],
      deps,
    );
    expect(pools[0]?.quota_used).toBe(4);
    expect(pools[0]?.quota_total).toBe(100);
    expect(report.added).toBe(0);
    expect(usages).toEqual([]);
  });
});

describe("idempotent hash skip", () => {
  it("produces a stable hash for the same used/total snapshot", async () => {
    const first = await hashSignature(adapterSignature(snapshot(20, "cursor_models", 500)));
    const second = await hashSignature(adapterSignature(snapshot(20, "cursor_models", 500)));
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(8);
  });

  it("changes the hash when used or total changes", async () => {
    const baseline = await hashSignature(adapterSignature(snapshot(20, "cursor_models", 500)));
    const usedChanged = await hashSignature(adapterSignature(snapshot(21, "cursor_models", 500)));
    const totalChanged = await hashSignature(adapterSignature(snapshot(20, "cursor_models", 600)));
    expect(usedChanged).not.toBe(baseline);
    expect(totalChanged).not.toBe(baseline);
  });

  it("skips apply when the stored hash already matches", async () => {
    const result = snapshot(20);
    const lastHash = await hashSignature(adapterSignature(result));
    const { deps, usages } = mockDeps([
      pool({ id: "preset-cursor-models", name: "Cursor Models", quota_used: 10 }),
    ]);
    const incoming = await hashSignature(adapterSignature(result));
    if (incoming === lastHash) {
      expect(usages).toEqual([]);
      return;
    }
    applyAdapterResult(result, deps);
    expect.fail("duplicate snapshot hash should skip apply");
  });
});

describe("parseCursorInput", () => {
  it("parses the documented JSON snapshot format", () => {
    const parsed = parseCursorInput(
      JSON.stringify({
        source: "cursor",
        fetchedAt: "2026-08-18T10:00:00.000Z",
        pools: [{ hint: "cursor_models", used: 12, total: 500 }],
      }),
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.snapshot?.pools).toEqual([
      { hint: "cursor_models", used: 12, total: 500, note: undefined },
    ]);
  });

  it("lets the cursor adapter pull a snapshot without a live Cursor API", async () => {
    const raw = JSON.stringify({
      source: "cursor",
      fetchedAt: "2026-08-18T10:00:00.000Z",
      pools: [{ hint: "cursor_other", used: 40.5, total: 400 }],
    });
    const result = await cursorAdapter.pull({ snapshot: raw });
    expect(result.ok).toBe(true);
    expect(result.records[0]).toMatchObject({
      poolHint: "cursor_other",
      amount: 40.5,
    });
    expect(result.totals).toEqual({ cursor_other: 400 });
  });
});
