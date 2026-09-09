import { describe, expect, it } from "vitest";
import type { Pool } from "@/db/schema";
import { LINUX_DESKTOP_WINDOW, MACOS_TRAY_PANEL, trayPercentLabel, traySummary } from "@/lib/desktop";

function pool(partial: Partial<Pool> & Pick<Pool, "id" | "name" | "quota_used" | "quota_total">): Pool {
  return {
    type: "credits",
    reset_at: null,
    reset_cycle: "weekly",
    unit: "req",
    color: "#22c55e",
    is_preset: 0,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("macOS panel vs Linux window", () => {
  it("keeps Accessory 400×660 separate from the Linux 980×720 window", () => {
    expect(MACOS_TRAY_PANEL.width).toBe(400);
    expect(MACOS_TRAY_PANEL.height).toBe(660);
    expect(LINUX_DESKTOP_WINDOW.width).toBe(980);
    expect(LINUX_DESKTOP_WINDOW.height).toBe(720);
  });
});

describe("traySummary", () => {
  it("returns the product name when there are no pools", () => {
    expect(traySummary([])).toBe("HeavyScope");
    expect(trayPercentLabel([])).toBeNull();
  });

  it("uses the hottest pool name and rounded percent", () => {
    const pools = [
      pool({ id: "a", name: "Cool", quota_used: 10, quota_total: 100 }),
      pool({ id: "b", name: "Hot", quota_used: 82.4, quota_total: 100 }),
    ];
    expect(traySummary(pools)).toBe("Hot 82%");
    expect(trayPercentLabel(pools)).toBe("82%");
  });
});
