import type { UsageAdapter } from "./types";

export const manualAdapter: UsageAdapter = {
  id: "manual",
  labelKey: "adapters.manual",
  async pull() {
    return {
      ok: true,
      records: [],
      message: "Manual entry is the source of truth",
    };
  },
};
