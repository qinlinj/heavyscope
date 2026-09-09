import { describe, expect, it } from "vitest";
import { LIVE_CURSOR_CORS_ERROR } from "@/adapters/liveConstants";
import { isLiveProxyUnavailableMessage, liveUserMessage } from "./liveFlash";

describe("liveUserMessage", () => {
  const t = (key: string) => (key === "live.webNoProxy" ? "WEB_NO_PROXY" : key);

  it("uses bilingual next-step copy for cors / missing proxy, not the raw English CORS sentence", () => {
    expect(isLiveProxyUnavailableMessage(LIVE_CURSOR_CORS_ERROR)).toBe(true);
    expect(liveUserMessage(t, { message: LIVE_CURSOR_CORS_ERROR, code: "cors" })).toBe("WEB_NO_PROXY");
    expect(liveUserMessage(t, { message: "ok", proxyAvailable: false })).toBe("WEB_NO_PROXY");
    expect(liveUserMessage(t, { message: "Cursor session expired" })).toBe("Cursor session expired");
  });
});
