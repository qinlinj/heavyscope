import {
  aggregatedUsageRequestBody,
  cursorCookieHeader,
  filteredUsageRequestBody,
  finishCursorLiveRefresh,
  mapCursorGrokBotFromRows,
  mapCursorHttpStatus,
  mapCursorSandUsage,
  parseCursorJsonBody,
  resolveCursorBillingWindow,
  sandUsageRequestBody,
  type CursorJsonParse,
} from "./cursorLive";
import {
  grokCookieHeader,
  mapGrokCliBillingResponse,
  mapGrokCreditsResponse,
  mergeGrokLiveResults,
  normalizeGrokBearer,
  type GrokAuth,
} from "./grokLive";
import {
  BROWSER_USER_AGENT,
  CURSOR_AGGREGATED_USAGE_PATH,
  CURSOR_FILTERED_USAGE_PATH,
  CURSOR_ORIGIN,
  CURSOR_PERIOD_USAGE_PATH,
  CURSOR_SAND_USAGE_PATH,
  CURSOR_SPENDING_REFERER,
  CURSOR_USAGE_PATH,
  GRPC_WEB_EMPTY_BODY,
  GROK_CLI_BILLING_PATH,
  GROK_CLI_TOKEN_AUTH,
  GROK_CREDITS_PATH,
  GROK_ORIGIN,
} from "./liveConstants";
import { isLiveHttpError, liveFetch, type LiveHttpError, type LiveHttpResponse } from "./liveHttp";
import type { LiveProviderResult } from "./liveTypes";

function cursorHeaders(cookie: string, jsonBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Cookie: cookie,
    "User-Agent": BROWSER_USER_AGENT,
    Accept: "application/json",
    Origin: CURSOR_ORIGIN,
    Referer: CURSOR_SPENDING_REFERER,
  };
  if (jsonBody) headers["Content-Type"] = "application/json";
  return headers;
}

function transportError(response: LiveHttpError): LiveProviderResult {
  return { ok: false, code: response.code, message: response.message, pools: [] };
}

function jsonOrError(
  response: LiveHttpResponse | LiveHttpError,
  label: string,
): CursorJsonParse {
  if (isLiveHttpError(response)) return transportError(response);
  const statusError = mapCursorHttpStatus(response.status, label, response.bodyText);
  if (statusError?.code === "expired") return statusError;
  return parseCursorJsonBody(response.status, response.bodyText, label);
}

export async function fetchCursorUsage(token: string): Promise<LiveProviderResult> {
  const cookie = cursorCookieHeader(token);
  if (!cookie) {
    return { ok: false, code: "invalid", message: "Cursor session token is empty", pools: [] };
  }

  const [periodRes, summaryRes, sandRes] = await Promise.all([
    liveFetch({
      provider: "cursor",
      method: "POST",
      path: CURSOR_PERIOD_USAGE_PATH,
      headers: cursorHeaders(cookie, true),
      body: "{}",
    }),
    liveFetch({
      provider: "cursor",
      method: "GET",
      path: CURSOR_USAGE_PATH,
      headers: cursorHeaders(cookie, false),
    }),
    liveFetch({
      provider: "cursor",
      method: "POST",
      path: CURSOR_SAND_USAGE_PATH,
      headers: cursorHeaders(cookie, true),
      body: sandUsageRequestBody(),
    }),
  ]);

  const periodParsed = jsonOrError(periodRes, "Cursor current-period-usage");
  if (!("value" in periodParsed) && periodParsed.code === "expired") return periodParsed;
  const summaryParsed = jsonOrError(summaryRes, "Cursor usage-summary");
  if (!("value" in summaryParsed) && summaryParsed.code === "expired") return summaryParsed;
  const sandParsed = jsonOrError(sandRes, "Cursor sand-usage-status");

  const period = "value" in periodParsed ? periodParsed.value : undefined;
  const summary = "value" in summaryParsed ? summaryParsed.value : undefined;
  const window = resolveCursorBillingWindow(period, summary);

  const aggRes = await liveFetch({
    provider: "cursor",
    method: "POST",
    path: CURSOR_AGGREGATED_USAGE_PATH,
    headers: cursorHeaders(cookie, true),
    body: aggregatedUsageRequestBody(window.startMs, window.endMs),
  });
  const aggParsed = jsonOrError(aggRes, "Cursor aggregated-usage-events");
  if (!("value" in aggParsed) && aggParsed.code === "expired") return aggParsed;
  const aggregations = "value" in aggParsed ? aggParsed.value : undefined;

  const sandValue = "value" in sandParsed ? sandParsed.value : undefined;
  const sandBot = sandValue != null ? mapCursorSandUsage(sandValue) : null;

  let eventsParsed: CursorJsonParse | undefined;
  if (
    !sandBot &&
    !mapCursorGrokBotFromRows(aggregations, window.resetAt, new Date().toISOString())
  ) {
    const eventsRes = await liveFetch({
      provider: "cursor",
      method: "POST",
      path: CURSOR_FILTERED_USAGE_PATH,
      headers: cursorHeaders(cookie, true),
      body: filteredUsageRequestBody(window.startMs, window.endMs),
    });
    eventsParsed = jsonOrError(eventsRes, "Cursor filtered-usage-events");
  }

  const merged = finishCursorLiveRefresh({
    period,
    summary,
    aggregations,
    eventsParsed,
    sandParsed,
  });
  if (merged.ok) return merged;

  if (!("value" in periodParsed) && periodParsed.code !== "invalid") return periodParsed;
  if (!("value" in summaryParsed) && summaryParsed.code !== "invalid") return summaryParsed;
  if (aggParsed && !("value" in aggParsed) && aggParsed.code !== "invalid") return aggParsed;
  return merged;
}

async function fetchGrokCliBilling(auth: GrokAuth): Promise<LiveProviderResult> {
  const bearer = auth.bearerToken ? normalizeGrokBearer(auth.bearerToken) : "";
  if (!bearer) {
    return { ok: false, code: "invalid", message: "Grok CLI billing needs a Bearer token", pools: [] };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearer}`,
    "x-xai-token-auth": GROK_CLI_TOKEN_AUTH,
    Accept: "application/json",
    "User-Agent": BROWSER_USER_AGENT,
  };
  if (auth.sessionCookie) headers.Cookie = grokCookieHeader(auth.sessionCookie);

  const response = await liveFetch({
    provider: "grok-cli",
    method: "GET",
    path: GROK_CLI_BILLING_PATH,
    headers,
  });
  if (isLiveHttpError(response)) {
    return { ok: false, code: response.code, message: response.message, pools: [] };
  }
  return mapGrokCliBillingResponse(response.status, response.bodyText);
}

export async function fetchGrokCredits(auth: GrokAuth): Promise<LiveProviderResult> {
  const cookie = auth.sessionCookie ? grokCookieHeader(auth.sessionCookie) : "";
  const bearer = auth.bearerToken ? normalizeGrokBearer(auth.bearerToken) : "";
  if (!cookie && !bearer) {
    return { ok: false, code: "invalid", message: "Grok session cookie or bearer token is empty", pools: [] };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/grpc-web+proto",
    Accept: "application/grpc-web+proto",
    "X-Grpc-Web": "1",
    Origin: GROK_ORIGIN,
    Referer: `${GROK_ORIGIN}/`,
    "User-Agent": BROWSER_USER_AGENT,
  };
  // Prefer Bearer when saved; still send Cookie if present (CodexBar #2812).
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (cookie) headers.Cookie = cookie;

  const response = await liveFetch({
    provider: "grok",
    method: "POST",
    path: GROK_CREDITS_PATH,
    headers,
    body: GRPC_WEB_EMPTY_BODY,
  });
  if (isLiveHttpError(response)) {
    return { ok: false, code: response.code, message: response.message, pools: [] };
  }
  const mapped = mapGrokCreditsResponse(response.status, response.bodyBytes, response.headers);
  if (!bearer) return mapped;

  const cli = await fetchGrokCliBilling(auth);
  return mergeGrokLiveResults(mapped, cli);
}
