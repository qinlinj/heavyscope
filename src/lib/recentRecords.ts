import type { UsageRecord } from "@/db/schema";

/** Dashboard PoolCard Recent: latest two rows only. Older rows live on History. */
export const DASHBOARD_RECENT_LIMIT = 2;
/** Matches `text-xs leading-5` row height used by PoolCard Recent. */
export const DASHBOARD_RECENT_ROW_HEIGHT_PX = 20;
/** Matches `space-y-1` between Recent rows. */
export const DASHBOARD_RECENT_ROW_GAP_PX = 4;

/** Fixed list box for `limit` rows. Does not shrink when fewer rows are present. */
export function dashboardRecentListHeightPx(
  limit = DASHBOARD_RECENT_LIMIT,
  rowPx = DASHBOARD_RECENT_ROW_HEIGHT_PX,
  gapPx = DASHBOARD_RECENT_ROW_GAP_PX,
): number {
  const rows = Math.max(0, limit);
  if (rows === 0) return 0;
  return rows * rowPx + (rows - 1) * gapPx;
}

/** Latest `limit` records by `recorded_at` descending. Does not mutate the input. */
export function dashboardRecentRecords<T extends Pick<UsageRecord, "recorded_at">>(
  records: readonly T[],
  limit = DASHBOARD_RECENT_LIMIT,
): T[] {
  return [...records]
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .slice(0, Math.max(0, limit));
}
