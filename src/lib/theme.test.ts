import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, resolvedTheme } from "./theme";

describe("parseTheme", () => {
  it("accepts dark, light, and system, and defaults to dark", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme(undefined)).toBe("dark");
    expect(parseTheme("")).toBe("dark");
    expect(parseTheme("nope")).toBe("dark");
  });
});

describe("resolvedTheme", () => {
  it("maps system to the current color-scheme preference", () => {
    expect(resolvedTheme("dark", false)).toBe("dark");
    expect(resolvedTheme("light", true)).toBe("light");
    expect(resolvedTheme("system", true)).toBe("dark");
    expect(resolvedTheme("system", false)).toBe("light");
  });
});
