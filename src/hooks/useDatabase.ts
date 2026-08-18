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
import { HeavyScopeDB } from "@/db/database";
import type { Pool, PoolDraft, UsageRecord, UsageSource } from "@/db/schema";
import i18n, { LANG_STORAGE_KEY } from "@/i18n";
import { parseThresholds, SETTING_LANGUAGE } from "@/lib/settings";

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
};

const DatabaseContext = createContext<DatabaseApi | null>(null);

function useDatabaseState(): DatabaseApi {
  const [db, setDb] = useState<HeavyScopeDB | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((store: HeavyScopeDB) => {
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

  const thresholds = useMemo(() => parseThresholds(settings), [settings]);

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
