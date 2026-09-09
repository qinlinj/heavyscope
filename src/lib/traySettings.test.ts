import { describe, expect, it } from "vitest";
import {
  SECRET_SETTING_KEYS,
  SETTING_CURSOR_SESSION_TOKEN,
  SETTING_GROK_BEARER_TOKEN,
  SETTING_GROK_SESSION_TOKEN,
  SETTING_SYNC_ENABLED,
  SETTING_SYNC_INTERVAL_MIN,
} from "./settings";
import {
  TRAY_CREDENTIAL_KEYS,
  TRAY_INTERVAL_KEY,
  TRAY_SYNC_ENABLED_KEY,
  trayCredentialKeysMatchWeb,
  writeTrayInterval,
  writeTraySyncEnabled,
} from "./traySettings";

describe("tray settings keys", () => {
  it("writes the same credential and interval keys as web Settings", () => {
    expect(TRAY_CREDENTIAL_KEYS).toEqual([
      SETTING_CURSOR_SESSION_TOKEN,
      SETTING_GROK_SESSION_TOKEN,
      SETTING_GROK_BEARER_TOKEN,
    ]);
    expect(TRAY_INTERVAL_KEY).toBe(SETTING_SYNC_INTERVAL_MIN);
    expect(TRAY_SYNC_ENABLED_KEY).toBe(SETTING_SYNC_ENABLED);
    expect(trayCredentialKeysMatchWeb()).toBe(true);
    expect(SECRET_SETTING_KEYS).toEqual([...TRAY_CREDENTIAL_KEYS]);
  });
});

describe("writeTrayInterval", () => {
  it("persists sync_interval_min through the shared setter", () => {
    const writes: Record<string, string> = {};
    writeTrayInterval((key, value) => {
      writes[key] = value;
    }, "15");
    expect(writes).toEqual({ [SETTING_SYNC_INTERVAL_MIN]: "15" });
  });

  it("clamps the same 1–60 range as web Settings", () => {
    const writes: Record<string, string> = {};
    writeTrayInterval((key, value) => {
      writes[key] = value;
    }, "90");
    expect(writes[SETTING_SYNC_INTERVAL_MIN]).toBe("60");
  });
});

describe("writeTraySyncEnabled", () => {
  it("writes sync_enabled as true/false", () => {
    const writes: Record<string, string> = {};
    writeTraySyncEnabled((key, value) => {
      writes[key] = value;
    }, true);
    expect(writes[SETTING_SYNC_ENABLED]).toBe("true");
  });
});
