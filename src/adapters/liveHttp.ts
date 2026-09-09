import { isDesktopShell } from "@/lib/desktop";
import {
  BROWSER_USER_AGENT,
  CURSOR_ORIGIN,
  CURSOR_PROXY_PREFIX,
  GROK_CLI_ORIGIN,
  GROK_CLI_PROXY_PREFIX,
  GROK_ORIGIN,
  GROK_PROXY_PREFIX,
  LIVE_CURSOR_CORS_ERROR,
  LIVE_GROK_CORS_ERROR,
} from "./liveConstants";
import {
  LIVE_PROXY_HEADER,
  LIVE_PROXY_HEADER_VALUE,
  LIVE_PROXY_PROBE_PATH,
} from "./liveProxyForward";

export type LiveProviderId = "cursor" | "grok" | "grok-cli";

export type LiveHttpRequest = {
  provider: LiveProviderId;
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
};

export type LiveHttpResponse = {
  status: number;
  bodyText: string;
  bodyBytes: Uint8Array;
  headers: Record<string, string>;
  transport: "tauri" | "proxy";
};

export type LiveHttpError = {
  ok: false;
  status: 0;
  code: "cors" | "network";
  message: string;
};

function asBodyInit(body: Uint8Array | string | undefined): BodyInit | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return copy.buffer;
}

function corsMessage(provider: LiveProviderId): string {
  return provider === "cursor" ? LIVE_CURSOR_CORS_ERROR : LIVE_GROK_CORS_ERROR;
}

function resolveUrl(provider: LiveProviderId, path: string, transport: "tauri" | "proxy"): string {
  const origin =
    provider === "cursor" ? CURSOR_ORIGIN : provider === "grok-cli" ? GROK_CLI_ORIGIN : GROK_ORIGIN;
  const prefix =
    provider === "cursor"
      ? CURSOR_PROXY_PREFIX
      : provider === "grok-cli"
        ? GROK_CLI_PROXY_PREFIX
        : GROK_PROXY_PREFIX;
  if (transport === "tauri") return `${origin}${path}`;
  return `${prefix}${path}`;
}

function proxyHeaders(req: LiveHttpRequest): Record<string, string> {
  const headers: Record<string, string> = { ...(req.headers ?? {}) };
  const cookie = headers.Cookie ?? headers.cookie;
  const authorization = headers.Authorization ?? headers.authorization;
  if (cookie) {
    headers["X-HeavyScope-Cookie"] = cookie;
    delete headers.Cookie;
    delete headers.cookie;
  }
  if (authorization) {
    headers["X-HeavyScope-Authorization"] = authorization;
    delete headers.Authorization;
    delete headers.authorization;
  }
  return headers;
}

async function tauriFetch(url: string, req: LiveHttpRequest): Promise<Response | null> {
  if (!isDesktopShell()) return null;
  try {
    const { fetch } = await import("@tauri-apps/plugin-http");
    return await fetch(url, {
      method: req.method,
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        ...(req.headers ?? {}),
      },
      body: asBodyInit(req.body),
    });
  } catch {
    return null;
  }
}

function responseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

async function readResponse(response: Response, transport: "tauri" | "proxy"): Promise<LiveHttpResponse> {
  const bodyBytes = new Uint8Array(await response.arrayBuffer());
  const bodyText = new TextDecoder().decode(bodyBytes);
  return { status: response.status, bodyText, bodyBytes, headers: responseHeaders(response), transport };
}

export function responseLooksLikeMissingProxy(opts: {
  proxyHeader?: string | null;
  contentType?: string | null;
  bodyText?: string;
}): boolean {
  if (opts.proxyHeader === LIVE_PROXY_HEADER_VALUE) return false;
  const ct = (opts.contentType ?? "").toLowerCase();
  if (ct.includes("text/html")) return true;
  const start = (opts.bodyText ?? "").trimStart().slice(0, 15).toLowerCase();
  return start.startsWith("<!doctype") || start.startsWith("<html");
}

/** Same-origin `/proxy/*` probe. Tauri does not need this. */
export async function probeLiveProxy(): Promise<boolean> {
  if (isDesktopShell()) return true;
  try {
    const response = await fetch(`${CURSOR_PROXY_PREFIX}${LIVE_PROXY_PROBE_PATH}`, {
      method: "GET",
      cache: "no-store",
    });
    return response.headers.get(LIVE_PROXY_HEADER) === LIVE_PROXY_HEADER_VALUE;
  } catch {
    return false;
  }
}

/**
 * Prefer Tauri HTTP (no CORS). On the web, use the same-origin `/proxy/*`
 * path (Vite dev / preview, or the Vercel edge rewrite in production).
 * A pure static host has no proxy — return cors so the UI can show next steps.
 */
export async function liveFetch(req: LiveHttpRequest): Promise<LiveHttpResponse | LiveHttpError> {
  const tauriUrl = resolveUrl(req.provider, req.path, "tauri");
  const viaTauri = await tauriFetch(tauriUrl, req);
  if (viaTauri) {
    try {
      return await readResponse(viaTauri, "tauri");
    } catch {
      return { ok: false, status: 0, code: "network", message: `Network error calling ${req.provider}` };
    }
  }

  try {
    const response = await fetch(resolveUrl(req.provider, req.path, "proxy"), {
      method: req.method,
      headers: proxyHeaders(req),
      body: asBodyInit(req.body),
    });
    const headers = responseHeaders(response);
    const preview = await response.clone().text();
    if (
      responseLooksLikeMissingProxy({
        proxyHeader: headers[LIVE_PROXY_HEADER],
        contentType: headers["content-type"],
        bodyText: preview,
      })
    ) {
      return { ok: false, status: 0, code: "cors", message: corsMessage(req.provider) };
    }
    return await readResponse(response, "proxy");
  } catch {
    return { ok: false, status: 0, code: "network", message: `Network error calling ${req.provider}` };
  }
}

export function isLiveHttpError(value: LiveHttpResponse | LiveHttpError): value is LiveHttpError {
  return "ok" in value && value.ok === false;
}
