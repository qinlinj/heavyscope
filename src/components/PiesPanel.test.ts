import { describe, expect, it } from "vitest";
import { pieChartHeight, pieLegendMode, pieMinOuterRadius, pieOuterRadiusPx, pieShowsRemaining } from "@/components/PiesPanel";

describe("pie layout", () => {
  it("shows the remaining pie only on lg/xl", () => {
    expect(pieShowsRemaining("sm", false)).toBe(false);
    expect(pieShowsRemaining("md", false)).toBe(false);
    expect(pieShowsRemaining("lg", false)).toBe(true);
    expect(pieShowsRemaining("xl", false)).toBe(true);
    expect(pieShowsRemaining("lg", true)).toBe(false);
  });

  it("keeps sm on hover-only and md on a short legend", () => {
    expect(pieLegendMode("sm", false)).toBe("none");
    expect(pieLegendMode("md", false)).toBe("short");
    expect(pieLegendMode("lg", false)).toBe("full");
    expect(pieLegendMode("xl", false)).toBe("full");
  });

  it("keeps sm outer radius at least 56px and md at least 72px", () => {
    expect(pieMinOuterRadius("sm")).toBeGreaterThanOrEqual(56);
    expect(pieMinOuterRadius("md")).toBeGreaterThanOrEqual(72);
    expect(pieOuterRadiusPx("sm", 80)).toBeGreaterThanOrEqual(56);
    expect(pieOuterRadiusPx("md", 80)).toBeGreaterThanOrEqual(72);
    expect(pieOuterRadiusPx("lg", 240)).toBeGreaterThanOrEqual(72);
  });

  it("sizes the chart box to fit the minimum disk", () => {
    expect(pieChartHeight("sm")).toBeGreaterThanOrEqual(pieMinOuterRadius("sm") * 2);
    expect(pieChartHeight("md")).toBeGreaterThanOrEqual(pieMinOuterRadius("md") * 2);
  });
});
