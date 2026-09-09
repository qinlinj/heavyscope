import { describe, expect, it } from "vitest";
import {
  hasSuccessfulApply,
  isUnsyncedPreset,
  mergeAppliedPoolIds,
  parseAppliedPoolIds,
  SETTING_APPLIED_POOL_IDS,
} from "./poolSyncState";

describe("parseAppliedPoolIds", () => {
  it("reads a JSON string array and ignores junk", () => {
    expect(parseAppliedPoolIds('["preset-cursor-models","preset-cursor-other"]')).toEqual([
      "preset-cursor-models",
      "preset-cursor-other",
    ]);
    expect(parseAppliedPoolIds("")).toEqual([]);
    expect(parseAppliedPoolIds("not-json")).toEqual([]);
  });
});

describe("mergeAppliedPoolIds", () => {
  it("unions ids without duplicates", () => {
    expect(mergeAppliedPoolIds(["a"], ["a", "b", ""])).toEqual(["a", "b"]);
  });
});

describe("hasSuccessfulApply", () => {
  it("is false for a new database with only seed rows", () => {
    expect(hasSuccessfulApply("preset-grok-heavy", [], {})).toBe(false);
    expect(hasSuccessfulApply("preset-cursor-other", [], {})).toBe(false);
    expect(
      isUnsyncedPreset({ id: "preset-cursor-other", is_preset: 1 }, [], {}),
    ).toBe(true);
  });

  it("treats a recorded apply list, sync rows, or legacy last-sync as applied", () => {
    expect(
      hasSuccessfulApply("preset-cursor-models", [], {
        [SETTING_APPLIED_POOL_IDS]: '["preset-cursor-models"]',
      }),
    ).toBe(true);
    expect(
      hasSuccessfulApply(
        "preset-grok-heavy",
        [{ pool_id: "preset-grok-heavy", source: "sync", amount: 4 }],
        {},
      ),
    ).toBe(true);
    expect(
      hasSuccessfulApply("preset-cursor-other", [], { cursor_last_synced_at: "2026-08-21T00:00:00.000Z" }),
    ).toBe(true);
    expect(hasSuccessfulApply("preset-grok-heavy", [], { grok_last_synced_at: "2026-08-21T00:00:00.000Z" })).toBe(
      true,
    );
    expect(hasSuccessfulApply("preset-grok-bot", [], { grok_bot_live: "ok" })).toBe(true);
    expect(hasSuccessfulApply("preset-grok-bot", [], { grok_bot_live: "unavailable" })).toBe(false);
  });
});
