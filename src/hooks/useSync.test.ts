import { describe, expect, it } from "vitest";
import { liveProvidersForTick, shouldRunLiveInterval } from "./useSync";

describe("liveProvidersForTick", () => {
  it("puts a provider on the interval from credentials alone", () => {
    expect(liveProvidersForTick({ cursorHasToken: true, grokHasToken: false })).toEqual(["cursor"]);
    expect(liveProvidersForTick({ cursorHasToken: false, grokHasToken: true })).toEqual(["grok"]);
    expect(liveProvidersForTick({ cursorHasToken: true, grokHasToken: true })).toEqual(["cursor", "grok"]);
    expect(liveProvidersForTick({ cursorHasToken: false, grokHasToken: false })).toEqual([]);
  });
});

describe("shouldRunLiveInterval", () => {
  it("keeps ticking when a cookie or bearer is saved even if sync_enabled is false", () => {
    expect(shouldRunLiveInterval({ enabled: false, cursorHasToken: false, grokHasToken: true })).toBe(true);
    expect(shouldRunLiveInterval({ enabled: false, cursorHasToken: true, grokHasToken: false })).toBe(true);
    expect(shouldRunLiveInterval({ enabled: false, cursorHasToken: false, grokHasToken: false })).toBe(false);
    expect(shouldRunLiveInterval({ enabled: true, cursorHasToken: false, grokHasToken: false })).toBe(true);
  });
});
