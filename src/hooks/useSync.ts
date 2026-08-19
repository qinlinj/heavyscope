import { useEffect } from "react";
import { parseSyncSource, syncSourceHas, type SyncSource } from "@/lib/settings";

type SyncSchedulerOpts = {
  ready: boolean;
  enabled: boolean;
  source: string | undefined;
  intervalMin: number;
  cursorLive: boolean;
  grokLive: boolean;
  cursorHasToken: boolean;
  hasSnapshot: boolean;
  applyLive: (providers: Array<"cursor" | "grok">) => Promise<unknown>;
  applySnapshot: () => Promise<unknown>;
};

/**
 * Shared auto-sync ticker (`sync_enabled` + `sync_interval_min` + `sync_source`).
 * Live session tokens take precedence over re-applying a stored snapshot string.
 */
export function useSync(opts: SyncSchedulerOpts): void {
  const {
    ready,
    enabled,
    source,
    intervalMin,
    cursorLive,
    grokLive,
    cursorHasToken,
    hasSnapshot,
    applyLive,
    applySnapshot,
  } = opts;

  useEffect(() => {
    if (!ready || !enabled) return;
    const parsed: SyncSource = parseSyncSource(source);
    if (parsed === "none") return;

    const tick = async () => {
      const live: Array<"cursor" | "grok"> = [];
      if (syncSourceHas(parsed, "cursor") && cursorLive) live.push("cursor");
      if (syncSourceHas(parsed, "grok") && grokLive) live.push("grok");
      if (live.length > 0) await applyLive(live);
      // Snapshot string is fallback only when no session token is stored.
      if (syncSourceHas(parsed, "cursor") && !cursorHasToken && hasSnapshot) {
        await applySnapshot();
      }
    };

    const ms = Math.max(1, intervalMin) * 60_000;
    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, ms);
    return () => window.clearInterval(id);
  }, [
    ready,
    enabled,
    source,
    intervalMin,
    cursorLive,
    grokLive,
    cursorHasToken,
    hasSnapshot,
    applyLive,
    applySnapshot,
  ]);
}
