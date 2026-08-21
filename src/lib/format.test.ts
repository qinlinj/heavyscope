import { describe, expect, it } from "vitest";
import { formatAmount, formatAtMostDecimals, formatSignedAmount, formatTrendHoverValue } from "@/lib/format";

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
