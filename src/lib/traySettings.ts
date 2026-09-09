import {
  parseSyncInterval,
  SECRET_SETTING_KEYS,
  SETTING_CURSOR_SESSION_TOKEN,
  SETTING_GROK_BEARER_TOKEN,
  SETTING_GROK_SESSION_TOKEN,
  SETTING_SYNC_ENABLED,
  SETTING_SYNC_INTERVAL_MIN,
} from "@/lib/settings";

/**
 * Keys the tray Settings pane writes. Must stay identical to the web
 * Data sources / interval fields so connect + timer share one store.
 */
export const TRAY_CREDENTIAL_KEYS = [
  SETTING_CURSOR_SESSION_TOKEN,
  SETTING_GROK_SESSION_TOKEN,
  SETTING_GROK_BEARER_TOKEN,
] as const;

export const TRAY_INTERVAL_KEY = SETTING_SYNC_INTERVAL_MIN;
export const TRAY_SYNC_ENABLED_KEY = SETTING_SYNC_ENABLED;

export function trayCredentialKeysMatchWeb(): boolean {
  return TRAY_CREDENTIAL_KEYS.every((key) => (SECRET_SETTING_KEYS as readonly string[]).includes(key));
}

export function writeTrayInterval(
  setSetting: (key: string, value: string) => void,
  minutes: string | number,
): void {
  setSetting(SETTING_SYNC_INTERVAL_MIN, String(parseSyncInterval(String(minutes))));
}

export function writeTraySyncEnabled(
  setSetting: (key: string, value: string) => void,
  enabled: boolean,
): void {
  setSetting(SETTING_SYNC_ENABLED, enabled ? "true" : "false");
}
