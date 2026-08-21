import { LIVE_CURSOR_CORS_ERROR, LIVE_GROK_CORS_ERROR } from "@/adapters/liveConstants";

type Translate = (key: string) => string;

export function isLiveProxyUnavailableMessage(message: string | undefined): boolean {
  if (!message) return false;
  return message === LIVE_CURSOR_CORS_ERROR || message === LIVE_GROK_CORS_ERROR;
}

/** Bilingual next-step copy when the web host has no same-origin proxy. */
export function liveUserMessage(
  t: Translate,
  opts: {
    message: string;
    code?: string;
    proxyAvailable?: boolean | null;
  },
): string {
  if (opts.proxyAvailable === false || opts.code === "cors" || isLiveProxyUnavailableMessage(opts.message)) {
    return t("live.webNoProxy");
  }
  return opts.message;
}
