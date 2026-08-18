import { Plus, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { PoolCard } from "@/components/PoolCard";
import { PoolFormDialog } from "@/components/PoolFormDialog";
import { UsageDialog } from "@/components/UsageDialog";
import { Button } from "@/components/ui/button";
import type { Pool, PoolDraft } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { useDatabase } from "@/hooks/useDatabase";

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
  } = useDatabase();
  const [formOpen, setFormOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [editing, setEditing] = useState<Pool | null>(null);

  const chartData = useMemo(
    () =>
      [...records]
        .reverse()
        .slice(-12)
        .map((record) => ({
          time: formatDateTime(record.recorded_at, i18n.language),
          amount: record.amount,
        })),
    [records, i18n.language],
  );

  function handleSubmit(draft: PoolDraft) {
    if (editing) updatePool(editing.id, draft);
    else createPool(draft);
    setEditing(null);
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">{error ?? t("common.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{t("dashboard.title")}</h2>
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

      {chartData.length > 0 && (
        <div className="h-36 rounded-xl bg-card/80 p-4 ring-1 ring-foreground/10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <XAxis dataKey="time" hide />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.205 0 0)",
                  border: "1px solid oklch(1 0 0 / 10%)",
                  borderRadius: 8,
                  color: "oklch(0.985 0 0)",
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#38bdf8"
                fill="#38bdf8"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {pools.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              records={records.filter((record) => record.pool_id === pool.id)}
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
