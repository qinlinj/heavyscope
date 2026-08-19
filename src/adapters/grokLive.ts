import { LIVE_PERCENT_TOTAL, LIVE_PERCENT_UNIT } from "./liveConstants";
import type { LivePoolUpdate, LiveProviderResult } from "./liveTypes";

type ProtoField = { number: number; wire: number; value: number | Uint8Array };

const BOT_NAME = /(grok[\s-]*bot|^bot$|\bagents?\b|api[\s-]*for[\s-]*bot)/i;

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

type ProductSegment = { name: string; percent: number };

function walkProducts(message: Uint8Array, out: ProductSegment[]): void {
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
    out.push({ name: names[0], percent: percents[0] });
  }
}

export function isBotProductName(name: string): boolean {
  return BOT_NAME.test(name.trim());
}

function unwrapGrpcWeb(body: Uint8Array): Uint8Array | null {
  if (body.length < 5) return body.length > 0 ? body : null;
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
    if (!isTrailer) messages.push(payload);
  }
  if (!sawFrame) return body;
  if (messages.length === 0) return null;
  if (messages.length === 1) return messages[0];
  const joined = new Uint8Array(messages.reduce((sum, item) => sum + item.length, 0));
  let offset = 0;
  for (const item of messages) {
    joined.set(item, offset);
    offset += item.length;
  }
  return joined;
}

/**
 * Loose protobuf walker for GetGrokCreditsConfig (see lsaether/grok-credits-tracker).
 * `credit_usage_percent` is field 1, fixed32 float. Omitted proto3 default = 0.
 * Never throws.
 */
export function parseGrokCreditsPayload(body: Uint8Array): LiveProviderResult {
  const message = unwrapGrpcWeb(body);
  if (!message) {
    return { ok: false, code: "invalid", message: "Grok credits response had no protobuf message", pools: [] };
  }

  const config = firstMessage(message, 1) ?? (iterFields(message) ? message : null);
  if (!config) {
    return { ok: false, code: "invalid", message: "Grok credits response was not valid protobuf", pools: [] };
  }

  const fields = iterFields(config);
  if (!fields) {
    return { ok: false, code: "invalid", message: "Grok credits protobuf could not be walked", pools: [] };
  }

  let creditUsagePercent = 0;
  let periodEnd: string | null = null;
  const products: ProductSegment[] = [];

  for (const field of fields) {
    if (field.number === 1 && field.wire === 5 && field.value instanceof Uint8Array) {
      creditUsagePercent = parseFloat32(field.value) ?? 0;
    } else if (field.number === 5 && field.wire === 2 && field.value instanceof Uint8Array) {
      periodEnd = parseTimestamp(field.value);
    } else if (field.wire === 2 && field.value instanceof Uint8Array && field.number !== 2 && field.number !== 3) {
      walkProducts(field.value, products);
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

  const bot = products.find((item) => isBotProductName(item.name));
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
      note: `Grok live sync (${bot.name})`,
      recordedAt: fetchedAt,
    });
  }

  return {
    ok: true,
    code: "ok",
    message: botUnavailable
      ? "Grok Heavy mapped; Bot live sync unavailable — calibrate manually"
      : "Grok credits mapped",
    pools,
    resetAt: periodEnd,
    botUnavailable,
  };
}

export function mapGrokCreditsResponse(status: number, body: Uint8Array): LiveProviderResult {
  if (status === 401 || status === 403) {
    return {
      ok: false,
      code: "expired",
      message: "Grok session expired or was rejected (HTTP " + status + ")",
      pools: [],
    };
  }
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      code: "http",
      message: `Grok credits request failed with HTTP ${status}`,
      pools: [],
    };
  }
  if (body.length === 0) {
    return { ok: false, code: "invalid", message: "Grok credits response was empty", pools: [] };
  }
  return parseGrokCreditsPayload(body);
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
