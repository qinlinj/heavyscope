import type { UsageRecord, UsageSource } from "@/db/schema";

export const DEMO_NOTE_PREFIX = "Demo seed:";

export const LIVE_HISTORY_SOURCES: readonly UsageSource[] = ["manual", "import", "sync"];

export type HistorySourceFilter = UsageSource | "all" | "live";

export function isDemoRecord(record: Pick<UsageRecord, "source" | "note">): boolean {
  if (record.source === "demo") return true;
  return Boolean(record.note?.startsWith(DEMO_NOTE_PREFIX));
}

export function excludeDemoRecords<T extends Pick<UsageRecord, "source" | "note">>(records: readonly T[]): T[] {
  return records.filter((record) => !isDemoRecord(record));
}

export function matchesHistorySource(
  record: Pick<UsageRecord, "source" | "note">,
  source: HistorySourceFilter,
): boolean {
  if (source === "demo") return isDemoRecord(record);
  if (isDemoRecord(record)) return false;
  if (source === "all" || source === "live") return true;
  return record.source === source;
}
