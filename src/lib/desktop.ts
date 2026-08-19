import type { Pool } from "@/db/schema";
import { usagePercent } from "@/lib/format";

export type DesktopShellMode = "accessory" | "window" | "web";

export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function traySummary(pools: Pool[]): string {
  if (pools.length === 0) return "HeavyScope";
  const hottest = [...pools].sort((a, b) => usagePercent(b) - usagePercent(a))[0];
  const pct = Math.round(usagePercent(hottest));
  return `${hottest.name} ${pct}%`;
}

/** Compact menu-bar title, e.g. "82%". */
export function trayPercentLabel(pools: Pool[]): string | null {
  if (pools.length === 0) return null;
  const hottest = [...pools].sort((a, b) => usagePercent(b) - usagePercent(a))[0];
  return `${Math.round(usagePercent(hottest))}%`;
}

export async function desktopShellMode(): Promise<DesktopShellMode> {
  if (!isDesktopShell()) return "web";
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const mode = await invoke<string>("shell_mode");
    return mode === "accessory" ? "accessory" : "window";
  } catch {
    return "web";
  }
}

export async function syncTraySummary(pools: Pool[]): Promise<void> {
  if (!isDesktopShell()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_tray_summary", {
      summary: traySummary(pools),
      percent: trayPercentLabel(pools),
    });
  } catch {
    // Browser build or missing desktop command.
  }
}

/** macOS-only: read-only Cursor state.vscdb → WorkosCursorSessionToken. Never writes. */
export async function readCursorSessionTokenFromApp(): Promise<string | null> {
  if (!isDesktopShell()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const token = await invoke<string>("read_cursor_session_token");
    return token?.trim() ? token : null;
  } catch {
    return null;
  }
}

export function isMacDesktop(): boolean {
  if (!isDesktopShell()) return false;
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
}
