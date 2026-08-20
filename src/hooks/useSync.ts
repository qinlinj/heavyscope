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
  grokHasToken: boolean;
  hasSnapshot: boolean;
  applyLive: (providers: Array<"cursor" | "grok">) => Promise<unknown>;
  applySnapshot: () => Promise<unknown>;
};

/** Credentials alone decide live membership. Do not require sync_source or *_connected. */
export function liveProvidersForTick(opts: {
  cursorHasToken: boolean;
  grokHasToken: boolean;
}): Array<"cursor" | "grok"> {
  const live: Array<"cursor" | "grok"> = [];
  if (opts.cursorHasToken) live.push("cursor");
  if (opts.grokHasToken) live.push("grok");
  return live;
}

export function shouldRunLiveInterval(opts: {
  enabled: boolean;
  cursorHasToken: boolean;
  grokHasToken: boolean;
}): boolean {
  return opts.enabled || opts.cursorHasToken || opts.grokHasToken;
}

/**
 * Shared auto-sync ticker.
 * A saved Cursor token or Grok cookie/bearer is enough to join the interval
 * immediately, even if `sync_enabled` is still false after connect or a tick
 * fails with expired / gRPC 16.
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
    grokHasToken,
    hasSnapshot,
    applyLive,
    applySnapshot,
  } = opts;

  const grokReady = grokHasToken || grokLive;
  const cursorReady = cursorHasToken || cursorLive;

  useEffect(() => {
    if (!ready) return;
    if (!shouldRunLiveInterval({ enabled, cursorHasToken: cursorReady, grokHasToken: grokReady })) {
      return;
    }
    const parsed: SyncSource = parseSyncSource(source);
    if (parsed === "none" && !cursorReady && !grokReady && !hasSnapshot) return;

    const tick = async () => {
      const live = liveProvidersForTick({
        cursorHasToken: cursorReady,
        grokHasToken: grokReady,
      });
      if (live.length > 0) await applyLive(live);
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
    grokHasToken,
    grokReady,
    cursorReady,
    hasSnapshot,
    applyLive,
    applySnapshot,
  ]);
}
