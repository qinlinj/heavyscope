import { LIVE_PERCENT_TOTAL, LIVE_PERCENT_UNIT } from "./liveConstants";
import type { LiveHistoryPoint, LivePoolUpdate, LiveProviderResult } from "./liveTypes";

type ProtoField = { number: number; wire: number; value: number | Uint8Array };

/**
 * Bot / Agents product names seen in grok.com Settings → Usage, CLI productUsage
 * (`Api`, SuperGrok Bot, Agents), and public trackers.
 * SuperGrok Heavy / GrokBuild / PRODUCT_GROK_BUILD stay on the Heavy meter.
 */
const BOT_NAME =
  /(super[\s-]*grok[\s-]*bot|grok[\s-]*bot|^bot$|\bagents?\b|^api$|\bapi\b|api[\s-]*for[\s-]*bots?|x\.com[\s-]*bots?|xai[\s-]*bots?|product[_-]*grok[_-]*(bot|agents?)|product[_-]*(bot|agents?))/i;
const HEAVY_NAME =
  /heavy|super[\s-]*grok(?![\s-]*bot)|product[_-]*grok[_-]*(build|heavy)|grok[\s_-]*build|^build$/i;

/** 1–6 documented; 7 product_usage; 8 current_period; 12 prepaid_balance. */
const KNOWN_CONFIG_FIELDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 12]);
const GRPC_UNAUTHENTICATED = 16;

export const GROK_NEEDS_BEARER =
  "Grok session expired or needs a Bearer token (gRPC 16 / unauthenticated). Cookie-only GetGrokCreditsConfig can fail; auto-refresh stays on.";

function readVarint(data: Uint8Array, pos: number): { value: number; pos: number } | null {
  let value = 0;
  let shift = 0;
  let cursor = pos;
  while (cursor < data.length) {
    const byte = data[cursor];
    cursor += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, pos: cursor };
    shift += 7;
    if (shift > 35) return null;
  }
  return null;
}

function iterFields(data: Uint8Array): ProtoField[] | null {
  const fields: ProtoField[] = [];
  let pos = 0;
  while (pos < data.length) {
    const key = readVarint(data, pos);
    if (!key) return null;
    const number = key.value >>> 3;
    const wire = key.value & 0x07;
    pos = key.pos;
    if (wire === 0) {
      const varint = readVarint(data, pos);
      if (!varint) return null;
      fields.push({ number, wire, value: varint.value });
      pos = varint.pos;
    } else if (wire === 1) {
      if (pos + 8 > data.length) return null;
      fields.push({ number, wire, value: data.subarray(pos, pos + 8) });
      pos += 8;
    } else if (wire === 2) {
      const length = readVarint(data, pos);
      if (!length) return null;
      pos = length.pos;
      if (pos + length.value > data.length) return null;
      fields.push({ number, wire, value: data.subarray(pos, pos + length.value) });
      pos += length.value;
    } else if (wire === 5) {
      if (pos + 4 > data.length) return null;
      fields.push({ number, wire, value: data.subarray(pos, pos + 4) });
      pos += 4;
    } else {
      return null;
    }
  }
  return fields;
}

function firstMessage(data: Uint8Array, fieldNo: number): Uint8Array | null {
  const fields = iterFields(data);
  if (!fields) return null;
  for (const field of fields) {
    if (field.number === fieldNo && field.wire === 2 && field.value instanceof Uint8Array) {
      return field.value;
    }
  }
  return null;
}

function parseFloat32(bytes: Uint8Array): number | null {
  if (bytes.length < 4) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const value = view.getFloat32(0, true);
  return Number.isFinite(value) ? value : null;
}

function parseTimestamp(message: Uint8Array | null): string | null {
  if (!message || message.length === 0) return null;
  const fields = iterFields(message);
  if (!fields) return null;
  let seconds = 0;
  let nanos = 0;
  for (const field of fields) {
    if (field.number === 1 && field.wire === 0 && typeof field.value === "number") seconds = field.value;
    if (field.number === 2 && field.wire === 0 && typeof field.value === "number") nanos = field.value;
  }
  if (!seconds) return null;
  return new Date(seconds * 1000 + nanos / 1_000_000).toISOString();
}

function isPrintableUtf8(bytes: Uint8Array): string | null {
  if (bytes.length === 0 || bytes.length > 200) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim()) return null;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) return null;
    }
    return text;
  } catch {
    return null;
  }
}

/** proto3 Cent / Money: field 1 varint (or numeric string). Empty message = 0. */
function parseCent(message: Uint8Array | null): number | null {
  if (!message) return null;
  if (message.length === 0) return 0;
  const fields = iterFields(message);
  if (!fields) return null;
  let cents: number | null = null;
  for (const field of fields) {
    if (field.number !== 1) return null;
    if (field.wire === 0 && typeof field.value === "number") cents = field.value;
    else if (field.wire === 2 && field.value instanceof Uint8Array) {
      const text = isPrintableUtf8(field.value);
      if (!text || !/^-?\d+$/.test(text)) return null;
      cents = Number(text);
    } else {
      return null;
    }
  }
  return cents;
}

function centsToUsd(cents: number | null): number | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return cents / 100;
}

function looksLikeTimestamp(message: Uint8Array): boolean {
  const fields = iterFields(message);
  if (!fields || fields.length === 0) return false;
  let seconds = 0;
  for (const field of fields) {
    if (field.number > 2) return false;
    if (field.number === 1 && field.wire === 0 && typeof field.value === "number") seconds = field.value;
  }
  return seconds >= 1_000_000_000;
}

function parseBillingCycle(message: Uint8Array): { year: number; month: number } | null {
  const fields = iterFields(message);
  if (!fields) return null;
  let year = 0;
  let month = 0;
  for (const field of fields) {
    if (field.number === 1 && field.wire === 0 && typeof field.value === "number") year = field.value;
    if (field.number === 2 && field.wire === 0 && typeof field.value === "number") month = field.value;
  }
  if (year < 2000 || month < 1 || month > 12) return null;
  return { year, month };
}

export type ProductSegment = { name: string; percent: number };

export type GrokHistoryPoint = {
  recordedAt?: string;
  year?: number;
  month?: number;
  percent?: number;
  onDemandUsedUsd?: number;
  includedUsedUsd?: number;
};

export type GrokBillingMeta = {
  onDemandCapUsd: number;
  onDemandUsedUsd: number;
  prepaidBalanceUsd: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  history: GrokHistoryPoint[];
};

function walkProducts(message: Uint8Array, out: ProductSegment[]): void {
  const entry = parseProductUsageMessage(message);
  if (entry) {
    out.push(entry);
    return;
  }
  const fields = iterFields(message);
  if (!fields) return;
  const names: string[] = [];
  const percents: number[] = [];
  for (const field of fields) {
    if (field.wire === 5 && field.value instanceof Uint8Array) {
      const percent = parseFloat32(field.value);
      if (percent != null) percents.push(percent);
    }
    if (field.wire === 2 && field.value instanceof Uint8Array) {
      const asString = isPrintableUtf8(field.value);
      if (asString) names.push(asString);
      else walkProducts(field.value, out);
    }
  }
  if (names.length > 0 && percents.length > 0) {
    const count = Math.max(names.length, percents.length);
    for (let i = 0; i < count; i += 1) {
      const percent = percents[i] ?? percents[0];
      if (percent == null) continue;
      out.push({ name: names[i] ?? names[0] ?? "", percent });
    }
  } else if (percents.length > 0) {
    for (const percent of percents) out.push({ name: "", percent });
  }
}

/**
 * GetGrokCreditsConfig field 7: `repeated ProductUsage product_usage`.
 * Product is a string or enum in live payloads; unofficial dumps type it as a
 * shopping Product message (name collision). Parse string, then nested strings,
 * then an unlabeled percent. Do not invent enum→name maps.
 */
function parseProductUsageMessage(message: Uint8Array): ProductSegment | null {
  const fields = iterFields(message);
  if (!fields || fields.length === 0) return null;
  let name = "";
  let percent: number | null = null;
  for (const field of fields) {
    if (field.number === 2 && field.wire === 5 && field.value instanceof Uint8Array) {
      percent = parseFloat32(field.value);
      continue;
    }
    if (field.number !== 1) continue;
    if (field.wire === 2 && field.value instanceof Uint8Array) {
      const asString = isPrintableUtf8(field.value);
      if (asString) name = asString;
      else {
        const nested = iterFields(field.value);
        if (nested) {
          for (const inner of nested) {
            if (inner.wire === 2 && inner.value instanceof Uint8Array) {
              const text = isPrintableUtf8(inner.value);
              if (text && !name) name = text;
            }
          }
        }
      }
    }
  }
  if (percent == null || !isPercentLike(percent)) return null;
  return { name, percent };
}

function parseUsagePeriod(message: Uint8Array): { start: string | null; end: string | null } {
  const fields = iterFields(message);
  if (!fields) return { start: null, end: null };
  let start: string | null = null;
  let end: string | null = null;
  for (const field of fields) {
    if (field.wire !== 2 || !(field.value instanceof Uint8Array)) continue;
    const stamp = looksLikeTimestamp(field.value) ? parseTimestamp(field.value) : null;
    if (!stamp) continue;
    if (field.number === 2 && !start) start = stamp;
    else if (field.number === 3 && !end) end = stamp;
    else if (!start) start = stamp;
    else if (!end) end = stamp;
  }
  return { start, end };
}

function isPercentLike(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function parsePeriodUsage(message: Uint8Array): GrokHistoryPoint {
  const fields = iterFields(message) ?? [];
  const point: GrokHistoryPoint = {};
  for (const field of fields) {
    if (field.wire === 5 && field.value instanceof Uint8Array) {
      const percent = parseFloat32(field.value);
      if (percent != null && isPercentLike(percent)) point.percent = percent;
      continue;
    }
    if (field.wire !== 2 || !(field.value instanceof Uint8Array)) continue;
    const cycle = parseBillingCycle(field.value);
    if (cycle) {
      point.year = cycle.year;
      point.month = cycle.month;
      point.recordedAt = `${cycle.year}-${String(cycle.month).padStart(2, "0")}-01T00:00:00.000Z`;
      continue;
    }
    if (looksLikeTimestamp(field.value)) {
      const stamp = parseTimestamp(field.value);
      if (stamp) {
        point.recordedAt = stamp;
        continue;
      }
    }
    const cents = parseCent(field.value);
    if (cents == null) {
      const nested = parsePeriodUsage(field.value);
      if (nested.percent != null) point.percent = nested.percent;
      if (nested.recordedAt) point.recordedAt = nested.recordedAt;
      if (nested.year) point.year = nested.year;
      if (nested.month) point.month = nested.month;
      if (nested.onDemandUsedUsd != null && point.onDemandUsedUsd == null) {
        point.onDemandUsedUsd = nested.onDemandUsedUsd;
      }
      if (nested.includedUsedUsd != null && point.includedUsedUsd == null) {
        point.includedUsedUsd = nested.includedUsedUsd;
      }
      continue;
    }
    const usd = cents / 100;
    if (field.number === 3 && point.includedUsedUsd == null) point.includedUsedUsd = usd;
    else if (point.onDemandUsedUsd == null) point.onDemandUsedUsd = usd;
    else if (point.includedUsedUsd == null) point.includedUsedUsd = usd;
  }
  return point;
}

export function isHeavyProductName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (isBotProductName(trimmed)) return false;
  return HEAVY_NAME.test(trimmed);
}

/**
 * Prefer a named Bot/Agents product. If the proto has a second percent /
 * remaining-style meter that is not Heavy, map that leftover segment to Bot.
 * Never invent a Bot number when only Heavy exists.
 */
export function pickBotProduct(
  products: ProductSegment[],
  heavyPercent: number,
): ProductSegment | null {
  const named = products.find((item) => isBotProductName(item.name));
  if (named) return named;

    const leftover = products.filter((item) => {
    if (isHeavyProductName(item.name)) return false;
    if (item.name.trim() && /heavy|grok[\s_-]*build|^build$/i.test(item.name) && !isBotProductName(item.name)) {
      return false;
    }
    return Math.abs(item.percent - heavyPercent) > 0.05;
  });
  if (leftover.length === 1) return leftover[0] ?? null;
  const unnamed = leftover.filter((item) => !item.name.trim());
  if (unnamed.length === 1 && leftover.length === unnamed.length) return unnamed[0] ?? null;
  return null;
}

export function isBotProductName(name: string): boolean {
  return BOT_NAME.test(name.trim());
}

/** Settings display: named product → Heavy / Bot, or unmapped. Never invents a percent. */
export function grokProductTarget(name: string): "grok_bot" | "grok_heavy" | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (isBotProductName(trimmed)) return "grok_bot";
  if (isHeavyProductName(trimmed)) return "grok_heavy";
  return null;
}

export function formatGrokProductLine(
  item: ProductSegment,
  labels: { bot: string; heavy: string; unnamed: string },
): string {
  const name = item.name.trim() || labels.unnamed;
  const percent = `${trimPercent(item.percent)}%`;
  const target = grokProductTarget(item.name);
  if (target === "grok_bot") return `${name} ${percent} → ${labels.bot}`;
  if (target === "grok_heavy") return `${name} ${percent} → ${labels.heavy}`;
  return `${name} ${percent}`;
}

function trimPercent(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function poolByHint(result: LiveProviderResult, hint: string): LivePoolUpdate | undefined {
  return result.pools.find((item) => item.poolHint === hint);
}

function mergeParsedProducts(left?: ProductSegment[], right?: ProductSegment[]): ProductSegment[] {
  const out: ProductSegment[] = [];
  const seen = new Set<string>();
  for (const item of [...(left ?? []), ...(right ?? [])]) {
    const key = `${item.name.trim().toLowerCase()}|${item.percent}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Combine GetGrokCreditsConfig proto with CLI billing JSON.
 * Heavy stays on creditUsagePercent (do not overwrite with GrokBuild 0).
 * If JSON has Bot/Api and proto does not, JSON wins for Bot.
 */
export function mergeGrokLiveResults(
  proto: LiveProviderResult,
  json: LiveProviderResult | null,
): LiveProviderResult {
  if (!json) return proto;
  if (!proto.ok && json.ok) return json;
  if (proto.ok && !json.ok) return proto;
  if (!proto.ok && !json.ok) {
    return proto.code === "expired" ? proto : json;
  }

  const protoBot = poolByHint(proto, "grok_bot");
  const jsonBot = poolByHint(json, "grok_bot");
  const heavy = poolByHint(proto, "grok_heavy") ?? poolByHint(json, "grok_heavy");
  const bot = jsonBot ?? protoBot;
  const products = mergeParsedProducts(proto.parsedProducts, json.parsedProducts);
  const billing = json.billing ?? proto.billing;
  const historyPoints = [
    ...(proto.historyPoints ?? []),
    ...(json.historyPoints ?? []),
  ];
  const pools: LivePoolUpdate[] = [];
  if (heavy) pools.push(heavy);
  if (bot) pools.push(bot);
  const botUnavailable = !bot;

  return {
    ok: true,
    code: "ok",
    message: botUnavailable
      ? "Grok Heavy mapped; Bot live sync unavailable — calibrate manually"
      : jsonBot && !protoBot
        ? "Grok credits mapped (Bot from CLI billing productUsage)"
        : "Grok credits mapped",
    pools,
    resetAt: proto.resetAt ?? json.resetAt,
    botUnavailable,
    parsedProducts: products,
    billing,
    historyPoints,
  };
}

export type GrpcWebDecoded = {
  message: Uint8Array | null;
  grpcStatus: number | null;
  grpcMessage: string;
};

function parseTrailerMap(payload: Uint8Array): Record<string, string> {
  const text = new TextDecoder().decode(payload);
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function headerLookup(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const want = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === want) return value;
  }
  return undefined;
}

export function decodeGrpcWeb(body: Uint8Array, headers?: Record<string, string>): GrpcWebDecoded {
  let grpcStatus = Number.parseInt(headerLookup(headers, "grpc-status") ?? "", 10);
  if (!Number.isFinite(grpcStatus)) grpcStatus = NaN;
  let grpcMessage = headerLookup(headers, "grpc-message") ?? "";

  if (body.length < 5) {
    return {
      message: body.length > 0 ? body : null,
      grpcStatus: Number.isFinite(grpcStatus) ? grpcStatus : null,
      grpcMessage,
    };
  }

  const messages: Uint8Array[] = [];
  let pos = 0;
  let sawFrame = false;
  while (pos + 5 <= body.length) {
    const flags = body[pos];
    const length = (body[pos + 1] << 24) | (body[pos + 2] << 16) | (body[pos + 3] << 8) | body[pos + 4];
    if (length < 0 || pos + 5 + length > body.length) break;
    pos += 5;
    const payload = body.subarray(pos, pos + length);
    pos += length;
    sawFrame = true;
    const isTrailer = (flags & 0x80) !== 0;
    if (isTrailer) {
      const trailers = parseTrailerMap(payload);
      const status = Number.parseInt(trailers["grpc-status"] ?? "", 10);
      if (Number.isFinite(status)) grpcStatus = status;
      if (trailers["grpc-message"]) grpcMessage = trailers["grpc-message"];
    } else {
      messages.push(payload);
    }
  }

  let message: Uint8Array | null = null;
  if (!sawFrame) message = body;
  else if (messages.length === 1) message = messages[0] ?? null;
  else if (messages.length > 1) {
    const joined = new Uint8Array(messages.reduce((sum, item) => sum + item.length, 0));
    let offset = 0;
    for (const item of messages) {
      joined.set(item, offset);
      offset += item.length;
    }
    message = joined;
  }

  return {
    message,
    grpcStatus: Number.isFinite(grpcStatus) ? grpcStatus : null,
    grpcMessage,
  };
}

export function isGrpcUnauthenticated(status: number | null, message = ""): boolean {
  if (status === GRPC_UNAUTHENTICATED) return true;
  return /unauthenticated|wke\s*=\s*unauthenticated|no-credentials/i.test(message);
}

function expiredNeedsBearer(detail?: string): LiveProviderResult {
  const suffix = detail?.trim() ? ` ${detail.trim()}` : "";
  return {
    ok: false,
    code: "expired",
    message: GROK_NEEDS_BEARER + suffix,
    pools: [],
  };
}

function historyPointsFromBilling(history: GrokHistoryPoint[]): LiveHistoryPoint[] {
  return history.flatMap((item) => {
    if (item.percent == null || !isPercentLike(item.percent) || !item.recordedAt) return [];
    return [
      {
        poolHint: "grok_heavy",
        quotaUsed: item.percent,
        recordedAt: item.recordedAt,
        note: "Grok history seed",
      },
    ];
  });
}

/**
 * Loose protobuf walker for GetGrokCreditsConfig (lsaether/grok-credits-tracker + vct-core).
 * 1 credit_usage_percent (fixed32) · 2 on_demand_cap · 3 on_demand_used
 * 4 billing_period_start · 5 billing_period_end · 6 history
 * 7 product_usage (repeated ProductUsage) · 8 current_period · 12 prepaid_balance
 * Never throws. Never invents Bot usage. Heavy stays on credit_usage_percent.
 */
export function parseGrokCreditsPayload(body: Uint8Array, headers?: Record<string, string>): LiveProviderResult {
  const decoded = decodeGrpcWeb(body, headers);
  if (isGrpcUnauthenticated(decoded.grpcStatus, decoded.grpcMessage)) {
    return expiredNeedsBearer(decoded.grpcMessage);
  }
  if (!decoded.message) {
    return { ok: false, code: "invalid", message: "Grok credits response had no protobuf message", pools: [] };
  }

  const config = firstMessage(decoded.message, 1) ?? (iterFields(decoded.message) ? decoded.message : null);
  if (!config) {
    return { ok: false, code: "invalid", message: "Grok credits response was not valid protobuf", pools: [] };
  }

  const fields = iterFields(config);
  if (!fields) {
    return { ok: false, code: "invalid", message: "Grok credits protobuf could not be walked", pools: [] };
  }

  let creditUsagePercent = 0;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let onDemandCapCents: number | null = null;
  let onDemandUsedCents: number | null = null;
  let prepaidBalanceCents: number | null = null;
  const products: ProductSegment[] = [];
  const history: GrokHistoryPoint[] = [];

  for (const field of fields) {
    if (field.number === 1 && field.wire === 5 && field.value instanceof Uint8Array) {
      creditUsagePercent = parseFloat32(field.value) ?? 0;
    } else if (field.number === 2 && field.wire === 2 && field.value instanceof Uint8Array) {
      onDemandCapCents = parseCent(field.value);
    } else if (field.number === 3 && field.wire === 2 && field.value instanceof Uint8Array) {
      onDemandUsedCents = parseCent(field.value);
    } else if (field.number === 4 && field.wire === 2 && field.value instanceof Uint8Array) {
      periodStart = parseTimestamp(field.value);
    } else if (field.number === 5 && field.wire === 2 && field.value instanceof Uint8Array) {
      periodEnd = parseTimestamp(field.value);
    } else if (field.number === 6 && field.wire === 2 && field.value instanceof Uint8Array) {
      history.push(parsePeriodUsage(field.value));
    } else if (field.number === 7 && field.wire === 2 && field.value instanceof Uint8Array) {
      walkProducts(field.value, products);
    } else if (field.number === 8 && field.wire === 2 && field.value instanceof Uint8Array) {
      const period = parseUsagePeriod(field.value);
      if (period.start && !periodStart) periodStart = period.start;
      if (period.end && !periodEnd) periodEnd = period.end;
    } else if (field.number === 12 && field.wire === 2 && field.value instanceof Uint8Array) {
      prepaidBalanceCents = parseCent(field.value);
    } else if (
      field.wire === 2 &&
      field.value instanceof Uint8Array &&
      !KNOWN_CONFIG_FIELDS.has(field.number)
    ) {
      const extraCent = parseCent(field.value);
      if (extraCent != null && prepaidBalanceCents == null) {
        prepaidBalanceCents = extraCent;
      } else if (extraCent == null) {
        const stamp = parseTimestamp(field.value);
        if (stamp && !periodEnd) periodEnd = stamp;
        else walkProducts(field.value, products);
      }
    }
  }

  const fetchedAt = new Date().toISOString();
  const pools: LivePoolUpdate[] = [
    {
      poolHint: "grok_heavy",
      quotaUsed: creditUsagePercent,
      quotaTotal: LIVE_PERCENT_TOTAL,
      resetAt: periodEnd,
      resetCycle: "weekly",
      unit: LIVE_PERCENT_UNIT,
      note: "Grok live sync",
      recordedAt: fetchedAt,
    },
  ];

  const bot = pickBotProduct(products, creditUsagePercent);
  let botUnavailable = true;
  if (bot) {
    botUnavailable = false;
    const label = bot.name.trim() || "second meter";
    pools.push({
      poolHint: "grok_bot",
      quotaUsed: bot.percent,
      quotaTotal: LIVE_PERCENT_TOTAL,
      resetAt: periodEnd,
      resetCycle: "weekly",
      unit: LIVE_PERCENT_UNIT,
      note: `Grok live sync (${label})`,
      recordedAt: fetchedAt,
    });
  }

  const billing: GrokBillingMeta = {
    onDemandCapUsd: centsToUsd(onDemandCapCents) ?? 0,
    onDemandUsedUsd: centsToUsd(onDemandUsedCents) ?? 0,
    prepaidBalanceUsd: centsToUsd(prepaidBalanceCents),
    periodStart,
    periodEnd,
    history,
  };
  const historyPoints = historyPointsFromBilling(history);

  return {
    ok: true,
    code: "ok",
    message: botUnavailable
      ? "Grok Heavy mapped; Bot live sync unavailable — calibrate manually"
      : "Grok credits mapped",
    pools,
    resetAt: periodEnd,
    botUnavailable,
    parsedProducts: products,
    billing,
    historyPoints,
  };
}

export function mapGrokCreditsResponse(
  status: number,
  body: Uint8Array,
  headers?: Record<string, string>,
): LiveProviderResult {
  if (status === 401 || status === 403) {
    return expiredNeedsBearer(`HTTP ${status}`);
  }
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      code: "http",
      message: `Grok credits request failed with HTTP ${status}`,
      pools: [],
    };
  }
  const headerStatus = Number.parseInt(headerLookup(headers, "grpc-status") ?? "", 10);
  const headerMessage = headerLookup(headers, "grpc-message") ?? "";
  if (isGrpcUnauthenticated(Number.isFinite(headerStatus) ? headerStatus : null, headerMessage)) {
    return expiredNeedsBearer(headerMessage);
  }
  if (body.length === 0) {
    return { ok: false, code: "invalid", message: "Grok credits response was empty", pools: [] };
  }
  return parseGrokCreditsPayload(body, headers);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export type GrokAuth = {
  sessionCookie?: string;
  bearerToken?: string;
};

export function normalizeGrokBearer(raw: string): string {
  const value = raw.trim().replace(/^["']|["']$/g, "");
  return value.replace(/^Bearer\s+/i, "");
}

export function grokCookieHeader(raw: string): string {
  return raw.trim().replace(/^Cookie:\s*/i, "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function readCent(value: unknown): number | null {
  const direct = readNumber(value);
  if (direct != null) return direct;
  const row = asRecord(value);
  if (!row) return null;
  return readNumber(row.val ?? row.value ?? row.cents);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * CLI proxy `GET /v1/billing?format=credits` JSON (xai-org/grok-build billing.rs).
 * Heavy from creditUsagePercent (shared Heavy meter — do not also write GrokBuild).
 * Bot from productUsage Api / Bot / Agents automatically.
 */
export function mapGrokCliBillingJson(raw: unknown): LiveProviderResult {
  const root = asRecord(raw);
  if (!root) {
    return { ok: false, code: "invalid", message: "Grok CLI billing JSON was not an object", pools: [] };
  }
  const config = asRecord(root.config) ?? root;
  const creditUsagePercent =
    readNumber(config.creditUsagePercent ?? config.credit_usage_percent) ?? 0;
  const currentPeriod = asRecord(config.currentPeriod ?? config.current_period);
  const periodEnd =
    readString(currentPeriod?.end) ??
    readString(config.billingPeriodEnd ?? config.billing_period_end);
  const periodStart =
    readString(currentPeriod?.start) ??
    readString(config.billingPeriodStart ?? config.billing_period_start);
  const onDemandCapCents = readCent(config.onDemandCap ?? config.on_demand_cap);
  const onDemandUsedCents = readCent(config.onDemandUsed ?? config.on_demand_used);
  const prepaidBalanceCents = readCent(config.prepaidBalance ?? config.prepaid_balance);

  const products: ProductSegment[] = [];
  const usageRows = config.productUsage ?? config.product_usage;
  if (Array.isArray(usageRows)) {
    for (const row of usageRows) {
      const item = asRecord(row);
      if (!item) continue;
      const name = readString(item.product ?? item.name) ?? "";
      const percent = readNumber(item.usagePercent ?? item.usage_percent ?? item.percent);
      if (percent == null) continue;
      products.push({ name, percent });
    }
  }

  const history: GrokHistoryPoint[] = [];
  if (Array.isArray(config.history)) {
    for (const row of config.history) {
      const item = asRecord(row);
      if (!item) continue;
      const cycle = asRecord(item.billingCycle ?? item.billing_cycle);
      const period = asRecord(item.period);
      const year = readNumber(cycle?.year);
      const month = readNumber(cycle?.month);
      const recordedAt =
        readString(period?.end) ??
        (year != null && month != null
          ? `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`
          : undefined);
      const percent = readNumber(item.usagePercent ?? item.usage_percent ?? item.creditUsagePercent);
      history.push({
        recordedAt,
        year: year ?? undefined,
        month: month ?? undefined,
        percent: percent != null && isPercentLike(percent) ? percent : undefined,
        onDemandUsedUsd: centsToUsd(readCent(item.onDemandUsed ?? item.on_demand_used)) ?? undefined,
        includedUsedUsd: centsToUsd(readCent(item.includedUsed ?? item.included_used)) ?? undefined,
      });
    }
  }

  const fetchedAt = new Date().toISOString();
  const pools: LivePoolUpdate[] = [
    {
      poolHint: "grok_heavy",
      quotaUsed: creditUsagePercent,
      quotaTotal: LIVE_PERCENT_TOTAL,
      resetAt: periodEnd,
      resetCycle: "weekly",
      unit: LIVE_PERCENT_UNIT,
      note: "Grok CLI billing sync",
      recordedAt: fetchedAt,
    },
  ];

  const bot = pickBotProduct(products, creditUsagePercent);
  let botUnavailable = true;
  if (bot) {
    botUnavailable = false;
    pools.push({
      poolHint: "grok_bot",
      quotaUsed: bot.percent,
      quotaTotal: LIVE_PERCENT_TOTAL,
      resetAt: periodEnd,
      resetCycle: "weekly",
      unit: LIVE_PERCENT_UNIT,
      note: `Grok CLI billing sync (${bot.name.trim() || "second meter"})`,
      recordedAt: fetchedAt,
    });
  }

  return {
    ok: true,
    code: "ok",
    message: botUnavailable
      ? "Grok Heavy mapped via CLI billing; Bot live sync unavailable — calibrate manually"
      : "Grok CLI billing mapped",
    pools,
    resetAt: periodEnd,
    botUnavailable,
    parsedProducts: products,
    billing: {
      onDemandCapUsd: centsToUsd(onDemandCapCents) ?? 0,
      onDemandUsedUsd: centsToUsd(onDemandUsedCents) ?? 0,
      prepaidBalanceUsd: centsToUsd(prepaidBalanceCents),
      periodStart,
      periodEnd,
      history,
    },
    historyPoints: historyPointsFromBilling(history),
  };
}

export function mapGrokCliBillingResponse(status: number, bodyText: string): LiveProviderResult {
  if (status === 401 || status === 403) {
    return expiredNeedsBearer(`CLI billing HTTP ${status}`);
  }
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      code: "http",
      message: `Grok CLI billing failed with HTTP ${status}`,
      pools: [],
    };
  }
  try {
    return mapGrokCliBillingJson(JSON.parse(bodyText) as unknown);
  } catch {
    return { ok: false, code: "invalid", message: "Grok CLI billing response was not JSON", pools: [] };
  }
}
