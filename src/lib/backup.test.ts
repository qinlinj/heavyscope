import { describe, expect, it } from "vitest";
import type { Pool, UsageRecord } from "@/db/schema";
import {
  BACKUP_FORMAT_VERSION,
  parseBackup,
  planBackupApply,
  serializeBackup,
  validateBackup,
} from "@/lib/backup";

function pool(partial: Partial<Pool> & Pick<Pool, "id" | "name">): Pool {
  const now = "2026-08-01T00:00:00.000Z";
  return {
    type: "credits",
    quota_total: 100,
    quota_used: 10,
    reset_at: "2026-08-25T00:00:00.000Z",
    reset_cycle: "weekly",
    unit: "credits",
    color: "#38bdf8",
    is_preset: 1,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

function usage(partial: Partial<UsageRecord> & Pick<UsageRecord, "id" | "pool_id">): UsageRecord {
  return {
    amount: 4,
    recorded_at: "2026-08-18T10:00:00.000Z",
    note: "manual",
    source: "manual",
    ...partial,
  };
}

const sample = {
  pools: [pool({ id: "preset-grok-heavy", name: "Grok Heavy Weekly Shared Pool" })],
  usage_records: [usage({ id: "usage-1", pool_id: "preset-grok-heavy" })],
  settings: { language: "en", warn_percent: "70" },
  exportedAt: "2026-08-18T12:00:00.000Z",
};

describe("serializeBackup", () => {
  it("writes version, exportedAt, pools, usage_records, and settings", () => {
    const raw = serializeBackup(sample);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.version).toBe(BACKUP_FORMAT_VERSION);
    expect(parsed.exportedAt).toBe("2026-08-18T12:00:00.000Z");
    expect(Array.isArray(parsed.pools)).toBe(true);
    expect(Array.isArray(parsed.usage_records)).toBe(true);
    expect(parsed.settings).toEqual({ language: "en", warn_percent: "70" });
    expect(raw.includes("Uint8Array")).toBe(false);
    expect(raw.includes("wasm")).toBe(false);
  });

  it("round-trips through parseBackup", () => {
    const result = parseBackup(serializeBackup(sample));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.pools).toHaveLength(1);
      expect(result.backup.usage_records[0]?.id).toBe("usage-1");
      expect(result.backup.settings.language).toBe("en");
    }
  });
});

describe("parseBackup / validateBackup", () => {
  it("rejects empty or invalid JSON", () => {
    expect(parseBackup("").ok).toBe(false);
    expect(parseBackup("   ").ok).toBe(false);
    expect(parseBackup("{not-json").ok).toBe(false);
  });

  it("rejects a non-object or missing required fields", () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup([]).ok).toBe(false);
    expect(validateBackup({ version: 1 }).ok).toBe(false);
    expect(
      validateBackup({
        version: 0,
        exportedAt: "2026-08-18T12:00:00.000Z",
        pools: [],
        usage_records: [],
        settings: {},
      }).ok,
    ).toBe(false);
  });

  it("rejects invalid pool, record, or settings values", () => {
    const base = {
      version: 1,
      exportedAt: "2026-08-18T12:00:00.000Z",
      pools: sample.pools,
      usage_records: sample.usage_records,
      settings: { language: "zh-CN" },
    };
    expect(validateBackup({ ...base, pools: [{ id: "x" }] }).ok).toBe(false);
    expect(
      validateBackup({
        ...base,
        usage_records: [{ id: "u1", pool_id: "p", amount: "nope" }],
      }).ok,
    ).toBe(false);
    expect(validateBackup({ ...base, settings: { language: 1 } }).ok).toBe(false);
  });

  it("accepts a valid payload and ignores extra keys", () => {
    const result = validateBackup({
      version: 1,
      exportedAt: "2026-08-18T12:00:00.000Z",
      pools: sample.pools,
      usage_records: sample.usage_records,
      settings: { language: "zh-CN" },
      extra: true,
    });
    expect(result.ok).toBe(true);
  });
});

describe("planBackupApply", () => {
  const current = {
    pools: [
      pool({ id: "preset-grok-heavy", name: "Local name", quota_used: 3 }),
      pool({ id: "custom-keep", name: "Keep me", is_preset: 0 }),
    ],
    usage_records: [
      usage({ id: "usage-1", pool_id: "preset-grok-heavy", amount: 3 }),
      usage({ id: "usage-local", pool_id: "custom-keep", amount: 1 }),
    ],
    settings: { language: "zh-CN", warn_percent: "70", crit_percent: "90" },
  };

  it("merges pools by id (imported wins) and inserts unknown usage ids", () => {
    const incoming = {
      version: 1,
      exportedAt: "2026-08-18T12:00:00.000Z",
      pools: [pool({ id: "preset-grok-heavy", name: "Imported name", quota_used: 12 })],
      usage_records: [
        usage({ id: "usage-1", pool_id: "preset-grok-heavy", amount: 99 }),
        usage({ id: "usage-new", pool_id: "preset-grok-heavy", amount: 5 }),
      ],
      settings: { warn_percent: "65" },
    };
    const plan = planBackupApply(current, incoming, "merge");
    expect(plan.clearExisting).toBe(false);
    expect(plan.poolsToUpsert[0]?.name).toBe("Imported name");
    expect(plan.poolsToUpsert[0]?.quota_used).toBe(12);
    expect(plan.recordsToInsert.map((item) => item.id)).toEqual(["usage-new"]);
    expect(plan.recordsSkipped).toBe(1);
    expect(plan.settingsToMerge).toEqual({ warn_percent: "65" });
    expect(plan.settingsToMerge.language).toBeUndefined();
  });

  it("skips orphaned usage records whose pool is missing", () => {
    const incoming = {
      version: 1,
      exportedAt: "2026-08-18T12:00:00.000Z",
      pools: [],
      usage_records: [usage({ id: "usage-ghost", pool_id: "missing-pool" })],
      settings: {},
    };
    const plan = planBackupApply(current, incoming, "merge");
    expect(plan.recordsToInsert).toHaveLength(0);
    expect(plan.recordsOrphaned).toBe(1);
  });

  it("replace-all plans a clear, then inserts every incoming record", () => {
    const incoming = {
      version: 1,
      exportedAt: "2026-08-18T12:00:00.000Z",
      pools: [pool({ id: "preset-grok-heavy", name: "Only this" })],
      usage_records: [usage({ id: "usage-1", pool_id: "preset-grok-heavy" })],
      settings: { language: "en" },
    };
    const plan = planBackupApply(current, incoming, "replace");
    expect(plan.clearExisting).toBe(true);
    expect(plan.recordsToInsert).toHaveLength(1);
    expect(plan.recordsSkipped).toBe(0);
    expect(plan.settingsToMerge.language).toBe("en");
  });
});
