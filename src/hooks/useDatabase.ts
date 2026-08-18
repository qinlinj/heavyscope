import { useCallback, useEffect, useState } from "react";
import { HeavyScopeDB } from "@/db/database";
import type { Pool, PoolDraft, UsageRecord, UsageSource } from "@/db/schema";

export function useDatabase() {
  const [db, setDb] = useState<HeavyScopeDB | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((store: HeavyScopeDB) => {
    setPools(store.listPools());
    setRecords(store.listUsage(undefined, 80));
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
      db?.setSetting(key, value);
    },
    [db],
  );

  const resetLocalData = useCallback(() => {
    db?.resetLocalData();
    window.location.reload();
  }, [db]);

  return {
    ready,
    error,
    pools,
    records,
    createPool,
    updatePool,
    deletePool,
    addUsage,
    setSetting,
    resetLocalData,
  };
}
