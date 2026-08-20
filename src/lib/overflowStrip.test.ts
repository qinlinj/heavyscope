import { describe, expect, it } from "vitest";
import { overflowCanScroll, overflowScrollDelta } from "./overflowStrip";

describe("overflowCanScroll", () => {
  it("hides both buttons when the row fits", () => {
    expect(overflowCanScroll(0, 380, 380)).toEqual({ prev: false, next: false });
  });

  it("shows next at the start and prev at the end of a wide row", () => {
    expect(overflowCanScroll(0, 800, 380)).toEqual({ prev: false, next: true });
    expect(overflowCanScroll(420, 800, 380)).toEqual({ prev: true, next: false });
    expect(overflowCanScroll(120, 800, 380)).toEqual({ prev: true, next: true });
  });
});

describe("overflowScrollDelta", () => {
  it("scrolls a majority of the viewport, at least 80px", () => {
    expect(overflowScrollDelta(380)).toBe(228);
    expect(overflowScrollDelta(40)).toBe(80);
  });
});
