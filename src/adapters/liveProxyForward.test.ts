import { describe, expect, it, vi } from "vitest";
import {
  BROWSER_USER_AGENT,
  CURSOR_ORIGIN,
  CURSOR_SPENDING_REFERER,
  GROK_CLI_ORIGIN,
  GROK_ORIGIN,
} from "./liveConstants";
import {
  buildLiveProxyUpstreamHeaders,
  handleLiveProxyRequest,
  HEAVYSCOPE_AUTHORIZATION_HEADER,
  HEAVYSCOPE_COOKIE_HEADER,
  isLiveProxyProbePath,
  isLiveProxyProvider,
  LIVE_PROXY_HEADER,
  LIVE_PROXY_HEADER_VALUE,
  liveProxyUpstreamUrl,
} from "./liveProxyForward";

describe("isLiveProxyProvider", () => {
  it("accepts the three same-origin prefixes", () => {
    expect(isLiveProxyProvider("cursor")).toBe(true);
    expect(isLiveProxyProvider("grok")).toBe(true);
    expect(isLiveProxyProvider("grok-cli")).toBe(true);
    expect(isLiveProxyProvider("other")).toBe(false);
  });
});

describe("liveProxyUpstreamUrl", () => {
  it("rewrites each prefix onto the real origin and keeps the query string", () => {
    expect(liveProxyUpstreamUrl("cursor", "/api/dashboard/get-current-period-usage")).toBe(
      `${CURSOR_ORIGIN}/api/dashboard/get-current-period-usage`,
    );
    expect(liveProxyUpstreamUrl("grok", "/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig")).toBe(
      `${GROK_ORIGIN}/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig`,
    );
    expect(liveProxyUpstreamUrl("grok-cli", "/v1/billing?format=credits")).toBe(
      `${GROK_CLI_ORIGIN}/v1/billing?format=credits`,
    );
  });
});

describe("buildLiveProxyUpstreamHeaders", () => {
  it("forwards X-HeavyScope-Cookie / Authorization and dashboard Origin without logging", () => {
    const incoming = new Headers({
      [HEAVYSCOPE_COOKIE_HEADER]: "WorkosCursorSessionToken=secret-token",
      [HEAVYSCOPE_AUTHORIZATION_HEADER]: "Bearer secret-bearer",
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Grpc-Web": "1",
      "x-xai-token-auth": "xai-grok-cli",
      Origin: "https://heavyscope.example",
      Referer: "https://heavyscope.example/settings",
    });
    const headers = buildLiveProxyUpstreamHeaders(incoming, "cursor");
    expect(headers.get("Cookie")).toBe("WorkosCursorSessionToken=secret-token");
    expect(headers.get("Authorization")).toBe("Bearer secret-bearer");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Grpc-Web")).toBe("1");
    expect(headers.get("x-xai-token-auth")).toBe("xai-grok-cli");
    expect(headers.get("Origin")).toBe(CURSOR_ORIGIN);
    expect(headers.get("Referer")).toBe(CURSOR_SPENDING_REFERER);
    expect(headers.get("User-Agent")).toBe(BROWSER_USER_AGENT);
    expect(headers.get(HEAVYSCOPE_COOKIE_HEADER)).toBeNull();
    expect(headers.get(HEAVYSCOPE_AUTHORIZATION_HEADER)).toBeNull();
  });

  it("sets grok.com Origin / Referer for the proto proxy", () => {
    const headers = buildLiveProxyUpstreamHeaders(new Headers(), "grok");
    expect(headers.get("Origin")).toBe(GROK_ORIGIN);
    expect(headers.get("Referer")).toBe(`${GROK_ORIGIN}/`);
  });
});

describe("handleLiveProxyRequest", () => {
  it("answers the probe without calling the upstream", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await handleLiveProxyRequest(
      new Request("https://app.example/proxy/cursor/__heavyscope_ok"),
      "cursor",
      "/__heavyscope_ok",
    );
    expect(response.status).toBe(204);
    expect(response.headers.get(LIVE_PROXY_HEADER)).toBe(LIVE_PROXY_HEADER_VALUE);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("forwards POST bodies and marks the response as our proxy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{\"ok\":true}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const response = await handleLiveProxyRequest(
      new Request("https://app.example/proxy/cursor/api/dashboard/get-current-period-usage", {
        method: "POST",
        headers: {
          [HEAVYSCOPE_COOKIE_HEADER]: "WorkosCursorSessionToken=secret-token",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
      "cursor",
      "/api/dashboard/get-current-period-usage",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get(LIVE_PROXY_HEADER)).toBe(LIVE_PROXY_HEADER_VALUE);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(`${CURSOR_ORIGIN}/api/dashboard/get-current-period-usage`);
    expect(init && typeof init === "object" && "method" in init ? init.method : "").toBe("POST");
    const forwarded = init && typeof init === "object" && "headers" in init ? (init.headers as Headers) : null;
    expect(forwarded?.get("Cookie")).toBe("WorkosCursorSessionToken=secret-token");
    fetchSpy.mockRestore();
  });
});

describe("isLiveProxyProbePath", () => {
  it("matches the well-known probe path", () => {
    expect(isLiveProxyProbePath("/__heavyscope_ok")).toBe(true);
    expect(isLiveProxyProbePath("__heavyscope_ok")).toBe(true);
    expect(isLiveProxyProbePath("/api/usage-summary")).toBe(false);
  });
});
