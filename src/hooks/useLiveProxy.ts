import { useEffect, useState } from "react";
import { probeLiveProxy } from "@/adapters/liveHttp";
import { isDesktopShell } from "@/lib/desktop";

/**
 * Tauri and `pnpm dev` always have a live path. Production web probes
 * `/proxy/cursor/__heavyscope_ok` for the same-origin proxy header.
 */
export function useLiveProxyAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(() => {
    if (isDesktopShell()) return true;
    try {
      return import.meta.env?.DEV ? true : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (available !== null) return;
    let cancelled = false;
    void probeLiveProxy().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [available]);

  return available;
}
