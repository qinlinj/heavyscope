import type { Pool } from "./schema";

function isoNow(): string {
  return new Date().toISOString();
}

/** Next Monday 00:00 UTC. */
export function nextWeeklyReset(from = new Date()): string {
  const day = from.getUTCDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  const reset = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate() + daysUntilMonday,
      0,
      0,
      0,
    ),
  );
  return reset.toISOString();
}

/** First day of next month 00:00 UTC. */
export function nextMonthlyReset(from = new Date()): string {
  const reset = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0),
  );
  return reset.toISOString();
}

export function computeResetAt(
  cycle: Pool["reset_cycle"],
  from = new Date(),
): string | null {
  if (cycle === "weekly") return nextWeeklyReset(from);
  if (cycle === "monthly") return nextMonthlyReset(from);
  return null;
}

export function defaultPools(): Pool[] {
  const now = isoNow();
  return [
    {
      id: "preset-grok-heavy",
      name: "Grok Heavy Weekly Shared Pool",
      type: "credits",
      quota_total: 100,
      quota_used: 0,
      reset_at: nextWeeklyReset(),
      reset_cycle: "weekly",
      unit: "credits",
      color: "#38bdf8",
      is_preset: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: "preset-grok-bot",
      name: "Grok Bot Weekly Quota",
      type: "requests",
      quota_total: 50,
      quota_used: 0,
      reset_at: nextWeeklyReset(),
      reset_cycle: "weekly",
      unit: "requests",
      color: "#a78bfa",
      is_preset: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: "preset-cursor-models",
      name: "Cursor Models Pool (Grok/Composer)",
      type: "requests",
      quota_total: 500,
      quota_used: 0,
      reset_at: nextMonthlyReset(),
      reset_cycle: "monthly",
      unit: "requests",
      color: "#34d399",
      is_preset: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: "preset-cursor-other",
      name: "Cursor Other Models Pool",
      type: "usd",
      quota_total: 400,
      quota_used: 0,
      reset_at: nextMonthlyReset(),
      reset_cycle: "monthly",
      unit: "USD",
      color: "#fbbf24",
      is_preset: 1,
      created_at: now,
      updated_at: now,
    },
  ];
}
