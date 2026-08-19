import { LIVE_PERCENT_TOTAL, LIVE_PERCENT_UNIT } from "./liveConstants";
import type { LivePoolUpdate, LiveProviderResult } from "./liveTypes";

export type CursorUsageSummary = {
  billingCycleStart?: string;
  billingCycleEnd?: string;
  membershipType?: string;
  autoModelSelectedDisplayMessage?: string;
  namedModelSelectedDisplayMessage?: string;
  individualUsage?: {
    plan?: {
      autoPercentUsed?: number;
      apiPercentUsed?: number;
      totalPercentUsed?: number;
      enabled?: boolean;
    };
    onDemand?: {
      enabled?: boolean;
      used?: number;
      limit?: number | null;
      remaining?: number | null;
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function centsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function parsePercentFromDisplay(message: unknown): number | null {
  if (typeof message !== "string") return null;
  const match = message.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** Accept pasted cookie values, `sub::jwt`, `sub%3A%3Ajwt`, or a bare JWT. */
export function normalizeCursorSessionToken(raw: string): string {
  let value = raw.trim().replace(/^["']|["']$/g, "");
  const prefix = /^WorkosCursorSessionToken=/i;
  if (prefix.test(value)) value = value.replace(prefix, "");
  if (!value) return "";
  if (value.includes("%3A%3A") || value.includes("::")) return value;
  const sub = decodeJwtSub(value);
  if (!sub) return value;
  return `${sub}::${value}`;
}

export function deriveCursorSessionTokenFromJwt(jwt: string): string | null {
  const trimmed = jwt.trim();
  if (!trimmed) return null;
  if (trimmed.includes("%3A%3A") || trimmed.includes("::")) return trimmed;
  const sub = decodeJwtSub(trimmed);
  if (!sub) return null;
  return `${sub}::${trimmed}`;
}

function decodeJwtSub(jwt: string): string | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "===".slice((payload.length + 3) % 4);
    const json = JSON.parse(atob(padded)) as { sub?: unknown };
    if (typeof json.sub !== "string" || !json.sub.trim()) return null;
    const sub = json.sub.includes("|") ? (json.sub.split("|").pop() ?? json.sub) : json.sub;
    return sub.trim() || null;
  } catch {
    return null;
  }
}

export function cursorCookieHeader(token: string): string {
  const value = normalizeCursorSessionToken(token);
  if (!value) return "";
  if (/^WorkosCursorSessionToken=/i.test(value)) return value;
  return `WorkosCursorSessionToken=${value}`;
}

function onDemandNote(onDemand: CursorUsageSummary["individualUsage"] extends infer T
  ? T extends { onDemand?: infer O }
    ? O
    : undefined
  : undefined): string | undefined {
  if (!onDemand || typeof onDemand !== "object") return undefined;
  const enabled = Boolean("enabled" in onDemand && onDemand.enabled);
  const used = asFiniteNumber("used" in onDemand ? onDemand.used : null);
  const limit = asFiniteNumber("limit" in onDemand ? onDemand.limit : null);
  if (!enabled || used == null || limit == null) return undefined;
  return `On-demand ${centsToUsd(used)} / ${centsToUsd(limit)}`;
}

/**
 * Map unofficial GET /api/usage-summary JSON to the two Cursor preset pools.
 * Never throws. Missing required fields become an error result.
 */
export function mapCursorUsageSummary(input: unknown): LiveProviderResult {
  if (!isRecord(input)) {
    return { ok: false, code: "invalid", message: "Cursor usage-summary is not an object", pools: [] };
  }

  const individual = isRecord(input.individualUsage) ? input.individualUsage : null;
  const plan = individual && isRecord(individual.plan) ? individual.plan : null;
  const onDemand = individual && isRecord(individual.onDemand) ? individual.onDemand : undefined;

  let autoPercent = plan ? asFiniteNumber(plan.autoPercentUsed) : null;
  let apiPercent = plan ? asFiniteNumber(plan.apiPercentUsed) : null;

  if (autoPercent == null) {
    autoPercent = parsePercentFromDisplay(input.autoModelSelectedDisplayMessage);
  }
  if (apiPercent == null) {
    apiPercent = parsePercentFromDisplay(input.namedModelSelectedDisplayMessage);
  }

  if (apiPercent == null && onDemand && onDemand.enabled) {
    const used = asFiniteNumber(onDemand.used);
    const limit = asFiniteNumber(onDemand.limit);
    if (used != null && limit != null && limit > 0) {
      apiPercent = (used / limit) * 100;
    }
  }

  if (autoPercent == null && apiPercent == null) {
    return {
      ok: false,
      code: "invalid",
      message: "Cursor usage-summary is missing autoPercentUsed and apiPercentUsed",
      pools: [],
    };
  }

  const resetAt = asIso(input.billingCycleEnd);
  const fetchedAt = new Date().toISOString();
  const extraNote = onDemandNote(onDemand);
  const pools: LivePoolUpdate[] = [];

  if (autoPercent != null) {
    pools.push({
      poolHint: "cursor_models",
      quotaUsed: autoPercent,
      quotaTotal: LIVE_PERCENT_TOTAL,
      resetAt,
      resetCycle: "monthly",
      unit: LIVE_PERCENT_UNIT,
      note: "Cursor live sync",
      recordedAt: fetchedAt,
    });
  }

  if (apiPercent != null) {
    pools.push({
      poolHint: "cursor_other",
      quotaUsed: apiPercent,
      quotaTotal: LIVE_PERCENT_TOTAL,
      resetAt,
      resetCycle: "monthly",
      unit: LIVE_PERCENT_UNIT,
      note: extraNote ? `Cursor live sync. ${extraNote}` : "Cursor live sync",
      recordedAt: fetchedAt,
    });
  }

  if (pools.length === 0) {
    return { ok: false, code: "invalid", message: "Cursor usage-summary had no mappable pools", pools: [] };
  }

  return {
    ok: true,
    code: "ok",
    message: "Cursor usage-summary mapped",
    pools,
    resetAt,
  };
}

export function mapCursorUsageResponse(status: number, body: string): LiveProviderResult {
  if (status === 401 || status === 403) {
    return {
      ok: false,
      code: "expired",
      message: "Cursor session expired or was rejected (HTTP " + status + ")",
      pools: [],
    };
  }
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      code: "http",
      message: `Cursor usage-summary failed with HTTP ${status}`,
      pools: [],
    };
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, code: "invalid", message: "Cursor usage-summary response was empty", pools: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, code: "invalid", message: "Cursor usage-summary was not valid JSON", pools: [] };
  }
  return mapCursorUsageSummary(parsed);
}
