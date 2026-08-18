import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Pool, UsageRecord } from "@/db/schema";
import { riskTone, type PoolAdvice } from "@/lib/burnRate";
import {
  formatAmount,
  formatCountdown,
  remaining,
  usagePercent,
  usageTone,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  pool: Pool;
  records: UsageRecord[];
  advice?: PoolAdvice;
  onEdit: (pool: Pool) => void;
  onDelete: (pool: Pool) => void;
};

export function PoolCard({ pool, records, advice, onEdit, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const percent = usagePercent(pool);
  const tone = usageTone(percent);
  const left = remaining(pool);

  return (
    <Card className="bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 pr-16">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: pool.color }}
          />
          {pool.name}
        </CardTitle>
        <CardDescription>
          {pool.is_preset ? t("pool.preset") : t("pool.custom")} · {pool.unit}
        </CardDescription>
        <CardAction className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(pool)}>
            <Pencil />
            <span className="sr-only">{t("pool.edit")}</span>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(pool)}>
            <Trash2 />
            <span className="sr-only">{t("pool.delete")}</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("pool.used")}</p>
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {formatAmount(pool.quota_used, pool.unit)}
            </p>
          </div>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              tone === "ok" && "text-emerald-400",
              tone === "warn" && "text-amber-400",
              tone === "crit" && "text-red-400",
            )}
          >
            {percent.toFixed(0)}%
          </p>
        </div>
        <Progress
          value={percent}
          className={cn(
            "h-2",
            tone === "ok" && "[&_[data-slot=progress-indicator]]:bg-emerald-400",
            tone === "warn" && "[&_[data-slot=progress-indicator]]:bg-amber-400",
            tone === "crit" && "[&_[data-slot=progress-indicator]]:bg-red-400",
          )}
        />
        <div className="grid grid-cols-3 gap-3 text-xs">
          <Stat label={t("pool.remaining")} value={formatAmount(left, pool.unit)} />
          <Stat label={t("pool.total")} value={formatAmount(pool.quota_total, pool.unit)} />
          <Stat
            label={t("pool.reset")}
            value={formatCountdown(pool.reset_at, i18n.language)}
          />
        </div>
        {advice && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
            <span className="text-muted-foreground">
              {t("advisor.recommendedDaily")}:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatAmount(advice.recommendedDaily, pool.unit)}
              </span>
            </span>
            <span className="text-muted-foreground">
              {t("advisor.todayUsed")}:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatAmount(advice.todayUsedAmount, pool.unit)}
              </span>
            </span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-medium",
                riskTone(advice.risk) === "ok" && "bg-emerald-400/15 text-emerald-300",
                riskTone(advice.risk) === "warn" && "bg-amber-400/15 text-amber-300",
                riskTone(advice.risk) === "crit" && "bg-red-400/15 text-red-300",
              )}
            >
              {advice.risk === "overspend"
                ? t("advisor.riskOverspend")
                : advice.risk === "waste"
                  ? t("advisor.riskWaste")
                  : t("advisor.riskOk")}
            </span>
          </div>
        )}
      </CardContent>
      {records.length > 0 && (
        <CardFooter className="flex-col items-stretch gap-2">
          <p className="text-xs text-muted-foreground">{t("pool.recent")}</p>
          <ul className="space-y-1">
            {records.slice(0, 3).map((record) => (
              <li key={record.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {new Date(record.recorded_at).toLocaleString(i18n.language)}
                </span>
                <span className="tabular-nums">
                  {record.amount > 0 ? "+" : ""}
                  {record.amount} {pool.unit}
                </span>
              </li>
            ))}
          </ul>
        </CardFooter>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
