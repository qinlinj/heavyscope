import {
  BROWSER_USER_AGENT,
  CURSOR_ORIGIN,
  CURSOR_SPENDING_REFERER,
  GROK_CLI_ORIGIN,
  GROK_ORIGIN,
} from "./liveConstants";

export const LIVE_PROXY_PROBE_PATH = "/__heavyscope_ok";
export const LIVE_PROXY_HEADER = "x-heavyscope-proxy";
export const LIVE_PROXY_HEADER_VALUE = "1";
export const HEAVYSCOPE_COOKIE_HEADER = "x-heavyscope-cookie";
export const HEAVYSCOPE_AUTHORIZATION_HEADER = "x-heavyscope-authorization";

export type LiveProxyProvider = "cursor" | "grok" | "grok-cli";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

export function isLiveProxyProvider(value: string): value is LiveProxyProvider {
  return value === "cursor" || value === "grok" || value === "grok-cli";
}

export function isLiveProxyProbePath(path: string): boolean {
  const clean = (path.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  return clean === LIVE_PROXY_PROBE_PATH || clean === LIVE_PROXY_PROBE_PATH.slice(1);
}

export function liveProxyUpstreamOrigin(provider: LiveProxyProvider): string {
  if (provider === "cursor") return CURSOR_ORIGIN;
  if (provider === "grok-cli") return GROK_CLI_ORIGIN;
  return GROK_ORIGIN;
}

export function liveProxyUpstreamUrl(provider: LiveProxyProvider, pathAndQuery: string): string {
  const origin = liveProxyUpstreamOrigin(provider);
  const raw = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  return `${origin}${raw}`;
}

export function buildLiveProxyUpstreamHeaders(
  incoming: Headers,
  provider: LiveProxyProvider,
): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === HEAVYSCOPE_COOKIE_HEADER || lower === HEAVYSCOPE_AUTHORIZATION_HEADER) return;
    if (lower === "cookie" || lower === "authorization") return;
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "origin" || lower === "referer") return;
    out.set(key, value);
  });

  const cookie = incoming.get(HEAVYSCOPE_COOKIE_HEADER);
  const authorization = incoming.get(HEAVYSCOPE_AUTHORIZATION_HEADER);
  if (cookie) out.set("Cookie", cookie);
  if (authorization) out.set("Authorization", authorization);

  out.set("User-Agent", BROWSER_USER_AGENT);
  if (provider === "cursor") {
    out.set("Origin", CURSOR_ORIGIN);
    out.set("Referer", CURSOR_SPENDING_REFERER);
  } else if (provider === "grok") {
    out.set("Origin", GROK_ORIGIN);
    out.set("Referer", `${GROK_ORIGIN}/`);
  }

  return out;
}

export function liveProxyProbeResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      [LIVE_PROXY_HEADER]: LIVE_PROXY_HEADER_VALUE,
      "Cache-Control": "no-store",
    },
  });
}

export function withLiveProxyHeader(headers: Headers): Headers {
  const next = new Headers(headers);
  next.set(LIVE_PROXY_HEADER, LIVE_PROXY_HEADER_VALUE);
  next.set("Cache-Control", "no-store");
  return next;
}

function normalizeRestPath(restPath: string): string {
  if (!restPath || restPath === "/") return "/";
  return restPath.startsWith("/") ? restPath : `/${restPath}`;
}

export async function handleLiveProxyRequest(
  req: Request,
  provider: LiveProxyProvider,
  restPath: string,
): Promise<Response> {
  const url = new URL(req.url);
  const pathOnly = (restPath.split("?")[0] ?? restPath).replace(/\/+$/, "") || "/";
  if (isLiveProxyProbePath(pathOnly)) {
    return liveProxyProbeResponse();
  }

  const path = normalizeRestPath(pathOnly === "/" ? "" : pathOnly);
  const upstreamUrl = liveProxyUpstreamUrl(provider, `${path === "/" ? "" : path}${url.search}`);
  const headers = buildLiveProxyUpstreamHeaders(req.headers, provider);
  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "follow",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(upstreamUrl, init);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: withLiveProxyHeader(upstream.headers),
  });
}
