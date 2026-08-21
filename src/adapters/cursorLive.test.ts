import { describe, expect, it } from "vitest";
import {
  cursorCookieHeader,
  deriveCursorSessionTokenFromJwt,
  finishCursorLiveRefresh,
  isCursorGrokBotSku,
  isCursorSessionExpired,
  mapCursorAggregatedResponse,
  mapCursorHttpStatus,
  mapCursorPeriodResponse,
  mapCursorUsageResponse,
  mapCursorUsageSummary,
  mergeCursorSpendingSources,
  normalizeCursorSessionToken,
  parseCursorJsonBody,
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

const SAMPLE_PERIOD = {
  billingCycleStart: 1752883200000,
  billingCycleEnd: 1755561600000,
  planUsage: {
    autoPercentUsed: 42.5,
    apiPercentUsed: 18,
    totalPercentUsed: 40,
    totalSpend: 1250,
    includedSpend: 1000,
    bonusSpend: 250,
    limit: 40000,
  },
};

const SAMPLE_AGGREGATIONS = {
  aggregations: [
    {
      modelIntent: "composer-1",
      model: "composer-1",
      inputTokens: "1000",
      outputTokens: "200",
      totalCents: 80,
      tier: "included",
    },
    {
      modelIntent: "cursor-grok",
      model: "grok-4",
      totalCents: 40,
    },
    {
      modelIntent: "grok-bot",
      product: "Grok Bot",
      totalCents: 330,
    },
  ],
};

describe("mapCursorUsageSummary", () => {
  it("maps Models as % and Other as USD from on-demand cents, not apiPercent", () => {
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
      quotaUsed: 12.5,
      quotaTotal: 400,
      unit: "USD",
      resetAt: "2026-08-19T00:00:00.000Z",
    });
    expect(other?.note).toContain("On-demand $12.50 / $400.00");
    expect(result.pools.find((pool) => pool.poolHint === "grok_bot")).toBeUndefined();
  });

  it("keeps raw Models percent when it is over 100", () => {
    const result = mapCursorUsageSummary({
      billingCycleEnd: "2026-08-19T00:00:00.000Z",
      individualUsage: { plan: { autoPercentUsed: 112, apiPercentUsed: 5 } },
    });
    expect(result.ok).toBe(true);
    expect(result.pools).toHaveLength(1);
    expect(result.pools[0]?.poolHint).toBe("cursor_models");
    expect(result.pools[0]?.quotaUsed).toBe(112);
    expect(result.pools[0]?.quotaTotal).toBe(100);
  });

  it("does not map Other from apiPercentUsed as 0–100%", () => {
    const result = mapCursorUsageSummary({
      individualUsage: {
        plan: { autoPercentUsed: 10, apiPercentUsed: 7 },
        onDemand: { enabled: true, used: 20000, limit: 40000 },
      },
    });
    const other = result.pools.find((pool) => pool.poolHint === "cursor_other");
    expect(other?.quotaUsed).toBe(200);
    expect(other?.quotaTotal).toBe(400);
    expect(other?.unit).toBe("USD");
    expect(other?.quotaUsed).not.toBe(7);
    expect(other?.quotaTotal).not.toBe(100);
  });

  it("omits Other when only apiPercentUsed is present", () => {
    const result = mapCursorUsageSummary({
      individualUsage: { plan: { autoPercentUsed: 10, apiPercentUsed: 18 } },
    });
    expect(result.ok).toBe(true);
    expect(result.pools.map((pool) => pool.poolHint)).toEqual(["cursor_models"]);
  });

  it("returns an error result for missing fields without throwing", () => {
    expect(() => mapCursorUsageSummary({})).not.toThrow();
    const result = mapCursorUsageSummary({ membershipType: "ultra" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid");
    expect(result.pools).toEqual([]);
  });
});

describe("mergeCursorSpendingSources", () => {
  it("maps three pools from a spending + aggregation payload", () => {
    const result = mergeCursorSpendingSources({
      period: SAMPLE_PERIOD,
      aggregations: SAMPLE_AGGREGATIONS,
    });
    expect(result.ok).toBe(true);
    expect(result.botUnavailable).toBe(false);
    const models = result.pools.find((pool) => pool.poolHint === "cursor_models");
    const other = result.pools.find((pool) => pool.poolHint === "cursor_other");
    const bot = result.pools.find((pool) => pool.poolHint === "grok_bot");
    expect(models).toMatchObject({
      quotaUsed: 42.5,
      quotaTotal: 100,
      unit: "%",
    });
    expect(other).toMatchObject({
      quotaUsed: 12.5,
      quotaTotal: 400,
      unit: "USD",
    });
    expect(bot).toMatchObject({
      quotaUsed: 3.3,
      unit: "USD",
    });
    expect(bot?.quotaTotal).toBeUndefined();
  });

  it("keeps Composer / Cursor Grok / grok-4 / Heavy out of grok_bot even with used+limit", () => {
    const result = mergeCursorSpendingSources({
      period: SAMPLE_PERIOD,
      aggregations: {
        aggregations: [
          { modelIntent: "composer-2", used: 20, limit: 50 },
          { modelIntent: "cursor-grok", model: "Cursor Grok", used: 9, limit: 30 },
          { modelIntent: "grok-4-fast", used: 4, limit: 10 },
          { modelIntent: "SuperGrok Heavy", used: 70, limit: 100 },
        ],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.botUnavailable).toBe(true);
    expect(result.pools.find((pool) => pool.poolHint === "grok_bot")).toBeUndefined();
    expect(result.pools.find((pool) => pool.poolHint === "cursor_models")).toMatchObject({
      quotaUsed: 42.5,
      quotaTotal: 100,
      unit: "%",
    });
    expect(result.pools.some((pool) => pool.quotaUsed === 20 || pool.quotaUsed === 9)).toBe(false);
  });

  it("omits grok_bot and invents no number when the Grok Bot row is missing", () => {
    const result = mergeCursorSpendingSources({
      period: SAMPLE_PERIOD,
      aggregations: {
        aggregations: [
          { modelIntent: "composer-1", totalCents: 80 },
          { modelIntent: "cursor-grok", model: "grok-4", totalCents: 999 },
          { modelIntent: "grok-heavy", totalCents: 50 },
          { modelIntent: "claude-4-sonnet", totalCents: 10 },
        ],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.botUnavailable).toBe(true);
    expect(result.pools.map((pool) => pool.poolHint)).toEqual(["cursor_models", "cursor_other"]);
    expect(result.pools.find((pool) => pool.poolHint === "grok_bot")).toBeUndefined();
    expect(result.pools.some((pool) => pool.quotaUsed === 999 || pool.quotaUsed === 9.99)).toBe(false);
  });

  it("uses planUsage.limit as Other total when present, else 400 USD", () => {
    const withLimit = mergeCursorSpendingSources({
      period: {
        planUsage: { autoPercentUsed: 1, totalSpend: 500, limit: 20000 },
      },
    });
    expect(withLimit.pools.find((pool) => pool.poolHint === "cursor_other")).toMatchObject({
      quotaUsed: 5,
      quotaTotal: 200,
      unit: "USD",
    });

    const defaultLimit = mergeCursorSpendingSources({
      period: {
        planUsage: { autoPercentUsed: 1, totalSpend: 500, limit: 0 },
      },
    });
    expect(defaultLimit.pools.find((pool) => pool.poolHint === "cursor_other")).toMatchObject({
      quotaUsed: 5,
      quotaTotal: 400,
      unit: "USD",
    });
  });

  it("falls back to usage-summary Models % when period autoPercent is missing", () => {
    const result = mergeCursorSpendingSources({
      period: { planUsage: { totalSpend: 250, limit: 40000 } },
      summary: SAMPLE_SUMMARY,
    });
    expect(result.pools.find((pool) => pool.poolHint === "cursor_models")?.quotaUsed).toBe(42.5);
    expect(result.pools.find((pool) => pool.poolHint === "cursor_other")).toMatchObject({
      quotaUsed: 2.5,
      quotaTotal: 400,
      unit: "USD",
    });
  });

  it("writes Grok Bot used+limit when the row has both, and never uses Composer/Cursor Grok", () => {
    const result = mergeCursorSpendingSources({
      period: SAMPLE_PERIOD,
      aggregations: {
        aggregations: [
          { modelIntent: "composer-1.5", used: 12, limit: 50, unit: "requests" },
          { modelIntent: "Grok API", used: 8, limit: 40 },
        ],
      },
    });
    const bot = result.pools.find((pool) => pool.poolHint === "grok_bot");
    expect(bot).toMatchObject({ quotaUsed: 8, quotaTotal: 40 });
  });

  it("reads Grok Bot from filtered events when aggregations have no SKU row", () => {
    const result = mergeCursorSpendingSources({
      period: SAMPLE_PERIOD,
      aggregations: { aggregations: [{ modelIntent: "composer-1", totalCents: 1 }] },
      events: {
        usageEventsDisplay: [{ model: "grok-bot", tokenUsage: { totalCents: 110 } }],
      },
    });
    expect(result.pools.find((pool) => pool.poolHint === "grok_bot")?.quotaUsed).toBe(1.1);
  });
});

describe("isCursorGrokBotSku", () => {
  it("matches conservative Grok Bot / API / Agents SKUs", () => {
    expect(isCursorGrokBotSku("grok-bot")).toBe(true);
    expect(isCursorGrokBotSku("grok_bot")).toBe(true);
    expect(isCursorGrokBotSku("Grok Bot")).toBe(true);
    expect(isCursorGrokBotSku("product_grok_bot")).toBe(true);
    expect(isCursorGrokBotSku("Grok API")).toBe(true);
    expect(isCursorGrokBotSku("grok-agents")).toBe(true);
    expect(isCursorGrokBotSku("SuperGrok Bot")).toBe(true);
  });

  it("excludes Composer, Cursor Grok chat models, and Heavy", () => {
    expect(isCursorGrokBotSku("composer-1")).toBe(false);
    expect(isCursorGrokBotSku("composer-2")).toBe(false);
    expect(isCursorGrokBotSku("cursor-grok")).toBe(false);
    expect(isCursorGrokBotSku("cursor-grok-4")).toBe(false);
    expect(isCursorGrokBotSku("cursor-grok-4.6-high-fast")).toBe(false);
    expect(isCursorGrokBotSku("Cursor Grok")).toBe(false);
    expect(isCursorGrokBotSku("grok-4")).toBe(false);
    expect(isCursorGrokBotSku("Grok 4")).toBe(false);
    expect(isCursorGrokBotSku("grok-4-fast")).toBe(false);
    expect(isCursorGrokBotSku("grok-3-mini")).toBe(false);
    expect(isCursorGrokBotSku("grok-2")).toBe(false);
    expect(isCursorGrokBotSku("SuperGrok Heavy")).toBe(false);
    expect(isCursorGrokBotSku("grok-heavy")).toBe(false);
    expect(isCursorGrokBotSku("claude-4-sonnet")).toBe(false);
    expect(isCursorGrokBotSku("api")).toBe(false);
    expect(isCursorGrokBotSku("agents")).toBe(false);
  });
});

describe("mapCursorUsageResponse", () => {
  it("maps 401 / 403 to expired and does not throw", () => {
    expect(() => mapCursorUsageResponse(401, "")).not.toThrow();
    const unauthorized = mapCursorUsageResponse(401, '{"error":"nope"}');
    expect(unauthorized.ok).toBe(false);
    expect(unauthorized.code).toBe("expired");
    expect(unauthorized.message).toMatch(/WorkosCursorSessionToken/);
    const forbidden = mapCursorUsageResponse(403, "forbidden");
    expect(forbidden.ok).toBe(false);
    expect(forbidden.code).toBe("expired");
  });

  it("maps period and aggregation HTTP 401/403 to expired", () => {
    expect(mapCursorPeriodResponse(401, "{}").code).toBe("expired");
    expect(mapCursorAggregatedResponse(403, "").code).toBe("expired");
  });

  it("maps malformed JSON to an error result", () => {
    const result = mapCursorUsageResponse(200, "<html>login</html>");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid");
  });

  it("parses a 200 JSON body without treating Other as a percent pool", () => {
    const result = mapCursorUsageResponse(200, JSON.stringify(SAMPLE_SUMMARY));
    expect(result.ok).toBe(true);
    const other = result.pools.find((pool) => pool.poolHint === "cursor_other");
    expect(other?.unit).toBe("USD");
    expect(other?.quotaTotal).toBe(400);
  });
});

describe("normalizeCursorSessionToken", () => {
  it("keeps raw sub::jwt", () => {
    expect(normalizeCursorSessionToken("user_01ABC::eyJhbGciOiJIUzI1NiJ9.e30.sig")).toBe(
      "user_01ABC::eyJhbGciOiJIUzI1NiJ9.e30.sig",
    );
  });

  it("decodes a pasted %3A%3A pair to :: and keeps the rest", () => {
    expect(normalizeCursorSessionToken("user_01ABC::session-value")).toBe("user_01ABC::session-value");
    expect(normalizeCursorSessionToken("user_01ABC%3A%3Asession-value")).toBe(
      "user_01ABC::session-value",
    );
    expect(normalizeCursorSessionToken("user_01ABC%3a%3asession-value")).toBe(
      "user_01ABC::session-value",
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

const TEAM_ID_REQUIRED_BODY = JSON.stringify({
  error: {
    message: "Team ID is required",
    details: [{ error: "ERROR_UNAUTHORIZED" }],
  },
});

const LIVE_LIKE_AGGREGATIONS_NO_BOT = {
  aggregations: [
    { modelIntent: "sand-default" },
    { modelIntent: "cursor-grok-4.6-high-fast" },
    { modelIntent: "claude-opus-5-low" },
    { modelIntent: "sand-automation" },
    { modelIntent: "gemini-2.5-flash" },
  ],
};

describe("mapCursorHttpStatus / isCursorSessionExpired", () => {
  it("does not treat 401 Team ID is required as expired", () => {
    expect(isCursorSessionExpired(401, TEAM_ID_REQUIRED_BODY)).toBe(false);
    const mapped = mapCursorHttpStatus(401, "Cursor filtered-usage-events", TEAM_ID_REQUIRED_BODY);
    expect(mapped?.ok).toBe(false);
    expect(mapped?.code).toBe("http");
    expect(mapped?.code).not.toBe("expired");
    expect(mapCursorUsageResponse(401, TEAM_ID_REQUIRED_BODY).code).toBe("http");
  });

  it("keeps 401 / 403 without that phrase as expired", () => {
    expect(isCursorSessionExpired(401, "")).toBe(true);
    expect(isCursorSessionExpired(401, '{"error":"nope"}')).toBe(true);
    expect(isCursorSessionExpired(403, "forbidden")).toBe(true);
    expect(mapCursorHttpStatus(401, "Cursor usage-summary", "")?.code).toBe("expired");
    expect(mapCursorHttpStatus(403, "Cursor usage-summary", '{"error":"nope"}')?.code).toBe(
      "expired",
    );
  });

  it("maps 405 to http, never expired", () => {
    const body = JSON.stringify({ error: "Method not allowed" });
    expect(isCursorSessionExpired(405, body)).toBe(false);
    const mapped = mapCursorHttpStatus(405, "Cursor current-period-usage", body);
    expect(mapped?.code).toBe("http");
    expect(mapped?.message).toMatch(/Method not allowed/);
    expect(mapCursorPeriodResponse(405, body).code).toBe("http");
    expect(mapCursorAggregatedResponse(405, body).code).not.toBe("expired");
  });
});

describe("finishCursorLiveRefresh", () => {
  it("merges period Models + Other when aggregations have no bot and filtered is 401 Team ID", () => {
    const eventsParsed = parseCursorJsonBody(
      401,
      TEAM_ID_REQUIRED_BODY,
      "Cursor filtered-usage-events",
    );
    expect("value" in eventsParsed).toBe(false);
    if (!("value" in eventsParsed)) expect(eventsParsed.code).toBe("http");

    const result = finishCursorLiveRefresh({
      period: SAMPLE_PERIOD,
      aggregations: LIVE_LIKE_AGGREGATIONS_NO_BOT,
      eventsParsed,
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe("ok");
    expect(result.botUnavailable).toBe(true);
    expect(result.pools.find((pool) => pool.poolHint === "cursor_models")).toMatchObject({
      quotaUsed: 42.5,
      quotaTotal: 100,
      unit: "%",
    });
    expect(result.pools.find((pool) => pool.poolHint === "cursor_other")).toMatchObject({
      quotaUsed: 12.5,
      quotaTotal: 400,
      unit: "USD",
    });
    expect(result.pools.find((pool) => pool.poolHint === "grok_bot")).toBeUndefined();
  });

  it("does not abort the merge when filtered returns empty 401 and period already parsed", () => {
    const eventsParsed = parseCursorJsonBody(401, "", "Cursor filtered-usage-events");
    expect("value" in eventsParsed).toBe(false);
    if (!("value" in eventsParsed)) expect(eventsParsed.code).toBe("expired");

    const result = finishCursorLiveRefresh({
      period: SAMPLE_PERIOD,
      aggregations: LIVE_LIKE_AGGREGATIONS_NO_BOT,
      eventsParsed,
    });
    expect(result.ok).toBe(true);
    expect(result.code).not.toBe("expired");
    expect(result.pools.map((pool) => pool.poolHint)).toEqual(["cursor_models", "cursor_other"]);
  });

  it("still returns expired when filtered 401 is the only payload", () => {
    const eventsParsed = parseCursorJsonBody(401, "", "Cursor filtered-usage-events");
    const result = finishCursorLiveRefresh({ eventsParsed });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("expired");
  });
});
