import { useEffect } from "react";

type SyncSchedulerOpts = {
  ready: boolean;
  enabled: boolean;
  source: string | undefined;
  snapshot: string;
  intervalMin: number;
  applyStoredSnapshot: () => Promise<unknown>;
};

/** Re-apply the stored Cursor snapshot on an interval when auto-sync is enabled. */
export function useSync(opts: SyncSchedulerOpts): void {
  const { ready, enabled, source, snapshot, intervalMin, applyStoredSnapshot } = opts;

  useEffect(() => {
    if (!ready || !enabled || source !== "cursor" || !snapshot.trim()) return;
    const ms = intervalMin * 60_000;
    void applyStoredSnapshot();
    const id = window.setInterval(() => {
      void applyStoredSnapshot();
    }, ms);
    return () => window.clearInterval(id);
  }, [ready, enabled, source, snapshot, intervalMin, applyStoredSnapshot]);
}
