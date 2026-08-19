import { Gauge } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Progress } from "@/components/ui/progress";
import { advisePool, crossPoolAdvice, riskTone, tightestAdvices } from "@/lib/burnRate";
import { periodTotal, type ChartScale } from "@/lib/charts";
import { formatAmount, formatCountdown, remaining, usagePercent, usageTone } from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";
import { useDatabase } from "@/hooks/useDatabase";
import { cn } from "@/lib/utils";
import type { Pool, UsageRecord } from "@/db/schema";
import type { PoolAdvice } from "@/lib/burnRate";

const TRAY_SCALES: ChartScale[] = ["day", "week", "month"];

export function TrayPage() {
  const { t } = useTranslation();
  const { ready, error, pools, records, thresholds } = useDatabase();

  const advices = useMemo(
    () => pools.map((pool) => advisePool(pool, records)),
    [pools, records],
  );
  const top = useMemo(() => tightestAdvices(advices, 2), [advices]);
  const switchAdvice = useMemo(() => crossPoolAdvice(advices), [advices]);
  const tightest = top[0] ?? null;
  const tightestPool = tightest ? pools.find((pool) => pool.id === tightest.poolId) : undefined;

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
            <h1 className="font-heading truncate text-sm font-semibold tracking-tight">
              {t("app.name")}
            </h1>
            <p className="truncate text-[10px] text-muted-foreground">{t("tray.subtitle")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle compact />
          <LanguageToggle compact />
        </div>
      </header>

      {tightest && tightestPool ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {advisorLine(t, tightest, tightestPool, switchAdvice, pools)}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">{t("tray.empty")}</p>
      )}

      {top.length > 0 && (
        <ul className="space-y-1.5">
          {top.map((advice) => {
            const pool = pools.find((item) => item.id === advice.poolId);
            if (!pool) return null;
            return (
              <li key={pool.id}>
                <CompactPool
                  pool={pool}
                  advice={advice}
                  records={records}
                  warn={thresholds.warn}
                  crit={thresholds.crit}
                />
              </li>
            );
          })}
        </ul>
      )}

      {records.length > 0 && (
        <section className="rounded-lg bg-card/90 px-2 py-1.5 ring-1 ring-foreground/10">
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">{t("charts.heatmap")}</p>
          <ActivityHeatmap records={records} weeks={10} compact />
        </section>
      )}

      <p className="text-[10px] text-muted-foreground">{t("tray.hideHint")}</p>
    </TrayShell>
  );
}

function TrayShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-svh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 dark:bg-[radial-gradient(circle_at_top,_oklch(0.28_0.04_250/_0.45),_transparent_55%)]" />
      <div className="relative flex h-full flex-col gap-2 overflow-y-auto px-2.5 py-2.5">{children}</div>
    </div>
  );
}

function CompactPool({
  pool,
  advice,
  records,
  warn,
  crit,
}: {
  pool: Pool;
  advice: PoolAdvice;
  records: UsageRecord[];
  warn: number;
  crit: number;
}) {
  const { t, i18n } = useTranslation();
  const percent = usagePercent(pool);
  const tone = usageTone(percent, warn, crit);
  const left = remaining(pool);
  const now = useMemo(() => new Date(), []);
  const periods = useMemo(
    () => ({
      day: periodTotal(records, "day", pool.id, now),
      week: periodTotal(records, "week", pool.id, now),
      month: periodTotal(records, "month", pool.id, now),
    }),
    [now, pool.id, records],
  );

  return (
    <article className="rounded-lg bg-card/90 px-2.5 py-2 ring-1 ring-foreground/10 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: pool.color }} />
          <span className="truncate text-[13px] font-medium">{displayPoolName(pool, t)}</span>
        </div>
        <span
          className={cn(
            "shrink-0 text-[13px] font-semibold tabular-nums",
            tone === "ok" && "text-emerald-600 dark:text-emerald-400",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
            tone === "crit" && "text-red-600 dark:text-red-400",
          )}
        >
          {percent.toFixed(0)}%
        </span>
      </div>
      <Progress
        value={percent}
        className={cn(
          "mt-1.5 h-1.5",
          tone === "ok" && "[&_[data-slot=progress-indicator]]:bg-emerald-500",
          tone === "warn" && "[&_[data-slot=progress-indicator]]:bg-amber-500",
          tone === "crit" && "[&_[data-slot=progress-indicator]]:bg-red-500",
        )}
      />
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
        {TRAY_SCALES.map((scale) => (
          <div key={scale} className="min-w-0">
            <p className="truncate">{t(`charts.scale.${scale}`)}</p>
            <p className="truncate font-medium text-foreground tabular-nums">
              {formatAmount(periods[scale], pool.unit)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          {t("pool.remaining")}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatAmount(left, pool.unit)}
          </span>
        </span>
        <span className="tabular-nums">{formatCountdown(pool.reset_at, i18n.language)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          {t("advisor.todaySafe")}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatAmount(advice.todaySafeRemaining, pool.unit)}
          </span>
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 font-medium",
            riskTone(advice.risk) === "ok" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
            riskTone(advice.risk) === "warn" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
            riskTone(advice.risk) === "crit" && "bg-red-500/15 text-red-700 dark:text-red-300",
          )}
        >
          {advice.risk === "overspend"
            ? t("advisor.riskOverspend")
            : advice.risk === "waste"
              ? t("advisor.riskWaste")
              : t("advisor.riskOk")}
        </span>
      </div>
    </article>
  );
}

function advisorLine(
  t: (key: string, opts?: Record<string, string | number>) => string,
  tightest: PoolAdvice,
  pool: Pool,
  switchAdvice: ReturnType<typeof crossPoolAdvice>,
  pools: Pool[],
): string {
  const name = displayPoolName(pool, t);
  const percent = Math.round(tightest.usagePercent);
  if (switchAdvice) {
    const from = pools.find((item) => item.id === switchAdvice.fromPoolId);
    const to = pools.find((item) => item.id === switchAdvice.toPoolId);
    if (from && to) {
      return t("advisor.switchSuggestion", {
        from: displayPoolName(from, t),
        to: displayPoolName(to, t),
      });
    }
  }
  if (tightest.risk === "overspend") {
    return t("tray.lineOverspend", { pool: name, percent });
  }
  if (tightest.risk === "waste") {
    return t("tray.lineWaste", { pool: name, percent });
  }
  return t("tray.lineOnPace", { pool: name, percent });
}
