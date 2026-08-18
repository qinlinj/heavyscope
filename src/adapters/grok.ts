import type { UsageAdapter } from "./types";

/** Reserved Grok / xAI source. Same interface so the UI can show Coming soon. */
export const grokAdapter: UsageAdapter = {
  id: "grok",
  labelKey: "adapters.grok",
  async pull() {
    return {
      ok: false,
      records: [],
      message: "Grok adapter is reserved",
    };
  },
};
