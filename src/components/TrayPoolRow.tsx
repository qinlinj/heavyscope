import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Pool, UsageRecord } from "@/db/schema";
import { type PoolAdvice, riskTone } from "@/lib/burnRate";
import {
  formatAmount,
  formatCountdown,
  formatSignedAmount,
  otherUsdView,
  usagePercent,
  usageTone,
} from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";
import { shouldShowTraySettingsCta, trayExpandFacts } from "@/lib/trayView";
import { cn } from "@/lib/utils";

type Props = {
  pool: Pool;
  records: UsageRecord[];
  advice?: PoolAdvice;
  expanded: boolean;
  highlighted?: boolean;
  unsynced?: boolean;
  warnPercent?: number;
  critPercent?: number;
  onToggle: (poolId: string) => void;
  onOpenSettings?: () => void;
};

export function TrayPoolRow({
  pool,
  records,
  advice,
  expanded,
  highlighted = false,
  unsynced = false,
  warnPercent,
  critPercent,
  onToggle,
  onOpenSettings,
}: Props) {
  const { t, i18n } = useTranslation();
  const facts = trayExpandFacts(pool, records, 2);
  const percent = usagePercent(pool);
  const tone = usageTone(percent, warnPercent, critPercent);
  const showCta = shouldShowTraySettingsCta(unsynced);
  const usd = otherUsdView(pool);
  const sourceLabel = pool.id === "preset-cursor-other" ? t("pool.sourceCursorPeriod") : null;

  return (
    <div className="w-full border-b border-foreground/10 px-0 py-1.5 text-left last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? t("tray.collapsePool") : t("tray.expandPool")}
        onClick={() => onToggle(pool.id)}
        className="w-full text-left outline-none transition-colors hover:bg-transparent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: pool.color }} />
            <span className="truncate text-[11px] font-medium">{displayPoolName(pool, t)}</span>
            {highlighted ? (
              <span className="shrink-0 text-[10px] font-normal text-muted-foreground">{t("tray.tightest")}</span>
            ) : null}
          </span>
          <span
            className={cn(
              "shrink-0 text-[11px] font-semibold tabular-nums",
              unsynced && "text-muted-foreground",
              !unsynced && tone === "ok" && "text-emerald-600 dark:text-emerald-400",
              !unsynced && tone === "warn" && "text-amber-600 dark:text-amber-400",
              !unsynced && tone === "crit" && "text-red-600 dark:text-red-400",
            )}
          >
            {unsynced ? t("pool.awaitingConnect") : `${percent.toFixed(0)}%`}
          </span>
        </div>
        {unsynced ? null : (
          <>
            <Progress
              value={percent}
              indicatorColor={pool.color}
              className="mt-1 h-1 w-full rounded-[2px] bg-foreground/10"
            />
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-[14px] font-normal text-muted-foreground">
              <span className="min-w-0 truncate">
                {usd
                  ? `${usd.dollarLine}${sourceLabel ? ` · ${sourceLabel}` : ""}`
                  : `${t("pool.remaining")} ${formatAmount(facts.remaining, facts.unit)}`}
              </span>
              <span className="shrink-0 tabular-nums">{formatCountdown(facts.resetAt, i18n.language)}</span>
            </div>
          </>
        )}
      </button>

      {showCta && onOpenSettings ? (
        <div className="mt-1">
          <Button type="button" size="xs" variant="ghost" className="h-6 px-1.5 hover:bg-transparent" onClick={onOpenSettings}>
            {t("tray.goToSettings")}
          </Button>
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-1.5 space-y-1 border-t border-foreground/10 pt-1.5 text-[10px] leading-[14px]">
          <p className="tabular-nums text-foreground">
            {unsynced
              ? t("pool.awaitingConnect")
              : usd
                ? usd.dollarLine
                : `${formatAmount(facts.used, facts.unit)} / ${formatAmount(facts.total, facts.unit)}`}
          </p>
          {sourceLabel && !unsynced ? <p className="text-muted-foreground">{sourceLabel}</p> : null}
          {unsynced ? null : (
            <>
              <p className="text-muted-foreground">
                {t("pool.remaining")}{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {usd ? usd.remainingLine : formatAmount(facts.remaining, facts.unit)}
                </span>
              </p>
              <p className="text-muted-foreground">
                {t("pool.reset")}{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {formatCountdown(facts.resetAt, i18n.language)}
                </span>
              </p>
            </>
          )}
          {advice && !unsynced ? (
            <p className="text-muted-foreground">
              {t("advisor.recommendedDaily")}:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatAmount(advice.recommendedDaily, pool.unit)}
              </span>
              {" · "}
              <span
                className={cn(
                  "font-medium",
                  riskTone(advice.risk) === "ok" && "text-emerald-700 dark:text-emerald-300",
                  riskTone(advice.risk) === "warn" && "text-amber-700 dark:text-amber-300",
                  riskTone(advice.risk) === "crit" && "text-red-600 dark:text-red-300",
                )}
              >
                {advice.risk === "overspend"
                  ? t("advisor.riskOverspend")
                  : advice.risk === "waste"
                    ? t("advisor.riskWaste")
                    : advice.risk === "unconnected"
                      ? t("pool.awaitingConnect")
                      : t("advisor.riskOk")}
              </span>
            </p>
          ) : null}
          {facts.increments.length > 0 ? (
            <ul className="space-y-0.5">
              {facts.increments.map((row) => (
                <li key={row.id} className="flex justify-between gap-2 text-muted-foreground">
                  <span>{new Date(row.recorded_at).toLocaleString(i18n.language, { month: "short", day: "numeric" })}</span>
                  <span className="tabular-nums text-foreground">
                    {formatSignedAmount(row.amount, pool.unit)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t("pool.recentEmpty")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
