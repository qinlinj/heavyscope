import { describe, expect, it } from "vitest";
import { compactPoolView } from "./poolView";

describe("compactPoolView", () => {
  it("exposes name, used%, remaining, reset, and unit for a 1/4 card", () => {
    const view = compactPoolView({
      name: "Grok Heavy Weekly Shared Pool",
      unit: "%",
      quota_used: 42,
      quota_total: 100,
      reset_at: "2026-08-24T00:00:00.000Z",
    });
    expect(view.name).toBe("Grok Heavy Weekly Shared Pool");
    expect(view.percent).toBe(42);
    expect(view.remaining).toBe(58);
    expect(view.unit).toBe("%");
    expect(view.resetAt).toBe("2026-08-24T00:00:00.000Z");
    expect(view.used).toBe(42);
    expect(view.total).toBe(100);
  });
});
