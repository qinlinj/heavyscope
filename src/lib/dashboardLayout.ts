import {
  CHART_MODULE_IDS,
  parseChartPrefs,
  type ChartModuleId,
} from "@/lib/charts";

/**
 * Widget layout for the Web dashboard and compact `/tray` panel.
 *
 * Web dashboard: 4-column CSS grid, gap ~12px (`gap-3`).
 * - sm: 1 column (~1/4, small widget)
 * - md: 2 columns (~1/2, default for pool cards)
 * - lg: 4 columns (full width, default for advisor / heatmap / trend)
 * - xl: 4 columns + extra min-height (optional tall full-width)
 *
 * Tray: 2-column grid.
 * - sm: 1 column
 * - md / lg / xl: 2 columns (full tray width)
 *
 * Persisted as JSON in the settings table (`dashboard_layout` / `tray_layout`).
 * Array order is display order. Hidden tiles stay in the list so size/position restore.
 */
export const SETTING_DASHBOARD_LAYOUT = "dashboard_layout";
export const SETTING_TRAY_LAYOUT = "tray_layout";

export const TILE_SIZES = ["sm", "md", "lg", "xl"] as const;
export type TileSize = (typeof TILE_SIZES)[number];

export const TILE_TYPES = ["advisor", "heatmap", "trend", "pool"] as const;
export type TileType = (typeof TILE_TYPES)[number];

export const SYSTEM_TILE_TYPES = ["advisor", "heatmap", "trend"] as const;
export type SystemTileType = (typeof SYSTEM_TILE_TYPES)[number];

export const LAYOUT_SURFACES = ["dashboard", "tray"] as const;
export type LayoutSurface = (typeof LAYOUT_SURFACES)[number];

export const LAYOUT_VERSION = 1;

export type LayoutTile = {
  id: string;
  type: TileType;
  size: TileSize;
  visible: boolean;
  poolId?: string;
};

export type DashboardLayout = {
  version: typeof LAYOUT_VERSION;
  tiles: LayoutTile[];
};

export function poolTileId(poolId: string): string {
  return `pool:${poolId}`;
}

export function isTileSize(value: unknown): value is TileSize {
  return typeof value === "string" && (TILE_SIZES as readonly string[]).includes(value);
}

export function isTileType(value: unknown): value is TileType {
  return typeof value === "string" && (TILE_TYPES as readonly string[]).includes(value);
}

export function isSystemTileType(value: unknown): value is SystemTileType {
  return typeof value === "string" && (SYSTEM_TILE_TYPES as readonly string[]).includes(value);
}

/** Columns a tile occupies on a 2-col tray or 4-col dashboard grid. */
export function tileColumnSpan(size: TileSize, columns: 2 | 4): number {
  if (columns === 2) return size === "sm" ? 1 : 2;
  if (size === "sm") return 1;
  if (size === "md") return 2;
  return 4;
}

export function defaultSystemTile(type: SystemTileType, surface: LayoutSurface): LayoutTile {
  if (surface === "tray") {
    if (type === "trend") return { id: type, type, size: "lg", visible: false };
    return { id: type, type, size: "md", visible: true };
  }
  return { id: type, type, size: "lg", visible: true };
}

export function defaultPoolTile(poolId: string, visible: boolean): LayoutTile {
  return {
    id: poolTileId(poolId),
    type: "pool",
    size: "md",
    visible,
    poolId,
  };
}

export function defaultDashboardLayout(poolIds: string[]): DashboardLayout {
  return {
    version: LAYOUT_VERSION,
    tiles: [
      defaultSystemTile("advisor", "dashboard"),
      defaultSystemTile("heatmap", "dashboard"),
      defaultSystemTile("trend", "dashboard"),
      ...poolIds.map((poolId) => defaultPoolTile(poolId, true)),
    ],
  };
}

/** Tight accessory: one-line advisor + small heatmap + first two pools. Trend hidden. */
export function defaultTrayLayout(poolIds: string[]): DashboardLayout {
  return {
    version: LAYOUT_VERSION,
    tiles: [
      defaultSystemTile("advisor", "tray"),
      defaultSystemTile("heatmap", "tray"),
      defaultSystemTile("trend", "tray"),
      ...poolIds.map((poolId, index) => defaultPoolTile(poolId, index < 2)),
    ],
  };
}

function normalizeTile(item: unknown): LayoutTile | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  if (!isTileType(raw.type)) return null;
  const size: TileSize = isTileSize(raw.size) ? raw.size : raw.type === "pool" ? "md" : "lg";
  const visible = raw.visible !== false && raw.visible !== 0 && raw.visible !== "false";

  if (raw.type === "pool") {
    const poolId = typeof raw.poolId === "string" && raw.poolId.trim() ? raw.poolId : null;
    if (!poolId) return null;
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : poolTileId(poolId);
    return { id, type: "pool", size, visible, poolId };
  }

  return { id: raw.type, type: raw.type, size, visible };
}

/** Returns null when the payload is missing or not a v1 tile list (caller should migrate). */
export function parseLayout(raw: string | undefined | null): DashboardLayout | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as { version?: unknown; tiles?: unknown };
    if (obj.version !== LAYOUT_VERSION || !Array.isArray(obj.tiles) || obj.tiles.length === 0) {
      return null;
    }
    const tiles: LayoutTile[] = [];
    const seen = new Set<string>();
    for (const item of obj.tiles) {
      const tile = normalizeTile(item);
      if (!tile || seen.has(tile.id)) continue;
      seen.add(tile.id);
      tiles.push(tile);
    }
    if (tiles.length === 0) return null;
    return { version: LAYOUT_VERSION, tiles };
  } catch {
    return null;
  }
}

export function serializeLayout(layout: DashboardLayout): string {
  return JSON.stringify({
    version: LAYOUT_VERSION,
    tiles: layout.tiles.map((tile) => {
      const next: LayoutTile = {
        id: tile.id,
        type: tile.type,
        size: tile.size,
        visible: tile.visible,
      };
      if (tile.type === "pool" && tile.poolId) next.poolId = tile.poolId;
      return next;
    }),
  });
}

/** Build a dashboard layout from chart_show_* / chart_module_order so hide/order survive. */
export function migrateFromChartPrefs(
  settings: Record<string, string>,
  poolIds: string[],
): DashboardLayout {
  const prefs = parseChartPrefs(settings);
  const tiles: LayoutTile[] = [];
  const seen = new Set<ChartModuleId>();
  for (const id of prefs.order) {
    tiles.push({ id, type: id, size: "lg", visible: prefs.show[id] });
    seen.add(id);
  }
  for (const id of CHART_MODULE_IDS) {
    if (!seen.has(id)) tiles.push({ id, type: id, size: "lg", visible: prefs.show[id] });
  }
  for (const poolId of poolIds) {
    tiles.push(defaultPoolTile(poolId, true));
  }
  return { version: LAYOUT_VERSION, tiles };
}

export function ensureSystemTiles(layout: DashboardLayout, surface: LayoutSurface): DashboardLayout {
  const seen = new Set(layout.tiles.map((tile) => tile.id));
  const extras: LayoutTile[] = [];
  for (const type of SYSTEM_TILE_TYPES) {
    if (!seen.has(type)) extras.push(defaultSystemTile(type, surface));
  }
  if (extras.length === 0) return layout;
  return { version: LAYOUT_VERSION, tiles: [...layout.tiles, ...extras] };
}

/** Drop pool tiles whose pool no longer exists. System tiles are kept. */
export function pruneMissingPools(layout: DashboardLayout, poolIds: readonly string[]): DashboardLayout {
  const known = new Set(poolIds);
  const tiles = layout.tiles.filter((tile) => tile.type !== "pool" || (tile.poolId != null && known.has(tile.poolId)));
  if (tiles.length === layout.tiles.length) return layout;
  return { version: LAYOUT_VERSION, tiles };
}

/** Append missing pools (default md). Dashboard shows them; tray hides extras to stay compact. */
export function ensureAllPools(
  layout: DashboardLayout,
  poolIds: readonly string[],
  surface: LayoutSurface = "dashboard",
): DashboardLayout {
  const existing = new Set(
    layout.tiles.filter((tile) => tile.type === "pool" && tile.poolId).map((tile) => tile.poolId as string),
  );
  const extras: LayoutTile[] = [];
  for (const poolId of poolIds) {
    if (existing.has(poolId)) continue;
    extras.push(defaultPoolTile(poolId, surface === "dashboard"));
  }
  if (extras.length === 0) return layout;
  return { version: LAYOUT_VERSION, tiles: [...layout.tiles, ...extras] };
}

/** Insert `fromId` before `toId`. Hidden tiles stay in the array. */
export function reorderTiles(layout: DashboardLayout, fromId: string, toId: string): DashboardLayout {
  if (fromId === toId) return { version: LAYOUT_VERSION, tiles: [...layout.tiles] };
  const fromIndex = layout.tiles.findIndex((tile) => tile.id === fromId);
  const toIndex = layout.tiles.findIndex((tile) => tile.id === toId);
  if (fromIndex < 0 || toIndex < 0) return { version: LAYOUT_VERSION, tiles: [...layout.tiles] };
  const tiles = layout.tiles.filter((tile) => tile.id !== fromId);
  const insertAt = tiles.findIndex((tile) => tile.id === toId);
  if (insertAt < 0) return { version: LAYOUT_VERSION, tiles: [...layout.tiles] };
  const moved = layout.tiles[fromIndex];
  if (!moved) return { version: LAYOUT_VERSION, tiles: [...layout.tiles] };
  tiles.splice(insertAt, 0, moved);
  return { version: LAYOUT_VERSION, tiles };
}

export function setTileSize(layout: DashboardLayout, id: string, size: TileSize): DashboardLayout {
  return {
    version: LAYOUT_VERSION,
    tiles: layout.tiles.map((tile) => (tile.id === id ? { ...tile, size } : tile)),
  };
}

export function setTileVisible(layout: DashboardLayout, id: string, visible: boolean): DashboardLayout {
  return {
    version: LAYOUT_VERSION,
    tiles: layout.tiles.map((tile) => (tile.id === id ? { ...tile, visible } : tile)),
  };
}

export function hideTile(layout: DashboardLayout, id: string): DashboardLayout {
  return setTileVisible(layout, id, false);
}

export function showTile(layout: DashboardLayout, id: string): DashboardLayout {
  return setTileVisible(layout, id, true);
}

export function visibleTiles(layout: DashboardLayout): LayoutTile[] {
  return layout.tiles.filter((tile) => tile.visible);
}

export function hiddenTiles(layout: DashboardLayout): LayoutTile[] {
  return layout.tiles.filter((tile) => !tile.visible);
}

export function resolveLayout(
  settings: Record<string, string>,
  poolIds: readonly string[],
  surface: LayoutSurface,
): DashboardLayout {
  const key = surface === "tray" ? SETTING_TRAY_LAYOUT : SETTING_DASHBOARD_LAYOUT;
  const parsed = parseLayout(settings[key]);
  const base =
    parsed ??
    (surface === "tray" ? defaultTrayLayout([...poolIds]) : migrateFromChartPrefs(settings, [...poolIds]));
  return ensureAllPools(ensureSystemTiles(pruneMissingPools(base, poolIds), surface), poolIds, surface);
}
