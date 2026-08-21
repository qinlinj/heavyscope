import {
  CURSOR_OTHER_DEFAULT_USD,
  LIVE_PERCENT_TOTAL,
  LIVE_PERCENT_UNIT,
  LIVE_USD_UNIT,
} from "./liveConstants";
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

export type CursorSpendingSources = {
  period?: unknown;
  aggregations?: unknown;
  events?: unknown;
  summary?: unknown;
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
  if (typeof value === "string" && value.trim()) {
    if (/^\d+$/.test(value.trim())) return asIso(Number(value.trim()));
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : new Date(time).toISOString();
  }
  const ms = asEpochMs(value);
  return ms == null ? null : new Date(ms).toISOString();
}

/** Accept ISO strings, epoch ms, or epoch seconds. Never invents a date. */
export function asEpochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    if (value < 1e11) return Math.round(value * 1000);
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    if (/^\d+$/.test(value.trim())) return asEpochMs(Number(value.trim()));
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

function centsToUsdLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function centsToUsdAmount(cents: number): number {
  return cents / 100;
}

function parsePercentFromDisplay(message: unknown): number | null {
  if (typeof message !== "string") return null;
  const match = message.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function unwrapCursorPayload(input: unknown): Record<string, unknown> | null {
  if (!isRecord(input)) return null;
  const nested = isRecord(input.data) ? input.data : null;
  if (
    nested &&
    input.planUsage == null &&
    input.aggregations == null &&
    input.usageEventsDisplay == null &&
    input.individualUsage == null &&
    input.autoPercentUsed == null
  ) {
    return nested;
  }
  return input;
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

/** Decode a pasted `%3A%3A` pair to `::`. Both cookie shapes work live; store the decoded value. */
function decodeCursorTokenSeparator(value: string): string {
  return value.replace(/%3A%3A/gi, "::");
}

/** Accept pasted cookie values, `sub::jwt`, `sub%3A%3Ajwt`, or a bare JWT. */
export function normalizeCursorSessionToken(raw: string): string {
  let value = raw.trim().replace(/^["']|["']$/g, "");
  const prefix = /^WorkosCursorSessionToken=/i;
  if (prefix.test(value)) value = value.replace(prefix, "");
  if (!value) return "";
  value = decodeCursorTokenSeparator(value);
  if (value.includes("::")) return value;
  const sub = decodeJwtSub(value);
  if (!sub) return value;
  return `${sub}::${value}`;
}

export function deriveCursorSessionTokenFromJwt(jwt: string): string | null {
  const trimmed = decodeCursorTokenSeparator(jwt.trim());
  if (!trimmed) return null;
  if (trimmed.includes("::")) return trimmed;
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

function onDemandCents(onDemand: unknown): { used: number; limit: number | null } | null {
  const rec = recordFrom(onDemand);
  if (!rec) return null;
  const used = asFiniteNumber(rec.used);
  if (used == null) return null;
  return { used, limit: asFiniteNumber(rec.limit) };
}

/**
 * True only for a real Grok Bot / Grok API / Agents SKU row.
 * Cursor Grok chat models, Composer, and Heavy stay out of grok_bot.
 */
export function isCursorGrokBotSku(raw: string): boolean {
  const text = raw.trim().toLowerCase();
  if (!text) return false;
  const compact = text.replace(/[_\s]+/g, "-");

  if (compact.includes("composer") || text.includes("composer")) return false;
  if (compact.includes("cursor-grok") || text.includes("cursor grok")) return false;

  const heavy = /(?:super-)?grok-heavy|\bheavy\b/.test(compact) || /\bheavy\b/.test(text);
  const grokBotLiteral = /grok-bot/.test(compact) || /grok\s+bot/.test(text);
  if (heavy && !grokBotLiteral) return false;

  const hasBotApiAgents =
    /(?:^|[^a-z])(bot|api|agents?)(?:[^a-z]|$)/.test(compact) ||
    /\b(bot|api|agents?)\b/.test(text);
  const isCursorChatGrok = /(?:^|[^a-z])grok-[234](?:$|[^a-z0-9])/.test(compact);
  if (isCursorChatGrok && !hasBotApiAgents) return false;

  if (grokBotLiteral || compact === "grok-bot") return true;
  if (compact.includes("grok-api") || compact.includes("grok-agents")) return true;
  if (text.includes("grok") && hasBotApiAgents) return true;
  return false;
}

function rowIdentity(row: Record<string, unknown>): string {
  const keys = [
    "modelIntent",
    "model",
    "product",
    "kind",
    "name",
    "sku",
    "displayName",
    "modelName",
  ];
  return keys
    .map((key) => row[key])
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ");
}

type ExtractedUsed = {
  used: number;
  total?: number;
  unit: string;
};

function tokenSum(row: Record<string, unknown>): number | null {
  const keys = ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "totalTokens"];
  let sum = 0;
  let any = false;
  for (const key of keys) {
    const value = asFiniteNumber(row[key]);
    if (value == null) continue;
    sum += value;
    any = true;
  }
  const nested = recordFrom(row.tokenUsage);
  if (nested) {
    for (const key of keys) {
      const value = asFiniteNumber(nested[key]);
      if (value == null) continue;
      sum += value;
      any = true;
    }
  }
  return any ? sum : null;
}

function extractRowUsed(row: Record<string, unknown>): ExtractedUsed | null {
  const usedDirect = asFiniteNumber(row.used ?? row.quotaUsed ?? row.usage);
  const limitDirect = asFiniteNumber(row.limit ?? row.quotaTotal ?? row.quota);
  const usedCents = asFiniteNumber(
    row.usedCents ?? row.totalCents ?? row.chargedCents ?? row.costCents,
  );
  const limitCents = asFiniteNumber(row.limitCents ?? row.totalLimitCents ?? row.quotaCents);
  const nested = recordFrom(row.tokenUsage);
  const nestedCents = nested ? asFiniteNumber(nested.totalCents) : null;
  const cents = usedCents ?? nestedCents;

  if (usedDirect != null && limitDirect != null && limitDirect > 0) {
    const unit = typeof row.unit === "string" && row.unit.trim() ? row.unit : "requests";
    return { used: usedDirect, total: limitDirect, unit };
  }
  if (cents != null) {
    const total = limitCents != null && limitCents > 0 ? centsToUsdAmount(limitCents) : undefined;
    return { used: centsToUsdAmount(cents), total, unit: LIVE_USD_UNIT };
  }
  if (usedDirect != null) {
    return {
      used: usedDirect,
      total: limitDirect != null && limitDirect > 0 ? limitDirect : undefined,
      unit: typeof row.unit === "string" && row.unit.trim() ? row.unit : "requests",
    };
  }
  const tokens = tokenSum(row);
  if (tokens != null) {
    return { used: tokens, unit: "tokens" };
  }
  return null;
}

function collectGrokBotRows(rows: Record<string, unknown>[]): ExtractedUsed | null {
  const matched: ExtractedUsed[] = [];
  for (const row of rows) {
    const identity = rowIdentity(row);
    if (!isCursorGrokBotSku(identity)) continue;
    const extracted = extractRowUsed(row);
    if (extracted) matched.push(extracted);
  }
  if (matched.length === 0) return null;

  const usd = matched.filter((item) => item.unit === LIVE_USD_UNIT);
  const chosen = usd.length > 0 ? usd : matched;
  const used = chosen.reduce((sum, item) => sum + item.used, 0);
  const total = chosen.find((item) => item.total != null && item.total > 0)?.total;
  return { used, total, unit: chosen[0]?.unit ?? LIVE_USD_UNIT };
}

function grokBotPool(extracted: ExtractedUsed, resetAt: string | null, recordedAt: string): LivePoolUpdate {
  const pool: LivePoolUpdate = {
    poolHint: "grok_bot",
    quotaUsed: extracted.used,
    resetAt,
    resetCycle: "weekly",
    unit: extracted.unit,
    note: "Cursor spending sync (Grok Bot)",
    recordedAt,
  };
  if (extracted.total != null && extracted.total > 0) {
    pool.quotaTotal = extracted.total;
  }
  return pool;
}

export function mapCursorGrokBotFromRows(input: unknown, resetAt: string | null, recordedAt: string): LivePoolUpdate | null {
  const root = unwrapCursorPayload(input);
  if (!root) return null;
  const rows = [
    ...asRecordArray(root.aggregations),
    ...asRecordArray(root.usageEventsDisplay),
    ...asRecordArray(root.events),
  ];
  const extracted = collectGrokBotRows(rows);
  return extracted ? grokBotPool(extracted, resetAt, recordedAt) : null;
}

function planUsageRecord(root: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!root) return null;
  const individual = recordFrom(root.individualUsage);
  return (
    recordFrom(root.planUsage) ??
    recordFrom(individual?.plan) ??
    (typeof root.autoPercentUsed === "number" || typeof root.totalSpend === "number" ? root : null)
  );
}

function autoPercentFrom(root: Record<string, unknown> | null, plan: Record<string, unknown> | null): number | null {
  const fromPlan = plan ? asFiniteNumber(plan.autoPercentUsed) : null;
  if (fromPlan != null) return fromPlan;
  if (root) {
    const top = asFiniteNumber(root.autoPercentUsed);
    if (top != null) return top;
    return parsePercentFromDisplay(root.autoModelSelectedDisplayMessage);
  }
  return null;
}

function otherUsdFromPlan(plan: Record<string, unknown> | null): { used: number; total: number } | null {
  if (!plan) return null;
  const spendCents = asFiniteNumber(plan.totalSpend ?? plan.used);
  if (spendCents == null) return null;
  const limitCents = asFiniteNumber(plan.limit);
  const total =
    limitCents != null && limitCents > 0 ? centsToUsdAmount(limitCents) : CURSOR_OTHER_DEFAULT_USD;
  return { used: centsToUsdAmount(spendCents), total };
}

function otherUsdFromOnDemand(onDemand: unknown): { used: number; total: number } | null {
  const cents = onDemandCents(onDemand);
  if (!cents) return null;
  const total = cents.limit != null && cents.limit > 0 ? centsToUsdAmount(cents.limit) : CURSOR_OTHER_DEFAULT_USD;
  return { used: centsToUsdAmount(cents.used), total };
}

export function resolveCursorBillingWindow(
  period: unknown,
  summary: unknown,
  nowMs = Date.now(),
): { startMs: number; endMs: number; resetAt: string | null } {
  const periodRoot = unwrapCursorPayload(period);
  const summaryRoot = unwrapCursorPayload(summary);
  const start =
    asEpochMs(periodRoot?.billingCycleStart) ??
    asEpochMs(summaryRoot?.billingCycleStart) ??
    nowMs - 32 * 24 * 60 * 60 * 1000;
  const end =
    asEpochMs(periodRoot?.billingCycleEnd) ??
    asEpochMs(summaryRoot?.billingCycleEnd) ??
    nowMs;
  const resetAt =
    asIso(periodRoot?.billingCycleEnd) ??
    asIso(summaryRoot?.billingCycleEnd) ??
    null;
  return {
    startMs: Math.min(start, end),
    endMs: Math.max(start, end),
    resetAt,
  };
}

function modelsPool(percent: number, resetAt: string | null, recordedAt: string): LivePoolUpdate {
  return {
    poolHint: "cursor_models",
    quotaUsed: percent,
    quotaTotal: LIVE_PERCENT_TOTAL,
    resetAt,
    resetCycle: "monthly",
    unit: LIVE_PERCENT_UNIT,
    note: "Cursor live sync",
    recordedAt,
  };
}

function otherUsdPool(
  used: number,
  total: number,
  resetAt: string | null,
  recordedAt: string,
  extraNote?: string,
): LivePoolUpdate {
  return {
    poolHint: "cursor_other",
    quotaUsed: used,
    quotaTotal: total,
    resetAt,
    resetCycle: "monthly",
    unit: LIVE_USD_UNIT,
    note: extraNote ? `Cursor live sync. ${extraNote}` : "Cursor live sync",
    recordedAt,
  };
}

/**
 * usage-summary fallback: Models % from autoPercentUsed.
 * Other is USD from on-demand cents when present — never apiPercentUsed as 0–100%.
 */
export function mapCursorUsageSummary(input: unknown): LiveProviderResult {
  if (!isRecord(input)) {
    return { ok: false, code: "invalid", message: "Cursor usage-summary is not an object", pools: [] };
  }

  const root = unwrapCursorPayload(input);
  const individual = root ? recordFrom(root.individualUsage) : null;
  const plan = individual ? recordFrom(individual.plan) : null;
  const onDemand = individual?.onDemand;

  const autoPercent = autoPercentFrom(root, plan);
  const other = otherUsdFromOnDemand(onDemand);

  if (autoPercent == null && other == null) {
    return {
      ok: false,
      code: "invalid",
      message: "Cursor usage-summary is missing autoPercentUsed and on-demand spend",
      pools: [],
    };
  }

  const resetAt = asIso(root?.billingCycleEnd);
  const fetchedAt = new Date().toISOString();
  const pools: LivePoolUpdate[] = [];

  if (autoPercent != null) {
    pools.push(modelsPool(autoPercent, resetAt, fetchedAt));
  }
  if (other) {
    const usedCents = onDemandCents(onDemand);
    const extra =
      usedCents && usedCents.limit != null
        ? `On-demand ${centsToUsdLabel(usedCents.used)} / ${centsToUsdLabel(usedCents.limit)}`
        : `On-demand ${centsToUsdLabel(other.used * 100)} / $${other.total.toFixed(2)}`;
    pools.push(otherUsdPool(other.used, other.total, resetAt, fetchedAt, extra));
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
    botUnavailable: true,
  };
}

export function mapCursorPeriodUsage(
  input: unknown,
  recordedAt = new Date().toISOString(),
): { models: LivePoolUpdate | null; other: LivePoolUpdate | null; resetAt: string | null } {
  const root = unwrapCursorPayload(input);
  const plan = planUsageRecord(root);
  const individual = root ? recordFrom(root.individualUsage) : null;
  const resetAt = asIso(root?.billingCycleEnd);

  const autoPercent = autoPercentFrom(root, plan);
  const other = otherUsdFromPlan(plan) ?? otherUsdFromOnDemand(individual?.onDemand);

  return {
    models: autoPercent != null ? modelsPool(autoPercent, resetAt, recordedAt) : null,
    other: other
      ? otherUsdPool(
          other.used,
          other.total,
          resetAt,
          recordedAt,
          `Spend $${other.used.toFixed(2)} / $${other.total.toFixed(2)}`,
        )
      : null,
    resetAt,
  };
}

/**
 * Merge current-period-usage + aggregations/events + usage-summary.
 * Spending Other (USD) wins over the old usage-summary Other-% mapping.
 * usage-summary is only a Models % fallback when period autoPercent is missing.
 * Grok Bot is omitted unless a conservative SKU row exists — never invented.
 */
export function mergeCursorSpendingSources(sources: CursorSpendingSources): LiveProviderResult {
  const recordedAt = new Date().toISOString();
  const window = resolveCursorBillingWindow(sources.period, sources.summary);
  const period = sources.period != null ? mapCursorPeriodUsage(sources.period, recordedAt) : null;
  const summary =
    sources.summary != null && isRecord(sources.summary) ? mapCursorUsageSummary(sources.summary) : null;

  const resetAt = period?.resetAt ?? window.resetAt ?? summary?.resetAt ?? null;
  const grok =
    mapCursorGrokBotFromRows(sources.aggregations, resetAt, recordedAt) ??
    mapCursorGrokBotFromRows(sources.events, resetAt, recordedAt);

  const models =
    period?.models ??
    summary?.pools.find((pool) => pool.poolHint === "cursor_models") ??
    null;
  const other =
    period?.other ??
    summary?.pools.find((pool) => pool.poolHint === "cursor_other") ??
    null;

  const pools: LivePoolUpdate[] = [];
  if (models) pools.push({ ...models, resetAt: models.resetAt ?? resetAt, recordedAt });
  if (other) pools.push({ ...other, resetAt: other.resetAt ?? resetAt, recordedAt });
  if (grok) pools.push({ ...grok, resetAt: grok.resetAt ?? resetAt, recordedAt });

  if (pools.length === 0) {
    return {
      ok: false,
      code: "invalid",
      message: "Cursor spending payloads had no mappable pools",
      pools: [],
      botUnavailable: true,
    };
  }

  const labels = pools.map((pool) => pool.poolHint).join(", ");
  return {
    ok: true,
    code: "ok",
    message: `Cursor spending mapped (${labels})`,
    pools,
    resetAt,
    botUnavailable: grok == null,
  };
}

/**
 * Live get-filtered-usage-events returns HTTP 401
 * `{"error":{"message":"Team ID is required",...}}` even with a valid session.
 * That is not a dead cookie — do not map it to expired.
 */
export function isCursorTeamIdRequiredBody(body?: string): boolean {
  if (!body) return false;
  if (body.includes("Team ID is required")) return true;
  return body.includes("ERROR_UNAUTHORIZED") && /team\s*id/i.test(body);
}

/** True only for a real auth rejection. 405 and Team-ID 401/403 are not expired. */
export function isCursorSessionExpired(status: number, body?: string): boolean {
  if (status === 405) return false;
  if (status !== 401 && status !== 403) return false;
  if (isCursorTeamIdRequiredBody(body)) return false;
  return true;
}

export function mapCursorHttpStatus(
  status: number,
  label: string,
  body?: string,
): LiveProviderResult | null {
  if (status === 405) {
    return {
      ok: false,
      code: "http",
      message: `${label} failed with HTTP 405 (Method not allowed)`,
      pools: [],
    };
  }
  if (status === 401 || status === 403) {
    if (!isCursorSessionExpired(status, body)) {
      return {
        ok: false,
        code: "http",
        message: `${label} failed with HTTP ${status}`,
        pools: [],
      };
    }
    return {
      ok: false,
      code: "expired",
      message: `Cursor session expired or was rejected (HTTP ${status}). Paste a new WorkosCursorSessionToken.`,
      pools: [],
    };
  }
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      code: "http",
      message: `${label} failed with HTTP ${status}`,
      pools: [],
    };
  }
  return null;
}

export type CursorJsonParse = { ok: true; value: unknown } | LiveProviderResult;

/**
 * Finish a Cursor live refresh after optional filtered-usage-events.
 * When period / summary / aggregations already parsed, a 401/403/405 on
 * events must not abort the merge — skip events and keep Models + Other.
 */
export function finishCursorLiveRefresh(args: {
  period?: unknown;
  summary?: unknown;
  aggregations?: unknown;
  eventsParsed?: CursorJsonParse;
}): LiveProviderResult {
  const hasPrior =
    args.period !== undefined || args.summary !== undefined || args.aggregations !== undefined;
  let events: unknown;
  if (args.eventsParsed) {
    if ("value" in args.eventsParsed) {
      events = args.eventsParsed.value;
    } else if (!hasPrior && args.eventsParsed.code === "expired") {
      return args.eventsParsed;
    }
  }
  return mergeCursorSpendingSources({
    period: args.period,
    aggregations: args.aggregations,
    events,
    summary: args.summary,
  });
}

export function parseCursorJsonBody(
  status: number,
  body: string,
  label: string,
): CursorJsonParse {
  const statusError = mapCursorHttpStatus(status, label, body);
  if (statusError) return statusError;
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, code: "invalid", message: `${label} response was empty`, pools: [] };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, code: "invalid", message: `${label} was not valid JSON`, pools: [] };
  }
}

export function mapCursorUsageResponse(status: number, body: string): LiveProviderResult {
  const parsed = parseCursorJsonBody(status, body, "Cursor usage-summary");
  if (!("value" in parsed)) return parsed;
  return mapCursorUsageSummary(parsed.value);
}

export function mapCursorPeriodResponse(status: number, body: string): LiveProviderResult {
  const parsed = parseCursorJsonBody(status, body, "Cursor current-period-usage");
  if (!("value" in parsed)) return parsed;
  return mergeCursorSpendingSources({ period: parsed.value });
}

export function mapCursorAggregatedResponse(status: number, body: string): LiveProviderResult {
  const parsed = parseCursorJsonBody(status, body, "Cursor aggregated-usage-events");
  if (!("value" in parsed)) return parsed;
  return mergeCursorSpendingSources({ aggregations: parsed.value });
}

export function aggregatedUsageRequestBody(startMs: number, endMs: number): string {
  return JSON.stringify({ teamId: -1, startDate: startMs, endDate: endMs });
}

export function filteredUsageRequestBody(startMs: number, endMs: number): string {
  return JSON.stringify({
    teamId: -1,
    startDate: startMs,
    endDate: endMs,
    page: 1,
    pageSize: 100,
  });
}
