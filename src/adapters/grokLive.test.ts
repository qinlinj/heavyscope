import { describe, expect, it } from "vitest";
import {
  hexToBytes,
  isBotProductName,
  mapGrokCreditsResponse,
  parseGrokCreditsPayload,
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

describe("isBotProductName", () => {
  it("matches Bot / Grok Bot / Agents / API-for-bot and rejects Heavy", () => {
    expect(isBotProductName("Grok Bot")).toBe(true);
    expect(isBotProductName("Bot")).toBe(true);
    expect(isBotProductName("Agents")).toBe(true);
    expect(isBotProductName("API-for-bot")).toBe(true);
    expect(isBotProductName("SuperGrok Heavy")).toBe(false);
  });
});
