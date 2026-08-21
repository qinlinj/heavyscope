import { describe, expect, it } from "vitest";
import { PRESET_POOL_COLORS } from "@/db/defaults";
import {
  formatAmount,
  formatAtMostDecimals,
  formatSignedAmount,
  formatTrendHoverValue,
  formatUsdQuotaLine,
  otherUsdView,
  progressFillPercent,
  progressIndicatorStyle,
} from "@/lib/format";

describe("formatAmount", () => {
  it("uses 0 fraction digits for integers and request counts", () => {
    expect(formatAmount(12, "requests")).toBe("12 requests");
    expect(formatAmount(12.0, "credits")).toBe("12 credits");
    expect(formatAmount(12.9, "requests")).toBe("13 requests");
    expect(formatAmount(40, "USD")).toMatch(/40/);
    expect(formatAmount(40, "USD")).not.toMatch(/40\.00/);
  });

  it("caps % and $ at two fraction digits and never prints a long float", () => {
    expect(formatAmount(11.2, "%")).toMatch(/11\.2/);
    expect(formatAmount(1 / 3, "%")).not.toMatch(/0\.333333/);
    expect(formatAmount(40.555, "USD")).not.toMatch(/40\.555/);
    expect(formatAmount(12.3456789, "credits")).not.toMatch(/12\.3456789/);
  });
});

describe("formatSignedAmount", () => {
  it("prefixes a plus for positive recent-record amounts via formatAmount", () => {
    expect(formatSignedAmount(12.345, "USD")).toMatch(/^\+/);
    expect(formatSignedAmount(12.345, "USD")).not.toMatch(/12\.345/);
    expect(formatSignedAmount(4, "requests")).toBe("+4 requests");
  });

  it("does not prefix a plus for zero or negative amounts", () => {
    expect(formatSignedAmount(0, "credits")).toBe("0 credits");
    expect(formatSignedAmount(-1.239, "USD")).toMatch(/-.*1\.24|−.*1\.24/);
    expect(formatSignedAmount(-1.239, "USD")).not.toMatch(/1\.239/);
  });
});

describe("otherUsdView", () => {
  it("maps period $126.58 / $400 as a dollar line, not 0%", () => {
    const view = otherUsdView({ unit: "USD", quota_used: 126.58, quota_total: 400 });
    expect(view?.dollarLine).toMatch(/126\.58/);
    expect(view?.dollarLine).toMatch(/400/);
    expect(view?.dollarLine).not.toMatch(/%/);
    expect(view?.remaining).toBeCloseTo(273.42, 5);
    expect(view?.usedPercent).toBeCloseTo(31.645, 3);
  });

  it("shows $0 / $400 when spend is truly 0, not “0%” as the dollar line", () => {
    const view = otherUsdView({ unit: "USD", quota_used: 0, quota_total: 400 });
    expect(view?.dollarLine).toMatch(/0/);
    expect(view?.dollarLine).toMatch(/400/);
    expect(view?.dollarLine).not.toMatch(/0%/);
    expect(formatUsdQuotaLine(0, 400)).not.toMatch(/%/);
  });

  it("does not treat a leftover % seed as Other dollars", () => {
    expect(otherUsdView({ unit: "%", quota_used: 0, quota_total: 100 })).toBeNull();
  });
});

describe("progressIndicatorStyle", () => {
  it("uses used% width and the original pool accent, not a full bar", () => {
    const other = progressIndicatorStyle(PRESET_POOL_COLORS["preset-cursor-other"], 31.645);
    expect(other.backgroundColor).toBe("#fbbf24");
    expect(other.width).toBe(`${progressFillPercent(31.645)}%`);
    expect(progressFillPercent(31.645)).toBeLessThan(100);
    expect(progressFillPercent(21)).not.toBe(100);
    expect(progressIndicatorStyle(PRESET_POOL_COLORS["preset-grok-heavy"], 12).backgroundColor).toBe(
      "#38bdf8",
    );
    expect(progressIndicatorStyle(PRESET_POOL_COLORS["preset-grok-bot"], 21).backgroundColor).toBe(
      "#a78bfa",
    );
    expect(progressIndicatorStyle(PRESET_POOL_COLORS["preset-cursor-models"], 42).backgroundColor).toBe(
      "#34d399",
    );
  });
});

describe("formatTrendHoverValue", () => {
  it("formats USD hover amounts with exactly 2 decimal places", () => {
    expect(formatTrendHoverValue(40, "USD")).toBe("+40.00");
    expect(formatTrendHoverValue(12.3, "$")).toBe("+12.30");
    expect(formatTrendHoverValue(12.345, "USD")).toBe("+12.35");
    expect(formatTrendHoverValue(12.345, "USD")).not.toMatch(/12\.345/);
  });

  it("caps percent hover values at 2 decimal places and strips a long tail", () => {
    expect(formatTrendHoverValue(21.473078, "%")).toBe("+21.47");
    expect(formatTrendHoverValue(21.473078, "percent")).not.toMatch(/21\.473078/);
    expect(formatTrendHoverValue(11.2, "%")).toBe("+11.2");
    expect(formatTrendHoverValue(21, "pct")).toBe("+21");
  });

  it("never dumps a raw float for other units", () => {
    expect(formatTrendHoverValue(1 / 3, "credits")).toBe("+0.33");
    expect(formatAtMostDecimals(21.473078, 2)).toBe("21.47");
  });
});
