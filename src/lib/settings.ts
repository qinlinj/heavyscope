export const SETTING_LANGUAGE = "language";
export const SETTING_WARN_PERCENT = "warn_percent";
export const SETTING_CRIT_PERCENT = "crit_percent";
export const SETTING_SYNC_ENABLED = "sync_enabled";
export const SETTING_SYNC_INTERVAL_MIN = "sync_interval_min";
export const SETTING_SYNC_SOURCE = "sync_source";
export const SETTING_CURSOR_SNAPSHOT = "cursor_snapshot";
export const SETTING_CURSOR_SNAPSHOT_HASH = "cursor_snapshot_hash";
export const SETTING_SYNC_LAST_AT = "sync_last_at";
export const SETTING_SYNC_LAST_STATUS = "sync_last_status";
export const SETTING_SYNC_LAST_MESSAGE = "sync_last_message";

export const DEFAULT_LANGUAGE = "zh-CN";
export const DEFAULT_WARN_PERCENT = 70;
export const DEFAULT_CRIT_PERCENT = 90;
export const DEFAULT_SYNC_ENABLED = "false";
export const DEFAULT_SYNC_INTERVAL_MIN = 30;
export const DEFAULT_SYNC_SOURCE = "none";

export type AlertThresholds = {
  warn: number;
  crit: number;
};

export type SyncSource = "cursor" | "none";

export function isValidThresholds(warn: number, crit: number): boolean {
  return Number.isFinite(warn) && Number.isFinite(crit) && warn >= 1 && warn < crit && crit <= 100;
}

export function parseThresholds(settings: Record<string, string>): AlertThresholds {
  const warn = Number(settings[SETTING_WARN_PERCENT] ?? DEFAULT_WARN_PERCENT);
  const crit = Number(settings[SETTING_CRIT_PERCENT] ?? DEFAULT_CRIT_PERCENT);
  if (isValidThresholds(warn, crit)) return { warn, crit };
  return { warn: DEFAULT_WARN_PERCENT, crit: DEFAULT_CRIT_PERCENT };
}

export function parseSyncInterval(value: string | null | undefined): number {
  const minutes = Number(value ?? DEFAULT_SYNC_INTERVAL_MIN);
  if (!Number.isFinite(minutes)) return DEFAULT_SYNC_INTERVAL_MIN;
  return Math.min(1440, Math.max(1, Math.round(minutes)));
}
