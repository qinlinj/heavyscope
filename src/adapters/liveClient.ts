import { cursorCookieHeader, mapCursorUsageResponse } from "./cursorLive";
import {
  grokCookieHeader,
  mapGrokCreditsResponse,
  normalizeGrokBearer,
  type GrokAuth,
} from "./grokLive";
import {
  BROWSER_USER_AGENT,
  CURSOR_USAGE_PATH,
  GRPC_WEB_EMPTY_BODY,
  GROK_CREDITS_PATH,
  GROK_ORIGIN,
} from "./liveConstants";
import { isLiveHttpError, liveFetch } from "./liveHttp";
import type { LiveProviderResult } from "./liveTypes";

export async function fetchCursorUsage(token: string): Promise<LiveProviderResult> {
  const cookie = cursorCookieHeader(token);
  if (!cookie) {
    return { ok: false, code: "invalid", message: "Cursor session token is empty", pools: [] };
  }
  const response = await liveFetch({
    provider: "cursor",
    method: "GET",
    path: CURSOR_USAGE_PATH,
    headers: {
      Cookie: cookie,
      "User-Agent": BROWSER_USER_AGENT,
      Accept: "application/json",
    },
  });
  if (isLiveHttpError(response)) {
    return { ok: false, code: response.code, message: response.message, pools: [] };
  }
  return mapCursorUsageResponse(response.status, response.bodyText);
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
  return mapGrokCreditsResponse(response.status, response.bodyBytes);
}
