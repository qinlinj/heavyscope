import { describe, expect, it } from "vitest";
import {
  cursorCookieHeader,
  deriveCursorSessionTokenFromJwt,
  mapCursorUsageResponse,
  mapCursorUsageSummary,
  normalizeCursorSessionToken,
} from "./cursorLive";

const SAMPLE_SUMMARY = {
  billingCycleStart: "2026-07-19T00:00:00.000Z",
  billingCycleEnd: "2026-08-19T00:00:00.000Z",
  membershipType: "ultra",
  individualUsage: {
    plan: {
      autoPercentUsed: 42.5,
      apiPercentUsed: 18,
      totalPercentUsed: 40,
    },
    onDemand: {
      enabled: true,
      used: 1250,
      limit: 40000,
    },
  },
};

describe("mapCursorUsageSummary", () => {
  it("maps usage-summary fixture to the two Cursor pools", () => {
    const result = mapCursorUsageSummary(SAMPLE_SUMMARY);
    expect(result.ok).toBe(true);
    expect(result.pools).toHaveLength(2);
    const models = result.pools.find((pool) => pool.poolHint === "cursor_models");
    const other = result.pools.find((pool) => pool.poolHint === "cursor_other");
    expect(models).toMatchObject({
      quotaUsed: 42.5,
      quotaTotal: 100,
      unit: "%",
      resetCycle: "monthly",
      resetAt: "2026-08-19T00:00:00.000Z",
    });
    expect(other).toMatchObject({
      quotaUsed: 18,
      quotaTotal: 100,
      unit: "%",
      resetAt: "2026-08-19T00:00:00.000Z",
    });
    expect(other?.note).toContain("On-demand $12.50 / $400.00");
  });

  it("keeps raw percent when it is over 100", () => {
    const result = mapCursorUsageSummary({
      billingCycleEnd: "2026-08-19T00:00:00.000Z",
      individualUsage: { plan: { autoPercentUsed: 112, apiPercentUsed: 5 } },
    });
    expect(result.ok).toBe(true);
    expect(result.pools[0]?.quotaUsed).toBe(112);
    expect(result.pools[0]?.quotaTotal).toBe(100);
  });

  it("does not replace Other with on-demand when apiPercentUsed is present", () => {
    const result = mapCursorUsageSummary({
      individualUsage: {
        plan: { autoPercentUsed: 10, apiPercentUsed: 7 },
        onDemand: { enabled: true, used: 20000, limit: 40000 },
      },
    });
    const other = result.pools.find((pool) => pool.poolHint === "cursor_other");
    expect(other?.quotaUsed).toBe(7);
  });

  it("returns an error result for missing fields without throwing", () => {
    expect(() => mapCursorUsageSummary({})).not.toThrow();
    const result = mapCursorUsageSummary({ membershipType: "ultra" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid");
    expect(result.pools).toEqual([]);
  });
});

describe("mapCursorUsageResponse", () => {
  it("maps 401 / 403 to expired and does not throw", () => {
    expect(() => mapCursorUsageResponse(401, "")).not.toThrow();
    const unauthorized = mapCursorUsageResponse(401, '{"error":"nope"}');
    expect(unauthorized.ok).toBe(false);
    expect(unauthorized.code).toBe("expired");
    const forbidden = mapCursorUsageResponse(403, "forbidden");
    expect(forbidden.ok).toBe(false);
    expect(forbidden.code).toBe("expired");
  });

  it("maps malformed JSON to an error result", () => {
    const result = mapCursorUsageResponse(200, "<html>login</html>");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid");
  });

  it("parses a 200 JSON body", () => {
    const result = mapCursorUsageResponse(200, JSON.stringify(SAMPLE_SUMMARY));
    expect(result.ok).toBe(true);
    expect(result.pools).toHaveLength(2);
  });
});

describe("normalizeCursorSessionToken", () => {
  it("keeps raw sub::jwt and already-encoded %3A%3A forms", () => {
    expect(normalizeCursorSessionToken("user_01ABC::eyJhbGciOiJIUzI1NiJ9.e30.sig")).toBe(
      "user_01ABC::eyJhbGciOiJIUzI1NiJ9.e30.sig",
    );
    expect(normalizeCursorSessionToken("user_01ABC%3A%3AeyJhbGciOiJIUzI1NiJ9.e30.sig")).toBe(
      "user_01ABC%3A%3AeyJhbGciOiJIUzI1NiJ9.e30.sig",
    );
  });

  it("derives sub::jwt from a bare JWT", () => {
    const payload = btoa(JSON.stringify({ sub: "github|user_01XYZ" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const jwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
    expect(deriveCursorSessionTokenFromJwt(jwt)).toBe(`user_01XYZ::${jwt}`);
    expect(normalizeCursorSessionToken(jwt)).toBe(`user_01XYZ::${jwt}`);
  });

  it("builds the Cookie header without logging the token", () => {
    expect(cursorCookieHeader("user_01ABC::jwt")).toBe("WorkosCursorSessionToken=user_01ABC::jwt");
  });
});
