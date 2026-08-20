import type { Pool, UsageRecord } from "@/db/schema";
import { tightestAdvices, type PoolAdvice } from "@/lib/burnRate";
import { chartRecords } from "@/lib/charts";
import type { LayoutTile } from "@/lib/dashboardLayout";
import {
  hasCursorCredentials,
  hasGrokCredentials,
  SETTING_CURSOR_CONNECTED,
  SETTING_CURSOR_LAST_SYNCED_AT,
  SETTING_CURSOR_SYNC_MESSAGE,
  SETTING_GROK_CONNECTED,
  SETTING_GROK_LAST_SYNCED_AT,
  SETTING_GROK_SYNC_MESSAGE,
} from "@/lib/settings";

export type TrayPane = "dashboard" | "settings";

export function parseTrayPane(value: string | null | undefined): TrayPane {
  return value === "settings" ? "settings" : "dashboard";
}

/** Only one pool card expands at a time. Clicking the open row collapses it. */
export function toggleExpandedPoolId(current: string | null, clicked: string): string | null {
  if (!clicked) return current;
  return current === clicked ? null : clicked;
}

export function visiblePoolIds(tiles: readonly LayoutTile[]): string[] {
  return tiles
    .filter((tile) => tile.visible && tile.type === "pool" && tile.poolId)
    .map((tile) => tile.poolId as string);
}

/**
 * Default tray dashboard: the 1–2 tightest visible pools.
 * Hidden layout tiles stay out of the compact list.
 */
export function selectTrayDashboardPools(
  pools: readonly Pool[],
  advices: readonly PoolAdvice[],
  visibleIds: readonly string[],
  limit = 2,
): Pool[] {
  const allowed = new Set(visibleIds);
  const candidates = pools.filter((pool) => allowed.has(pool.id));
  const ranked = tightestAdvices(
    advices.filter((item) => allowed.has(item.poolId)),
    limit,
  );
  return ranked
    .map((item) => candidates.find((pool) => pool.id === item.poolId))
    .filter((pool): pool is Pool => pool != null);
}

export function shouldShowTrayHeatmap(opts: {
  heatmapVisible: boolean;
  expandedPoolId: string | null;
  pane: TrayPane;
  editing: boolean;
}): boolean {
  return opts.pane === "dashboard" && !opts.editing && opts.heatmapVisible && opts.expandedPoolId == null;
}

export function recentPoolDeltas(records: readonly UsageRecord[], limit = 2): UsageRecord[] {
  return chartRecords([...records])
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .slice(0, Math.max(0, limit));
}

export type TrayProviderSync = {
  provider: "cursor" | "grok";
  configured: boolean;
  expired: boolean;
  lastSyncedAt: string | undefined;
  message: string | undefined;
};

export function trayProviderSync(
  settings: Record<string, string>,
): { cursor: TrayProviderSync; grok: TrayProviderSync } {
  return {
    cursor: {
      provider: "cursor",
      configured: hasCursorCredentials(settings),
      expired: settings[SETTING_CURSOR_CONNECTED] === "expired",
      lastSyncedAt: settings[SETTING_CURSOR_LAST_SYNCED_AT],
      message: settings[SETTING_CURSOR_SYNC_MESSAGE],
    },
    grok: {
      provider: "grok",
      configured: hasGrokCredentials(settings),
      expired: settings[SETTING_GROK_CONNECTED] === "expired",
      lastSyncedAt: settings[SETTING_GROK_LAST_SYNCED_AT],
      message: settings[SETTING_GROK_SYNC_MESSAGE],
    },
  };
}

/** Header Refresh now — same live stack as the web dashboard. */
export async function runTrayRefresh<T>(
  refreshLiveProviders: (providers?: Array<"cursor" | "grok">) => Promise<T>,
): Promise<T> {
  return refreshLiveProviders();
}
