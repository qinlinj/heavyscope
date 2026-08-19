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
import { fetchCursorUsage, fetchGrokCredits } from "@/adapters/liveClient";
import { applyLiveSnapshot } from "@/adapters/liveSync";
import type { LiveApplyReport, LiveProviderResult } from "@/adapters/liveTypes";
import { getAdapter } from "@/adapters/registry";
import type { ApplyReport } from "@/adapters/types";
import { HeavyScopeDB } from "@/db/database";
import type { Pool, PoolDraft, UsageRecord, UsageSource } from "@/db/schema";
import type { BackupApplyReport, BackupMode, BackupPayload } from "@/lib/backup";
import type { DemoSeedReport } from "@/lib/demoSeed";
import i18n, { LANG_STORAGE_KEY } from "@/i18n";
import { syncTraySummary } from "@/lib/desktop";
import {
  DEFAULT_SYNC_INTERVAL_MIN,
  LEGACY_SYNC_INTERVAL_MIN,
  parseSyncInterval,
  parseSyncSource,
  parseThresholds,
  withSyncProvider,
  SETTING_CURSOR_CONNECTED,
  SETTING_CURSOR_LAST_SYNCED_AT,
  SETTING_CURSOR_SESSION_TOKEN,
  SETTING_CURSOR_SNAPSHOT,
  SETTING_CURSOR_SNAPSHOT_HASH,
  SETTING_CURSOR_SYNC_MESSAGE,
  SETTING_CURSOR_SYNC_SOURCE,
  SETTING_GROK_BEARER_TOKEN,
  SETTING_GROK_BOT_LIVE,
  SETTING_GROK_CONNECTED,
  SETTING_GROK_LAST_SYNCED_AT,
  SETTING_GROK_SESSION_TOKEN,
  SETTING_GROK_SYNC_MESSAGE,
  SETTING_GROK_SYNC_SOURCE,
  SETTING_LANGUAGE,
  SETTING_SYNC_ENABLED,
  SETTING_SYNC_INTERVAL_MIN,
  SETTING_SYNC_LAST_AT,
  SETTING_SYNC_LAST_MESSAGE,
  SETTING_SYNC_LAST_STATUS,
  SETTING_SYNC_SOURCE,
} from "@/lib/settings";
import { applyTheme, parseTheme, SETTING_THEME, THEME_STORAGE_KEY } from "@/lib/theme";
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
  exportLocalBackup: () => string;
  importLocalBackup: (backup: BackupPayload, mode: BackupMode) => BackupApplyReport;
  applyDemoSeed: (force?: boolean) => DemoSeedReport;
  applyImportedSnapshot: (raw: string) => Promise<ApplyReport>;
  applyStoredSnapshot: () => Promise<ApplyReport>;
  refreshLiveProviders: (providers?: Array<"cursor" | "grok">) => Promise<LiveApplyReport>;
  connectCursor: (token: string, source?: "api" | "session") => Promise<LiveApplyReport>;
  disconnectCursor: () => void;
  connectGrok: (sessionCookie: string, bearerToken: string) => Promise<LiveApplyReport>;
  disconnectGrok: () => void;
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

function writeCursorLiveMeta(
  store: HeavyScopeDB,
  result: LiveProviderResult,
  source: "api" | "session" | "error",
): void {
  const now = new Date().toISOString();
  if (result.ok) {
    store.setSetting(SETTING_CURSOR_LAST_SYNCED_AT, now);
    store.setSetting(SETTING_CURSOR_SYNC_SOURCE, source === "session" ? "session" : "api");
    store.setSetting(SETTING_CURSOR_CONNECTED, "true");
    store.setSetting(SETTING_CURSOR_SYNC_MESSAGE, result.message);
    writeSyncMeta(store, "ok", result.message);
    return;
  }
  store.setSetting(SETTING_CURSOR_SYNC_SOURCE, "error");
  store.setSetting(SETTING_CURSOR_SYNC_MESSAGE, result.message);
  writeSyncMeta(store, "error", result.message);
  if (result.code === "expired") {
    store.setSetting(SETTING_CURSOR_CONNECTED, "expired");
  }
}

function writeGrokLiveMeta(store: HeavyScopeDB, result: LiveProviderResult): void {
  const now = new Date().toISOString();
  if (result.ok) {
    store.setSetting(SETTING_GROK_LAST_SYNCED_AT, now);
    store.setSetting(SETTING_GROK_SYNC_SOURCE, "api");
    store.setSetting(SETTING_GROK_CONNECTED, "true");
    store.setSetting(SETTING_GROK_SYNC_MESSAGE, result.message);
    store.setSetting(SETTING_GROK_BOT_LIVE, result.botUnavailable ? "unavailable" : "ok");
    writeSyncMeta(store, "ok", result.message);
    return;
  }
  store.setSetting(SETTING_GROK_SYNC_SOURCE, "error");
  store.setSetting(SETTING_GROK_SYNC_MESSAGE, result.message);
  writeSyncMeta(store, "error", result.message);
  if (result.code === "expired") {
    store.setSetting(SETTING_GROK_CONNECTED, "expired");
  }
}

function enableLiveSync(store: HeavyScopeDB, provider: "cursor" | "grok"): void {
  store.setSetting(SETTING_SYNC_ENABLED, "true");
  const next = withSyncProvider(parseSyncSource(store.getSetting(SETTING_SYNC_SOURCE)), provider, true);
  store.setSetting(SETTING_SYNC_SOURCE, next);
  const interval = Number(store.getSetting(SETTING_SYNC_INTERVAL_MIN));
  if (!Number.isFinite(interval) || interval === LEGACY_SYNC_INTERVAL_MIN) {
    store.setSetting(SETTING_SYNC_INTERVAL_MIN, String(DEFAULT_SYNC_INTERVAL_MIN));
  }
}

function disableLiveSync(store: HeavyScopeDB, provider: "cursor" | "grok"): void {
  const next = withSyncProvider(parseSyncSource(store.getSetting(SETTING_SYNC_SOURCE)), provider, false);
  store.setSetting(SETTING_SYNC_SOURCE, next);
}

function liveApplyDeps(store: HeavyScopeDB) {
  return {
    listPools: () => store.listPools(),
    getPool: (id: string) => store.getPool(id),
    updatePoolFields: (id: string, patch: Parameters<HeavyScopeDB["updatePoolFields"]>[1]) => {
      store.updatePoolFields(id, patch);
    },
    insertUsageRecord: (poolId: string, amount: number, note: string | null, recordedAt?: string) => {
      store.insertUsageRecord(poolId, amount, note, "sync", recordedAt);
    },
  };
}

function idleLiveReport(message: string): LiveApplyReport {
  return { updated: 0, recordsAdded: 0, unmatched: [], skipped: true, message };
}

async function runCursorLive(
  store: HeavyScopeDB,
  token: string,
  source: "api" | "session",
): Promise<LiveApplyReport> {
  if (!token.trim()) {
    return idleLiveReport("Cursor is not connected");
  }
  const result = await fetchCursorUsage(token);
  writeCursorLiveMeta(store, result, result.ok ? source : "error");
  if (!result.ok) {
    return idleLiveReport(result.message);
  }
  return applyLiveSnapshot(result, liveApplyDeps(store));
}

async function runGrokLive(store: HeavyScopeDB, session: string, bearer: string): Promise<LiveApplyReport> {
  if (!session.trim() && !bearer.trim()) {
    return idleLiveReport("Grok is not connected");
  }
  const result = await fetchGrokCredits({ sessionCookie: session, bearerToken: bearer });
  writeGrokLiveMeta(store, result);
  if (!result.ok) {
    return idleLiveReport(result.message);
  }
  return applyLiveSnapshot(result, liveApplyDeps(store));
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
    const raw = settings[SETTING_THEME];
    if (raw == null || raw === "") return;
    const theme = parseTheme(raw);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
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

  const exportLocalBackup = useCallback(() => {
    if (!db) return "";
    return db.exportJson();
  }, [db]);

  const importLocalBackup = useCallback(
    (backup: BackupPayload, mode: BackupMode): BackupApplyReport => {
      if (!db) {
        return {
          mode,
          poolsUpserted: 0,
          recordsInserted: 0,
          recordsSkipped: 0,
          recordsOrphaned: 0,
          settingsMerged: 0,
        };
      }
      const report = db.importBackup(backup, mode);
      refresh(db);
      return report;
    },
    [db, refresh],
  );

  const applyDemoSeed = useCallback(
    (force = false): DemoSeedReport => {
      if (!db) return { skipped: true, inserted: 0 };
      const report = db.applyDemoSeed(force);
      refresh(db);
      return report;
    },
    [db, refresh],
  );

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

  const refreshLiveProviders = useCallback(
    async (providers?: Array<"cursor" | "grok">) => {
      if (!db) return idleLiveReport("Database not ready");
      const want = new Set(providers ?? ["cursor", "grok"]);
      const reports: LiveApplyReport[] = [];
      if (want.has("cursor")) {
        const token = db.getSetting(SETTING_CURSOR_SESSION_TOKEN) ?? "";
        if (token.trim()) {
          const source = db.getSetting(SETTING_CURSOR_SYNC_SOURCE) === "session" ? "session" : "api";
          reports.push(await runCursorLive(db, token, source));
        }
      }
      if (want.has("grok")) {
        const session = db.getSetting(SETTING_GROK_SESSION_TOKEN) ?? "";
        const bearer = db.getSetting(SETTING_GROK_BEARER_TOKEN) ?? "";
        if (session.trim() || bearer.trim()) {
          reports.push(await runGrokLive(db, session, bearer));
        }
      }
      refresh(db);
      if (reports.length === 0) return idleLiveReport("No live connectors are configured");
      return {
        updated: reports.reduce((sum, item) => sum + item.updated, 0),
        recordsAdded: reports.reduce((sum, item) => sum + item.recordsAdded, 0),
        unmatched: reports.flatMap((item) => item.unmatched),
        skipped: reports.every((item) => item.skipped),
        message: reports.map((item) => item.message).join(" "),
      };
    },
    [db, refresh],
  );

  const connectCursor = useCallback(
    async (token: string, source: "api" | "session" = "api") => {
      if (!db) return idleLiveReport("Database not ready");
      const trimmed = token.trim();
      if (!trimmed) return idleLiveReport("Cursor session token is empty");
      db.setSetting(SETTING_CURSOR_SESSION_TOKEN, trimmed);
      db.setSetting(SETTING_CURSOR_SYNC_SOURCE, source);
      enableLiveSync(db, "cursor");
      const report = await runCursorLive(db, trimmed, source);
      refresh(db);
      return report;
    },
    [db, refresh],
  );

  const disconnectCursor = useCallback(() => {
    if (!db) return;
    db.setSetting(SETTING_CURSOR_SESSION_TOKEN, "");
    db.setSetting(SETTING_CURSOR_CONNECTED, "false");
    db.setSetting(SETTING_CURSOR_SYNC_SOURCE, "error");
    db.setSetting(SETTING_CURSOR_SYNC_MESSAGE, "Disconnected");
    disableLiveSync(db, "cursor");
    refresh(db);
  }, [db, refresh]);

  const connectGrok = useCallback(
    async (sessionCookie: string, bearerToken: string) => {
      if (!db) return idleLiveReport("Database not ready");
      if (!sessionCookie.trim() && !bearerToken.trim()) {
        return idleLiveReport("Grok session cookie or bearer token is empty");
      }
      db.setSetting(SETTING_GROK_SESSION_TOKEN, sessionCookie.trim());
      db.setSetting(SETTING_GROK_BEARER_TOKEN, bearerToken.trim());
      enableLiveSync(db, "grok");
      const report = await runGrokLive(db, sessionCookie.trim(), bearerToken.trim());
      refresh(db);
      return report;
    },
    [db, refresh],
  );

  const disconnectGrok = useCallback(() => {
    if (!db) return;
    db.setSetting(SETTING_GROK_SESSION_TOKEN, "");
    db.setSetting(SETTING_GROK_BEARER_TOKEN, "");
    db.setSetting(SETTING_GROK_CONNECTED, "false");
    db.setSetting(SETTING_GROK_SYNC_SOURCE, "error");
    db.setSetting(SETTING_GROK_SYNC_MESSAGE, "Disconnected");
    disableLiveSync(db, "grok");
    refresh(db);
  }, [db, refresh]);

  const thresholds = useMemo(() => parseThresholds(settings), [settings]);
  const cursorLiveConnected =
    Boolean(settings[SETTING_CURSOR_SESSION_TOKEN]?.trim()) &&
    settings[SETTING_CURSOR_CONNECTED] === "true";
  const grokLiveConnected =
    (Boolean(settings[SETTING_GROK_SESSION_TOKEN]?.trim()) ||
      Boolean(settings[SETTING_GROK_BEARER_TOKEN]?.trim())) &&
    settings[SETTING_GROK_CONNECTED] === "true";

  useSync({
    ready,
    enabled: settings[SETTING_SYNC_ENABLED] === "true",
    source: settings[SETTING_SYNC_SOURCE],
    intervalMin: parseSyncInterval(settings[SETTING_SYNC_INTERVAL_MIN]),
    cursorLive: cursorLiveConnected,
    grokLive: grokLiveConnected,
    cursorHasToken: Boolean(settings[SETTING_CURSOR_SESSION_TOKEN]?.trim()),
    hasSnapshot: Boolean(settings[SETTING_CURSOR_SNAPSHOT]?.trim()),
    applyLive: refreshLiveProviders,
    applySnapshot: applyStoredSnapshot,
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
    exportLocalBackup,
    importLocalBackup,
    applyDemoSeed,
    applyImportedSnapshot,
    applyStoredSnapshot,
    refreshLiveProviders,
    connectCursor,
    disconnectCursor,
    connectGrok,
    disconnectGrok,
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
