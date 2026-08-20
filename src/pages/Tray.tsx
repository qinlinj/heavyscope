import { ArrowLeft, Check, Gauge, Pencil, RefreshCw, Settings2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
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
import { useWidgetLayout } from "@/hooks/useWidgetLayout";
import { formatAdvisorLine } from "@/lib/advisorLine";
import { advisePool, crossPoolAdvice, tightestAdvice } from "@/lib/burnRate";
import { chartRecords } from "@/lib/charts";
import { hiddenTiles, visibleTiles, type LayoutTile } from "@/lib/dashboardLayout";
import { formatDateTime } from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";
import { parseTrayPane, runTrayRefresh, selectTrayDashboardPools, shouldShowTrayHeatmap, toggleExpandedPoolId, trayProviderSync, visiblePoolIds, type TrayPane } from "@/lib/trayView";

export function TrayPage() {
  const { t, i18n } = useTranslation();
  const { ready, error, pools, records, settings, setSetting, thresholds, refreshLiveProviders } =
    useDatabase();
  const poolIds = useMemo(() => pools.map((pool) => pool.id), [pools]);
  const { layout, reorder, setSize, hide, show } = useWidgetLayout(settings, poolIds, setSetting, "tray");
  const shown = useMemo(() => visibleTiles(layout), [layout]);
  const hidden = useMemo(() => hiddenTiles(layout), [layout]);
  const [pane, setPane] = useState<TrayPane>(() => {
    if (typeof window === "undefined") return "dashboard";
    return parseTrayPane(new URLSearchParams(window.location.search).get("pane"));
  });
  const [editingLayout, setEditingLayout] = useState(false);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncFlash, setSyncFlash] = useState<string | null>(null);

  const liveRecords = useMemo(() => chartRecords(records), [records]);
  const advices = useMemo(
    () => pools.map((pool) => advisePool(pool, liveRecords)),
    [pools, liveRecords],
  );
  const tightest = useMemo(() => tightestAdvice(advices), [advices]);
  const switchAdvice = useMemo(() => crossPoolAdvice(advices), [advices]);
  const dashboardPools = useMemo(
    () => selectTrayDashboardPools(pools, advices, visiblePoolIds(layout.tiles)),
    [pools, advices, layout.tiles],
  );
  const heatmapVisible = layout.tiles.some((tile) => tile.type === "heatmap" && tile.visible);
  const showHeatmap = shouldShowTrayHeatmap({
    heatmapVisible,
    expandedPoolId,
    pane,
    editing: editingLayout,
  });
  const providerSync = useMemo(() => trayProviderSync(settings), [settings]);
  const canRefresh = providerSync.cursor.configured || providerSync.grok.configured;

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
      setSyncFlash(report.message);
    } finally {
      setSyncBusy(false);
    }
  }

  if (!ready) {
    return (
      <TrayShell>
        <p className="text-sm text-muted-foreground">{error ?? t("common.loading")}</p>
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
            {pane === "dashboard" ? (
              <p className="truncate text-[10px] text-muted-foreground">{t("tray.subtitle")}</p>
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
        <TraySettings />
      ) : (
        <>
          <div className="flex items-center justify-end">
            <Button
              type="button"
              size="xs"
              variant={editingLayout ? "default" : "ghost"}
              className="h-5 px-1.5 text-[10px]"
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
            <>
              <p className="rounded-md border border-dashed border-foreground/20 bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
                {t("layout.editHint")}
              </p>
              {shown.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">{t("tray.empty")}</p>
              ) : (
                <WidgetGrid columns={2} editing>
                  {shown.map((tile) => (
                    <WidgetTile
                      key={tile.id}
                      tile={tile}
                      columns={2}
                      editing
                      onReorder={reorder}
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
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <p className="text-[11px] leading-snug text-muted-foreground">
                {formatAdvisorLine(t, tightest, switchAdvice, pools) ?? t("tray.empty")}
              </p>

              {dashboardPools.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">{t("tray.empty")}</p>
              ) : (
                <div className="space-y-1.5">
                  {dashboardPools.map((pool) => (
                    <TrayPoolRow
                      key={pool.id}
                      pool={pool}
                      records={liveRecords.filter((record) => record.pool_id === pool.id)}
                      advice={advices.find((item) => item.poolId === pool.id)}
                      expanded={expandedPoolId === pool.id}
                      warnPercent={thresholds.warn}
                      critPercent={thresholds.crit}
                      onToggle={(id) => setExpandedPoolId((current) => toggleExpandedPoolId(current, id))}
                    />
                  ))}
                </div>
              )}

              {showHeatmap ? (
                <div className="max-h-24 min-h-0 overflow-hidden">
                  <ActivityHeatmap records={liveRecords} pools={pools} weeks={8} compact />
                </div>
              ) : null}

              <div className="space-y-0.5 text-[10px] leading-snug text-muted-foreground">
                <p>
                  {t("live.lastSyncedCursor")}:{" "}
                  {providerSync.cursor.configured
                    ? providerSync.cursor.lastSyncedAt
                      ? formatDateTime(providerSync.cursor.lastSyncedAt, i18n.language)
                      : t("live.lastSyncedNever")
                    : t("live.notConnected")}
                  {providerSync.cursor.expired || providerSync.cursor.message
                    ? ` — ${providerSync.cursor.expired ? t("live.expired") : providerSync.cursor.message}`
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
                {syncFlash ? <p>{syncFlash}</p> : null}
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-muted-foreground">{t("tray.hideHint")}</p>
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
        showActions={false}
        showRecent={false}
        showAdvice={false}
      />
    );
  }
}

function TrayShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-svh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 dark:bg-[radial-gradient(circle_at_top,_oklch(0.32_0.08_300/_0.40),_transparent_55%)]" />
      <div className="relative flex h-full flex-col gap-2 overflow-y-auto px-2.5 py-2.5">{children}</div>
    </div>
  );
}
