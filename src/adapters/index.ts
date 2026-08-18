export { applyAdapterResult, HINT_TO_POOL_ID, resolvePoolId } from "./apply";
export { cursorAdapter, parseCursorInput } from "./cursor";
export { grokAdapter } from "./grok";
export { adapterSignature, hashSignature } from "./hash";
export { manualAdapter } from "./manual";
export { getAdapter, listAdapters } from "./registry";
export type {
  AdapterContext,
  AdapterResult,
  AdapterUsageDraft,
  ApplyReport,
  PoolHint,
  UsageAdapter,
} from "./types";
