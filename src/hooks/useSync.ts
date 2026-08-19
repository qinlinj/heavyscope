import { useEffect } from "react";

type SnapshotTicker = {
  enabled: boolean;
  source: string | undefined;
  snapshot: string;
  intervalMin: number;
  apply: () => Promise<unknown>;
};

type LiveTicker = {
  enabled: boolean;
  intervalMin: number;
  refresh: () => Promise<unknown>;
};

type SyncSchedulerOpts = {
  ready: boolean;
  snapshot: SnapshotTicker;
  cursorLive: LiveTicker;
  grokLive: LiveTicker;
};

function useInterval(ready: boolean, enabled: boolean, intervalMin: number, fn: () => Promise<unknown>): void {
  useEffect(() => {
    if (!ready || !enabled) return;
    const ms = Math.max(1, intervalMin) * 60_000;
    void fn();
    const id = window.setInterval(() => {
      void fn();
    }, ms);
    return () => window.clearInterval(id);
  }, [ready, enabled, intervalMin, fn]);
}

/** Re-apply the stored Cursor snapshot and/or refresh live connectors. */
export function useSync(opts: SyncSchedulerOpts): void {
  const { ready, snapshot, cursorLive, grokLive } = opts;

  useInterval(
    ready,
    snapshot.enabled && snapshot.source === "cursor" && Boolean(snapshot.snapshot.trim()),
    snapshot.intervalMin,
    snapshot.apply,
  );
  useInterval(ready, cursorLive.enabled, cursorLive.intervalMin, cursorLive.refresh);
  useInterval(ready, grokLive.enabled, grokLive.intervalMin, grokLive.refresh);
}
