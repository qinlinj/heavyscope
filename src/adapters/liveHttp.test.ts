import { describe, expect, it } from "vitest";
import { LIVE_PROXY_HEADER_VALUE } from "./liveProxyForward";
import { responseLooksLikeMissingProxy } from "./liveHttp";

describe("responseLooksLikeMissingProxy", () => {
  it("trusts the same-origin proxy header", () => {
    expect(
      responseLooksLikeMissingProxy({
        proxyHeader: LIVE_PROXY_HEADER_VALUE,
        contentType: "text/html",
        bodyText: "<!DOCTYPE html>",
      }),
    ).toBe(false);
  });

  it("treats an SPA HTML fallback as no proxy", () => {
    expect(
      responseLooksLikeMissingProxy({
        proxyHeader: null,
        contentType: "text/html; charset=utf-8",
        bodyText: "<!DOCTYPE html><html>",
      }),
    ).toBe(true);
    expect(
      responseLooksLikeMissingProxy({
        proxyHeader: undefined,
        contentType: "application/json",
        bodyText: "<html>fallback</html>",
      }),
    ).toBe(true);
  });

  it("does not treat a JSON payload without the header as HTML", () => {
    expect(
      responseLooksLikeMissingProxy({
        proxyHeader: null,
        contentType: "application/json",
        bodyText: '{"autoPercentUsed":12}',
      }),
    ).toBe(false);
  });
});
