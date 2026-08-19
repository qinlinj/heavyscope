import { useCallback, useEffect, useMemo } from "react";
import {
  hideTile,
  reorderTiles,
  resolveLayout,
  serializeLayout,
  setTileSize,
  SETTING_DASHBOARD_LAYOUT,
  SETTING_TRAY_LAYOUT,
  showTile,
  type DashboardLayout,
  type LayoutSurface,
  type TileSize,
} from "@/lib/dashboardLayout";

type SettingsMap = Record<string, string>;

export function useWidgetLayout(
  settings: SettingsMap,
  poolIds: readonly string[],
  setSetting: (key: string, value: string) => void,
  surface: LayoutSurface,
) {
  const settingKey = surface === "tray" ? SETTING_TRAY_LAYOUT : SETTING_DASHBOARD_LAYOUT;
  const poolKey = poolIds.join("\0");

  const layout = useMemo(
    () => resolveLayout(settings, poolKey.length > 0 ? poolKey.split("\0") : [], surface),
    [settings, poolKey, surface],
  );

  useEffect(() => {
    const serialized = serializeLayout(layout);
    if (settings[settingKey] !== serialized) {
      setSetting(settingKey, serialized);
    }
  }, [layout, setSetting, settingKey, settings]);

  const persist = useCallback(
    (next: DashboardLayout) => {
      setSetting(settingKey, serializeLayout(next));
    },
    [setSetting, settingKey],
  );

  const reorder = useCallback(
    (fromId: string, toId: string) => persist(reorderTiles(layout, fromId, toId)),
    [layout, persist],
  );

  const setSize = useCallback(
    (id: string, size: TileSize) => persist(setTileSize(layout, id, size)),
    [layout, persist],
  );

  const hide = useCallback((id: string) => persist(hideTile(layout, id)), [layout, persist]);

  const show = useCallback((id: string) => persist(showTile(layout, id)), [layout, persist]);

  return { layout, reorder, setSize, hide, show };
}
