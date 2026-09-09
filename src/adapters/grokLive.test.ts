import { describe, expect, it } from "vitest";
import {
  GROK_NEEDS_BEARER,
  formatGrokProductLine,
  grokProductTarget,
  hexToBytes,
  isBotProductName,
  isHeavyProductName,
  mapGrokCliBillingJson,
  mapGrokCreditsResponse,
  mergeGrokLiveResults,
  parseGrokCreditsPayload,
  pickBotProduct,
} from "./grokLive";

/**
 * gRPC-web unary frame wrapping GetGrokCreditsConfigResponse { config { } }.
 * Hex: flag 00 + length 00000002 + protobuf field 1 (len 0) = 0a 00
 * credit_usage_percent is omitted (proto3 default 0).
 */
const EMPTY_PERCENT_HEX = "00 00 00 00 02 0a 00";

/**
 * Same wrapper with config.credit_usage_percent = 25.0 (fixed32 LE 00 00 c8 41).
 * protobuf: 0a 05 0d 00 00 c8 41
 */
const PERCENT_25_HEX = "00 00 00 00 07 0a 05 0d 00 00 c8 41";

/**
 * Config with percent 12.5 plus a nested product message (field 7) named "Grok Bot"
 * with a fixed32 float 33.
 * "Grok Bot" = 47 72 6f 6b 20 42 6f 74
 */
const BOT_BREAKDOWN_HEX = [
  "0a", // field 1 length-delimited (config)
  "16", // config length 22
  "0d 00 00 48 41", // field 1 fixed32 = 12.5
  "3a", // field 7 length-delimited (synthetic product)
  "0f", // 15 bytes
  "0a 08 47 72 6f 6b 20 42 6f 74", // field 1 string "Grok Bot"
  "15 00 00 04 42", // field 2 fixed32 = 33.0
].join("");

describe("parseGrokCreditsPayload", () => {
  it("treats an omitted credit_usage_percent as 0", () => {
    const result = parseGrokCreditsPayload(hexToBytes(EMPTY_PERCENT_HEX));
    expect(result.ok).toBe(true);
    expect(result.pools[0]).toMatchObject({
      poolHint: "grok_heavy",
      quotaUsed: 0,
      quotaTotal: 100,
      unit: "%",
      resetCycle: "weekly",
    });
    expect(result.botUnavailable).toBe(true);
  });

  it("decodes a sample percent from the documented hex fixture", () => {
    const result = parseGrokCreditsPayload(hexToBytes(PERCENT_25_HEX));
    expect(result.ok).toBe(true);
    expect(result.pools[0]?.quotaUsed).toBeCloseTo(25, 5);
    expect(result.pools.some((pool) => pool.poolHint === "grok_bot")).toBe(false);
    expect(result.botUnavailable).toBe(true);
  });

  it("maps a Bot / Grok Bot product segment when present", () => {
    const result = parseGrokCreditsPayload(hexToBytes(BOT_BREAKDOWN_HEX));
    expect(result.ok).toBe(true);
    expect(result.pools[0]?.quotaUsed).toBeCloseTo(12.5, 5);
    const bot = result.pools.find((pool) => pool.poolHint === "grok_bot");
    expect(bot?.quotaUsed).toBeCloseTo(33, 5);
    expect(result.botUnavailable).toBe(false);
  });

  it("does not invent Bot numbers when no product breakdown exists", () => {
    const result = parseGrokCreditsPayload(hexToBytes(PERCENT_25_HEX));
    expect(result.pools.map((pool) => pool.poolHint)).toEqual(["grok_heavy"]);
  });

  it("maps SuperGrok Bot by name", () => {
    const result = parseGrokCreditsPayload(hexToBytes(SUPERGROK_BOT_HEX));
    expect(result.ok).toBe(true);
    const bot = result.pools.find((pool) => pool.poolHint === "grok_bot");
    expect(bot?.quotaUsed).toBeCloseTo(18, 5);
    expect(result.botUnavailable).toBe(false);
  });

  it("maps an unnamed second percent that is not Heavy", () => {
    const result = parseGrokCreditsPayload(hexToBytes(SECOND_PERCENT_HEX));
    expect(result.ok).toBe(true);
    expect(result.pools[0]?.quotaUsed).toBeCloseTo(25, 5);
    const bot = result.pools.find((pool) => pool.poolHint === "grok_bot");
    expect(bot?.quotaUsed).toBeCloseTo(40, 5);
    expect(result.parsedProducts?.some((item) => item.percent === 40 || Math.abs(item.percent - 40) < 0.01)).toBe(
      true,
    );
  });

  it("returns an error result for empty / malformed bytes without throwing", () => {
    expect(() => parseGrokCreditsPayload(new Uint8Array())).not.toThrow();
    const empty = parseGrokCreditsPayload(new Uint8Array());
    expect(empty.ok).toBe(false);
    const junk = parseGrokCreditsPayload(new Uint8Array([0xff, 0xff, 0xff]));
    expect(junk.ok).toBe(false);
  });
});

describe("mapGrokCreditsResponse", () => {
  it("maps 401 to expired without throwing", () => {
    const result = mapGrokCreditsResponse(401, new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("expired");
    expect(result.pools).toEqual([]);
  });

  it("treats HTTP 200 + grpc-status 16 as expired and keeps the needs-bearer message", () => {
    const fromHeader = mapGrokCreditsResponse(200, hexToBytes(PERCENT_25_HEX), {
      "grpc-status": "16",
      "grpc-message": "WKE=unauthenticated",
    });
    expect(fromHeader.ok).toBe(false);
    expect(fromHeader.code).toBe("expired");
    expect(fromHeader.message).toContain("gRPC 16");
    expect(fromHeader.message.startsWith(GROK_NEEDS_BEARER.slice(0, 20))).toBe(true);

    const trailer = "grpc-status:16\r\ngrpc-message:unauthenticated\r\n";
    const trailerBytes = new TextEncoder().encode(trailer);
    const body = new Uint8Array([
      ...[0x80, 0, 0, 0, trailerBytes.length],
      ...trailerBytes,
    ]);
    const fromTrailer = mapGrokCreditsResponse(200, body);
    expect(fromTrailer.ok).toBe(false);
    expect(fromTrailer.code).toBe("expired");
    expect(fromTrailer.message).toContain("needs a Bearer");
  });
});

/**
 * Config with Heavy 25% plus an unnamed second fixed32 40.0 (not Heavy).
 * Heuristic maps the leftover meter to Bot without inventing a third number.
 */
const SECOND_PERCENT_HEX = [
  "0a",
  "0c",
  "0d 00 00 c8 41",
  "3a 05",
  "15 00 00 20 42",
].join("");

/**
 * Nested product named "SuperGrok Bot" with percent 18.
 * SuperGrok Bot = 53 75 70 65 72 47 72 6f 6b 20 42 6f 74
 */
const SUPERGROK_BOT_HEX = [
  "0a",
  "1b",
  "0d 00 00 48 41",
  "3a",
  "14",
  "0a 0d 53 75 70 65 72 47 72 6f 6b 20 42 6f 74",
  "15 00 00 90 41",
].join("");

describe("isBotProductName", () => {
  it("matches Bot / Grok Bot / SuperGrok Bot / Agents / Api / API-for-bots and rejects Heavy", () => {
    expect(isBotProductName("Grok Bot")).toBe(true);
    expect(isBotProductName("SuperGrok Bot")).toBe(true);
    expect(isBotProductName("Bot")).toBe(true);
    expect(isBotProductName("Agents")).toBe(true);
    expect(isBotProductName("Api")).toBe(true);
    expect(isBotProductName("API")).toBe(true);
    expect(isBotProductName("API for bots")).toBe(true);
    expect(isBotProductName("x.com bots")).toBe(true);
    expect(isBotProductName("API-for-bot")).toBe(true);
    expect(isBotProductName("PRODUCT_GROK_BOT")).toBe(true);
    expect(isBotProductName("PRODUCT_GROK_AGENTS")).toBe(true);
    expect(isBotProductName("SuperGrok Heavy")).toBe(false);
    expect(isBotProductName("PRODUCT_GROK_BUILD")).toBe(false);
    expect(isBotProductName("GrokBuild")).toBe(false);
    expect(isBotProductName("GROK_CHAT")).toBe(false);
    expect(isBotProductName("product_usage")).toBe(false);
  });
});

describe("isHeavyProductName", () => {
  it("matches Heavy / GrokBuild / Build and rejects Bot / Api", () => {
    expect(isHeavyProductName("SuperGrok Heavy")).toBe(true);
    expect(isHeavyProductName("GrokBuild")).toBe(true);
    expect(isHeavyProductName("PRODUCT_GROK_BUILD")).toBe(true);
    expect(isHeavyProductName("Build")).toBe(true);
    expect(isHeavyProductName("Api")).toBe(false);
    expect(isHeavyProductName("Grok Bot")).toBe(false);
  });
});

describe("grokProductTarget", () => {
  it("maps Api to Bot and GrokBuild to Heavy for Settings display", () => {
    expect(grokProductTarget("Api")).toBe("grok_bot");
    expect(grokProductTarget("GrokBuild")).toBe("grok_heavy");
    expect(grokProductTarget("Chat")).toBeNull();
    expect(grokProductTarget("")).toBeNull();
  });

  it("formats Settings lines without inventing unmapped percents", () => {
    const labels = { bot: "Grok Bot", heavy: "Grok Heavy", unnamed: "Unnamed" };
    expect(formatGrokProductLine({ name: "Api", percent: 11 }, labels)).toBe("Api 11% → Grok Bot");
    expect(formatGrokProductLine({ name: "GrokBuild", percent: 0 }, labels)).toBe("GrokBuild 0% → Grok Heavy");
    expect(formatGrokProductLine({ name: "Chat", percent: 3.4 }, labels)).toBe("Chat 3.4%");
  });
});

describe("pickBotProduct", () => {
  it("maps a second non-Heavy percent even without a perfect name", () => {
    const bot = pickBotProduct(
      [
        { name: "SuperGrok Heavy", percent: 12.5 },
        { name: "", percent: 40 },
      ],
      12.5,
    );
    expect(bot?.percent).toBe(40);
  });

  it("does not invent Bot when only Heavy exists", () => {
    expect(pickBotProduct([{ name: "SuperGrok Heavy", percent: 25 }], 25)).toBeNull();
    expect(pickBotProduct([], 25)).toBeNull();
  });

  it("does not map GetGrokCreditsConfig GROK_CHAT 12% (or product_usage enum) to Bot", () => {
    expect(pickBotProduct([{ name: "GROK_CHAT", percent: 12 }], 12)).toBeNull();
    expect(pickBotProduct([{ name: "GROK_CHAT", percent: 12 }], 25)).toBeNull();
    expect(pickBotProduct([{ name: "SuperGrok Heavy", percent: 12 }, { name: "GROK_CHAT", percent: 12 }], 12)).toBeNull();
    expect(grokProductTarget("GROK_CHAT")).toBeNull();
  });
});

function encodeVarint(n: number): number[] {
  const out: number[] = [];
  let value = n >>> 0;
  while (value > 0x7f) {
    out.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  out.push(value);
  return out;
}

function fieldKey(number: number, wire: number): number[] {
  return encodeVarint((number << 3) | wire);
}

function encodeLen(field: number, bytes: number[]): number[] {
  return [...fieldKey(field, 2), ...encodeVarint(bytes.length), ...bytes];
}

function encodeVar(field: number, value: number): number[] {
  return [...fieldKey(field, 0), ...encodeVarint(value)];
}

function encodeF32(field: number, value: number): number[] {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, value, true);
  return [...fieldKey(field, 5), ...new Uint8Array(buf)];
}

function encodeStr(field: number, text: string): number[] {
  const bytes = [...new TextEncoder().encode(text)];
  return [...fieldKey(field, 2), ...encodeVarint(bytes.length), ...bytes];
}

function grpcFrame(payload: number[], flags = 0): Uint8Array {
  const len = payload.length;
  return new Uint8Array([flags, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff, ...payload]);
}

describe("GetGrokCreditsConfig fields 2–6", () => {
  it("walks on-demand money, billing window, prepaid Cent, and cents-only history without seeding Heavy", () => {
    const money50 = encodeVar(1, 5000);
    const money12 = encodeVar(1, 1234);
    const prepaid = encodeVar(1, 750);
    const start = encodeVar(1, 1_700_000_000);
    const end = encodeVar(1, 1_700_604_800);
    const cycle = [...encodeVar(1, 2026), ...encodeVar(2, 7)];
    const history = [...encodeLen(1, cycle), ...encodeLen(2, encodeVar(1, 100))];
    const config = [
      ...encodeF32(1, 25),
      ...encodeLen(2, money50),
      ...encodeLen(3, money12),
      ...encodeLen(4, start),
      ...encodeLen(5, end),
      ...encodeLen(6, history),
      ...encodeLen(12, prepaid),
    ];
    const body = grpcFrame(encodeLen(1, config));
    const result = parseGrokCreditsPayload(body);
    expect(result.ok).toBe(true);
    expect(result.pools[0]?.quotaUsed).toBeCloseTo(25, 5);
    expect(result.pools.some((pool) => pool.poolHint === "grok_bot")).toBe(false);
    expect(result.billing?.onDemandCapUsd).toBeCloseTo(50, 5);
    expect(result.billing?.onDemandUsedUsd).toBeCloseTo(12.34, 5);
    expect(result.billing?.prepaidBalanceUsd).toBeCloseTo(7.5, 5);
    expect(result.billing?.periodEnd).toBe(new Date(1_700_604_800 * 1000).toISOString());
    expect(result.billing?.history).toHaveLength(1);
    expect(result.billing?.history[0]?.onDemandUsedUsd).toBeCloseTo(1, 5);
    expect(result.historyPoints).toEqual([]);
  });

  it("seeds Heavy history deltas only when a history point has a percent", () => {
    const cycle = [...encodeVar(1, 2026), ...encodeVar(2, 6)];
    const history = [...encodeLen(1, cycle), ...encodeF32(3, 18)];
    const config = [...encodeF32(1, 22), ...encodeLen(6, history)];
    const result = parseGrokCreditsPayload(grpcFrame(encodeLen(1, config)));
    expect(result.ok).toBe(true);
    expect(result.historyPoints).toHaveLength(1);
    expect(result.historyPoints?.[0]?.poolHint).toBe("grok_heavy");
    expect(result.historyPoints?.[0]?.quotaUsed).toBeCloseTo(18, 5);
    expect(result.historyPoints?.[0]?.recordedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(result.pools.some((pool) => pool.poolHint === "grok_bot")).toBe(false);
  });

  it("parses field 7 product_usage string Api as Bot without using GrokBuild as Heavy", () => {
    const api = [...encodeStr(1, "Api"), ...encodeF32(2, 11)];
    const build = [...encodeStr(1, "GrokBuild"), ...encodeF32(2, 0)];
    const config = [...encodeF32(1, 11.2), ...encodeLen(7, api), ...encodeLen(7, build)];
    const result = parseGrokCreditsPayload(grpcFrame(encodeLen(1, config)));
    expect(result.ok).toBe(true);
    expect(result.pools.find((pool) => pool.poolHint === "grok_heavy")?.quotaUsed).toBeCloseTo(11.2, 5);
    expect(result.pools.find((pool) => pool.poolHint === "grok_bot")?.quotaUsed).toBeCloseTo(11, 5);
    expect(result.botUnavailable).toBe(false);
    expect(result.parsedProducts).toEqual([
      { name: "Api", percent: 11 },
      { name: "GrokBuild", percent: 0 },
    ]);
  });
});

describe("mapGrokCliBillingJson", () => {
  it("maps creditUsagePercent and surfaces money/history without inventing Bot", () => {
    const result = mapGrokCliBillingJson({
      config: {
        creditUsagePercent: 42.5,
        currentPeriod: {
          type: "USAGE_PERIOD_TYPE_WEEKLY",
          start: "2026-06-01T00:00:00Z",
          end: "2026-06-08T00:00:00Z",
        },
        onDemandCap: { val: 5000 },
        onDemandUsed: { val: 300 },
        prepaidBalance: { val: 1250 },
        productUsage: [{ product: "PRODUCT_GROK_BUILD", usagePercent: 61.2 }],
        history: [
          {
            period: { start: "2026-05-25T00:00:00Z", end: "2026-06-01T00:00:00Z" },
            onDemandUsed: { val: 120 },
          },
          {
            billingCycle: { year: 2026, month: 5 },
            usagePercent: 11,
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.pools[0]).toMatchObject({
      poolHint: "grok_heavy",
      quotaUsed: 42.5,
      resetAt: "2026-06-08T00:00:00Z",
    });
    expect(result.botUnavailable).toBe(true);
    expect(result.billing?.prepaidBalanceUsd).toBeCloseTo(12.5, 5);
    expect(result.historyPoints).toEqual([
      {
        poolHint: "grok_heavy",
        quotaUsed: 11,
        recordedAt: "2026-05-01T00:00:00.000Z",
        note: "Grok history seed",
      },
    ]);
  });

  it("maps PRODUCT_GROK_BOT to Bot when present", () => {
    const result = mapGrokCliBillingJson({
      config: {
        creditUsagePercent: 10,
        productUsage: [{ product: "PRODUCT_GROK_BOT", usagePercent: 4 }],
      },
    });
    expect(result.pools.find((pool) => pool.poolHint === "grok_bot")?.quotaUsed).toBe(4);
    expect(result.botUnavailable).toBe(false);
  });

  it("maps documented CLI billing JSON: Api → Bot, Heavy from creditUsagePercent", () => {
    const result = mapGrokCliBillingJson({
      config: {
        creditUsagePercent: 11.2,
        currentPeriod: { type: "WEEKLY", start: "2026-08-17T00:00:00Z", end: "2026-08-24T00:00:00Z" },
        productUsage: [
          { product: "Api", usagePercent: 11 },
          { product: "GrokBuild", usagePercent: 0 },
        ],
        onDemandCap: { val: 0 },
        onDemandUsed: { val: 0 },
        prepaidBalance: { val: 0 },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.pools.find((pool) => pool.poolHint === "grok_heavy")?.quotaUsed).toBeCloseTo(11.2, 5);
    const bot = result.pools.find((pool) => pool.poolHint === "grok_bot");
    expect(bot?.quotaUsed).toBe(11);
    expect(bot?.note).toMatch(/Api/i);
    expect(result.botUnavailable).toBe(false);
    expect(result.parsedProducts).toEqual([
      { name: "Api", percent: 11 },
      { name: "GrokBuild", percent: 0 },
    ]);
    expect(result.pools.filter((pool) => pool.poolHint === "grok_heavy")).toHaveLength(1);
  });

  it("does not invent Bot when productUsage is only GrokBuild", () => {
    const result = mapGrokCliBillingJson({
      config: {
        creditUsagePercent: 42.5,
        productUsage: [{ product: "GrokBuild", usagePercent: 0 }],
      },
    });
    expect(result.botUnavailable).toBe(true);
    expect(result.pools.map((pool) => pool.poolHint)).toEqual(["grok_heavy"]);
  });
});

describe("mergeGrokLiveResults", () => {
  it("lets CLI JSON Bot win when proto has only Heavy", () => {
    const proto = mapGrokCliBillingJson({
      config: { creditUsagePercent: 11.2, productUsage: [{ product: "GrokBuild", usagePercent: 0 }] },
    });
    const json = mapGrokCliBillingJson({
      config: {
        creditUsagePercent: 11.2,
        productUsage: [
          { product: "Api", usagePercent: 11 },
          { product: "GrokBuild", usagePercent: 0 },
        ],
      },
    });
    const merged = mergeGrokLiveResults(proto, json);
    expect(merged.ok).toBe(true);
    expect(merged.pools.find((pool) => pool.poolHint === "grok_bot")?.quotaUsed).toBe(11);
    expect(merged.pools.find((pool) => pool.poolHint === "grok_heavy")?.quotaUsed).toBeCloseTo(11.2, 5);
    expect(merged.botUnavailable).toBe(false);
    expect(merged.message).toMatch(/CLI billing/i);
  });

  it("keeps proto when CLI JSON fails", () => {
    const proto = parseGrokCreditsPayload(hexToBytes(PERCENT_25_HEX));
    const failed = { ok: false as const, code: "http" as const, message: "CLI down", pools: [] };
    const merged = mergeGrokLiveResults(proto, failed);
    expect(merged.ok).toBe(true);
    expect(merged.pools[0]?.quotaUsed).toBeCloseTo(25, 5);
    expect(merged.botUnavailable).toBe(true);
  });
});
