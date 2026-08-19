import * as sqlJsModule from "sql.js";
import type { Database as SqlDatabase } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import {
  DEFAULT_CRIT_PERCENT,
  DEFAULT_LANGUAGE,
  DEFAULT_SYNC_ENABLED,
  DEFAULT_SYNC_INTERVAL_MIN,
  DEFAULT_SYNC_SOURCE,
  DEFAULT_WARN_PERCENT,
  SETTING_CRIT_PERCENT,
  SETTING_LANGUAGE,
  SETTING_SYNC_ENABLED,
  SETTING_SYNC_INTERVAL_MIN,
  SETTING_DEMO_SEEDED,
  SETTING_SYNC_SOURCE,
  SETTING_WARN_PERCENT,
  SETTING_CURSOR_SYNC_INTERVAL_MIN,
  SETTING_GROK_SYNC_INTERVAL_MIN,
  DEFAULT_LIVE_SYNC_INTERVAL_MIN,
  liveConnectorOwnsPool,
} from "@/lib/settings";
import {
  planBackupApply,
  reportFromPlan,
  serializeBackup,
  type BackupApplyReport,
  type BackupMode,
  type BackupPayload,
} from "@/lib/backup";
import {
  DEMO_SEEDED_VALUE,
  buildDemoUsageRecords,
  shouldApplyDemoSeed,
  type DemoSeedReport,
} from "@/lib/demoSeed";
import { planRollovers } from "@/lib/rollover";
import { defaultPools } from "./defaults";
import {
  SCHEMA_SQL,
  SCHEMA_VERSION,
  type Pool,
  type PoolDraft,
  type ResetCycle,
  type UsageRecord,
  type UsageSource,
} from "./schema";

type InitSqlJsFn = (typeof import("sql.js"))["default"];

const initSqlJs: InitSqlJsFn =
  (sqlJsModule as unknown as { default?: InitSqlJsFn }).default ??
  (sqlJsModule as unknown as InitSqlJsFn);

const STORAGE_KEY = "heavyscope.sqlite.v1";
const VERSION_KEY = "schema_version";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function rowToPool(row: Record<string, unknown>): Pool {
  return {
    id: String(row.id),
    name: String(row.name),
    type: row.type as Pool["type"],
    quota_total: Number(row.quota_total),
    quota_used: Number(row.quota_used),
    reset_at: row.reset_at == null ? null : String(row.reset_at),
    reset_cycle: row.reset_cycle as Pool["reset_cycle"],
    unit: String(row.unit),
    color: String(row.color),
    is_preset: Number(row.is_preset),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function rowToUsage(row: Record<string, unknown>): UsageRecord {
  return {
    id: String(row.id),
    pool_id: String(row.pool_id),
    amount: Number(row.amount),
    recorded_at: String(row.recorded_at),
    note: row.note == null ? null : String(row.note),
    source: row.source as UsageSource,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function queryAll(
  db: SqlDatabase,
  sql: string,
  params: (string | number | null)[] = [],
): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export class HeavyScopeDB {
  private readonly db: SqlDatabase;

  private constructor(db: SqlDatabase) {
    this.db = db;
  }

  static async open(): Promise<HeavyScopeDB> {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const saved = localStorage.getItem(STORAGE_KEY);
    const raw = saved ? new SQL.Database(base64ToBytes(saved)) : new SQL.Database();
    const store = new HeavyScopeDB(raw);
    store.migrate();
    store.applyDueRollovers();
    store.seedIfEmpty();
    store.seedSettings();
    store.persist();
    return store;
  }

  persist(): void {
    localStorage.setItem(STORAGE_KEY, bytesToBase64(this.db.export()));
  }

  private migrate(): void {
    this.db.run("PRAGMA foreign_keys = ON;");
    this.db.run(SCHEMA_SQL);
    const version = this.getSetting(VERSION_KEY);
    if (!version) {
      this.setSetting(VERSION_KEY, String(SCHEMA_VERSION));
    }
  }

  private seedIfEmpty(): void {
    const count = queryAll(this.db, "SELECT COUNT(*) AS n FROM pools")[0];
    if (Number(count?.n ?? 0) > 0) return;
    const insert = this.db.prepare(`
      INSERT INTO pools (
        id, name, type, quota_total, quota_used, reset_at, reset_cycle,
        unit, color, is_preset, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const pool of defaultPools()) {
      insert.run([
        pool.id,
        pool.name,
        pool.type,
        pool.quota_total,
        pool.quota_used,
        pool.reset_at,
        pool.reset_cycle,
        pool.unit,
        pool.color,
        pool.is_preset,
        pool.created_at,
        pool.updated_at,
      ]);
    }
    insert.free();
    this.writeSetting(SETTING_LANGUAGE, localStorage.getItem("heavyscope.lang") ?? DEFAULT_LANGUAGE);
  }

  private writeSetting(key: string, value: string): void {
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }

  private seedSettings(): void {
    if (!this.getSetting(SETTING_LANGUAGE)) {
      this.writeSetting(
        SETTING_LANGUAGE,
        localStorage.getItem("heavyscope.lang") ?? DEFAULT_LANGUAGE,
      );
    }
    if (!this.getSetting(SETTING_WARN_PERCENT)) {
      this.writeSetting(SETTING_WARN_PERCENT, String(DEFAULT_WARN_PERCENT));
    }
    if (!this.getSetting(SETTING_CRIT_PERCENT)) {
      this.writeSetting(SETTING_CRIT_PERCENT, String(DEFAULT_CRIT_PERCENT));
    }
    if (!this.getSetting(SETTING_SYNC_ENABLED)) {
      this.writeSetting(SETTING_SYNC_ENABLED, DEFAULT_SYNC_ENABLED);
    }
    if (!this.getSetting(SETTING_SYNC_INTERVAL_MIN)) {
      this.writeSetting(SETTING_SYNC_INTERVAL_MIN, String(DEFAULT_SYNC_INTERVAL_MIN));
    }
    if (!this.getSetting(SETTING_SYNC_SOURCE)) {
      this.writeSetting(SETTING_SYNC_SOURCE, DEFAULT_SYNC_SOURCE);
    }
    if (!this.getSetting(SETTING_CURSOR_SYNC_INTERVAL_MIN)) {
      this.writeSetting(SETTING_CURSOR_SYNC_INTERVAL_MIN, String(DEFAULT_LIVE_SYNC_INTERVAL_MIN));
    }
    if (!this.getSetting(SETTING_GROK_SYNC_INTERVAL_MIN)) {
      this.writeSetting(SETTING_GROK_SYNC_INTERVAL_MIN, String(DEFAULT_LIVE_SYNC_INTERVAL_MIN));
    }
  }

  getSetting(key: string): string | null {
    const rows = queryAll(this.db, "SELECT value FROM settings WHERE key = ?", [key]);
    return rows[0] ? String(rows[0].value) : null;
  }

  setSetting(key: string, value: string): void {
    this.writeSetting(key, value);
    this.persist();
  }

  listSettings(): Record<string, string> {
    const rows = queryAll(this.db, "SELECT key, value FROM settings");
    const out: Record<string, string> = {};
    for (const row of rows) {
      out[String(row.key)] = String(row.value);
    }
    return out;
  }

  listPools(): Pool[] {
    return queryAll(
      this.db,
      "SELECT * FROM pools ORDER BY is_preset DESC, created_at ASC",
    ).map(rowToPool);
  }

  getPool(id: string): Pool | null {
    const rows = queryAll(this.db, "SELECT * FROM pools WHERE id = ?", [id]);
    return rows[0] ? rowToPool(rows[0]) : null;
  }

  createPool(draft: PoolDraft): Pool {
    const id = newId("pool");
    const ts = nowIso();
    this.db.run(
      `INSERT INTO pools (
        id, name, type, quota_total, quota_used, reset_at, reset_cycle,
        unit, color, is_preset, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id,
        draft.name,
        draft.type,
        draft.quota_total,
        draft.quota_used,
        draft.reset_at,
        draft.reset_cycle,
        draft.unit,
        draft.color,
        ts,
        ts,
      ],
    );
    this.persist();
    return this.getPool(id)!;
  }

  updatePool(id: string, draft: PoolDraft): Pool {
    this.db.run(
      `UPDATE pools SET
        name = ?, type = ?, quota_total = ?, quota_used = ?, reset_at = ?,
        reset_cycle = ?, unit = ?, color = ?, updated_at = ?
      WHERE id = ?`,
      [
        draft.name,
        draft.type,
        draft.quota_total,
        draft.quota_used,
        draft.reset_at,
        draft.reset_cycle,
        draft.unit,
        draft.color,
        nowIso(),
        id,
      ],
    );
    this.persist();
    return this.getPool(id)!;
  }

  deletePool(id: string): void {
    this.db.run("DELETE FROM usage_records WHERE pool_id = ?", [id]);
    this.db.run("DELETE FROM pools WHERE id = ?", [id]);
    this.persist();
  }

  listUsage(poolId?: string, limit?: number): UsageRecord[] {
    const where = poolId ? "WHERE pool_id = ?" : "";
    const limiter = limit != null ? "LIMIT ?" : "";
    const sql = `SELECT * FROM usage_records ${where} ORDER BY recorded_at DESC ${limiter}`.trim();
    const params: (string | number)[] = [];
    if (poolId) params.push(poolId);
    if (limit != null) params.push(limit);
    return queryAll(this.db, sql, params).map(rowToUsage);
  }

  addUsage(
    poolId: string,
    amount: number,
    note: string | null,
    source: UsageSource = "manual",
    recordedAt?: string,
  ): UsageRecord {
    const pool = this.getPool(poolId);
    if (!pool) throw new Error(`Pool not found: ${poolId}`);
    const id = newId("usage");
    const ts = recordedAt && !Number.isNaN(Date.parse(recordedAt)) ? recordedAt : nowIso();
    const updatedAt = nowIso();
    const nextUsed = Math.max(0, pool.quota_used + amount);
    this.db.run(
      `INSERT INTO usage_records (id, pool_id, amount, recorded_at, note, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, poolId, amount, ts, note, source],
    );
    this.db.run(
      "UPDATE pools SET quota_used = ?, updated_at = ? WHERE id = ?",
      [nextUsed, updatedAt, poolId],
    );
    this.persist();
    return {
      id,
      pool_id: poolId,
      amount,
      recorded_at: ts,
      note,
      source,
    };
  }

  setQuotaTotal(id: string, total: number): void {
    const pool = this.getPool(id);
    if (!pool) throw new Error(`Pool not found: ${id}`);
    if (pool.quota_total === total) return;
    this.db.run("UPDATE pools SET quota_total = ?, updated_at = ? WHERE id = ?", [
      total,
      nowIso(),
      id,
    ]);
    this.persist();
  }

  updatePoolFields(
    id: string,
    patch: {
      quota_used?: number;
      quota_total?: number;
      reset_at?: string | null;
      reset_cycle?: ResetCycle;
      unit?: string;
    },
  ): void {
    const pool = this.getPool(id);
    if (!pool) throw new Error(`Pool not found: ${id}`);
    this.db.run(
      `UPDATE pools SET
        quota_used = ?, quota_total = ?, reset_at = ?, reset_cycle = ?, unit = ?, updated_at = ?
      WHERE id = ?`,
      [
        patch.quota_used ?? pool.quota_used,
        patch.quota_total ?? pool.quota_total,
        patch.reset_at !== undefined ? patch.reset_at : pool.reset_at,
        patch.reset_cycle ?? pool.reset_cycle,
        patch.unit ?? pool.unit,
        nowIso(),
        id,
      ],
    );
    this.persist();
  }

  insertUsageRecord(
    poolId: string,
    amount: number,
    note: string | null,
    source: UsageSource = "sync",
    recordedAt?: string,
  ): UsageRecord {
    const pool = this.getPool(poolId);
    if (!pool) throw new Error(`Pool not found: ${poolId}`);
    const id = newId("usage");
    const ts = recordedAt && !Number.isNaN(Date.parse(recordedAt)) ? recordedAt : nowIso();
    this.db.run(
      `INSERT INTO usage_records (id, pool_id, amount, recorded_at, note, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, poolId, amount, ts, note, source],
    );
    this.persist();
    return { id, pool_id: poolId, amount, recorded_at: ts, note, source };
  }

  resetLocalData(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  applyDueRollovers(now = new Date()): number {
    const settings = this.listSettings();
    const plans = planRollovers(this.listPools(), now).filter(
      (plan) => !liveConnectorOwnsPool(plan.poolId, settings),
    );
    if (plans.length === 0) return 0;
    const ts = now.toISOString();
    for (const plan of plans) {
      this.db.run(
        "UPDATE pools SET quota_used = ?, reset_at = ?, updated_at = ? WHERE id = ?",
        [plan.quotaUsed, plan.nextResetAt, ts, plan.poolId],
      );
      this.db.run(
        `INSERT INTO usage_records (id, pool_id, amount, recorded_at, note, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId("usage"), plan.poolId, plan.amount, ts, plan.note, plan.source],
      );
    }
    this.persist();
    return plans.length;
  }

  applyDemoSeed(force = false, now = new Date()): DemoSeedReport {
    if (!shouldApplyDemoSeed(this.getSetting(SETTING_DEMO_SEEDED), force)) {
      return { skipped: true, inserted: 0 };
    }

    const drafts = buildDemoUsageRecords(now);
    const known = new Set(this.listPools().map((pool) => pool.id));
    const usedByPool = new Map<string, number>();
    for (const pool of this.listPools()) usedByPool.set(pool.id, pool.quota_used);
    const ts = nowIso();

    let inserted = 0;
    this.db.run("BEGIN");
    try {
      const insert = this.db.prepare(`
        INSERT INTO usage_records (id, pool_id, amount, recorded_at, note, source)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const record of drafts) {
        if (!known.has(record.pool_id)) continue;
        insert.run([
          newId("usage"),
          record.pool_id,
          record.amount,
          record.recorded_at,
          record.note,
          record.source,
        ]);
        usedByPool.set(record.pool_id, Math.max(0, (usedByPool.get(record.pool_id) ?? 0) + record.amount));
        inserted += 1;
      }
      insert.free();

      for (const [poolId, used] of usedByPool) {
        this.db.run("UPDATE pools SET quota_used = ?, updated_at = ? WHERE id = ?", [used, ts, poolId]);
      }
      this.writeSetting(SETTING_DEMO_SEEDED, DEMO_SEEDED_VALUE);
      this.db.run("COMMIT");
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }

    this.persist();
    return { skipped: false, inserted };
  }

  exportJson(): string {
    return serializeBackup({
      pools: this.listPools(),
      usage_records: this.listUsage(),
      settings: this.listSettings(),
    });
  }

  importBackup(backup: BackupPayload, mode: BackupMode): BackupApplyReport {
    const plan = planBackupApply(
      {
        pools: this.listPools(),
        usage_records: this.listUsage(),
        settings: this.listSettings(),
      },
      backup,
      mode,
    );

    this.db.run("BEGIN");
    try {
      if (plan.clearExisting) {
        this.db.run("DELETE FROM usage_records");
        this.db.run("DELETE FROM pools");
      }

      const upsert = this.db.prepare(`
        INSERT INTO pools (
          id, name, type, quota_total, quota_used, reset_at, reset_cycle,
          unit, color, is_preset, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          quota_total = excluded.quota_total,
          quota_used = excluded.quota_used,
          reset_at = excluded.reset_at,
          reset_cycle = excluded.reset_cycle,
          unit = excluded.unit,
          color = excluded.color,
          is_preset = excluded.is_preset,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `);
      for (const pool of plan.poolsToUpsert) {
        upsert.run([
          pool.id,
          pool.name,
          pool.type,
          pool.quota_total,
          pool.quota_used,
          pool.reset_at,
          pool.reset_cycle,
          pool.unit,
          pool.color,
          pool.is_preset,
          pool.created_at,
          pool.updated_at,
        ]);
      }
      upsert.free();

      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO usage_records (id, pool_id, amount, recorded_at, note, source)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const record of plan.recordsToInsert) {
        insert.run([
          record.id,
          record.pool_id,
          record.amount,
          record.recorded_at,
          record.note,
          record.source,
        ]);
      }
      insert.free();

      for (const [key, value] of Object.entries(plan.settingsToMerge)) {
        this.writeSetting(key, value);
      }

      this.db.run("COMMIT");
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }

    this.persist();
    return reportFromPlan(plan);
  }
}
