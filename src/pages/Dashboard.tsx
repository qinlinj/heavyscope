import { Plus, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { ChartsPanel } from "@/components/ChartsPanel";
import { PoolCard } from "@/components/PoolCard";
import { PoolFormDialog } from "@/components/PoolFormDialog";
import { UsageDialog } from "@/components/UsageDialog";
import { Button } from "@/components/ui/button";
import type { Pool, PoolDraft } from "@/db/schema";
import { advisePool, crossPoolAdvice, tightestAdvice } from "@/lib/burnRate";
import { useDatabase } from "@/hooks/useDatabase";

export function Dashboard() {
  const { t } = useTranslation();
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
  } = useDatabase();
  const [formOpen, setFormOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [editing, setEditing] = useState<Pool | null>(null);

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

  if (!ready) {
    return <p className="text-sm text-muted-foreground">{error ?? t("common.loading")}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="border-b border-foreground/10 pb-2 sm:border-0 sm:pb-0">
          <h2 className="font-heading text-xl font-semibold">{t("dashboard.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex gap-2">
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
              onEdit={(next) => {
                setEditing(next);
                setFormOpen(true);
              }}
              onDelete={(next) => {
                if (window.confirm(t("form.confirmDelete"))) deletePool(next.id);
              }}
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
    </div>
  );
}
