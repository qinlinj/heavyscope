import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyAdapterResult } from "@/adapters/apply";
import { adapterSignature, hashSignature } from "@/adapters/hash";
import { getAdapter } from "@/adapters/registry";
import type { ApplyReport } from "@/adapters/types";
import { HeavyScopeDB } from "@/db/database";
import type { Pool, PoolDraft, UsageRecord, UsageSource } from "@/db/schema";
import i18n, { LANG_STORAGE_KEY } from "@/i18n";
import { syncTraySummary } from "@/lib/desktop";
import {
  parseSyncInterval,
  parseThresholds,
  SETTING_CURSOR_SNAPSHOT,
  SETTING_CURSOR_SNAPSHOT_HASH,
  SETTING_LANGUAGE,
  SETTING_SYNC_ENABLED,
  SETTING_SYNC_INTERVAL_MIN,
  SETTING_SYNC_LAST_AT,
  SETTING_SYNC_LAST_MESSAGE,
  SETTING_SYNC_LAST_STATUS,
  SETTING_SYNC_SOURCE,
} from "@/lib/settings";
import { useSync } from "./useSync";

type DatabaseApi = {
  ready: boolean;
  error: string | null;
  pools: Pool[];
  records: UsageRecord[];
  settings: Record<string, string>;
  thresholds: { warn: number; crit: number };
  getSetting: (key: string) => string | null;
  createPool: (draft: PoolDraft) => void;
  updatePool: (id: string, draft: PoolDraft) => void;
  deletePool: (id: string) => void;
  addUsage: (poolId: string, amount: number, note: string | null, source?: UsageSource) => void;
  setSetting: (key: string, value: string) => void;
  resetLocalData: () => void;
  applyImportedSnapshot: (raw: string) => Promise<ApplyReport>;
  applyStoredSnapshot: () => Promise<ApplyReport>;
};

const DatabaseContext = createContext<DatabaseApi | null>(null);

function idleReport(message: string): ApplyReport {
  return { added: 0, totalsUpdated: 0, skipped: true, unmatched: [], message };
}

function writeSyncMeta(store: HeavyScopeDB, status: string, message: string): void {
  store.setSetting(SETTING_SYNC_LAST_AT, new Date().toISOString());
  store.setSetting(SETTING_SYNC_LAST_STATUS, status);
  store.setSetting(SETTING_SYNC_LAST_MESSAGE, message);
}

async function runCursorApply(
  store: HeavyScopeDB,
  raw: string | null,
  persistRaw: boolean,
): Promise<ApplyReport> {
  const adapter = getAdapter("cursor");
  if (!adapter) return idleReport("Cursor adapter is missing");
  if (!raw?.trim()) {
    const report = idleReport("No Cursor snapshot imported");
    writeSyncMeta(store, "error", report.message);
    return report;
  }
  const result = await adapter.pull({ snapshot: raw, settings: store.listSettings() });
  if (!result.ok) {
    const message = result.message ?? "Adapter failed; manual entry remains the source of truth";
    writeSyncMeta(store, "error", message);
    return idleReport(message);
  }
  if (persistRaw) {
    store.setSetting(SETTING_CURSOR_SNAPSHOT, raw);
  }
  const hash = await hashSignature(adapterSignature(result));
  const lastHash = store.getSetting(SETTING_CURSOR_SNAPSHOT_HASH);
  if (lastHash === hash) {
    const report = idleReport("Snapshot already applied");
    writeSyncMeta(store, "skipped", report.message);
    return report;
  }
  const report = applyAdapterResult(result, {
    listPools: () => store.listPools(),
    getPool: (id) => store.getPool(id),
    addUsage: (poolId, amount, note, recordedAt) => {
      store.addUsage(poolId, amount, note, "sync", recordedAt);
    },
    setQuotaTotal: (id, total) => store.setQuotaTotal(id, total),
  });
  store.setSetting(SETTING_CURSOR_SNAPSHOT_HASH, hash);
  writeSyncMeta(store, "ok", report.message);
  return report;
}

function useDatabaseState(): DatabaseApi {
  const [db, setDb] = useState<HeavyScopeDB | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((store: HeavyScopeDB) => {
    store.applyDueRollovers();
    setPools(store.listPools());
    setRecords(store.listUsage());
    setSettings(store.listSettings());
  }, []);

  useEffect(() => {
    let cancelled = false;
    HeavyScopeDB.open()
      .then((store) => {
        if (cancelled) return;
        setDb(store);
        refresh(store);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to open database");
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!ready) return;
    const language = settings[SETTING_LANGUAGE];
    if (language !== "zh-CN" && language !== "en") return;
    const current = i18n.resolvedLanguage ?? i18n.language;
    if (language === current) return;
    void i18n.changeLanguage(language);
    localStorage.setItem(LANG_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [ready, settings]);

  useEffect(() => {
    if (!ready) return;
    void syncTraySummary(pools);
  }, [ready, pools]);

  const createPool = useCallback(
    (draft: PoolDraft) => {
      if (!db) return;
      db.createPool(draft);
      refresh(db);
    },
    [db, refresh],
  );

  const updatePool = useCallback(
    (id: string, draft: PoolDraft) => {
      if (!db) return;
      db.updatePool(id, draft);
      refresh(db);
    },
    [db, refresh],
  );

  const deletePool = useCallback(
    (id: string) => {
      if (!db) return;
      db.deletePool(id);
      refresh(db);
    },
    [db, refresh],
  );

  const addUsage = useCallback(
    (poolId: string, amount: number, note: string | null, source: UsageSource = "manual") => {
      if (!db) return;
      db.addUsage(poolId, amount, note, source);
      refresh(db);
    },
    [db, refresh],
  );

  const setSetting = useCallback(
    (key: string, value: string) => {
      if (!db) return;
      db.setSetting(key, value);
      setSettings(db.listSettings());
    },
    [db],
  );

  const getSetting = useCallback(
    (key: string) => settings[key] ?? db?.getSetting(key) ?? null,
    [db, settings],
  );

  const resetLocalData = useCallback(() => {
    db?.resetLocalData();
    window.location.reload();
  }, [db]);

  const applyImportedSnapshot = useCallback(
    async (raw: string) => {
      if (!db) return idleReport("Database not ready");
      const report = await runCursorApply(db, raw, true);
      refresh(db);
      return report;
    },
    [db, refresh],
  );

  const applyStoredSnapshot = useCallback(async () => {
    if (!db) return idleReport("Database not ready");
    const raw = db.getSetting(SETTING_CURSOR_SNAPSHOT);
    const report = await runCursorApply(db, raw, false);
    refresh(db);
    return report;
  }, [db, refresh]);

  const thresholds = useMemo(() => parseThresholds(settings), [settings]);

  useSync({
    ready,
    enabled: settings[SETTING_SYNC_ENABLED] === "true",
    source: settings[SETTING_SYNC_SOURCE],
    snapshot: settings[SETTING_CURSOR_SNAPSHOT] ?? "",
    intervalMin: parseSyncInterval(settings[SETTING_SYNC_INTERVAL_MIN]),
    applyStoredSnapshot,
  });

  return {
    ready,
    error,
    pools,
    records,
    settings,
    thresholds,
    getSetting,
    createPool,
    updatePool,
    deletePool,
    addUsage,
    setSetting,
    resetLocalData,
    applyImportedSnapshot,
    applyStoredSnapshot,
  };
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const value = useDatabaseState();
  return createElement(DatabaseContext.Provider, { value }, children);
}

export function useDatabase(): DatabaseApi {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error("useDatabase must be used within DatabaseProvider");
  }
  return ctx;
}
