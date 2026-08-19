import { Plus, RefreshCw, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { ChartsPanel } from "@/components/ChartsPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PoolCard, type PoolSyncMeta } from "@/components/PoolCard";
import { PoolFormDialog } from "@/components/PoolFormDialog";
import { UsageDialog } from "@/components/UsageDialog";
import { Button } from "@/components/ui/button";
import type { Pool, PoolDraft, UsageRecord } from "@/db/schema";
import { advisePool, crossPoolAdvice, tightestAdvice } from "@/lib/burnRate";
import { useDatabase } from "@/hooks/useDatabase";
import { formatDateTime } from "@/lib/format";
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
    createPool,
    updatePool,
    deletePool,
    addUsage,
    thresholds,
    settings,
    refreshLiveProviders,
  } = useDatabase();
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

  function handleSubmit(draft: PoolDraft) {
    if (editing) updatePool(editing.id, draft);
    else createPool(draft);
    setEditing(null);
  }

  const cursorConfigured = Boolean(settings[SETTING_CURSOR_SESSION_TOKEN]?.trim());
  const grokConfigured = Boolean(
    settings[SETTING_GROK_SESSION_TOKEN]?.trim() || settings[SETTING_GROK_BEARER_TOKEN]?.trim(),
  );
  const lastSyncAt = [settings[SETTING_CURSOR_LAST_SYNCED_AT], settings[SETTING_GROK_LAST_SYNCED_AT]]
    .filter(Boolean)
    .sort()
    .at(-1);

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
        <div className="flex gap-2">
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

      <AdvisorPanel
        pools={pools}
        advices={advices}
        tightest={tightest}
        switchAdvice={switchAdvice}
        warnPercent={thresholds.warn}
        critPercent={thresholds.crit}
      />

      {pools.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              records={records.filter((record) => record.pool_id === pool.id)}
              advice={advices.find((item) => item.poolId === pool.id)}
              warnPercent={thresholds.warn}
              critPercent={thresholds.crit}
              syncMeta={syncMetaFor(
                pool,
                records.filter((record) => record.pool_id === pool.id),
              )}
              onEdit={(next) => {
                setEditing(next);
                setFormOpen(true);
              }}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <ChartsPanel pools={pools} records={records} />

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
}
