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
  mapCursorSandResponse,
  mapCursorSandUsage,
  mapCursorUsageResponse,
  mapCursorUsageSummary,
  mergeCursorSpendingSources,
  normalizeCursorSessionToken,
  parseCursorJsonBody,
  sandRemainingPercent,
  sandUsageRequestBody,
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

/** Live get-sand-usage-status fixture (2026-08-21 PT). No used/remaining/limit on the wire. */
const SAMPLE_SAND = {
  usagePercent: 21.473078,
  currentPeriodStart: "2026-08-17T01:40:00.748Z",
  nextResetTimestampUtc: "2026-08-24T01:40:00.748Z",
  hasAvailableUsage: true,
  hasNonZeroIncludedLimit: true,
};

const LIVE_LIKE_AGGREGATIONS_NO_BOT = {
  aggregations: [
    { modelIntent: "sand-default" },
    { modelIntent: "cursor-grok-4.6-high-fast" },
    { modelIntent: "claude-opus-5-low" },
    { modelIntent: "sand-automation" },
    { modelIntent: "gemini-2.5-flash" },
  ],
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

  it("ignores disabled onDemand.used=0 so it cannot become Other 0%", () => {
    const result = mapCursorUsageSummary({
      individualUsage: {
        plan: { autoPercentUsed: 10, apiPercentUsed: 0 },
        onDemand: { enabled: false, used: 0, limit: 40000 },
      },
    });
    expect(result.pools.find((pool) => pool.poolHint === "cursor_other")).toBeUndefined();
    expect(result.pools.map((pool) => pool.poolHint)).toEqual(["cursor_models"]);
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

  it("maps period Other as $126.58 / $400 and ignores disabled onDemand.used=0", () => {
    const result = mergeCursorSpendingSources({
      period: {
        planUsage: {
          autoPercentUsed: 21.4,
          apiPercentUsed: 0,
          totalSpend: 12658,
          limit: 40000,
          used: 0,
        },
        individualUsage: {
          plan: { autoPercentUsed: 21.4, apiPercentUsed: 0, used: 0 },
          onDemand: { enabled: false, used: 0, limit: 40000 },
        },
      },
      summary: {
        individualUsage: {
          plan: { autoPercentUsed: 21.4, apiPercentUsed: 0 },
          onDemand: { enabled: false, used: 0, limit: 40000 },
        },
      },
    });
    const other = result.pools.find((pool) => pool.poolHint === "cursor_other");
    expect(other).toMatchObject({
      quotaUsed: 126.58,
      quotaTotal: 400,
      unit: "USD",
    });
    expect(other?.quotaUsed).not.toBe(0);
    expect(other?.quotaTotal).not.toBe(100);
    expect(other?.unit).not.toBe("%");
    expect(other?.note).toMatch(/Cursor period/i);
  });

  it("does not map apiPercentUsed=0 as Other 0%", () => {
    const result = mergeCursorSpendingSources({
      period: {
        planUsage: {
          autoPercentUsed: 10,
          apiPercentUsed: 0,
          totalSpend: 12658,
          limit: 40000,
        },
      },
    });
    const other = result.pools.find((pool) => pool.poolHint === "cursor_other");
    expect(other?.quotaUsed).toBe(126.58);
    expect(other?.quotaUsed).not.toBe(0);
    expect(other?.quotaTotal).toBe(400);
    expect(other?.unit).toBe("USD");
  });

  it("shows honest $0 / $400 when period totalSpend is truly 0", () => {
    const result = mergeCursorSpendingSources({
      period: {
        planUsage: { autoPercentUsed: 1, apiPercentUsed: 0, totalSpend: 0, limit: 40000 },
      },
      summary: {
        individualUsage: {
          plan: { autoPercentUsed: 1, apiPercentUsed: 0 },
          onDemand: { enabled: false, used: 0, limit: 40000 },
        },
      },
    });
    expect(result.pools.find((pool) => pool.poolHint === "cursor_other")).toMatchObject({
      quotaUsed: 0,
      quotaTotal: 400,
      unit: "USD",
    });
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

  it("maps SAND weekly % onto Grok Bot and keeps Models + Other", () => {
    const result = mergeCursorSpendingSources({
      period: SAMPLE_PERIOD,
      aggregations: LIVE_LIKE_AGGREGATIONS_NO_BOT,
      sand: SAMPLE_SAND,
    });
    expect(result.ok).toBe(true);
    expect(result.botUnavailable).toBe(false);
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
    const bot = result.pools.find((pool) => pool.poolHint === "grok_bot");
    expect(bot).toMatchObject({
      quotaUsed: 21.473078,
      quotaTotal: 100,
      unit: "%",
      resetCycle: "weekly",
      resetAt: "2026-08-24T01:40:00.748Z",
    });
    expect(sandRemainingPercent(bot!.quotaUsed)).toBeCloseTo(78.526922, 5);
  });

  it("prefers SAND weekly % over a grok-bot SKU dollar row", () => {
    const result = mergeCursorSpendingSources({
      period: SAMPLE_PERIOD,
      aggregations: SAMPLE_AGGREGATIONS,
      sand: SAMPLE_SAND,
    });
    const bot = result.pools.find((pool) => pool.poolHint === "grok_bot");
    expect(bot).toMatchObject({
      quotaUsed: 21.473078,
      quotaTotal: 100,
      unit: "%",
    });
    expect(bot?.quotaUsed).not.toBe(3.3);
    expect(bot?.unit).not.toBe("USD");
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
    expect(isCursorGrokBotSku("cursor-grok-4.6-high")).toBe(false);
    expect(isCursorGrokBotSku("cursor-grok-*")).toBe(false);
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

  it("maps GET/HTTP 405 on sand as http, not expired, and still applies Models + Other", () => {
    const body = JSON.stringify({ error: "Method not allowed" });
    expect(isCursorSessionExpired(405, body)).toBe(false);
    expect(mapCursorHttpStatus(405, "Cursor sand-usage-status", body)?.code).toBe("http");
    expect(mapCursorSandResponse(405, body).code).toBe("http");
    expect(mapCursorSandResponse(405, body).code).not.toBe("expired");
    expect(mapCursorSandResponse(401, TEAM_ID_REQUIRED_BODY).code).toBe("http");

    const sandParsed = parseCursorJsonBody(405, body, "Cursor sand-usage-status");
    expect("value" in sandParsed).toBe(false);
    if (!("value" in sandParsed)) expect(sandParsed.code).toBe("http");

    const result = finishCursorLiveRefresh({
      period: SAMPLE_PERIOD,
      aggregations: LIVE_LIKE_AGGREGATIONS_NO_BOT,
      sandParsed,
    });
    expect(result.ok).toBe(true);
    expect(result.code).not.toBe("expired");
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

  it("marks Bot unavailable on real SAND 401 and does not wipe Models + Other", () => {
    const sandParsed = parseCursorJsonBody(401, "", "Cursor sand-usage-status");
    expect("value" in sandParsed).toBe(false);
    if (!("value" in sandParsed)) expect(sandParsed.code).toBe("expired");

    const result = finishCursorLiveRefresh({
      period: SAMPLE_PERIOD,
      aggregations: LIVE_LIKE_AGGREGATIONS_NO_BOT,
      sandParsed,
    });
    expect(result.ok).toBe(true);
    expect(result.code).not.toBe("expired");
    expect(result.botUnavailable).toBe(true);
    expect(result.pools.map((pool) => pool.poolHint)).toEqual(["cursor_models", "cursor_other"]);
    expect(result.pools.find((pool) => pool.poolHint === "grok_bot")).toBeUndefined();
  });

  it("applies SAND Bot % when period Models + Other already parsed", () => {
    const sandParsed = parseCursorJsonBody(200, JSON.stringify(SAMPLE_SAND), "Cursor sand-usage-status");
    const result = finishCursorLiveRefresh({
      period: SAMPLE_PERIOD,
      aggregations: LIVE_LIKE_AGGREGATIONS_NO_BOT,
      sandParsed,
    });
    expect(result.ok).toBe(true);
    expect(result.botUnavailable).toBe(false);
    expect(result.pools.find((pool) => pool.poolHint === "grok_bot")).toMatchObject({
      quotaUsed: 21.473078,
      quotaTotal: 100,
      unit: "%",
      resetAt: "2026-08-24T01:40:00.748Z",
    });
  });
});

describe("mapCursorSandUsage", () => {
  it("parses the live JSON to used%, remaining%, and nextResetTimestampUtc", () => {
    expect(sandUsageRequestBody()).toBe("{}");
    const mapped = mapCursorSandUsage(SAMPLE_SAND, "2026-08-21T18:00:00.000Z");
    expect(mapped).toMatchObject({
      poolHint: "grok_bot",
      quotaUsed: 21.473078,
      quotaTotal: 100,
      unit: "%",
      resetCycle: "weekly",
      resetAt: "2026-08-24T01:40:00.748Z",
      recordedAt: "2026-08-21T18:00:00.000Z",
    });
    expect(sandRemainingPercent(21.473078)).toBeCloseTo(78.526922, 5);
    expect(sandRemainingPercent(110)).toBe(0);
    expect(sandRemainingPercent(-5)).toBe(100);
  });

  it("does not invent used/remaining/limit counts when those keys are absent", () => {
    expect(SAMPLE_SAND).not.toHaveProperty("used");
    expect(SAMPLE_SAND).not.toHaveProperty("remaining");
    expect(SAMPLE_SAND).not.toHaveProperty("limit");
    expect(SAMPLE_SAND).not.toHaveProperty("includedLimitZero");
    const mapped = mapCursorSandUsage(SAMPLE_SAND);
    expect(mapped?.quotaUsed).toBe(21.473078);
    expect(mapped?.quotaTotal).toBe(100);
    expect(mapped?.unit).toBe("%");
    expect(mapped).not.toHaveProperty("used");
    expect(mapped).not.toHaveProperty("remaining");
    expect(mapped).not.toHaveProperty("limit");
  });

  it("ignores stuffed used/remaining/limit integers and availability flags as amounts", () => {
    const polluted = mapCursorSandUsage({
      ...SAMPLE_SAND,
      used: 999,
      remaining: 1,
      limit: 50,
      includedLimitZero: false,
      availableBankedResetCount: 3,
      hasAvailableUsage: true,
      hasNonZeroIncludedLimit: true,
    });
    expect(polluted?.quotaUsed).toBe(21.473078);
    expect(polluted?.quotaTotal).toBe(100);
    expect(polluted?.quotaUsed).not.toBe(999);
    expect(polluted?.quotaTotal).not.toBe(50);
    expect(mapCursorSandUsage({ hasAvailableUsage: true, hasNonZeroIncludedLimit: true })).toBeNull();
  });

  it("prefers nextResetTimestampUtc and falls back to currentPeriodStart", () => {
    expect(
      mapCursorSandUsage({
        usagePercent: 10,
        currentPeriodStart: "2026-08-17T01:40:00.748Z",
      })?.resetAt,
    ).toBe("2026-08-17T01:40:00.748Z");
  });
});
