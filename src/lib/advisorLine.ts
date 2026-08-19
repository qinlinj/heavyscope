import type { Pool } from "@/db/schema";
import type { CrossPoolAdvice, PoolAdvice } from "@/lib/burnRate";
import { displayPoolName } from "@/lib/poolName";

type Translate = (key: string, opts?: Record<string, string | number>) => string;

export function formatAdvisorLine(
  t: Translate,
  tightest: PoolAdvice | null,
  switchAdvice: CrossPoolAdvice | null,
  pools: Pool[],
): string | null {
  if (!tightest) return null;
  const pool = pools.find((item) => item.id === tightest.poolId);
  if (!pool) return null;
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
