/** JSON backup of local HeavyScope tables. Not a sql.js wasm / binary dump. */

import type { Pool, UsageRecord, UsageSource } from "@/db/schema";
import { redactSettings } from "@/lib/settings";

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_FILENAME = "heavyscope-backup.json";

export type BackupPayload = {
  version: number;
  exportedAt: string;
  pools: Pool[];
  usage_records: UsageRecord[];
  settings: Record<string, string>;
};

export type BackupParseOk = { ok: true; backup: BackupPayload };
export type BackupParseErr = { ok: false; error: string };
export type BackupParseResult = BackupParseOk | BackupParseErr;

export type BackupMode = "merge" | "replace";

export type BackupApplyPlan = {
  mode: BackupMode;
  poolsToUpsert: Pool[];
  recordsToInsert: UsageRecord[];
  recordsSkipped: number;
  recordsOrphaned: number;
  settingsToMerge: Record<string, string>;
  clearExisting: boolean;
};

export type BackupApplyReport = {
  mode: BackupMode;
  poolsUpserted: number;
  recordsInserted: number;
  recordsSkipped: number;
  recordsOrphaned: number;
  settingsMerged: number;
};

const POOL_TYPES = new Set(["credits", "requests", "usd", "custom"]);
const RESET_CYCLES = new Set(["weekly", "monthly", "none"]);
const USAGE_SOURCES = new Set(["manual", "import", "sync"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fail(error: string): BackupParseErr {
  return { ok: false, error };
}

function okValue<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

function parsePool(value: unknown, index: number): { ok: true; value: Pool } | BackupParseErr {
  if (!isPlainObject(value)) return fail(`pools[${index}] must be an object`);
  const id = asString(value.id);
  const name = asString(value.name);
  const type = asString(value.type);
  const quotaTotal = asFiniteNumber(value.quota_total);
  const quotaUsed = asFiniteNumber(value.quota_used);
  const resetCycle = asString(value.reset_cycle);
  const unit = asString(value.unit);
  const color = asString(value.color);
  const isPreset = asFiniteNumber(value.is_preset);
  const createdAt = asString(value.created_at);
  const updatedAt = asString(value.updated_at);
  if (!id) return fail(`pools[${index}].id must be a non-empty string`);
  if (name == null) return fail(`pools[${index}].name must be a string`);
  if (!type || !POOL_TYPES.has(type)) return fail(`pools[${index}].type is invalid`);
  if (quotaTotal == null) return fail(`pools[${index}].quota_total must be a number`);
  if (quotaUsed == null) return fail(`pools[${index}].quota_used must be a number`);
  if (value.reset_at !== null && typeof value.reset_at !== "string") {
    return fail(`pools[${index}].reset_at must be a string or null`);
  }
  if (!resetCycle || !RESET_CYCLES.has(resetCycle)) {
    return fail(`pools[${index}].reset_cycle is invalid`);
  }
  if (unit == null) return fail(`pools[${index}].unit must be a string`);
  if (color == null) return fail(`pools[${index}].color must be a string`);
  if (isPreset == null) return fail(`pools[${index}].is_preset must be a number`);
  if (!createdAt) return fail(`pools[${index}].created_at must be a string`);
  if (!updatedAt) return fail(`pools[${index}].updated_at must be a string`);
  return okValue({
    id,
    name,
    type: type as Pool["type"],
    quota_total: quotaTotal,
    quota_used: quotaUsed,
    reset_at: value.reset_at as string | null,
    reset_cycle: resetCycle as Pool["reset_cycle"],
    unit,
    color,
    is_preset: isPreset,
    created_at: createdAt,
    updated_at: updatedAt,
  });
}

function parseUsage(value: unknown, index: number): { ok: true; value: UsageRecord } | BackupParseErr {
  if (!isPlainObject(value)) return fail(`usage_records[${index}] must be an object`);
  const id = asString(value.id);
  const poolId = asString(value.pool_id);
  const amount = asFiniteNumber(value.amount);
  const recordedAt = asString(value.recorded_at);
  const source = asString(value.source);
  if (!id) return fail(`usage_records[${index}].id must be a non-empty string`);
  if (!poolId) return fail(`usage_records[${index}].pool_id must be a non-empty string`);
  if (amount == null) return fail(`usage_records[${index}].amount must be a number`);
  if (!recordedAt) return fail(`usage_records[${index}].recorded_at must be a string`);
  if (value.note !== null && typeof value.note !== "string") {
    return fail(`usage_records[${index}].note must be a string or null`);
  }
  if (!source || !USAGE_SOURCES.has(source)) {
    return fail(`usage_records[${index}].source is invalid`);
  }
  return okValue({
    id,
    pool_id: poolId,
    amount,
    recorded_at: recordedAt,
    note: value.note as string | null,
    source: source as UsageSource,
  });
}

function parseSettings(value: unknown): { ok: true; value: Record<string, string> } | BackupParseErr {
  if (!isPlainObject(value)) return fail("settings must be an object");
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") return fail(`settings.${key} must be a string`);
    out[key] = item;
  }
  return okValue(out);
}

/** Serialize current tables to pretty JSON. Does not export the sql.js binary. */
export function serializeBackup(input: {
  pools: Pool[];
  usage_records: UsageRecord[];
  settings: Record<string, string>;
  exportedAt?: string;
  version?: number;
}): string {
  const payload: BackupPayload = {
    version: input.version ?? BACKUP_FORMAT_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    pools: input.pools,
    usage_records: input.usage_records,
    settings: redactSettings(input.settings),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function validateBackup(value: unknown): BackupParseResult {
  if (!isPlainObject(value)) return fail("Backup must be a JSON object");
  const version = asFiniteNumber(value.version);
  if (version == null || version < 1) return fail("version must be a number >= 1");
  const exportedAt = asString(value.exportedAt);
  if (!exportedAt) return fail("exportedAt must be a non-empty string");
  if (!Array.isArray(value.pools)) return fail("pools must be an array");
  if (!Array.isArray(value.usage_records)) return fail("usage_records must be an array");

  const pools: Pool[] = [];
  for (let i = 0; i < value.pools.length; i += 1) {
    const pool = parsePool(value.pools[i], i);
    if (!pool.ok) return pool;
    pools.push(pool.value);
  }

  const records: UsageRecord[] = [];
  for (let i = 0; i < value.usage_records.length; i += 1) {
    const record = parseUsage(value.usage_records[i], i);
    if (!record.ok) return record;
    records.push(record.value);
  }

  const settings = parseSettings(value.settings);
  if (!settings.ok) return settings;

  return {
    ok: true,
    backup: {
      version,
      exportedAt,
      pools,
      usage_records: records,
      settings: settings.value,
    },
  };
}

export function parseBackup(raw: string): BackupParseResult {
  if (!raw.trim()) return fail("Backup JSON is empty");
  try {
    return validateBackup(JSON.parse(raw) as unknown);
  } catch {
    return fail("Backup JSON is not valid JSON");
  }
}

export function reportFromPlan(plan: BackupApplyPlan): BackupApplyReport {
  return {
    mode: plan.mode,
    poolsUpserted: plan.poolsToUpsert.length,
    recordsInserted: plan.recordsToInsert.length,
    recordsSkipped: plan.recordsSkipped,
    recordsOrphaned: plan.recordsOrphaned,
    settingsMerged: Object.keys(plan.settingsToMerge).length,
  };
}

/**
 * Merge (default): upsert pools by id, insert unknown usage ids, merge settings keys.
 * Replace: caller must clear pools + usage first; settings still merge (language only if present).
 */
export function planBackupApply(
  current: {
    pools: Pool[];
    usage_records: UsageRecord[];
    settings: Record<string, string>;
  },
  incoming: BackupPayload,
  mode: BackupMode,
): BackupApplyPlan {
  const clearExisting = mode === "replace";
  const currentRecordIds = new Set(current.usage_records.map((item) => item.id));
  const incomingPoolIds = new Set(incoming.pools.map((item) => item.id));
  const knownPoolIds = new Set<string>(incomingPoolIds);
  if (!clearExisting) {
    for (const pool of current.pools) knownPoolIds.add(pool.id);
  }

  const seenRecordIds = new Set<string>();
  const recordsToInsert: UsageRecord[] = [];
  let recordsSkipped = 0;
  let recordsOrphaned = 0;

  for (const record of incoming.usage_records) {
    if (seenRecordIds.has(record.id) || (!clearExisting && currentRecordIds.has(record.id))) {
      recordsSkipped += 1;
      continue;
    }
    if (!knownPoolIds.has(record.pool_id)) {
      recordsOrphaned += 1;
      continue;
    }
    seenRecordIds.add(record.id);
    recordsToInsert.push(record);
  }

  return {
    mode,
    poolsToUpsert: incoming.pools,
    recordsToInsert,
    recordsSkipped,
    recordsOrphaned,
    settingsToMerge: { ...incoming.settings },
    clearExisting,
  };
}
