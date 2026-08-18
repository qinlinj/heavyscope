import type { Pool } from "@/db/schema";
import { usagePercent } from "@/lib/format";

export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function traySummary(pools: Pool[]): string {
  if (pools.length === 0) return "HeavyScope";
  const hottest = [...pools].sort((a, b) => usagePercent(b) - usagePercent(a))[0];
  const pct = Math.round(usagePercent(hottest));
  return `${hottest.name} ${pct}%`;
}

export async function syncTraySummary(pools: Pool[]): Promise<void> {
  if (!isDesktopShell()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_tray_summary", { summary: traySummary(pools) });
  } catch {
    // Browser build or missing desktop command.
  }
}
