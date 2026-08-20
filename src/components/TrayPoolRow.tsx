import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import type { Pool, UsageRecord } from "@/db/schema";
import { type PoolAdvice, riskTone } from "@/lib/burnRate";
import {
  formatAmount,
  formatCountdown,
  usagePercent,
  usageTone,
} from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";
import { compactPoolView } from "@/lib/poolView";
import { recentPoolDeltas } from "@/lib/trayView";
import { cn } from "@/lib/utils";

type Props = {
  pool: Pool;
  records: UsageRecord[];
  advice?: PoolAdvice;
  expanded: boolean;
  warnPercent?: number;
  critPercent?: number;
  onToggle: (poolId: string) => void;
};

export function TrayPoolRow({
  pool,
  records,
  advice,
  expanded,
  warnPercent,
  critPercent,
  onToggle,
}: Props) {
  const { t, i18n } = useTranslation();
  const view = compactPoolView(pool);
  const percent = usagePercent(pool);
  const tone = usageTone(percent, warnPercent, critPercent);
  const deltas = recentPoolDeltas(records, 2);

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? t("tray.collapsePool") : t("tray.expandPool")}
      onClick={() => onToggle(pool.id)}
      className={cn(
        "w-full rounded-lg border border-foreground/10 bg-card/90 px-2.5 py-1.5 text-left backdrop-blur",
        "outline-none transition-colors hover:bg-card focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: pool.color }} />
          <span className="truncate text-[13px] font-medium">{displayPoolName(pool, t)}</span>
        </span>
        <span
          className={cn(
            "shrink-0 text-[13px] font-semibold tabular-nums",
            tone === "ok" && "text-emerald-600 dark:text-emerald-400",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
            tone === "crit" && "text-red-600 dark:text-red-400",
          )}
        >
          {view.percent.toFixed(0)}%
        </span>
      </div>
      <Progress
        value={view.percent}
        className={cn(
          "mt-1.5 h-1.5",
          tone === "ok" && "[&_[data-slot=progress-indicator]]:bg-emerald-500",
          tone === "warn" && "[&_[data-slot=progress-indicator]]:bg-amber-500",
          tone === "crit" && "[&_[data-slot=progress-indicator]]:bg-red-500",
        )}
      />
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] leading-tight text-muted-foreground">
        <span className="truncate">
          {t("pool.remaining")} {formatAmount(view.remaining, view.unit)}
        </span>
        <span className="shrink-0 tabular-nums">{formatCountdown(view.resetAt, i18n.language)}</span>
      </div>

      {expanded ? (
        <div className="mt-1.5 space-y-1 border-t border-foreground/10 pt-1.5 text-[11px]">
          <p className="tabular-nums text-foreground">
            {formatAmount(pool.quota_used, pool.unit)} / {formatAmount(pool.quota_total, pool.unit)}
          </p>
          {advice ? (
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
                    : t("advisor.riskOk")}
              </span>
            </p>
          ) : null}
          {deltas.length > 0 ? (
            <ul className="space-y-0.5">
              {deltas.map((row) => (
                <li key={row.id} className="flex justify-between gap-2 text-muted-foreground">
                  <span>{new Date(row.recorded_at).toLocaleString(i18n.language, { month: "short", day: "numeric" })}</span>
                  <span className="tabular-nums text-foreground">
                    {row.amount > 0 ? "+" : ""}
                    {row.amount} {pool.unit}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
