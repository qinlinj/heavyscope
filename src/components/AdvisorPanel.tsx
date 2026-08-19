import { ArrowRightLeft, Gauge } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Pool } from "@/db/schema";
import { formatAmount, usageTone } from "@/lib/format";
import { formatAdvisorLine } from "@/lib/advisorLine";
import { displayPoolName } from "@/lib/poolName";
import {
  type CrossPoolAdvice,
  type PoolAdvice,
  type RiskLevel,
  riskTone,
} from "@/lib/burnRate";
import { cn } from "@/lib/utils";

type Props = {
  pools: Pool[];
  advices: PoolAdvice[];
  tightest: PoolAdvice | null;
  switchAdvice: CrossPoolAdvice | null;
  warnPercent?: number;
  critPercent?: number;
  compact?: boolean;
};

export function AdvisorPanel({
  pools,
  advices,
  tightest,
  switchAdvice,
  warnPercent,
  critPercent,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const pool = tightest ? pools.find((item) => item.id === tightest.poolId) : undefined;
  const line = formatAdvisorLine(t, tightest, switchAdvice, pools);

  if (compact) {
    return (
      <Card size="sm" className="h-full bg-card/90 backdrop-blur">
        <CardContent className="py-1">
          <p className="text-[11px] leading-snug text-muted-foreground">{line ?? t("dashboard.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  if (!tightest || !pool || pools.length === 0) {
    return (
      <Card className="h-full bg-card/90 ring-1 ring-foreground/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="size-4" />
            {t("advisor.title")}
          </CardTitle>
          <CardDescription>{t("advisor.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  const fromPool = switchAdvice
    ? pools.find((item) => item.id === switchAdvice.fromPoolId)
    : undefined;
  const toPool = switchAdvice
    ? pools.find((item) => item.id === switchAdvice.toPoolId)
    : undefined;

  return (
    <div className="flex h-full flex-col gap-2.5">
      <Card className="bg-card/90 ring-1 ring-foreground/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="size-4" />
            {t("advisor.tightest")}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: pool.color }} />
              {displayPoolName(pool, t)}
            </span>
            <RiskBadge level={tightest.risk} />
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          <Metric
            label={t("pool.percent")}
            value={`${tightest.usagePercent.toFixed(0)}%`}
            tone={usageTone(tightest.usagePercent, warnPercent, critPercent)}
          />
          <Metric
            label={t("advisor.recommendedDaily")}
            value={formatAmount(tightest.recommendedDaily, pool.unit)}
            tone={riskTone(tightest.risk)}
          />
          <Metric
            label={t("advisor.todayUsed")}
            value={formatAmount(tightest.todayUsedAmount, pool.unit)}
          />
          <Metric
            label={t("advisor.todaySafe")}
            value={formatAmount(tightest.todaySafeRemaining, pool.unit)}
            tone={tightest.todaySafeRemaining <= 0 && tightest.recommendedDaily > 0 ? "crit" : "ok"}
          />
          <Metric
            label={t("advisor.averageDaily")}
            value={`${formatAmount(tightest.averageDaily, pool.unit)} ${t("advisor.vsRecommended")}`}
            tone={
              tightest.averageDaily > tightest.recommendedDaily * 1.05
                ? "crit"
                : tightest.risk === "waste"
                  ? "warn"
                  : "ok"
            }
          />
          <Metric
            label={t("advisor.daysLeft")}
            value={
              pool.reset_at
                ? t("advisor.daysLeftValue", { days: tightest.daysLeft.toFixed(1) })
                : t("advisor.noReset")
            }
          />
          <Metric
            label={t("advisor.projection")}
            value={formatAmount(tightest.projectionAtReset, pool.unit)}
            tone={tightest.projectionAtReset > pool.quota_total ? "crit" : "ok"}
          />
        </CardContent>
      </Card>

      {fromPool && toPool && (
        <Card className="border-amber-400/30 bg-amber-400/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <ArrowRightLeft className="size-4" />
              {t("advisor.switchTitle")}
            </CardTitle>
            <CardDescription>
              {t("advisor.switchSuggestion", {
                from: displayPoolName(fromPool, t),
                to: displayPoolName(toPool, t),
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {advices.length > 1 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {advices.map((item) => {
            const source = pools.find((poolItem) => poolItem.id === item.poolId);
            if (!source) return null;
            return (
              <li
                key={item.poolId}
                className="flex items-center justify-between gap-3 rounded-lg bg-card/70 px-3 py-2 text-xs ring-1 ring-foreground/10"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="truncate">{displayPoolName(source, t)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground">
                  {formatAmount(item.recommendedDaily, source.unit)}/{t("advisor.perDay")}
                  <RiskBadge level={item.risk} compact />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "crit";
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-medium tabular-nums",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "crit" && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RiskBadge({ level, compact = false }: { level: RiskLevel; compact?: boolean }) {
  const { t } = useTranslation();
  const tone = riskTone(level);
  const label =
    level === "overspend"
      ? t("advisor.riskOverspend")
      : level === "waste"
        ? t("advisor.riskWaste")
        : t("advisor.riskOk");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        tone === "ok" && "bg-emerald-400/15 text-emerald-700 dark:text-emerald-300",
        tone === "warn" && "bg-amber-400/15 text-amber-700 dark:text-amber-300",
        tone === "crit" && "bg-red-400/15 text-red-700 dark:text-red-300",
      )}
    >
      {label}
    </span>
  );
}
