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
export const SETTING_DEMO_SEEDED = "demo_seeded";
export const SETTING_CURSOR_SESSION_TOKEN = "cursor_session_token";
export const SETTING_GROK_SESSION_TOKEN = "grok_session_token";
export const SETTING_GROK_BEARER_TOKEN = "grok_bearer_token";
export const SETTING_CURSOR_SYNC_INTERVAL_MIN = "cursor_sync_interval_min";
export const SETTING_GROK_SYNC_INTERVAL_MIN = "grok_sync_interval_min";
export const SETTING_CURSOR_LAST_SYNCED_AT = "cursor_last_synced_at";
export const SETTING_CURSOR_SYNC_SOURCE = "cursor_sync_source";
export const SETTING_CURSOR_SYNC_MESSAGE = "cursor_sync_message";
export const SETTING_GROK_LAST_SYNCED_AT = "grok_last_synced_at";
export const SETTING_GROK_SYNC_SOURCE = "grok_sync_source";
export const SETTING_GROK_SYNC_MESSAGE = "grok_sync_message";
export const SETTING_CURSOR_CONNECTED = "cursor_connected";
export const SETTING_GROK_CONNECTED = "grok_connected";
export const SETTING_GROK_BOT_LIVE = "grok_bot_live";

export const SECRET_SETTING_KEYS = [
  SETTING_CURSOR_SESSION_TOKEN,
  SETTING_GROK_SESSION_TOKEN,
  SETTING_GROK_BEARER_TOKEN,
] as const;

export const DEFAULT_LANGUAGE = "zh-CN";
export const DEFAULT_WARN_PERCENT = 70;
export const DEFAULT_CRIT_PERCENT = 90;
export const DEFAULT_SYNC_ENABLED = "false";
export const DEFAULT_SYNC_INTERVAL_MIN = 30;
export const DEFAULT_SYNC_SOURCE = "none";
export const DEFAULT_LIVE_SYNC_INTERVAL_MIN = 5;

export type AlertThresholds = {
  warn: number;
  crit: number;
};

export type SyncSource = "cursor" | "none";
export type LiveSyncSource = "api" | "session" | "error";
export type ConnectorState = "true" | "false" | "expired";
export type PoolSyncBadge = "api" | "session" | "manual" | "import" | "error";

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

/** Live provider interval: 1–60 minutes, default 5. */
export function parseLiveSyncInterval(value: string | null | undefined): number {
  const minutes = Number(value ?? DEFAULT_LIVE_SYNC_INTERVAL_MIN);
  if (!Number.isFinite(minutes)) return DEFAULT_LIVE_SYNC_INTERVAL_MIN;
  return Math.min(60, Math.max(1, Math.round(minutes)));
}

export function redactSettings(settings: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    if ((SECRET_SETTING_KEYS as readonly string[]).includes(key)) continue;
    out[key] = value;
  }
  return out;
}

export function hasSecretSetting(settings: Record<string, string>, key: string): boolean {
  return Boolean(settings[key]?.trim());
}

export function isCursorLiveConnected(settings: Record<string, string>): boolean {
  return (
    hasSecretSetting(settings, SETTING_CURSOR_SESSION_TOKEN) &&
    settings[SETTING_CURSOR_CONNECTED] === "true"
  );
}

export function isGrokLiveConnected(settings: Record<string, string>): boolean {
  return (
    (hasSecretSetting(settings, SETTING_GROK_SESSION_TOKEN) ||
      hasSecretSetting(settings, SETTING_GROK_BEARER_TOKEN)) &&
    settings[SETTING_GROK_CONNECTED] === "true"
  );
}

/** Live-connected preset pools skip local rollover; the API is the source of truth. */
export function liveConnectorOwnsPool(poolId: string, settings: Record<string, string>): boolean {
  if (isCursorLiveConnected(settings) && (poolId === "preset-cursor-models" || poolId === "preset-cursor-other")) {
    return true;
  }
  if (isGrokLiveConnected(settings) && poolId === "preset-grok-heavy") return true;
  if (isGrokLiveConnected(settings) && settings[SETTING_GROK_BOT_LIVE] === "ok" && poolId === "preset-grok-bot") {
    return true;
  }
  return false;
}
