import { cursorAdapter } from "./cursor";
import { grokAdapter } from "./grok";
import { manualAdapter } from "./manual";
import type { UsageAdapter } from "./types";

const adapters: UsageAdapter[] = [manualAdapter, cursorAdapter, grokAdapter];

export function listAdapters(): UsageAdapter[] {
  return adapters;
}

export function getAdapter(id: string): UsageAdapter | undefined {
  return adapters.find((adapter) => adapter.id === id);
}
