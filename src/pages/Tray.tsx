import { ArrowLeft, Check, Pencil, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { AddCardsStrip } from "@/components/AddCardsStrip";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { ChartsPanel } from "@/components/ChartsPanel";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PiesPanel } from "@/components/PiesPanel";
import { PoolCard } from "@/components/PoolCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TrayPoolRow } from "@/components/TrayPoolRow";
import { TraySettings } from "@/components/TraySettings";
import { WidgetGrid } from "@/components/WidgetGrid";
import { WidgetTile } from "@/components/WidgetTile";
import { Button } from "@/components/ui/button";
import { useDatabase } from "@/hooks/useDatabase";
import { useTileDragPreview } from "@/hooks/useTileDragPreview";
import { useWidgetLayout } from "@/hooks/useWidgetLayout";
import { advisePool, crossPoolAdvice, tightestAdvice } from "@/lib/burnRate";
import { hasSuccessfulApply, isUnsyncedPreset } from "@/lib/poolSyncState";
import { chartRecords, type ChartScale } from "@/lib/charts";
import { hiddenTiles, visibleTiles, type DashboardLayout, type LayoutTile } from "@/lib/dashboardLayout";
import { formatAmount } from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";
import {
  applyTrayEditDone,
  hideTrayTileGuarded,
  highlightedTrayPoolIds,
  MACOS_TRAY_PANEL,
  parseTrayPane,
  runTrayRefresh,
  selectTrayDashboardPools,
  shouldShowTrayConnectBanner,
  shouldShowTrayHeatmap,
  toggleExpandedPoolId,
  trayHeroRemaining,
  trayProviderSync,
  visiblePoolIds,
  TRAY_HEATMAP_MAX_CELL_PX,
  TRAY_HEATMAP_MIN_CELL_PX,
  TRAY_OPEN_MS,
  TRAY_PANEL_RADIUS_PX,
  type TrayPane,
} from "@/lib/trayView";

const SCALES: ChartScale[] = ["day", "week", "month"];

export function TrayPage() {
  const { t } = useTranslation();
  const { ready, error, pools, records, settings, setSetting, thresholds, refreshLiveProviders } =
    useDatabase();
  const poolIds = useMemo(() => pools.map((pool) => pool.id), [pools]);
  const { layout, setSize, show, commitLayout } = useWidgetLayout(
    settings,
    poolIds,
    setSetting,
    "tray",
  );
  const shownBase = useMemo(() => visibleTiles(layout), [layout]);
  const hidden = useMemo(() => hiddenTiles(layout), [layout]);
  const [pane, setPane] = useState<TrayPane>(() => {
    if (typeof window === "undefined") return "dashboard";
    return parseTrayPane(new URLSearchParams(window.location.search).get("pane"));
  });
  const [editingLayout, setEditingLayout] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<DashboardLayout | null>(null);
  const [chartScale, setChartScale] = useState<ChartScale>("day");
  const drag = useTileDragPreview(layout, editingLayout, commitLayout);
  const previewShown = useMemo(() => visibleTiles(drag.displayLayout), [drag.displayLayout]);
  const shown = drag.draggingId ? shownBase : previewShown;
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);

  const liveRecords = useMemo(() => chartRecords(records), [records]);
  const advices = useMemo(
    () =>
      pools.map((pool) =>
        advisePool(pool, liveRecords, new Date(), {
          hasSuccessfulApply: hasSuccessfulApply(pool.id, liveRecords, settings),
        }),
      ),
    [pools, liveRecords, settings],
  );
  const tightest = useMemo(() => tightestAdvice(advices), [advices]);
  const switchAdvice = useMemo(() => crossPoolAdvice(advices), [advices]);
  const visibleIds = useMemo(() => visiblePoolIds(layout.tiles), [layout.tiles]);
  const dashboardPools = useMemo(
    () => selectTrayDashboardPools(pools, visibleIds),
    [pools, visibleIds],
  );
  const highlightedIds = useMemo(
    () => new Set(highlightedTrayPoolIds(advices, visibleIds)),
    [advices, visibleIds],
  );
  const heatmapVisible = layout.tiles.some((tile) => tile.type === "heatmap" && tile.visible);
  const showHeatmap = shouldShowTrayHeatmap({
    heatmapVisible,
    pane,
    editing: editingLayout,
  });
  const providerSync = useMemo(() => trayProviderSync(settings), [settings]);
  const canRefresh = providerSync.cursor.configured || providerSync.grok.configured;
  const showConnectBanner = shouldShowTrayConnectBanner({
    cursorConfigured: providerSync.cursor.configured,
    grokConfigured: providerSync.grok.configured,
  });
  const hero = useMemo(() => trayHeroRemaining(advices, pools), [advices, pools]);
  const heroPool = hero ? pools.find((item) => item.id === hero.poolId) : undefined;

  function tileLabel(tile: LayoutTile): string {
    if (tile.type === "pool") {
      const pool = pools.find((item) => item.id === tile.poolId);
      return pool ? displayPoolName(pool, t) : tile.poolId ?? tile.id;
    }
    return t(`charts.module.${tile.type}`);
  }

  function openPane(next: TrayPane) {
    setPane(next);
    setEditingLayout(false);
    setEditSnapshot(null);
    setExpandedPoolId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "settings") url.searchParams.set("pane", "settings");
      else url.searchParams.delete("pane");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function toggleEdit() {
    if (editingLayout) {
      const next = applyTrayEditDone(editSnapshot ?? layout, layout);
      if (next !== layout) commitLayout(next);
      setEditSnapshot(null);
      setEditingLayout(false);
      setExpandedPoolId(null);
      return;
    }
    setEditSnapshot(layout);
    setEditingLayout(true);
    setExpandedPoolId(null);
  }

  function hideGuarded(id: string) {
    commitLayout(hideTrayTileGuarded(layout, id));
  }

  async function handleRefreshNow() {
    setSyncBusy(true);
    try {
      await runTrayRefresh(refreshLiveProviders);
    } finally {
      setSyncBusy(false);
    }
  }

  if (!ready) {
    return (
      <TrayShell>
        <p className="px-3 py-2.5 text-xs text-muted-foreground">{error ?? t("common.loading")}</p>
      </TrayShell>
    );
  }

  return (
    <TrayShell>
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-1.5 border-b border-foreground/10 bg-[var(--tray-panel)] px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1">
          {pane === "settings" ? (
            <Button type="button" size="icon-xs" variant="ghost" onClick={() => openPane("dashboard")}>
              <ArrowLeft />
              <span className="sr-only">{t("tray.settingsBack")}</span>
            </Button>
          ) : null}
          <h1 className="font-heading truncate text-sm font-semibold tracking-tight">
            {pane === "settings" ? t("settings.title") : t("app.name")}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {pane === "dashboard" && !editingLayout ? (
            <div className="mr-0.5 flex items-center gap-0.5">
              {SCALES.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="xs"
                  variant={chartScale === item ? "default" : "ghost"}
                  className="h-6 px-1.5 text-[11px]"
                  onClick={() => setChartScale(item)}
                >
                  {t(`charts.scale.${item}`)}
                </Button>
              ))}
            </div>
          ) : null}
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            disabled={!ready || syncBusy || !canRefresh}
            onClick={() => void handleRefreshNow()}
            title={t("live.refreshNow")}
          >
            <RefreshCw className={syncBusy ? "animate-spin" : undefined} />
            <span className="sr-only">{t("live.refreshNow")}</span>
          </Button>
          {pane === "dashboard" ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => openPane("settings")}
              title={t("nav.settings")}
            >
              <Settings2 />
              <span className="sr-only">{t("nav.settings")}</span>
            </Button>
          ) : (
            <LanguageToggle compact />
          )}
          <ThemeToggle compact />
          {pane === "dashboard" ? (
            <Button
              type="button"
              size="icon-xs"
              variant={editingLayout ? "default" : "ghost"}
              onClick={toggleEdit}
              title={editingLayout ? t("layout.done") : t("tray.editLayout")}
            >
              {editingLayout ? <Check /> : <Pencil />}
              <span className="sr-only">{editingLayout ? t("layout.done") : t("tray.editLayout")}</span>
            </Button>
          ) : null}
        </div>
      </header>

      {pane === "settings" ? (
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="px-2.5 py-2">
            <TraySettings />
          </div>
        </div>
      ) : editingLayout ? (
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-2 px-2.5 py-2">
            <p className="rounded-md border border-dashed border-foreground/20 bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
              {t("layout.editHint")}
            </p>
            {shown.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("tray.empty")}</p>
            ) : (
              <WidgetGrid
                columns={2}
                editing
                dragging={Boolean(drag.draggingId)}
                gridRef={drag.gridRef}
                onDragOver={(event) => {
                  if (!drag.draggingId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  drag.updateFromPointer(event.clientX, event.clientY);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  drag.commit();
                }}
              >
                {shown.map((tile) => (
                  <WidgetTile
                    key={tile.id}
                    tile={tile}
                    columns={2}
                    editing
                    dragging={drag.draggingId === tile.id}
                    order={
                      drag.draggingId
                        ? previewShown.findIndex((item) => item.id === tile.id)
                        : undefined
                    }
                    onDragStart={drag.begin}
                    onDragEnd={drag.end}
                    onSize={setSize}
                    onHide={hideGuarded}
                    sizes={["sm", "md", "lg"]}
                  >
                    {tile.type === "advisor" ? (
                      <AdvisorPanel
                        pools={pools}
                        advices={advices}
                        tightest={tightest}
                        switchAdvice={switchAdvice}
                        warnPercent={thresholds.warn}
                        critPercent={thresholds.crit}
                        compact
                      />
                    ) : tile.type === "pies" ? (
                      <PiesPanel pools={pools} compact size="sm" />
                    ) : tile.type === "heatmap" || tile.type === "trend" ? (
                      <ChartsPanel
                        pools={pools}
                        records={liveRecords}
                        modules={[tile.type]}
                        showHeading={false}
                        compact
                        size={tile.size === "lg" || tile.size === "xl" ? "md" : tile.size}
                      />
                    ) : (
                      renderPool(tile)
                    )}
                  </WidgetTile>
                ))}
              </WidgetGrid>
            )}
            <AddCardsStrip tiles={hidden} labelFor={tileLabel} onRestore={show} />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-2 px-2.5 py-2">
            {showConnectBanner ? (
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <p className="min-w-0 text-xs leading-snug text-muted-foreground">
                  {t("tray.subtitleConnect")}
                </p>
                <Button type="button" size="xs" onClick={() => openPane("settings")}>
                  {t("tray.goToSettings")}
                </Button>
              </div>
            ) : null}

            {hero ? (
              <div className="min-w-0">
                <p className="text-[28px] leading-none font-semibold tabular-nums tracking-tight">
                  {formatAmount(hero.remaining, hero.unit)}
                </p>
                {heroPool ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{displayPoolName(heroPool, t)}</p>
                ) : null}
              </div>
            ) : null}

            {dashboardPools.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("tray.empty")}</p>
            ) : (
              <div className="space-y-0.5">
                {dashboardPools.map((pool) => (
                  <TrayPoolRow
                    key={pool.id}
                    pool={pool}
                    records={liveRecords.filter((record) => record.pool_id === pool.id)}
                    advice={advices.find((item) => item.poolId === pool.id)}
                    expanded={expandedPoolId === pool.id}
                    highlighted={highlightedIds.has(pool.id)}
                    unsynced={isUnsyncedPreset(pool, liveRecords, settings)}
                    warnPercent={thresholds.warn}
                    critPercent={thresholds.crit}
                    onToggle={(id) => setExpandedPoolId((current) => toggleExpandedPoolId(current, id))}
                    onOpenSettings={() => openPane("settings")}
                  />
                ))}
              </div>
            )}

            {showHeatmap ? (
              <ActivityHeatmap
                records={liveRecords}
                pools={pools}
                compact
                scale={chartScale}
                minCellPx={TRAY_HEATMAP_MIN_CELL_PX}
                maxCellPx={TRAY_HEATMAP_MAX_CELL_PX}
              />
            ) : null}
          </div>
        </div>
      )}
    </TrayShell>
  );

  function renderPool(tile: LayoutTile) {
    const pool = pools.find((item) => item.id === tile.poolId);
    if (!pool) return null;
    return (
      <PoolCard
        pool={pool}
        records={liveRecords.filter((record) => record.pool_id === pool.id)}
        advice={advices.find((item) => item.poolId === pool.id)}
        warnPercent={thresholds.warn}
        critPercent={thresholds.crit}
        compact={tile.size === "sm"}
        unsynced={isUnsyncedPreset(pool, liveRecords, settings)}
        showActions={false}
        showRecent={false}
        showAdvice={false}
      />
    );
  }
}

function TrayShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    html.style.backgroundColor = "transparent";
    body.style.backgroundColor = "transparent";
    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
    };
  }, []);

  return (
    <div className="flex h-svh items-center justify-center overflow-hidden bg-transparent text-xs text-foreground">
      <div
        className="relative flex max-h-svh min-h-0 w-full flex-col overflow-hidden border border-black/10 bg-white text-foreground [--tray-panel:#fff] dark:border-white/10 dark:bg-[#1f2226] dark:[--tray-panel:#1f2226] animate-in fade-in"
        style={{
          maxWidth: MACOS_TRAY_PANEL.maxWidth,
          width: MACOS_TRAY_PANEL.width,
          height: MACOS_TRAY_PANEL.height,
          borderRadius: TRAY_PANEL_RADIUS_PX,
          animationDuration: `${TRAY_OPEN_MS}ms`,
          boxShadow: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
