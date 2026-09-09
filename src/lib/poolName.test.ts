import { describe, expect, it } from "vitest";
import { displayPoolName } from "@/lib/poolName";

const labels: Record<string, string> = {
  "presets.preset-grok-heavy": "Grok Heavy Weekly Shared Pool",
  "presets.preset-grok-bot": "Grok Bot Weekly Quota",
  "presets.preset-cursor-models": "Cursor Models Pool (Grok/Composer)",
  "presets.preset-cursor-other": "Cursor Other Models Pool",
};

const t = (key: string) => labels[key] ?? key;

describe("displayPoolName", () => {
  it("maps the four preset ids to i18n keys and ignores stored names", () => {
    expect(displayPoolName({ id: "preset-grok-heavy", name: "stored" }, t)).toBe(
      "Grok Heavy Weekly Shared Pool",
    );
    expect(displayPoolName({ id: "preset-grok-bot", name: "stored" }, t)).toBe(
      "Grok Bot Weekly Quota",
    );
    expect(displayPoolName({ id: "preset-cursor-models", name: "stored" }, t)).toBe(
      "Cursor Models Pool (Grok/Composer)",
    );
    expect(displayPoolName({ id: "preset-cursor-other", name: "stored" }, t)).toBe(
      "Cursor Other Models Pool",
    );
  });

  it("returns pool.name for custom pools", () => {
    expect(displayPoolName({ id: "custom-1", name: "My Team Pool" }, t)).toBe("My Team Pool");
  });
});
