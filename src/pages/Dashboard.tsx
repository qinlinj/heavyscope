import { Check, Pencil, Plus, RefreshCw, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AddCardsStrip } from "@/components/AddCardsStrip";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { ChartsPanel } from "@/components/ChartsPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PoolCard, type PoolSyncMeta } from "@/components/PoolCard";
import { PoolFormDialog } from "@/components/PoolFormDialog";
import { UsageDialog } from "@/components/UsageDialog";
import { WidgetGrid } from "@/components/WidgetGrid";
import { WidgetTile } from "@/components/WidgetTile";
import { Button } from "@/components/ui/button";
import type { Pool, PoolDraft, UsageRecord } from "@/db/schema";
import { advisePool, crossPoolAdvice, tightestAdvice } from "@/lib/burnRate";
import { hiddenTiles, visibleTiles, type LayoutTile } from "@/lib/dashboardLayout";
import { useDatabase } from "@/hooks/useDatabase";
import { useWidgetLayout } from "@/hooks/useWidgetLayout";
import { formatDateTime } from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";
import {
  SETTING_CURSOR_CONNECTED,
  SETTING_CURSOR_LAST_SYNCED_AT,
  SETTING_CURSOR_SESSION_TOKEN,
  SETTING_CURSOR_SYNC_SOURCE,
  SETTING_GROK_BEARER_TOKEN,
  SETTING_GROK_BOT_LIVE,
  SETTING_GROK_CONNECTED,
  SETTING_GROK_LAST_SYNCED_AT,
  SETTING_GROK_SESSION_TOKEN,
  SETTING_GROK_SYNC_SOURCE,
  type PoolSyncBadge,
} from "@/lib/settings";

function badgeFrom(
  liveSource: string | undefined,
  records: UsageRecord[],
  configured: boolean,
): PoolSyncBadge {
  if (liveSource === "api" || liveSource === "session" || liveSource === "error") {
    if (configured) return liveSource;
  }
  const latest = records[0]?.source;
  if (latest === "manual" || latest === "import") return latest;
  if (latest === "sync") return configured ? "api" : "import";
  return configured ? "error" : "manual";
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const {
    ready,
    error,
    pools,
    records,
    settings,
    setSetting,
    createPool,
    updatePool,
    deletePool,
    addUsage,
    thresholds,
    refreshLiveProviders,
  } = useDatabase();
  const poolIds = useMemo(() => pools.map((pool) => pool.id), [pools]);
  const { layout, reorder, setSize, hide, show } = useWidgetLayout(
    settings,
    poolIds,
    setSetting,
    "dashboard",
  );
  const shown = useMemo(() => visibleTiles(layout), [layout]);
  const hidden = useMemo(() => hiddenTiles(layout), [layout]);
  const [editingLayout, setEditingLayout] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [editing, setEditing] = useState<Pool | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Pool | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncFlash, setSyncFlash] = useState<string | null>(null);

  const advices = useMemo(
    () => pools.map((pool) => advisePool(pool, records)),
    [pools, records],
  );
  const tightest = useMemo(() => tightestAdvice(advices), [advices]);
  const switchAdvice = useMemo(() => crossPoolAdvice(advices), [advices]);

  const cursorConfigured = Boolean(settings[SETTING_CURSOR_SESSION_TOKEN]?.trim());
  const grokConfigured = Boolean(
    settings[SETTING_GROK_SESSION_TOKEN]?.trim() || settings[SETTING_GROK_BEARER_TOKEN]?.trim(),
  );
  const lastSyncAt = [settings[SETTING_CURSOR_LAST_SYNCED_AT], settings[SETTING_GROK_LAST_SYNCED_AT]]
    .filter(Boolean)
    .sort()
    .at(-1);

  function handleSubmit(draft: PoolDraft) {
    if (editing) updatePool(editing.id, draft);
    else createPool(draft);
    setEditing(null);
  }

  function syncMetaFor(pool: Pool, poolRecords: UsageRecord[]): PoolSyncMeta {
    if (pool.id === "preset-cursor-models" || pool.id === "preset-cursor-other") {
      const source = badgeFrom(settings[SETTING_CURSOR_SYNC_SOURCE], poolRecords, cursorConfigured);
      return {
        connected: settings[SETTING_CURSOR_CONNECTED] === "true" && cursorConfigured,
        source,
        lastSyncedAt: settings[SETTING_CURSOR_LAST_SYNCED_AT],
      };
    }
    if (pool.id === "preset-grok-heavy" || pool.id === "preset-grok-bot") {
      const source = badgeFrom(settings[SETTING_GROK_SYNC_SOURCE], poolRecords, grokConfigured);
      return {
        connected: settings[SETTING_GROK_CONNECTED] === "true" && grokConfigured,
        source,
        lastSyncedAt: settings[SETTING_GROK_LAST_SYNCED_AT],
        botUnavailable: pool.id === "preset-grok-bot" && settings[SETTING_GROK_BOT_LIVE] === "unavailable",
      };
    }
    return {
      connected: false,
      source: badgeFrom(undefined, poolRecords, false),
    };
  }

  async function handleRefreshNow() {
    setSyncBusy(true);
    try {
      const report = await refreshLiveProviders();
      setSyncFlash(report.message);
    } finally {
      setSyncBusy(false);
    }
  }

  function tileLabel(tile: LayoutTile): string {
    if (tile.type === "pool") {
      const pool = pools.find((item) => item.id === tile.poolId);
      return pool ? displayPoolName(pool, t) : tile.poolId ?? tile.id;
    }
    return t(`charts.module.${tile.type}`);
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">{error ?? t("common.loading")}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="border-b border-foreground/10 pb-2 sm:border-0 sm:pb-0">
          <h2 className="font-heading text-xl font-semibold">{t("dashboard.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("live.lastSynced")}:{" "}
            {lastSyncAt ? formatDateTime(lastSyncAt, i18n.language) : t("live.lastSyncedNever")}
            {syncFlash ? ` — ${syncFlash}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={editingLayout ? "default" : "outline"}
            onClick={() => setEditingLayout((current) => !current)}
          >
            {editingLayout ? <Check data-icon="inline-start" /> : <Pencil data-icon="inline-start" />}
            {editingLayout ? t("layout.done") : t("layout.edit")}
          </Button>
          <Button
            variant="outline"
            disabled={!ready || syncBusy || (!cursorConfigured && !grokConfigured)}
            onClick={() => void handleRefreshNow()}
          >
            <RefreshCw data-icon="inline-start" />
            {t("live.refreshNow")}
          </Button>
          <Button variant="outline" onClick={() => setUsageOpen(true)} disabled={pools.length === 0}>
            <ScrollText data-icon="inline-start" />
            {t("dashboard.recordUsage")}
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus data-icon="inline-start" />
            {t("dashboard.addPool")}
          </Button>
        </div>
      </div>

      {editingLayout ? (
        <p className="rounded-lg border border-dashed border-foreground/20 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t("layout.editHint")}
        </p>
      ) : null}

      {shown.length === 0 && !editingLayout ? (
        <p className="text-sm text-muted-foreground">{t("layout.allHidden")}</p>
      ) : (
        <WidgetGrid columns={4} editing={editingLayout}>
          {shown.map((tile) => (
            <WidgetTile
              key={tile.id}
              tile={tile}
              columns={4}
              editing={editingLayout}
              onReorder={reorder}
              onSize={setSize}
              onHide={hide}
            >
              {renderTile(tile)}
            </WidgetTile>
          ))}
        </WidgetGrid>
      )}

      {editingLayout ? (
        <AddCardsStrip tiles={hidden} labelFor={tileLabel} onRestore={show} />
      ) : null}

      <PoolFormDialog
        open={formOpen}
        pool={editing}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
      <UsageDialog
        open={usageOpen}
        pools={pools}
        onOpenChange={setUsageOpen}
        onSubmit={(poolId, amount, note) => addUsage(poolId, amount, note)}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("form.deleteTitle")}
        description={t("form.confirmDelete")}
        confirmLabel={t("pool.delete")}
        destructive
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) deletePool(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );

  function renderTile(tile: LayoutTile) {
    if (tile.type === "advisor") {
      return (
        <AdvisorPanel
          pools={pools}
          advices={advices}
          tightest={tightest}
          switchAdvice={switchAdvice}
          warnPercent={thresholds.warn}
          critPercent={thresholds.crit}
          compact={tile.size === "sm"}
        />
      );
    }
    if (tile.type === "heatmap" || tile.type === "trend") {
      return (
        <ChartsPanel
          pools={pools}
          records={records}
          modules={[tile.type]}
          showHeading={false}
          compact={tile.size === "sm"}
          size={tile.size}
        />
      );
    }
    const pool = pools.find((item) => item.id === tile.poolId);
    if (!pool) return null;
    const poolRecords = records.filter((record) => record.pool_id === pool.id);
    return (
      <PoolCard
        pool={pool}
        records={poolRecords}
        advice={advices.find((item) => item.poolId === pool.id)}
        warnPercent={thresholds.warn}
        critPercent={thresholds.crit}
        syncMeta={syncMetaFor(pool, poolRecords)}
        compact={tile.size === "sm"}
        showActions={editingLayout}
        showRecent={tile.size !== "sm"}
        showAdvice={tile.size !== "sm"}
        onEdit={(next) => {
          setEditing(next);
          setFormOpen(true);
        }}
        onDelete={setPendingDelete}
      />
    );
  }
}
