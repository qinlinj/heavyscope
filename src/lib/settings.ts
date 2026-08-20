export const SETTING_LANGUAGE = "language";
export { SETTING_THEME } from "@/lib/theme";
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
export const SETTING_CURSOR_LAST_SYNCED_AT = "cursor_last_synced_at";
export const SETTING_CURSOR_SYNC_SOURCE = "cursor_sync_source";
export const SETTING_CURSOR_SYNC_MESSAGE = "cursor_sync_message";
export const SETTING_GROK_LAST_SYNCED_AT = "grok_last_synced_at";
export const SETTING_GROK_SYNC_SOURCE = "grok_sync_source";
export const SETTING_GROK_SYNC_MESSAGE = "grok_sync_message";
export const SETTING_CURSOR_CONNECTED = "cursor_connected";
export const SETTING_GROK_CONNECTED = "grok_connected";
export const SETTING_GROK_BOT_LIVE = "grok_bot_live";
export const SETTING_GROK_PARSED_PRODUCTS = "grok_parsed_products";

export const SECRET_SETTING_KEYS = [
  SETTING_CURSOR_SESSION_TOKEN,
  SETTING_GROK_SESSION_TOKEN,
  SETTING_GROK_BEARER_TOKEN,
] as const;

export const DEFAULT_LANGUAGE = "zh-CN";
export const DEFAULT_WARN_PERCENT = 70;
export const DEFAULT_CRIT_PERCENT = 90;
export const DEFAULT_SYNC_ENABLED = "false";
/** Shared auto-sync interval for live Cursor / Grok (and snapshot fallback). */
export const DEFAULT_SYNC_INTERVAL_MIN = 5;
export const DEFAULT_SYNC_SOURCE = "none";
export const LEGACY_SYNC_INTERVAL_MIN = 30;
export const SYNC_INTERVAL_OPTIONS = [1, 5, 15, 30, 60] as const;

export type AlertThresholds = {
  warn: number;
  crit: number;
};

export const SYNC_SOURCES = ["none", "cursor", "grok", "both"] as const;
export type SyncSource = (typeof SYNC_SOURCES)[number];
export type SyncProvider = "cursor" | "grok";
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

/** Shared live interval: 1–60 minutes, default 5. */
export function parseSyncInterval(value: string | null | undefined): number {
  const minutes = Number(value ?? DEFAULT_SYNC_INTERVAL_MIN);
  if (!Number.isFinite(minutes)) return DEFAULT_SYNC_INTERVAL_MIN;
  return Math.min(60, Math.max(1, Math.round(minutes)));
}

export function parseSyncSource(value: string | null | undefined): SyncSource {
  if (value === "cursor" || value === "grok" || value === "both") return value;
  return "none";
}

export function syncSourceHas(source: SyncSource, provider: SyncProvider): boolean {
  if (source === "both") return true;
  return source === provider;
}

export function withSyncProvider(current: SyncSource, provider: SyncProvider, on: boolean): SyncSource {
  const cursor = provider === "cursor" ? on : syncSourceHas(current, "cursor");
  const grok = provider === "grok" ? on : syncSourceHas(current, "grok");
  if (cursor && grok) return "both";
  if (cursor) return "cursor";
  if (grok) return "grok";
  return "none";
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

export function hasCursorCredentials(settings: Record<string, string>): boolean {
  return hasSecretSetting(settings, SETTING_CURSOR_SESSION_TOKEN);
}

export function hasGrokCredentials(settings: Record<string, string>): boolean {
  return (
    hasSecretSetting(settings, SETTING_GROK_SESSION_TOKEN) ||
    hasSecretSetting(settings, SETTING_GROK_BEARER_TOKEN)
  );
}

export function isCursorLiveConnected(settings: Record<string, string>): boolean {
  return hasCursorCredentials(settings) && settings[SETTING_CURSOR_CONNECTED] === "true";
}

export function isGrokLiveConnected(settings: Record<string, string>): boolean {
  return hasGrokCredentials(settings) && settings[SETTING_GROK_CONNECTED] === "true";
}

/** Timer membership: a stored token is enough. Do not require *_connected. */
export function syncProvidersFromCredentials(settings: Record<string, string>): SyncSource {
  return withSyncProvider(
    withSyncProvider("none", "cursor", hasCursorCredentials(settings)),
    "grok",
    hasGrokCredentials(settings),
  );
}

export function nextSyncAt(
  lastAt: string | undefined,
  intervalMin: number,
  now: Date = new Date(),
): string | null {
  if (!lastAt) return new Date(now.getTime() + Math.max(1, intervalMin) * 60_000).toISOString();
  const parsed = Date.parse(lastAt);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed + Math.max(1, intervalMin) * 60_000).toISOString();
}

export type GrokParsedProduct = { name: string; percent: number };

export function parseGrokParsedProducts(raw: string | undefined): GrokParsedProduct[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as { name?: unknown; percent?: unknown };
        const percent = Number(row.percent);
        if (!Number.isFinite(percent)) return null;
        return { name: typeof row.name === "string" ? row.name : "", percent };
      })
      .filter((item): item is GrokParsedProduct => item != null);
  } catch {
    return [];
  }
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
