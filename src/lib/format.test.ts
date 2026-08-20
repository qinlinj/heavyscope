import { describe, expect, it } from "vitest";
import { formatAmount } from "@/lib/format";

describe("formatAmount", () => {
  it("uses 0 fraction digits for integers and request counts", () => {
    expect(formatAmount(12, "requests")).toBe("12 requests");
    expect(formatAmount(12.0, "credits")).toBe("12 credits");
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
