/** Deterministic demo usage so charts and the advisor look alive. */

import type { UsageRecord } from "@/db/schema";
import { PRESET_POOL_IDS } from "@/lib/poolName";
import { SETTING_DEMO_SEEDED } from "@/lib/settings";

export const DEMO_SEEDED_VALUE = "1";
export const DEMO_SEED_DAYS = 10;

export type DemoSeedReport = {
  skipped: boolean;
  inserted: number;
};

type PoolPattern = {
  id: (typeof PRESET_POOL_IDS)[number];
  note: string;
  amounts: readonly number[];
};

const POOL_PATTERNS: readonly PoolPattern[] = [
  {
    id: "preset-grok-heavy",
    note: "Demo seed: Grok Heavy weekday session",
    amounts: [5, 7, 9, 6, 11, 8, 4, 12, 7, 10],
  },
  {
    id: "preset-grok-bot",
    note: "Demo seed: Grok Bot review task",
    amounts: [1, 3, 2, 4, 2, 3, 1, 5, 2, 3],
  },
  {
    id: "preset-cursor-models",
    note: "Demo seed: Cursor Composer / model calls",
    amounts: [10, 18, 14, 22, 12, 20, 8, 16, 24, 15],
  },
  {
    id: "preset-cursor-other",
    note: "Demo seed: Cursor other models spend",
    amounts: [6, 12, 8, 15, 9, 14, 5, 11, 18, 10],
  },
];

function utcNoonDaysAgo(now: Date, daysAgo: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, 12, 0, 0, 0),
  );
}

function utcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Extra usage_records for the four preset pools across the last 10 UTC days. */
export function buildDemoUsageRecords(now = new Date()): UsageRecord[] {
  const records: UsageRecord[] = [];
  for (const pattern of POOL_PATTERNS) {
    for (let daysAgo = DEMO_SEED_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
      const when = utcNoonDaysAgo(now, daysAgo);
      const amount = pattern.amounts[DEMO_SEED_DAYS - 1 - daysAgo]!;
      records.push({
        id: `demo-${pattern.id}-${utcDateKey(when)}`,
        pool_id: pattern.id,
        amount,
        recorded_at: when.toISOString(),
        note: pattern.note,
        source: "import",
      });
    }
  }
  return records;
}

export function isDemoSeeded(settings: Record<string, string> | string | null | undefined): boolean {
  if (typeof settings === "string" || settings == null) return settings === DEMO_SEEDED_VALUE;
  return settings[SETTING_DEMO_SEEDED] === DEMO_SEEDED_VALUE;
}

/** Skip when demo_seeded=1 unless the caller forces a second apply. */
export function shouldApplyDemoSeed(
  settings: Record<string, string> | string | null | undefined,
  force = false,
): boolean {
  if (force) return true;
  return !isDemoSeeded(settings);
}
