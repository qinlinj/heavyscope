import type { Pool, UsageRecord } from "@/db/schema";
import { tightestAdvice, tightestAdvices, type PoolAdvice } from "@/lib/burnRate";
import { chartRecords } from "@/lib/charts";
import {
  defaultTrayLayout,
  hideTile,
  type DashboardLayout,
  type LayoutTile,
} from "@/lib/dashboardLayout";
import {
  HEATMAP_CELL_GAP_PX,
  HEATMAP_WEEKDAY_COL_PX,
  clampSquareCellPx,
  squareCellPx,
  weeksFromWidth,
} from "@/lib/heatmap";
import { compactPoolView } from "@/lib/poolView";
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

/** Width-fit week cap. About 20–26; never a hardcoded 10-week / 10-month strip. */
export const TRAY_HEATMAP_WEEKS = 26;
export const TRAY_HEATMAP_MIN_CELL_PX = 10;
export const TRAY_HEATMAP_MAX_CELL_PX = 16;
export const TRAY_HIGHLIGHT_LIMIT = 2;
export const TRAY_PANEL_RADIUS_PX = 12;
export const TRAY_OPEN_MS = 180;

/** Four preset pools + heatmap. A single hide cannot wipe the whole default set. */
export const TRAY_DEFAULT_POOL_IDS = [
  "preset-grok-heavy",
  "preset-grok-bot",
  "preset-cursor-models",
  "preset-cursor-other",
] as const;

export const TRAY_PROTECTED_DEFAULT_IDS = [
  "heatmap",
  ...TRAY_DEFAULT_POOL_IDS.map((id) => `pool:${id}`),
] as const;

/** Product purple mixed into the tray panel — not GitHub greens. */
export const TRAY_HEAT_PRIMARY_MIX = [8, 22, 40, 62, 86] as const;

/** macOS Accessory popover. Must match `apply_macos_accessory_window` in src-tauri. */
export const MACOS_TRAY_PANEL = {
  width: 400,
  height: 660,
  maxWidth: 420,
  maxHeight: 700,
} as const;

/** Linux/Windows tray window only. Never use these numbers on macOS. */
export const LINUX_DESKTOP_WINDOW = {
  width: 980,
  height: 720,
} as const;

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
 * Compact tray heatmap: week count from available width (~20–26), not a
 * fixed 10-week / 10-month strip. Cells stay 1:1; the compact path paints
 * them with flex columns (`width: 100%` + `aspect-ratio: 1/1`).
 */
export function fitTrayHeatmap(
  width: number,
  fallbackWidth: number = MACOS_TRAY_PANEL.width,
): { weeks: number; cell: number } {
  const usableWidth = width > 0 ? width : fallbackWidth;
  const weeks = Math.min(TRAY_HEATMAP_WEEKS, weeksFromWidth(usableWidth, TRAY_HEATMAP_MIN_CELL_PX));
  const plotW = Math.max(0, usableWidth - HEATMAP_WEEKDAY_COL_PX);
  const raw = Math.floor(
    (plotW - Math.max(0, weeks - 1) * HEATMAP_CELL_GAP_PX) / Math.max(1, weeks),
  );
  const cell = clampSquareCellPx(raw, TRAY_HEATMAP_MIN_CELL_PX, TRAY_HEATMAP_MAX_CELL_PX);
  return { weeks: Math.max(1, weeks), cell: cell > 0 ? cell : TRAY_HEATMAP_MIN_CELL_PX };
}

/** Compact tray heatmap can pinch/drag-zoom to at least 2 week-columns. */
export const TRAY_HEATMAP_MIN_ZOOM_WEEKS = 2;

export function clampTrayHeatmapZoomWeeks(weeks: number, fitted: number): number {
  const max = Math.max(TRAY_HEATMAP_MIN_ZOOM_WEEKS, Math.trunc(fitted));
  return Math.min(max, Math.max(TRAY_HEATMAP_MIN_ZOOM_WEEKS, Math.trunc(weeks)));
}

/**
 * Horizontal drag-zoom. Drag right (positive dx) zooms in toward today
 * (fewer week columns). Daily cells stay daily. Double-click resets to fitted.
 */
export function trayHeatmapWeeksFromDrag(
  startWeeks: number,
  deltaX: number,
  trackWidth: number,
  fittedWeeks: number,
): number {
  if (!(trackWidth > 0) || !Number.isFinite(deltaX)) {
    return clampTrayHeatmapZoomWeeks(startWeeks, fittedWeeks);
  }
  const span = Math.max(1, fittedWeeks - TRAY_HEATMAP_MIN_ZOOM_WEEKS);
  const deltaWeeks = Math.round((deltaX / trackWidth) * span);
  return clampTrayHeatmapZoomWeeks(startWeeks - deltaWeeks, fittedWeeks);
}

export function trayHeatFill(
  level: 0 | 1 | 2 | 3 | 4,
  panel = "var(--tray-panel)",
): string {
  return `color-mix(in srgb, var(--primary) ${TRAY_HEAT_PRIMARY_MIX[level]}%, ${panel})`;
}

export function isProtectedTrayDefaultId(id: string): boolean {
  return (TRAY_PROTECTED_DEFAULT_IDS as readonly string[]).includes(id);
}

export function trayDefaultProtectedTileIds(): readonly string[] {
  return TRAY_PROTECTED_DEFAULT_IDS;
}

export function trayVisibilityById(tiles: readonly LayoutTile[]): Record<string, boolean> {
  return Object.fromEntries(tiles.map((tile) => [tile.id, tile.visible]));
}

export function sameTrayVisibility(a: DashboardLayout, b: DashboardLayout): boolean {
  const ids = new Set([...a.tiles.map((tile) => tile.id), ...b.tiles.map((tile) => tile.id)]);
  for (const id of ids) {
    const left = a.tiles.find((tile) => tile.id === id)?.visible ?? false;
    const right = b.tiles.find((tile) => tile.id === id)?.visible ?? false;
    if (left !== right) return false;
  }
  return true;
}

/**
 * Done is a mode toggle. No visibility edits → same tiles as when entering
 * edit (heatmap stays visible if it was). Intentional hides persist.
 */
export function applyTrayEditDone(entered: DashboardLayout, current: DashboardLayout): DashboardLayout {
  if (sameTrayVisibility(entered, current)) return entered;
  return current;
}

function visibleProtectedDefaultCount(layout: DashboardLayout): number {
  const protectedIds = new Set<string>(TRAY_PROTECTED_DEFAULT_IDS);
  return layout.tiles.filter((tile) => protectedIds.has(tile.id) && tile.visible).length;
}

/**
 * Hide one tile. Refuses a hide that would conceal every default pool +
 * heatmap at once. Add-cards restore remains the explicit path back.
 */
export function hideTrayTileGuarded(layout: DashboardLayout, id: string): DashboardLayout {
  const next = hideTile(layout, id);
  if (visibleProtectedDefaultCount(next) === 0 && visibleProtectedDefaultCount(layout) > 0) {
    return layout;
  }
  return next;
}

export function defaultTrayVisibilityLayout(
  poolIds: readonly string[] = TRAY_DEFAULT_POOL_IDS,
): DashboardLayout {
  return defaultTrayLayout([...poolIds]);
}

export type TrayHeroSelection = "all" | string;

export type TrayHeroUsed = {
  poolId: string;
  usedPercent: number;
  mode: "all" | "pool";
};

function connectedHeroPool(
  advice: PoolAdvice | null | undefined,
  pools: readonly Pick<Pool, "id" | "quota_total" | "quota_used">[],
): TrayHeroUsed | null {
  if (!advice || advice.risk === "unconnected") return null;
  const pool = pools.find((item) => item.id === advice.poolId);
  if (!pool) return null;
  if (!(pool.quota_total > 0)) return null;
  const percent = Number.isFinite(advice.usagePercent)
    ? advice.usagePercent
    : Math.min(100, Math.max(0, (pool.quota_used / pool.quota_total) * 100));
  if (!Number.isFinite(percent)) return null;
  return { poolId: pool.id, usedPercent: percent, mode: "pool" };
}

/**
 * Hero used% for All (tightest *connected* visible pool) or one selected pool.
 * Null when used% cannot be computed — never invents, never sums mixed units.
 */
export function trayHeroUsedPercent(
  selection: TrayHeroSelection,
  advices: readonly PoolAdvice[],
  pools: readonly Pick<Pool, "id" | "quota_total" | "quota_used">[],
  visibleIds?: readonly string[],
): TrayHeroUsed | null {
  const allowed = visibleIds ? new Set(visibleIds) : null;
  const scoped = allowed ? advices.filter((item) => allowed.has(item.poolId)) : [...advices];

  if (selection !== "all") {
    const picked = connectedHeroPool(
      scoped.find((item) => item.poolId === selection),
      pools,
    );
    return picked;
  }

  const tightest = tightestAdvice(scoped);
  const picked = connectedHeroPool(tightest, pools);
  return picked ? { ...picked, mode: "all" } : null;
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
  const fittedWeeks = width > 0 ? fitTrayHeatmap(width).weeks : weeks;
  return clampSquareCellPx(
    squareCellPx(width, height, fittedWeeks),
    TRAY_HEATMAP_MIN_CELL_PX,
    TRAY_HEATMAP_MAX_CELL_PX,
  );
}

/** Unsynced row or a missing source — one-step next action is tray Settings. */
export function shouldShowTraySettingsCta(unsynced: boolean): boolean {
  return unsynced;
}

/**
 * Blocking first-run banner: neither token is pasted.
 * Cursor-only is enough to hide it — Models / Other / Bot come from Cursor;
 * Heavy already has a per-row Go to Settings CTA.
 */
export function shouldShowTrayConnectBanner(opts: {
  cursorConfigured: boolean;
  grokConfigured: boolean;
}): boolean {
  return !opts.cursorConfigured && !opts.grokConfigured;
}

export type TrayExpandFacts = {
  used: number;
  total: number;
  remaining: number;
  resetAt: string | null;
  unit: string;
  increments: UsageRecord[];
};

/** Facts an expanded tray row must show: used/total, remaining, reset, 1–2 deltas. */
export function trayExpandFacts(
  pool: Pick<Pool, "name" | "unit" | "quota_used" | "quota_total" | "reset_at">,
  records: readonly UsageRecord[],
  limit = 2,
): TrayExpandFacts {
  const view = compactPoolView(pool);
  return {
    used: view.used,
    total: view.total,
    remaining: view.remaining,
    resetAt: view.resetAt,
    unit: view.unit,
    increments: recentPoolDeltas(records, limit),
  };
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
