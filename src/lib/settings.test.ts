import { describe, expect, it } from "vitest";
import {
  DEFAULT_SYNC_INTERVAL_MIN,
  parseSyncInterval,
  parseSyncSource,
  redactSettings,
  syncSourceHas,
  withSyncProvider,
} from "./settings";

describe("parseSyncInterval", () => {
  it("defaults to 5 minutes and clamps 1–60", () => {
    expect(DEFAULT_SYNC_INTERVAL_MIN).toBe(5);
    expect(parseSyncInterval(undefined)).toBe(5);
    expect(parseSyncInterval("0")).toBe(1);
    expect(parseSyncInterval("90")).toBe(60);
    expect(parseSyncInterval("12.4")).toBe(12);
  });
});

describe("parseSyncSource", () => {
  it("accepts cursor, grok, both, and falls back to none", () => {
    expect(parseSyncSource("cursor")).toBe("cursor");
    expect(parseSyncSource("grok")).toBe("grok");
    expect(parseSyncSource("both")).toBe("both");
    expect(parseSyncSource("none")).toBe("none");
    expect(parseSyncSource("legacy")).toBe("none");
  });
});

describe("withSyncProvider", () => {
  it("lets Cursor live and Grok live run together", () => {
    expect(withSyncProvider("none", "cursor", true)).toBe("cursor");
    expect(withSyncProvider("cursor", "grok", true)).toBe("both");
    expect(syncSourceHas("both", "cursor")).toBe(true);
    expect(syncSourceHas("both", "grok")).toBe(true);
    expect(withSyncProvider("both", "cursor", false)).toBe("grok");
    expect(withSyncProvider("grok", "grok", false)).toBe("none");
  });
});

describe("redactSettings", () => {
  it("omits session tokens from backup-safe settings", () => {
    const redacted = redactSettings({
      language: "en",
      cursor_session_token: "secret-cursor",
      grok_session_token: "secret-grok",
      grok_bearer_token: "secret-bearer",
      sync_source: "both",
    });
    expect(redacted).toEqual({ language: "en", sync_source: "both" });
  });
});
