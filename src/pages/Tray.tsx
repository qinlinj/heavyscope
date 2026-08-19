import { Check, Gauge, Pencil } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AddCardsStrip } from "@/components/AddCardsStrip";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { ChartsPanel } from "@/components/ChartsPanel";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PoolCard } from "@/components/PoolCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WidgetGrid } from "@/components/WidgetGrid";
import { WidgetTile } from "@/components/WidgetTile";
import { Button } from "@/components/ui/button";
import { advisePool, crossPoolAdvice, tightestAdvice } from "@/lib/burnRate";
import { hiddenTiles, visibleTiles, type LayoutTile } from "@/lib/dashboardLayout";
import { displayPoolName } from "@/lib/poolName";
import { useDatabase } from "@/hooks/useDatabase";
import { useWidgetLayout } from "@/hooks/useWidgetLayout";

export function TrayPage() {
  const { t } = useTranslation();
  const { ready, error, pools, records, settings, setSetting, thresholds } = useDatabase();
  const poolIds = useMemo(() => pools.map((pool) => pool.id), [pools]);
  const { layout, reorder, setSize, hide, show } = useWidgetLayout(settings, poolIds, setSetting, "tray");
  const shown = useMemo(() => visibleTiles(layout), [layout]);
  const hidden = useMemo(() => hiddenTiles(layout), [layout]);
  const [editingLayout, setEditingLayout] = useState(false);

  const advices = useMemo(
    () => pools.map((pool) => advisePool(pool, records)),
    [pools, records],
  );
  const tightest = useMemo(() => tightestAdvice(advices), [advices]);
  const switchAdvice = useMemo(() => crossPoolAdvice(advices), [advices]);

  function tileLabel(tile: LayoutTile): string {
    if (tile.type === "pool") {
      const pool = pools.find((item) => item.id === tile.poolId);
      return pool ? displayPoolName(pool, t) : tile.poolId ?? tile.id;
    }
    return t(`charts.module.${tile.type}`);
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
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Gauge className="size-3.5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading truncate text-sm font-semibold tracking-tight">{t("app.name")}</h1>
            <p className="truncate text-[10px] text-muted-foreground">{t("tray.subtitle")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="xs"
            variant={editingLayout ? "default" : "outline"}
            onClick={() => setEditingLayout((current) => !current)}
          >
            {editingLayout ? <Check data-icon="inline-start" /> : <Pencil data-icon="inline-start" />}
            {editingLayout ? t("layout.done") : t("layout.edit")}
          </Button>
          <ThemeToggle compact />
          <LanguageToggle compact />
        </div>
      </header>

      {editingLayout ? (
        <p className="rounded-md border border-dashed border-foreground/20 bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
          {t("layout.editHint")}
        </p>
      ) : null}

      {shown.length === 0 && !editingLayout ? (
        <p className="text-[11px] text-muted-foreground">{t("tray.empty")}</p>
      ) : (
        <WidgetGrid columns={2} editing={editingLayout}>
          {shown.map((tile) => (
            <WidgetTile
              key={tile.id}
              tile={tile}
              columns={2}
              editing={editingLayout}
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
              ) : tile.type === "heatmap" || tile.type === "trend" ? (
                <ChartsPanel
                  pools={pools}
                  records={records}
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

      {editingLayout ? <AddCardsStrip tiles={hidden} labelFor={tileLabel} onRestore={show} /> : null}

      <p className="text-[10px] text-muted-foreground">{t("tray.hideHint")}</p>
    </TrayShell>
  );

  function renderPool(tile: LayoutTile) {
    const pool = pools.find((item) => item.id === tile.poolId);
    if (!pool) return null;
    return (
      <PoolCard
        pool={pool}
        records={records.filter((record) => record.pool_id === pool.id)}
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
      <div className="pointer-events-none fixed inset-0 dark:bg-[radial-gradient(circle_at_top,_oklch(0.28_0.04_250/_0.45),_transparent_55%)]" />
      <div className="relative flex h-full flex-col gap-2 overflow-y-auto px-2.5 py-2.5">{children}</div>
    </div>
  );
}
