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

function canUseDevProxy(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
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

/**
 * Prefer Tauri HTTP (no CORS). In `pnpm dev`, use the Vite proxy.
 * Production web builds cannot call cursor.com / grok.com directly.
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

  if (!canUseDevProxy()) {
    return { ok: false, status: 0, code: "cors", message: corsMessage(req.provider) };
  }

  try {
    const response = await fetch(resolveUrl(req.provider, req.path, "proxy"), {
      method: req.method,
      headers: proxyHeaders(req),
      body: asBodyInit(req.body),
    });
    return await readResponse(response, "proxy");
  } catch {
    return { ok: false, status: 0, code: "network", message: `Network error calling ${req.provider}` };
  }
}

export function isLiveHttpError(value: LiveHttpResponse | LiveHttpError): value is LiveHttpError {
  return "ok" in value && value.ok === false;
}
