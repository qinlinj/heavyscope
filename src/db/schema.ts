/** SQLite schema and domain types for HeavyScope. */

export const SCHEMA_VERSION = 1;

export type PoolType = "credits" | "requests" | "usd" | "custom";
export type ResetCycle = "weekly" | "monthly" | "none";
export type UsageSource = "manual" | "import" | "sync";

export type Pool = {
  id: string;
  name: string;
  type: PoolType;
  quota_total: number;
  quota_used: number;
  reset_at: string | null;
  reset_cycle: ResetCycle;
  unit: string;
  color: string;
  is_preset: number;
  created_at: string;
  updated_at: string;
};

export type UsageRecord = {
  id: string;
  pool_id: string;
  amount: number;
  recorded_at: string;
  note: string | null;
  source: UsageSource;
};

export type Setting = {
  key: string;
  value: string;
};

export type PoolDraft = {
  name: string;
  type: PoolType;
  quota_total: number;
  quota_used: number;
  reset_cycle: ResetCycle;
  reset_at: string | null;
  unit: string;
  color: string;
};

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  quota_total REAL NOT NULL,
  quota_used REAL NOT NULL DEFAULT 0,
  reset_at TEXT,
  reset_cycle TEXT NOT NULL DEFAULT 'weekly',
  unit TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#22c55e',
  is_preset INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  amount REAL NOT NULL,
  recorded_at TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_pool_id ON usage_records(pool_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorded_at ON usage_records(recorded_at);
`;
