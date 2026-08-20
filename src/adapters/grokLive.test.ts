import { describe, expect, it } from "vitest";
import {
  hexToBytes,
  isBotProductName,
  mapGrokCreditsResponse,
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
});

/**
 * Config with Heavy 25% plus an unnamed second fixed32 40.0 (not Heavy).
 * Heuristic maps the leftover meter to Bot without inventing a third number.
 */
const SECOND_PERCENT_HEX = [
  "0a",
  "0c",
  "0d 00 00 c8 41",
  "3a 06",
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
  it("matches Bot / Grok Bot / SuperGrok Bot / Agents / API-for-bots and rejects Heavy", () => {
    expect(isBotProductName("Grok Bot")).toBe(true);
    expect(isBotProductName("SuperGrok Bot")).toBe(true);
    expect(isBotProductName("Bot")).toBe(true);
    expect(isBotProductName("Agents")).toBe(true);
    expect(isBotProductName("API for bots")).toBe(true);
    expect(isBotProductName("x.com bots")).toBe(true);
    expect(isBotProductName("API-for-bot")).toBe(true);
    expect(isBotProductName("SuperGrok Heavy")).toBe(false);
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
});
