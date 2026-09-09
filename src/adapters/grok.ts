import type { UsageAdapter } from "./types";

/**
 * Snapshot-style Grok adapter stays reserved.
 * Live grok.com credits sync lives in grokLive.ts / liveClient.ts.
 *
 * TODO: keep researching a Bot / Agents / API-for-bot product segment in
 * GetGrokCreditsConfig. If the proto has no such breakdown, do not invent
 * numbers — the UI marks preset-grok-bot as calibrate-manually.
 */
export const grokAdapter: UsageAdapter = {
  id: "grok",
  labelKey: "adapters.grok",
  async pull() {
    return {
      ok: false,
      records: [],
      message: "Grok snapshot adapter is reserved; use Settings → Grok live connect",
    };
  },
};
