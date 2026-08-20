import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDatabase } from "@/hooks/useDatabase";
import { filterRecords } from "@/lib/charts";
import { formatAmount, formatDateTime } from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";
import type { HistorySourceFilter } from "@/lib/usageSource";

const SOURCES: HistorySourceFilter[] = ["live", "manual", "import", "sync", "demo"];

export function History() {
  const { t, i18n } = useTranslation();
  const { ready, error, pools, records } = useDatabase();
  const [poolId, setPoolId] = useState("all");
  const [source, setSource] = useState<HistorySourceFilter>("live");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      filterRecords(records, {
        poolId,
        source,
        from: from || undefined,
        to: to || undefined,
      }),
    [records, poolId, source, from, to],
  );

  const poolName = useMemo(() => {
    const map = new Map(pools.map((pool) => [pool.id, pool]));
    return (id: string) => map.get(id);
  }, [pools]);

  if (!ready) {
    return <p className="text-sm text-muted-foreground">{error ?? t("common.loading")}</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-semibold">{t("history.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("history.subtitle")}</p>
      </div>

      <div className="grid gap-3 rounded-xl bg-card/80 p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-5">
        <FilterField label={t("history.pool")}>
          <Select value={poolId} onValueChange={setPoolId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("history.allPools")}</SelectItem>
              {pools.map((pool) => (
                <SelectItem key={pool.id} value={pool.id}>
                  {displayPoolName(pool, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t("history.source")}>
          <Select value={source} onValueChange={(value) => setSource(value as HistorySourceFilter)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`history.sources.${item}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t("history.from")}>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </FilterField>
        <FilterField label={t("history.to")}>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </FilterField>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setPoolId("all");
              setSource("live");
              setFrom("");
              setTo("");
            }}
          >
            {t("history.clearFilters")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">
          {t("history.dateHint")}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("history.count", { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-card/80 px-4 py-6 text-sm text-muted-foreground ring-1 ring-foreground/10">
          {t("history.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card/90 ring-1 ring-foreground/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-foreground/10 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("history.time")}</th>
                <th className="px-4 py-3 font-medium">{t("history.pool")}</th>
                <th className="px-4 py-3 font-medium">{t("history.amount")}</th>
                <th className="px-4 py-3 font-medium">{t("history.source")}</th>
                <th className="px-4 py-3 font-medium">{t("history.note")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => {
                const pool = poolName(record.pool_id);
                return (
                  <tr key={record.id} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(record.recorded_at, i18n.language)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: pool?.color ?? "#94a3b8" }}
                        />
                        {pool ? displayPoolName(pool, t) : record.pool_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {pool ? formatAmount(record.amount, pool.unit) : record.amount}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t(`history.sources.${record.source}`)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                      {record.note || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
