import type { Pool, UsageRecord } from "@/db/schema";
import { tightestAdvices, type PoolAdvice } from "@/lib/burnRate";
import { chartRecords } from "@/lib/charts";
import type { LayoutTile } from "@/lib/dashboardLayout";
import { clampSquareCellPx, squareCellPx } from "@/lib/heatmap";
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

export const TRAY_HEATMAP_WEEKS = 10;
export const TRAY_HEATMAP_MIN_CELL_PX = 8;
export const TRAY_HEATMAP_MAX_CELL_PX = 10;
export const TRAY_HIGHLIGHT_LIMIT = 2;

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
 * Default tray dashboard: every visible pool tile from `tray_layout`, in
 * layout order. No hard cap — Layout hide/show/resize is the source of
 * truth. Hidden tiles stay out. Missing pool ids are dropped.
 */
export function selectTrayDashboardPools(
  pools: readonly Pool[],
  visibleIds: readonly string[],
): Pool[] {
  const byId = new Map(pools.map((pool) => [pool.id, pool]));
  const seen = new Set<string>();
  const selected: Pool[] = [];
  for (const id of visibleIds) {
    if (seen.has(id)) continue;
    const pool = byId.get(id);
    if (!pool) continue;
    seen.add(id);
    selected.push(pool);
  }
  return selected;
}

/** Tightest 1–2 visible pools, for collapsed-row highlight only. */
export function highlightedTrayPoolIds(
  advices: readonly PoolAdvice[],
  visibleIds: readonly string[],
  limit = TRAY_HIGHLIGHT_LIMIT,
): string[] {
  const allowed = new Set(visibleIds);
  return tightestAdvices(
    advices.filter((item) => allowed.has(item.poolId)),
    limit,
  ).map((item) => item.poolId);
}

export function shouldShowTrayHeatmap(opts: {
  heatmapVisible: boolean;
  pane: TrayPane;
  editing: boolean;
}): boolean {
  return opts.pane === "dashboard" && !opts.editing && opts.heatmapVisible;
}

/**
 * Compact tray heatmap cell size: same `squareCellPx` as the web grid,
 * then clamped so squares never stretch on a tall/wide panel.
 */
export function trayHeatmapCellPx(
  width: number,
  height: number,
  weeks = TRAY_HEATMAP_WEEKS,
): number {
  return clampSquareCellPx(
    squareCellPx(width, height, weeks),
    TRAY_HEATMAP_MIN_CELL_PX,
    TRAY_HEATMAP_MAX_CELL_PX,
  );
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
