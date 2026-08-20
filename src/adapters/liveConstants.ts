/** Shared constants for unofficial live usage connectors. */

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const CURSOR_USAGE_PATH = "/api/usage-summary";
export const CURSOR_ORIGIN = "https://cursor.com";
export const CURSOR_PROXY_PREFIX = "/proxy/cursor";

export const GROK_CREDITS_PATH = "/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig";
export const GROK_ORIGIN = "https://grok.com";
export const GROK_PROXY_PREFIX = "/proxy/grok";

export const GROK_CLI_ORIGIN = "https://cli-chat-proxy.grok.com";
export const GROK_CLI_PROXY_PREFIX = "/proxy/grok-cli";
export const GROK_CLI_BILLING_PATH = "/v1/billing?format=credits";
export const GROK_CLI_TOKEN_AUTH = "xai-grok-cli";

export const GRPC_WEB_EMPTY_BODY = new Uint8Array([0, 0, 0, 0, 0]);

export const LIVE_CURSOR_CORS_ERROR =
  "Live Cursor sync needs the desktop app or `pnpm dev` proxy";
export const LIVE_GROK_CORS_ERROR =
  "Live Grok sync needs the desktop app or `pnpm dev` proxy";

export const LIVE_PERCENT_TOTAL = 100;
export const LIVE_PERCENT_UNIT = "%";
