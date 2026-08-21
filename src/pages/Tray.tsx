import { ArrowLeft, Check, Gauge, Pencil, RefreshCw, Settings2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { AddCardsStrip } from "@/components/AddCardsStrip";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { ChartsPanel } from "@/components/ChartsPanel";
import { LanguageToggle } from "@/components/LanguageToggle";
import { OverflowStrip } from "@/components/OverflowStrip";
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
import { formatAdvisorLine } from "@/lib/advisorLine";
import { useLiveProxyAvailable } from "@/hooks/useLiveProxy";
import { advisePool, crossPoolAdvice, tightestAdvice } from "@/lib/burnRate";
import { liveUserMessage } from "@/lib/liveFlash";
import { hasSuccessfulApply, isUnsyncedPreset } from "@/lib/poolSyncState";
import { chartRecords } from "@/lib/charts";
import { hiddenTiles, visibleTiles, type LayoutTile } from "@/lib/dashboardLayout";
import { formatDateTime } from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";
import {
  highlightedTrayPoolIds,
  MACOS_TRAY_PANEL,
  parseTrayPane,
  runTrayRefresh,
  selectTrayDashboardPools,
  shouldShowTrayConnectBanner,
  shouldShowTrayHeatmap,
  toggleExpandedPoolId,
  trayProviderSync,
  visiblePoolIds,
  TRAY_HEATMAP_MAX_CELL_PX,
  TRAY_HEATMAP_MIN_CELL_PX,
  type TrayPane,
} from "@/lib/trayView";

export function TrayPage() {
  const { t, i18n } = useTranslation();
  const { ready, error, pools, records, settings, setSetting, thresholds, refreshLiveProviders } =
    useDatabase();
  const poolIds = useMemo(() => pools.map((pool) => pool.id), [pools]);
  const { layout, setSize, hide, show, commitLayout } = useWidgetLayout(
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
  const drag = useTileDragPreview(layout, editingLayout, commitLayout);
  const previewShown = useMemo(() => visibleTiles(drag.displayLayout), [drag.displayLayout]);
  const shown = drag.draggingId ? shownBase : previewShown;
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncFlash, setSyncFlash] = useState<string | null>(null);
  const proxyAvailable = useLiveProxyAvailable();

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
    setExpandedPoolId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "settings") url.searchParams.set("pane", "settings");
      else url.searchParams.delete("pane");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  async function handleRefreshNow() {
    setSyncBusy(true);
    try {
      const report = await runTrayRefresh(refreshLiveProviders);
      setSyncFlash(
        liveUserMessage(t, {
          message: report.message,
          code: report.code,
          proxyAvailable,
        }),
      );
    } finally {
      setSyncBusy(false);
    }
  }

  if (!ready) {
    return (
      <TrayShell>
        <p className="text-xs text-muted-foreground">{error ?? t("common.loading")}</p>
      </TrayShell>
    );
  }

  return (
    <TrayShell>
      <header className="flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {pane === "settings" ? (
            <Button type="button" size="icon-xs" variant="ghost" onClick={() => openPane("dashboard")}>
              <ArrowLeft />
              <span className="sr-only">{t("tray.settingsBack")}</span>
            </Button>
          ) : (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Gauge className="size-3.5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-heading truncate text-sm font-semibold tracking-tight">
              {pane === "settings" ? t("settings.title") : t("app.name")}
            </h1>
            {pane === "dashboard" && !showConnectBanner ? (
              <p className="truncate text-xs text-muted-foreground">{t("tray.subtitle")}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
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
              variant="outline"
              onClick={() => openPane("settings")}
              title={t("nav.settings")}
            >
              <Settings2 />
              <span className="sr-only">{t("nav.settings")}</span>
            </Button>
          ) : null}
          <ThemeToggle compact />
          <LanguageToggle compact />
        </div>
      </header>

      {pane === "settings" ? (
        <OverflowStrip className="min-h-0 min-w-0 flex-1">
          <div className="min-w-full">
            <TraySettings />
          </div>
        </OverflowStrip>
      ) : (
        <>
          <div className="flex items-center justify-end">
            <Button
              type="button"
              size="xs"
              variant={editingLayout ? "default" : "ghost"}
              className="h-5 px-1.5 text-xs"
              onClick={() => {
                setEditingLayout((current) => !current);
                setExpandedPoolId(null);
              }}
            >
              {editingLayout ? <Check data-icon="inline-start" /> : <Pencil data-icon="inline-start" />}
              {editingLayout ? t("layout.done") : t("tray.editLayout")}
            </Button>
          </div>

          {editingLayout ? (
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
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
                      onHide={hide}
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
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {showConnectBanner ? (
                <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-dashed border-primary/30 bg-primary/5 px-2 py-1.5">
                  <p className="min-w-0 text-xs leading-snug text-muted-foreground">
                    {t("tray.subtitleConnect")}
                  </p>
                  <Button type="button" size="xs" onClick={() => openPane("settings")}>
                    {t("tray.goToSettings")}
                  </Button>
                </div>
              ) : null}
              <p className="text-xs leading-snug text-muted-foreground">
                {formatAdvisorLine(t, tightest, switchAdvice, pools) ?? t("tray.empty")}
              </p>

              {dashboardPools.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("tray.empty")}</p>
              ) : (
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
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

              <div className="space-y-0.5 text-xs leading-snug text-muted-foreground">
                <p>
                  {t("live.lastSyncedCursor")}:{" "}
                  {providerSync.cursor.configured
                    ? providerSync.cursor.lastSyncedAt
                      ? formatDateTime(providerSync.cursor.lastSyncedAt, i18n.language)
                      : t("live.lastSyncedNever")
                    : t("live.notConnected")}
                  {providerSync.cursor.expired || providerSync.cursor.message
                    ? ` — ${providerSync.cursor.expired ? t("live.cursorExpired") : providerSync.cursor.message}`
                    : ""}
                </p>
                <p>
                  {t("live.lastSyncedGrok")}:{" "}
                  {providerSync.grok.configured
                    ? providerSync.grok.lastSyncedAt
                      ? formatDateTime(providerSync.grok.lastSyncedAt, i18n.language)
                      : t("live.lastSyncedNever")
                    : t("live.notConnected")}
                  {providerSync.grok.expired || providerSync.grok.message
                    ? ` — ${providerSync.grok.expired ? t("live.expired") : providerSync.grok.message}`
                    : ""}
                </p>
                {proxyAvailable === false ? <p className="text-amber-600 dark:text-amber-400">{t("live.webNoProxy")}</p> : null}
                {syncFlash ? <p>{syncFlash}</p> : null}
              </div>

              {showHeatmap ? (
                <ActivityHeatmap
                  records={liveRecords}
                  pools={pools}
                  compact
                  minCellPx={TRAY_HEATMAP_MIN_CELL_PX}
                  maxCellPx={TRAY_HEATMAP_MAX_CELL_PX}
                />
              ) : null}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">{t("tray.hideHint")}</p>
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
  return (
    <div className="flex h-svh justify-center overflow-hidden bg-background text-xs text-foreground">
      <div className="pointer-events-none fixed inset-0 dark:bg-[radial-gradient(circle_at_top,_oklch(0.32_0.08_300/_0.40),_transparent_55%)]" />
      <div
        className="relative flex h-full min-h-0 w-full flex-col gap-2 overflow-x-auto overflow-y-auto px-2.5 py-2.5"
        style={{
          maxWidth: MACOS_TRAY_PANEL.maxWidth,
          width: MACOS_TRAY_PANEL.width,
        }}
      >
        {children}
      </div>
    </div>
  );
}
