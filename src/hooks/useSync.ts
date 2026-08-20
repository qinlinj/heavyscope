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
    if (parsed === "none" && !cursorLive && !grokLive && !hasSnapshot) return;

    const tick = async () => {
      const live: Array<"cursor" | "grok"> = [];
      // Credentials, not *_connected, decide membership. A failed tick must
      // not drop a provider from future intervals.
      const wantCursor = cursorLive && (parsed === "none" || syncSourceHas(parsed, "cursor"));
      const wantGrok = grokLive && (parsed === "none" || syncSourceHas(parsed, "grok"));
      if (wantCursor) live.push("cursor");
      if (wantGrok) live.push("grok");
      if (live.length > 0) await applyLive(live);
      // Snapshot string is fallback only when no session token is stored.
      if ((parsed === "none" || syncSourceHas(parsed, "cursor")) && !cursorHasToken && hasSnapshot) {
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
